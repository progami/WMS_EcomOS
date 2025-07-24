import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const skuCode = params.id // Using id parameter but it contains skuCode
    
    // Get the SKU
    const sku = await prisma.sku.findFirst({
      where: { skuCode }
    })
    
    if (!sku) {
      return NextResponse.json(
        { message: 'SKU not found' },
        { status: 404 }
      )
    }

    // Find all batch numbers for this SKU from all sources
    const [transactionBatches, balanceBatches, ledgerBatches] = await Promise.all([
      // Check inventory transactions
      prisma.inventoryTransaction.findMany({
        where: {
          skuId: sku.id,
          batchLot: {
            not: {
              in: ['', 'N/A', 'NA', '-']
            }
          }
        },
        select: {
          batchLot: true
        },
        distinct: ['batchLot']
      }),
      // Check current inventory balances
      prisma.inventoryBalance.findMany({
        where: {
          skuId: sku.id,
          batchLot: {
            not: {
              in: ['', 'N/A', 'NA', '-']
            }
          }
        },
        select: {
          batchLot: true
        },
        distinct: ['batchLot']
      }),
      // Check storage ledger for historical batches
      prisma.storageLedger.findMany({
        where: {
          skuId: sku.id,
          batchLot: {
            not: {
              in: ['', 'N/A', 'NA', '-']
            }
          }
        },
        select: {
          batchLot: true
        },
        distinct: ['batchLot']
      })
    ])
    
    // Combine all batches and remove duplicates
    const allBatchLots = new Set<string>()
    transactionBatches.forEach(t => allBatchLots.add(t.batchLot))
    balanceBatches.forEach(b => allBatchLots.add(b.batchLot))
    ledgerBatches.forEach(l => allBatchLots.add(l.batchLot))
    
    const allBatches = Array.from(allBatchLots).map(batchLot => ({ batchLot }))

    let nextBatchNumber = 1
    let lastBatch: string | null = null
    
    if (allBatches.length > 0) {
      // Only consider purely numeric batch lots
      const numericBatches = allBatches
        .filter(t => /^\d+$/.test(t.batchLot))
        .map(t => parseInt(t.batchLot))
        .filter(n => !isNaN(n) && n > 0)
      
      if (numericBatches.length > 0) {
        const maxBatch = Math.max(...numericBatches)
        nextBatchNumber = maxBatch + 1
        lastBatch = maxBatch.toString()
      } else {
        // If no numeric batches exist, start from 1
        nextBatchNumber = 1
      }
    }

    return NextResponse.json({
      skuCode,
      lastBatch: lastBatch,
      nextBatchNumber,
      suggestedBatchLot: `${nextBatchNumber}`
    })
  } catch (error) {
    // console.error('Error getting next batch number:', error)
    return NextResponse.json(
      { message: 'Failed to get next batch number' },
      { status: 500 }
    )
  }
}