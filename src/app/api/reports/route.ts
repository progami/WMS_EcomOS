import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'xlsx'
    const currentMonth = new Date().toISOString().slice(0, 7)
    const reportType = 'analytics-summary'
    const period = currentMonth
    const warehouseId = undefined

    const data = await generateAnalyticsSummaryReport(period, warehouseId)
    const fileName = `analytics_summary_${period}`

    // Generate file based on format
    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(data, reportType, period)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        },
      })
    } else if (format === 'csv') {
      const csv = generateCSV(data)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      })
    } else {
      // Default to Excel
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, 'Analytics Summary')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
        },
      })
    }
  } catch (error) {
    // console.error('Report generation error:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportType, period, warehouseId, format: outputFormat = 'xlsx' } = await request.json()

    let data: any[] = []
    let fileName = ''

    switch (reportType) {
      case 'monthly-inventory':
        data = await generateMonthlyInventoryReport(period, warehouseId)
        fileName = `monthly_inventory_${period}`
        break
        
      case 'inventory-ledger':
        data = await generateInventoryLedger(period, warehouseId)
        fileName = `inventory_ledger_${period}`
        break
        
      case 'storage-charges':
        data = await generateStorageCharges(period, warehouseId)
        fileName = `storage_charges_${period}`
        break
        
      case 'cost-summary':
        data = await generateCostSummary(period, warehouseId)
        fileName = `cost_summary_${period}`
        break

      case 'reconciliation':
        data = await generateReconciliationReport(period, warehouseId)
        fileName = `reconciliation_${period}`
        break

      case 'inventory-balance':
        data = await generateInventoryBalanceReport(warehouseId)
        fileName = `inventory_balance_${new Date().toISOString().split('T')[0]}`
        break

      case 'low-stock':
        data = await generateLowStockReport(warehouseId)
        fileName = `low_stock_${new Date().toISOString().split('T')[0]}`
        break

      case 'cost-analysis':
        data = await generateCostAnalysisReport(period, warehouseId)
        fileName = `cost_analysis_${period}`
        break

      case 'monthly-billing':
        data = await generateMonthlyBillingReport(period, warehouseId)
        fileName = `monthly_billing_${period}`
        break

      case 'analytics-summary':
        data = await generateAnalyticsSummaryReport(period, warehouseId)
        fileName = `analytics_summary_${period}`
        break

      case 'performance-metrics':
        data = await generatePerformanceMetricsReport(period, warehouseId)
        fileName = `performance_metrics_${period}`
        break
        
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    // Generate file based on format
    if (outputFormat === 'pdf') {
      const pdfBuffer = await generatePDF(data, reportType, period)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        },
      })
    } else if (outputFormat === 'csv') {
      const csv = generateCSV(data)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      })
    } else {
      // Default to Excel
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, 'Report')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
        },
      })
    }
  } catch (error) {
    // console.error('Report generation error:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}

async function generateMonthlyInventoryReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))

  const balances = await prisma.inventoryBalance.findMany({
    where: warehouseId 
      ? { warehouseId } 
      : {
          warehouse: {
            NOT: {
              OR: [
                { code: 'AMZN' },
                { code: 'AMZN-UK' }
              ]
            }
          }
        },
    include: {
      warehouse: true,
      sku: true,
    },
  })

  return balances.map(b => ({
    'Warehouse': b.warehouse.name,
    'SKU Code': b.sku.skuCode,
    'Description': b.sku.description,
    'Batch/Lot': b.batchLot,
    'Current Cartons': b.currentCartons,
    'Current Pallets': b.currentPallets,
    'Units per Carton (Current)': b.sku.unitsPerCarton,
    'Total Units': b.currentUnits,
    'Report Date': new Date().toLocaleDateString(),
  }))
}

