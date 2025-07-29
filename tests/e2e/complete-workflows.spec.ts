import { isUnderConstruction, handleUnderConstruction, closeWelcomeModal, navigateToPage } from './utils/common-helpers';
import { test, expect, Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';


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

// Test data
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';
const STAFF_EMAIL = 'staff@example.com';
const STAFF_PASSWORD = 'Staff123!';

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('input[name="emailOrUsername"]', 'demo-admin');
  await page.fill('input[name="password"]', 'SecureWarehouse2024!');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function loginAsStaff(page: Page) {
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('input[name="emailOrUsername"]', 'staff@example.com');
  await page.fill('input[name="password"]', 'SecureWarehouse2024!');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function loginAsDemo(page: Page) {
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('input[name="emailOrUsername"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'SecureWarehouse2024!');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function waitForToast(page: Page, message: string) {
  const toast = page.locator(`[role="status"]:has-text("${message}")`);
  await expect(toast).toBeVisible({ timeout: 10000 });
}

async function dismissToast(page: Page) {
  const closeButton = page.locator('[role="status"] button[aria-label="Close"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

test.describe('Complete User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto('http://localhost:3000/');
    await page.context().clearCookies();
  });

  test.describe('Receiving Goods Workflow', () => {
    test('Complete receiving workflow from start to finish', async ({ page }) => {
      // Step 1: Login as staff
      await loginAsStaff(page);
      
      // Step 2: Navigate to receiving page
      await page.click('nav >> text=Operations');
      await page.click('a:has-text("Receive Goods")');
      await expect(page).toHaveURL('**/operations/receive');
      
      // Step 3: Start a new receiving transaction
      const btn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Step 4: Fill in receiving form
      // Select warehouse
      await page.click('[data-testid="warehouse-select"]');
      await page.click('[role="option"]:first-child');
      
      // Add SKU
      const createProductBtn = page.locator('button:has-text("Create Product"), a:has-text("Create Product")').first();
    if (await createProductBtn.isVisible()) {
      await createProductBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', 'TEST-SKU-001');
      await page.click('[role="option"]:has-text("TEST-SKU-001")');
      
      // Enter quantity
      await page.fill('input[name="quantity"]', '100');
      
      // Add batch attributes if required
      const batchSection = page.locator('text=Batch Attributes');
      if (await batchSection.isVisible()) {
        await page.fill('input[name="lot_number"]', 'LOT-2024-001');
        await page.fill('input[name="expiry_date"]', '2025-12-31');
      }
      
      // Step 5: Submit receiving
      const receiveItemsBtn = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await createProductBtn.isVisible()) {
      await createProductBtn.click();
    };
      
      // Step 6: Verify success
      await waitForToast(page, 'Items received successfully');
      
      // Step 7: Verify transaction appears in list
      await page.click('a:has-text("Transactions")');
      await expect(page.locator('table >> text=RECEIVING')).toBeVisible();
      await expect(page.locator('table >> text=TEST-SKU-001')).toBeVisible();
    });

    test('Handle receiving with multiple SKUs and batch tracking', async ({ page }) => {
      await loginAsStaff(page);
      
      // Navigate to receiving
      await page.goto('/operations/receive');
      
      // Start new receiving
      const btn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Add multiple SKUs
      const skus = ['TEST-SKU-001', 'TEST-SKU-002', 'TEST-SKU-003'];
      
      for (const sku of skus) {
        const btn = page.locator('button:has-text("Create Product"), a:has-text("Create Product")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
        await page.fill('input[placeholder="Search SKUs..."]', sku);
        await page.keyboard.press('Enter');
        await page.fill(`input[name="quantity_${sku}"]`, '50');
        
        // Add batch info
        await page.fill(`input[name="lot_${sku}"]`, `LOT-${sku}-2024`);
      }
      
      // Submit
      const receiveItemsBtn = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await receiveItemsBtn.isVisible()) {
      await receiveItemsBtn.click();
    };
      await waitForToast(page, 'Items received successfully');
      
      // Verify all SKUs in inventory
      await page.goto('/operations/inventory');
      for (const sku of skus) {
        await expect(page.locator(`text=${sku}`)).toBeVisible();
      }
    });
  });

  test.describe('Shipping Goods Workflow', () => {
    test('Complete shipping workflow with inventory validation', async ({ page }) => {
      await loginAsStaff(page);
      
      // Step 1: Check current inventory levels
      await page.goto('/operations/inventory');
      
      // Search for a SKU with inventory
      await page.fill('input[placeholder*="Search"]', 'TEST-SKU-001');
      await page.keyboard.press('Enter');
      
      // Get current quantity
      const quantityCell = page.locator('td[data-column="quantity"]').first();
      const currentQuantity = await quantityCell.textContent();
      const availableQty = parseInt(currentQuantity || '0');
      
      // Step 2: Navigate to shipping
      await page.click('nav >> text=Operations');
      await page.click('a:has-text("Ship Goods")');
      
      // Step 3: Create new shipment
      const btn = page.locator('button:has-text("New Shipment"), a:has-text("New Shipment")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Select warehouse
      await page.click('[data-testid="warehouse-select"]');
      await page.click('[role="option"]:first-child');
      
      // Add items to ship
      const addItemBtn = page.locator('button:has-text("Add Item"), a:has-text("Add Item")').first();
    if (await addItemBtn.isVisible()) {
      await addItemBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', 'TEST-SKU-001');
      await page.keyboard.press('Enter');
      
      // Try to ship more than available (should fail)
      const shipQty = availableQty + 10;
      await page.fill('input[name="ship_quantity"]', shipQty.toString());
      const shipItemsBtn = page.locator('button:has-text("Ship Items"), a:has-text("Ship Items")').first();
    if (await addItemBtn.isVisible()) {
      await addItemBtn.click();
    };
      
      // Verify error message
      await expect(page.locator('text=Insufficient inventory')).toBeVisible();
      
      // Ship valid quantity
      const validQty = Math.min(availableQty, 10);
      await page.fill('input[name="ship_quantity"]', validQty.toString());
      
      // Add shipping details
      await page.fill('input[name="tracking_number"]', 'TRACK-12345');
      await page.fill('input[name="carrier"]', 'FedEx');
      
      // Submit shipment
    if (await shipItemsBtn.isVisible()) {
      await shipItemsBtn.click();
    };
      await waitForToast(page, 'Shipment created successfully');
      
      // Step 4: Verify inventory was reduced
      await page.goto('/operations/inventory');
      await page.fill('input[placeholder*="Search"]', 'TEST-SKU-001');
      await page.keyboard.press('Enter');
      
      const newQuantityCell = page.locator('td[data-column="quantity"]').first();
      const newQuantity = await newQuantityCell.textContent();
      expect(parseInt(newQuantity || '0')).toBe(availableQty - validQty);
    });

    test('Validate FIFO batch selection during shipping', async ({ page }) => {
      await loginAsStaff(page);
      
      // Navigate to shipping
      await page.goto('/operations/ship');
      
      // Start new shipment
      const btn = page.locator('button:has-text("New Shipment"), a:has-text("New Shipment")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Add item with batch tracking
      const addItemBtn = page.locator('button:has-text("Add Item"), a:has-text("Add Item")').first();
    if (await addItemBtn.isVisible()) {
      await addItemBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', 'BATCH-SKU-001');
      await page.keyboard.press('Enter');
      
      // System should auto-select oldest batch (FIFO)
      const selectedBatch = page.locator('[data-testid="selected-batch"]');
      await expect(selectedBatch).toContainText('Oldest batch selected');
      
      // Verify batch details
      const viewBatchDetailsBtn = page.locator('button:has-text("View Batch Details"), a:has-text("View Batch Details")').first();
    if (await addItemBtn.isVisible()) {
      await addItemBtn.click();
    };
      await expect(page.locator('text=Lot Number:')).toBeVisible();
      await expect(page.locator('text=Expiry Date:')).toBeVisible();
    });
  });

  test.describe('Invoice Generation and Reconciliation Workflow', () => {
    test('Generate invoice from transactions and reconcile', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Step 1: Navigate to invoices
      await page.goto('/finance/invoices');
      
      // Step 2: Create new invoice
      const btn = page.locator('button:has-text("New Invoice"), a:has-text("New Invoice")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Select invoice type
      await page.click('[data-testid="invoice-type-select"]');
      await page.click('text=Storage Invoice');
      
      // Select customer
      await page.click('[data-testid="customer-select"]');
      await page.click('[role="option"]:has-text("Test Customer")');
      
      // Select date range
      const startDate = new Date();
      startDate.setDate(1); // First day of month
      await page.fill('input[name="start_date"]', startDate.toISOString().split('T')[0]);
      await page.fill('input[name="end_date"]', new Date().toISOString().split('T')[0]);
      
      // Generate invoice
      const generateInvoiceBtn = page.locator('button:has-text("Generate Invoice"), a:has-text("Generate Invoice")').first();
    if (await generateInvoiceBtn.isVisible()) {
      await generateInvoiceBtn.click();
    };
      await waitForToast(page, 'Invoice generated successfully');
      
      // Step 3: Review invoice details
      await expect(page.locator('h1:has-text("Invoice #")')).toBeVisible();
      
      // Verify line items
      await expect(page.locator('table >> text=Storage Fees')).toBeVisible();
      await expect(page.locator('[data-testid="invoice-total"]')).toBeVisible();
      
      // Step 4: Download invoice PDF
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download PDF")')
      ]);
      expect(download.suggestedFilename()).toContain('invoice');
      
      // Step 5: Navigate to reconciliation
      await page.goto('/finance/reconciliation');
      
      // Find the invoice
      const invoiceNumber = await page.locator('h1:has-text("Invoice #")').textContent();
      await page.fill('input[placeholder*="Search"]', invoiceNumber || '');
      
      // Start reconciliation
      const reconcileBtn = page.locator('button:has-text("Reconcile"), a:has-text("Reconcile")').first();
    if (await generateInvoiceBtn.isVisible()) {
      await generateInvoiceBtn.click();
    };
      
      // Upload payment proof
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('./tests/e2e/fixtures/payment-proof.pdf');
      
      // Enter payment details
      await page.fill('input[name="payment_amount"]', '1000.00');
      await page.fill('input[name="payment_reference"]', 'PAY-REF-12345');
      
      // Complete reconciliation
      const completeReconciliationBtn = page.locator('button:has-text("Complete Reconciliation"), a:has-text("Complete Reconciliation")').first();
    if (await generateInvoiceBtn.isVisible()) {
      await generateInvoiceBtn.click();
    };
      await waitForToast(page, 'Invoice reconciled successfully');
      
      // Verify status change
      await expect(page.locator('text=PAID')).toBeVisible();
    });

    test('Handle invoice disputes', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Navigate to existing invoice
      await page.goto('/finance/invoices');
      await page.click('table >> tr >> td:has-text("PENDING")');
      
      // Dispute invoice
      const btn = page.locator('button:has-text("Dispute Invoice"), a:has-text("Dispute Invoice")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Fill dispute form
      await page.fill('textarea[name="dispute_reason"]', 'Incorrect storage calculation for SKU-001');
      const submitDisputeBtn = page.locator('button:has-text("Submit Dispute"), a:has-text("Submit Dispute")').first();
    if (await submitDisputeBtn.isVisible()) {
      await submitDisputeBtn.click();
    };
      
      await waitForToast(page, 'Dispute submitted successfully');
      
      // Verify dispute status
      await expect(page.locator('text=DISPUTED')).toBeVisible();
      
      // Add resolution
      const resolveDisputeBtn = page.locator('button:has-text("Resolve Dispute"), a:has-text("Resolve Dispute")').first();
    if (await submitDisputeBtn.isVisible()) {
      await submitDisputeBtn.click();
    };
      await page.fill('textarea[name="resolution"]', 'Adjusted storage fees as per agreement');
      await page.fill('input[name="adjusted_amount"]', '950.00');
      
      const applyResolutionBtn = page.locator('button:has-text("Apply Resolution"), a:has-text("Apply Resolution")').first();
    if (await submitDisputeBtn.isVisible()) {
      await submitDisputeBtn.click();
    };
      await waitForToast(page, 'Dispute resolved successfully');
    });
  });

  test.describe('Navigation Between Pages', () => {
    test('Navigate through all major pages as admin', async ({ page }) => {
      await loginAsAdmin(page);
      
      const navigationTests = [
        { menu: 'Settings', url: '/admin/settings', title: 'System Settings' },
        { menu: 'Inventory', url: '/admin/inventory', title: 'Inventory Management' },
        { menu: 'Reports', url: '/admin/reports', title: 'Reports' },
        { menu: 'Users', url: '/admin/users', title: 'User Management' },
        { menu: 'Settings', url: '/admin/settings', title: 'Settings' },
        { menu: 'Invoices', url: '/admin/invoices', title: 'Invoice Management' }
      ];
      
      for (const navTest of navigationTests) {
        await page.click(`nav >> text=${navTest.menu}`);
        await expect(page).toHaveURL(new RegExp(navTest.url));
        await expect(page.locator(`h1:has-text("${navTest.title}")`)).toBeVisible();
      }
      
      // Test sub-navigation
      await page.click('nav >> text=Settings');
      const subNavItems = ['General', 'Security', 'Notifications', 'Database'];
      
      for (const item of subNavItems) {
        await page.click(`a:has-text("${item}")`);
        await expect(page.locator(`h2:has-text("${item}")`)).toBeVisible();
      }
    });

    test('Navigate through all major pages as staff', async ({ page }) => {
      await loginAsStaff(page);
      
      const navigationTests = [
        { menu: 'Dashboard', url: '/dashboard', title: 'Dashboard' },
        { menu: 'Operations', submenu: 'Inventory', url: '/operations/inventory' },
        { menu: 'Operations', submenu: 'Receive Goods', url: '/operations/receive' },
        { menu: 'Operations', submenu: 'Ship Goods', url: '/operations/ship' },
        { menu: 'Operations', submenu: 'Transactions', url: '/operations/transactions' },
        { menu: 'Reports', url: '/reports', title: 'Reports' }
      ];
      
      for (const navTest of navigationTests) {
        await page.click(`nav >> text=${navTest.menu}`);
        if (navTest.submenu) {
          await page.click(`a:has-text("${navTest.submenu}")`);
        }
        await expect(page).toHaveURL(new RegExp(navTest.url));
      }
    });
  });

  test.describe('Admin vs Staff Permissions', () => {
    test('Staff cannot access admin pages', async ({ page }) => {
      await loginAsStaff(page);
      
      // Try to access admin pages directly
      const adminPages = [
        '/admin/users',
        '/admin/settings',
        '/admin/reports'
      ];
      
      for (const adminPage of adminPages) {
        await page.goto(adminPage);
        // Should be redirected or show access denied
        await expect(page).not.toHaveURL(adminPage);
        // Might show error or redirect to dashboard
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/dashboard|\/auth\/login|\/403/);
      }
    });

    test('Admin has full access to all features', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Admin-only features
      // User management
      await page.goto('/admin/users');
      await expect(page.locator('button:has-text("Add User")')).toBeVisible();
      
      // Settings access
      await page.goto('/admin/settings/security');
      await expect(page.locator('text=Security Settings')).toBeVisible();
      
      // Can perform admin actions
      await page.goto('/admin/users');
      await page.click('button[aria-label="User actions"]:first-child');
      await expect(page.locator('text=Edit User')).toBeVisible();
      await expect(page.locator('text=Delete User')).toBeVisible();
      await expect(page.locator('text=Reset Password')).toBeVisible();
    });

    test('Staff has limited settings access', async ({ page }) => {
      await loginAsStaff(page);
      
      // Staff can access their profile
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Profile');
      
      // Can change own password
      await expect(page.locator('button:has-text("Change Password")')).toBeVisible();
      
      // Cannot see admin settings
      await expect(page.locator('text=User Management')).not.toBeVisible();
      await expect(page.locator('text=System Settings')).not.toBeVisible();
    });
  });

  test.describe('Complete Business Workflow Integration', () => {
    test('End-to-end workflow: Receive, Store, Ship, Invoice', async ({ page }) => {
      // Part 1: Admin sets up SKU and rates
      await loginAsAdmin(page);
      
      // Create a new SKU
      await page.goto('/config/products/new');
      const testSku = `E2E-SKU-${Date.now()}`;
      await page.fill('input[name="sku"]', testSku);
      await page.fill('input[name="name"]', 'E2E Test Product');
      await page.fill('input[name="description"]', 'Product for E2E testing');
      const btn = page.locator('button:has-text("Create Product"), a:has-text("Create Product")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      await waitForToast(page, 'Product created successfully');
      
      // Set up storage rates
      await page.goto('/config/rates/new');
      await page.fill('input[name="name"]', 'E2E Test Rate');
      await page.fill('input[name="storage_rate"]', '0.50');
      await page.fill('input[name="handling_in_rate"]', '2.00');
      await page.fill('input[name="handling_out_rate"]', '2.00');
      const createRateBtn = page.locator('button:has-text("Create Rate"), a:has-text("Create Rate")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await waitForToast(page, 'Rate created successfully');
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Logout');
      
      // Part 2: Staff receives goods
      await loginAsStaff(page);
      
      await page.goto('/operations/receive');
      const newReceivingBtn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      
      // Select warehouse and add SKU
      await page.click('[data-testid="warehouse-select"]');
      await page.click('[role="option"]:first-child');
      
      const createProductBtn = page.locator('button:has-text("Create Product"), a:has-text("Create Product")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', testSku);
      await page.keyboard.press('Enter');
      await page.fill('input[name="quantity"]', '100');
      
      const receiveItemsBtn = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await waitForToast(page, 'Items received successfully');
      
      // Get transaction ID
      await page.goto('/operations/transactions');
      const transactionId = await page.locator('table >> tr:has-text("RECEIVING") >> td:first-child').textContent();
      
      // Part 3: Let some time pass (simulate storage)
      // In real scenario, this would be days/weeks
      
      // Part 4: Ship some goods
      await page.goto('/operations/ship');
      const newShipmentBtn = page.locator('button:has-text("New Shipment"), a:has-text("New Shipment")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      
      await page.click('[data-testid="warehouse-select"]');
      await page.click('[role="option"]:first-child');
      
      const addItemBtn = page.locator('button:has-text("Add Item"), a:has-text("Add Item")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', testSku);
      await page.keyboard.press('Enter');
      await page.fill('input[name="ship_quantity"]', '50');
      
      const shipItemsBtn = page.locator('button:has-text("Ship Items"), a:has-text("Ship Items")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await waitForToast(page, 'Shipment created successfully');
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Logout');
      
      // Part 5: Admin generates invoice
      await loginAsAdmin(page);
      
      await page.goto('/finance/invoices/new');
      await page.click('[data-testid="invoice-type-select"]');
      await page.click('text=Combined Invoice');
      
      await page.click('[data-testid="customer-select"]');
      await page.click('[role="option"]:first-child');
      
      // Select transactions
      const selectTransactionsBtn = page.locator('button:has-text("Select Transactions"), a:has-text("Select Transactions")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await page.check(`input[value="${transactionId}"]`);
      const addSelectedBtn = page.locator('button:has-text("Add Selected"), a:has-text("Add Selected")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      
      const generateInvoiceBtn = page.locator('button:has-text("Generate Invoice"), a:has-text("Generate Invoice")').first();
    if (await createRateBtn.isVisible()) {
      await createRateBtn.click();
    };
      await waitForToast(page, 'Invoice generated successfully');
      
      // Verify invoice contains all charges
      await expect(page.locator('text=Handling In')).toBeVisible();
      await expect(page.locator('text=Storage')).toBeVisible();
      await expect(page.locator('text=Handling Out')).toBeVisible();
      
      // Verify total
      const total = await page.locator('[data-testid="invoice-total"]').textContent();
      expect(parseFloat(total?.replace('$', '') || '0')).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('Handle network errors gracefully', async ({ page }) => {
      await loginAsStaff(page);
      
      // Simulate offline
      await page.context().setOffline(true);
      
      // Try to perform an action
      await page.goto('/operations/receive');
      const btn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      
      // Should show error message
      await expect(page.locator('text=Network error')).toBeVisible();
      
      // Go back online
      await page.context().setOffline(false);
      
      // Retry should work
      await page.reload();
      const newReceivingBtn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await newReceivingBtn.isVisible()) {
      await newReceivingBtn.click();
    };
      await expect(page.locator('text=New Receiving')).toBeVisible();
    });

    test('Handle form validation errors', async ({ page }) => {
      await loginAsStaff(page);
      
      // Try to submit empty receiving form
      await page.goto('/operations/receive');
      const btn = page.locator('button:has-text("New Receiving"), a:has-text("New Receiving")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
      const receiveItemsBtn = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await receiveItemsBtn.isVisible()) {
      await receiveItemsBtn.click();
    };
      
      // Should show validation errors
      await expect(page.locator('text=Please select a warehouse')).toBeVisible();
      await expect(page.locator('text=Please add at least one item')).toBeVisible();
      
      // Try invalid quantities
      await page.click('[data-testid="warehouse-select"]');
      await page.click('[role="option"]:first-child');
      
      const createProductBtn = page.locator('button:has-text("Create Product"), a:has-text("Create Product")').first();
    if (await receiveItemsBtn.isVisible()) {
      await receiveItemsBtn.click();
    };
      await page.fill('input[placeholder="Search SKUs..."]', 'TEST-SKU-001');
      await page.keyboard.press('Enter');
      
      // Negative quantity
      await page.fill('input[name="quantity"]', '-10');
      const receiveItemsBtn2 = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await receiveItemsBtn2.isVisible()) {
      await receiveItemsBtn2.click();
    };
      await expect(page.locator('text=Quantity must be positive')).toBeVisible();
      
      // Zero quantity
      await page.fill('input[name="quantity"]', '0');
      const receiveItemsBtn3 = page.locator('button:has-text("Receive Items"), a:has-text("Receive Items")').first();
    if (await receiveItemsBtn3.isVisible()) {
      await receiveItemsBtn3.click();
    };
      await expect(page.locator('text=Quantity must be greater than 0')).toBeVisible();
    });

    test('Handle concurrent updates', async ({ browser }) => {
      // Create two browser contexts (simulate two users)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Both users login
      await loginAsStaff(page1);
      await loginAsStaff(page2);
      
      // Both navigate to ship the same SKU
      await page1.goto('/operations/ship');
      await page2.goto('/operations/ship');
      
      // Both start shipments for the same SKU
      await page1.click('button:has-text("New Shipment")');
      await page2.click('button:has-text("New Shipment")');
      
      // Add same SKU
      const addSku = async (page: Page) => {
        await page.click('[data-testid="warehouse-select"]');
        await page.click('[role="option"]:first-child');
        const btn = page.locator('button:has-text("Add Item"), a:has-text("Add Item")').first();
    if (await btn.isVisible()) {
      await btn.click();
    };
        await page.fill('input[placeholder="Search SKUs..."]', 'LIMITED-SKU-001');
        await page.keyboard.press('Enter');
        await page.fill('input[name="ship_quantity"]', '50');
      };
      
      await addSku(page1);
      await addSku(page2);
      
      // First user ships successfully
      await page1.click('button:has-text("Ship Items")');
      await expect(page1.locator('text=Shipment created successfully')).toBeVisible();
      
      // Second user should get inventory error
      await page2.click('button:has-text("Ship Items")');
      await expect(page2.locator('text=Insufficient inventory')).toBeVisible();
      
      // Cleanup
      await context1.close();
      await context2.close();
    });
  });
});
