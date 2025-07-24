import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // console.log('Admin dashboard API called')
  
  try {
    // Test basic connectivity first
    try {
      const testConnection = await prisma.$queryRaw`SELECT 1 as test`
      // console.log('Database connection test:', testConnection)
    } catch (dbError) {
      // console.error('Database connection error:', dbError)
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: dbError instanceof Error ? dbError.message : 'Unknown database error' 
      }, { status: 500 })
    }
    
    const session = await getServerSession(authOptions)
    // console.log('Session:', session)
    
    if (!session || session.user.role !== 'admin') {
      // console.log('Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Get current date info
    const now = new Date()
    let startDate: Date
    let endDate: Date
    let compareStartDate: Date
    let compareEndDate: Date

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
      // For custom ranges, compare with previous period of same length
      const periodLength = endDate.getTime() - startDate.getTime()
      compareStartDate = new Date(startDate.getTime() - periodLength)
      compareEndDate = new Date(startDate.getTime())
    } else {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      compareStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      compareEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
    }

    // Initialize default values
    let currentInventory = 0
    let inventoryChange = 0
    
    try {
      // Total inventory across all warehouses
      const inventoryStats = await prisma.inventoryBalance.aggregate({
        _sum: {
          currentCartons: true,
        },
      })
      currentInventory = inventoryStats._sum.currentCartons || 0
      
      // Previous period's inventory for comparison
      const previousPeriodTransactions = await prisma.inventoryTransaction.aggregate({
        where: {
          transactionDate: {
            gte: compareStartDate,
            lte: compareEndDate,
          },
        },
        _sum: {
          cartonsIn: true,
          cartonsOut: true,
        },
      })

      const previousPeriodInventory = (previousPeriodTransactions._sum.cartonsIn || 0) - 
                                     (previousPeriodTransactions._sum.cartonsOut || 0)
      
      inventoryChange = previousPeriodInventory > 0 
        ? ((currentInventory - previousPeriodInventory) / previousPeriodInventory) * 100 
        : 0
    } catch (invError) {
      // console.error('Error fetching inventory stats:', invError)
    }

    // Initialize more default values
    let currentCost = 0
    let costChange = 0
    let activeSkusCount = 0
    let pendingInvoices = 0
    let overdueInvoices = 0
    let totalUsers = 0
    let totalTransactions = 0
    
    try {
      // Current period storage cost estimate
      const currentPeriodCosts = await prisma.calculatedCost.aggregate({
        where: {
          billingPeriodStart: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          finalExpectedCost: true,
        },
      })

      // Previous period's costs for comparison
      const previousPeriodCosts = await prisma.calculatedCost.aggregate({
        where: {
          billingPeriodStart: {
            gte: compareStartDate,
            lte: compareEndDate,
          },
        },
        _sum: {
          finalExpectedCost: true,
        },
      })

      currentCost = Number(currentPeriodCosts._sum.finalExpectedCost || 0)
      const previousCost = Number(previousPeriodCosts._sum.finalExpectedCost || 0)
      costChange = previousCost > 0 
        ? ((currentCost - previousCost) / previousCost) * 100 
        : 0
    } catch (costError) {
      // console.error('Error fetching cost stats:', costError)
    }
    
    try {
      // Active SKUs count
      const activeSkus = await prisma.inventoryBalance.findMany({
        where: {
          currentCartons: {
            gt: 0,
          },
        },
        select: {
          skuId: true,
        },
        distinct: ['skuId'],
      })
      activeSkusCount = activeSkus.length
    } catch (skuError) {
      // console.error('Error fetching SKU stats:', skuError)
    }

    try {
      // Pending invoices count
      pendingInvoices = await prisma.invoice.count({
        where: {
          status: 'pending',
        },
      })

      // Overdue invoices (pending invoices past due date)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      overdueInvoices = await prisma.invoice.count({
        where: {
          status: 'pending',
          invoiceDate: {
            lt: thirtyDaysAgo,
          },
        },
      })
    } catch (invoiceError) {
      // console.error('Error fetching invoice stats:', invoiceError)
    }

    try {
      // System status info
      totalUsers = await prisma.user.count()
      totalTransactions = await prisma.inventoryTransaction.count()
    } catch (sysError) {
      // console.error('Error fetching system stats:', sysError)
    }
    
    // Get database size (approximate)
    let dbSize = [{ size: 0 }]
    try {
      const dbSizeResult = await prisma.$queryRaw<{size: bigint}[]>`
        SELECT pg_database_size(current_database()) as size
      `
      // Convert bigint to number
      dbSize = dbSizeResult.map(row => ({ size: Number(row.size) }))
    } catch (dbError) {
      // console.warn('Failed to get database size:', dbError)
      // Continue with default value
    }

    // Fetch real chart data
    const chartData: {
      inventoryTrend: { date: string; inventory: number }[],
      costTrend: { date: string; cost: number }[],
      warehouseDistribution: { name: string; value: number; percentage: string }[],
      recentTransactions: { id: string; date: string; type: string; sku: string; quantity: number }[]
    } = {
      inventoryTrend: [],
      costTrend: [],
      warehouseDistribution: [],
      recentTransactions: []
    }

    // 1. Inventory Trend - Show daily inventory levels
    try {
      // console.log('Fetching inventory trend...')
      
      // Get transactions grouped by day for the selected period
      const transactions = await prisma.inventoryTransaction.findMany({
        where: {
          transactionDate: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          transactionDate: 'asc'
        }
      })
      
      // console.log(`Found ${transactions.length} transactions in period`)
      
      if (transactions.length > 0) {
        // Get inventory level at start of period
        const beforePeriod = await prisma.inventoryTransaction.aggregate({
          where: {
            transactionDate: {
              lt: startDate
            }
          },
          _sum: {
            cartonsIn: true,
            cartonsOut: true
          }
        })
        
        let runningTotal = (beforePeriod._sum.cartonsIn || 0) - (beforePeriod._sum.cartonsOut || 0)
        
        // Group transactions by date
        const dailyChanges = new Map<string, number>()
        transactions.forEach(tx => {
          const dateKey = format(tx.transactionDate, 'yyyy-MM-dd')
          const change = tx.cartonsIn - tx.cartonsOut
          dailyChanges.set(dateKey, (dailyChanges.get(dateKey) || 0) + change)
        })
        
        // Build trend with running total
        chartData.inventoryTrend = Array.from(dailyChanges.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, change]) => {
            runningTotal += change
            return {
              date: format(new Date(date), 'MMM dd'),
              inventory: runningTotal
            }
          })
      } else {
        // No transactions in period, show current level as flat line
        const currentInv = await prisma.inventoryBalance.aggregate({
          _sum: { currentCartons: true }
        })
        const current = currentInv._sum.currentCartons || 0
        
        // Create a few data points across the period
        const days = Math.min(7, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
        chartData.inventoryTrend = Array.from({ length: days }, (_, i) => {
          const date = new Date(startDate)
          date.setDate(date.getDate() + Math.floor(i * ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / (days - 1)))
          return {
            date: format(date, 'MMM dd'),
            inventory: current
          }
        })
      }
      
      // console.log('Inventory trend data:', chartData.inventoryTrend)
    } catch (invError) {
      // console.error('Error fetching inventory trend:', invError)
    }

    // 2. Storage Costs - Read from storage_ledger table
    try {
      // console.log('Fetching storage costs from storage_ledger table...')
      
      // Get storage ledger entries from the database
      const storageLedgerEntries = await prisma.storageLedger.findMany({
        where: {
          weekEndingDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          warehouse: true
        },
        orderBy: { weekEndingDate: 'asc' }
      })
      
      // console.log(`Found ${storageLedgerEntries.length} storage ledger entries`)
      
      if (storageLedgerEntries.length > 0) {
        // Group by week and sum costs
        const weeklyTotals = new Map<string, number>()
        
        storageLedgerEntries.forEach(entry => {
          // Get Monday from week ending date (Sunday)
          const weekEndingDate = new Date(entry.weekEndingDate)
          const monday = new Date(weekEndingDate)
          monday.setDate(monday.getDate() - 6) // Go back 6 days to Monday
          
          const weekKey = format(monday, 'yyyy-MM-dd')
          const cost = Number(entry.calculatedWeeklyCost) || 0
          
          weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + cost)
        })
        
        // Convert to chart data format
        chartData.costTrend = Array.from(weeklyTotals.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, cost]) => ({
            date: format(new Date(date), 'MMM dd'),
            cost: Math.round(cost * 100) / 100 // Round to 2 decimal places
          }))
      }
      
      // NOTE: Storage ledger table has been populated with 705 entries
      // Weekly cron job will keep it updated
      
    } catch (costError) {
      // console.error('Error fetching storage costs:', costError)
    }

    // 3. Warehouse Distribution
    try {
      // console.log('Fetching warehouse distribution...')
      const warehouses = await prisma.warehouse.findMany()
      // console.log(`Found ${warehouses.length} warehouses`)
      
      // For each warehouse, get current inventory
      chartData.warehouseDistribution = await Promise.all(
        warehouses.map(async (warehouse) => {
          const inventory = await prisma.inventoryBalance.aggregate({
            where: { warehouseId: warehouse.id },
            _sum: { currentCartons: true }
          })
          const value = inventory._sum.currentCartons || 0
          return {
            name: warehouse.name,
            value: value,
            percentage: '0%' // Calculate later
          }
        })
      )
      
      // Calculate percentages
      const total = chartData.warehouseDistribution.reduce((sum, w) => sum + w.value, 0)
      chartData.warehouseDistribution = chartData.warehouseDistribution.map(w => ({
        ...w,
        percentage: total > 0 ? `${Math.round((w.value / total) * 100)}%` : '0%'
      }))
      
      // console.log('Warehouse distribution:', chartData.warehouseDistribution)
    } catch (distError) {
      // console.error('Error fetching distribution:', distError)
    }

    // 4. Recent Transactions
    try {
      // console.log('Fetching recent transactions...')
      const transactions = await prisma.inventoryTransaction.findMany({
        take: 5,
        orderBy: { transactionDate: 'desc' },
        include: {
          sku: true,
          warehouse: true
        }
      })
      
      // console.log(`Found ${transactions.length} transactions`)
      
      chartData.recentTransactions = transactions.map(tx => ({
        id: tx.id,
        type: tx.transactionType,
        sku: tx.sku.skuCode,
        quantity: tx.cartonsIn > 0 ? tx.cartonsIn : tx.cartonsOut,
        warehouse: tx.warehouse.name,
        date: tx.transactionDate.toISOString(),
        details: tx.sku.description
      }))
    } catch (txError) {
      // console.error('Error fetching transactions:', txError)
    }

    // console.log('Final chart data:', chartData)

    return NextResponse.json({
      stats: {
        totalInventory: currentInventory,
        inventoryChange: inventoryChange.toFixed(1),
        inventoryTrend: inventoryChange > 0 ? 'up' : inventoryChange < 0 ? 'down' : 'neutral',
        storageCost: currentCost.toFixed(2),
        costChange: costChange.toFixed(1),
        costTrend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
        activeSkus: activeSkusCount,
        pendingInvoices,
        overdueInvoices,
      },
      systemInfo: {
        totalUsers,
        totalTransactions,
        dbSize: Math.round(Number(dbSize[0]?.size || 0) / 1024 / 1024) || 0, // Convert to MB
      },
      chartData
    })
  } catch (error) {
    // console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}