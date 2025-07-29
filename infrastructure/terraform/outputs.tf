output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.wms.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.wms.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.wms.private_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.wms.public_dns
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.wms_sg.id
}

output "application_url" {
  description = "URL to access the application"
  value       = "http://${aws_eip.wms.public_ip}:3000"
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for file storage"
  value       = aws_s3_bucket.wms_files.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.wms_files.arn
}

output "s3_bucket_region" {
  description = "Region of the S3 bucket"
  value       = aws_s3_bucket.wms_files.region
}

output "iam_role_arn" {
  description = "ARN of the IAM role for the EC2 instance"
  value       = aws_iam_role.wms_instance_role.arn
}