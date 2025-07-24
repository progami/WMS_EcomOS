import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWarehouseFilter } from '@/lib/auth-utils'
import { Money, parseMoney, calculateReconciliationDifference } from '@/lib/financial-utils'
import { prisma } from '@/lib/prisma'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
export const dynamic = 'force-dynamic'

interface InvoiceUploadData {
  invoiceNumber: string
  warehouseCode: string
  billingPeriodStart: string
  billingPeriodEnd: string
  invoiceDate: string
  dueDate?: string
  totalAmount: number
  lineItems: Array<{
    costCategory: string
    costName: string
    quantity: number
    unitRate?: number
    amount: number
  }>
}

// POST /api/invoices/upload - Upload invoice file
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('fileType') as string || 'auto'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let invoiceData: InvoiceUploadData | null = null

    // Determine file type and parse accordingly
    const fileName = file.name.toLowerCase()
    
    if (fileType === 'csv' || fileName.endsWith('.csv')) {
      invoiceData = await parseCSV(buffer)
    } else if (fileType === 'excel' || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      invoiceData = await parseExcel(buffer)
    } else if (fileType === 'pdf' || fileName.endsWith('.pdf')) {
      // For PDF, we'll need to implement OCR or manual data entry
      return NextResponse.json(
        { 
          error: 'PDF upload requires manual data entry',
          requiresManualEntry: true,
          fileName: file.name
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload CSV, Excel, or PDF files.' },
        { status: 400 }
      )
    }

    if (!invoiceData) {
      return NextResponse.json(
        { error: 'Failed to parse invoice data' },
        { status: 400 }
      )
    }

    // Validate warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { code: invoiceData.warehouseCode }
    })

    if (!warehouse) {
      return NextResponse.json(
        { error: `Warehouse with code ${invoiceData.warehouseCode} not found` },
        { status: 400 }
      )
    }

    // Validate warehouse access
    const warehouseFilter = getWarehouseFilter(session, warehouse.id)
    if (warehouseFilter === null || (warehouseFilter.warehouseId && warehouseFilter.warehouseId !== warehouse.id)) {
      return NextResponse.json(
        { error: 'Access denied to this warehouse' },
        { status: 403 }
      )
    }

    // Use transaction to ensure atomicity
    // The unique constraint on invoiceNumber will prevent duplicates
    const result = await prisma.$transaction(async (tx) => {
      // Create invoice with line items
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: invoiceData.invoiceNumber,
          warehouseId: warehouse.id,
          customerId: session.user.id, // Using the creator as customer for now
          billingPeriodStart: new Date(invoiceData.billingPeriodStart),
          billingPeriodEnd: new Date(invoiceData.billingPeriodEnd),
          invoiceDate: new Date(invoiceData.invoiceDate),
          issueDate: new Date(), // Setting issue date to now
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          subtotal: invoiceData.totalAmount, // Setting subtotal same as total for now
          taxAmount: 0, // Setting tax to 0 for now
          totalAmount: invoiceData.totalAmount,
          createdById: session.user.id,
          lineItems: {
            create: invoiceData.lineItems.map(item => ({
              costCategory: item.costCategory as any,
              costName: item.costName,
              quantity: item.quantity,
              unitRate: item.unitRate,
              amount: item.amount
            }))
          }
        },
        include: {
          warehouse: true,
          lineItems: true
        }
      })

      // Start reconciliation within the transaction
      await startReconciliationInTransaction(tx, invoice.id)
      
      return invoice
    })

    return NextResponse.json({
      message: 'Invoice uploaded successfully',
      invoice: result,
      reconciliationStarted: true
    })
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002' && error.meta?.target?.includes('invoiceNumber')) {
      return NextResponse.json(
        { error: 'Invoice number already exists' },
        { status: 400 }
      )
    }
    // console.error('Error uploading invoice:', error)
    return NextResponse.json(
      { error: 'Failed to upload invoice' },
      { status: 500 }
    )
  }
}

