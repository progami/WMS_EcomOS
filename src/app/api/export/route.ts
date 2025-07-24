import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
export const dynamic = 'force-dynamic'

// GET /api/export - Export data to Excel
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const exportType = searchParams.get('type') || 'all'
    const warehouseId = searchParams.get('warehouseId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add sheets based on export type
    switch (exportType) {
      case 'invoices':
        await addInvoicesSheet(wb, { warehouseId, startDate, endDate })
        break
      case 'inventory':
        await addInventorySheet(wb, { warehouseId })
        break
      case 'transactions':
        await addTransactionsSheet(wb, { warehouseId, startDate, endDate })
        break
      case 'reconciliation':
        await addReconciliationSheet(wb, { warehouseId, startDate, endDate })
        break
      case 'costs':
        await addCostsSheet(wb, { warehouseId, startDate, endDate })
        break
      case 'all':
      default:
        await addInvoicesSheet(wb, { warehouseId, startDate, endDate })
        await addInventorySheet(wb, { warehouseId })
        await addTransactionsSheet(wb, { warehouseId, startDate, endDate })
        await addReconciliationSheet(wb, { warehouseId, startDate, endDate })
        await addCostsSheet(wb, { warehouseId, startDate, endDate })
        break
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `warehouse-export-${exportType}-${timestamp}.xlsx`

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    // console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

async function addInvoicesSheet(wb: XLSX.WorkBook, filters: any) {
  const where: any = {}
  
  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId
  }
  
  if (filters.startDate || filters.endDate) {
    where.invoiceDate = {}
    if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate)
    if (filters.endDate) where.invoiceDate.lte = new Date(filters.endDate)
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      warehouse: true,
      lineItems: true,
      reconciliations: true
    },
    orderBy: { invoiceDate: 'desc' }
  })

  // Prepare invoice summary data
  const invoiceData = invoices.map(inv => ({
    'Invoice Number': inv.invoiceNumber,
    'Warehouse': inv.warehouse.name,
    'Billing Period Start': inv.billingPeriodStart.toISOString().split('T')[0],
    'Billing Period End': inv.billingPeriodEnd.toISOString().split('T')[0],
    'Invoice Date': inv.invoiceDate.toISOString().split('T')[0],
    'Due Date': inv.dueDate?.toISOString().split('T')[0] || '',
    'Total Amount': Number(inv.totalAmount),
    'Status': inv.status,
    'Line Items': inv.lineItems.length,
    'Reconciliation Items': inv.reconciliations.length,
    'Matched': inv.reconciliations.filter(r => r.status === 'match').length,
    'Overbilled': inv.reconciliations.filter(r => r.status === 'overbilled').length,
    'Underbilled': inv.reconciliations.filter(r => r.status === 'underbilled').length,
    'Total Difference': inv.reconciliations.reduce((sum, r) => sum + Number(r.difference), 0)
  }))

  const ws = XLSX.utils.json_to_sheet(invoiceData)
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')

  // Add line items sheet
  const allLineItems = invoices.flatMap(inv => 
    inv.lineItems.map(item => ({
      'Invoice Number': inv.invoiceNumber,
      'Warehouse': inv.warehouse.name,
      'Cost Category': item.costCategory,
      'Cost Name': item.costName,
      'Quantity': Number(item.quantity),
      'Unit Rate': item.unitRate ? Number(item.unitRate) : '',
      'Amount': Number(item.amount)
    }))
  )

  if (allLineItems.length > 0) {
    const wsLineItems = XLSX.utils.json_to_sheet(allLineItems)
    XLSX.utils.book_append_sheet(wb, wsLineItems, 'Invoice Line Items')
  }
}

async function addInventorySheet(wb: XLSX.WorkBook, filters: any) {
  const where: any = {}
  
  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId
  }

  const inventory = await prisma.inventoryBalance.findMany({
    where,
    include: {
      warehouse: true,
      sku: true
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
      { batchLot: 'asc' }
    ]
  })

  const inventoryData = inventory.map(inv => ({
    'Warehouse': inv.warehouse.name,
    'SKU Code': inv.sku.skuCode,
    'Description': inv.sku.description,
    'Batch/Lot': inv.batchLot,
    'Current Cartons': inv.currentCartons,
    'Current Pallets': inv.currentPallets,
    'Current Units': inv.currentUnits,
    'Units per Carton': inv.sku.unitsPerCarton,
    'Total Units': inv.currentUnits,
    'Last Transaction': inv.lastTransactionDate?.toISOString().split('T')[0] || '',
    'Last Updated': inv.lastUpdated.toISOString().split('T')[0]
  }))

  const ws = XLSX.utils.json_to_sheet(inventoryData)
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
}

