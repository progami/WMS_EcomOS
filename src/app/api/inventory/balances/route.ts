import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { getPaginationParams, getPaginationSkipTake, createPaginatedResponse } from '@/lib/database/pagination'
import { sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { calculateUnits } from '@/lib/utils/unit-calculations'
import { createPerformanceLogger } from '@/lib/monitoring/performance'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

const perf = createPerformanceLogger('api.inventory.balances')

export async function GET(req: NextRequest) {
  const startTime = performance.now()
  
  try {
    const session = await getServerSession()
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

    // Check if we should use the new InventoryBalance table
    if (isFeatureEnabled('USE_INVENTORY_BALANCE_TABLE') && !date) {
      // Use the fast path: direct query from InventoryBalance table
      const balanceWhere: any = {}
      
      if (session.user.role === 'staff' && session.user.warehouseId) {
        balanceWhere.warehouseId = session.user.warehouseId
      } else if (warehouseId) {
        balanceWhere.warehouseId = warehouseId
      } else {
        // Exclude Amazon warehouses
        balanceWhere.warehouse = {
          NOT: {
            OR: [
              { code: 'AMZN' },
              { code: 'AMZN-UK' }
            ]
          }
        }
      }
      
      if (skuCode) {
        balanceWhere.sku = {
          skuCode: {
            contains: sanitizeSearchQuery(skuCode),
            mode: 'insensitive'
          }
        }
      }
      
      if (!showZeroStock) {
        balanceWhere.currentCartons = { gt: 0 }
      }
      
      // Fast path: Query from InventoryBalance table
      const balances = await perf.measure('fetch_balances_direct', async () => {
        try {
          const results = await prisma.inventoryBalance.findMany({
            where: balanceWhere,
            include: {
              warehouse: true,
              sku: true,
              lastTransaction: {
                include: {
                  createdBy: {
                    select: { fullName: true }
                  }
                }
              }
            },
            orderBy: [
              { sku: { skuCode: 'asc' } },
              { batchLot: 'asc' }
            ]
          })
          return results
        } catch (dbError) {
          console.error('Database query error:', dbError)
          // Fallback: Query without lastTransaction relation
          return await prisma.inventoryBalance.findMany({
            where: balanceWhere,
            include: {
              warehouse: true,
              sku: true
            },
            orderBy: [
              { sku: { skuCode: 'asc' } },
              { batchLot: 'asc' }
            ]
          })
        }
      })
      
      // Transform to match expected format
      const results = balances.map(balance => {
        const hasLastTransaction = 'lastTransaction' in balance && balance.lastTransaction
        return {
          id: `${balance.warehouseId}-${balance.skuId}-${balance.batchLot}`,
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          warehouse: balance.warehouse,
          sku: balance.sku,
          batchLot: balance.batchLot,
          currentCartons: balance.currentCartons,
          currentUnits: balance.currentUnits,
          currentPallets: balance.currentPallets,
          lastTransactionDate: hasLastTransaction ? balance.lastTransaction.transactionDate : null,
          lastUpdated: balance.lastUpdated,
          receiveTransaction: hasLastTransaction && balance.lastTransaction.createdBy ? {
            createdBy: balance.lastTransaction.createdBy,
            transactionDate: balance.lastTransaction.transactionDate
          } : undefined
        }
      })
      
      // Apply pagination
      const { skip, take } = getPaginationSkipTake(paginationParams)
      const paginatedResults = results.slice(skip, skip + take)
      
      const duration = performance.now() - startTime
      perf.log('inventory_balance_api', duration, {
        method: 'direct_query',
        resultCount: results.length
      })
      
      return NextResponse.json(createPaginatedResponse(paginatedResults, results.length, paginationParams))
    }

    // Legacy path: calculate balances from transactions (runtime calculation)
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
    const transactions = await perf.measure('fetch_transactions', async () => {
      return await prisma.inventoryTransaction.findMany({
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
    }, {
      warehouseId: warehouseId || 'all',
      dateFilter: date || 'current'
    })
    
    // Calculate balances from transactions
    const balances = await perf.measure('calculate_balances', async () => {
      const balanceMap = new Map<string, {
        id: string
        warehouseId: string
        skuId: string
        warehouse: any
        sku: any
        batchLot: string
        currentCartons: number
        currentPallets: number
        currentUnits: number
        lastTransactionDate: Date | null
        lastTransactionId: string | null
        lastTransaction: any
      }>()
      
      for (const transaction of transactions) {
        const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
        const current = balanceMap.get(key) || {
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
      
        balanceMap.set(key, current)
      }
      
      return balanceMap
    })
    
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
      results = results.filter((b: any) => b.currentCartons > 0)
    }
    
    // Sort results
    results.sort((a: any, b: any) => {
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
    const totalDuration = performance.now() - startTime
    perf.log('total_request', totalDuration, {
      transactionCount: transactions.length,
      resultCount: results.length,
      hasDateFilter: !!date
    })
    
    const response = NextResponse.json(results)
    response.headers.set('X-Response-Time', `${totalDuration.toFixed(2)}ms`)
    return response
  } catch (error) {
    const totalDuration = performance.now() - startTime
    perf.log('total_request_error', totalDuration, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    console.error('Error fetching inventory balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory balances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}