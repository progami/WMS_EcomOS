import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createReadStream } from 'fs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all transactions with user info
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        warehouse: true,
        sku: true,
        createdBy: true
      },
      orderBy: {
        transactionDate: 'desc'
      }
    })

    // Analyze missing attributes for each transaction
    const missingData = transactions.map(transaction => {
      const attachments = (transaction.attachments as any) || {}
      const missingFields: string[] = []
      const missingDocs: string[] = []
      
      // Document checks - check if each document type exists
      const hasPackingList = attachments.packingList || attachments.packing_list ? 'Yes' : 'No'
      const hasCommercialInvoice = attachments.commercialInvoice || attachments.commercial_invoice ? 'Yes' : 'No'
      const hasBillOfLading = attachments.billOfLading || attachments.bill_of_lading ? 'Yes' : 'No'
      const hasDeliveryNote = attachments.deliveryNote || attachments.delivery_note ? 'Yes' : 'No'
      const hasCubeMaster = attachments.cubeMaster || attachments.cube_master ? 'Yes' : 'No'
      const hasTransactionCertificate = attachments.transactionCertificate || attachments.transaction_certificate ? 'Yes' : 'No'
      const hasCustomDeclaration = attachments.customDeclaration || attachments.custom_declaration ? 'Yes' : 'No'
      const hasProofOfPickup = attachments.proofOfPickup || attachments.proof_of_pickup ? 'Yes' : 'No'
      
      // Check for missing documents based on transaction type
      if (transaction.transactionType === 'RECEIVE') {
        if (hasPackingList === 'No') missingDocs.push('Packing List')
        if (hasCommercialInvoice === 'No') missingDocs.push('Commercial Invoice')
        if (hasDeliveryNote === 'No') missingDocs.push('Delivery Note')
        if (hasCubeMaster === 'No') missingDocs.push('Cube Master')
        
        // Check for missing fields with context-aware logic
        if (!transaction.shipName && (transaction.referenceId?.includes('OOCL') || transaction.referenceId?.includes('MSC'))) {
          missingFields.push('Ship Name')
        }
        if (!transaction.trackingNumber) {
          missingFields.push('Tracking Number')
        }
      }
      
      if (transaction.transactionType === 'SHIP') {
        if (hasPackingList === 'No') missingDocs.push('Packing List')
        if (hasDeliveryNote === 'No') missingDocs.push('Delivery Note')
        
        // Check for missing fields
        if (!transaction.modeOfTransportation) {
          missingFields.push('Mode of Transport')
        }
        if (!transaction.trackingNumber && transaction.referenceId?.includes('FBA')) {
          missingFields.push('FBA Tracking Number')
        }
      }
      
      if (transaction.transactionType === 'ADJUST_IN' || transaction.transactionType === 'ADJUST_OUT') {
        // Adjustments might need proof of pickup or other documentation
        if (hasProofOfPickup === 'No') missingDocs.push('Proof of Pickup')
      }
      
      const totalMissing = missingFields.length + missingDocs.length
      
      return {
        // Transaction details
        transactionDate: transaction.transactionDate,
        transactionId: transaction.transactionId,
        transactionType: transaction.transactionType,
        isReconciled: transaction.isReconciled ? 'Yes' : 'No',
        warehouse: transaction.warehouse.name,
        sku: transaction.sku.skuCode,
        skuDescription: transaction.sku.description,
        batchLot: transaction.batchLot,
        referenceId: transaction.referenceId || '',
        
        // Quantities
        cartonsIn: transaction.cartonsIn,
        cartonsOut: transaction.cartonsOut,
        storagePalletsIn: transaction.storagePalletsIn,
        shippingPalletsOut: transaction.shippingPalletsOut,
        
        // Shipping information
        shipName: transaction.shipName || '',
        trackingNumber: transaction.trackingNumber || '',
        modeOfTransportation: transaction.modeOfTransportation || '',
        pickupDate: transaction.pickupDate,
        
        // Document attachment columns (Yes/No)
        hasPackingList,
        hasCommercialInvoice,
        hasBillOfLading,
        hasDeliveryNote,
        hasCubeMaster,
        hasTransactionCertificate,
        hasCustomDeclaration,
        hasProofOfPickup,
        
        // Missing field indicators
        missingShipName: missingFields.includes('Ship Name') ? 'Yes' : 'No',
        missingTrackingNumber: missingFields.includes('Tracking Number') || missingFields.includes('FBA Tracking Number') ? 'Yes' : 'No',
        missingModeOfTransport: missingFields.includes('Mode of Transport') ? 'Yes' : 'No',
        
        // Summary columns
        missingDocuments: missingDocs.join(', '),
        missingFields: missingFields.join(', '),
        totalMissingCount: totalMissing,
        
        // Metadata
        createdBy: transaction.createdBy.fullName,
        createdAt: transaction.createdAt
      }
    }).filter(t => t.totalMissingCount > 0)

    // Create Excel workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Missing Attributes Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Total Transactions:', transactions.length],
      ['Transactions with Missing Attributes:', missingData.length],
      ['Completion Rate:', `${((transactions.length - missingData.length) / transactions.length * 100).toFixed(1)}%`],
      [''],
      ['Summary by Transaction Type:'],
      ['RECEIVE:', missingData.filter(t => t.transactionType === 'RECEIVE').length],
      ['SHIP:', missingData.filter(t => t.transactionType === 'SHIP').length],
      ['ADJUST_IN:', missingData.filter(t => t.transactionType === 'ADJUST_IN').length],
      ['ADJUST_OUT:', missingData.filter(t => t.transactionType === 'ADJUST_OUT').length],
      ['TRANSFER:', missingData.filter(t => t.transactionType === 'TRANSFER').length]
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Missing attributes detail sheet with comprehensive columns
    const headers = [
      // Transaction Details
      'Transaction Date',
      'Transaction ID',
      'Type',
      'Reconciled',
      'Warehouse',
      'SKU Code',
      'SKU Description',
      'Batch/Lot',
      'Reference ID',
      
      // Quantities
      'Cartons In',
      'Cartons Out',
      'Storage Pallets In',
      'Shipping Pallets Out',
      
      // Shipping Information
      'Ship Name',
      'Tracking Number',
      'Mode of Transport',
      'Pickup Date',
      
      // Document Attachments (Yes/No)
      'Has Packing List',
      'Has Commercial Invoice',
      'Has Bill of Lading',
      'Has Delivery Note',
      'Has Cube Master',
      'Has TC (GRS)',
      'Has CDS',
      'Has Proof of Pickup',
      
      // Missing Field Indicators
      'Missing Ship Name',
      'Missing Tracking Number',
      'Missing Mode of Transport',
      
      // Summary
      'Missing Documents',
      'Missing Fields',
      'Total Missing Count',
      
      // Metadata
      'Created By',
      'Created At'
    ]

    const data = [headers]
    missingData.forEach(row => {
      data.push([
        new Date(row.transactionDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        row.transactionId,
        row.transactionType,
        row.isReconciled,
        row.warehouse,
        row.sku,
        row.skuDescription,
        row.batchLot,
        row.referenceId,
        
        // Quantities
        row.cartonsIn || 0,
        row.cartonsOut || 0,
        row.storagePalletsIn || 0,
        row.shippingPalletsOut || 0,
        
        // Shipping Information
        row.shipName,
        row.trackingNumber,
        row.modeOfTransportation,
        row.pickupDate ? new Date(row.pickupDate).toLocaleDateString() : '',
        
        // Document Attachments
        row.hasPackingList,
        row.hasCommercialInvoice,
        row.hasBillOfLading,
        row.hasDeliveryNote,
        row.hasCubeMaster,
        row.hasTransactionCertificate,
        row.hasCustomDeclaration,
        row.hasProofOfPickup,
        
        // Missing Field Indicators
        row.missingShipName,
        row.missingTrackingNumber,
        row.missingModeOfTransport,
        
        // Summary
        row.missingDocuments,
        row.missingFields,
        row.totalMissingCount,
        
        // Metadata
        row.createdBy,
        new Date(row.createdAt).toLocaleDateString()
      ])
    })

    const detailWs = XLSX.utils.aoa_to_sheet(data)
    
    // Auto-size columns
    const colWidths = headers.map((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...data.slice(1).map(row => String(row[index] || '').length)
      )
      return { wch: Math.min(maxLength + 2, 30) }
    })
    detailWs['!cols'] = colWidths
    
    XLSX.utils.book_append_sheet(wb, detailWs, 'Missing Attributes')

    // Write to temporary file
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = `missing-attributes-${new Date().toISOString().split('T')[0]}.xlsx`
    const filePath = join(tmpdir(), fileName)
    
    await writeFile(filePath, buffer)

    // Create response with file
    const fileStream = createReadStream(filePath)
    const response = new NextResponse(fileStream as any)
    
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

    return response
  } catch (error) {
    // console.error('Export missing attributes error:', error)
    return NextResponse.json({ 
      error: 'Failed to export missing attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}