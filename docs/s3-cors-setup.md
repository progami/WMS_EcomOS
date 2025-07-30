# S3 CORS Configuration Setup

This document explains how to configure CORS for the S3 bucket to allow direct browser uploads.

## Prerequisites

- AWS CLI installed and configured
- Access to the S3 bucket used by the WMS application
- S3 bucket name set in environment variable `S3_BUCKET_NAME`

## Setup Instructions

1. **Run the CORS configuration script:**
   ```bash
   cd /path/to/wms
   ./scripts/configure-s3-cors.sh
   ```

2. **Verify CORS is configured:**
   ```bash
   aws s3api get-bucket-cors --bucket $S3_BUCKET_NAME
   ```

3. **Expected output:**
   ```json
   {
     "CORSRules": [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
         "AllowedOrigins": [
           "https://wms.targonglobal.com",
           "http://localhost:3000",
           "http://localhost:3001",
           "http://localhost:3002"
         ],
         "ExposeHeaders": [
           "ETag",
           "x-amz-server-side-encryption",
           "x-amz-request-id",
           "x-amz-id-2"
         ],
         "MaxAgeSeconds": 3000
       }
     ]
   }
   ```

## Testing Locally

1. **Set environment variables:**
   ```bash
   export S3_BUCKET_NAME=your-bucket-name
   export AWS_REGION=us-east-1
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Test file uploads:**
   - Navigate to Operations > Receive
   - Try uploading a file attachment
   - Check browser console for any CORS errors

## Troubleshooting

### CORS errors still appearing
1. Make sure the bucket CORS configuration was applied successfully
2. Check that the origin in the error message matches one of the allowed origins
3. Wait a few minutes for the CORS configuration to propagate

### Different domain needed
1. Edit `s3-cors-config.json` and add your domain to `AllowedOrigins`
2. Re-run the configuration script

### Permissions issues
Ensure your AWS credentials have the following permissions:
- `s3:PutBucketCors`
- `s3:GetBucketCors`