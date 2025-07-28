import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanPhantomBalances() {
  console.log('🔍 Finding phantom inventory balances without transactions...')
  
  try {
    // Get all inventory balances
    const balances = await prisma.inventoryBalance.findMany({
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    console.log(`Found ${balances.length} total inventory balances`)
    
    let phantomCount = 0
    const phantomBalances = []
    
    // Check each balance for corresponding transactions
    for (const balance of balances) {
      const transactionCount = await prisma.inventoryTransaction.count({
        where: {
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          batchLot: balance.batchLot
        }
      })
      
      if (transactionCount === 0) {
        phantomCount++
        phantomBalances.push(balance)
        console.log(`❌ Phantom balance found: ${balance.warehouse.code} - ${balance.sku.skuCode} - Batch ${balance.batchLot} (${balance.currentCartons} cartons)`)
      }
    }
    
    if (phantomCount === 0) {
      console.log('✅ No phantom balances found!')
      return
    }
    
    console.log(`\n⚠️  Found ${phantomCount} phantom balances without transactions`)
    
    // Ask for confirmation before deleting
    console.log('\n🗑️  Deleting phantom balances...')
    
    for (const phantom of phantomBalances) {
      await prisma.inventoryBalance.delete({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId: phantom.warehouseId,
            skuId: phantom.skuId,
            batchLot: phantom.batchLot
          }
        }
      })
    }
    
    console.log(`✅ Deleted ${phantomCount} phantom inventory balances`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanPhantomBalances()