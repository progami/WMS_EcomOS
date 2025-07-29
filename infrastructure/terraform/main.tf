terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
}

# Data source for Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group
resource "aws_security_group" "wms_sg" {
  name_prefix = "${var.instance_name}-sg-"
  description = "Security group for WMS application"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Application Port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.instance_name}-sg"
  }
}

# EC2 Instance
resource "aws_instance" "wms" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  key_name = var.key_name

  vpc_security_group_ids = [aws_security_group.wms_sg.id]

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
  }

  tags = {
    Name        = var.instance_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  user_data = base64encode(file("${path.module}/user_data_simple.sh"))

  lifecycle {
    create_before_destroy = true
  }

  # Attach IAM instance profile for S3 access
  iam_instance_profile = aws_iam_instance_profile.wms_profile.name
}

# S3 Bucket for file storage
resource "aws_s3_bucket" "wms_files" {
  bucket = var.s3_bucket_name != "" ? var.s3_bucket_name : "wms-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.instance_name}-files"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "wms_files" {
  bucket = aws_s3_bucket.wms_files.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "wms_files" {
  bucket = aws_s3_bucket.wms_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "wms_files" {
  bucket = aws_s3_bucket.wms_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "wms_files" {
  bucket = aws_s3_bucket.wms_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "wms_files" {
  bucket = aws_s3_bucket.wms_files.id

  rule {
    id     = "cleanup-temp-exports"
    status = "Enabled"

    filter {
      prefix = "exports/temp/"
    }

    expiration {
      days = 7
    }
  }

  rule {
    id     = "archive-old-transactions"
    status = "Enabled"

    filter {
      prefix = "transactions/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "wms_instance_role" {
  name = "${var.instance_name}-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.instance_name}-instance-role"
    Environment = var.environment
  }
}

# IAM Policy for S3 Access
resource "aws_iam_role_policy" "wms_s3_policy" {
  name = "${var.instance_name}-s3-policy"
  role = aws_iam_role.wms_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObjectVersion",
          "s3:PutObjectTagging",
          "s3:GetObjectTagging"
        ]
        Resource = [
          aws_s3_bucket.wms_files.arn,
          "${aws_s3_bucket.wms_files.arn}/*"
        ]
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "wms_profile" {
  name = "${var.instance_name}-instance-profile"
  role = aws_iam_role.wms_instance_role.name
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# Elastic IP
resource "aws_eip" "wms" {
  instance = aws_instance.wms.id
  domain   = "vpc"

  tags = {
    Name = "${var.instance_name}-eip"
  }
}

# Generate Ansible inventory
resource "local_file" "ansible_inventory" {
  content = templatefile("${path.module}/../ansible/inventory/production.yml.tpl", {
    public_ip  = aws_eip.wms.public_ip
    private_ip = aws_instance.wms.private_ip
    instance_id = aws_instance.wms.id
  })
  filename = "${path.module}/../ansible/inventory/production.yml"
}