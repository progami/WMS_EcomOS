import { BaseService, ServiceContext } from './base.service'
import { z } from 'zod'
import { 
  sanitizeForDisplay, 
  sanitizeSearchQuery, 
  escapeRegex 
} from '@/lib/security/input-sanitization'
import { businessLogger, perfLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

// Validation schemas
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

export interface InvoiceFilters {
  search?: string
  warehouseId?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export class InvoiceService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * List invoices with filtering and pagination
   */
  async listInvoices(filters: InvoiceFilters, pagination: PaginationParams) {
    const startTime = Date.now()
    
    try {
      await this.requirePermission('invoice:read')

      const { page, limit } = this.getPaginationParams(pagination)
      const skip = (page - 1) * limit

      // Get warehouse filter based on user role
      const warehouseFilter = this.getWarehouseFilter(filters.warehouseId)
      if (warehouseFilter === null) {
        throw new Error('No warehouse access')
      }

      // Build where clause
      const where: Prisma.InvoiceWhereInput = { ...warehouseFilter }
      
      if (filters.search) {
        const escapedSearch = escapeRegex(sanitizeSearchQuery(filters.search))
        const searchFloat = parseFloat(filters.search)
        where.OR = [
          { invoiceNumber: { contains: escapedSearch, mode: 'insensitive' } },
          { warehouse: { name: { contains: escapedSearch, mode: 'insensitive' } } }
        ]
        if (!isNaN(searchFloat)) {
          where.OR.push({ totalAmount: { equals: searchFloat } })
        }
      }

      if (filters.status) {
        // Handle comma-separated statuses
        if (filters.status.includes(',')) {
          where.status = { in: filters.status.split(',') as any }
        } else {
          where.status = filters.status as any
        }
      }

      if (filters.startDate || filters.endDate) {
        where.invoiceDate = {}
        if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate)
        if (filters.endDate) where.invoiceDate.lte = new Date(filters.endDate)
      }

      // Execute queries in parallel
      const [totalCount, invoices] = await Promise.all([
        this.prisma.invoice.count({ where }),
        this.prisma.invoice.findMany({
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
      ])

      const duration = Date.now() - startTime
      perfLogger.log('Invoices listed', {
        count: invoices.length,
        totalCount,
        duration,
        filters
      })

      return this.createPaginatedResponse(invoices, totalCount, { page, limit })
    } catch (error) {
      this.handleError(error, 'listInvoices')
    }
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: z.infer<typeof createInvoiceSchema>) {
    const startTime = Date.now()
    
    try {
      await this.requirePermission('invoice:create')
      
      const validatedData = createInvoiceSchema.parse(data)

      // Validate warehouse access
      const warehouseFilter = this.getWarehouseFilter(validatedData.warehouseId)
      if (warehouseFilter === null || 
          (warehouseFilter.warehouseId && warehouseFilter.warehouseId !== validatedData.warehouseId)) {
        throw new Error('Access denied to this warehouse')
      }

      // Execute in transaction
      const invoice = await this.executeInTransaction(async (tx) => {
        // Check for existing invoice with same number (idempotency)
        const existingInvoice = await tx.invoice.findUnique({
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
            businessLogger.info('Idempotent invoice creation', {
              invoiceNumber: existingInvoice.invoiceNumber,
              invoiceId: existingInvoice.id
            })
            return { invoice: existingInvoice, idempotent: true }
          } else {
            throw new Error('Invoice number already exists with different details')
          }
        }

        // Create new invoice
        const newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber: validatedData.invoiceNumber,
            warehouseId: validatedData.warehouseId,
            customerId: this.session!.user.id,
            billingPeriodStart: new Date(validatedData.billingPeriodStart),
            billingPeriodEnd: new Date(validatedData.billingPeriodEnd),
            invoiceDate: new Date(validatedData.invoiceDate),
            issueDate: new Date(),
            dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
            subtotal: validatedData.totalAmount,
            taxAmount: 0,
            totalAmount: validatedData.totalAmount,
            createdById: this.session!.user.id,
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

        // Log audit trail
        await this.logAudit('INVOICE_CREATED', 'Invoice', newInvoice.id, {
          invoiceNumber: newInvoice.invoiceNumber,
          warehouseId: newInvoice.warehouseId,
          totalAmount: newInvoice.totalAmount,
          lineItemCount: validatedData.lineItems.length
        })

        return { invoice: newInvoice, idempotent: false }
      })

      const duration = Date.now() - startTime
      businessLogger.info('Invoice created successfully', {
        invoiceId: invoice.invoice.id,
        invoiceNumber: invoice.invoice.invoiceNumber,
        warehouseId: invoice.invoice.warehouseId,
        totalAmount: invoice.invoice.totalAmount,
        duration,
        idempotent: invoice.idempotent
      })

      return invoice
    } catch (error) {
      this.handleError(error, 'createInvoice')
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId: string, data: z.infer<typeof updateInvoiceSchema>) {
    try {
      await this.requirePermission('invoice:update')
      
      const validatedData = updateInvoiceSchema.parse(data)

      const updatedInvoice = await this.executeInTransaction(async (tx) => {
        // Get current invoice
        const currentInvoice = await tx.invoice.findUnique({
          where: { id: invoiceId }
        })

        if (!currentInvoice) {
          throw new Error('Invoice not found')
        }

        // Update invoice
        const updated = await tx.invoice.update({
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

        // Log audit trail
        await this.logAudit('INVOICE_UPDATED', 'Invoice', invoiceId, {
          previousStatus: currentInvoice.status,
          newStatus: validatedData.status,
          changes: validatedData
        })

        return updated
      })

      businessLogger.info('Invoice updated successfully', {
        invoiceId,
        changes: validatedData
      })

      return updatedInvoice
    } catch (error) {
      this.handleError(error, 'updateInvoiceStatus')
    }
  }

  /**
   * Delete invoice (soft delete if has related data)
   */
  async deleteInvoice(invoiceId: string) {
    try {
      await this.requirePermission('invoice:delete')

      const result = await this.executeInTransaction(async (tx) => {
        // Check if invoice exists and can be deleted
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status === 'paid') {
          throw new Error('Cannot delete paid invoices')
        }

        // Delete invoice (cascade will handle line items)
        await tx.invoice.delete({
          where: { id: invoiceId }
        })

        // Log audit trail
        await this.logAudit('INVOICE_DELETED', 'Invoice', invoiceId, {
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status
        })

        return { invoiceNumber: invoice.invoiceNumber }
      })

      businessLogger.info('Invoice deleted successfully', {
        invoiceId,
        invoiceNumber: result.invoiceNumber
      })

      return { message: 'Invoice deleted successfully' }
    } catch (error) {
      this.handleError(error, 'deleteInvoice')
    }
  }

  /**
   * Accept invoice
   */
  async acceptInvoice(invoiceId: string) {
    try {
      await this.requirePermission('invoice:accept')

      const updatedInvoice = await this.executeInTransaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status !== 'pending') {
          throw new Error('Only pending invoices can be accepted')
        }

        const updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'paid',
            updatedAt: new Date()
          }
        })

        await this.logAudit('INVOICE_ACCEPTED', 'Invoice', invoiceId, {
          invoiceNumber: invoice.invoiceNumber,
          previousStatus: invoice.status
        })

        return updated
      })

      return updatedInvoice
    } catch (error) {
      this.handleError(error, 'acceptInvoice')
    }
  }

  /**
   * Dispute invoice
   */
  async disputeInvoice(invoiceId: string, reason: string, disputedAmount?: number) {
    try {
      await this.requirePermission('invoice:dispute')

      const result = await this.executeInTransaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status === 'paid') {
          throw new Error('Cannot dispute paid invoices')
        }

        // Update invoice status
        const updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'disputed',
            updatedAt: new Date()
          }
        })

        // Create dispute record
        const dispute = await tx.invoiceDispute.create({
          data: {
            invoiceId,
            reason: sanitizeForDisplay(reason),
            disputedAmount: disputedAmount || Number(invoice.totalAmount),
            disputedBy: this.session!.user.id
          }
        })

        await this.logAudit('INVOICE_DISPUTED', 'Invoice', invoiceId, {
          invoiceNumber: invoice.invoiceNumber,
          reason,
          disputedAmount: dispute.disputedAmount
        })

        return { invoice: updated, dispute }
      })

      return result
    } catch (error) {
      this.handleError(error, 'disputeInvoice')
    }
  }
}