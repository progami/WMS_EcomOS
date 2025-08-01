# S3 Development Environment Setup

## Overview
This guide explains how to set up separate S3 buckets for development and production environments.

## Bucket Structure

- **Development**: `wms-development-459288913318`
- **Production**: `wms-production-459288913318`

## AWS Setup Steps

### 1. Create Development Bucket

```bash
# Create the development bucket
aws s3 mb s3://wms-development-459288913318 --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket wms-development-459288913318 \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket wms-development-459288913318 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2. Configure CORS

Create a CORS configuration file `cors.json`:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://your-dev-domain.com"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Apply the CORS configuration:

```bash
aws s3api put-bucket-cors \
  --bucket wms-development-459288913318 \
  --cors-configuration file://cors.json
```

### 3. Set Bucket Policy

Create a bucket policy file `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUrlUploads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::459288913318:root"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::wms-development-459288913318/*"
    }
  ]
}
```

Apply the policy:

```bash
aws s3api put-bucket-policy \
  --bucket wms-development-459288913318 \
  --policy file://bucket-policy.json
```

### 4. Configure IAM User/Role

For local development, create an IAM user with S3 access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::wms-development-459288913318",
        "arn:aws:s3:::wms-development-459288913318/*"
      ]
    }
  ]
}
```

## Local Development Setup

### 1. Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### 2. Environment Variables

Update `.env.local`:

```env
# S3 Configuration
S3_BUCKET_NAME="wms-development-459288913318"
S3_BUCKET_REGION="us-east-1"
S3_USE_ACCELERATED_ENDPOINT="false"
S3_FORCE_PATH_STYLE="false"
S3_PRESIGNED_URL_EXPIRY="3600"

# Optional: Only if not using AWS CLI credentials
# AWS_ACCESS_KEY_ID="your-dev-access-key"
# AWS_SECRET_ACCESS_KEY="your-dev-secret-key"
```

## Production Setup

For production, use IAM roles attached to EC2 instances instead of access keys:

1. Create an IAM role with S3 access to the production bucket
2. Attach the role to your EC2 instances
3. The SDK will automatically use the instance role

## Testing S3 Upload

Use the test page at http://localhost:3000/test/s3-upload to verify:

1. File uploads work correctly
2. Presigned URLs are generated
3. Files are stored in the correct bucket
4. CORS is properly configured

## Troubleshooting

### 403 Forbidden Error

1. Check AWS credentials are configured:
   ```bash
   aws sts get-caller-identity
   ```

2. Verify bucket exists and you have access:
   ```bash
   aws s3 ls s3://wms-development-459288913318
   ```

3. Check CORS configuration:
   ```bash
   aws s3api get-bucket-cors --bucket wms-development-459288913318
   ```

### CORS Errors

1. Ensure the origin (http://localhost:3000) is in the AllowedOrigins
2. Check that PUT method is allowed
3. Verify ExposeHeaders includes "ETag"

### Environment Detection

The S3 service automatically selects the correct bucket based on NODE_ENV:
- `development` → wms-development-459288913318
- `production` → wms-production-459288913318

You can override this by explicitly setting S3_BUCKET_NAME in your environment.