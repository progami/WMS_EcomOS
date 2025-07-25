import { test, expect } from '@playwright/test'

// Helper to setup demo and login
async function setupDemoAndLogin(page: any) {
  // Always try to setup demo first (it will check internally if already exists)
  await page.request.post('http://localhost:3000/api/demo/setup');
  
  // Wait for demo setup to complete
  await page.waitForTimeout(2000);
  
  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login');
  
  // Login with demo credentials
  await page.fill('#emailOrUsername', 'demo-admin');
  await page.fill('#password', 'SecureWarehouse2024!');
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  
  // Handle welcome modal if present
  const welcomeModal = page.locator('dialog:has-text("Welcome to WMS Demo!")');
  if (await welcomeModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    const startBtn = page.locator('button:has-text("Start Exploring")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await welcomeModal.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

test.describe('Basic Authentication Flow', () => {
  // Ensure demo is set up once before all tests
  test.beforeAll(async ({ request }) => {
    // Call demo setup API directly
    const response = await request.post('/api/demo/setup')
    if (!response.ok()) {
      const body = await response.json()
      console.log('Demo setup response:', body)
    }
  })
  
  test('Can setup demo and access dashboard', async ({ page }) => {
    // Setup demo environment and login
    await setupDemoAndLogin(page)
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Check for key dashboard elements
    const dashboardTitle = page.locator('h1, h2').filter({ hasText: /Dashboard|Overview/ })
    await expect(dashboardTitle).toBeVisible()
  })
  
  test('Can login with admin credentials', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page)
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Check for admin-specific elements
    const dashboardContent = page.locator('main, [role="main"]')
    await expect(dashboardContent).toBeVisible()
  })
  
  test('Protected routes redirect to login when not authenticated', async ({ page }) => {
    // Try to access a protected route directly
    await page.goto('/operations/inventory')
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/auth\/login/)
  })
  
  test('Can navigate to main sections after login', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)
    
    // Test navigation to key sections
    const sections = [
      { url: '/operations/inventory', name: 'Inventory' },
      { url: '/operations/transactions', name: 'Transactions' },
      { url: '/finance/invoices', name: 'Invoices' }
    ]
    
    for (const section of sections) {
      console.log(`Attempting to navigate to ${section.name} at ${section.url}`)
      
      await page.goto(section.url, { waitUntil: 'domcontentloaded' })
      
      // Wait for any client-side navigation to complete
      await page.waitForTimeout(1000)
      
      // Get the current URL
      const currentUrl = page.url()
      console.log(`Current URL after navigation: ${currentUrl}`)
      
      // Verify we're not redirected to login
      expect(currentUrl).not.toContain('/auth/login')
      
      // For now, just verify we can access the page without being redirected to login
      // Some pages might have redirects or different final URLs
      console.log(`Successfully accessed ${section.name}`)
    }
  })
})
}
