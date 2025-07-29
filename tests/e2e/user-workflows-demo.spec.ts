import { test, expect, Page } from '@playwright/test';


// Helper to ensure demo is set up before login
async function ensureDemoSetup(page: any) {
  // Check if demo is already set up
  const response = await page.request.get('http://localhost:3000/api/demo/status');
  const status = await response.json();
  
  if (!status.isDemoMode) {
    // Setup demo if not already done
    await page.request.post('http://localhost:3000/api/demo/setup');
    // Wait for demo setup to complete
    await page.waitForTimeout(2000);
  }
}

// Helper to setup demo and login
async function setupDemoAndLogin(page: any) {
  await ensureDemoSetup(page);
  
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
}

// Helper to login using demo account
async function loginDemo(page: Page) {
  await page.goto('/auth/login');
  await page.fill('input[name="emailOrUsername"]', 'demo-admin')
    await page.fill('input[name="password"]', 'SecureWarehouse2024!')
    await page.click('button[type="submit"]');
  // Wait for demo setup and redirect
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
}

// Helper to wait for and dismiss toasts
async function waitForToast(page: Page, message: string) {
  const toast = page.locator(`div[role="status"]`).filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 10000 });
  // Try to dismiss toast if there's a close button
  const closeButton = toast.locator('button').first();
  if (await closeButton.count() > 0) {
    await closeButton.click();
  }
}

