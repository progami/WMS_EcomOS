import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  getBillingPeriod, 
  calculateAllCosts,
  calculateAllCostsForWarehouses
} from '@/lib/calculations/cost-aggregation'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current billing period
    const currentBillingPeriod = getBillingPeriod(new Date())
    
    // Get previous billing period for comparison
    const prevDate = new Date()
    prevDate.setMonth(prevDate.getMonth() - 1)
    const previousBillingPeriod = getBillingPeriod(prevDate)

    // Get all warehouses
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true }
    })

    // Calculate current period costs for all warehouses (optimized)
    const warehouseIds = warehouses.map(w => w.id)
    
    // Fetch costs for all warehouses in a single operation
    const [currentCostsMap, previousCostsMap] = await Promise.all([
      calculateAllCostsForWarehouses(warehouseIds, currentBillingPeriod),
      calculateAllCostsForWarehouses(warehouseIds, previousBillingPeriod)
    ])
    
    // Process current period costs
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

    // Get invoice stats
    const invoiceStats = await prisma.invoice.groupBy({
      by: ['status'],
      where: {
        billingPeriodStart: {
          gte: currentBillingPeriod.start,
          lte: currentBillingPeriod.end,
        },
      },
      _count: true,
      _sum: {
        totalAmount: true,
      },
    })

    const paidInvoices = invoiceStats.find(s => s.status === 'paid') || { _count: 0, _sum: { totalAmount: 0 } }
    const pendingInvoices = invoiceStats.find(s => s.status === 'pending') || { _count: 0, _sum: { totalAmount: 0 } }
    const disputedInvoices = invoiceStats.find(s => s.status === 'disputed') || { _count: 0, _sum: { totalAmount: 0 } }
    
    // Calculate overdue invoices separately (pending invoices with due date passed)
    const today = new Date()
    
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'pending',
        dueDate: {
          lt: today,
        },
        billingPeriodStart: {
          gte: currentBillingPeriod.start,
          lte: currentBillingPeriod.end,
        },
      },
      select: {
        totalAmount: true,
      },
    })
    
    const overdueCount = overdueInvoices.length
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

    // Cost breakdown by category
    const costBreakdown = Array.from(currentCostsByCategory.entries()).map(([category, amount]) => ({
      category,
      amount,
    }))

    // Calculate cost variance (compare invoiced vs calculated)
    const totalInvoiced = Number(paidInvoices._sum.totalAmount || 0) + 
                         Number(pendingInvoices._sum.totalAmount || 0) +
                         Number(disputedInvoices._sum.totalAmount || 0)
    
    const costVariance = currentTotalRevenue > 0 
      ? ((totalInvoiced - currentTotalRevenue) / currentTotalRevenue) * 100 
      : 0

    // Collection rate
    const totalBilled = totalInvoiced + overdueAmount
    const collectionRate = totalBilled > 0 
      ? (Number(paidInvoices._sum.totalAmount || 0) / totalBilled) * 100 
      : 0

    // Get recent financial activity
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Get recent disputes
    const recentDisputes = await prisma.invoiceDispute.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    // Combine and sort activities
    const activities = [
      ...recentInvoices.map(invoice => ({
        id: invoice.id,
        type: 'invoice' as const,
        title: `Invoice #${invoice.invoiceNumber} ${
          invoice.status === 'paid' ? 'paid' : 
          invoice.status === 'disputed' ? 'disputed' : 
          'processed'
        }`,
        amount: Number(invoice.totalAmount),
        time: invoice.createdAt,
        status: invoice.status === 'paid' ? 'success' : 
                invoice.status === 'disputed' ? 'warning' : 'info',
        warehouse: invoice.warehouse.name,
      })),
      ...recentDisputes.map(dispute => ({
        id: dispute.id,
        type: 'dispute' as const,
        title: `Dispute raised for Invoice #${dispute.invoice.invoiceNumber}`,
        amount: Number(dispute.disputedAmount),
        time: dispute.createdAt,
        status: 'warning' as const,
        warehouse: dispute.invoice.warehouse.name,
      })),
    ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5)

    // Get reconciliation stats
    const reconStats = await prisma.invoiceReconciliation.groupBy({
      by: ['status'],
      where: {
        invoice: {
          billingPeriodStart: {
            gte: currentBillingPeriod.start,
            lte: currentBillingPeriod.end,
          },
        },
      },
      _count: true,
    })

    const matchedItems = reconStats.find(s => s.status === 'match')?._count || 0
    const overbilledItems = reconStats.find(s => s.status === 'overbilled')?._count || 0
    const underbilledItems = reconStats.find(s => s.status === 'underbilled')?._count || 0

    return NextResponse.json({
      kpis: {
        totalRevenue: currentTotalRevenue.toFixed(2),
        revenueChange: revenueChange.toFixed(1),
        outstandingAmount: (Number(pendingInvoices._sum.totalAmount || 0) + overdueAmount).toFixed(2),
        outstandingCount: pendingInvoices._count + overdueCount,
        costVariance: costVariance.toFixed(1),
        costSavings: Math.abs(totalInvoiced - currentTotalRevenue).toFixed(2),
        collectionRate: collectionRate.toFixed(1),
      },
      costBreakdown,
      invoiceStatus: {
        paid: {
          count: paidInvoices._count,
          amount: Number(paidInvoices._sum.totalAmount || 0),
        },
        pending: {
          count: pendingInvoices._count,
          amount: Number(pendingInvoices._sum.totalAmount || 0),
        },
        overdue: {
          count: overdueCount,
          amount: overdueAmount,
        },
        disputed: {
          count: disputedInvoices._count,
          amount: Number(disputedInvoices._sum.totalAmount || 0),
        },
      },
      reconciliationStats: {
        matched: matchedItems,
        overbilled: overbilledItems,
        underbilled: underbilledItems,
        total: matchedItems + overbilledItems + underbilledItems,
      },
      recentActivity: activities,
      billingPeriod: {
        start: currentBillingPeriod.start,
        end: currentBillingPeriod.end,
      },
    })
  } catch (error) {
    // console.error('Finance dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}