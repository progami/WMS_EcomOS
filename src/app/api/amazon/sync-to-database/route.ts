import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { inventory } = await request.json()
    
    if (!inventory || !Array.isArray(inventory)) {
      return NextResponse.json(
        { error: 'Invalid inventory data' },
        { status: 400 }
      )
    }
    
    // Get Amazon warehouse
    const amazonWarehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: 'AMZN-UK' },
          { code: 'AMZN' }
        ]
      }
    })
    
    if (!amazonWarehouse) {
      return NextResponse.json(
        { error: 'Amazon warehouse not found. Please run setup first.' },
        { status: 400 }
      )
    }
    
    let synced = 0
    const errors = []
    
    // Process each inventory item
    for (const item of inventory) {
      try {
        // Skip items with no Amazon quantity
        if (!item.amazonQty || item.amazonQty === 0) {
          continue
        }
        
        // Find the SKU
        const sku = await prisma.sku.findFirst({
          where: { skuCode: item.sku }
        })
        
        if (!sku) {
          errors.push(`SKU not found: ${item.sku}`)
          continue
        }
        
        // Convert units to cartons
        const cartons = Math.ceil(item.amazonQty / (sku.unitsPerCarton || 1))
        const batchLot = `AMZN-${new Date().getFullYear()}`
        
        // Simply update the balance without creating transactions
        // This keeps Amazon FBA separate from the inventory ledger
        const currentBalance = await prisma.inventoryBalance.findUnique({
          where: {
            warehouseId_skuId_batchLot: {
              warehouseId: amazonWarehouse.id,
              skuId: sku.id,
              batchLot: batchLot
            }
          }
        })
        
        if (currentBalance) {
          // Update existing balance
          await prisma.inventoryBalance.update({
            where: { id: currentBalance.id },
            data: {
              currentCartons: cartons,
              currentUnits: item.amazonQty,
              lastUpdated: new Date()
            }
          })
        } else {
          // Create new balance
          await prisma.inventoryBalance.create({
            data: {
              warehouseId: amazonWarehouse.id,
              skuId: sku.id,
              batchLot: batchLot,
              currentCartons: cartons,
              currentPallets: 0, // Amazon doesn't use pallets
              currentUnits: item.amazonQty,
              lastTransactionDate: new Date(),
              storageCartonsPerPallet: 0, // Amazon uses cubic feet
              shippingCartonsPerPallet: 0
            }
          })
        }
        
        synced++
      } catch (itemError) {
        // console.error(`Error syncing item ${item.sku}:`, itemError)
        errors.push({
          sku: item.sku,
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      synced,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${synced} items to Amazon FBA warehouse`
    })
  } catch (error) {
    // console.error('Error syncing to database:', error)
    return NextResponse.json(
      { error: 'Failed to sync inventory to database' },
      { status: 500 }
    )
  }
}