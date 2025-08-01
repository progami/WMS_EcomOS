import { test, expect } from '@playwright/test'

test.describe('Monitoring Test', () => {
  test('test inventory API performance monitoring', async ({ page }) => {
    console.log('🔍 Testing monitoring with real API calls...\n')
    
    // Navigate to login page
    await page.goto('http://localhost:3000/login')
    
    // Login with demo user
    await page.fill('input[name="emailOrUsername"]', 'demo-admin@warehouse.com')
    await page.fill('input[name="password"]', 'demo123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
    console.log('✅ Logged in successfully')
    
    // Get cookies for API requests
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name.includes('next-auth'))
    
    if (!sessionCookie) {
      throw new Error('Session cookie not found')
    }
    
    // Make direct API request to inventory balances
    console.log('\n📊 Making API request to /api/inventory/balances...')
    const startTime = Date.now()
    
    const response = await page.request.get('http://localhost:3000/api/inventory/balances', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    })
    
    const duration = Date.now() - startTime
    console.log(`\n✅ API Response received in ${duration}ms`)
    console.log(`Status: ${response.status()}`)
    console.log(`Headers:`)
    console.log(`  X-Trace-Id: ${response.headers()['x-trace-id'] || 'Not found'}`)
    console.log(`  X-Response-Time: ${response.headers()['x-response-time'] || 'Not found'}`)
    
    // Check response
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    console.log(`\nData received: ${Array.isArray(data) ? data.length : 'paginated'} items`)
    
    // Make another request with filters
    console.log('\n📊 Making filtered API request...')
    const startTime2 = Date.now()
    
    const response2 = await page.request.get('http://localhost:3000/api/inventory/balances?showZeroStock=true', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    })
    
    const duration2 = Date.now() - startTime2
    console.log(`✅ Filtered API Response received in ${duration2}ms`)
    
    console.log('\n🎉 Monitoring test complete!')
    console.log('Check the server logs for detailed traces and slow query warnings')
  })
})