async function parseCSV(buffer: Buffer): Promise<InvoiceUploadData | null> {
  try {
    const csvString = buffer.toString('utf-8')
    
    // Try multiple parsing strategies
    // Strategy 1: Standard CSV with headers
    let records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      skip_records_with_error: true
    })

    if (records.length === 0) {
      // Strategy 2: Try without header detection
      const rawRecords = parse(csvString, {
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true
      })
      
      if (rawRecords.length > 0) {
        // Convert array records to objects
        const headers = rawRecords[0]
        records = rawRecords.slice(1).map((row: any[]) => {
          const obj: any = {}
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index]
          })
          return obj
        })
      }
    }

    if (records.length === 0) {
      return null
    }

    // Extract invoice metadata
    const invoiceInfo: any = {}
    let lineItemsStartIndex = 0
    
    // Look for invoice metadata in first few rows
    for (let i = 0; i < Math.min(records.length, 10); i++) {
      const row = records[i]
      
      // Check if this row contains invoice metadata
      if (hasInvoiceMetadata(row)) {
        Object.assign(invoiceInfo, extractCSVMetadata(row))
      }
      
      // Check if this looks like the start of line items
      if (isLineItemHeader(row) || hasLineItemData(row)) {
        lineItemsStartIndex = i
        break
      }
    }
    
    // Extract line items
    const lineItems = records.slice(lineItemsStartIndex)
      .filter((row: any) => hasLineItemData(row))
      .map((row: any) => extractCSVLineItem(row))
      .filter((item: any) => item.amount > 0)
    
    // Calculate total if not provided
    let totalAmount = invoiceInfo.totalAmount || 0
    if (!totalAmount && lineItems.length > 0) {
      totalAmount = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0)
    }

    return {
      invoiceNumber: invoiceInfo.invoiceNumber || generateInvoiceNumber(),
      warehouseCode: invoiceInfo.warehouseCode || '',
      billingPeriodStart: normalizeDate(invoiceInfo.billingPeriodStart) || '',
      billingPeriodEnd: normalizeDate(invoiceInfo.billingPeriodEnd) || '',
      invoiceDate: normalizeDate(invoiceInfo.invoiceDate) || new Date().toISOString().split('T')[0],
      dueDate: invoiceInfo.dueDate ? normalizeDate(invoiceInfo.dueDate) : undefined,
      totalAmount: totalAmount,
      lineItems: lineItems
    }
  } catch (error) {
    // console.error('Error parsing CSV:', error)
    return null
  }
}

// Check if row contains invoice metadata
function hasInvoiceMetadata(row: any): boolean {
  const metadataKeys = ['Invoice Number', 'Invoice #', 'Warehouse', 'Billing Period', 'Invoice Date', 'Total Amount']
  return Object.keys(row).some(key => 
    metadataKeys.some(metaKey => key.toLowerCase().includes(metaKey.toLowerCase()))
  )
}

// Extract metadata from CSV row
function extractCSVMetadata(row: any): any {
  const info: any = {}
  
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue
    
    const keyLower = key.toLowerCase()
    const strValue = String(value).trim()
    
    if (keyLower.includes('invoice') && (keyLower.includes('number') || keyLower.includes('#'))) {
      info.invoiceNumber = strValue
    } else if (keyLower.includes('warehouse')) {
      info.warehouseCode = strValue
    } else if (keyLower.includes('billing') && keyLower.includes('start')) {
      info.billingPeriodStart = strValue
    } else if (keyLower.includes('billing') && keyLower.includes('end')) {
      info.billingPeriodEnd = strValue
    } else if (keyLower.includes('invoice') && keyLower.includes('date')) {
      info.invoiceDate = strValue
    } else if (keyLower.includes('due') && keyLower.includes('date')) {
      info.dueDate = strValue
    } else if (keyLower.includes('total') && keyLower.includes('amount')) {
      info.totalAmount = parseMoney(strValue).toNumber()
    }
  }
  
  return info
}

// Check if row is a line item header
function isLineItemHeader(row: any): boolean {
  const headerKeywords = ['category', 'description', 'amount', 'quantity', 'rate', 'charge']
  const values = Object.values(row).filter(v => v).map(v => String(v).toLowerCase())
  const matches = values.filter(v => headerKeywords.some(keyword => v.includes(keyword)))
  return matches.length >= 2 // At least 2 header keywords
}

// Check if row has line item data
function hasLineItemData(row: any): boolean {
  // Must have some description and amount
  const hasDescription = Object.values(row).some(v => 
    v && String(v).trim().length > 2 && isNaN(Number(v))
  )
  const hasAmount = Object.values(row).some(v => {
    const parsed = parseMoney(String(v || ''))
    return parsed.toNumber() > 0
  })
  return hasDescription && hasAmount
}

// Extract line item from CSV row
function extractCSVLineItem(row: any): any {
  return {
    costCategory: extractCostCategory(row),
    costName: extractCostName(row),
    quantity: extractQuantity(row),
    unitRate: extractUnitRate(row),
    amount: extractAmount(row)
  }
}

