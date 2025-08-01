import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getS3Service } from '@/services/s3.service'

export const dynamic = 'force-dynamic'

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

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        transactionDate: true,
        transactionType: true,
        batchLot: true,
        referenceId: true,
        cartonsIn: true,
        cartonsOut: true,
        storagePalletsIn: true,
        shippingPalletsOut: true,
        createdAt: true,
        shipName: true,
        trackingNumber: true,
        pickupDate: true,
        attachments: true,
        storageCartonsPerPallet: true,
        shippingCartonsPerPallet: true,
        unitsPerCarton: true,
        supplier: true,
        warehouse: {
          select: { id: true, name: true, code: true }
        },
        sku: {
          select: { id: true, skuCode: true, description: true, unitsPerCarton: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        }
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Process attachments to add presigned URLs
    let processedTransaction = { ...transaction }
    if (transaction.attachments && Array.isArray(transaction.attachments)) {
      const s3Service = getS3Service()
      const processedAttachments = await Promise.all(
        transaction.attachments.map(async (attachment: any) => {
          if (attachment.s3Key) {
            try {
              // Generate presigned URL for download
              const s3Url = await s3Service.getPresignedUrl(attachment.s3Key, 'get', {
                responseContentDisposition: `attachment; filename="${attachment.name}"`,
                expiresIn: 3600 // 1 hour
              })
              return { ...attachment, s3Url }
            } catch (error) {
              console.error('Failed to generate presigned URL:', error)
              return attachment
            }
          }
          return attachment
        })
      )
      processedTransaction.attachments = processedAttachments
    }

    return NextResponse.json(processedTransaction)
  } catch (error) {
    // console.error('Failed to fetch transaction:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch transaction' 
    }, { status: 500 })
  }
}