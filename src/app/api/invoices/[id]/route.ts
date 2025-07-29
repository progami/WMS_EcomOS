import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAccessInvoice } from '@/lib/auth-utils'
import { Money } from '@/lib/financial-utils'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

// GET /api/invoices/[id] - Get invoice details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            contactEmail: true,
            contactPhone: true
          }
        },
        lineItems: {
          orderBy: { createdAt: 'asc' }
        },
        reconciliations: {
          include: {
            resolvedBy: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Check warehouse access
    if (!canAccessInvoice(session, invoice)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    // Calculate summary statistics using Money class for precision
    const totalExpected = Money.sum(invoice.reconciliations.map(r => r.expectedAmount));
    const totalInvoiced = Money.sum(invoice.reconciliations.map(r => r.invoicedAmount));
    const totalDifference = Money.sum(invoice.reconciliations.map(r => r.difference));

    const summary = {
      totalLineItems: invoice.lineItems.length,
      totalReconciliations: invoice.reconciliations.length,
      matchedItems: invoice.reconciliations.filter(r => r.status === 'match').length,
      overbilledItems: invoice.reconciliations.filter(r => r.status === 'overbilled').length,
      underbilledItems: invoice.reconciliations.filter(r => r.status === 'underbilled').length,
      totalExpected: totalExpected.toString(),
      totalInvoiced: totalInvoiced.toString(),
      totalDifference: totalDifference.toString(),
      // Keep numeric versions for backward compatibility
      totalExpectedNum: totalExpected.toNumber(),
      totalInvoicedNum: totalInvoiced.toNumber(),
      totalDifferenceNum: totalDifference.toNumber()
    }

    return NextResponse.json({
      invoice,
      summary
    })
  } catch (error) {
    // console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

// PUT /api/invoices/[id] - Update invoice
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    
    // Extract version for optimistic locking
    const clientVersion = body.version || body.updatedAt
    delete body.version // Remove from update data
    delete body.updatedAt // Remove from update data
    
    // Validate that invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: id }
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Check warehouse access
    if (!canAccessInvoice(session, existingInvoice)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    // Don't allow editing paid invoices
    if (existingInvoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot edit paid invoices' },
        { status: 400 }
      )
    }

    // Implement optimistic locking
    if (clientVersion) {
      const clientDate = new Date(clientVersion)
      const serverDate = new Date(existingInvoice.updatedAt)
      
      // Compare timestamps (allow 1 second tolerance for date parsing)
      if (Math.abs(clientDate.getTime() - serverDate.getTime()) > 1000) {
        return NextResponse.json({
          error: 'Invoice has been modified by another user',
          conflict: true,
          currentVersion: existingInvoice.updatedAt,
          yourVersion: clientVersion,
          hint: 'Please refresh and try again'
        }, { status: 409 })
      }
    }

    // Update invoice with optimistic locking
    try {
      const updatedInvoice = await prisma.invoice.update({
        where: { 
          id: id,
          // Add version check in the WHERE clause for atomic operation
          ...(clientVersion ? {
            updatedAt: new Date(clientVersion)
          } : {})
        },
        data: {
          status: body.status,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          updatedAt: new Date()
        },
      include: {
        warehouse: true,
        lineItems: true,
        reconciliations: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    // Log the update
    await prisma.auditLog.create({
      data: {
        tableName: 'invoices',
        recordId: id,
        action: 'UPDATE',
        changes: {
          before: {
            status: existingInvoice.status,
            dueDate: existingInvoice.dueDate
          },
          after: {
            status: updatedInvoice.status,
            dueDate: updatedInvoice.dueDate
          }
        },
        userId: session.user.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent')
      }
    })

      return NextResponse.json(updatedInvoice)
    } catch (updateError: any) {
      // Check if it's a record not found error (version mismatch)
      if (updateError.code === 'P2025') {
        return NextResponse.json({
          error: 'Invoice has been modified by another user',
          conflict: true,
          currentVersion: new Date().toISOString(),
          hint: 'Please refresh and try again'
        }, { status: 409 })
      }
      throw updateError
    }
  } catch (error) {
    // console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if invoice exists and can be deleted
    const invoice = await prisma.invoice.findUnique({
      where: { id: id }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Check warehouse access
    if (!canAccessInvoice(session, invoice)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      )
    }

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot delete paid invoices' },
        { status: 400 }
      )
    }

    // Delete invoice (cascade will handle line items and reconciliations)
    await prisma.invoice.delete({
      where: { id: id }
    })

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        tableName: 'invoices',
        recordId: id,
        action: 'DELETE',
        changes: {
          deletedInvoice: {
            invoiceNumber: invoice.invoiceNumber,
            warehouseId: invoice.warehouseId,
            totalAmount: invoice.totalAmount,
            status: invoice.status
          }
        },
        userId: session.user.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent')
      }
    })

    return NextResponse.json({ 
      message: 'Invoice deleted successfully',
      deletedInvoiceNumber: invoice.invoiceNumber 
    })
  } catch (error) {
    // console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}