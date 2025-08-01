#!/usr/bin/env tsx
import { chromium } from 'playwright'

async function verifyBalances() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down to see what's happening
  })
  const page = await browser.newPage()
  
  console.log('🔍 Verifying Current Balances in the UI...\n')
  
  try {
    // Navigate to inventory page
    console.log('1. Navigating to inventory page...')
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    
    // Click on Current Balances tab
    console.log('2. Clicking Current Balances tab...')
    await page.click('button:has-text("Current Balances")')
    await page.waitForTimeout(2000)
    
    // Take screenshot
    await page.screenshot({ path: 'current-balances.png' })
    
    // Check for table rows
    const tableRows = await page.$$('table tbody tr')
    console.log(`\n✅ Found ${tableRows.length} rows in the Current Balances table`)
    
    // Get the actual balance data from the table
    const balances = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'))
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'))
        return {
          sku: cells[0]?.textContent?.trim() || '',
          warehouse: cells[1]?.textContent?.trim() || '',
          batch: cells[2]?.textContent?.trim() || '',
          cartons: cells[3]?.textContent?.trim() || '',
          units: cells[4]?.textContent?.trim() || '',
          pallets: cells[5]?.textContent?.trim() || ''
        }
      })
    })
    
    if (balances.length > 0) {
      console.log('\n📊 Current Balances in UI:')
      console.log('==========================')
      balances.forEach((balance, i) => {
        console.log(`\nRow ${i + 1}:`)
        console.log(`  SKU: ${balance.sku}`)
        console.log(`  Warehouse: ${balance.warehouse}`)
        console.log(`  Batch: ${balance.batch}`)
        console.log(`  Cartons: ${balance.cartons}`)
        console.log(`  Units: ${balance.units}`)
        console.log(`  Pallets: ${balance.pallets}`)
      })
    } else {
      // Check for "No inventory found" message
      const noDataText = await page.textContent('body')
      if (noDataText?.includes('No inventory found') || noDataText?.includes('No data')) {
        console.log('\n⚠️  "No inventory found" message is displayed')
      }
    }
    
    console.log('\n📸 Screenshot saved as current-balances.png')
    console.log('\n✅ Verification complete!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await browser.close()
  }
}

verifyBalances()