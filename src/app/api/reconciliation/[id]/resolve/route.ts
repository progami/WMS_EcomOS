import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

// POST /api/reconciliation/[id]/resolve - Add resolution notes to a reconciliation item
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { resolutionNotes } = body

    if (!resolutionNotes || resolutionNotes.trim() === '') {
      return NextResponse.json(
        { error: 'Resolution notes are required' },
        { status: 400 }
      )
    }

    // Check if reconciliation item exists
    const reconciliationItem = await prisma.invoiceReconciliation.findUnique({
      where: { id: params.id }
    })

    if (!reconciliationItem) {
      return NextResponse.json(
        { error: 'Reconciliation item not found' },
        { status: 404 }
      )
    }

    // Update reconciliation item with resolution notes
    const updatedItem = await prisma.invoiceReconciliation.update({
      where: { id: params.id },
      data: {
        resolutionNotes,
        resolvedById: session.user.id,
        resolvedAt: new Date()
      },
      include: {
        invoice: {
          include: {
            warehouse: true
          }
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    // Log the resolution
    await prisma.auditLog.create({
      data: {
        tableName: 'invoice_reconciliations',
        recordId: params.id,
        action: 'UPDATE',
        changes: {
          resolutionNotes,
          resolvedBy: session.user.email,
          resolvedAt: new Date().toISOString()
        },
        userId: session.user.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      message: 'Resolution notes added successfully',
      reconciliationItem: updatedItem
    })
  } catch (error) {
    // console.error('Error resolving reconciliation item:', error)
    return NextResponse.json(
      { error: 'Failed to add resolution notes' },
      { status: 500 }
    )
  }
}