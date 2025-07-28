import { BaseService, ServiceContext } from './base.service'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { businessLogger, perfLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

export interface ReportParams {
  reportType: string
  period?: string
  warehouseId?: string
  format?: 'xlsx' | 'csv' | 'pdf'
}

export class ReportService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * Generate report based on type and parameters
   */
  async generateReport(params: ReportParams) {
    const startTime = Date.now()
    
    try {
      await this.requirePermission('report:generate')

      let data: any[] = []
      let fileName = ''

      switch (params.reportType) {
        case 'monthly-inventory':
          data = await this.generateMonthlyInventoryReport(params.period!, params.warehouseId)
          fileName = `monthly_inventory_${params.period}`
          break
          
        case 'inventory-ledger':
          data = await this.generateInventoryLedger(params.period!, params.warehouseId)
          fileName = `inventory_ledger_${params.period}`
          break
          
        case 'storage-charges':
          data = await this.generateStorageCharges(params.period!, params.warehouseId)
          fileName = `storage_charges_${params.period}`
          break
          
        case 'cost-summary':
          data = await this.generateCostSummary(params.period!, params.warehouseId)
          fileName = `cost_summary_${params.period}`
          break

        case 'reconciliation':
          data = await this.generateReconciliationReport(params.period!, params.warehouseId)
          fileName = `reconciliation_${params.period}`
          break

        case 'inventory-balance':
          data = await this.generateInventoryBalanceReport(params.warehouseId)
          fileName = `inventory_balance_${new Date().toISOString().split('T')[0]}`
          break

        case 'low-stock':
          data = await this.generateLowStockReport(params.warehouseId)
          fileName = `low_stock_${new Date().toISOString().split('T')[0]}`
          break

        case 'cost-analysis':
          data = await this.generateCostAnalysisReport(params.period!, params.warehouseId)
          fileName = `cost_analysis_${params.period}`
          break

        case 'monthly-billing':
          data = await this.generateMonthlyBillingReport(params.period!, params.warehouseId)
          fileName = `monthly_billing_${params.period}`
          break

        case 'analytics-summary':
          data = await this.generateAnalyticsSummaryReport(params.period!, params.warehouseId)
          fileName = `analytics_summary_${params.period}`
          break

        case 'performance-metrics':
          data = await this.generatePerformanceMetricsReport(params.period!, params.warehouseId)
          fileName = `performance_metrics_${params.period}`
          break
          
        default:
          throw new Error('Invalid report type')
      }

      const duration = Date.now() - startTime
      
      await this.logAudit('REPORT_GENERATED', 'Report', params.reportType, {
        reportType: params.reportType,
        period: params.period,
        warehouseId: params.warehouseId,
        format: params.format,
        recordCount: data.length
      })

      perfLogger.log('Report generated', {
        reportType: params.reportType,
        recordCount: data.length,
        duration
      })

      // Generate file based on format
      const outputFormat = params.format || 'xlsx'
      let fileBuffer: Buffer
      let contentType: string
      
      if (outputFormat === 'pdf') {
        fileBuffer = await this.generatePDF(data, params.reportType, params.period || 'current')
        contentType = 'application/pdf'
      } else if (outputFormat === 'csv') {
        const csv = this.generateCSV(data)
        fileBuffer = Buffer.from(csv)
        contentType = 'text/csv'
      } else {
        // Default to Excel
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, 'Report')
        fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      return {
        fileName: `${fileName}.${outputFormat}`,
        contentType,
        buffer: fileBuffer
      }
    } catch (error) {
      this.handleError(error, 'generateReport')
    }
  }

  /**
   * Report generation methods
   */
  private async generateMonthlyInventoryReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    // Since inventory_balances table was removed, return empty data
    // In production, this would calculate from transactions
    const balances: any[] = []

    return balances.map(b => ({
      'Warehouse': b.warehouses.name,
      'SKU Code': b.skus.sku_code,
      'Description': b.skus.description,
      'Batch/Lot': b.batch_lot,
      'Current Cartons': b.current_cartons,
      'Current Pallets': b.current_pallets,
      'Units per Carton (Current)': b.skus.units_per_carton,
      'Total Units': b.current_units,
      'Report Date': new Date().toLocaleDateString()
    }))
  }

  private async generateInventoryLedger(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    const where: Prisma.InventoryTransactionWhereInput = {
      ...(warehouseId 
        ? { warehouseId: warehouseId } 
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
      transaction_date: {
        gte: startDate,
        lte: endDate
      }
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        created_by: true
      },
      orderBy: { transaction_date: 'desc' }
    })

    return transactions.map(t => ({
      'Date': new Date(t.transaction_date).toLocaleDateString(),
      'Transaction ID': t.transaction_id,
      'Warehouse': t.warehouse.name,
      'SKU': t.sku.sku_code,
      'Batch/Lot': t.batch_lot,
      'Type': t.transaction_type,
      'Reference': t.reference_id || '',
      'Cartons In': t.cartons_in,
      'Cartons Out': t.cartons_out,
      'Units per Carton': t.units_per_carton || t.sku.units_per_carton,
      'Units In': t.cartons_in * (t.units_per_carton || t.sku.units_per_carton || 1),
      'Units Out': t.cartons_out * (t.units_per_carton || t.sku.units_per_carton || 1),
      'Created By': t.created_by.full_name
    }))
  }

  private async generateStorageCharges(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    
    // Billing periods run from 16th to 15th
    const billingStart = new Date(year, month - 2, 16)
    const billingEnd = new Date(year, month - 1, 15)

    const where: Prisma.StorageLedgerWhereInput = {
      ...(warehouseId 
        ? { warehouseId: warehouseId } 
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
      billing_period_start: billingStart,
      billing_period_end: billingEnd
    }

    const storageLedger = await this.prisma.storageLedger.findMany({
      where,
      include: {
        warehouses: true,
        skus: true
      },
      orderBy: [
        { warehouses: { name: 'asc' } },
        { week_ending_date: 'asc' },
        { skus: { sku_code: 'asc' } }
      ]
    })

    return storageLedger.map(s => ({
      'Week Ending': new Date(s.week_ending_date).toLocaleDateString(),
      'Warehouse': s.warehouse.name,
      'SKU': s.sku.sku_code,
      'Batch/Lot': s.batch_lot,
      'Cartons (Monday)': s.cartons_end_of_monday,
      'Pallets Charged': s.storage_pallets_charged,
      'Weekly Rate': s.applicable_weekly_rate,
      'Weekly Cost': s.calculated_weekly_cost,
      'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`
    }))
  }

  private async generateCostSummary(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    
    // Get storage costs
    const storageCosts = await this.prisma.storageLedger.groupBy({
      by: ['warehouseId'],
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        billing_period_start: new Date(year, month - 2, 16),
        billing_period_end: new Date(year, month - 1, 15)
      },
      _sum: {
        calculated_weekly_cost: true
      }
    })

    // Get warehouse names (excluding Amazon FBA)
    const warehouses = await this.prisma.warehouse.findMany({
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
      'Storage Costs': cost._sum.calculated_weekly_cost || 0,
      'Handling Costs': 0, // To be calculated from calculated_costs table
      'Other Costs': 0, // To be calculated
      'Total Costs': cost._sum.calculated_weekly_cost || 0,
      'Period': `${period}`
    }))
  }

  private async generateReconciliationReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 2, 16)
    const endDate = new Date(year, month - 1, 15)

    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        invoice_date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        warehouses: true
      },
      orderBy: {
        invoice_date: 'asc'
      }
    })

    // Get calculated costs for the same period
    const calculatedCosts = await this.prisma.storageLedger.groupBy({
      by: ['warehouseId'],
      where: {
        billing_period_start: startDate,
        billing_period_end: endDate
      },
      _sum: {
        calculated_weekly_cost: true
      }
    })

    const costMap = new Map<string, number>(
      calculatedCosts.map(c => [c.warehouseId, Number(c._sum.calculated_weekly_cost || 0)])
    )

    return invoices.map(invoice => ({
      'Invoice Number': invoice.invoice_number,
      'Invoice Date': invoice.invoice_date.toLocaleDateString(),
      'Warehouse': invoice.warehouses.name,
      'Invoiced Amount': `£${Number(invoice.total_amount).toFixed(2)}`,
      'Calculated Amount': `£${(costMap.get(invoice.warehouse_id) || 0).toFixed(2)}`,
      'Variance': `£${(Number(invoice.total_amount) - (costMap.get(invoice.warehouse_id) || 0)).toFixed(2)}`,
      'Status': Math.abs(Number(invoice.total_amount) - (costMap.get(invoice.warehouse_id) || 0)) < 0.01 ? 'Matched' : 'Variance'
    }))
  }

  private async generateInventoryBalanceReport(warehouseId?: string) {
    // inventory_balances table removed - returning empty data
    const data: any[] = []
    return data
  }

  private async generateLowStockReport(warehouseId?: string) {
    // inventory_balances table removed - returning empty data
    const data: any[] = []
    return data
  }

  private async generateCostAnalysisReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 2, 16)
    const endDate = new Date(year, month - 1, 15)

    const storageCosts = await this.prisma.storageLedger.findMany({
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        billing_period_start: startDate,
        billing_period_end: endDate
      },
      include: {
        warehouses: true,
        skus: true
      },
      orderBy: [
        { warehouses: { name: 'asc' } },
        { skus: { sku_code: 'asc' } }
      ]
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
          weeks: 0
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
      'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
    }))
  }

  private async generateMonthlyBillingReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const billingStart = new Date(year, month - 2, 16)
    const billingEnd = new Date(year, month - 1, 15)

    // Get all warehouses (excluding Amazon FBA)
    const warehouses = warehouseId 
      ? await this.prisma.warehouse.findMany({ where: { id: warehouse_id } })
      : await this.prisma.warehouse.findMany({
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
        const storageCost = await this.prisma.storageLedger.aggregate({
          where: {
            warehouseId: warehouse.id,
            billing_period_start: billingStart,
            billing_period_end: billingEnd
          },
          _sum: {
            calculated_weekly_cost: true
          }
        })

        // Transaction counts
        const transactions = await this.prisma.inventoryTransaction.groupBy({
          by: ['transaction_type'],
          where: {
            warehouseId: warehouse.id,
            transaction_date: {
              gte: billingStart,
              lte: billingEnd
            }
          },
          _count: true
        })

        const receiveCount = transactions.find(t => t.transaction_type === 'RECEIVE')?._count || 0
        const shipCount = transactions.find(t => t.transaction_type === 'SHIP')?._count || 0

        return {
          'Warehouse': warehouse.name,
          'Storage Costs': `£${Number(storageCost._sum.calculated_weekly_cost || 0).toFixed(2)}`,
          'Receiving Transactions': receiveCount,
          'Shipping Transactions': shipCount,
          'Handling Fees': `£${((receiveCount + shipCount) * 25).toFixed(2)}`, // £25 per transaction
          'Total Charges': `£${(Number(storageCost._sum.calculated_weekly_cost || 0) + ((receiveCount + shipCount) * 25)).toFixed(2)}`,
          'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`
        }
      })
    )

    return billingData
  }

  private async generateAnalyticsSummaryReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))
    const prevStartDate = startOfMonth(subMonths(startDate, 1))
    const prevEndDate = endOfMonth(subMonths(startDate, 1))

    // Current period metrics
    const currentMetrics = await this.getMetricsForPeriod(startDate, endDate, warehouseId)
    // Previous period metrics for comparison
    const previousMetrics = await this.getMetricsForPeriod(prevStartDate, prevEndDate, warehouseId)

    const warehouses = warehouseId 
      ? await this.prisma.warehouse.findMany({ where: { id: warehouse_id } })
      : await this.prisma.warehouse.findMany({
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
          'Period': format(startDate, 'MMMM yyyy')
        }
      })
    )

    return analyticsData
  }

  private async generatePerformanceMetricsReport(period: string, warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        transaction_date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        warehouses: true
      }
    })

    // Group by warehouse and calculate metrics
    const warehouseMetrics = transactions.reduce((acc, trans) => {
      if (!acc[trans.warehouse_id]) {
        acc[trans.warehouse_id] = {
          warehouseName: trans.warehouse.name,
          totalTransactions: 0,
          receiveTransactions: 0,
          shipTransactions: 0,
          totalCartonsReceived: 0,
          totalCartonsShipped: 0,
          uniqueSkus: new Set(),
          transaction_dates: []
        }
      }

      const metrics = acc[trans.warehouse_id]
      metrics.totalTransactions++
      
      if (trans.transaction_type === 'RECEIVE') {
        metrics.receiveTransactions++
        metrics.totalCartonsReceived += trans.cartons_in
      } else if (trans.transaction_type === 'SHIP') {
        metrics.shipTransactions++
        metrics.totalCartonsShipped += trans.cartons_out
      }
      
      metrics.uniqueSkus.add(trans.sku_id)
      metrics.transaction_dates.push(trans.transaction_date)

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
        'Period': format(startDate, 'MMMM yyyy')
      }
    })
  }

  /**
   * Helper methods
   */
  private async getMetricsForPeriod(startDate: Date, endDate: Date, warehouseId?: string) {
    const transactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['warehouse_id', 'transaction_type'],
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        transaction_date: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: true,
      _sum: {
        cartons_in: true,
        cartons_out: true
      }
    })

    // inventory_balances removed - using empty arrays
    const inventoryStats: any[] = []
    const activeSkus: any[] = []

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

    // Process inventory stats (empty for now)
    inventoryStats.forEach(stat => {
      if (!metrics.has(stat.warehouseId)) {
        metrics.set(stat.warehouseId, {})
      }
      const m = metrics.get(stat.warehouseId)
      m.avgInventory = stat._avg.currentCartons || 0
      m.totalSkus = stat._count.skuId
    })

    // Process active SKUs (empty for now)
    activeSkus.forEach(stat => {
      if (!metrics.has(stat.warehouseId)) {
        metrics.set(stat.warehouseId, {})
      }
      const m = metrics.get(stat.warehouseId)
      m.activeSkus = stat._count.skuId
    })

    return metrics
  }

  private generateCSV(data: any[]): string {
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

  private async generatePDF(data: any[], reportType: string, period: string): Promise<Buffer> {
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
        headStyles: { fillColor: [66, 133, 244] }
      })
    }
    
    return Buffer.from(doc.output('arraybuffer'))
  }
}