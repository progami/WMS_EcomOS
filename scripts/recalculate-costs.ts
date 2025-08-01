#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { triggerCostCalculation, type Transaction } from '../src/lib/triggers/inventory-transaction-triggers'

const prisma = new PrismaClient()

async function recalculateAllCosts() {
  try {
    console.log('🔄 Recalculating costs for all transactions...\n')
    
    // Get all RECEIVE and SHIP transactions without costs
    const transactionsWithoutCosts = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['RECEIVE', 'SHIP'] },
        NOT: {
          transactionId: {
            in: await prisma.calculatedCost.findMany({
              select: { transactionReferenceId: true },
              distinct: ['transactionReferenceId']
            }).then(costs => costs.map(c => c.transactionReferenceId))
          }
        }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    console.log(`Found ${transactionsWithoutCosts.length} transactions without calculated costs\n`)
    
    for (const txn of transactionsWithoutCosts) {
      console.log(`Processing ${txn.transactionId}...`)
      
      try {
        // Prepare transaction data for cost calculation
        const transactionData: Transaction = {
          transactionId: txn.transactionId,
          transactionType: txn.transactionType,
          warehouseId: txn.warehouseId,
          transactionDate: txn.transactionDate,
          trackingNumber: txn.trackingNumber,
          createdById: txn.createdById,
          items: [{
            skuId: txn.skuId,
            batchLot: txn.batchLot,
            quantityReceived: txn.cartonsIn || 0,
            quantityShipped: txn.cartonsOut || 0,
            unitsPerCarton: txn.unitsPerCarton || txn.sku.unitsPerCarton || 1,
            cartonsPerPallet: txn.storageCartonsPerPallet || txn.shippingCartonsPerPallet || 20,
            palletCount: txn.transactionType === 'RECEIVE' ? 
              txn.storagePalletsIn : txn.shippingPalletsOut
          }]
        }
        
        // Trigger cost calculation
        await triggerCostCalculation(transactionData)
        
        // Verify costs were created
        const createdCosts = await prisma.calculatedCost.count({
          where: { transactionReferenceId: txn.transactionId }
        })
        
        console.log(`  ✅ Created ${createdCosts} cost entries for ${txn.transactionId}`)
        
      } catch (error) {
        console.log(`  ❌ Failed to calculate costs for ${txn.transactionId}:`, error)
      }
    }
    
    // Show summary
    console.log('\n📊 Recalculation Summary')
    console.log('========================')
    
    const totalCosts = await prisma.calculatedCost.count()
    const costsByType = await prisma.calculatedCost.groupBy({
      by: ['transactionType'],
      _count: true,
      _sum: {
        calculatedCost: true
      }
    })
    
    console.log(`Total cost entries: ${totalCosts}`)
    
    for (const type of costsByType) {
      console.log(`\n${type.transactionType}:`)
      console.log(`  Entries: ${type._count}`)
      console.log(`  Total: $${Number(type._sum.calculatedCost || 0).toFixed(2)}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  recalculateAllCosts()
}