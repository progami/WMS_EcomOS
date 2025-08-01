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
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

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
    
    // Fetch transactions with pagination support
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
        { transactionDate: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0
    })

    // If point-in-time view, calculate running balances and inventory summary
    if (date) {
      // For point-in-time, we need ALL transactions up to that date (no pagination)
      const allTransactions = await prisma.inventoryTransaction.findMany({
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

      // Fetch all warehouse configs upfront to avoid N+1
      const warehouseConfigs = await prisma.warehouseSkuConfig.findMany({
        where: {
          effectiveDate: { lte: new Date(date) },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date(date) } }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      })

      // Create a map for quick config lookup
      const configMap = new Map<string, any>()
      warehouseConfigs.forEach(config => {
        const key = `${config.warehouseId}-${config.skuId}`
        if (!configMap.has(key)) {
          configMap.set(key, config)
        }
      })

      // Group transactions by warehouse + sku + batch
      const balances = new Map<string, number>()
      const skuInfo = new Map<string, any>()
      
      // Calculate running balances
      const transactionsWithBalance = allTransactions.map(transaction => {
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
        
        // Process attachments efficiently
        const processedAttachments = processAttachments(transaction.attachments)
        
        return {
          ...transaction,
          pickupDate: transaction.pickupDate,
          isReconciled: transaction.isReconciled,
          runningBalance: newBalance,
          notes: processedAttachments.notes,
          attachments: processedAttachments.docs
        }
      })

      // Create inventory summary
      const inventorySummary = Array.from(balances.entries())
        .filter(([_, balance]) => balance > 0) // Only show items with positive balance
        .map(([key, balance]) => {
          const info = skuInfo.get(key)
          const configKey = `${info.warehouseId}-${info.skuId}`
          const config = configMap.get(configKey)
          
          return {
            ...info,
            currentCartons: balance,
            currentPallets: config 
              ? Math.ceil(balance / config.storageCartonsPerPallet)
              : 0
          }
        })
        .sort((a, b) => {
          // Sort by warehouse, then SKU, then batch
          if (a.warehouse !== b.warehouse) return a.warehouse.localeCompare(b.warehouse)
          if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
          return a.batchLot.localeCompare(b.batchLot)
        })

      return NextResponse.json({
        transactions: transactionsWithBalance,
        inventorySummary
      })
    }

    // Live view - process attachments for each transaction
    const transactionsWithAttachments = transactions.map(transaction => {
      const processedAttachments = processAttachments(transaction.attachments)
      
      return {
        ...transaction,
        notes: processedAttachments.notes,
        attachments: processedAttachments.docs
      }
    })
    
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

// Helper function to process attachments efficiently
function processAttachments(attachments: any) {
  let notes = null
  const docs: any = {}
  
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.type === 'notes') {
        notes = att.content
      } else if (att.category && att.category !== 'notes') {
        // Convert snake_case to camelCase for keys
        const camelKey = att.category.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
        docs[camelKey] = att
      }
    }
  }
  
  return { notes, docs }
}