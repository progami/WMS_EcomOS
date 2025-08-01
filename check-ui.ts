#!/usr/bin/env tsx
import { chromium } from 'playwright'

async function checkUI() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  try {
    await page.goto('http://localhost:3000/operations/inventory')
    await page.waitForLoadState('networkidle')
    
    // Wait for Current Balances button and click it
    const balancesButton = await page.waitForSelector('button:has-text("Current Balances")', { timeout: 5000 })
    await balancesButton.click()
    
    // Wait a bit for data to load
    await page.waitForTimeout(2000)
    
    // Check what's displayed
    const pageContent = await page.content()
    
    // Look for specific indicators
    const hasNoDataMessage = pageContent.includes('No inventory found') || pageContent.includes('No data')
    const hasTable = pageContent.includes('<table') && pageContent.includes('</table>')
    const hasTableRows = pageContent.includes('<tbody') && pageContent.includes('</tbody>')
    
    console.log('UI Check Results:')
    console.log('=================')
    console.log(`Has "No data" message: ${hasNoDataMessage}`)
    console.log(`Has table element: ${hasTable}`)
    console.log(`Has table body: ${hasTableRows}`)
    
    // Count table rows if they exist
    if (hasTable) {
      const rowCount = await page.evaluate(() => {
        return document.querySelectorAll('table tbody tr').length
      })
      console.log(`Table row count: ${rowCount}`)
      
      // Get first row data if exists
      if (rowCount > 0) {
        const firstRow = await page.evaluate(() => {
          const row = document.querySelector('table tbody tr')
          const cells = row?.querySelectorAll('td')
          return cells ? Array.from(cells).map(c => c.textContent?.trim() || '') : []
        })
        console.log(`\nFirst row data: ${firstRow.join(' | ')}`)
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'inventory-ui-check.png', fullPage: true })
    console.log('\n📸 Screenshot saved as inventory-ui-check.png')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

checkUI()