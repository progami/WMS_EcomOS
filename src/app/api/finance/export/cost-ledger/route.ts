import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { getS3Service } from '@/services/s3.service'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for large exports

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the cost ledger data using the same logic as the main route
    const searchParams = request.nextUrl.searchParams
    const costLedgerUrl = new URL('/api/finance/cost-ledger', request.url)
    
    // Pass through all search params
    searchParams.forEach((value, key) => {
      costLedgerUrl.searchParams.set(key, value)
    })

    const costLedgerResponse = await fetch(costLedgerUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || ''
      }
    })

    if (!costLedgerResponse.ok) {
      throw new Error('Failed to fetch cost ledger data')
    }

    const data = await costLedgerResponse.json()
    const { ledger, totals, groupBy } = data

    // Create Excel workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Cost Ledger Summary'],
      ['Generated:', new Date().toLocaleString()],
      ['Period:', `${searchParams.get('startDate')} to ${searchParams.get('endDate')}`],
      [''],
      ['Cost Category', 'Total Amount', 'Percentage'],
      ['Storage', totals.storage, `${((totals.storage / totals.total) * 100).toFixed(1)}%`],
      ['Container', totals.container, `${((totals.container / totals.total) * 100).toFixed(1)}%`],
      ['Pallet', totals.pallet, `${((totals.pallet / totals.total) * 100).toFixed(1)}%`],
      ['Carton', totals.carton, `${((totals.carton / totals.total) * 100).toFixed(1)}%`],
      ['Unit', totals.unit, `${((totals.unit / totals.total) * 100).toFixed(1)}%`],
      ['Shipment', totals.shipment, `${((totals.shipment / totals.total) * 100).toFixed(1)}%`],
      ['Accessorial', totals.accessorial, `${((totals.accessorial / totals.total) * 100).toFixed(1)}%`],
      ['', '', ''],
      ['TOTAL', totals.total, '100.0%']
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Cost by period sheet
    const periodHeaders = groupBy === 'week' 
      ? ['Week Starting', 'Week Ending', 'Storage', 'Container', 'Pallet', 'Carton', 'Unit', 'Shipment', 'Accessorial', 'Total']
      : ['Month', 'Storage', 'Container', 'Pallet', 'Carton', 'Unit', 'Shipment', 'Accessorial', 'Total']

    const periodData = [periodHeaders]
    
    ledger.forEach((period: any) => {
      if (groupBy === 'week') {
        periodData.push([
          new Date(period.weekStarting).toLocaleDateString(),
          new Date(period.weekEnding).toLocaleDateString(),
          period.costs.storage,
          period.costs.container,
          period.costs.pallet,
          period.costs.carton,
          period.costs.unit,
          period.costs.shipment,
          period.costs.accessorial,
          period.costs.total
        ])
      } else {
        periodData.push([
          period.month,
          period.costs.storage,
          period.costs.container,
          period.costs.pallet,
          period.costs.carton,
          period.costs.unit,
          period.costs.shipment,
          period.costs.accessorial,
          period.costs.total
        ])
      }
    })

    // Add totals row
    if (groupBy === 'week') {
      periodData.push(['', 'TOTAL', totals.storage, totals.container, totals.pallet, totals.carton, totals.unit, totals.shipment, totals.accessorial, totals.total])
    } else {
      periodData.push(['TOTAL', totals.storage, totals.container, totals.pallet, totals.carton, totals.unit, totals.shipment, totals.accessorial, totals.total])
    }

    const periodWs = XLSX.utils.aoa_to_sheet(periodData)
    XLSX.utils.book_append_sheet(wb, periodWs, `Costs by ${groupBy === 'week' ? 'Week' : 'Month'}`)

    // Detailed transactions sheet
    const detailHeaders = [
      'Date', 'Transaction ID', 'Type', 'Warehouse', 'SKU', 'Batch/Lot', 
      'Category', 'Description', 'Quantity', 'Rate', 'Cost'
    ]
    const detailData = [detailHeaders]

    ledger.forEach((period: any) => {
      period.details.forEach((detail: any) => {
        detailData.push([
          new Date(detail.transactionDate).toLocaleDateString(),
          detail.transactionId,
          detail.transactionType,
          detail.warehouse,
          detail.sku,
          detail.batchLot,
          detail.category,
          detail.rateDescription,
          detail.quantity,
          detail.rate,
          detail.cost
        ])
      })
    })

    const detailWs = XLSX.utils.aoa_to_sheet(detailData)
    XLSX.utils.book_append_sheet(wb, detailWs, 'Transaction Details')

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = `cost-ledger-${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Upload to S3 for temporary storage
    const s3Service = getS3Service()
    const s3Key = s3Service.generateKey(
      { 
        type: 'export-temp', 
        userId: session.user.id, 
        exportType: 'cost-ledger' 
      },
      fileName
    )
    
    // Upload with 24 hour expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    
    await s3Service.uploadFile(buffer, s3Key, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        exportType: 'cost-ledger',
        userId: session.user.id,
        filename: fileName,
        groupBy: searchParams.get('groupBy') || 'month',
      },
      expiresAt: expiresAt,
    })
    
    // Get presigned URL for download
    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
      responseContentDisposition: `attachment; filename="${fileName}"`,
      expiresIn: 3600, // 1 hour
    })

    // Return URL instead of file directly
    return NextResponse.json({
      success: true,
      downloadUrl: presignedUrl,
      filename: fileName,
      expiresIn: 3600,
    })
  } catch (error) {
    // console.error('Export cost ledger error:', error)
    return NextResponse.json({ 
      error: 'Failed to export cost ledger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}