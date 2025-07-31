import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function demonstrateCostCalculation() {
  console.log('=== Cost Calculation Feature Demonstration ===\n')
  
  // Show warehouses and their cost rates
  const warehouses = await prisma.warehouse.findMany({
    where: { code: { in: ['FMC', 'Vglobal'] } },
    include: {
      costRates: {
        select: {
          costName: true,
          costValue: true,
          unitOfMeasure: true,
          costCategory: true
        }
      }
    }
  })
  
  for (const warehouse of warehouses) {
    console.log(`📍 ${warehouse.name} (${warehouse.code})`)
    console.log(`   Cost rates: ${warehouse.costRates.length}`)
    
    // Cost rates apply to both RECEIVE and SHIP based on category
    const containerRates = warehouse.costRates.filter(r => 
      r.costCategory === 'CONTAINER_RELATED' || 
      r.costCategory === 'PORT_FEES'
    ).length
    const handlingRates = warehouse.costRates.filter(r => 
      r.costCategory === 'WAREHOUSE_OPERATIONS'
    ).length
    const transportRates = warehouse.costRates.filter(r => 
      r.costCategory === 'TRANSPORT'
    ).length
    
    console.log(`   - Container/Port rates: ${containerRates}`)
    console.log(`   - Handling rates: ${handlingRates}`)
    console.log(`   - Transport rates: ${transportRates}`)
    console.log()
  }
  
  // Show recent transactions with calculated costs
  console.log('📦 Recent Transactions with Automatic Cost Calculation:\n')
  
  const recentTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      warehouse: {
        code: { in: ['FMC', 'Vglobal'] }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      warehouse: true,
      calculatedCosts: {
        include: {
          costRate: true
        }
      }
    }
  })
  
  for (const tx of recentTransactions) {
    console.log(`Transaction: ${tx.transactionId}`)
    console.log(`Type: ${tx.transactionType}`)
    console.log(`Warehouse: ${tx.warehouse.name}`)
    console.log(`Date: ${tx.transactionDate.toLocaleDateString()}`)
    
    if (tx.calculatedCosts.length > 0) {
      console.log(`\n✅ Costs automatically calculated:`)
      
      let total = 0
      const costsByCategory = {
        container: [] as any[],
        handling: [] as any[],
        transport: [] as any[]
      }
      
      tx.calculatedCosts.forEach(cost => {
        const amount = parseFloat(cost.calculatedCost.toString())
        total += amount
        
        // Categorize costs
        if (cost.costRate.costName.toLowerCase().includes('container') || 
            cost.costRate.costName.toLowerCase().includes('port') ||
            cost.costRate.costName.toLowerCase().includes('terminal') ||
            cost.costRate.costName.toLowerCase().includes('customs')) {
          costsByCategory.container.push({ name: cost.costRate.costName, amount })
        } else if (cost.costRate.costName.toLowerCase().includes('ltl') || 
                   cost.costRate.costName.toLowerCase().includes('ftl') ||
                   cost.costRate.costName.toLowerCase().includes('freight') ||
                   cost.costRate.costName.toLowerCase().includes('haulage')) {
          costsByCategory.transport.push({ name: cost.costRate.costName, amount })
        } else {
          costsByCategory.handling.push({ name: cost.costRate.costName, amount })
        }
      })
      
      // Display costs by category
      if (costsByCategory.container.length > 0) {
        console.log('\n   Container/Port Costs:')
        costsByCategory.container.forEach(c => 
          console.log(`   - ${c.name}: $${c.amount.toFixed(2)}`)
        )
      }
      
      if (costsByCategory.handling.length > 0) {
        console.log('\n   Handling Costs:')
        costsByCategory.handling.forEach(c => 
          console.log(`   - ${c.name}: $${c.amount.toFixed(2)}`)
        )
      }
      
      if (costsByCategory.transport.length > 0) {
        console.log('\n   Transport Costs:')
        costsByCategory.transport.forEach(c => 
          console.log(`   - ${c.name}: $${c.amount.toFixed(2)}`)
        )
      }
      
      console.log(`\n   💰 Total: $${total.toFixed(2)}`)
    } else {
      console.log(`\n❌ No costs calculated (transaction may be from a warehouse without cost rates)`)
    }
    
    console.log('\n' + '─'.repeat(60) + '\n')
  }
  
  // Summary
  const totalCosts = await prisma.calculatedCost.count({
    where: {
      transaction: {
        warehouse: {
          code: { in: ['FMC', 'Vglobal'] }
        }
      }
    }
  })
  
  console.log(`📊 Summary:`)
  console.log(`   - Total calculated cost records: ${totalCosts}`)
  console.log(`   - Cost calculation is triggered automatically when transactions are created`)
  console.log(`   - Costs cascade based on transaction type:`)
  console.log(`     • RECEIVE: Container costs + Carton unloading + Pallet handling`)
  console.log(`     • SHIP: Carton handling + Pallet handling + Transport (LTL/FTL)`)
  
  await prisma.$disconnect()
}

demonstrateCostCalculation()