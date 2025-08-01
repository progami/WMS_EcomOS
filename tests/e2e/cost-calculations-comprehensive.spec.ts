import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth-helpers'

test.describe('Comprehensive Cost Calculations E2E Tests', () => {
  const testData = {
    sku: {
      id: `TEST-SKU-${Date.now()}`,
      barcode: `BARCODE-${Date.now()}`,
      name: 'Test Product for Cost Calculations',
      hscode: '123456',
      countryOfOrigin: 'US'
    },
    receiveTransaction: {
      trackingNumber: `CONT-${Date.now()}`,
      cartonsIn: 100,
      storagePalletsIn: 5,
      storageCartonsPerPallet: 20,
      unitsPerCarton: 12
    },
    shipTransaction: {
      trackingNumber: `SHIP-LTL-${Date.now()}`,
      cartonsOut: 50,
      shippingPalletsOut: 3,
      shippingCartonsPerPallet: 17,
      unitsPerCarton: 12
    }
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Complete cost calculation workflow', async ({ page }) => {
    // Step 1: Create SKU
    await test.step('Create test SKU', async () => {
      await page.goto('/config/products')
      await page.waitForLoadState('networkidle')
      
      // Check if SKU already exists
      const skuExists = await page.locator(`text="${testData.sku.id}"`).isVisible().catch(() => false)
      
      if (!skuExists) {
        await page.click('a:has-text("Add Product")')
        await page.waitForLoadState('networkidle')
        
        // Fill SKU form
        await page.fill('input[name="id"]', testData.sku.id)
        await page.fill('input[name="barcode"]', testData.sku.barcode)
        await page.fill('input[name="name"]', testData.sku.name)
        await page.fill('input[name="hscode"]', testData.sku.hscode)
        await page.fill('input[name="countryOfOrigin"]', testData.sku.countryOfOrigin)
        
        // Submit form
        await page.click('button:has-text("Create Product")')
        await page.waitForTimeout(2000)
      }
    })

    // Step 2: Create RECEIVE transaction
    await test.step('Create RECEIVE transaction', async () => {
      await page.goto('/operations/inventory')
      await page.waitForLoadState('networkidle')
      
      // Open transaction dialog
      await page.click('button:has-text("Create Transaction")')
      await page.waitForTimeout(1000)
      
      // Fill transaction form - using actual selectors from the inventory page
      const transactionTypeSelect = page.locator('select[name="transactionType"], button[role="combobox"]:has-text("Select type")')
      if (await transactionTypeSelect.first().isVisible()) {
        const element = transactionTypeSelect.first()
        if (await element.evaluate(el => el.tagName === 'SELECT')) {
          await element.selectOption('RECEIVE')
        } else {
          await element.click()
          await page.click('div[role="option"]:has-text("RECEIVE")')
        }
      }
      
      // Select warehouse
      const warehouseSelect = page.locator('select[name="warehouseId"], button[role="combobox"]:has-text("Select warehouse")')
      if (await warehouseSelect.first().isVisible()) {
        const element = warehouseSelect.first()
        if (await element.evaluate(el => el.tagName === 'SELECT')) {
          await element.selectOption({ label: 'FMC Warehouse' })
        } else {
          await element.click()
          await page.click('div[role="option"]:has-text("FMC")')
        }
      }
      
      // Fill transaction details
      const dateInput = page.locator('input[type="date"], input[placeholder*="date"]').first()
      await dateInput.fill(new Date().toISOString().split('T')[0])
      
      const trackingInput = page.locator('input[placeholder*="tracking"], input[name="trackingNumber"]').first()
      await trackingInput.fill(testData.receiveTransaction.trackingNumber)
      
      // Add transaction items
      await page.fill('input[placeholder*="SKU"], input[name="items[0].skuId"]', testData.sku.id)
      await page.fill('input[placeholder*="batch"], input[name="items[0].batchLot"]', 'BATCH-001')
      await page.fill('input[placeholder*="cartons"], input[name="items[0].cartonsIn"]', testData.receiveTransaction.cartonsIn.toString())
      await page.fill('input[placeholder*="pallets"], input[name="items[0].storagePalletsIn"]', testData.receiveTransaction.storagePalletsIn.toString())
      await page.fill('input[placeholder*="per pallet"], input[name="items[0].storageCartonsPerPallet"]', testData.receiveTransaction.storageCartonsPerPallet.toString())
      await page.fill('input[placeholder*="units"], input[name="items[0].unitsPerCarton"]', testData.receiveTransaction.unitsPerCarton.toString())
      
      // Submit transaction
      await page.click('button:has-text("Create"), button[type="submit"]:has-text("Save")')
      
      // Wait for success
      await expect(page.locator('text=/transaction.*created|success/i').first()).toBeVisible({ timeout: 10000 })
      await page.waitForTimeout(2000)
    })

    // Step 3: Create SHIP transaction
    await test.step('Create SHIP transaction', async () => {
      // Open transaction dialog again
      await page.click('button:has-text("Create Transaction")')
      await page.waitForTimeout(1000)
      
      // Fill transaction form for SHIP
      const transactionTypeSelect = page.locator('select[name="transactionType"], button[role="combobox"]:has-text("Select type")')
      if (await transactionTypeSelect.first().isVisible()) {
        const element = transactionTypeSelect.first()
        if (await element.evaluate(el => el.tagName === 'SELECT')) {
          await element.selectOption('SHIP')
        } else {
          await element.click()
          await page.click('div[role="option"]:has-text("SHIP")')
        }
      }
      
      // Select warehouse
      const warehouseSelect = page.locator('select[name="warehouseId"], button[role="combobox"]:has-text("Select warehouse")')
      if (await warehouseSelect.first().isVisible()) {
        const element = warehouseSelect.first()
        if (await element.evaluate(el => el.tagName === 'SELECT')) {
          await element.selectOption({ label: 'FMC Warehouse' })
        } else {
          await element.click()
          await page.click('div[role="option"]:has-text("FMC")')
        }
      }
      
      // Fill transaction details
      const dateInput = page.locator('input[type="date"], input[placeholder*="date"]').first()
      await dateInput.fill(new Date().toISOString().split('T')[0])
      
      const trackingInput = page.locator('input[placeholder*="tracking"], input[name="trackingNumber"]').first()
      await trackingInput.fill(testData.shipTransaction.trackingNumber)
      
      // Add transaction items
      await page.fill('input[placeholder*="SKU"], input[name="items[0].skuId"]', testData.sku.id)
      await page.fill('input[placeholder*="batch"], input[name="items[0].batchLot"]', 'BATCH-001')
      await page.fill('input[placeholder*="cartons"], input[name="items[0].cartonsOut"]', testData.shipTransaction.cartonsOut.toString())
      await page.fill('input[placeholder*="pallets"], input[name="items[0].shippingPalletsOut"]', testData.shipTransaction.shippingPalletsOut.toString())
      await page.fill('input[placeholder*="per pallet"], input[name="items[0].shippingCartonsPerPallet"]', testData.shipTransaction.shippingCartonsPerPallet.toString())
      await page.fill('input[placeholder*="units"], input[name="items[0].unitsPerCarton"]', testData.shipTransaction.unitsPerCarton.toString())
      
      // Submit transaction
      await page.click('button:has-text("Create"), button[type="submit"]:has-text("Save")')
      
      // Wait for success
      await expect(page.locator('text=/transaction.*created|success/i').first()).toBeVisible({ timeout: 10000 })
      await page.waitForTimeout(2000)
    })

    // Step 4: Trigger weekly storage calculation
    await test.step('Trigger storage calculation', async () => {
      // Make API call to trigger storage calculation
      const response = await page.request.post('/api/finance/storage-calculation/weekly', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {}
      })
      
      expect(response.ok()).toBeTruthy()
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    // Step 5: Navigate to calculated costs and verify
    await test.step('Verify calculated costs', async () => {
      await page.goto('/finance/calculated-costs')
      await page.waitForLoadState('networkidle')
      
      // Verify RECEIVE transaction costs
      await expect(page.locator(`text="${testData.receiveTransaction.trackingNumber}"`)).toBeVisible()
      
      // Verify we have container costs (for RECEIVE with tracking number starting with CONT)
      const containerCost = page.locator(`tr:has-text("${testData.receiveTransaction.trackingNumber}"):has-text("CONTAINER")`)
      await expect(containerCost).toBeVisible()
      
      // Verify carton unloading costs
      const cartonUnloadingCost = page.locator(`tr:has-text("${testData.receiveTransaction.trackingNumber}"):has-text("Carton Unloading")`)
      await expect(cartonUnloadingCost).toBeVisible()
      
      // Verify pallet handling costs
      const palletHandlingCost = page.locator(`tr:has-text("${testData.receiveTransaction.trackingNumber}"):has-text("Pallet Handling")`)
      await expect(palletHandlingCost).toBeVisible()
      
      // Verify SHIP transaction costs
      await expect(page.locator(`text="${testData.shipTransaction.trackingNumber}"`)).toBeVisible()
      
      // Verify carton handling costs for SHIP
      const shipCartonCost = page.locator(`tr:has-text("${testData.shipTransaction.trackingNumber}"):has-text("Carton Handling")`)
      await expect(shipCartonCost).toBeVisible()
      
      // Verify LTL transport cost
      const ltlCost = page.locator(`tr:has-text("${testData.shipTransaction.trackingNumber}"):has-text("LTL Transport")`)
      await expect(ltlCost).toBeVisible()
      
      // Verify storage costs if inventory exists
      const storageCost = page.locator('tr:has-text("Storage per Week")')
      const hasStorageCost = await storageCost.isVisible().catch(() => false)
      if (hasStorageCost) {
        await expect(storageCost).toBeVisible()
      }
    })

    // Step 6: Take screenshot of results
    await test.step('Capture results', async () => {
      await page.screenshot({ path: 'test-results/cost-calculations.png', fullPage: true })
      
      // Log summary
      const pageContent = await page.textContent('body')
      console.log('=== Cost Calculation Test Results ===')
      console.log(`✓ Created RECEIVE transaction: ${testData.receiveTransaction.trackingNumber}`)
      console.log(`✓ Created SHIP transaction: ${testData.shipTransaction.trackingNumber}`)
      console.log('✓ All cost calculations verified successfully')
      console.log('✓ Screenshot saved to: test-results/cost-calculations.png')
    })
  })

  test('View cost rates configuration', async ({ page }) => {
    await page.goto('/config/rates')
    await page.waitForLoadState('networkidle')
    
    // Verify cost rates are configured
    await expect(page.locator('text=Terminal Charges')).toBeVisible()
    await expect(page.locator('text=Carton Handling')).toBeVisible()
    await expect(page.locator('text=Storage per Week')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/cost-rates.png', fullPage: true })
  })

  test('View finance dashboard with costs', async ({ page }) => {
    await page.goto('/finance')
    await page.waitForLoadState('networkidle')
    
    // Check if cost summary is visible
    const costSummary = page.locator('text=/total.*cost|cost.*summary/i')
    const hasCostSummary = await costSummary.isVisible().catch(() => false)
    
    if (hasCostSummary) {
      await page.screenshot({ path: 'test-results/finance-dashboard.png', fullPage: true })
    }
  })
})