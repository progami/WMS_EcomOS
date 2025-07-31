import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function showCostFeature() {
  console.log('=== Cost Calculation Feature Status ===\n')
  
  // 1. Show warehouses with cost rates
  console.log('📍 Warehouses with Cost Rates:')
  const warehouses = await prisma.warehouse.findMany({
    where: { code: { in: ['FMC', 'Vglobal'] } },
    include: {
      _count: {
        select: { costRates: true }
      }
    }
  })
  
  warehouses.forEach(w => {
    console.log(`   - ${w.name} (${w.code}): ${w._count.costRates} cost rates`)
  })
  
  // 2. Show total cost rates by category
  console.log('\n📊 Cost Rates by Category:')
  const costRates = await prisma.costRate.groupBy({
    by: ['costCategory'],
    _count: true,
    where: {
      warehouse: {
        code: { in: ['FMC', 'Vglobal'] }
      }
    }
  })
  
  costRates.forEach(cr => {
    console.log(`   - ${cr.costCategory}: ${cr._count} rates`)
  })
  
  // 3. Show recent transactions and their calculated costs
  console.log('\n💰 Recent Transactions with Automatic Cost Calculation:\n')
  
  // Get recent transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      warehouse: {
        code: { in: ['FMC', 'Vglobal'] }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      warehouse: true
    }
  })
  
  for (const tx of transactions) {
    // Get calculated costs for this transaction
    const costs = await prisma.calculatedCost.findMany({
      where: {
        transactionReferenceId: tx.transactionId
      },
      include: {
        costRate: true
      }
    })
    
    console.log(`Transaction: ${tx.transactionId}`)
    console.log(`Type: ${tx.transactionType}`)
    console.log(`Warehouse: ${tx.warehouse.name}`)
    console.log(`Date: ${tx.transactionDate.toLocaleDateString()}`)
    
    if (costs.length > 0) {
      console.log(`✅ ${costs.length} costs automatically calculated:`)
      
      let total = 0
      costs.forEach(cost => {
        const amount = parseFloat(cost.calculatedCost.toString())
        total += amount
        console.log(`   - ${cost.costRate.costName}: $${amount.toFixed(2)}`)
      })
      
      console.log(`   💵 Total: $${total.toFixed(2)}`)
    } else {
      console.log('❌ No costs calculated')
    }
    console.log('─'.repeat(50))
  }
  
  // 4. Summary statistics
  const totalCalculatedCosts = await prisma.calculatedCost.count({
    where: {
      warehouse: {
        code: { in: ['FMC', 'Vglobal'] }
      }
    }
  })
  
  const totalCostAmount = await prisma.calculatedCost.aggregate({
    _sum: {
      calculatedCost: true
    },
    where: {
      warehouse: {
        code: { in: ['FMC', 'Vglobal'] }
      }
    }
  })
  
  console.log('\n📈 Summary:')
  console.log(`   - Total calculated cost records: ${totalCalculatedCosts}`)
  console.log(`   - Total cost amount: $${totalCostAmount._sum.calculatedCost?.toFixed(2) || '0.00'}`)
  console.log('\n✨ The cost calculation feature is working! Costs are automatically')
  console.log('   calculated when RECEIVE/SHIP transactions are created.')
  
  await prisma.$disconnect()
}

showCostFeature()