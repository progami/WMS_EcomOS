#!/usr/bin/env tsx
import { PrismaClient, CostCategory, TransactionType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

function getWeekEndingDate(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  result.setDate(result.getDate() + daysUntilSaturday)
  result.setHours(23, 59, 59, 999)
  return result
}

function getBillingPeriod(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

async function calculateCostsForTransaction(txn: any) {
  const costRates = await prisma.costRate.findMany({
    where: {
      warehouseId: txn.warehouseId,
      isActive: true,
      effectiveDate: { lte: txn.transactionDate },
      OR: [
        { endDate: null },
        { endDate: { gte: txn.transactionDate } }
      ]
    }
  })
  
  if (costRates.length === 0) {
    console.log(`  ⚠️  No active cost rates found for warehouse`)
    return 0
  }
  
  const billingPeriod = getBillingPeriod(txn.transactionDate)
  const billingWeekEnding = getWeekEndingDate(txn.transactionDate)
  const calculatedCosts = []
  let totalCartons = 0
  let totalPallets = 0
  
  if (txn.transactionType === 'RECEIVE') {
    totalCartons = txn.cartonsIn
    totalPallets = txn.storagePalletsIn
    
    // Container costs
    if (txn.trackingNumber) {
      const containerRates = costRates.filter(rate => 
        rate.costCategory === CostCategory.Container ||
        rate.costName.toLowerCase().includes('container') ||
        rate.costName.toLowerCase().includes('terminal') ||
        rate.costName.toLowerCase().includes('port') ||
        rate.costName.toLowerCase().includes('customs') ||
        rate.costName.toLowerCase().includes('documentation') ||
        rate.costName.toLowerCase().includes('deferment') ||
        rate.costName.toLowerCase().includes('haulage') ||
        rate.costName.toLowerCase().includes('freight')
      )
      
      containerRates.forEach((rate, index) => {
        const quantity = 1
        const calculatedCost = new Decimal(rate.costValue).mul(quantity)
        
        calculatedCosts.push({
          calculatedCostId: `${txn.transactionId}-${rate.costName.replace(/\s+/g, '-').toLowerCase()}-${index}`,
          transactionType: txn.transactionType,
          transactionReferenceId: txn.transactionId,
          costRateId: rate.id,
          warehouseId: txn.warehouseId,
          skuId: txn.skuId,
          batchLot: txn.batchLot,
          transactionDate: txn.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(quantity),
          applicableRate: rate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: txn.createdById
        })
      })
    }
    
    // Carton unloading
    const cartonUnloadingRate = costRates.find(rate => 
      rate.costCategory === CostCategory.Carton &&
      rate.costName.toLowerCase().includes('unloading')
    )
    
    if (cartonUnloadingRate && totalCartons > 0) {
      const calculatedCost = new Decimal(cartonUnloadingRate.costValue).mul(totalCartons)
      
      calculatedCosts.push({
        calculatedCostId: `${txn.transactionId}-carton-unloading-0`,
        transactionType: txn.transactionType,
        transactionReferenceId: txn.transactionId,
        costRateId: cartonUnloadingRate.id,
        warehouseId: txn.warehouseId,
        skuId: txn.skuId,
        batchLot: txn.batchLot,
        transactionDate: txn.transactionDate,
        billingWeekEnding: billingWeekEnding,
        billingPeriodStart: billingPeriod.start,
        billingPeriodEnd: billingPeriod.end,
        quantityCharged: new Decimal(totalCartons),
        applicableRate: cartonUnloadingRate.costValue,
        calculatedCost: calculatedCost,
        costAdjustmentValue: new Decimal(0),
        finalExpectedCost: calculatedCost,
        createdById: txn.createdById
      })
    }
    
    // Pallet handling
    const palletHandlingRate = costRates.find(rate => 
      rate.costCategory === CostCategory.Pallet &&
      rate.costName.toLowerCase().includes('handling')
    )
    
    if (palletHandlingRate && totalPallets > 0) {
      const calculatedCost = new Decimal(palletHandlingRate.costValue).mul(totalPallets)
      
      calculatedCosts.push({
        calculatedCostId: `${txn.transactionId}-pallet-handling-0`,
        transactionType: txn.transactionType,
        transactionReferenceId: txn.transactionId,
        costRateId: palletHandlingRate.id,
        warehouseId: txn.warehouseId,
        skuId: txn.skuId,
        batchLot: txn.batchLot,
        transactionDate: txn.transactionDate,
        billingWeekEnding: billingWeekEnding,
        billingPeriodStart: billingPeriod.start,
        billingPeriodEnd: billingPeriod.end,
        quantityCharged: new Decimal(totalPallets),
        applicableRate: palletHandlingRate.costValue,
        calculatedCost: calculatedCost,
        costAdjustmentValue: new Decimal(0),
        finalExpectedCost: calculatedCost,
        createdById: txn.createdById
      })
    }
    
  } else if (txn.transactionType === 'SHIP') {
    totalCartons = txn.cartonsOut
    totalPallets = txn.shippingPalletsOut
    
    // Carton handling
    const cartonHandlingRate = costRates.find(rate => 
      rate.costCategory === CostCategory.Carton &&
      rate.costName.toLowerCase().includes('handling') &&
      !rate.costName.toLowerCase().includes('unloading')
    )
    
    if (cartonHandlingRate && totalCartons > 0) {
      const calculatedCost = new Decimal(cartonHandlingRate.costValue).mul(totalCartons)
      
      calculatedCosts.push({
        calculatedCostId: `${txn.transactionId}-carton-handling-0`,
        transactionType: txn.transactionType,
        transactionReferenceId: txn.transactionId,
        costRateId: cartonHandlingRate.id,
        warehouseId: txn.warehouseId,
        skuId: txn.skuId,
        batchLot: txn.batchLot,
        transactionDate: txn.transactionDate,
        billingWeekEnding: billingWeekEnding,
        billingPeriodStart: billingPeriod.start,
        billingPeriodEnd: billingPeriod.end,
        quantityCharged: new Decimal(totalCartons),
        applicableRate: cartonHandlingRate.costValue,
        calculatedCost: calculatedCost,
        costAdjustmentValue: new Decimal(0),
        finalExpectedCost: calculatedCost,
        createdById: txn.createdById
      })
    }
    
    // Pallet handling
    const palletHandlingRate = costRates.find(rate => 
      rate.costCategory === CostCategory.Pallet &&
      rate.costName.toLowerCase().includes('handling')
    )
    
    if (palletHandlingRate && totalPallets > 0) {
      const calculatedCost = new Decimal(palletHandlingRate.costValue).mul(totalPallets)
      
      calculatedCosts.push({
        calculatedCostId: `${txn.transactionId}-pallet-handling-0`,
        transactionType: txn.transactionType,
        transactionReferenceId: txn.transactionId,
        costRateId: palletHandlingRate.id,
        warehouseId: txn.warehouseId,
        skuId: txn.skuId,
        batchLot: txn.batchLot,
        transactionDate: txn.transactionDate,
        billingWeekEnding: billingWeekEnding,
        billingPeriodStart: billingPeriod.start,
        billingPeriodEnd: billingPeriod.end,
        quantityCharged: new Decimal(totalPallets),
        applicableRate: palletHandlingRate.costValue,
        calculatedCost: calculatedCost,
        costAdjustmentValue: new Decimal(0),
        finalExpectedCost: calculatedCost,
        createdById: txn.createdById
      })
    }
    
    // Transport costs
    if (txn.trackingNumber) {
      const ltlRate = costRates.find(rate => rate.costName.toUpperCase() === 'LTL')
      
      if (ltlRate) {
        const quantity = 1
        const calculatedCost = new Decimal(ltlRate.costValue).mul(quantity)
        
        calculatedCosts.push({
          calculatedCostId: `${txn.transactionId}-ltl-0`,
          transactionType: txn.transactionType,
          transactionReferenceId: txn.transactionId,
          costRateId: ltlRate.id,
          warehouseId: txn.warehouseId,
          skuId: txn.skuId,
          batchLot: txn.batchLot,
          transactionDate: txn.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(quantity),
          applicableRate: ltlRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: txn.createdById
        })
      }
    }
  }
  
  // Create all calculated costs
  if (calculatedCosts.length > 0) {
    await prisma.calculatedCost.createMany({
      data: calculatedCosts,
      skipDuplicates: true
    })
  }
  
  return calculatedCosts.length
}

async function main() {
  try {
    console.log('💰 Calculating missing costs for existing transactions...\n')
    
    // Get transactions without costs
    const transactionsWithoutCosts = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['RECEIVE', 'SHIP'] }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    // Check which ones actually don't have costs
    const missingCosts = []
    for (const txn of transactionsWithoutCosts) {
      const costCount = await prisma.calculatedCost.count({
        where: { transactionReferenceId: txn.transactionId }
      })
      if (costCount === 0) {
        missingCosts.push(txn)
      }
    }
    
    console.log(`Found ${missingCosts.length} transactions without calculated costs\n`)
    
    let totalCreated = 0
    for (const txn of missingCosts) {
      console.log(`Processing ${txn.transactionId} (${txn.transactionType})...`)
      
      try {
        const created = await calculateCostsForTransaction(txn)
        totalCreated += created
        console.log(`  ✅ Created ${created} cost entries`)
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`)
      }
    }
    
    console.log(`\n✅ Total cost entries created: ${totalCreated}`)
    
    // Show final summary
    console.log('\n📊 Final Summary')
    console.log('================')
    
    const costsByType = await prisma.calculatedCost.groupBy({
      by: ['transactionType'],
      _count: true,
      _sum: {
        calculatedCost: true
      }
    })
    
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

main()