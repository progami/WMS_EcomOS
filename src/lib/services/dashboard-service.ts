import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { cacheService } from '@/lib/cache/cache-service'

interface DashboardMetrics {
  inventoryTrend: { date: string; inventory: number }[]
  costTrend: { date: string; cost: number }[]
  warehouseDistribution: { name: string; value: number; percentage: string }[]
  recentTransactions: { 
    id: string
    date: string
    type: string
    sku: string
    quantity: number
    warehouse?: string
    details?: string 
  }[]
}

interface DashboardStats {
  totalInventory: number
  inventoryChange: string
  inventoryTrend: 'up' | 'down' | 'neutral'
  storageCost: string
  costChange: string
  costTrend: 'up' | 'down' | 'neutral'
  activeSkus: number
  pendingInvoices: number
  overdueInvoices: number
}

interface SystemInfo {
  totalUsers: number
  totalTransactions: number
  dbSize: number
}

export class DashboardService {
  private cacheEnabled = process.env.DASHBOARD_CACHE_ENABLED === 'true'
  private cacheTTL = parseInt(process.env.DASHBOARD_CACHE_TTL || '300') // 5 minutes default

  async getMetrics(startDate: Date, endDate: Date) {
    // Check cache first if enabled
    const cacheKey = `dashboard:${startDate.toISOString()}:${endDate.toISOString()}`
    if (this.cacheEnabled) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    // Calculate comparison period
    const periodLength = endDate.getTime() - startDate.getTime()
    const compareStartDate = new Date(startDate.getTime() - periodLength)
    const compareEndDate = new Date(startDate.getTime())

    // Execute all independent queries in parallel
    const [
      inventoryStats,
      costStats,
      activeSkus,
      invoiceStats,
      systemInfo,
      inventoryTrend,
      warehouseDistribution,
      costTrend,
      recentTransactions
    ] = await Promise.all([
      this.getInventoryStats(compareStartDate, compareEndDate),
      this.getCostStats(startDate, endDate, compareStartDate, compareEndDate),
      this.getActiveSkusCount(),
      this.getInvoiceStats(),
      this.getSystemInfo(),
      this.getInventoryTrend(startDate, endDate),
      this.getWarehouseDistribution(),
      this.getCostTrend(startDate, endDate),
      this.getRecentTransactions(5)
    ])

    // Calculate derived values
    const stats: DashboardStats = {
      totalInventory: inventoryStats.current,
      inventoryChange: inventoryStats.changePercent.toFixed(1),
      inventoryTrend: inventoryStats.changePercent > 0 ? 'up' : inventoryStats.changePercent < 0 ? 'down' : 'neutral',
      storageCost: costStats.current.toFixed(2),
      costChange: costStats.changePercent.toFixed(1),
      costTrend: costStats.changePercent > 0 ? 'up' : costStats.changePercent < 0 ? 'down' : 'neutral',
      activeSkus,
      pendingInvoices: invoiceStats.pending,
      overdueInvoices: invoiceStats.overdue
    }

    const chartData: DashboardMetrics = {
      inventoryTrend,
      costTrend,
      warehouseDistribution,
      recentTransactions
    }

    const result = {
      stats,
      systemInfo,
      chartData,
      generatedAt: new Date()
    }

    // Cache the result if caching is enabled
    if (this.cacheEnabled) {
      await cacheService.set(cacheKey, result, this.cacheTTL)
    }

    return result
  }

  // Method to invalidate dashboard cache
  async invalidateCache() {
    await cacheService.invalidate('dashboard:*')
  }

  private async getInventoryStats(compareStartDate: Date, compareEndDate: Date) {
    const [currentInventory, previousPeriodTransactions] = await Promise.all([
      // Current total inventory
      prisma.inventory_balances.aggregate({
        _sum: { current_cartons: true }
      }),
      // Previous period transactions for comparison
      prisma.inventory_transactions.aggregate({
        where: {
          transaction_date: {
            gte: compareStartDate,
            lte: compareEndDate
          }
        },
        _sum: {
          cartons_in: true,
          cartons_out: true
        }
      })
    ])

    const current = currentInventory._sum.current_cartons || 0
    const previousPeriodInventory = (previousPeriodTransactions._sum.cartons_in || 0) - 
                                   (previousPeriodTransactions._sum.cartons_out || 0)
    
    const changePercent = previousPeriodInventory > 0 
      ? ((current - previousPeriodInventory) / previousPeriodInventory) * 100 
      : 0

    return { current, changePercent }
  }

