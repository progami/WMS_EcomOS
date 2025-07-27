const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('#emailOrUsername', 'demo-admin@warehouse.com');
  await page.fill('#password', 'SecureWarehouse2024!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('✅ Logged in');
  
  // Go to receive page
  await page.goto('http://localhost:3000/operations/receive');
  await page.waitForTimeout(3000);
  
  // Save the existing receipt
  const saveButton = page.locator('button:has-text("Save Receipt")');
  if (await saveButton.count() > 0) {
    console.log('Saving existing receipt...');
    await saveButton.click();
    await page.waitForTimeout(5000);
    
    // Check where we are now
    const currentUrl = page.url();
    console.log('After save, URL:', currentUrl);
    
    // If we're on inventory, try to go back to receive
    if (currentUrl.includes('/inventory')) {
      console.log('Redirected to inventory. Going back to receive page...');
      await page.goto('http://localhost:3000/operations/receive');
      await page.waitForTimeout(3000);
      
      // Check what's on the page now
      const hasAddItem = await page.locator('button:has-text("Add Item")').count();
      const hasSaveReceipt = await page.locator('button:has-text("Save Receipt")').count();
      const hasCommercialInvoice = await page.locator('input[placeholder*="Commercial"]').count();
      
      console.log('\nReceive page after completing previous:');
      console.log('- Has Add Item button:', hasAddItem > 0);
      console.log('- Has Save Receipt button:', hasSaveReceipt > 0);
      console.log('- Has Commercial Invoice input:', hasCommercialInvoice > 0);
      
      await page.screenshot({ path: 'receive-page-after-complete.png', fullPage: true });
    }
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
})();