async function parseExcel(buffer: Buffer): Promise<InvoiceUploadData | null> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Try multiple parsing strategies
    
    // Strategy 1: Look for key-value pairs in cells (common in 3PL invoices)
    const invoiceInfo = extractInvoiceMetadata(worksheet)
    
    // Strategy 2: Parse as structured table
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })
    
    if (data.length === 0 && !invoiceInfo.invoiceNumber) {
      return null
    }

    // Extract line items from table data
    const lineItems = extractLineItems(data)
    
    // If we found metadata through cell scanning, use it
    // Otherwise try to extract from first rows
    if (!invoiceInfo.invoiceNumber && data.length > 0) {
      const firstRow = data[0] as any
      invoiceInfo.invoiceNumber = firstRow['Invoice Number'] || firstRow['Invoice #'] || firstRow.invoiceNumber || ''
      invoiceInfo.warehouseCode = firstRow['Warehouse'] || firstRow['Warehouse Code'] || firstRow.warehouseCode || ''
    }

    // Calculate total if not provided
    let totalAmount = invoiceInfo.totalAmount
    if (!totalAmount && lineItems.length > 0) {
      totalAmount = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0)
    }

    return {
      invoiceNumber: invoiceInfo.invoiceNumber || generateInvoiceNumber(),
      warehouseCode: invoiceInfo.warehouseCode || '',
      billingPeriodStart: normalizeDate(invoiceInfo.billingPeriodStart) || '',
      billingPeriodEnd: normalizeDate(invoiceInfo.billingPeriodEnd) || '',
      invoiceDate: normalizeDate(invoiceInfo.invoiceDate) || new Date().toISOString().split('T')[0],
      dueDate: invoiceInfo.dueDate ? normalizeDate(invoiceInfo.dueDate) : undefined,
      totalAmount: totalAmount || 0,
      lineItems: lineItems
    }
  } catch (error) {
    // console.error('Error parsing Excel:', error)
    return null
  }
}

// Helper function to extract invoice metadata from cells
function extractInvoiceMetadata(worksheet: XLSX.WorkSheet): any {
  const info: any = {}
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100')
  
  // Common patterns for invoice metadata
  const patterns = {
    invoiceNumber: /invoice\s*(#|number|no\.?):?\s*(.+)/i,
    warehouseCode: /warehouse\s*(code|#)?:?\s*(.+)/i,
    billingPeriodStart: /billing\s*period\s*(start|from):?\s*(.+)/i,
    billingPeriodEnd: /billing\s*period\s*(end|to):?\s*(.+)/i,
    invoiceDate: /invoice\s*date:?\s*(.+)/i,
    dueDate: /due\s*date:?\s*(.+)/i,
    totalAmount: /total\s*(amount)?:?\s*[\$£€]?\s*([\d,]+\.?\d*)/i
  }
  
  // Scan first 20 rows for metadata
  for (let row = range.s.r; row <= Math.min(range.e.r, 20); row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = worksheet[cellAddress]
      if (!cell || !cell.v) continue
      
      const cellValue = String(cell.v).trim()
      
      // Check each pattern
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = cellValue.match(pattern)
        if (match) {
          // Look for value in same row or next column
          const nextCol = XLSX.utils.encode_cell({ r: row, c: col + 1 })
          const nextCell = worksheet[nextCol]
          
          if (nextCell && nextCell.v) {
            info[key] = String(nextCell.v).trim()
          } else if (match[2]) {
            info[key] = match[2].trim()
          } else if (match[1]) {
            info[key] = match[1].trim()
          }
        }
      }
    }
  }
  
  // Parse money values
  if (info.totalAmount) {
    info.totalAmount = parseMoney(info.totalAmount).toNumber()
  }
  
  return info
}

// Helper function to extract line items from various formats
function extractLineItems(data: any[]): any[] {
  const lineItems: any[] = []
  
  // Look for rows that have amount/cost data
  for (const row of data) {
    // Skip rows that look like headers or metadata
    if (isHeaderRow(row)) continue
    
    // Try to extract line item data from various column names
    const amount = extractAmount(row)
    if (amount > 0) {
      lineItems.push({
        costCategory: extractCostCategory(row),
        costName: extractCostName(row),
        quantity: extractQuantity(row),
        unitRate: extractUnitRate(row),
        amount: amount
      })
    }
  }
  
  return lineItems
}

// Helper functions for data extraction
function isHeaderRow(row: any): boolean {
  const headerKeywords = ['category', 'description', 'amount', 'quantity', 'rate', 'total', 'cost']
  const values = Object.values(row).map(v => String(v).toLowerCase())
  return values.some(v => headerKeywords.some(keyword => v.includes(keyword)))
}

function extractAmount(row: any): number {
  const amountKeys = ['Amount', 'Total', 'Cost', 'Charge', 'Fee', 'Line Total', 'Total Amount', 'Net Amount']
  for (const key of amountKeys) {
    if (row[key]) return parseMoney(row[key]).toNumber()
  }
  // Check lowercase versions
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total')) {
      return parseMoney(row[key]).toNumber()
    }
  }
  return 0
}

