# S3 File Storage Setup Guide

## Overview

The WMS application uses Amazon S3 for secure, scalable file storage. This guide covers setup for both local development and production deployment.

## Local Development

### Prerequisites

1. **AWS CLI** - Install and configure with your credentials:
   ```bash
   # Install AWS CLI (if not already installed)
   brew install awscli  # macOS
   # or
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"  # Linux
   
   # Configure credentials
   aws configure
   ```

2. **Environment Variables** - Add to `.env.local`:
   ```env
   # S3 Configuration
   S3_BUCKET_NAME="wms-production-459288913318"
   S3_BUCKET_REGION="us-east-1"
   AWS_REGION="us-east-1"
   
   # Optional: Explicit credentials (only if not using AWS CLI)
   # AWS_ACCESS_KEY_ID="your-key"
   # AWS_SECRET_ACCESS_KEY="your-secret"
   ```

### Testing S3 Integration

1. **Run the test script**:
   ```bash
   npx tsx scripts/test-s3-upload.ts
   ```

2. **Test through the API** (with dev server running):
   ```bash
   # Start dev server
   npm run dev
   
   # In another terminal, test file operations
   # The actual transaction endpoints require authentication
   ```

## Production Deployment

### Infrastructure Setup

The S3 bucket and IAM roles are managed through Terraform:

1. **Deploy infrastructure**:
   ```bash
   cd infrastructure/terraform
   terraform init
   terraform plan -var-file=production.tfvars
   terraform apply -var-file=production.tfvars
   ```

2. **Key resources created**:
   - S3 bucket with versioning and encryption
   - IAM role for EC2 instance
   - Lifecycle policies for automatic cleanup
   - CORS configuration for browser uploads

### EC2 Instance Configuration

The EC2 instance uses IAM roles for S3 access (no credentials in code):

1. **IAM Role Permissions**:
   - PutObject, GetObject, DeleteObject
   - ListBucket operations
   - Object tagging permissions

2. **Environment Variables** (set via Ansible):
   ```env
   S3_BUCKET_NAME="wms-production-459288913318"
   S3_BUCKET_REGION="us-east-1"
   ```

## S3 Folder Structure

```
wms-production-{account-id}/
├── transactions/
│   └── YYYY/MM/{transaction-id}/
│       └── {documentType}_{timestamp}_{hash}_{filename}
├── exports/
│   ├── temp/{user-id}/
│   │   └── {exportType}_{timestamp}_{filename}
│   └── scheduled/{frequency}/YYYY-MM-DD/
│       └── {reportType}_{timestamp}_{filename}
├── templates/
│   └── {templateType}_v{version}_{filename}
└── generated-invoices/
    └── YYYY/MM/{invoice-id}/
        └── invoice_{invoiceNumber}_{timestamp}.pdf
```

## Security Features

1. **File Validation**:
   - MIME type checking
   - File size limits (configurable)
   - Filename sanitization

2. **Access Control**:
   - Presigned URLs for temporary access
   - 1-hour default expiry
   - No public bucket access

3. **Malware Scanning** (optional):
   - Configurable virus scanning
   - Quarantine suspicious files

## Common Operations

### Upload a file (in application code):
```typescript
const s3Service = getS3Service();
const key = s3Service.generateKey(
  { type: 'transaction', transactionId: 'TRX-123', documentType: 'receipt' },
  'receipt.pdf'
);
const result = await s3Service.uploadFile(buffer, key);
```

### Get download URL:
```typescript
const presignedUrl = await s3Service.getPresignedUrl(key);
// URL valid for 1 hour by default
```

### Check file exists:
```typescript
const exists = await s3Service.fileExists(key);
```

## Troubleshooting

### Common Issues

1. **403 Forbidden errors**:
   - Check IAM role is attached to EC2 instance
   - Verify bucket policy allows the role
   - Ensure correct bucket region

2. **Local development issues**:
   - Verify AWS CLI is configured: `aws sts get-caller-identity`
   - Check S3_BUCKET_NAME in .env.local
   - Ensure no conflicting AWS credentials in environment

3. **File upload failures**:
   - Check file size (body parser limits)
   - Verify CORS configuration for browser uploads
   - Check network connectivity to S3

### Debug Commands

```bash
# List bucket contents
aws s3 ls s3://wms-production-459288913318/

# Check IAM role (on EC2)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Test S3 access
aws s3 cp test.txt s3://wms-production-459288913318/test.txt
```

## Migration Notes

Files are no longer stored as base64 in the database. The migration process:
1. Old attachments remain in database (backward compatible)
2. New uploads go to S3
3. Database stores S3 keys instead of base64 data
4. No existing files need migration (per requirements)

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| S3_BUCKET_NAME | S3 bucket name | Yes | - |
| S3_BUCKET_REGION | AWS region for S3 | No | us-east-1 |
| AWS_REGION | AWS SDK region | No | us-east-1 |
| S3_USE_ACCELERATED_ENDPOINT | Use S3 accelerated endpoint | No | false |
| S3_FORCE_PATH_STYLE | Force path-style S3 URLs | No | false |
| S3_PRESIGNED_URL_EXPIRY | URL expiry in seconds | No | 3600 |