  private async getCostStats(
    startDate: Date, 
    endDate: Date, 
    compareStartDate: Date, 
    compareEndDate: Date
  ) {
    const [currentPeriodCosts, previousPeriodCosts] = await Promise.all([
      // Current period costs
      prisma.calculated_costs.aggregate({
        where: {
          billing_period_start: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { final_expected_cost: true }
      }),
      // Previous period costs
      prisma.calculated_costs.aggregate({
        where: {
          billing_period_start: {
            gte: compareStartDate,
            lte: compareEndDate
          }
        },
        _sum: { final_expected_cost: true }
      })
    ])

    const current = Number(currentPeriodCosts._sum.final_expected_cost || 0)
    const previous = Number(previousPeriodCosts._sum.final_expected_cost || 0)
    const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0

    return { current, changePercent }
  }

  private async getActiveSkusCount() {
    const activeSkus = await prisma.inventory_balances.findMany({
      where: {
        current_cartons: { gt: 0 }
      },
      select: { sku_id: true },
      distinct: ['sku_id']
    })
    return activeSkus.length
  }

  private async getInvoiceStats() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [pending, overdue] = await Promise.all([
      // Total pending invoices
      prisma.invoices.count({
        where: { status: 'pending' }
      }),
      // Overdue invoices (pending and older than 30 days)
      prisma.invoices.count({
        where: {
          status: 'pending',
          invoice_date: { lt: thirtyDaysAgo }
        }
      })
    ])

    return { pending, overdue }
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const [totalUsers, totalTransactions, dbSizeResult] = await Promise.all([
      prisma.users.count(),
      prisma.inventory_transactions.count(),
      prisma.$queryRaw<{size: bigint}[]>`
        SELECT pg_database_size(current_database()) as size
      `.catch(() => [{ size: BigInt(0) }])
    ])

    return {
      totalUsers,
      totalTransactions,
      dbSize: Math.round(Number(dbSizeResult[0]?.size || 0) / 1024 / 1024) // Convert to MB
    }
  }

  private async getInventoryTrend(startDate: Date, endDate: Date) {
    // Get transactions for the period
    const transactions = await prisma.inventory_transactions.findMany({
      where: {
        transaction_date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { transaction_date: 'asc' }
    })

    if (transactions.length === 0) {
      // No transactions, return current level as flat line
      const currentInv = await prisma.inventory_balances.aggregate({
        _sum: { current_cartons: true }
      })
      const current = currentInv._sum.current_cartons || 0
      
      const days = Math.min(7, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      return Array.from({ length: days }, (_, i) => {
        const date = new Date(startDate)
        date.setDate(date.getDate() + Math.floor(i * ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / (days - 1)))
        return {
          date: format(date, 'MMM dd'),
          inventory: current
        }
      })
    }

    // Get inventory level at start of period
    const beforePeriod = await prisma.inventory_transactions.aggregate({
      where: {
        transaction_date: { lt: startDate }
      },
      _sum: {
        cartons_in: true,
        cartons_out: true
      }
    })
    
    let runningTotal = (beforePeriod._sum.cartons_in || 0) - (beforePeriod._sum.cartons_out || 0)
    
    // Group transactions by date
    const dailyChanges = new Map<string, number>()
    transactions.forEach(tx => {
      const dateKey = format(tx.transaction_date, 'yyyy-MM-dd')
      const change = tx.cartons_in - tx.cartons_out
      dailyChanges.set(dateKey, (dailyChanges.get(dateKey) || 0) + change)
    })
    
    // Build trend with running total
    return Array.from(dailyChanges.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, change]) => {
        runningTotal += change
        return {
          date: format(new Date(date), 'MMM dd'),
          inventory: runningTotal
        }
      })
  }

  private async getWarehouseDistribution() {
    // Use single aggregated query instead of N+1
    const distribution = await prisma.$queryRaw<{
      id: string
      name: string
      total_cartons: bigint
    }[]>`
      SELECT 
        w.id,
        w.name,
        COALESCE(SUM(ib.current_cartons), 0) as total_cartons
      FROM warehouses w
      LEFT JOIN inventory_balances ib ON w.id = ib.warehouse_id
      WHERE w.is_active = true
      GROUP BY w.id, w.name
      ORDER BY total_cartons DESC
    `

    // Calculate total for percentages
    const total = distribution.reduce((sum, w) => sum + Number(w.total_cartons), 0)
    
    return distribution.map(w => ({
      name: w.name,
      value: Number(w.total_cartons),
      percentage: total > 0 ? `${Math.round((Number(w.total_cartons) / total) * 100)}%` : '0%'
    }))
  }

  private async getCostTrend(startDate: Date, endDate: Date) {
    // Get storage ledger entries
    const storageLedgerEntries = await prisma.storage_ledger.findMany({
      where: {
        week_ending_date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { warehouse: true },
      orderBy: { week_ending_date: 'asc' }
    })

    if (storageLedgerEntries.length === 0) {
      return []
    }

    // Group by week and sum costs
    const weeklyTotals = new Map<string, number>()
    
    storageLedgerEntries.forEach(entry => {
      // Get Monday from week ending date (Sunday)
      const weekEndingDate = new Date(entry.week_ending_date10488)
      const monday = new Date(weekEndingDate)
      monday.setDate(monday.getDate() - 6) // Go back 6 days to Monday
      
      const weekKey = format(monday, 'yyyy-MM-dd')
      const cost = Number(entry.calculated_weekly_cost) || 0
      
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + cost)
    })
    
    // Convert to chart data format
    return Array.from(weeklyTotals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cost]) => ({
        date: format(new Date(date), 'MMM dd'),
        cost: Math.round(cost * 100) / 100 // Round to 2 decimal places
      }))
  }

  private async getRecentTransactions(limit: number) {
    const transactions = await prisma.inventory_transactions.findMany({
      take: limit,
      orderBy: { transaction_date: 'desc' },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    return transactions.map(tx => ({
      id: tx.id,
      type: tx.transaction_type,
      sku: tx.skus.sku_code,
      quantity: tx.cartons_in > 0 ? tx.cartons_in : tx.cartons_out,
      warehouse: tx.warehouses.name,
      date: tx.transaction_date.toISOString(),
      details: tx.skus.description
    }))
  }
}

// Singleton instance
export const dashboardService = new DashboardService()