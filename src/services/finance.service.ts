import { BaseService, ServiceContext } from './base.service'
import { 
  getBillingPeriod, 
  calculateAllCosts,
  calculateAllCostsForWarehouses
} from '@/lib/calculations/cost-aggregation'
import { businessLogger, perfLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

export interface FinanceDashboardFilters {
  warehouseId?: string
  billingPeriod?: Date
}

export interface CostCalculationParams {
  warehouseId?: string
  startDate: Date
  endDate: Date
}

export class FinanceService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * Get finance dashboard data
   */
  async getFinanceDashboard(filters?: FinanceDashboardFilters) {
    const startTime = Date.now()
    
    try {
      await this.requirePermission('finance:read')

      // Get current billing period
      const currentBillingPeriod = getBillingPeriod(filters?.billingPeriod || new Date())
      
      // Get previous billing period for comparison
      const prevDate = new Date(filters?.billingPeriod || new Date())
      prevDate.setMonth(prevDate.getMonth() - 1)
      const previousBillingPeriod = getBillingPeriod(prevDate)

      // Get warehouses based on filter
      const warehouseWhere: Prisma.WarehouseWhereInput = { isActive: true }
      if (filters?.warehouseId) {
        warehouseWhere.id = filters.warehouseId
      }

      const warehouses = await this.prisma.warehouse.findMany({
        where: warehouseWhere
      })

      // Calculate current and previous period costs
      const warehouseIds = warehouses.map(w => w.id)
      
      const [currentCostsMap, previousCostsMap] = await Promise.all([
        calculateAllCostsForWarehouses(warehouseIds, currentBillingPeriod),
        calculateAllCostsForWarehouses(warehouseIds, previousBillingPeriod)
      ])
      
      // Process costs
      let currentTotalRevenue = 0
      const currentCostsByCategory = new Map<string, number>()
      
      for (const [warehouseId, costs] of currentCostsMap) {
        for (const cost of costs) {
          currentTotalRevenue += cost.amount
          const categoryKey = cost.costCategory
          currentCostsByCategory.set(
            categoryKey, 
            (currentCostsByCategory.get(categoryKey) || 0) + cost.amount
          )
        }
      }

      // Calculate previous period total revenue
      let previousTotalRevenue = 0
      for (const [warehouseId, costs] of previousCostsMap) {
        for (const cost of costs) {
          previousTotalRevenue += cost.amount
        }
      }

      const revenueChange = previousTotalRevenue > 0 
        ? ((currentTotalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100 
        : 0

      // Get invoice statistics
      const invoiceStats = await this.getInvoiceStats(currentBillingPeriod, filters?.warehouseId)
      
      // Get recent activity
      const recentActivity = await this.getRecentFinancialActivity()
      
      // Get reconciliation stats
      const reconStats = await this.getReconciliationStats(currentBillingPeriod, filters?.warehouseId)

      const duration = Date.now() - startTime
      perfLogger.log('Finance dashboard generated', {
        duration,
        warehouseCount: warehouses.length,
        currentRevenue: currentTotalRevenue
      })

      return {
        kpis: {
          totalRevenue: currentTotalRevenue.toFixed(2),
          revenueChange: revenueChange.toFixed(1),
          outstandingAmount: invoiceStats.outstanding.amount.toFixed(2),
          outstandingCount: invoiceStats.outstanding.count,
          costVariance: invoiceStats.variance.toFixed(1),
          costSavings: Math.abs(invoiceStats.totalInvoiced - currentTotalRevenue).toFixed(2),
          collectionRate: invoiceStats.collectionRate.toFixed(1)
        },
        costBreakdown: Array.from(currentCostsByCategory.entries()).map(([category, amount]) => ({
          category,
          amount
        })),
        invoiceStatus: invoiceStats.status,
        reconciliationStats: reconStats,
        recentActivity,
        billingPeriod: {
          start: currentBillingPeriod.start,
          end: currentBillingPeriod.end
        }
      }
    } catch (error) {
      this.handleError(error, 'getFinanceDashboard')
    }
  }

  /**
   * Calculate costs for a period
   */
  async calculateCosts(params: CostCalculationParams) {
    try {
      await this.requirePermission('finance:calculate')

      const startTime = Date.now()

      // Get warehouses
      const warehouseWhere: Prisma.WarehouseWhereInput = { isActive: true }
      if (params.warehouseId) {
        warehouseWhere.id = params.warehouseId
      }

      const warehouses = await this.prisma.warehouse.findMany({
        where: warehouseWhere
      })

      if (warehouses.length === 0) {
        throw new Error('No warehouses found')
      }

      // Calculate costs for each warehouse
      const results = await this.executeInTransaction(async (tx) => {
        const costResults = []

        for (const warehouse of warehouses) {
          const costs = await calculateAllCosts(
            warehouse.id,
            { start: params.startDate, end: params.endDate }
          )

          // Store calculated costs
          for (const cost of costs) {
            const calculatedCost = await tx.calculated_costs.create({
              data: {
                warehouseId: warehouse.id,
                billing_period_start: params.startDate,
                billing_period_end: params.endDate,
                cost_category: cost.costCategory,
                cost_name: cost.costName,
                quantity: cost.quantity,
                unit_rate: cost.unitRate,
                amount: cost.amount,
                calculated_by: this.session?.user?.id || 'system'
              }
            })
            costResults.push(calculatedCost)
          }
        }

        await this.logAudit('COSTS_CALCULATED', 'CalculatedCost', 'batch', {
          warehouseCount: warehouses.length,
          costCount: costResults.length,
          period: {
            start: params.startDate,
            end: params.endDate
          }
        })

        return costResults
      })

      const duration = Date.now() - startTime
      businessLogger.info('Costs calculated successfully', {
        warehouseCount: warehouses.length,
        costCount: results.length,
        duration
      })

      return {
        message: 'Costs calculated successfully',
        results: {
          warehouseCount: warehouses.length,
          costCount: results.length,
          total_amount: results.reduce((sum, cost) => sum + Number(cost.amount), 0)
        }
      }
    } catch (error) {
      this.handleError(error, 'calculateCosts')
    }
  }

  /**
   * Get storage ledger data
   */
  async getStorageLedger(filters: {
    warehouseId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  }) {
    try {
      await this.requirePermission('finance:read')

      const { page, limit } = this.getPaginationParams(filters)
      const skip = (page - 1) * limit

      const where: Prisma.StorageLedgerWhereInput = {}
      
      if (filters.warehouseId) {
        where.warehouseId = filters.warehouseId
      }
      
      if (filters.startDate || filters.endDate) {
        where.week_ending_date = {}
        if (filters.startDate) where.week_ending_date.gte = filters.startDate
        if (filters.endDate) where.week_ending_date.lte = filters.endDate
      }

      const [total, ledgerEntries] = await Promise.all([
        this.prisma.storageLedger.count({ where }),
        this.prisma.storageLedger.findMany({
          where,
          skip,
          take: limit,
          include: {
            warehouse: true,
            sku: true
          },
          orderBy: [
            { week_ending_date: 'desc' },
            { warehouse: { name: 'asc' } },
            { sku: { sku_code: 'asc' } }
          ]
        })
      ])

      return this.createPaginatedResponse(ledgerEntries, total, { page, limit })
    } catch (error) {
      this.handleError(error, 'getStorageLedger')
    }
  }

  /**
   * Get cost ledger data
   */
  async getCostLedger(filters: {
    warehouseId?: string
    startDate?: Date
    endDate?: Date
    category?: string
    page?: number
    limit?: number
  }) {
    try {
      await this.requirePermission('finance:read')

      const { page, limit } = this.getPaginationParams(filters)
      const skip = (page - 1) * limit

      const where: Prisma.CalculatedCostWhereInput = {}
      
      if (filters.warehouseId) {
        where.warehouseId = filters.warehouseId
      }
      
      if (filters.category) {
        where.cost_category = filters.category
      }
      
      if (filters.startDate || filters.endDate) {
        where.billing_period_start = {}
        if (filters.startDate) where.billing_period_start.gte = filters.startDate
        if (filters.endDate) where.billing_period_start.lte = filters.endDate
      }

      const [total, costEntries] = await Promise.all([
        this.prisma.calculatedCost.count({ where }),
        this.prisma.calculatedCost.findMany({
          where,
          skip,
          take: limit,
          include: {
            warehouse: true
          },
          orderBy: [
            { billing_period_start: 'desc' },
            { warehouse: { name: 'asc' } },
            { cost_category: 'asc' }
          ]
        })
      ])

      return this.createPaginatedResponse(costEntries, total, { page, limit })
    } catch (error) {
      this.handleError(error, 'getCostLedger')
    }
  }

  /**
   * Private helper methods
   */
  private async getInvoiceStats(billingPeriod: { start: Date; end: Date }, warehouseId?: string) {
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      billing_period_start: {
        gte: billingPeriod.start,
        lte: billingPeriod.end
      }
    }
    
    if (warehouseId) {
      invoiceWhere.warehouseId = warehouseId
    }

    const invoiceStats = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: invoiceWhere,
      _count: true,
      _sum: {
        total_amount: true
      }
    })

    const paidInvoices = invoiceStats.find(s => s.status === 'paid') || { _count: 0, _sum: { total_amount: 0 } }
    const pendingInvoices = invoiceStats.find(s => s.status === 'pending') || { _count: 0, _sum: { total_amount: 0 } }
    const disputedInvoices = invoiceStats.find(s => s.status === 'disputed') || { _count: 0, _sum: { total_amount: 0 } }
    
    // Get overdue invoices
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        ...invoiceWhere,
        status: 'pending',
        due_date: {
          lt: new Date()
        }
      },
      select: {
        total_amount: true
      }
    })
    
    const overdueCount = overdueInvoices.length
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)

    const totalInvoiced = Number(paidInvoices._sum.total_amount || 0) + 
                         Number(pendingInvoices._sum.total_amount || 0) +
                         Number(disputedInvoices._sum.total_amount || 0)
    
    const totalBilled = totalInvoiced + overdueAmount
    const collectionRate = totalBilled > 0 
      ? (Number(paidInvoices._sum.total_amount || 0) / totalBilled) * 100 
      : 0

    return {
      status: {
        paid: {
          count: paidInvoices._count,
          amount: Number(paidInvoices._sum.total_amount || 0)
        },
        pending: {
          count: pendingInvoices._count,
          amount: Number(pendingInvoices._sum.total_amount || 0)
        },
        overdue: {
          count: overdueCount,
          amount: overdueAmount
        },
        disputed: {
          count: disputedInvoices._count,
          amount: Number(disputedInvoices._sum.total_amount || 0)
        }
      },
      outstanding: {
        count: pendingInvoices._count + overdueCount,
        amount: Number(pendingInvoices._sum.total_amount || 0) + overdueAmount
      },
      totalInvoiced,
      collectionRate,
      variance: 0 // Will be calculated against actual costs
    }
  }

  private async getRecentFinancialActivity() {
    // Get recent invoices
    const recentInvoices = await this.prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoice_number: true,
        status: true,
        total_amount: true,
        created_at: true,
        warehouse: {
          select: {
            name: true
          }
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    // Get recent disputes
    const recentDisputes = await this.prisma.invoice_disputes.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          include: {
            warehouse: true
          }
        }
      }
    })

    // Combine and sort activities
    const activities = [
      ...recentInvoices.map(invoice => ({
        id: invoice.id,
        type: 'invoice' as const,
        title: `Invoice #${invoice.invoice_number} ${
          invoice.status === 'paid' ? 'paid' : 
          invoice.status === 'disputed' ? 'disputed' : 
          'processed'
        }`,
        amount: Number(invoice.total_amount),
        time: invoice.created_at,
        status: invoice.status === 'paid' ? 'success' : 
                invoice.status === 'disputed' ? 'warning' : 'info',
        warehouse: invoice.warehouse.name
      })),
      ...recentDisputes.map(dispute => ({
        id: dispute.id,
        type: 'dispute' as const,
        title: `Dispute raised for Invoice #${dispute.invoice.invoice_number}`,
        amount: Number(dispute.disputed_amount),
        time: dispute.created_at,
        status: 'warning' as const,
        warehouse: dispute.invoice.warehouse.name
      }))
    ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5)

    return activities
  }

  private async getReconciliationStats(billingPeriod: { start: Date; end: Date }, warehouseId?: string) {
    const reconWhere: Prisma.InvoiceReconciliationWhereInput = {
      invoice: {
        billing_period_start: {
          gte: billingPeriod.start,
          lte: billingPeriod.end
        }
      }
    }
    
    if (warehouseId) {
      reconWhere.invoice = {
        ...reconWhere.invoice,
        warehouseId: warehouseId
      }
    }

    const reconStats = await this.prisma.invoiceReconciliation.groupBy({
      by: ['status'],
      where: reconWhere,
      _count: true
    })

    const matchedItems = reconStats.find(s => s.status === 'match')?._count || 0
    const overbilledItems = reconStats.find(s => s.status === 'overbilled')?._count || 0
    const underbilledItems = reconStats.find(s => s.status === 'underbilled')?._count || 0

    return {
      matched: matchedItems,
      overbilled: overbilledItems,
      underbilled: underbilledItems,
      total: matchedItems + overbilledItems + underbilledItems
    }
  }
}