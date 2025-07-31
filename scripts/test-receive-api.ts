// Direct database approach to verify costs are being calculated
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createReceiveAndCheckCosts() {
  console.log('Creating a RECEIVE transaction via direct database insert...')
  
  try {
    // First check if Vglobal warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { code: 'Vglobal' }
    })
    
    if (!warehouse) {
      console.error('Vglobal warehouse not found. Please run seed-cost-rates.ts first.')
      return
    }
    
    // Create a new transaction
    const transaction = await prisma.inventoryTransaction.create({
      data: {
        transactionId: `RCV-${Date.now()}`,
        transactionType: 'RECEIVE',
        transactionDate: new Date(),
        warehouseId: warehouse.id,
        trackingNumber: 'CONTAINER-TEST-001',
        createdById: 'system'
      }
    })
    
    console.log('\nCreated transaction:', transaction.transactionId)
    
    // Create transaction item
    const item = await prisma.inventoryTransactionItem.create({
      data: {
        transactionId: transaction.transactionId,
        skuId: 'TEST-SKU-API',
        batchLot: 'BATCH-API-001',
        quantityReceived: 100,
        unitsPerCarton: 10,
        cartonsPerPallet: 4,
        palletCount: 2.5
      }
    })
    
    console.log('Created item: SKU', item.skuId, 'Quantity:', item.quantityReceived)
    
    // Wait a moment for triggers to execute
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check for calculated costs
    const costs = await prisma.calculatedCost.findMany({
      where: {
        transactionReferenceId: transaction.transactionId
      },
      include: {
        costRate: true
      }
    })
    
    if (costs.length > 0) {
      console.log('\n✅ Calculated costs were created automatically!')
      console.log(`Total costs: ${costs.length}`)
      console.log('\nCost breakdown:')
      
      let totalCost = 0
      costs.forEach(cost => {
        console.log(`- ${cost.costRate.costName}: $${cost.calculatedCost} (${cost.quantityCharged} ${cost.costRate.unitOfMeasure})`)
        totalCost += parseFloat(cost.calculatedCost.toString())
      })
      
      console.log(`\nTotal cost: $${totalCost.toFixed(2)}`)
    } else {
      console.log('\n❌ No calculated costs found. Trigger may not be working.')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function createShipAndCheckCosts() {
  console.log('\n\nCreating a SHIP transaction via direct database insert...')
  
  try {
    // First check if FMC warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { code: 'FMC' }
    })
    
    if (!warehouse) {
      console.error('FMC warehouse not found. Please run seed-cost-rates.ts first.')
      return
    }
    
    // Create a ship transaction
    const transaction = await prisma.inventoryTransaction.create({
      data: {
        transactionId: `SHIP-${Date.now()}`,
        transactionType: 'SHIP',
        transactionDate: new Date(),
        warehouseId: warehouse.id,
        trackingNumber: 'LTL-SHIP-001',
        createdById: 'system'
      }
    })
    
    console.log('\nCreated transaction:', transaction.transactionId)
    
    // Create transaction item
    const item = await prisma.inventoryTransactionItem.create({
      data: {
        transactionId: transaction.transactionId,
        skuId: 'TEST-SKU-SHIP',
        batchLot: 'BATCH-SHIP-001',
        quantityShipped: 50,
        palletCount: 1.25
      }
    })
    
    console.log('Created item: SKU', item.skuId, 'Quantity:', item.quantityShipped)
    
    // Wait for triggers
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check for calculated costs
    const costs = await prisma.calculatedCost.findMany({
      where: {
        transactionReferenceId: transaction.transactionId
      },
      include: {
        costRate: true
      }
    })
    
    if (costs.length > 0) {
      console.log('\n✅ Calculated costs were created automatically!')
      console.log(`Total costs: ${costs.length}`)
      console.log('\nCost breakdown:')
      
      let totalCost = 0
      costs.forEach(cost => {
        console.log(`- ${cost.costRate.costName}: $${cost.calculatedCost} (${cost.quantityCharged} ${cost.costRate.unitOfMeasure})`)
        totalCost += parseFloat(cost.calculatedCost.toString())
      })
      
      console.log(`\nTotal cost: $${totalCost.toFixed(2)}`)
    } else {
      console.log('\n❌ No calculated costs found. Trigger may not be working.')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  console.log('Testing cost calculation feature...\n')
  
  // Check if warehouses and cost rates exist
  const warehouses = await prisma.warehouse.count({
    where: { code: { in: ['FMC', 'Vglobal'] } }
  })
  
  if (warehouses !== 2) {
    console.error('Warehouses not found. Please run create-warehouses.ts and seed-cost-rates.ts first.')
    await prisma.$disconnect()
    return
  }
  
  const costRates = await prisma.costRate.count()
  console.log(`Found ${costRates} cost rates in the database.`)
  
  if (costRates === 0) {
    console.error('No cost rates found. Please run seed-cost-rates.ts first.')
    await prisma.$disconnect()
    return
  }
  
  await createReceiveAndCheckCosts()
  await createShipAndCheckCosts()
}

main()