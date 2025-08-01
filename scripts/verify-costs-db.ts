#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyCostCalculations() {
  try {
    console.log('🔍 Cost Calculation Database Verification')
    console.log('========================================\n')
    
    // Get recent transactions
    const recentTransactions = await prisma.inventoryTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    console.log(`📦 Recent Transactions: ${recentTransactions.length}`)
    
    for (const txn of recentTransactions) {
      console.log(`\n${txn.transactionType} - ${txn.transactionId}`)
      console.log(`  Reference: ${txn.referenceId}`)
      console.log(`  Date: ${txn.transactionDate.toISOString().split('T')[0]}`)
      console.log(`  SKU: ${txn.sku.skuCode}`)
      console.log(`  Batch: ${txn.batchLot}`)
      
      if (txn.transactionType === 'RECEIVE') {
        console.log(`  Cartons In: ${txn.cartonsIn}`)
        console.log(`  Pallets In: ${txn.storagePalletsIn}`)
      } else if (txn.transactionType === 'SHIP') {
        console.log(`  Cartons Out: ${txn.cartonsOut}`)
        console.log(`  Pallets Out: ${txn.shippingPalletsOut}`)
      }
      
      // Get calculated costs for this transaction
      const costs = await prisma.calculatedCost.findMany({
        where: { transactionReferenceId: txn.transactionId },
        include: { costRate: true }
      })
      
      if (costs.length > 0) {
        console.log(`  💰 Costs (${costs.length} entries):`)
        let total = 0
        for (const cost of costs) {
          const amount = Number(cost.calculatedCost)
          total += amount
          console.log(`     - ${cost.costRate.costName}: $${amount.toFixed(2)}`)
        }
        console.log(`     TOTAL: $${total.toFixed(2)}`)
      } else {
        console.log(`  ⚠️  No costs calculated`)
      }
    }
    
    // Summary statistics
    console.log('\n\n📊 Cost Calculation Summary')
    console.log('===========================')
    
    const costsByType = await prisma.calculatedCost.groupBy({
      by: ['transactionType'],
      _count: true,
      _sum: {
        calculatedCost: true
      }
    })
    
    for (const type of costsByType) {
      console.log(`\n${type.transactionType}:`)
      console.log(`  Count: ${type._count} entries`)
      console.log(`  Total: $${Number(type._sum.calculatedCost || 0).toFixed(2)}`)
    }
    
    // Check for transactions without costs
    const transactionsWithoutCosts = await prisma.$queryRaw`
      SELECT it.transaction_id, it.transaction_type, it.transaction_date
      FROM inventory_transactions it
      WHERE it.transaction_type IN ('RECEIVE', 'SHIP')
      AND NOT EXISTS (
        SELECT 1 FROM calculated_costs cc
        WHERE cc.transaction_reference_id = it.transaction_id
      )
      ORDER BY it.transaction_date DESC
      LIMIT 10
    ` as any[]
    
    if (transactionsWithoutCosts.length > 0) {
      console.log('\n\n⚠️  Transactions Without Costs:')
      for (const txn of transactionsWithoutCosts) {
        console.log(`  - ${txn.transaction_id} (${txn.transaction_type})`)
      }
    } else {
      console.log('\n\n✅ All RECEIVE/SHIP transactions have calculated costs!')
    }
    
    // Check cost rates
    const activeRates = await prisma.costRate.count({
      where: { isActive: true }
    })
    
    console.log(`\n📋 Active Cost Rates: ${activeRates}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyCostCalculations()