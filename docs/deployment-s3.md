# S3 Deployment Guide for WMS

This guide explains how S3 is configured and deployed in production using Terraform and Ansible.

## Overview

The WMS application uses AWS S3 for all file storage in production. The infrastructure is fully managed by Terraform, and the EC2 instance uses IAM roles for secure access (no AWS credentials needed).

## Infrastructure Components

### 1. S3 Bucket (Terraform-managed)
- Bucket with versioning enabled
- Server-side encryption (AES-256)
- Public access blocked
- CORS configuration for your domains
- Lifecycle rules for automatic cleanup

### 2. IAM Role and Instance Profile
- EC2 instance role with S3 permissions
- Least-privilege access (only to WMS bucket)
- No AWS credentials needed in application

### 3. Lifecycle Policies
- Temporary exports: Deleted after 7 days
- Transaction files: Moved to Glacier after 180 days

## Deployment Process

### Prerequisites
1. AWS CLI configured with appropriate credentials
2. Terraform installed
3. Ansible installed
4. SSH key pair created in AWS

### Step 1: Configure Terraform Variables

Create `terraform.tfvars`:
```hcl
# AWS Configuration
aws_region = "us-east-1"

# Instance Configuration
instance_name    = "WMS-Production"
instance_type    = "t3.medium"
key_name         = "your-key-pair-name"
root_volume_size = 30

# Environment
environment = "production"

# S3 Configuration
# Leave empty for auto-generated bucket name
s3_bucket_name = ""

# CORS allowed origins
cors_allowed_origins = [
  "https://yourdomain.com",
  "https://www.yourdomain.com"
]
```

### Step 2: Deploy Infrastructure

```bash
cd infrastructure

# Initialize Terraform
make init

# Review infrastructure plan
make plan

# Deploy infrastructure (creates EC2, S3, IAM roles)
make apply
```

### Step 3: Deploy Application

The deployment automatically configures S3:

```bash
# Deploy application with S3 configuration
make ansible-deploy
```

This command:
1. Gets the S3 bucket name from Terraform outputs
2. Passes it to Ansible as a variable
3. Configures the application with S3 settings

### Step 4: Verify Deployment

```bash
# Check infrastructure status
make status

# View application logs
make logs

# SSH into server if needed
make ssh
```

## S3 Configuration in Production

The application uses the following S3 configuration:

### Environment Variables (Auto-configured)
```bash
# S3 bucket created by Terraform
S3_BUCKET_NAME=wms-production-files-123456789

# Region configuration
S3_BUCKET_REGION=us-east-1

# S3 options
S3_USE_ACCELERATED_ENDPOINT=false
S3_FORCE_PATH_STYLE=false
S3_PRESIGNED_URL_EXPIRY=3600
```

### IAM Role Permissions
The EC2 instance has these S3 permissions:
- `s3:PutObject` - Upload files
- `s3:GetObject` - Download files
- `s3:DeleteObject` - Delete files
- `s3:ListBucket` - List files
- `s3:GetObjectVersion` - Access versioned files
- `s3:PutObjectTagging` - Tag files
- `s3:GetObjectTagging` - Read tags

## Security Considerations

1. **No Credentials in Code**: The EC2 instance uses IAM roles
2. **Encryption**: All files are encrypted at rest
3. **Versioning**: File versions are maintained
4. **Access Control**: Only the EC2 instance can access the bucket
5. **Presigned URLs**: Temporary, secure URLs for file access

## Updating CORS Configuration

To add new domains to CORS:

1. Update `terraform.tfvars`:
```hcl
cors_allowed_origins = [
  "https://yourdomain.com",
  "https://app.yourdomain.com",
  "https://staging.yourdomain.com"
]
```

2. Apply changes:
```bash
cd infrastructure
make apply
```

## Monitoring and Maintenance

### S3 Storage Costs
Monitor your S3 usage in AWS Console:
- Storage used by prefix
- Request metrics
- Lifecycle transition savings

### Cleanup Old Files
Temporary files are automatically deleted after 7 days. For manual cleanup:

```bash
# SSH into server
make ssh

# Run cleanup command (if implemented)
cd /home/wms
npm run cleanup:s3
```

## Troubleshooting

### Files Not Uploading
1. Check application logs: `make logs`
2. Verify IAM role is attached: Check EC2 instance details
3. Test S3 access from instance:
   ```bash
   aws s3 ls s3://your-bucket-name/
   ```

### CORS Errors
1. Verify your domain is in `cors_allowed_origins`
2. Redeploy infrastructure: `make apply`
3. Clear browser cache

### Performance Issues
1. Enable S3 Transfer Acceleration:
   - Set `S3_USE_ACCELERATED_ENDPOINT=true` in Ansible vars
   - Enable on bucket in AWS Console
2. Consider CloudFront CDN for global users

## Rollback Procedure

If you need to rollback:

```bash
# Destroy all infrastructure
make destroy

# Redeploy previous version
git checkout <previous-version>
make deploy
```

## Cost Optimization

1. **Lifecycle Rules**: Already configured to move old files to Glacier
2. **Intelligent Tiering**: Consider for unpredictable access patterns
3. **CloudFront**: Reduce S3 requests by caching frequent files
4. **Monitoring**: Set up AWS Cost Explorer alerts

## Next Steps

After deployment:
1. Test file uploads in the application
2. Verify exports are working
3. Monitor S3 usage for the first week
4. Consider enabling CloudFront for better performance