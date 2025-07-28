import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaginationParams, getPaginationSkipTake, createPaginatedResponse } from '@/lib/database/pagination'
import { sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { calculateUnits } from '@/lib/utils/unit-calculations'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId') || session.user.warehouseId
    const date = searchParams.get('date')
    const showZeroStock = searchParams.get('showZeroStock') === 'true'
    const skuCode = searchParams.get('skuCode')
    
    // Get pagination params
    const paginationParams = getPaginationParams(req)

    // Always calculate balances from transactions (runtime calculation)
    const pointInTime = date ? new Date(date) : new Date()
    if (date) {
      pointInTime.setHours(23, 59, 59, 999)
    }
    
    // Build where clause for transactions
    const transactionWhere: any = {
      transactionDate: { lte: pointInTime }
    }
    
    if (session.user.role === 'staff' && session.user.warehouseId) {
      transactionWhere.warehouseId = session.user.warehouseId
    } else if (warehouseId) {
      transactionWhere.warehouseId = warehouseId
    } else {
      // Exclude Amazon warehouse when not querying specific warehouse
      transactionWhere.warehouse = {
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }
    }
    
    // Add SKU filter if provided
    if (skuCode) {
      transactionWhere.sku = { 
        skuCode: {
          contains: sanitizeSearchQuery(skuCode),
          mode: 'insensitive'
        }
      }
    }
    
    // Fetch all transactions up to the date
    const transactions = await prisma.inventoryTransaction.findMany({
      where: transactionWhere,
      include: {
        warehouse: true,
        sku: true
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })
    
    // Calculate balances from transactions
    const balances = new Map<string, any>()
    
    for (const transaction of transactions) {
      const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
      const current = balances.get(key) || {
        id: key,
        warehouseId: transaction.warehouseId,
        skuId: transaction.skuId,
        warehouse: transaction.warehouse,
        sku: transaction.sku,
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentPallets: 0,
        currentUnits: 0,
        lastTransactionDate: null,
        lastUpdated: new Date()
      }
      
      current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
      // Use transaction-specific unitsPerCarton if available, fallback to SKU master
      current.currentUnits = calculateUnits(current.currentCartons, transaction, transaction.sku)
      current.lastTransactionDate = transaction.transactionDate
      
      // Store pallet configuration from transaction if available
      if (transaction.storageCartonsPerPallet) {
        current.storageCartonsPerPallet = transaction.storageCartonsPerPallet
      }
      if (transaction.shippingCartonsPerPallet) {
        current.shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
      }
      
      balances.set(key, current)
    }
    
    // Calculate pallets for each balance
    for (const [, balance] of balances.entries()) {
      if (balance.currentCartons > 0) {
        // First try to use pallet configuration from transactions
        if (balance.storageCartonsPerPallet) {
          balance.currentPallets = Math.ceil(balance.currentCartons / balance.storageCartonsPerPallet)
        } else {
          // Fall back to warehouse config
          const config = await prisma.warehouseSkuConfig.findFirst({
            where: {
              warehouseId: balance.warehouse.id,
              skuId: balance.sku.id,
              effectiveDate: { lte: pointInTime },
              OR: [
                { endDate: null },
                { endDate: { gte: pointInTime } }
              ]
            },
            orderBy: { effectiveDate: 'desc' }
          })
          
          if (config) {
            balance.currentPallets = Math.ceil(balance.currentCartons / config.storageCartonsPerPallet)
            balance.storageCartonsPerPallet = config.storageCartonsPerPallet
            balance.shippingCartonsPerPallet = config.shippingCartonsPerPallet
          } else {
            // Default to 1 carton per pallet if no config found
            balance.currentPallets = balance.currentCartons
            balance.storageCartonsPerPallet = 1
            balance.shippingCartonsPerPallet = 1
          }
        }
      }
    }
    
    // Convert to array and filter
    let results = Array.from(balances.values())
    
    if (!showZeroStock) {
      results = results.filter(b => b.currentCartons > 0)
    }
    
    // Sort results
    results.sort((a, b) => {
      if (a.sku.skuCode !== b.sku.skuCode) return a.sku.skuCode.localeCompare(b.sku.skuCode)
      return a.batchLot.localeCompare(b.batchLot)
    })
    
    // For non-date queries, enhance with batch attribute data
    if (!date) {
      const enhancedBalances = await Promise.all(results.map(async (balance) => {
        // Find the initial RECEIVE transaction for this batch
        const receiveTransaction = await prisma.inventoryTransaction.findFirst({
          where: {
            skuId: balance.skuId,
            batchLot: balance.batchLot,
            warehouseId: balance.warehouseId,
            transactionType: 'RECEIVE'
          },
          include: {
            createdBy: {
              select: {
                fullName: true
              }
            }
          },
          orderBy: {
            transactionDate: 'asc'
          }
        })
        
        return {
          ...balance,
          receiveTransaction: receiveTransaction ? {
            createdBy: receiveTransaction.createdBy,
            transactionDate: receiveTransaction.transactionDate
          } : undefined
        }
      }))
      
      // Apply pagination
      const { skip, take } = getPaginationSkipTake(paginationParams)
      const paginatedResults = enhancedBalances.slice(skip, skip + take)
      
      return NextResponse.json(createPaginatedResponse(paginatedResults, enhancedBalances.length, paginationParams))
    }
    
    // For date queries, return all results without pagination
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching inventory balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory balances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}