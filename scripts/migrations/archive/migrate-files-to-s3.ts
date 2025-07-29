#!/usr/bin/env tsx
/**
 * Script to migrate existing files from database/filesystem to S3
 * 
 * This script handles:
 * 1. Base64 attachments stored in transaction JSON columns
 * 2. Files stored in local uploads/ directory
 * 3. Temporary export files
 */

import { PrismaClient } from '@prisma/client'
import { getS3Service } from '../../../src/services/s3.service'
import fs from 'fs/promises'
import path from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const prisma = new PrismaClient()
const s3Service = getS3Service()

interface MigrationStats {
  totalTransactions: number
  transactionsWithAttachments: number
  filesUploaded: number
  filesFailed: number
  bytesUploaded: number
}

async function migrateTransactionAttachments(dryRun = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalTransactions: 0,
    transactionsWithAttachments: 0,
    filesUploaded: 0,
    filesFailed: 0,
    bytesUploaded: 0,
  }

  console.log('Starting transaction attachments migration...')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

  try {
    // Fetch all transactions with attachments
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        attachments: {
          not: null,
        },
      },
      select: {
        id: true,
        transactionId: true,
        attachments: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    stats.totalTransactions = transactions.length
    console.log(`Found ${transactions.length} transactions with attachments`)

    for (const transaction of transactions) {
      const attachments = transaction.attachments as any
      
      if (!attachments || typeof attachments !== 'object') {
        continue
      }

      stats.transactionsWithAttachments++
      console.log(`\nProcessing transaction ${transaction.transactionId}...`)

      const updatedAttachments: any = Array.isArray(attachments) ? [] : {}
      let hasChanges = false

      // Handle array-style attachments
      if (Array.isArray(attachments)) {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i]
          
          if (attachment.data && attachment.data.startsWith('data:')) {
            // Extract base64 data
            const matches = attachment.data.match(/^data:(.+);base64,(.+)$/)
            if (!matches) {
              console.error(`  - Failed to parse base64 for attachment ${i}`)
              stats.filesFailed++
              updatedAttachments.push(attachment)
              continue
            }

            const mimeType = matches[1]
            const base64Data = matches[2]
            const buffer = Buffer.from(base64Data, 'base64')

            if (!dryRun) {
              try {
                // Generate S3 key
                const s3Key = s3Service.generateKey(
                  {
                    type: 'transaction',
                    transactionId: transaction.id,
                    documentType: attachment.category || 'general',
                  },
                  attachment.name || 'unnamed-file'
                )

                // Upload to S3
                const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
                  contentType: mimeType,
                  metadata: {
                    transactionId: transaction.id,
                    documentType: attachment.category || 'general',
                    originalName: attachment.name || 'unnamed-file',
                    migratedAt: new Date().toISOString(),
                  },
                })

                console.log(`  ✓ Uploaded ${attachment.name} to S3: ${s3Key}`)
                stats.filesUploaded++
                stats.bytesUploaded += buffer.length

                // Update attachment record
                updatedAttachments.push({
                  ...attachment,
                  s3Key: uploadResult.key,
                  s3Url: uploadResult.url,
                  size: uploadResult.size,
                  data: undefined, // Remove base64 data
                })
                hasChanges = true
              } catch (error) {
                console.error(`  ✗ Failed to upload ${attachment.name}:`, error)
                stats.filesFailed++
                updatedAttachments.push(attachment)
              }
            } else {
              console.log(`  [DRY RUN] Would upload ${attachment.name} (${buffer.length} bytes)`)
              stats.filesUploaded++
              stats.bytesUploaded += buffer.length
              updatedAttachments.push(attachment)
            }
          } else if (attachment.s3Key) {
            // Already migrated
            console.log(`  - ${attachment.name} already in S3`)
            updatedAttachments.push(attachment)
          } else {
            // No data to migrate
            updatedAttachments.push(attachment)
          }
        }
      } else {
        // Handle object-style attachments (documentType as key)
        for (const [docType, attachment] of Object.entries(attachments)) {
          if (!attachment || typeof attachment !== 'object') continue
          const attachmentData = attachment as any

          if (attachmentData.data && attachmentData.data.startsWith('data:')) {
            // Extract base64 data
            const matches = attachmentData.data.match(/^data:(.+);base64,(.+)$/)
            if (!matches) {
              console.error(`  - Failed to parse base64 for ${docType}`)
              stats.filesFailed++
              updatedAttachments[docType] = attachmentData
              continue
            }

            const mimeType = matches[1]
            const base64Data = matches[2]
            const buffer = Buffer.from(base64Data, 'base64')

            if (!dryRun) {
              try {
                // Generate S3 key
                const s3Key = s3Service.generateKey(
                  {
                    type: 'transaction',
                    transactionId: transaction.id,
                    documentType: docType,
                  },
                  attachmentData.fileName || `${docType}.pdf`
                )

                // Upload to S3
                const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
                  contentType: mimeType,
                  metadata: {
                    transactionId: transaction.id,
                    documentType: docType,
                    originalName: attachmentData.fileName || `${docType}.pdf`,
                    migratedAt: new Date().toISOString(),
                  },
                })

                console.log(`  ✓ Uploaded ${docType} to S3: ${s3Key}`)
                stats.filesUploaded++
                stats.bytesUploaded += buffer.length

                // Update attachment record
                updatedAttachments[docType] = {
                  ...attachmentData,
                  s3Key: uploadResult.key,
                  s3Url: uploadResult.url,
                  size: uploadResult.size,
                  data: undefined, // Remove base64 data
                }
                hasChanges = true
              } catch (error) {
                console.error(`  ✗ Failed to upload ${docType}:`, error)
                stats.filesFailed++
                updatedAttachments[docType] = attachmentData
              }
            } else {
              console.log(`  [DRY RUN] Would upload ${docType} (${buffer.length} bytes)`)
              stats.filesUploaded++
              stats.bytesUploaded += buffer.length
              updatedAttachments[docType] = attachmentData
            }
          } else if (attachmentData.s3Key) {
            // Already migrated
            console.log(`  - ${docType} already in S3`)
            updatedAttachments[docType] = attachmentData
          } else {
            // No data to migrate
            updatedAttachments[docType] = attachmentData
          }
        }
      }

      // Update transaction if changes were made
      if (hasChanges && !dryRun) {
        await prisma.inventoryTransaction.update({
          where: { id: transaction.id },
          data: {
            attachments: updatedAttachments,
          },
        })
        console.log(`  ✓ Updated transaction record`)
      }
    }

    return stats
  } catch (error) {
    console.error('Migration error:', error)
    throw error
  }
}