async function generateInventoryLedger(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))

  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      ...(warehouseId 
        ? { warehouseId } 
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
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
      sku: true,
      createdBy: true,
    },
    orderBy: { transactionDate: 'desc' },
  })

  return transactions.map(t => ({
    'Date': new Date(t.transactionDate).toLocaleDateString(),
    'Transaction ID': t.transactionId,
    'Warehouse': t.warehouse.name,
    'SKU': t.sku.skuCode,
    'Batch/Lot': t.batchLot,
    'Type': t.transactionType,
    'Reference': t.referenceId || '',
    'Cartons In': t.cartonsIn,
    'Cartons Out': t.cartonsOut,
    'Units per Carton': t.unitsPerCarton || t.sku.unitsPerCarton,
    'Units In': t.cartonsIn * (t.unitsPerCarton || t.sku.unitsPerCarton || 1),
    'Units Out': t.cartonsOut * (t.unitsPerCarton || t.sku.unitsPerCarton || 1),
    'Created By': t.createdBy.fullName,
  }))
}

async function generateStorageCharges(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  
  // Billing periods run from 16th to 15th
  const billingStart = new Date(year, month - 2, 16)
  const billingEnd = new Date(year, month - 1, 15)

  const storageLedger = await prisma.storageLedger.findMany({
    where: {
      ...(warehouseId 
        ? { warehouseId } 
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
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
    },
    include: {
      warehouse: true,
      sku: true,
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { weekEndingDate: 'asc' },
      { sku: { skuCode: 'asc' } },
    ],
  })

  return storageLedger.map(s => ({
    'Week Ending': new Date(s.weekEndingDate).toLocaleDateString(),
    'Warehouse': s.warehouse.name,
    'SKU': s.sku.skuCode,
    'Batch/Lot': s.batchLot,
    'Cartons (Monday)': s.cartonsEndOfMonday,
    'Pallets Charged': s.storagePalletsCharged,
    'Weekly Rate': s.applicableWeeklyRate,
    'Weekly Cost': s.calculatedWeeklyCost,
    'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`,
  }))
}

async function generateCostSummary(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  
  // Get storage costs
  const storageCosts = await prisma.storageLedger.groupBy({
    by: ['warehouseId'],
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      billingPeriodStart: new Date(year, month - 2, 16),
      billingPeriodEnd: new Date(year, month - 1, 15),
    },
    _sum: {
      calculatedWeeklyCost: true,
    },
  })

  // Get warehouse names (excluding Amazon FBA)
  const warehouses = await prisma.warehouse.findMany({
    where: {
      NOT: {
        OR: [
          { code: 'AMZN' },
          { code: 'AMZN-UK' }
        ]
      }
    }
  })
  const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]))

  return storageCosts.map(cost => ({
    'Warehouse': warehouseMap.get(cost.warehouseId) || 'Unknown',
    'Storage Costs': cost._sum.calculatedWeeklyCost || 0,
    'Handling Costs': 0, // To be calculated from calculated_costs table
    'Other Costs': 0, // To be calculated
    'Total Costs': cost._sum.calculatedWeeklyCost || 0,
    'Period': `${period}`,
  }))
}

async function generateReconciliationReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
    },
    orderBy: {
      invoiceDate: 'asc',
    },
  })

  // Get calculated costs for the same period
  const calculatedCosts = await prisma.storageLedger.groupBy({
    by: ['warehouseId'],
    where: {
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
    },
    _sum: {
      calculatedWeeklyCost: true,
    },
  })

  const costMap = new Map<string, number>(
    calculatedCosts.map(c => [c.warehouseId, Number(c._sum.calculatedWeeklyCost || 0)])
  )

  return invoices.map(invoice => ({
    'Invoice Number': invoice.invoiceNumber,
    'Invoice Date': invoice.invoiceDate.toLocaleDateString(),
    'Warehouse': invoice.warehouse.name,
    'Invoiced Amount': `£${Number(invoice.totalAmount).toFixed(2)}`,
    'Calculated Amount': `£${(costMap.get(invoice.warehouseId) || 0).toFixed(2)}`,
    'Variance': `£${(Number(invoice.totalAmount) - (costMap.get(invoice.warehouseId) || 0)).toFixed(2)}`,
    'Status': Math.abs(Number(invoice.totalAmount) - (costMap.get(invoice.warehouseId) || 0)) < 0.01 ? 'Matched' : 'Variance',
  }))
}

