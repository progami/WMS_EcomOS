import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth-helpers'

test.describe('Cost Calculations E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('RECEIVE transaction should automatically calculate costs', async ({ page }) => {
    // Navigate to inventory page where transactions are managed
    await page.goto('/operations/inventory')
    await page.waitForLoadState('networkidle')

    // Click on Create Transaction button
    await page.click('button:has-text("Create Transaction")')
    
    // Wait for dialog/modal to open
    await page.waitForTimeout(500)
    
    // Select RECEIVE transaction type
    await page.click('button[role="combobox"]:has-text("Select type")')
    await page.click('div[role="option"]:has-text("RECEIVE")')
    
    // Select warehouse
    await page.click('button[role="combobox"]:has-text("Select warehouse")')
    await page.click('div[role="option"]:has-text("FMC")')
    
    // Fill transaction details
    await page.fill('input[placeholder*="date"]', new Date().toISOString().split('T')[0])
    await page.fill('input[placeholder*="tracking"]', 'CONT-TEST-001')
    
    // Add item details
    await page.fill('input[placeholder*="SKU"]', 'TEST-SKU-001')
    await page.fill('input[placeholder*="batch"]', 'BATCH-001')
    await page.fill('input[placeholder*="cartons"]', '100')
    await page.fill('input[placeholder*="pallets"]', '5')
    await page.fill('input[placeholder*="per pallet"]', '20')
    await page.fill('input[placeholder*="units"]', '12')
    
    // Submit transaction
    await page.click('button:has-text("Create")')
    
    // Wait for success message or toast
    await expect(page.locator('text=/transaction.*created|success/i').first()).toBeVisible({ timeout: 10000 })
    
    // Navigate to calculated costs to verify
    await page.goto('/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Search for our transaction
    await page.fill('input[placeholder*="Search"]', 'CONT-TEST-001')
    await page.waitForTimeout(1000)
    
    // Verify costs were calculated
    await expect(page.locator('text=CONT-TEST-001')).toBeVisible()
    
    // Verify we have container costs
    await expect(page.locator('tr:has-text("CONT-TEST-001") >> text=CONTAINER')).toBeVisible()
    
    // Verify we have carton costs
    await expect(page.locator('tr:has-text("CONT-TEST-001") >> text=CARTON')).toBeVisible()
    
    // Verify we have pallet costs
    await expect(page.locator('tr:has-text("CONT-TEST-001") >> text=PALLET')).toBeVisible()
  })

  test('SHIP transaction should automatically calculate costs', async ({ page }) => {
    // Navigate to inventory page where transactions are managed
    await page.goto('/operations/inventory')
    await page.waitForLoadState('networkidle')

    // Click on Create Transaction button
    await page.click('button:has-text("Create Transaction")')
    
    // Wait for dialog/modal to open
    await page.waitForTimeout(500)
    
    // Select SHIP transaction type
    await page.click('button[role="combobox"]:has-text("Select type")')
    await page.click('div[role="option"]:has-text("SHIP")')
    
    // Select warehouse
    await page.click('button[role="combobox"]:has-text("Select warehouse")')
    await page.click('div[role="option"]:has-text("FMC")')
    
    // Fill transaction details
    await page.fill('input[placeholder*="date"]', new Date().toISOString().split('T')[0])
    await page.fill('input[placeholder*="tracking"]', 'SHIP-LTL-001')
    
    // Add item details
    await page.fill('input[placeholder*="SKU"]', 'TEST-SKU-001')
    await page.fill('input[placeholder*="batch"]', 'BATCH-001')
    await page.fill('input[placeholder*="cartons"]', '50')
    await page.fill('input[placeholder*="pallets"]', '3')
    await page.fill('input[placeholder*="per pallet"]', '17')
    await page.fill('input[placeholder*="units"]', '12')
    
    // Submit transaction
    await page.click('button:has-text("Create")')
    
    // Wait for success message or toast
    await expect(page.locator('text=/transaction.*created|success/i').first()).toBeVisible({ timeout: 10000 })
    
    // Navigate to calculated costs to verify
    await page.goto('/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Search for our transaction
    await page.fill('input[placeholder*="Search"]', 'SHIP-LTL-001')
    await page.waitForTimeout(1000)
    
    // Verify costs were calculated
    await expect(page.locator('text=SHIP-LTL-001')).toBeVisible()
    
    // Verify we have carton costs
    await expect(page.locator('tr:has-text("SHIP-LTL-001") >> text=CARTON')).toBeVisible()
    
    // Verify we have pallet costs
    await expect(page.locator('tr:has-text("SHIP-LTL-001") >> text=PALLET')).toBeVisible()
    
    // Verify we have shipment costs (LTL Transport)
    await expect(page.locator('tr:has-text("SHIP-LTL-001") >> text=SHIPMENT')).toBeVisible()
    await expect(page.locator('tr:has-text("SHIP-LTL-001") >> text=LTL Transport')).toBeVisible()
    
    // Verify LTL cost amount ($50)
    await expect(page.locator('tr:has-text("SHIP-LTL-001"):has-text("LTL Transport") >> text=$50.00')).toBeVisible()
  })

  test('View calculated costs in finance module', async ({ page }) => {
    // Navigate to finance/calculated-costs page
    await page.goto('/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Should see calculated costs table
    await expect(page.locator('table')).toBeVisible()
    
    // Should see costs from our test transactions
    await expect(page.locator('text=CONT-TEST-001')).toBeVisible()
    await expect(page.locator('text=SHIP-LTL-001')).toBeVisible()
    
    // Filter by warehouse
    await page.selectOption('select[name="warehouse"]', { label: 'FMC' })
    await page.waitForLoadState('networkidle')
    
    // Verify filtered results
    const rows = await page.locator('tbody tr').count()
    expect(rows).toBeGreaterThan(0)
  })

  test('Cost rates management', async ({ page }) => {
    // Navigate to settings/rates page
    await page.goto('/settings/rates')
    await page.waitForLoadState('networkidle')
    
    // Should see cost rates table
    await expect(page.locator('table')).toBeVisible()
    
    // Verify some expected rates are visible
    await expect(page.locator('text=Terminal Charges')).toBeVisible()
    await expect(page.locator('text=Carton Handling')).toBeVisible()
    await expect(page.locator('text=Storage per Week')).toBeVisible()
    
    // Filter by category
    await page.selectOption('select[name="category"]', 'CARTON')
    await page.waitForLoadState('networkidle')
    
    // Should only see carton-related costs
    const categoryTexts = await page.locator('tbody tr').allTextContents()
    categoryTexts.forEach(text => {
      expect(text.toLowerCase()).toContain('carton')
    })
  })

  // Note: In a real scenario, we would have a cleanup API endpoint or admin function
  // to remove test data. For now, test data will remain in the system.
})