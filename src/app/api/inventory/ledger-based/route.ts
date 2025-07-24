import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId') || session.user.warehouseId
    const skuCode = searchParams.get('skuCode')

    // Build where clause for transactions
    const where: any = {}
    
    if (warehouseId) {
      where.warehouseId = warehouseId
    }
    
    if (skuCode) {
      where.sku = {
        skuCode: skuCode
      }
    }

    // Fetch ALL transactions from the ledger
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Calculate current balance for each SKU/Batch combination
    const balanceMap = new Map<string, any>()

    for (const transaction of transactions) {
      const key = `${transaction.skuId}-${transaction.batchLot}`
      
      const current = balanceMap.get(key) || {
        skuId: transaction.skuId,
        skuCode: transaction.sku.skuCode,
        skuDescription: transaction.sku.description,
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentUnits: 0,
        unitsPerCarton: transaction.sku.unitsPerCarton,
        warehouseId: transaction.warehouseId,
        warehouseName: transaction.warehouse.name,
        warehouseCode: transaction.warehouse.code,
        lastTransactionDate: null,
        firstReceiveDate: null,
        storageCartonsPerPallet: null,
        shippingCartonsPerPallet: null
      }

      // Update quantities
      current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
      current.currentUnits = current.currentCartons * (transaction.unitsPerCarton || transaction.sku.unitsPerCarton)
      current.lastTransactionDate = transaction.transactionDate

      // Track first receive date
      if (transaction.transactionType === 'RECEIVE' && !current.firstReceiveDate) {
        current.firstReceiveDate = transaction.transactionDate
      }

      // Capture pallet configuration from RECEIVE transactions
      if (transaction.transactionType === 'RECEIVE') {
        if (transaction.storageCartonsPerPallet) {
          current.storageCartonsPerPallet = transaction.storageCartonsPerPallet
        }
        if (transaction.shippingCartonsPerPallet) {
          current.shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
        }
      }

      balanceMap.set(key, current)
    }

    // Convert to array and include all batches (even with 0 inventory)
    let results = Array.from(balanceMap.values())

    // Sort by SKU code and batch
    results.sort((a, b) => {
      if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
      return a.batchLot.localeCompare(b.batchLot)
    })

    // Return results with inventory status
    const enhancedResults = results.map(item => ({
      ...item,
      hasInventory: item.currentCartons > 0,
      inventoryStatus: item.currentCartons > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'
    }))

    return NextResponse.json({
      data: enhancedResults,
      summary: {
        totalSKUs: new Set(results.map(r => r.skuId)).size,
        totalBatches: results.length,
        batchesWithInventory: results.filter(r => r.currentCartons > 0).length,
        batchesOutOfStock: results.filter(r => r.currentCartons === 0).length
      }
    })
  } catch (error) {
    console.error('Error calculating inventory from ledger:', error)
    return NextResponse.json(
      { error: 'Failed to calculate inventory from ledger' },
      { status: 500 }
    )
  }
}