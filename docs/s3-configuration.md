# S3 Configuration Guide

This guide explains how to set up AWS S3 for file storage in the WMS application.

## Overview

The WMS application now uses AWS S3 for all file storage, replacing the previous local filesystem and base64 database storage. This provides:

- Scalable file storage
- Better performance (no 413 errors)
- Secure file access with presigned URLs
- Automatic file expiration for temporary exports
- CDN support for better global performance

## Required Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# AWS S3 Configuration (Required for file uploads)
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="your-wms-bucket-name"
S3_BUCKET_REGION="us-east-1"

# S3 Configuration Options (Optional)
S3_USE_ACCELERATED_ENDPOINT="false"
S3_FORCE_PATH_STYLE="false"
S3_PRESIGNED_URL_EXPIRY="3600"

# CloudFront CDN (Optional - for better performance)
# CLOUDFRONT_DOMAIN="your-distribution.cloudfront.net"
```

## AWS Setup Steps

### 1. Create an S3 Bucket

1. Log in to AWS Console
2. Navigate to S3
3. Click "Create bucket"
4. Configure:
   - Bucket name: `your-company-wms` (must be globally unique)
   - Region: Choose your preferred region
   - Block all public access: YES (keep enabled)
   - Bucket versioning: Optional but recommended
   - Encryption: Enable (AES-256)

### 2. Create IAM User and Policy

1. Navigate to IAM
2. Create a new user for the WMS application
3. Create a new policy with these permissions:

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
        "s3:ListBucket",
        "s3:GetObjectVersion",
        "s3:PutObjectTagging",
        "s3:GetObjectTagging"
      ],
      "Resource": [
        "arn:aws:s3:::your-wms-bucket-name/*",
        "arn:aws:s3:::your-wms-bucket-name"
      ]
    }
  ]
}
```

4. Attach the policy to the user
5. Generate access keys for the user

### 3. Configure Bucket CORS

Add this CORS configuration to your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. Set Up Lifecycle Rules (Recommended)

Create lifecycle rules to automatically clean up old files:

1. For `exports/temp/` prefix:
   - Expiration: 7 days
   - This removes old export files

2. For `transactions/` prefix:
   - Transition to Glacier after 90 days (optional)
   - Keep files indefinitely or set retention policy

## File Structure in S3

The application organizes files in S3 with this structure:

```
your-wms-bucket/
├── transactions/
│   ├── YYYY/
│   │   ├── MM/
│   │   │   ├── {transaction-id}/
│   │   │   │   ├── packing_list_{timestamp}_{hash}_{filename}
│   │   │   │   ├── commercial_invoice_{timestamp}_{hash}_{filename}
│   │   │   │   └── ...
├── exports/
│   ├── temp/
│   │   ├── {user-id}/
│   │   │   ├── inventory-ledger_{timestamp}_{filename}
│   │   │   └── cost-ledger_{timestamp}_{filename}
│   └── scheduled/
│       ├── daily/
│       ├── weekly/
│       └── monthly/
├── templates/
│   ├── invoice_template_v{date}_{filename}
│   └── ...
└── generated-invoices/
    ├── YYYY/
    │   ├── MM/
    │   │   ├── {invoice-id}/
    │   │   │   └── invoice_{invoiceNumber}_{timestamp}.pdf
```

## Security Best Practices

1. **Never commit AWS credentials** to version control
2. Use IAM roles in production (EC2/ECS) instead of access keys
3. Enable MFA on your AWS account
4. Regularly rotate access keys
5. Monitor S3 access logs
6. Use bucket policies to restrict access by IP if needed

## Production Deployment

For production deployment on EC2:

1. Use IAM roles instead of access keys:
   ```bash
   # No need to set AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
   # Just set the bucket configuration
   S3_BUCKET_NAME="your-production-bucket"
   S3_BUCKET_REGION="us-east-1"
   ```

2. Enable CloudFront CDN:
   ```bash
   CLOUDFRONT_DOMAIN="d1234567890.cloudfront.net"
   ```

3. Use S3 Transfer Acceleration for global users:
   ```bash
   S3_USE_ACCELERATED_ENDPOINT="true"
   ```

## Troubleshooting

### "S3_BUCKET_NAME environment variable is required" Error

Make sure you've added all required S3 environment variables to your `.env.local` file and restarted the development server.

### "Access Denied" Errors

Check that your IAM user has the correct permissions and that the bucket policy allows access.

### CORS Errors

Ensure your S3 bucket CORS configuration includes your application's domain.

### Large File Uploads Failing

The application automatically uses multipart uploads for files larger than 5MB. If uploads are still failing, check:
- Network connectivity
- IAM permissions include multipart upload actions
- Bucket policy doesn't restrict file sizes

## Migration from Local Storage

If you have existing files stored locally or as base64 in the database, run the migration script:

```bash
npm run migrate:files-to-s3
```

(Note: This migration script needs to be implemented based on your current data)