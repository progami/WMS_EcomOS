#!/usr/bin/env tsx
import { chromium } from 'playwright'

async function testSimple() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  })
  const page = await browser.newPage()
  
  page.on('console', msg => console.log('Console:', msg.text()))
  page.on('pageerror', err => console.log('Page error:', err))
  
  try {
    console.log('Loading page...')
    await page.goto('http://localhost:3000/operations/inventory', { waitUntil: 'domcontentloaded' })
    
    console.log('Page loaded, waiting 3 seconds...')
    await page.waitForTimeout(3000)
    
    // Get page title
    const title = await page.title()
    console.log('Page title:', title)
    
    // Check if we're on login page
    const url = page.url()
    console.log('Current URL:', url)
    
    if (url.includes('login')) {
      console.log('⚠️  Redirected to login page - auth bypass not working')
    } else {
      // Look for tabs
      const tabs = await page.$$('button[role="tab"]')
      console.log(`Found ${tabs.length} tabs`)
      
      // Get tab texts
      for (const tab of tabs) {
        const text = await tab.textContent()
        console.log(`Tab: "${text}"`)
      }
      
      // Try to find and click Current Balances
      const balancesTab = await page.$('button[role="tab"]:has-text("Current Balances")')
      if (balancesTab) {
        console.log('Clicking Current Balances tab...')
        await balancesTab.click()
        await page.waitForTimeout(2000)
        
        // Check table
        const rows = await page.$$('table tbody tr')
        console.log(`\n✅ Current Balances table has ${rows.length} rows`)
        
        // Get data from first row
        if (rows.length > 0) {
          const firstRowText = await rows[0].textContent()
          console.log('First row:', firstRowText)
        }
      } else {
        console.log('❌ Current Balances tab not found')
      }
    }
    
    await page.screenshot({ path: 'debug.png' })
    console.log('\n📸 Screenshot saved as debug.png')
    
    console.log('\nBrowser staying open for inspection...')
    await page.waitForTimeout(30000)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testSimple()