async function migrateLocalFiles(uploadsDir: string, dryRun = false): Promise<number> {
  console.log('\nChecking for local files in uploads directory...')
  
  try {
    await fs.access(uploadsDir)
  } catch {
    console.log('No uploads directory found')
    return 0
  }

  let fileCount = 0
  const files = await fs.readdir(uploadsDir, { withFileTypes: true })

  for (const file of files) {
    if (file.isFile()) {
      const filePath = path.join(uploadsDir, file.name)
      const stats = await fs.stat(filePath)
      
      console.log(`Found local file: ${file.name} (${stats.size} bytes)`)
      
      if (!dryRun) {
        // TODO: Implement logic to determine which transaction this file belongs to
        // and upload it to the appropriate S3 location
        console.log(`  [SKIPPED] Need to implement transaction matching logic`)
      } else {
        console.log(`  [DRY RUN] Would need to determine transaction and upload`)
      }
      
      fileCount++
    }
  }

  return fileCount
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  console.log('='.repeat(60))
  console.log('File Migration to S3')
  console.log('='.repeat(60))
  
  if (!process.env.S3_BUCKET_NAME) {
    console.error('ERROR: S3_BUCKET_NAME environment variable is not set')
    console.error('Please configure your S3 settings in .env.local')
    process.exit(1)
  }

  try {
    // Migrate transaction attachments
    const stats = await migrateTransactionAttachments(dryRun)
    
    // Check for local files
    const localFileCount = await migrateLocalFiles('./uploads', dryRun)
    
    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total transactions processed: ${stats.totalTransactions}`)
    console.log(`Transactions with attachments: ${stats.transactionsWithAttachments}`)
    console.log(`Files uploaded to S3: ${stats.filesUploaded}`)
    console.log(`Files failed: ${stats.filesFailed}`)
    console.log(`Total data uploaded: ${(stats.bytesUploaded / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Local files found: ${localFileCount}`)
    
    if (dryRun) {
      console.log('\nThis was a DRY RUN. No files were actually uploaded.')
      console.log('Run without --dry-run to perform the actual migration.')
    }
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
main().catch(console.error)