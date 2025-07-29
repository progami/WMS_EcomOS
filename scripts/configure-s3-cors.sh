#!/bin/bash

# Configure S3 CORS for WMS bucket
# This script should be run once to set up CORS on the S3 bucket

BUCKET_NAME="${S3_BUCKET_NAME:-wms-uploads}"
REGION="${AWS_REGION:-us-east-1}"

echo "Configuring CORS for S3 bucket: $BUCKET_NAME"

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket "$BUCKET_NAME" \
  --cors-configuration file://s3-cors-config.json \
  --region "$REGION"

if [ $? -eq 0 ]; then
  echo "✅ CORS configuration applied successfully"
  
  # Verify the configuration
  echo ""
  echo "Current CORS configuration:"
  aws s3api get-bucket-cors --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null || echo "No CORS configuration found"
else
  echo "❌ Failed to apply CORS configuration"
  exit 1
fi