function extractCostCategory(row: any): string {
  const categoryKeys = ['Category', 'Cost Category', 'Service Type', 'Type', 'Service']
  for (const key of categoryKeys) {
    if (row[key]) return mapCostCategory(String(row[key]))
  }
  // Try to infer from description
  const desc = extractCostName(row).toLowerCase()
  if (desc.includes('storage')) return 'Storage'
  if (desc.includes('handling') || desc.includes('labor')) return 'Unit'
  if (desc.includes('shipping') || desc.includes('transport')) return 'Shipment'
  if (desc.includes('pallet')) return 'Pallet'
  if (desc.includes('carton') || desc.includes('box')) return 'Carton'
  if (desc.includes('container')) return 'Container'
  return 'Accessorial'
}

function extractCostName(row: any): string {
  const nameKeys = ['Description', 'Cost Name', 'Service', 'Item', 'Line Item', 'Service Description']
  for (const key of nameKeys) {
    if (row[key]) return String(row[key]).trim()
  }
  return 'Service Charge'
}

function extractQuantity(row: any): number {
  const qtyKeys = ['Quantity', 'Qty', 'Units', 'Count', 'Volume']
  for (const key of qtyKeys) {
    if (row[key]) return parseMoney(row[key]).toNumber()
  }
  return 1
}

function extractUnitRate(row: any): number | undefined {
  const rateKeys = ['Rate', 'Unit Rate', 'Price', 'Unit Price', 'Cost per Unit']
  for (const key of rateKeys) {
    if (row[key]) return parseMoney(row[key]).toNumber()
  }
  return undefined
}


// Map common 3PL cost categories to our system categories
function mapCostCategory(category: string): string {
  const normalized = category.toLowerCase().trim()
  
  const mappings: Record<string, string> = {
    'storage': 'Storage',
    'warehousing': 'Storage',
    'pallet storage': 'Storage',
    'pallet': 'Pallet',
    'palletization': 'Pallet',
    'carton': 'Carton',
    'box': 'Carton',
    'case': 'Carton',
    'container': 'Container',
    'shipping': 'Shipment',
    'transport': 'Shipment',
    'freight': 'Shipment',
    'delivery': 'Shipment',
    'handling': 'Unit',
    'labor': 'Unit',
    'pick': 'Unit',
    'pack': 'Unit',
    'receiving': 'Unit',
    'other': 'Accessorial',
    'misc': 'Accessorial',
    'fee': 'Accessorial',
    'surcharge': 'Accessorial'
  }
  
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) return value
  }
  
  return 'Accessorial'
}

// Normalize various date formats
function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  
  try {
    // Try parsing as date
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    
    // Try common formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
    ]
    
    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        // Assume first format is MM/DD/YYYY for US
        if (format === formats[0]) {
          return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
        }
        // Other formats...
      }
    }
  } catch (error) {
    // console.error('Date parsing error:', error)
  }
  
  return dateStr
}

// Generate a unique invoice number if none provided
function generateInvoiceNumber(): string {
  const date = new Date()
  return `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Date.now().toString().slice(-6)}`
}

async function startReconciliationInTransaction(tx: any, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  })

  if (!invoice) return

  // Get calculated costs for the billing period
  const calculatedCosts = await tx.calculatedCost.groupBy({
    by: ['costRateId'],
    where: {
      warehouseId: invoice.warehouseId,
      billingPeriodStart: {
        gte: invoice.billingPeriodStart,
        lte: invoice.billingPeriodEnd
      }
    },
    _sum: {
      finalExpectedCost: true
    }
  })

  // Get cost rate details
  const costRateIds = calculatedCosts.map((c: any) => c.costRateId)
  const costRates = await tx.costRate.findMany({
    where: { id: { in: costRateIds } }
  })

    // Create reconciliation records
    const reconciliations = []

    for (const lineItem of invoice.lineItems) {
      // Find matching calculated cost
      const matchingRate = costRates.find((r: any) => 
        r.costCategory === lineItem.costCategory && 
        r.costName === lineItem.costName
      )

      if (matchingRate) {
        const calculatedSum = calculatedCosts.find((c: any) => c.costRateId === matchingRate.id)
        const expectedAmount = calculatedSum?._sum.finalExpectedCost || 0

        const { difference, status } = calculateReconciliationDifference(
          lineItem.amount,
          expectedAmount
        )

        reconciliations.push({
          invoiceId: invoice.id,
          costCategory: lineItem.costCategory,
          costName: lineItem.costName,
          expectedAmount,
          invoicedAmount: lineItem.amount,
          difference,
          status
        })
      } else {
        // No matching calculated cost found
        const invoicedMoney = new Money(lineItem.amount);
        reconciliations.push({
          invoiceId: invoice.id,
          costCategory: lineItem.costCategory,
          costName: lineItem.costName,
          expectedAmount: 0,
          invoicedAmount: lineItem.amount,
          difference: invoicedMoney.toDecimal(),
          status: 'overbilled' as const
        })
      }
    }

  // Insert reconciliation records
  if (reconciliations.length > 0) {
    await tx.invoiceReconciliation.createMany({
      data: reconciliations
    })
  }
}