async function addTransactionsSheet(wb: XLSX.WorkBook, filters: any) {
  const where: any = {}
  
  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId
  }
  
  if (filters.startDate || filters.endDate) {
    where.transactionDate = {}
    if (filters.startDate) where.transactionDate.gte = new Date(filters.startDate)
    if (filters.endDate) where.transactionDate.lte = new Date(filters.endDate)
  }

  const transactions = await prisma.inventoryTransaction.findMany({
    where,
    include: {
      warehouse: true,
      sku: true,
      createdBy: {
        select: {
          fullName: true,
          email: true
        }
      }
    },
    orderBy: { transactionDate: 'desc' },
    take: 10000 // Limit to prevent huge exports
  })

  const transactionData = transactions.map(tx => ({
    'Transaction ID': tx.transactionId,
    'Date': tx.transactionDate.toISOString().split('T')[0],
    'Warehouse': tx.warehouse.name,
    'SKU': tx.sku.skuCode,
    'Description': tx.sku.description,
    'Batch/Lot': tx.batchLot,
    'Type': tx.transactionType,
    'Reference': tx.referenceId || '',
    'Cartons In': tx.cartonsIn,
    'Cartons Out': tx.cartonsOut,
    'Units per Carton': tx.unitsPerCarton || tx.sku.unitsPerCarton,
    'Units In': tx.cartonsIn * (tx.unitsPerCarton || tx.sku.unitsPerCarton || 1),
    'Units Out': tx.cartonsOut * (tx.unitsPerCarton || tx.sku.unitsPerCarton || 1),
    'Storage Pallets In': tx.storagePalletsIn,
    'Shipping Pallets Out': tx.shippingPalletsOut,
    'Created By': tx.createdBy.fullName,
    'Created At': tx.createdAt.toISOString()
  }))

  const ws = XLSX.utils.json_to_sheet(transactionData)
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
}

async function addReconciliationSheet(wb: XLSX.WorkBook, filters: any) {
  const where: any = {}
  
  if (filters.warehouseId) {
    where.invoice = { warehouseId: filters.warehouseId }
  }
  
  if (filters.startDate || filters.endDate) {
    where.invoice = {
      ...where.invoice,
      invoiceDate: {}
    }
    if (filters.startDate) where.invoice.invoiceDate.gte = new Date(filters.startDate)
    if (filters.endDate) where.invoice.invoiceDate.lte = new Date(filters.endDate)
  }

  const reconciliations = await prisma.invoiceReconciliation.findMany({
    where,
    include: {
      invoice: {
        include: {
          warehouse: true
        }
      },
      resolvedBy: {
        select: {
          fullName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const reconciliationData = reconciliations.map(rec => ({
    'Invoice Number': rec.invoice.invoiceNumber,
    'Warehouse': rec.invoice.warehouse.name,
    'Invoice Date': rec.invoice.invoiceDate.toISOString().split('T')[0],
    'Cost Category': rec.costCategory,
    'Cost Name': rec.costName,
    'Expected Amount': Number(rec.expectedAmount),
    'Invoiced Amount': Number(rec.invoicedAmount),
    'Difference': Number(rec.difference),
    'Status': rec.status,
    'Resolution Notes': rec.resolutionNotes || '',
    'Resolved By': rec.resolvedBy?.fullName || '',
    'Resolved At': rec.resolvedAt?.toISOString() || '',
    'Created At': rec.createdAt.toISOString()
  }))

  const ws = XLSX.utils.json_to_sheet(reconciliationData)
  XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation')
}

async function addCostsSheet(wb: XLSX.WorkBook, filters: any) {
  const where: any = {}
  
  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId
  }
  
  if (filters.startDate || filters.endDate) {
    where.billingPeriodStart = {}
    if (filters.startDate) where.billingPeriodStart.gte = new Date(filters.startDate)
    if (filters.endDate) where.billingPeriodStart.lte = new Date(filters.endDate)
  }

  const calculatedCosts = await prisma.calculatedCost.findMany({
    where,
    include: {
      warehouse: true,
      sku: true,
      costRate: true
    },
    orderBy: { transactionDate: 'desc' },
    take: 10000 // Limit to prevent huge exports
  })

  const costData = calculatedCosts.map(cost => ({
    'Cost ID': cost.calculatedCostId,
    'Transaction Type': cost.transactionType,
    'Transaction Ref': cost.transactionReferenceId,
    'Warehouse': cost.warehouse.name,
    'SKU': cost.sku.skuCode,
    'Description': cost.sku.description,
    'Batch/Lot': cost.batchLot || '',
    'Transaction Date': cost.transactionDate.toISOString().split('T')[0],
    'Billing Period Start': cost.billingPeriodStart.toISOString().split('T')[0],
    'Billing Period End': cost.billingPeriodEnd.toISOString().split('T')[0],
    'Cost Category': cost.costRate.costCategory,
    'Cost Name': cost.costRate.costName,
    'Quantity Charged': Number(cost.quantityCharged),
    'Rate': Number(cost.applicableRate),
    'Calculated Cost': Number(cost.calculatedCost),
    'Adjustment': Number(cost.costAdjustmentValue),
    'Final Cost': Number(cost.finalExpectedCost)
  }))

  const ws = XLSX.utils.json_to_sheet(costData)
  XLSX.utils.book_append_sheet(wb, ws, 'Calculated Costs')

  // Add cost rates sheet
  const costRates = await prisma.costRate.findMany({
    where: filters.warehouseId ? { warehouseId: filters.warehouseId } : {},
    include: {
      warehouse: true
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { costCategory: 'asc' },
      { costName: 'asc' },
      { effectiveDate: 'desc' }
    ]
  })

  const rateData = costRates.map(rate => ({
    'Warehouse': rate.warehouse.name,
    'Cost Category': rate.costCategory,
    'Cost Name': rate.costName,
    'Cost Value': Number(rate.costValue),
    'Unit of Measure': rate.unitOfMeasure,
    'Effective Date': rate.effectiveDate.toISOString().split('T')[0],
    'End Date': rate.endDate?.toISOString().split('T')[0] || 'Current'
  }))

  const wsRates = XLSX.utils.json_to_sheet(rateData)
  XLSX.utils.book_append_sheet(wb, wsRates, 'Cost Rates')
}