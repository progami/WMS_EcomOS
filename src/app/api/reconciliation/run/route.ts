import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Money, calculateReconciliationDifference } from '@/lib/financial-utils'
import { 
  getCalculatedCostsSummary, 
  getBillingPeriod,
  type BillingPeriod 
} from '@/lib/calculations/cost-aggregation'

export const dynamic = 'force-dynamic'

// POST /api/reconciliation/run - Run reconciliation for a period
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { warehouseId, period } = body

    // Parse period to get date range
    let billingPeriod: BillingPeriod

    if (period) {
      const [year, month] = period.split('-')
      const start = new Date(parseInt(year), parseInt(month) - 1, 16)
      const end = new Date(parseInt(year), parseInt(month), 15, 23, 59, 59, 999)
      billingPeriod = { start, end }
    } else {
      // Default to current billing period
      billingPeriod = getBillingPeriod(new Date())
    }

    // Build where clause for invoices
    const invoiceWhere: any = {
      billingPeriodStart: {
        gte: billingPeriod.start,
        lte: billingPeriod.end
      },
      status: { in: ['pending', 'reconciled', 'disputed'] }
    }

    if (warehouseId) {
      invoiceWhere.warehouseId = warehouseId
    }

    // Get invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        lineItems: true,
        reconciliations: true,
        warehouse: true
      }
    })

    let processedCount = 0
    let createdReconciliations = 0
    let totalDiscrepancies = 0

    // Process each invoice
    for (const invoice of invoices) {
      // Skip if already has reconciliations
      if (invoice.reconciliations.length > 0) {
        continue
      }

      // Get calculated costs for the warehouse and billing period
      const calculatedCostsSummary = await getCalculatedCostsSummary(
        invoice.warehouseId,
        billingPeriod
      )

      // Create reconciliation records
      const reconciliations = []
      const processedCosts = new Set<string>()

      // Match invoice line items with calculated costs
      for (const lineItem of invoice.lineItems) {
        // Find matching calculated cost
        const matchingCost = calculatedCostsSummary.find(cost => 
          cost.costCategory === lineItem.costCategory && 
          cost.costName === lineItem.costName
        )

        if (matchingCost) {
          const expectedAmount = matchingCost.totalAmount
          const { difference, status } = calculateReconciliationDifference(
            Number(lineItem.amount),
            expectedAmount
          )
          
          if (status !== 'match') {
            totalDiscrepancies++
          }

          reconciliations.push({
            invoiceId: invoice.id,
            costCategory: lineItem.costCategory,
            costName: lineItem.costName,
            expectedAmount,
            invoicedAmount: lineItem.amount,
            difference,
            status,
            expectedQuantity: matchingCost.totalQuantity,
            invoicedQuantity: lineItem.quantity || 0,
            unitRate: matchingCost.unitRate
          })

          // Mark as processed
          processedCosts.add(`${matchingCost.costCategory}-${matchingCost.costName}`)
        } else {
          // No matching calculated cost found - this charge shouldn't exist
          const invoicedMoney = new Money(lineItem.amount);
          reconciliations.push({
            invoiceId: invoice.id,
            costCategory: lineItem.costCategory,
            costName: lineItem.costName,
            expectedAmount: 0,
            invoicedAmount: lineItem.amount,
            difference: invoicedMoney.toDecimal(),
            status: 'overbilled' as const,
            expectedQuantity: 0,
            invoicedQuantity: lineItem.quantity || 0,
            unitRate: lineItem.unitRate || 0
          })
          totalDiscrepancies++
        }
      }

      // Check for any calculated costs that don't have matching line items
      // These are costs we expected but weren't billed
      for (const calculatedCost of calculatedCostsSummary) {
        const key = `${calculatedCost.costCategory}-${calculatedCost.costName}`
        if (!processedCosts.has(key) && calculatedCost.totalAmount > 0) {
          const expectedMoney = new Money(calculatedCost.totalAmount);
          reconciliations.push({
            invoiceId: invoice.id,
            costCategory: calculatedCost.costCategory,
            costName: calculatedCost.costName,
            expectedAmount: calculatedCost.totalAmount,
            invoicedAmount: 0,
            difference: expectedMoney.multiply(-1).toDecimal(),
            status: 'underbilled' as const,
            expectedQuantity: calculatedCost.totalQuantity,
            invoicedQuantity: 0,
            unitRate: calculatedCost.unitRate
          })
          totalDiscrepancies++
        }
      }

      // Insert reconciliation records
      if (reconciliations.length > 0) {
        await prisma.invoiceReconciliation.createMany({
          data: reconciliations
        })
        createdReconciliations += reconciliations.length
      }

      // Update invoice status based on reconciliation results
      const hasDiscrepancies = reconciliations.some(r => r.status !== 'match')
      
      // Only auto-update status if invoice is pending
      // Don't change status if it's already disputed or reconciled
      if (invoice.status === 'pending' && reconciliations.length > 0) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: hasDiscrepancies ? 'pending' : 'reconciled',
            notes: hasDiscrepancies 
              ? `Auto-reconciliation found ${totalDiscrepancies} discrepancies. Review required.`
              : 'Auto-reconciliation successful - all line items match expected costs.'
          }
        })
      }

      processedCount++
    }

    return NextResponse.json({
      message: 'Reconciliation completed successfully',
      summary: {
        invoicesProcessed: processedCount,
        reconciliationsCreated: createdReconciliations,
        discrepanciesFound: totalDiscrepancies,
        period: {
          start: billingPeriod.start.toISOString(),
          end: billingPeriod.end.toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error running reconciliation:', error)
    return NextResponse.json(
      { error: 'Failed to run reconciliation' },
      { status: 500 }
    )
  }
}