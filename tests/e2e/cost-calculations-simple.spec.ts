import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth-helpers'

test.describe('Cost Calculations Simple Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Verify cost rates are configured', async ({ page }) => {
    // Navigate to config/rates page
    await page.goto('/config/rates')
    await page.waitForLoadState('networkidle')
    
    // Should see cost rates table or list
    const pageContent = await page.textContent('body')
    
    // Verify some expected rates are visible
    expect(pageContent).toContain('Terminal Charges')
    expect(pageContent).toContain('Carton Handling')
    expect(pageContent).toContain('Storage')
    
    // Check if we have FMC warehouse rates
    expect(pageContent).toContain('FMC')
  })

  test('Navigate to calculated costs page', async ({ page }) => {
    // Navigate to finance/calculated-costs page
    await page.goto('/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Should see the page title or header
    const pageContent = await page.textContent('body')
    expect(pageContent.toLowerCase()).toContain('calculated cost')
    
    // Check if table or data exists
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasDataGrid = await page.locator('[role="grid"]').isVisible().catch(() => false)
    const hasContent = hasTable || hasDataGrid
    
    expect(hasContent).toBeTruthy()
  })

  test('Check warehouse configuration', async ({ page }) => {
    // Navigate to warehouse config
    await page.goto('/config/warehouses')
    await page.waitForLoadState('networkidle')
    
    // Verify FMC and Vglobal warehouses exist
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain('FMC')
    expect(pageContent).toContain('Vglobal')
  })
})