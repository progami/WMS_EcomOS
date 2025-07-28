import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current date info
    const now = new Date()

    // Check if user has warehouse restriction
    const warehouseFilter = session.user.warehouseId 
      ? { warehouseId: session.user.warehouseId }
      : {
          warehouse: {
            NOT: {
              OR: [
                { code: 'AMZN' },
                { code: 'AMZN-UK' }
              ]
            }
          }
        }

    // Calculate total inventory from transactions
    const inventoryStats = await prisma.inventoryTransaction.aggregate({
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    const currentInventory = (inventoryStats._sum.cartonsIn || 0) - (inventoryStats._sum.cartonsOut || 0)

    // Calculate inventory change from last month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)
    
    // Get transactions to calculate last month's ending balance
    const transactionsUpToLastMonth = await prisma.inventoryTransaction.aggregate({
      where: {
        transactionDate: {
          lte: lastMonthEnd,
        },
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    const lastMonthInventory = (transactionsUpToLastMonth._sum.cartonsIn || 0) - 
                              (transactionsUpToLastMonth._sum.cartonsOut || 0)
    
    const inventoryChange = lastMonthInventory > 0 
      ? ((currentInventory - lastMonthInventory) / lastMonthInventory) * 100 
      : 0

    // Storage cost estimate for current billing period
    // Billing period is 16th to 15th
    const billingStart = new Date(now)
    if (now.getDate() <= 15) {
      // We're in the period from last month's 16th to this month's 15th
      billingStart.setMonth(billingStart.getMonth() - 1)
    }
    billingStart.setDate(16)
    billingStart.setHours(0, 0, 0, 0)
    
    const billingEnd = new Date(billingStart)
    billingEnd.setMonth(billingEnd.getMonth() + 1)
    billingEnd.setDate(15)
    billingEnd.setHours(23, 59, 59, 999)

    // Get storage costs for current billing period
    const storageCosts = await prisma.calculatedCost.aggregate({
      where: {
        billingPeriodStart: {
          gte: billingStart,
          lte: billingEnd,
        },
        transactionType: 'STORAGE',
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
      },
      _sum: {
        finalExpectedCost: true,
      },
    })
    
    const currentCost = Number(storageCosts._sum.finalExpectedCost || 0)

    // Get last billing period's costs
    const lastBillingStart = new Date(billingStart)
    lastBillingStart.setMonth(lastBillingStart.getMonth() - 1)
    const lastBillingEnd = new Date(billingEnd)
    lastBillingEnd.setMonth(lastBillingEnd.getMonth() - 1)
    
    const lastPeriodCosts = await prisma.calculatedCost.aggregate({
      where: {
        billingPeriodStart: {
          gte: lastBillingStart,
          lte: lastBillingEnd,
        },
        transactionType: 'STORAGE',
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
      },
      _sum: {
        finalExpectedCost: true,
      },
    })
    
    const lastCost = Number(lastPeriodCosts._sum.finalExpectedCost || 0)
    const costChange = lastCost > 0 
      ? ((currentCost - lastCost) / lastCost) * 100 
      : 0

    // Active SKUs count - count unique SKUs with positive balance
    const activeSkusGroup = await prisma.inventoryTransaction.groupBy({
      by: ['skuId'],
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })
    const activeSkus = activeSkusGroup.filter(sku => 
      (sku._sum.cartonsIn || 0) - (sku._sum.cartonsOut || 0) > 0
    )
    const activeSkusCount = activeSkus.length

    // Pending invoices count
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: 'pending',
        ...(session.user.warehouseId && {
          OR: [
            { warehouse: { id: session.user.warehouseId } },
            { warehouseId: session.user.warehouseId }
          ]
        })
      },
    })

    // Overdue invoices (pending invoices over 30 days old)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const overdueInvoices = await prisma.invoice.count({
      where: {
        status: 'pending',
        invoiceDate: {
          lt: thirtyDaysAgo,
        },
        ...(session.user.warehouseId && {
          OR: [
            { warehouse: { id: session.user.warehouseId } },
            { warehouseId: session.user.warehouseId }
          ]
        })
      },
    })

    // Chart Data: Inventory Trend (last 30 days)
    const thirtyDaysAgoForTrend = new Date()
    thirtyDaysAgoForTrend.setDate(thirtyDaysAgoForTrend.getDate() - 30)
    
    // Get daily inventory snapshots
    const inventoryTrendData = await prisma.inventoryTransaction.groupBy({
      by: ['transactionDate'],
      where: {
        transactionDate: {
          gte: thirtyDaysAgoForTrend,
          lte: now,
        },
        ...warehouseFilter,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
      orderBy: {
        transactionDate: 'asc',
      },
    })

    // Calculate running balance for each day
    const inventoryTrend: Array<{ date: string; inventory: number }> = []
    let runningBalance = 0
    
    // Get initial balance 30 days ago
    const initialBalanceData = await prisma.inventoryTransaction.aggregate({
      where: {
        transactionDate: {
          lt: thirtyDaysAgoForTrend,
        },
        ...warehouseFilter,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    runningBalance = (initialBalanceData._sum.cartonsIn || 0) - (initialBalanceData._sum.cartonsOut || 0)
    
    // Create a map of dates with transactions
    const transactionMap = new Map<string, { in: number; out: number }>()
    inventoryTrendData.forEach(item => {
      const dateKey = item.transactionDate.toISOString().split('T')[0]
      transactionMap.set(dateKey, {
        in: item._sum.cartonsIn || 0,
        out: item._sum.cartonsOut || 0,
      })
    })
    
    // Fill in all days including those without transactions
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]
      const dayTransactions = transactionMap.get(dateKey)
      
      if (dayTransactions) {
        runningBalance += dayTransactions.in - dayTransactions.out
      }
      
      inventoryTrend.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inventory: Math.max(0, runningBalance),
      })
    }

    // Chart Data: Cost Trend (last 12 weeks)
    const twelveWeeksAgo = new Date()
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84) // 12 weeks
    
    const costTrendData = await prisma.calculatedCost.groupBy({
      by: ['billingWeekEnding'],
      where: {
        billingWeekEnding: {
          gte: twelveWeeksAgo,
          lte: now,
        },
        transactionType: 'STORAGE',
        ...warehouseFilter,
      },
      _sum: {
        finalExpectedCost: true,
      },
      orderBy: {
        billingWeekEnding: 'asc',
      },
    })
    
    const costTrend: Array<{ date: string; cost: number }> = costTrendData.map((item) => ({
      date: item.billingWeekEnding.toISOString().split('T')[0],
      cost: Number(item._sum?.finalExpectedCost || 0),
    }))
    
    // If no cost data, create empty array with proper structure
    if (costTrend.length === 0) {
      for (let i = 1; i <= 12; i++) {
        costTrend.push({ date: `Week ${i}`, cost: 0 })
      }
    }

    // Chart Data: Warehouse Distribution
    const warehouseInventory = await prisma.inventoryTransaction.groupBy({
      by: ['warehouseId'],
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    // Get warehouse details
    const warehouseIds = warehouseInventory.map(w => w.warehouseId)
    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: warehouseIds },
      },
      select: {
        id: true,
        name: true,
      },
    })
    
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]))
    const warehouseBalances = warehouseInventory.map(w => ({
      warehouseId: w.warehouseId,
      balance: (w._sum.cartonsIn || 0) - (w._sum.cartonsOut || 0)
    }))
    const totalCartons = warehouseBalances.reduce((sum, w) => sum + w.balance, 0)
    
    const warehouseDistribution: Array<{ name: string; value: number; percentage: number }> = warehouseBalances
      .map(w => ({
        name: warehouseMap.get(w.warehouseId) || 'Unknown',
        value: w.balance,
        percentage: totalCartons > 0 ? (w.balance / totalCartons) * 100 : 0,
      }))
      .filter(w => w.value > 0)
      .sort((a, b) => b.value - a.value)

    return NextResponse.json({
      totalInventory: currentInventory,
      inventoryChange: inventoryChange.toFixed(1),
      inventoryTrend: inventoryChange > 0 ? 'up' : inventoryChange < 0 ? 'down' : 'neutral',
      storageCost: currentCost.toFixed(2),
      costChange: costChange.toFixed(1),
      costTrend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
      activeSkus: activeSkusCount,
      pendingInvoices,
      overdueInvoices,
      chartData: {
        inventoryTrend,
        costTrend,
        warehouseDistribution,
      },
    })
  } catch (error) {
    // console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}