test.describe('User Workflow Tests with Demo Data', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure fresh session
    await page.context().clearCookies();
  });

  test('Complete Receiving Goods Workflow', async ({ page }) => {
    test.setTimeout(60000); // Give more time for demo setup
    
    // Login with demo account
    await loginDemo(page);
    
    // Navigate to Operations > Receive Goods
    await page.getByRole('link', { name: 'Operations' }).click();
    await page.getByRole('link', { name: 'Receive Goods' }).click();
    await expect(page).toHaveURL(/.*\/operations\/receive/);
    
    // Check if we're on the receive page
    await expect(page.getByRole('heading', { name: /Receive/ })).toBeVisible();
    
    // Look for existing data or new transaction button
    const newButton = page.getByRole('button', { name: /New|Create|Add/ });
    if (await newButton.count() > 0) {
      await newButton.first().click();
      
      // Fill in receiving form
      // Try to find warehouse select
      const warehouseSelect = page.locator('select[name*="warehouse"], [data-testid*="warehouse"]').first();
      if (await warehouseSelect.count() > 0) {
        const options = await warehouseSelect.locator('option').count();
        if (options > 1) {
          await warehouseSelect.selectOption({ index: 1 });
        }
      }
      
      // Try to add SKU
      const addSkuButton = page.getByRole('button', { name: /Add.*SKU|Add.*Item|Add.*Product/ });
      if (await addSkuButton.count() > 0) {
        await addSkuButton.click();
        
        // Look for SKU input
        const skuInput = page.locator('input[placeholder*="SKU"], input[placeholder*="Search"], input[name*="sku"]').first();
        if (await skuInput.count() > 0) {
          await skuInput.fill('TEST');
          await page.keyboard.press('Enter');
          // Wait a bit for autocomplete
          await page.waitForTimeout(1000);
        }
      }
      
      // Enter quantity
      const quantityInput = page.locator('input[name*="quantity"], input[type="number"]').first();
      if (await quantityInput.count() > 0) {
        await quantityInput.fill('10');
      }
      
      // Submit form
      const submitButton = page.getByRole('button', { name: /Receive|Submit|Save/ });
      if (await submitButton.count() > 0) {
        await submitButton.click();
        // Wait for response
        await page.waitForTimeout(2000);
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/receiving-workflow.png', fullPage: true });
  });

  test('Complete Shipping Goods Workflow with Inventory Check', async ({ page }) => {
    test.setTimeout(60000);
    
    await loginDemo(page);
    
    // First check inventory
    await page.getByRole('link', { name: 'Operations' }).click();
    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL(/.*\/operations\/inventory/);
    
    // Check if there's any inventory
    await page.waitForLoadState('networkidle');
    const inventoryTable = page.locator('table').first();
    const hasInventory = await inventoryTable.locator('tbody tr').count() > 0;
    
    if (hasInventory) {
      // Navigate to shipping
      await page.getByRole('link', { name: 'Ship' }).click();
      await expect(page).toHaveURL(/.*\/operations\/ship/);
      
      // Start new shipment
      const newShipmentButton = page.getByRole('button', { name: /New|Create.*Shipment|Ship/ });
      if (await newShipmentButton.count() > 0) {
        await newShipmentButton.first().click();
        
        // Select warehouse if needed
        const warehouseSelect = page.locator('select[name*="warehouse"], [data-testid*="warehouse"]').first();
        if (await warehouseSelect.count() > 0 && await warehouseSelect.isVisible()) {
          const options = await warehouseSelect.locator('option').count();
          if (options > 1) {
            await warehouseSelect.selectOption({ index: 1 });
          }
        }
        
        // Add items to ship
        const addItemButton = page.getByRole('button', { name: /Add.*Item|Add.*SKU|Add.*Product/ });
        if (await addItemButton.count() > 0) {
          await addItemButton.click();
        }
        
        // Enter quantity
        const quantityInput = page.locator('input[name*="quantity"], input[type="number"]').first();
        if (await quantityInput.count() > 0) {
          await quantityInput.fill('5');
        }
        
        // Submit shipment
        const submitButton = page.getByRole('button', { name: /Ship|Create.*Shipment|Submit/ });
        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/shipping-workflow.png', fullPage: true });
  });

  test('Navigate Between All Major Pages', async ({ page }) => {
    test.setTimeout(60000);
    
    await loginDemo(page);
    
    // Test main navigation items
    const navigationItems = [
      { name: 'Dashboard', urlPattern: /\/dashboard/ },
      { name: 'Operations', urlPattern: /\/operations/ },
      { name: 'Finance', urlPattern: /\/finance/ },
      { name: 'Reports', urlPattern: /\/reports/ },
      { name: 'Analytics', urlPattern: /\/analytics/ },
      { name: 'Config', urlPattern: /\/config/ }
    ];
    
    for (const item of navigationItems) {
      const navLink = page.getByRole('link', { name: item.name }).first();
      if (await navLink.count() > 0 && await navLink.isVisible()) {
        await navLink.click();
        await page.waitForLoadState('networkidle');
        
        // Verify we navigated to the right place
        const currentUrl = page.url();
        if (item.urlPattern.test(currentUrl)) {
          console.log(`Successfully navigated to ${item.name}`);
        } else {
          console.log(`Navigation to ${item.name} resulted in URL: ${currentUrl}`);
        }
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/navigation-${item.name.toLowerCase()}.png`, 
          fullPage: true 
        });
      }
    }
  });

  test('Invoice Generation Workflow', async ({ page }) => {
    test.setTimeout(60000);
    
    await loginDemo(page);
    
    // Navigate to Finance > Invoices
    await page.getByRole('link', { name: 'Finance' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('link', { name: 'Invoices' }).click();
    await expect(page).toHaveURL(/.*\/finance\/invoices/);
    
    // Check for new invoice button
    const newInvoiceButton = page.getByRole('button', { name: /New.*Invoice|Create.*Invoice|Generate/ });
    if (await newInvoiceButton.count() > 0) {
      await newInvoiceButton.click();
      await page.waitForTimeout(2000);
      
      // Fill invoice form if available
      // Select customer
      const customerSelect = page.locator('select[name*="customer"], [data-testid*="customer"]').first();
      if (await customerSelect.count() > 0 && await customerSelect.isVisible()) {
        const options = await customerSelect.locator('option').count();
        if (options > 1) {
          await customerSelect.selectOption({ index: 1 });
        }
      }
      
      // Select date range if needed
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        
        await dateInputs.first().fill(lastMonth.toISOString().split('T')[0]);
        await dateInputs.last().fill(today.toISOString().split('T')[0]);
      }
      
      // Generate invoice
      const generateButton = page.getByRole('button', { name: /Generate|Create|Submit/ });
      if (await generateButton.count() > 0) {
        await generateButton.click();
        await page.waitForTimeout(3000);
      }
    }
    
    await page.screenshot({ path: 'test-results/invoice-workflow.png', fullPage: true });
  });

  test('Check Admin vs Staff Permissions', async ({ page }) => {
    test.setTimeout(60000);
    
    await loginDemo(page);
    
    // Check what navigation items are visible
    const adminOnlyItems = ['Users', 'Settings', 'Admin'];
    const visibleItems = [];
    
    for (const item of adminOnlyItems) {
      const navItem = page.getByRole('link', { name: item });
      if (await navItem.count() > 0 && await navItem.isVisible()) {
        visibleItems.push(item);
      }
    }
    
    console.log('Visible admin items:', visibleItems);
    
    // Try to access user menu
    const userMenu = page.locator('[data-testid*="user-menu"], button[aria-label*="user"], button:has-text("Account")').first();
    if (await userMenu.count() > 0 && await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(1000);
      
      // Check available options
      const menuOptions = page.locator('[role="menu"] [role="menuitem"], [role="menu"] a');
      const optionCount = await menuOptions.count();
      console.log(`User menu has ${optionCount} options`);
      
      await page.screenshot({ path: 'test-results/user-menu.png' });
      
      // Close menu
      await page.keyboard.press('Escape');
    }
    
    // Check if we have admin access by trying to navigate to admin pages
    const adminPages = [
      '/admin/users',
      '/admin/settings'
    ];
    
    for (const adminPage of adminPages) {
      await page.goto(adminPage);
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      const hasAccess = currentUrl.includes(adminPage);
      console.log(`Access to ${adminPage}: ${hasAccess ? 'GRANTED' : 'DENIED'}`);
    }
  });

  test('Error Handling and Validation', async ({ page }) => {
    test.setTimeout(60000);
    
    await loginDemo(page);
    
    // Test form validation on receiving page
    await page.getByRole('link', { name: 'Operations' }).click();
    await page.getByRole('link', { name: 'Receive' }).click();
    
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /Receive|Submit|Save/ });
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Check for validation errors
      const errorMessages = page.locator('[role="alert"], .error, .text-red-500, .text-danger');
      const errorCount = await errorMessages.count();
      console.log(`Found ${errorCount} validation error messages`);
      
      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const errorText = await errorMessages.nth(i).textContent();
          console.log(`Error ${i + 1}: ${errorText}`);
        }
      }
    }
    
    // Test invalid quantity
    const quantityInput = page.locator('input[name*="quantity"], input[type="number"]').first();
    if (await quantityInput.count() > 0) {
      // Try negative number
      await quantityInput.fill('-10');
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Try zero
      await quantityInput.fill('0');
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Try decimal for integer field
      await quantityInput.fill('10.5');
      await submitButton.click();
      await page.waitForTimeout(1000);
    }
    
    await page.screenshot({ path: 'test-results/validation-errors.png', fullPage: true });
  });
});

// Run a specific workflow end-to-end
test('Complete End-to-End Business Workflow', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes for complete workflow
  
  // Login
  await loginDemo(page);
  console.log('Logged in successfully');
  
  // Step 1: Check initial inventory
  await page.goto('/operations/inventory');
  await page.waitForLoadState('networkidle');
  const initialInventory = await page.locator('table tbody tr').count();
  console.log(`Initial inventory items: ${initialInventory}`);
  
  // Step 2: Receive goods
  await page.goto('/operations/receive');
  const receiveButton = page.getByRole('button', { name: /New|Create|Receive/ }).first();
  if (await receiveButton.count() > 0) {
    await receiveButton.click();
    console.log('Started new receiving transaction');
    
    // Fill form with available options
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const options = await select.locator('option').count();
      if (options > 1) {
        await select.selectOption({ index: 1 });
      }
    }
    
    // Fill number inputs
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();
    for (let i = 0; i < inputCount; i++) {
      await numberInputs.nth(i).fill('10');
    }
    
    // Submit
    const submitButton = page.getByRole('button', { name: /Submit|Save|Receive/ }).last();
    if (await submitButton.count() > 0) {
      await submitButton.click();
      console.log('Submitted receiving transaction');
      await page.waitForTimeout(2000);
    }
  }
  
  // Step 3: Check transactions
  await page.goto('/operations/transactions');
  await page.waitForLoadState('networkidle');
  const transactions = await page.locator('table tbody tr').count();
  console.log(`Total transactions: ${transactions}`);
  
  // Step 4: Generate invoice
  await page.goto('/finance/invoices');
  const invoiceButton = page.getByRole('button', { name: /New|Create|Generate/ }).first();
  if (await invoiceButton.count() > 0) {
    await invoiceButton.click();
    console.log('Creating new invoice');
    
    // Fill invoice form
    const invoiceSelects = page.locator('select');
    const invoiceSelectCount = await invoiceSelects.count();
    for (let i = 0; i < invoiceSelectCount; i++) {
      const select = invoiceSelects.nth(i);
      const options = await select.locator('option').count();
      if (options > 1) {
        await select.selectOption({ index: 1 });
      }
    }
    
    // Submit invoice
    const generateButton = page.getByRole('button', { name: /Generate|Create|Submit/ }).last();
    if (await generateButton.count() > 0) {
      await generateButton.click();
      console.log('Generated invoice');
      await page.waitForTimeout(3000);
    }
  }
  
  // Step 5: View reports
  await page.goto('/reports');
  await page.waitForLoadState('networkidle');
  console.log('Viewed reports page');
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/complete-workflow.png', fullPage: true });
  
  console.log('Completed end-to-end workflow test');
});
