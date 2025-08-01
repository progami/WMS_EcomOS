#!/usr/bin/env tsx
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function verifyAllCosts() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 // Slow down to see actions
  })
  const page = await browser.newPage()
  
  try {
    console.log('🚀 COST RATES VERIFICATION SCRIPT')
    console.log('=================================\n')
    
    // STEP 0: Clean transactions individually to avoid the ambiguous column error
    console.log('🧹 STEP 0: Cleaning data...')
    
    try {
      // Delete in reverse order of dependencies
      const deletedCosts = await prisma.calculatedCost.deleteMany({})
      console.log(`  ✅ Deleted ${deletedCosts.count} calculated costs`)
      
      const deletedBalances = await prisma.inventoryBalance.deleteMany({})
      console.log(`  ✅ Deleted ${deletedBalances.count} inventory balances`)
      
      // For inventory transactions, we might need to be more careful
      // Let's just delete demo transactions for now
      const deletedTransactions = await prisma.inventoryTransaction.deleteMany({
        where: { isDemo: true }
      })
      console.log(`  ✅ Deleted ${deletedTransactions.count} demo transactions`)
    } catch (cleanError) {
      console.log('  ⚠️  Could not clean all data, continuing...')
    }
    
    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'FMC' } })
    if (!warehouse) {
      throw new Error('❌ FMC warehouse not found. Please run: tsx scripts/setup-cost-rates.ts')
    }
    
    // Check cost rates
    const costRates = await prisma.costRate.findMany({ 
      where: { warehouseId: warehouse.id, isActive: true } 
    })
    
    console.log(`\n📊 Active Cost Rates for FMC: ${costRates.length} rates found`)
    
    // STEP 1: Create RECEIVE transaction
    console.log('\n📦 STEP 1: Creating RECEIVE transaction...')
    
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    await sleep(1000)
    
    await page.click('button:has-text("New Transaction")')
    await page.waitForSelector('h3:has-text("New Inventory Transaction")')
    
    await page.click('button[value="RECEIVE"]')
    await page.fill('input[placeholder="Enter PI/CI/PO number"]', 'DEMO-PO-001')
    await page.fill('input[type="date"]', '2025-08-01')
    await page.fill('input[placeholder="Vessel/Flight name"]', 'DEMO-VESSEL')
    await page.fill('input[placeholder="e.g., John Doe Imports"]', 'Demo Supplier')
    
    // Single test item
    await page.fill('input[placeholder="Enter SKU code"]', 'TEST-SKU-001')
    await page.fill('input[placeholder="Batch/Lot number"]', '202508')
    await page.fill('input[placeholder="Number of cartons"]', '100')
    await page.fill('input[placeholder="Cartons per pallet (storage)"]', '20')
    await page.fill('input[placeholder="Cartons per pallet (shipping)"]', '25')
    await page.fill('input[placeholder="Units per carton"]', '12')
    
    await page.click('button:has-text("Create Transaction")')
    await page.waitForSelector('text=/success|created/i', { timeout: 10000 })
    await sleep(3000)
    
    console.log('  ✅ RECEIVE transaction created')
    
    // Check RECEIVE costs
    const receiveCosts = await prisma.calculatedCost.findMany({
      where: { 
        transactionType: 'RECEIVE',
        transactionReferenceId: { contains: 'REC' }
      },
      include: { costRate: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    console.log(`\n  💰 RECEIVE Costs Generated: ${receiveCosts.length} entries`)
    receiveCosts.forEach(cost => {
      console.log(`    - ${cost.costRate.costName}: $${cost.calculatedCost}`)
    })
    
    // STEP 2: Create SHIP transaction
    console.log('\n🚚 STEP 2: Creating SHIP transaction...')
    
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    await sleep(1000)
    
    await page.click('button:has-text("New Transaction")')
    await page.waitForSelector('h3:has-text("New Inventory Transaction")')
    
    await page.click('button[value="SHIP"]')
    await page.fill('input[placeholder="Enter SO/DO/Invoice number"]', 'DEMO-SO-001')
    await page.fill('input[type="date"]', '2025-08-01')
    await page.fill('input[placeholder="Tracking number"]', 'DEMO-TRACK-001')
    await page.click('button[role="combobox"]')
    await page.click('div[role="option"]:has-text("Truck")')
    
    // Ship 50 cartons
    await page.fill('input[placeholder="Enter SKU code"]', 'TEST-SKU-001')
    await page.fill('input[placeholder="Batch/Lot number"]', '202508')
    await page.fill('input[placeholder="Number of cartons"]', '50')
    
    await page.click('button:has-text("Create Transaction")')
    await page.waitForSelector('text=/success|created/i', { timeout: 10000 })
    await sleep(3000)
    
    console.log('  ✅ SHIP transaction created')
    
    // Check SHIP costs
    const shipCosts = await prisma.calculatedCost.findMany({
      where: { 
        transactionType: 'SHIP',
        transactionReferenceId: { contains: 'SHI' }
      },
      include: { costRate: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    console.log(`\n  💰 SHIP Costs Generated: ${shipCosts.length} entries`)
    shipCosts.forEach(cost => {
      console.log(`    - ${cost.costRate.costName}: $${cost.calculatedCost}`)
    })
    
    // STEP 3: Navigate to calculated costs page
    console.log('\n📊 STEP 3: Viewing calculated costs...')
    
    await page.goto('http://localhost:3000/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    await sleep(2000)
    
    // Take screenshot
    await page.screenshot({ path: 'cost-verification-simple.png', fullPage: true })
    console.log('\n📸 Screenshot saved as cost-verification-simple.png')
    
    // Summary
    const totalCosts = [...receiveCosts, ...shipCosts]
    const totalAmount = totalCosts.reduce((sum, c) => sum + Number(c.calculatedCost), 0)
    
    console.log('\n========================================')
    console.log('📊 VERIFICATION SUMMARY')
    console.log('========================================')
    console.log(`RECEIVE Costs: ${receiveCosts.length} entries`)
    console.log(`SHIP Costs: ${shipCosts.length} entries`)
    console.log(`Total Amount: $${totalAmount.toFixed(2)}`)
    console.log('========================================')
    
    console.log('\n✅ Verification complete!')
    console.log('\n👀 PLEASE REVIEW:')
    console.log('1. Check the cost entries listed above')
    console.log('2. Review the screenshot: cost-verification-simple.png')
    console.log('3. Verify costs appear in the UI')
    console.log('\n📌 Expected costs should include:')
    console.log('   - Container costs (for RECEIVE with tracking)')
    console.log('   - Carton unloading/handling costs')
    console.log('   - Pallet handling costs')
    console.log('   - Transport costs (LTL for SHIP)')
    
    console.log('\n⏸️  Browser will remain open for manual inspection...')
    console.log('Press Ctrl+C to exit')
    
    // Keep browser open indefinitely
    await new Promise(() => {})
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error)
    throw error
  } finally {
    // This won't run unless the script is interrupted
    await browser.close()
    await prisma.$disconnect()
  }
}

// Run the verification
console.log('Starting cost rates verification...\n')
verifyAllCosts().catch((error) => {
  console.error('\n❌ Script failed:', error)
  process.exit(1)
})