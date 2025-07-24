import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWarehouseFilter } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { businessLogger, apiLogger, perfLogger } from '@/lib/logger'
import { sanitizeForDisplay, sanitizeSearchQuery, escapeRegex, validatePositiveInteger } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

// Validation schemas with sanitization
const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  warehouseId: z.string().uuid(),
  billingPeriodStart: z.string().datetime(),
  billingPeriodEnd: z.string().datetime(),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  totalAmount: z.number().positive(),
  lineItems: z.array(z.object({
    costCategory: z.enum(['Container', 'Carton', 'Pallet', 'Storage', 'Unit', 'Shipment', 'Accessorial']),
    costName: z.string().min(1).transform(val => sanitizeForDisplay(val)),
    quantity: z.number().positive(),
    unitRate: z.number().positive().optional(),
    amount: z.number().positive()
  }))
})

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'reconciled', 'disputed', 'paid']).optional(),
  dueDate: z.string().datetime().optional()
})

// GET /api/invoices - List invoices with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search') ? sanitizeSearchQuery(searchParams.get('search')!) : null
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const skip = (page - 1) * limit

    // Get warehouse filter based on user role
    const warehouseFilter = getWarehouseFilter(session, warehouseId || undefined)
    if (warehouseFilter === null) {
      return NextResponse.json({ error: 'No warehouse access' }, { status: 403 })
    }

    // Build where clause
    const where: any = { ...warehouseFilter }
    
    if (search) {
      const escapedSearch = escapeRegex(search)
      const searchFloat = parseFloat(search)
      where.OR = [
        { invoiceNumber: { contains: escapedSearch, mode: 'insensitive' } },
        { warehouse: { name: { contains: escapedSearch, mode: 'insensitive' } } }
      ]
      if (!isNaN(searchFloat)) {
        where.OR.push({ totalAmount: { equals: searchFloat } })
      }
    }

    if (status) {
      // Handle comma-separated statuses
      if (status.includes(',')) {
        where.status = { in: status.split(',') }
      } else {
        where.status = status
      }
    }

    if (startDate || endDate) {
      where.invoiceDate = {}
      if (startDate) where.invoiceDate.gte = new Date(startDate)
      if (endDate) where.invoiceDate.lte = new Date(endDate)
    }

    // Get total count for pagination
    const totalCount = await prisma.invoice.count({ where })

    // Get invoices with relations
    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        lineItems: true,
        reconciliations: {
          include: {
            resolvedBy: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
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

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    // console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

// POST /api/invoices - Create new invoice
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let session: any = null;
  
  try {
    session = await getServerSession(authOptions)
    if (!session) {
      apiLogger.warn('Unauthorized invoice creation attempt', {
        path: '/api/invoices',
        method: 'POST'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createInvoiceSchema.parse(body)

    // Validate warehouse access
    const warehouseFilter = getWarehouseFilter(session, validatedData.warehouseId)
    if (warehouseFilter === null || (warehouseFilter.warehouseId && warehouseFilter.warehouseId !== validatedData.warehouseId)) {
      return NextResponse.json(
        { error: 'Access denied to this warehouse' },
        { status: 403 }
      )
    }

    // Check for idempotency by looking for existing invoice with same number
    // This provides natural idempotency since invoice numbers must be unique
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: validatedData.invoiceNumber },
      include: {
        warehouse: true,
        lineItems: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    if (existingInvoice) {
      // Check if it's the same request (idempotent)
      const isSameRequest = 
        existingInvoice.warehouseId === validatedData.warehouseId &&
        Number(existingInvoice.totalAmount) === validatedData.totalAmount &&
        existingInvoice.lineItems.length === validatedData.lineItems.length

      if (isSameRequest) {
        // Return existing invoice (idempotent response)
        return NextResponse.json(
          { 
            invoice: existingInvoice,
            idempotent: true,
            message: 'Invoice already exists with this number'
          }, 
          { 
            status: 200,
            headers: {
              'X-Idempotent-Response': 'true'
            }
          }
        )
      } else {
        // Different request with same invoice number
        return NextResponse.json(
          { error: 'Invoice number already exists with different details' },
          { status: 409 }
        )
      }
    }

    // Create invoice with line items
    try {
      businessLogger.info('Creating new invoice', {
        invoiceNumber: validatedData.invoiceNumber,
        warehouseId: validatedData.warehouseId,
        totalAmount: validatedData.totalAmount,
        lineItemCount: validatedData.lineItems.length,
        userId: session.user.id,
        userRole: session.user.role
      });
      
      const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: validatedData.invoiceNumber,
        warehouseId: validatedData.warehouseId,
        customerId: session.user.id, // Using the creator as customer for now
        billingPeriodStart: new Date(validatedData.billingPeriodStart),
        billingPeriodEnd: new Date(validatedData.billingPeriodEnd),
        invoiceDate: new Date(validatedData.invoiceDate),
        issueDate: new Date(), // Setting issue date to now
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        subtotal: validatedData.totalAmount, // Setting subtotal same as total for now
        taxAmount: 0, // Setting tax to 0 for now
        totalAmount: validatedData.totalAmount,
        createdById: session.user.id,
        lineItems: {
          create: validatedData.lineItems.map(item => ({
            costCategory: item.costCategory,
            costName: item.costName,
            quantity: item.quantity,
            unitRate: item.unitRate,
            amount: item.amount
          }))
        }
      },
      include: {
        warehouse: true,
        lineItems: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    const duration = Date.now() - startTime;
    businessLogger.info('Invoice created successfully', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      warehouseId: invoice.warehouseId,
      totalAmount: invoice.totalAmount,
      duration,
      userId: session.user.id
    });
    
    perfLogger.log('Invoice creation completed', {
      duration,
      invoiceId: invoice.id,
      lineItemCount: validatedData.lineItems.length
    });
    
    return NextResponse.json(invoice, { status: 201 })
    } catch (prismaError: any) {
      // Handle other database errors
      businessLogger.error('Failed to create invoice - database error', {
        error: prismaError.message,
        code: prismaError.code,
        invoiceNumber: validatedData.invoiceNumber,
        userId: session.user.id
      });
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    businessLogger.error('Failed to create invoice', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: session?.user?.id,
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// PATCH /api/invoices - Update invoice status
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const invoiceId = searchParams.get('id')
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updateInvoiceSchema.parse(body)

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: validatedData.status,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        updatedAt: new Date()
      },
      include: {
        warehouse: true,
        lineItems: true,
        reconciliations: true
      }
    })

    return NextResponse.json(updatedInvoice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/invoices - Delete invoice
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const invoiceId = searchParams.get('id')
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Check if invoice can be deleted (not paid)
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status === 'paid') {
      businessLogger.warn('Attempted to delete paid invoice', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        userId: session.user.id
      });
      return NextResponse.json(
        { error: 'Cannot delete paid invoices' },
        { status: 400 }
      )
    }

    // Delete invoice (cascade will handle line items)
    await prisma.invoice.delete({
      where: { id: invoiceId }
    })

    businessLogger.info('Invoice deleted successfully', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      userId: session.user.id,
      userRole: session.user.role
    });

    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    // console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}