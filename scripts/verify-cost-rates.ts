#!/usr/bin/env tsx
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { prompt } from 'readline'

const prisma = new PrismaClient()

async function verifyAllCosts() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slow down to see actions
  })
  const page = await browser.newPage()
  
  try {
    console.log('🚀 COST RATES VERIFICATION SCRIPT')
    console.log('=================================\n')
    
    // STEP 0: Clean all transactions
    console.log('🧹 STEP 0: Cleaning all transactions and costs...')
    
    await prisma.$transaction(async (tx) => {
      const deletedCosts = await tx.calculatedCost.deleteMany({})
      const deletedBalances = await tx.inventoryBalance.deleteMany({})
      const deletedTransactions = await tx.inventoryTransaction.deleteMany({})
      
      console.log(`  ✅ Deleted ${deletedTransactions.count} transactions`)
      console.log(`  ✅ Deleted ${deletedBalances.count} inventory balances`)
      console.log(`  ✅ Deleted ${deletedCosts.count} calculated costs`)
    })
    
    // Verify warehouse and cost rates exist
    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'FMC' } })
    if (!warehouse) {
      throw new Error('❌ FMC warehouse not found. Please run: tsx scripts/setup-cost-rates.ts')
    }
    
    const costRates = await prisma.costRate.findMany({ 
      where: { warehouseId: warehouse.id, isActive: true } 
    })
    
    console.log(`\n📊 Active Cost Rates for FMC:`)
    costRates.forEach(rate => {
      console.log(`  - ${rate.costName}: $${rate.costValue} per ${rate.unitOfMeasure}`)
    })
    
    if (costRates.length === 0) {
      throw new Error('❌ No cost rates found. Please run: tsx scripts/setup-cost-rates.ts')
    }
    
    // STEP 1: Create RECEIVE transactions
    console.log('\n📦 STEP 1: Creating RECEIVE transactions...')
    
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    
    // Create RECEIVE with multiple items
    await page.click('button:has-text("New Transaction")')
    await page.waitForSelector('h3:has-text("New Inventory Transaction")')
    
    await page.click('button[value="RECEIVE"]')
    await page.fill('input[placeholder="Enter PI/CI/PO number"]', 'PO-TEST-001')
    await page.fill('input[type="date"]', '2025-08-01')
    await page.fill('input[placeholder="Vessel/Flight name"]', 'CONTAINER-TEST-001')
    await page.fill('input[placeholder="e.g., John Doe Imports"]', 'Test Supplier Inc')
    
    // Add test items with known quantities
    const receiveItems = [
      { sku: 'TEST-SKU-001', batch: '202508', cartons: 500, storage: 20, shipping: 25, units: 12 },
      { sku: 'TEST-SKU-002', batch: '202508', cartons: 300, storage: 15, shipping: 20, units: 10 }
    ]
    
    for (const [index, item] of receiveItems.entries()) {
      if (index > 0) {
        await page.click('button:has-text("Add Item")')
      }
      
      const itemSelector = `div:has(> h4:has-text("Item ${index + 1}"))`
      await page.fill(`${itemSelector} input[placeholder="Enter SKU code"]`, item.sku)
      await page.fill(`${itemSelector} input[placeholder="Batch/Lot number"]`, item.batch)
      await page.fill(`${itemSelector} input[placeholder="Number of cartons"]`, item.cartons.toString())
      await page.fill(`${itemSelector} input[placeholder="Cartons per pallet (storage)"]`, item.storage.toString())
      await page.fill(`${itemSelector} input[placeholder="Cartons per pallet (shipping)"]`, item.shipping.toString())
      await page.fill(`${itemSelector} input[placeholder="Units per carton"]`, item.units.toString())
    }
    
    await page.click('button:has-text("Create Transaction")')
    await page.waitForSelector('text=/success|created/i', { timeout: 10000 })
    await page.waitForTimeout(3000) // Wait for cost calculations
    
    console.log('  ✅ RECEIVE transaction created successfully')
    
    // Check RECEIVE costs
    const receiveCosts = await prisma.calculatedCost.findMany({
      where: { transactionType: 'RECEIVE' },
      include: { costRate: true },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log(`\n  💰 RECEIVE Costs Generated:`)
    let receiveTotal = 0
    receiveCosts.forEach(cost => {
      const amount = Number(cost.calculatedCost)
      receiveTotal += amount
      console.log(`    - ${cost.costRate.costName}: $${amount.toFixed(2)} (${cost.quantityCharged} × $${cost.applicableRate})`)
    })
    console.log(`    TOTAL RECEIVE COSTS: $${receiveTotal.toFixed(2)}`)
    
    // STEP 2: Create SHIP transaction
    console.log('\n🚚 STEP 2: Creating SHIP transactions...')
    
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("New Transaction")')
    await page.waitForSelector('h3:has-text("New Inventory Transaction")')
    
    await page.click('button[value="SHIP"]')
    await page.fill('input[placeholder="Enter SO/DO/Invoice number"]', 'SO-TEST-001')
    await page.fill('input[type="date"]', '2025-08-01')
    await page.fill('input[placeholder="Tracking number"]', 'LTL-TRACK-001')
    await page.click('button[role="combobox"]')
    await page.click('div[role="option"]:has-text("Truck")')
    
    // Ship partial quantities
    const shipItems = [
      { sku: 'TEST-SKU-001', batch: '202508', cartons: 200 },
      { sku: 'TEST-SKU-002', batch: '202508', cartons: 150 }
    ]
    
    for (const [index, item] of shipItems.entries()) {
      if (index > 0) {
        await page.click('button:has-text("Add Item")')
      }
      
      const itemSelector = `div:has(> h4:has-text("Item ${index + 1}"))`
      await page.fill(`${itemSelector} input[placeholder="Enter SKU code"]`, item.sku)
      await page.fill(`${itemSelector} input[placeholder="Batch/Lot number"]`, item.batch)
      await page.fill(`${itemSelector} input[placeholder="Number of cartons"]`, item.cartons.toString())
    }
    
    await page.click('button:has-text("Create Transaction")')
    await page.waitForSelector('text=/success|created/i', { timeout: 10000 })
    await page.waitForTimeout(3000) // Wait for cost calculations
    
    console.log('  ✅ SHIP transaction created successfully')
    
    // Check SHIP costs
    const shipCosts = await prisma.calculatedCost.findMany({
      where: { transactionType: 'SHIP' },
      include: { costRate: true },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log(`\n  💰 SHIP Costs Generated:`)
    let shipTotal = 0
    shipCosts.forEach(cost => {
      const amount = Number(cost.calculatedCost)
      shipTotal += amount
      console.log(`    - ${cost.costRate.costName}: $${amount.toFixed(2)} (${cost.quantityCharged} × $${cost.applicableRate})`)
    })
    console.log(`    TOTAL SHIP COSTS: $${shipTotal.toFixed(2)}`)
    
    // STEP 3: Verify cost accuracy
    console.log('\n✅ STEP 3: Verifying cost calculation accuracy...')
    
    // Expected calculations based on cost rates
    const containerRate = costRates.find(r => r.costCategory === 'Container')
    const cartonUnloadingRate = costRates.find(r => r.costName.includes('Carton Unloading'))
    const cartonHandlingRate = costRates.find(r => r.costName.includes('Carton Handling'))
    const palletHandlingRate = costRates.find(r => r.costCategory === 'Pallet')
    const ltlRate = costRates.find(r => r.costName === 'LTL')
    
    console.log('\n  📊 Expected vs Actual Calculations:')
    console.log('  ===================================')
    
    // RECEIVE verification
    console.log('\n  RECEIVE Transaction:')
    console.log('  - Total Cartons Received: 800 (500 + 300)')
    console.log('  - Total Pallets: 45 (500÷20=25 + 300÷15=20)')
    
    if (containerRate) {
      const expectedContainer = Number(containerRate.costValue)
      const actualContainer = receiveCosts.find(c => c.costRateId === containerRate.id)
      console.log(`\n  Container Costs:`)
      console.log(`    Expected: $${expectedContainer.toFixed(2)} (1 × $${containerRate.costValue})`)
      console.log(`    Actual: $${actualContainer ? Number(actualContainer.calculatedCost).toFixed(2) : '0.00'}`)
      console.log(`    ${actualContainer && Math.abs(expectedContainer - Number(actualContainer.calculatedCost)) < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`)
    }
    
    if (cartonUnloadingRate) {
      const expectedUnloading = 800 * Number(cartonUnloadingRate.costValue)
      const actualUnloading = receiveCosts.find(c => c.costRateId === cartonUnloadingRate.id)
      console.log(`\n  Carton Unloading:`)
      console.log(`    Expected: $${expectedUnloading.toFixed(2)} (800 × $${cartonUnloadingRate.costValue})`)
      console.log(`    Actual: $${actualUnloading ? Number(actualUnloading.calculatedCost).toFixed(2) : '0.00'}`)
      console.log(`    ${actualUnloading && Math.abs(expectedUnloading - Number(actualUnloading.calculatedCost)) < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`)
    }
    
    // SHIP verification
    console.log('\n\n  SHIP Transaction:')
    console.log('  - Total Cartons Shipped: 350 (200 + 150)')
    console.log('  - Total Pallets: 16 (200÷25=8 + 150÷20=8)')
    
    if (cartonHandlingRate) {
      const expectedHandling = 350 * Number(cartonHandlingRate.costValue)
      const actualHandling = shipCosts.find(c => c.costRateId === cartonHandlingRate.id)
      console.log(`\n  Carton Handling:`)
      console.log(`    Expected: $${expectedHandling.toFixed(2)} (350 × $${cartonHandlingRate.costValue})`)
      console.log(`    Actual: $${actualHandling ? Number(actualHandling.calculatedCost).toFixed(2) : '0.00'}`)
      console.log(`    ${actualHandling && Math.abs(expectedHandling - Number(actualHandling.calculatedCost)) < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`)
    }
    
    if (ltlRate) {
      const expectedLTL = Number(ltlRate.costValue)
      const actualLTL = shipCosts.find(c => c.costRateId === ltlRate.id)
      console.log(`\n  LTL Transport:`)
      console.log(`    Expected: $${expectedLTL.toFixed(2)} (1 × $${ltlRate.costValue})`)
      console.log(`    Actual: $${actualLTL ? Number(actualLTL.calculatedCost).toFixed(2) : '0.00'}`)
      console.log(`    ${actualLTL && Math.abs(expectedLTL - Number(actualLTL.calculatedCost)) < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`)
    }
    
    // Navigate to calculated costs page
    console.log('\n📄 Opening Calculated Costs page...')
    await page.goto('http://localhost:3000/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Take screenshot
    await page.screenshot({ path: 'cost-rates-verification.png', fullPage: true })
    console.log('📸 Screenshot saved as cost-rates-verification.png')
    
    // Final summary
    const totalCosts = await prisma.calculatedCost.aggregate({
      _sum: { calculatedCost: true }
    })
    
    console.log('\n========================================')
    console.log('📊 FINAL VERIFICATION SUMMARY')
    console.log('========================================')
    console.log(`Total RECEIVE Costs: $${receiveTotal.toFixed(2)}`)
    console.log(`Total SHIP Costs: $${shipTotal.toFixed(2)}`)
    console.log(`GRAND TOTAL: $${(Number(totalCosts._sum.calculatedCost) || 0).toFixed(2)}`)
    console.log(`Total Cost Entries: ${receiveCosts.length + shipCosts.length}`)
    console.log('========================================')
    
    console.log('\n✅ Verification complete!')
    console.log('\n👀 PLEASE REVIEW:')
    console.log('1. Check the calculations above for accuracy')
    console.log('2. Review the screenshot: cost-rates-verification.png')
    console.log('3. Verify costs appear correctly in the UI')
    
    // Keep browser open for manual review
    console.log('\n⏸️  Browser will remain open for 30 seconds for manual inspection...')
    await page.waitForTimeout(30000)
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error)
    throw error
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

// Run the verification
console.log('Starting cost rates verification...\n')
verifyAllCosts()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })