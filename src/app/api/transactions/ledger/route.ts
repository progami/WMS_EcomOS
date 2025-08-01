import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/utils/date-helpers'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const warehouse = searchParams.get('warehouse')
    const transactionType = searchParams.get('transactionType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {}
    
    // For staff, limit to their warehouse
    if (session.user.role === 'staff' && session.user.warehouseId) {
      where.warehouseId = session.user.warehouseId
    } else if (warehouse) {
      where.warehouseId = warehouse
    }

    if (transactionType) {
      where.transactionType = transactionType
    }

    // Date filtering
    if (date) {
      // Point-in-time view - get all transactions up to this date
      const pointInTime = parseLocalDate(date)
      pointInTime.setHours(23, 59, 59, 999)
      where.transactionDate = { lte: pointInTime }
    } else {
      // Live view with optional date range
      if (startDate || endDate) {
        where.transactionDate = {}
        if (startDate) {
          where.transactionDate.gte = parseLocalDate(startDate)
        }
        if (endDate) {
          const endDateTime = parseLocalDate(endDate)
          endDateTime.setHours(23, 59, 59, 999)
          where.transactionDate.lte = endDateTime
        }
      }
    }

    // Force a fresh read to avoid stale connection pool data
    await prisma.$queryRaw`SELECT 1`
    
    // Fetch transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        createdBy: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // If point-in-time view, calculate running balances and inventory summary
    if (date) {
      // Group transactions by warehouse + sku + batch
      const balances = new Map<string, number>()
      const skuInfo = new Map<string, any>()
      
      // Calculate running balances
      const transactionsWithBalance = transactions.map(transaction => {
        const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
        const currentBalance = balances.get(key) || 0
        const newBalance = currentBalance + transaction.cartonsIn - transaction.cartonsOut
        balances.set(key, newBalance)
        
        // Store SKU info for summary
        skuInfo.set(key, {
          warehouse: transaction.warehouse.name,
          warehouseId: transaction.warehouseId,
          skuCode: transaction.sku.skuCode,
          skuId: transaction.skuId,
          description: transaction.sku.description,
          batchLot: transaction.batchLot
        })
        
        // Extract notes and process attachments
        let notes = null;
        let attachmentsDocs = {};
        
        if (transaction.attachments && Array.isArray(transaction.attachments)) {
          const notesAttachment = (transaction.attachments as any[]).find(att => att.type === 'notes');
          if (notesAttachment) {
            notes = notesAttachment.content;
          }
          
          // Convert attachments array to object for inventory page
          (transaction.attachments as any[]).forEach(att => {
            if (att.category && att.category !== 'notes') {
              // Convert snake_case to camelCase for keys
              const camelKey = att.category.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              attachmentsDocs[camelKey] = att;
            }
          });
        }
        
        return {
          ...transaction,
          pickupDate: transaction.pickupDate,
          isReconciled: transaction.isReconciled,
          runningBalance: newBalance,
          notes,
          attachments: attachmentsDocs // Override with processed attachments
        }
      })

      // Create inventory summary
      const inventorySummary = Array.from(balances.entries())
        .filter(([_, balance]) => balance > 0) // Only show items with positive balance
        .map(([key, balance]) => {
          const info = skuInfo.get(key)
          
          // Get warehouse config for pallet calculation
          const config = prisma.warehouseSkuConfig.findFirst({
            where: {
              warehouseId: info.warehouseId,
              skuId: info.skuId,
              effectiveDate: { lte: new Date(date) },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date(date) } }
              ]
            },
            orderBy: { effectiveDate: 'desc' }
          })
          
          return {
            ...info,
            currentCartons: balance,
            currentPallets: 0 // Will be calculated based on config
          }
        })
        .sort((a, b) => {
          // Sort by warehouse, then SKU, then batch
          if (a.warehouse !== b.warehouse) return a.warehouse.localeCompare(b.warehouse)
          if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
          return a.batchLot.localeCompare(b.batchLot)
        })

      // Calculate pallets for each item
      for (const item of inventorySummary) {
        const config = await prisma.warehouseSkuConfig.findFirst({
          where: {
            warehouseId: item.warehouseId,
            skuId: item.skuId,
            effectiveDate: { lte: new Date(date) },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date(date) } }
            ]
          },
          orderBy: { effectiveDate: 'desc' }
        })
        
        if (config) {
          item.currentPallets = Math.ceil(item.currentCartons / config.storageCartonsPerPallet)
        }
      }

      return NextResponse.json({
        transactions: transactionsWithBalance,
        inventorySummary
      })
    }

    // Live view - return transactions with attachments processed
    const transactionsWithAttachments = transactions.map(transaction => {
      // Extract notes from attachments if present
      let notes = null;
      let attachmentsDocs = {};
      
      if (transaction.attachments && Array.isArray(transaction.attachments)) {
        const notesAttachment = (transaction.attachments as any[]).find(att => att.type === 'notes');
        if (notesAttachment) {
          notes = notesAttachment.content;
        }
        
        // Convert attachments array to object for inventory page
        (transaction.attachments as any[]).forEach(att => {
          if (att.category && att.category !== 'notes') {
            // Convert snake_case to camelCase for keys
            const camelKey = att.category.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            attachmentsDocs[camelKey] = att;
          }
        });
      }
      
      return {
        ...transaction,
        notes,
        attachments: attachmentsDocs // Override with processed attachments
      };
    });
    
    return NextResponse.json({
      transactions: transactionsWithAttachments
    })
  } catch (error) {
    // console.error('Ledger error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch ledger data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}