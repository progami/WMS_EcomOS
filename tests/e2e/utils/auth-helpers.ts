import { Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  // Navigate to login page
  await page.goto('/auth/login', { waitUntil: 'networkidle' })
  
  // Use test credentials from seed-test.ts - use name attribute selectors for better reliability
  const emailInput = page.locator('input[name="emailOrUsername"]')
  const passwordInput = page.locator('input[name="password"]')
  const loginButton = page.locator('button[type="submit"]')
  
  await emailInput.fill('demo-admin')
  await passwordInput.fill('SecureWarehouse2024!')
  
  // Submit form
  await loginButton.click()
  
  // Wait for navigation away from login page (more lenient check like passing tests)
  try {
    await page.waitForURL((url) => !url.toString().includes('login'), {
      timeout: 30000,
      waitUntil: 'networkidle'
    })
  } catch (error) {
    // Check if we're still on login page with an error
    const currentUrl = page.url()
    if (currentUrl.includes('login')) {
      // Check for error messages
      const errorMessage = await page.locator('text=Invalid').isVisible().catch(() => false)
      if (errorMessage) {
        throw new Error('Login failed: Invalid credentials')
      }
      
      // Log current page state for debugging
      console.log('Login appears to have failed. Current URL:', currentUrl)
      console.log('Page title:', await page.title())
      
      throw new Error(`Login failed - still on login page after ${30000}ms`)
    }
    throw error
  }
  
  // Give the page a moment to stabilize after navigation
  await page.waitForTimeout(2000)
  
  // Verify we're not on login page
  const finalUrl = page.url()
  if (finalUrl.includes('login')) {
    throw new Error('Login failed - redirected back to login page')
  }
  
  console.log('Login successful. Current URL:', finalUrl)
}

export async function loginWithQuickFill(page: Page, userType: 'Admin' | 'Finance' | 'Operations') {
  // Navigate to login page
  await page.goto('/auth/login', { waitUntil: 'networkidle' })
  
  // Click the quick fill button
  const button = page.locator(`button:has-text("${userType}")`).first()
  if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
    await button.click()
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 30000 })
  } else {
    throw new Error(`Quick fill button for ${userType} not found`)
  }
}

export async function setupDemoAndLogin(page: Page) {
  // In test mode, we don't need demo setup - just login directly
  if (process.env.NODE_ENV === 'test') {
    await loginAsAdmin(page)
    return
  }
  
  // Original demo setup code for non-test environments
  // Navigate to home page
  await page.goto('/', { waitUntil: 'networkidle' })
  
  // Click Try Demo button
  const tryDemoButton = page.locator('button:has-text("Try Demo")')
  if (await tryDemoButton.isVisible()) {
    await tryDemoButton.click()
    
    // Wait for navigation or dashboard to load
    try {
      // Either wait for URL change or dashboard to appear
      await Promise.race([
        page.waitForURL((url) => url.toString().includes('/dashboard'), {
          timeout: 30000
        }),
        page.waitForSelector('h1:has-text("Dashboard")', {
          timeout: 30000
        })
      ])
    } catch (error) {
      // Check if we're already on a logged-in page
      const isDashboard = page.url().includes('/dashboard')
      const hasNavigation = await page.locator('a:has-text("Products (SKUs)")').isVisible().catch(() => false)
      
      if (!isDashboard && !hasNavigation) {
        // Check if there was an error during demo setup
        const errorToast = await page.locator('text=Failed to set up demo').isVisible().catch(() => false)
        if (errorToast) {
          throw new Error('Demo setup failed')
        }
        throw error
      }
    }
    
    // Give the page a moment to stabilize
    await page.waitForTimeout(2000)
    
    console.log('Demo setup successful. Current URL:', page.url())
  } else {
    throw new Error('Try Demo button not found')
  }
}

export async function logout(page: Page) {
  // Click on user menu
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Account"), button:has-text("admin")')
  if (await userMenu.isVisible()) {
    await userMenu.click()
    
    // Click logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")')
    await logoutButton.click()
    
    // Wait for redirect to login page
    await page.waitForURL('**/auth/login', { timeout: 10000 })
  }
}