async function generateInventoryBalanceReport(warehouseId?: string) {
  const data = await prisma.inventoryBalance.findMany({
    where: warehouseId ? { warehouseId } : {},
    include: {
      warehouse: true,
      sku: true,
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
    ],
  })

  return data.map(balance => ({
    'Warehouse': balance.warehouse.name,
    'SKU Code': balance.sku.skuCode,
    'SKU Description': balance.sku.description,
    'Batch/Lot': balance.batchLot,
    'Cartons': balance.currentCartons,
    'Pallets': balance.currentPallets,
    'Units': balance.currentUnits,
    'Last Transaction': balance.lastTransactionDate?.toLocaleDateString() || 'N/A',
    'Days Since Last Activity': balance.lastTransactionDate 
      ? Math.floor((new Date().getTime() - balance.lastTransactionDate.getTime()) / (1000 * 60 * 60 * 24))
      : 'N/A',
  }))
}

async function generateLowStockReport(warehouseId?: string) {
  const data = await prisma.inventoryBalance.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      currentCartons: {
        lt: 10, // Low stock threshold
      }
    },
    include: {
      warehouse: true,
      sku: true,
    },
    orderBy: [
      { currentCartons: 'asc' },
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
    ],
  })

  return data.map(balance => ({
    'Warehouse': balance.warehouse.name,
    'SKU Code': balance.sku.skuCode,
    'SKU Description': balance.sku.description,
    'Batch/Lot': balance.batchLot,
    'Current Stock': balance.currentCartons,
    'Status': balance.currentCartons === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
    'Days Since Last Receipt': balance.lastTransactionDate 
      ? Math.floor((new Date().getTime() - balance.lastTransactionDate.getTime()) / (1000 * 60 * 60 * 24))
      : 'N/A',
    'Action Required': balance.currentCartons === 0 ? 'URGENT - Reorder immediately' : 'Reorder soon',
  }))
}

async function generateCostAnalysisReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const storageCosts = await prisma.storageLedger.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
    },
    include: {
      warehouse: true,
      sku: true,
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
    ],
  })

  const grouped = storageCosts.reduce((acc, item) => {
    const key = `${item.warehouseId}-${item.skuId}`
    if (!acc[key]) {
      acc[key] = {
        warehouse: item.warehouse.name,
        sku: item.sku.skuCode,
        description: item.sku.description,
        totalCartons: 0,
        totalCost: 0,
        weeks: 0,
      }
    }
    acc[key].totalCartons += item.storagePalletsCharged || 0
    acc[key].totalCost += Number(item.calculatedWeeklyCost || 0)
    acc[key].weeks += 1
    return acc
  }, {} as any)

  return Object.values(grouped).map((item: any) => ({
    'Warehouse': item.warehouse,
    'SKU Code': item.sku,
    'Description': item.description,
    'Average Cartons': Math.round(item.totalCartons / item.weeks),
    'Total Storage Cost': `£${item.totalCost.toFixed(2)}`,
    'Average Weekly Cost': `£${(item.totalCost / item.weeks).toFixed(2)}`,
    'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
  }))
}

