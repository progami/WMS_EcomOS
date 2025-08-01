import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getS3Service } from '@/services/s3.service'

export const dynamic = 'force-dynamic'

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

    const body = await request.json()
    const { documentCategory } = body

    if (!documentCategory) {
      return NextResponse.json({ error: 'Document category is required' }, { status: 400 })
    }

    // Get the transaction to find existing attachments
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: { attachments: true }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const s3Service = getS3Service()
    let deletedCount = 0

    // Find and delete old S3 files for this document category
    if (transaction.attachments && Array.isArray(transaction.attachments)) {
      const attachments = transaction.attachments as any[]
      
      // Find the attachment for this category
      const existingAttachment = attachments.find(
        (att: any) => att.category === documentCategory || 
                      att.category === documentCategory.replace(/([A-Z])/g, '_$1').toLowerCase()
      )

      if (existingAttachment?.s3Key) {
        try {
          await s3Service.deleteFile(existingAttachment.s3Key)
          deletedCount++
          console.log(`Deleted old S3 file: ${existingAttachment.s3Key}`)
        } catch (error) {
          console.error(`Failed to delete S3 file: ${existingAttachment.s3Key}`, error)
          // Continue even if delete fails - we don't want to block new uploads
        }
      }
    }

    // Also check S3 directly for any orphaned files
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const s3Prefix = `transactions/${year}/${month}/${id}/${documentCategory}_`
    try {
      const files = await s3Service.listFiles(s3Prefix)
      
      for (const fileKey of files) {
        try {
          await s3Service.deleteFile(fileKey)
          deletedCount++
          console.log(`Deleted orphaned S3 file: ${fileKey}`)
        } catch (error) {
          console.error(`Failed to delete orphaned S3 file: ${fileKey}`, error)
        }
      }
    } catch (error) {
      console.error('Failed to list S3 files for cleanup:', error)
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: `Cleaned up ${deletedCount} old file(s) for ${documentCategory}`
    })
  } catch (error) {
    console.error('Document cleanup error:', error)
    return NextResponse.json({ 
      error: 'Failed to cleanup old documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}