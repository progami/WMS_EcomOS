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
  invoice_number: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  warehouseId: z.string().uuid(),
  billing_period_start: z.string().datetime(),
  billing_period_end: z.string().datetime(),
  invoice_date: z.string().datetime(),
  due_date: z.string().datetime().optional(),
  total_amount: z.number().positive(),
  line_items: z.array(z.object({
    cost_category: z.enum(['Container', 'Carton', 'Pallet', 'Storage', 'Unit', 'Shipment', 'Accessorial']),
    cost_name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
    quantity: z.number().positive(),
    unit_rate: z.number().positive().optional(),
    amount: z.number().positive()
  }))
})

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'reconciled', 'disputed', 'paid']).optional(),
  due_date: z.string().datetime().optional()
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
          { invoice_number: { contains: escapedSearch, mode: 'insensitive' } },
          { warehouses: { name: { contains: escapedSearch, mode: 'insensitive' } } }
        ]
        if (!isNaN(searchFloat)) {
          where.OR.push({ total_amount: { equals: searchFloat } })
        }
      }

      if (filters.status) {
        // Handle comma-separated statuses
        if (filters.status.includes(',')) {
          where.status = { in: filters.status.split(',') }
        } else {
          where.status = filters.status
        }
      }

      if (filters.startDate || filters.endDate) {
        where.invoice_date = {}
        if (filters.startDate) where.invoice_date.gte = new Date(filters.startDate)
        if (filters.endDate) where.invoice_date.lte = new Date(filters.endDate)
      }

      // Execute queries in parallel
      const [totalCount, invoices] = await Promise.all([
        this.prisma.invoice.count({ where }),
        this.prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            warehouses: {
              select: {
                id: true,
                code: true,
                name: true
              }
            },
            line_items: true,
            reconciliations: {
              include: {
                resolvedBy: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true
                  }
                }
              }
            },
            users_invoices_created_byTousers: {
              select: {
                id: true,
                full_name: true,
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
        const existingInvoice = await tx.invoices.findUnique({
          where: { invoice_number: validatedData.invoice_number },
          include: {
            warehouses: true,
            line_items: true,
            users_invoices_created_byTousers: {
              select: {
                id: true,
                full_name: true,
                email: true
              }
            }
          }
        })

        if (existingInvoice) {
          // Check if it's the same request (idempotent)
          const isSameRequest = 
            existingInvoice.warehouseId === validatedData.warehouseId &&
            Number(existingInvoice.total_amount) === validatedData.total_amount &&
            existingInvoice.line_items.length === validatedData.line_items.length

          if (isSameRequest) {
            businessLogger.info('Idempotent invoice creation', {
              invoice_number: existingInvoice.invoice_number,
              invoiceId: existingInvoice.id
            })
            return { invoice: existingInvoice, idempotent: true }
          } else {
            throw new Error('Invoice number already exists with different details')
          }
        }

        // Create new invoice
        const newInvoice = await tx.invoices.create({
          data: {
            invoice_number: validatedData.invoice_number,
            warehouseId: validatedData.warehouseId,
            customer_id: this.session!.user.id,
            billing_period_start: new Date(validatedData.billing_period_start),
            billing_period_end: new Date(validatedData.billing_period_end),
            invoice_date: new Date(validatedData.invoice_date),
            issue_date: new Date(),
            due_date: validatedData.due_date ? new Date(validatedData.due_date) : null,
            subtotal: validatedData.total_amount,
            tax_amount: 0,
            total_amount: validatedData.total_amount,
            created_by_id: this.session!.user.id,
            line_items: {
              create: validatedData.line_items.map(item => ({
                cost_category: item.cost_category,
                cost_name: item.cost_name,
                quantity: item.quantity,
                unit_rate: item.unit_rate,
                amount: item.amount
              }))
            }
          },
          include: {
            warehouses: true,
            line_items: true,
            users_invoices_created_byTousers: {
              select: {
                id: true,
                full_name: true,
                email: true
              }
            }
          }
        })

        // Log audit trail
        await this.logAudit('INVOICE_CREATED', 'Invoice', newInvoice.id, {
          invoice_number: newInvoice.invoice_number,
          warehouseId: newInvoice.warehouseId,
          total_amount: newInvoice.total_amount,
          lineItemCount: validatedData.line_items.length
        })

        return { invoice: newInvoice, idempotent: false }
      })

      const duration = Date.now() - startTime
      businessLogger.info('Invoice created successfully', {
        invoiceId: invoice.invoice.id,
        invoice_number: invoice.invoice.invoice_number,
        warehouseId: invoice.invoice.warehouseId,
        total_amount: invoice.invoice.total_amount,
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
        const updated = await tx.invoices.update({
          where: { id: invoiceId },
          data: {
            status: validatedData.status,
            due_date: validatedData.due_date ? new Date(validatedData.due_date) : undefined,
            updated_at: new Date()
          },
          include: {
            warehouses: true,
            line_items: true,
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
        const invoice = await tx.invoices.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status === 'paid') {
          throw new Error('Cannot delete paid invoices')
        }

        // Delete invoice (cascade will handle line items)
        await tx.invoices.delete({
          where: { id: invoiceId }
        })

        // Log audit trail
        await this.logAudit('INVOICE_DELETED', 'Invoice', invoiceId, {
          invoice_number: invoice.invoice_number,
          status: invoice.status
        })

        return { invoice_number: invoice.invoice_number }
      })

      businessLogger.info('Invoice deleted successfully', {
        invoiceId,
        invoice_number: result.invoice_number
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
        const invoice = await tx.invoices.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status !== 'pending') {
          throw new Error('Only pending invoices can be accepted')
        }

        const updated = await tx.invoices.update({
          where: { id: invoiceId },
          data: {
            status: 'paid',
            updated_at: new Date()
          }
        })

        await this.logAudit('INVOICE_ACCEPTED', 'Invoice', invoiceId, {
          invoice_number: invoice.invoice_number,
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
        const invoice = await tx.invoices.findUnique({
          where: { id: invoiceId }
        })

        if (!invoice) {
          throw new Error('Invoice not found')
        }

        if (invoice.status === 'paid') {
          throw new Error('Cannot dispute paid invoices')
        }

        // Update invoice status
        const updated = await tx.invoices.update({
          where: { id: invoiceId },
          data: {
            status: 'disputed',
            updated_at: new Date()
          }
        })

        // Create dispute record
        const dispute = await tx.invoiceDispute.create({
          data: {
            invoiceId,
            reason: sanitizeForDisplay(reason),
            disputed_amount: disputedAmount || Number(invoice.total_amount),
            raised_by_id: this.session!.user.id
          }
        })

        await this.logAudit('INVOICE_DISPUTED', 'Invoice', invoiceId, {
          invoice_number: invoice.invoice_number,
          reason,
          disputed_amount: dispute.disputed_amount
        })

        return { invoice: updated, dispute }
      })

      return result
    } catch (error) {
      this.handleError(error, 'disputeInvoice')
    }
  }
}