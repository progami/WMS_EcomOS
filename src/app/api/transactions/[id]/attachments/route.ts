import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getS3Service } from '@/services/s3.service'
import { validateFile, scanFileContent } from '@/lib/security/file-upload'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for file uploads

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize S3 service
    const s3Service = getS3Service();
    
    // Check content type to handle both FormData and JSON
    const contentType = request.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      // Handle JSON with base64 attachments - migrate to S3
      const body = await request.json()
      const { attachments } = body
      
      if (!attachments || !Array.isArray(attachments)) {
        return NextResponse.json({ error: 'Attachments array is required' }, { status: 400 })
      }
      
      // Get the transaction
      const transaction = await prisma.inventoryTransaction.findUnique({
        where: { id }
      })

      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }
      
      // Upload base64 attachments to S3
      const uploadedAttachments: any[] = []
      
      for (const attachment of attachments) {
        try {
          if (attachment.data && attachment.data.startsWith('data:')) {
            // Extract base64 data
            const matches = attachment.data.match(/^data:(.+);base64,(.+)$/)
            if (!matches) continue
            
            const mimeType = matches[1]
            const base64Data = matches[2]
            const buffer = Buffer.from(base64Data, 'base64')
            
            // Validate file
            const validation = await validateFile(
              { name: attachment.name, size: buffer.length, type: mimeType },
              'transaction-attachment'
            )
            
            if (!validation.valid) {
              console.error(`File validation failed: ${validation.error}`)
              continue
            }
            
            // Scan file content
            const scanResult = await scanFileContent(buffer, mimeType)
            if (!scanResult.valid) {
              console.error(`File scan failed: ${scanResult.error}`)
              continue
            }
            
            // Generate S3 key
            const s3Key = s3Service.generateKey(
              { 
                type: 'transaction', 
                transactionId: id, 
                documentType: attachment.category || 'general' 
              },
              attachment.name
            )
            
            // Upload to S3
            const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
              contentType: mimeType,
              metadata: {
                transactionId: id,
                documentType: attachment.category || 'general',
                originalName: attachment.name,
                uploadedBy: session.user.id,
              },
            })
            
            // Get presigned URL for immediate access
            const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
              expiresIn: 3600, // 1 hour
            })
            
            uploadedAttachments.push({
              ...attachment,
              s3Key: uploadResult.key,
              s3Url: presignedUrl,
              size: uploadResult.size,
              uploadedAt: new Date().toISOString(),
              data: undefined, // Remove base64 data
            })
          } else {
            // Already has S3 key or no data
            uploadedAttachments.push(attachment)
          }
        } catch (error) {
          console.error('Failed to upload attachment:', error)
          uploadedAttachments.push(attachment) // Keep original if upload fails
        }
      }
      
      // Update transaction with S3 references
      await prisma.inventoryTransaction.update({
        where: { id },
        data: {
          attachments: uploadedAttachments
        }
      })
      
      return NextResponse.json({ 
        success: true,
        message: 'Attachments uploaded to S3 successfully',
        attachments: uploadedAttachments
      })
    } else {
      // Original FormData handling
      const formData = await request.formData()
      const file = formData.get('file') as File
      const documentType = formData.get('documentType') as string

      if (!file || !documentType) {
        return NextResponse.json({ error: 'File and document type are required' }, { status: 400 })
      }

      // Validate file
      const validation = await validateFile(file, 'transaction-attachment')
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
      
      // Get the transaction
      const transaction = await prisma.inventoryTransaction.findUnique({
        where: { id }
      })

      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }

      // Convert file to buffer and scan
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const scanResult = await scanFileContent(buffer, file.type)
      if (!scanResult.valid) {
        return NextResponse.json({ error: scanResult.error }, { status: 400 })
      }
      
      // Generate S3 key
      const s3Key = s3Service.generateKey(
        { 
          type: 'transaction', 
          transactionId: id, 
          documentType: documentType 
        },
        file.name
      )
      
      // Upload to S3
      const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
        contentType: file.type,
        metadata: {
          transactionId: id,
          documentType: documentType,
          originalName: file.name,
          uploadedBy: session.user.id,
        },
      })
      
      // Get presigned URL for immediate access
      const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
        expiresIn: 3600, // 1 hour
      })

      // Update transaction attachments
      const currentAttachments = (transaction.attachments as any) || {}
      const updatedAttachments = {
        ...currentAttachments,
        [documentType]: {
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: session.user.id,
          s3Key: uploadResult.key,
          s3Url: presignedUrl,
          size: uploadResult.size,
          contentType: uploadResult.contentType,
        }
      }

      await prisma.inventoryTransaction.update({
        where: { id },
        data: {
          attachments: updatedAttachments
        }
      })

      return NextResponse.json({ 
        success: true,
        message: 'Document uploaded successfully'
      })
    }
  } catch (error) {
    // console.error('Upload attachment error:', error)
    return NextResponse.json({ 
      error: 'Failed to upload attachment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const s3Service = getS3Service();
    const searchParams = request.nextUrl.searchParams
    const download = searchParams.get('download') === 'true'
    const s3Key = searchParams.get('key')

    // If specific file requested, return presigned URL
    if (s3Key) {
      const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
        expiresIn: 3600, // 1 hour
        responseContentDisposition: download 
          ? `attachment; filename="${s3Key.split('/').pop()}"` 
          : undefined
      })
      
      return NextResponse.json({ 
        url: presignedUrl,
        expiresIn: 3600
      })
    }

    // Otherwise, return all attachments with fresh presigned URLs
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: {
        attachments: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Generate fresh presigned URLs for all attachments
    const attachments = transaction.attachments as any
    const attachmentsWithUrls: any = {}

    if (attachments && typeof attachments === 'object') {
      // Handle object-style attachments (documentType as key)
      for (const [docType, attachment] of Object.entries(attachments)) {
        if (attachment && typeof attachment === 'object') {
          const attachmentData = attachment as any
          if (attachmentData.s3Key) {
            const presignedUrl = await s3Service.getPresignedUrl(attachmentData.s3Key, 'get', {
              expiresIn: 3600,
            })
            attachmentsWithUrls[docType] = {
              ...attachmentData,
              s3Url: presignedUrl
            }
          } else {
            attachmentsWithUrls[docType] = attachmentData
          }
        }
      }
    } else if (Array.isArray(attachments)) {
      // Handle array-style attachments
      const attachmentArray: any[] = []
      for (const attachment of attachments) {
        if (attachment.s3Key) {
          const presignedUrl = await s3Service.getPresignedUrl(attachment.s3Key, 'get', {
            expiresIn: 3600,
          })
          attachmentArray.push({
            ...attachment,
            s3Url: presignedUrl
          })
        } else {
          attachmentArray.push(attachment)
        }
      }
      return NextResponse.json({ 
        attachments: attachmentArray
      })
    }

    return NextResponse.json({ 
      attachments: attachmentsWithUrls
    })
  } catch (error) {
    console.error('Get attachments error:', error)
    return NextResponse.json({ 
      error: 'Failed to get attachments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}