async function generateMonthlyBillingReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const billingStart = new Date(year, month - 2, 16)
  const billingEnd = new Date(year, month - 1, 15)

  // Get all warehouses (excluding Amazon FBA)
  const warehouses = warehouseId 
    ? await prisma.warehouse.findMany({ where: { id: warehouseId } })
    : await prisma.warehouse.findMany({
        where: {
          NOT: {
            OR: [
              { code: 'AMZN' },
              { code: 'AMZN-UK' }
            ]
          }
        }
      })

  const billingData = await Promise.all(
    warehouses.map(async (warehouse) => {
      // Storage costs
      const storageCost = await prisma.storageLedger.aggregate({
        where: {
          warehouseId: warehouse.id,
          billingPeriodStart: billingStart,
          billingPeriodEnd: billingEnd,
        },
        _sum: {
          calculatedWeeklyCost: true,
        },
      })

      // Transaction counts
      const transactions = await prisma.inventoryTransaction.groupBy({
        by: ['transactionType'],
        where: {
          warehouseId: warehouse.id,
          transactionDate: {
            gte: billingStart,
            lte: billingEnd,
          },
        },
        _count: true,
      })

      const receiveCount = transactions.find(t => t.transactionType === 'RECEIVE')?._count || 0
      const shipCount = transactions.find(t => t.transactionType === 'SHIP')?._count || 0

      return {
        'Warehouse': warehouse.name,
        'Storage Costs': `£${Number(storageCost._sum.calculatedWeeklyCost || 0).toFixed(2)}`,
        'Receiving Transactions': receiveCount,
        'Shipping Transactions': shipCount,
        'Handling Fees': `£${((receiveCount + shipCount) * 25).toFixed(2)}`, // £25 per transaction
        'Total Charges': `£${(Number(storageCost._sum.calculatedWeeklyCost || 0) + ((receiveCount + shipCount) * 25)).toFixed(2)}`,
        'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`,
      }
    })
  )

  return billingData
}

async function generateAnalyticsSummaryReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))
  const prevStartDate = startOfMonth(subMonths(startDate, 1))
  const prevEndDate = endOfMonth(subMonths(startDate, 1))

  // Current period metrics
  const currentMetrics = await getMetricsForPeriod(startDate, endDate, warehouseId)
  // Previous period metrics for comparison
  const previousMetrics = await getMetricsForPeriod(prevStartDate, prevEndDate, warehouseId)

  const warehouses = warehouseId 
    ? await prisma.warehouse.findMany({ where: { id: warehouseId } })
    : await prisma.warehouse.findMany({
        where: {
          NOT: {
            OR: [
              { code: 'AMZN' },
              { code: 'AMZN-UK' }
            ]
          }
        }
      })

  const analyticsData = await Promise.all(
    warehouses.map(async (warehouse) => {
      const currentWarehouseMetrics = currentMetrics.get(warehouse.id) || {}
      const previousWarehouseMetrics = previousMetrics.get(warehouse.id) || {}

      const inventoryTurnover = currentWarehouseMetrics.shipments && currentWarehouseMetrics.avgInventory
        ? (currentWarehouseMetrics.shipments / currentWarehouseMetrics.avgInventory) * 12
        : 0

      const growthRate = previousWarehouseMetrics.totalTransactions
        ? ((currentWarehouseMetrics.totalTransactions - previousWarehouseMetrics.totalTransactions) / previousWarehouseMetrics.totalTransactions) * 100
        : 0

      return {
        'Warehouse': warehouse.name,
        'Total Transactions': currentWarehouseMetrics.totalTransactions || 0,
        'Growth Rate': `${growthRate.toFixed(1)}%`,
        'Avg Inventory (Cartons)': Math.round(currentWarehouseMetrics.avgInventory || 0),
        'Inventory Turnover': inventoryTurnover.toFixed(2),
        'Storage Utilization': `${((currentWarehouseMetrics.avgInventory || 0) / 10000 * 100).toFixed(1)}%`,
        'Total SKUs': currentWarehouseMetrics.totalSkus || 0,
        'Active SKUs': currentWarehouseMetrics.activeSkus || 0,
        'Period': format(startDate, 'MMMM yyyy'),
      }
    })
  )

  return analyticsData
}

