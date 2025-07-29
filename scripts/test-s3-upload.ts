#!/usr/bin/env npx tsx

import 'dotenv/config'
import { S3Service } from '../src/services/s3.service.js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testS3Upload() {
  console.log('Testing S3 upload functionality...')
  
  // Initialize S3 service
  const s3Service = new S3Service()
  
  try {
    // Create a test file
    const testContent = 'This is a test file for S3 upload verification'
    const testFileName = 'test-upload.txt'
    const testFilePath = path.join('/tmp', testFileName)
    
    fs.writeFileSync(testFilePath, testContent)
    console.log('Created test file:', testFilePath)
    
    // Upload file to S3
    const fileBuffer = fs.readFileSync(testFilePath)
    const s3Key = s3Service.generateKey(
      { 
        type: 'transaction', 
        transactionId: 'TEST-123', 
        documentType: 'test' 
      },
      testFileName
    )
    
    console.log('Uploading to S3 with key:', s3Key)
    
    const uploadResult = await s3Service.uploadFile(fileBuffer, s3Key, {
      contentType: 'text/plain',
      metadata: {
        originalName: testFileName,
        uploadedBy: 'test-script',
        timestamp: new Date().toISOString()
      }
    })
    
    console.log('Upload successful!')
    console.log('Key:', uploadResult.key)
    console.log('Bucket:', uploadResult.bucket)
    console.log('ETag:', uploadResult.etag)
    console.log('Version ID:', uploadResult.versionId)
    
    // Generate presigned URL for download
    const presignedUrl = await s3Service.getPresignedUrl(s3Key)
    console.log('\nPresigned URL for download:')
    console.log(presignedUrl)
    
    // Verify file exists
    const exists = await s3Service.fileExists(s3Key)
    console.log('\nFile exists check:', exists)
    
    // Clean up
    fs.unlinkSync(testFilePath)
    console.log('\nTest completed successfully!')
    
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testS3Upload()