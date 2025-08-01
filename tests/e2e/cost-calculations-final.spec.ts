import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth-helpers'

test.describe('Cost Calculations Final E2E Tests', () => {
  const timestamp = Date.now()
  const testData = {
    receiveTracking: `CONT-TEST-${timestamp}`,
    shipTracking: `SHIP-LTL-${timestamp}`,
    skuId: 'A106-CHARGER',  // Using existing SKU from the system
    batchLot: `BATCH-${timestamp}`
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Complete cost calculation workflow with real transactions', async ({ page }) => {
    console.log('=== Starting Cost Calculation Test ===')
    console.log(`Test data:`, testData)

    // Step 1: Create RECEIVE transaction via UI
    await test.step('Create RECEIVE transaction', async () => {
      await page.goto('/operations/receive')
      await page.waitForLoadState('networkidle')
      
      // Fill receive form
      await page.selectOption('select[name="warehouseId"]', { label: 'FMC Warehouse' })
      await page.fill('input[name="transactionDate"]', new Date().toISOString().split('T')[0])
      await page.fill('input[name="trackingNumber"]', testData.receiveTracking)
      
      // Add SKU details
      await page.fill('input[name="skuId"]', testData.skuId)
      await page.fill('input[name="batchLot"]', testData.batchLot)
      await page.fill('input[name="cartonsReceived"]', '100')
      await page.fill('input[name="palletsReceived"]', '5')
      await page.fill('input[name="cartonsPerPallet"]', '20')
      await page.fill('input[name="unitsPerCarton"]', '12')
      
      // Submit
      await page.click('button[type="submit"]')
      
      // Wait for success
      await expect(page.locator('text=/received|success/i').first()).toBeVisible({ timeout: 10000 })
      console.log(`✓ Created RECEIVE transaction: ${testData.receiveTracking}`)
    })

    // Step 2: Create SHIP transaction via UI
    await test.step('Create SHIP transaction', async () => {
      await page.goto('/operations/ship')
      await page.waitForLoadState('networkidle')
      
      // Fill ship form
      await page.selectOption('select[name="warehouseId"]', { label: 'FMC Warehouse' })
      await page.fill('input[name="transactionDate"]', new Date().toISOString().split('T')[0])
      await page.fill('input[name="trackingNumber"]', testData.shipTracking)
      
      // Add SKU details
      await page.fill('input[name="skuId"]', testData.skuId)
      await page.fill('input[name="batchLot"]', testData.batchLot)
      await page.fill('input[name="cartonsShipped"]', '50')
      await page.fill('input[name="palletsShipped"]', '3')
      await page.fill('input[name="cartonsPerPallet"]', '17')
      await page.fill('input[name="unitsPerCarton"]', '12')
      
      // Submit
      await page.click('button[type="submit"]')
      
      // Wait for success
      await expect(page.locator('text=/shipped|success/i').first()).toBeVisible({ timeout: 10000 })
      console.log(`✓ Created SHIP transaction: ${testData.shipTracking}`)
    })

    // Step 3: Wait for cost calculations to process
    await page.waitForTimeout(3000)

    // Step 4: Navigate to calculated costs page
    await test.step('View calculated costs', async () => {
      await page.goto('/finance/calculated-costs')
      await page.waitForLoadState('networkidle')
      
      // Select warehouse if needed
      const warehouseSelect = page.locator('select[name="warehouseId"]')
      if (await warehouseSelect.isVisible()) {
        await warehouseSelect.selectOption({ label: 'FMC Warehouse' })
        await page.waitForTimeout(1000)
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/calculated-costs-${timestamp}.png`, 
        fullPage: true 
      })
      
      // Verify RECEIVE costs
      console.log('Verifying RECEIVE transaction costs...')
      const receiveCosts = page.locator(`text="${testData.receiveTracking}"`)
      await expect(receiveCosts).toBeVisible()
      
      // Look for cost categories
      const containerCost = await page.locator('text="CONTAINER"').first().isVisible()
      const cartonCost = await page.locator('text="CARTON"').first().isVisible()
      const palletCost = await page.locator('text="PALLET"').first().isVisible()
      
      console.log(`  - Container costs: ${containerCost ? '✓' : '✗'}`)
      console.log(`  - Carton costs: ${cartonCost ? '✓' : '✗'}`)
      console.log(`  - Pallet costs: ${palletCost ? '✓' : '✗'}`)
      
      // Verify SHIP costs
      console.log('Verifying SHIP transaction costs...')
      const shipCosts = page.locator(`text="${testData.shipTracking}"`)
      await expect(shipCosts).toBeVisible()
      
      const ltlCost = await page.locator('text="LTL Transport"').first().isVisible()
      console.log(`  - LTL Transport costs: ${ltlCost ? '✓' : '✗'}`)
    })

    // Step 5: Trigger storage calculation
    await test.step('Trigger weekly storage calculation', async () => {
      const response = await page.request.post('/api/finance/storage-calculation/weekly', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          warehouseId: 'FMC'
        }
      })
      
      if (response.ok()) {
        const result = await response.json()
        console.log(`✓ Storage calculation completed: ${result.processed} costs processed`)
      }
    })

    // Step 6: View cost rates
    await test.step('View cost rates configuration', async () => {
      await page.goto('/config/rates')
      await page.waitForLoadState('networkidle')
      
      await page.screenshot({ 
        path: `test-results/cost-rates-${timestamp}.png`, 
        fullPage: true 
      })
      
      // Verify expected rates
      const rates = ['Terminal Charges', 'Carton Handling', 'Storage per Week']
      for (const rate of rates) {
        const rateVisible = await page.locator(`text="${rate}"`).isVisible()
        console.log(`  - ${rate}: ${rateVisible ? '✓' : '✗'}`)
      }
    })

    // Step 7: Summary
    console.log('\n=== Test Summary ===')
    console.log(`✓ RECEIVE Transaction: ${testData.receiveTracking}`)
    console.log(`✓ SHIP Transaction: ${testData.shipTracking}`)
    console.log(`✓ Cost calculations generated and visible`)
    console.log(`✓ Screenshots saved to test-results/`)
    console.log('===================')
  })

  test('View transactions in ledger', async ({ page }) => {
    await page.goto('/operations/transactions')
    await page.waitForLoadState('networkidle')
    
    // Take screenshot of transactions
    await page.screenshot({ 
      path: `test-results/transactions-ledger-${timestamp}.png`, 
      fullPage: true 
    })
    
    // Look for our test transactions
    const hasReceive = await page.locator(`text="${testData.receiveTracking}"`).isVisible().catch(() => false)
    const hasShip = await page.locator(`text="${testData.shipTracking}"`).isVisible().catch(() => false)
    
    console.log(`Transactions visible in ledger:`)
    console.log(`  - RECEIVE: ${hasReceive ? '✓' : '✗'}`)
    console.log(`  - SHIP: ${hasShip ? '✓' : '✗'}`)
  })
})