async function generatePerformanceMetricsReport(period: string, warehouseId?: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))

  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
    },
  })

  // Group by warehouse and calculate metrics
  const warehouseMetrics = transactions.reduce((acc, trans) => {
    if (!acc[trans.warehouseId]) {
      acc[trans.warehouseId] = {
        warehouseName: trans.warehouse.name,
        totalTransactions: 0,
        receiveTransactions: 0,
        shipTransactions: 0,
        totalCartonsReceived: 0,
        totalCartonsShipped: 0,
        uniqueSkus: new Set(),
        transactionDates: [],
      }
    }

    const metrics = acc[trans.warehouseId]
    metrics.totalTransactions++
    
    if (trans.transactionType === 'RECEIVE') {
      metrics.receiveTransactions++
      metrics.totalCartonsReceived += trans.cartonsIn
    } else if (trans.transactionType === 'SHIP') {
      metrics.shipTransactions++
      metrics.totalCartonsShipped += trans.cartonsOut
    }
    
    metrics.uniqueSkus.add(trans.skuId)
    metrics.transactionDates.push(trans.transactionDate)

    return acc
  }, {} as any)

  return Object.values(warehouseMetrics).map((metrics: any) => {
    const avgTransactionsPerDay = metrics.totalTransactions / 30
    const receiveToShipRatio = metrics.shipTransactions > 0 
      ? (metrics.receiveTransactions / metrics.shipTransactions).toFixed(2)
      : 'N/A'

    return {
      'Warehouse': metrics.warehouseName,
      'Total Transactions': metrics.totalTransactions,
      'Avg Daily Transactions': avgTransactionsPerDay.toFixed(1),
      'Receive Transactions': metrics.receiveTransactions,
      'Ship Transactions': metrics.shipTransactions,
      'Receive/Ship Ratio': receiveToShipRatio,
      'Total Cartons Received': metrics.totalCartonsReceived,
      'Total Cartons Shipped': metrics.totalCartonsShipped,
      'Unique SKUs Handled': metrics.uniqueSkus.size,
      'Period': format(startDate, 'MMMM yyyy'),
    }
  })
}

async function getMetricsForPeriod(startDate: Date, endDate: Date, warehouseId?: string) {
  const transactions = await prisma.inventoryTransaction.groupBy({
    by: ['warehouseId', 'transactionType'],
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: true,
    _sum: {
      cartonsIn: true,
      cartonsOut: true,
    },
  })

  const inventoryStats = await prisma.inventoryBalance.groupBy({
    by: ['warehouseId'],
    where: warehouseId ? { warehouseId } : {},
    _avg: {
      currentCartons: true,
    },
    _count: {
      skuId: true,
    },
  })

  const activeSkus = await prisma.inventoryBalance.groupBy({
    by: ['warehouseId'],
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      currentCartons: { gt: 0 },
    },
    _count: {
      skuId: true,
    },
  })

  const metrics = new Map()

  // Process transactions
  transactions.forEach(t => {
    if (!metrics.has(t.warehouseId)) {
      metrics.set(t.warehouseId, {})
    }
    const m = metrics.get(t.warehouseId)
    
    m.totalTransactions = (m.totalTransactions || 0) + t._count
    if (t.transactionType === 'SHIP') {
      m.shipments = (m.shipments || 0) + (t._sum.cartonsOut || 0)
    }
  })

  // Process inventory stats
  inventoryStats.forEach(stat => {
    if (!metrics.has(stat.warehouseId)) {
      metrics.set(stat.warehouseId, {})
    }
    const m = metrics.get(stat.warehouseId)
    m.avgInventory = stat._avg.currentCartons || 0
    m.totalSkus = stat._count.skuId
  })

  // Process active SKUs
  activeSkus.forEach(stat => {
    if (!metrics.has(stat.warehouseId)) {
      metrics.set(stat.warehouseId, {})
    }
    const m = metrics.get(stat.warehouseId)
    m.activeSkus = stat._count.skuId
  })

  return metrics
}

function generateCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvRows = []
  
  // Add headers
  csvRows.push(headers.join(','))
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvRows.push(values.join(','))
  }
  
  return csvRows.join('\n')
}

async function generatePDF(data: any[], reportType: string, period: string): Promise<Buffer> {
  const doc = new jsPDF()
  
  // Add title
  const title = reportType.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
  
  doc.setFontSize(20)
  doc.text(title, 14, 22)
  
  // Add period
  doc.setFontSize(12)
  doc.text(`Period: ${period}`, 14, 32)
  
  // Add generation date
  doc.setFontSize(10)
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 40)
  
  // Add table
  if (data.length > 0) {
    const headers = Object.keys(data[0])
    const rows = data.map(item => headers.map(header => String(item[header])))
    
    ;(doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 133, 244] },
    })
  }
  
  return Buffer.from(doc.output('arraybuffer'))
}