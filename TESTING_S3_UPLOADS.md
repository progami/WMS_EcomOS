# Testing S3 Upload Implementation

## Setup Instructions

1. **Configure S3 CORS** (Run this on a machine with AWS CLI configured):
   ```bash
   ./scripts/configure-s3-cors.sh
   ```

2. **Test the S3 upload locally**:
   ```bash
   npm run dev
   ```

3. **Navigate to test page**:
   ```
   http://localhost:3000/test/s3-upload
   ```

4. **Test upload functionality**:
   - Select a file (preferably under 5MB)
   - Click "Upload to S3"
   - Check for success message or errors
   - Open browser console (F12) to check for CORS errors

## What to Check

### Success Indicators:
- ✅ File uploads without errors
- ✅ Progress bar shows upload progress
- ✅ Success message appears with S3 details
- ✅ "View File" link works and shows the uploaded file

### Error Indicators:
- ❌ CORS error in browser console
- ❌ 403 Forbidden errors
- ❌ Network errors during upload

## If CORS Errors Occur

1. **Verify CORS was applied**:
   ```bash
   aws s3api get-bucket-cors --bucket $S3_BUCKET_NAME
   ```

2. **Check the error domain**:
   - The domain in the CORS error must match one in AllowedOrigins
   - For local testing, it should be http://localhost:3000

3. **Wait and retry**:
   - CORS changes can take a few minutes to propagate
   - Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Next Steps

Once S3 uploads work on the test page:
1. The receive and ship pages will be updated to use S3
2. Base64 attachments will be replaced with direct S3 uploads
3. This will fix the 413 Request Entity Too Large errors