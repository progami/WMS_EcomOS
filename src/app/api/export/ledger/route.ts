import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { generateExportConfig, applyExportConfig } from '@/lib/dynamic-export'
import { inventoryTransactionConfig } from '@/lib/export-configurations'
import { getS3Service } from '@/services/s3.service'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for large exports

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const viewMode = searchParams.get('viewMode') || 'live'
    const date = searchParams.get('date')
    const warehouse = searchParams.get('warehouse')
    const transactionType = searchParams.get('transactionType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const skuCode = searchParams.get('skuCode')
    const batchLot = searchParams.get('batchLot')
    const fullExport = searchParams.get('full') === 'true'

    // Build where clause
    const where: any = {}
    
    // If full export is requested, skip all filters except staff warehouse restriction
    if (!fullExport) {
      // For staff, always limit to their warehouse
      if (session.user.role === 'staff' && session.user.warehouseId) {
        where.warehouseId = session.user.warehouseId
      } else if (warehouse) {
        where.warehouseId = warehouse
      }

      if (transactionType) {
        where.transactionType = transactionType
      }

      if (skuCode) {
        where.sku = {
          skuCode: {
            contains: skuCode,
            mode: 'insensitive'
          }
        }
      }

      if (batchLot) {
        where.batchLot = {
          contains: batchLot,
          mode: 'insensitive'
        }
      }

      // Date filtering
      if (viewMode === 'point-in-time' && date) {
        const pointInTime = new Date(date)
        pointInTime.setHours(23, 59, 59, 999)
        where.transactionDate = { lte: pointInTime }
      } else if (startDate || endDate) {
        where.transactionDate = {}
        if (startDate) {
          where.transactionDate.gte = new Date(startDate)
        }
        if (endDate) {
          const endDateTime = new Date(endDate)
          endDateTime.setHours(23, 59, 59, 999)
          where.transactionDate.lte = endDateTime
        }
      }
    } else {
      // For full export, only apply warehouse restriction for staff users
      if (session.user.role === 'staff' && session.user.warehouseId) {
        where.warehouseId = session.user.warehouseId
      }
    }

    // Fetch transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        createdBy: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Use dynamic export configuration
    const fieldConfigs = generateExportConfig('InventoryTransaction', inventoryTransactionConfig)
    const ledgerData = applyExportConfig(transactions, fieldConfigs)

    let ledgerSheet
    
    if (ledgerData.length > 0) {
      // Normal case - data exists
      ledgerSheet = XLSX.utils.json_to_sheet(ledgerData)
      
      // Auto-size columns
      const colWidths = Object.keys(ledgerData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...ledgerData.slice(0, 100).map(row => String(row[key] || '').length)
        ) + 2
      }))
      ledgerSheet['!cols'] = colWidths
    } else {
      // Empty data - create headers manually
      const headers = fieldConfigs.map(config => config.columnName || config.fieldName)
      const headerRow = headers.reduce((acc, header, index) => {
        const col = XLSX.utils.encode_col(index)
        acc[`${col}1`] = { t: 's', v: header }
        return acc
      }, {} as any)
      
      ledgerSheet = {
        ...headerRow,
        '!ref': `A1:${XLSX.utils.encode_col(headers.length - 1)}1`,
        '!cols': headers.map(header => ({ wch: Math.max(header.length + 2, 15) }))
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ledgerSheet, 'Inventory Ledger')

    // If point-in-time, add inventory summary sheet
    if (viewMode === 'point-in-time' && date) {
      // Calculate inventory balances
      const balances = new Map<string, any>()
      
      for (const transaction of transactions) {
        const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
        const current = balances.get(key) || {
          warehouse: transaction.warehouse.name,
          skuCode: transaction.sku.skuCode,
          description: transaction.sku.description,
          batchLot: transaction.batchLot,
          cartons: 0,
          lastActivity: transaction.transactionDate
        }
        
        current.cartons += transaction.cartonsIn - transaction.cartonsOut
        current.lastActivity = transaction.transactionDate
        balances.set(key, current)
      }

      // Convert to array and filter out zero balances
      const summaryData = Array.from(balances.values())
        .filter(item => item.cartons > 0)
        .sort((a, b) => {
          if (a.warehouse !== b.warehouse) return a.warehouse.localeCompare(b.warehouse)
          if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
          return a.batchLot.localeCompare(b.batchLot)
        })
        .map(item => ({
          'Warehouse': item.warehouse,
          'SKU Code': item.skuCode,
          'Description': item.description,
          'Batch/Lot': item.batchLot,
          'Cartons': item.cartons,
          'Last Activity': new Date(item.lastActivity).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
        }))

      const summarySheet = XLSX.utils.json_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summarySheet, `Inventory as of ${new Date(date).toLocaleDateString()}`)
    }

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Create filename
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = viewMode === 'point-in-time' 
      ? `inventory_ledger_as_of_${date}.xlsx`
      : fullExport 
        ? `inventory_ledger_full_export_${dateStr}.xlsx`
        : `inventory_ledger_${dateStr}.xlsx`

    // Upload to S3 for temporary storage
    const s3Service = getS3Service()
    const s3Key = s3Service.generateKey(
      { 
        type: 'export-temp', 
        userId: session.user.id, 
        exportType: 'inventory-ledger' 
      },
      filename
    )
    
    // Upload with 24 hour expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    
    await s3Service.uploadFile(buf, s3Key, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        exportType: 'inventory-ledger',
        userId: session.user.id,
        filename: filename,
        viewMode: viewMode,
      },
      expiresAt: expiresAt,
    })
    
    // Get presigned URL for download
    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
      responseContentDisposition: `attachment; filename="${filename}"`,
      expiresIn: 3600, // 1 hour
    })

    // Return URL instead of file directly
    return NextResponse.json({
      success: true,
      downloadUrl: presignedUrl,
      filename: filename,
      expiresIn: 3600,
    })
  } catch (error) {
    // console.error('Export error:', error)
    return NextResponse.json({ 
      error: 'Failed to export ledger data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}