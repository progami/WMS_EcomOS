import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string

    if (!file || !documentType) {
      return NextResponse.json({ error: 'File and document type are required' }, { status: 400 })
    }

    // Get the transaction
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'transactions', id)
    await mkdir(uploadDir, { recursive: true })

    // Save the file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `${documentType}_${Date.now()}_${file.name}`
    const filePath = join(uploadDir, fileName)
    
    await writeFile(filePath, buffer)

    // Update transaction attachments
    const currentAttachments = (transaction.attachments as any) || {}
    const updatedAttachments = {
      ...currentAttachments,
      [documentType]: {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user.id,
        filePath: fileName
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

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: {
        attachments: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      attachments: transaction.attachments || {}
    })
  } catch (error) {
    // console.error('Get attachments error:', error)
    return NextResponse.json({ 
      error: 'Failed to get attachments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}