import { test, expect } from '@playwright/test'

test.describe('Cost Calculations API Tests', () => {
  let authCookie: string

  test.beforeAll(async ({ page }) => {
    // Use the working login helper
    await page.goto('/auth/login')
    await page.fill('input[name="emailOrUsername"]', 'demo-admin')
    await page.fill('input[name="password"]', 'SecureWarehouse2024!')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 30000 })
    
    // Get cookies after successful login
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name.includes('session'))
    if (sessionCookie) {
      authCookie = `${sessionCookie.name}=${sessionCookie.value}`
    }
  })

  test('RECEIVE transaction should automatically calculate costs via API', async ({ request }) => {
    // Create RECEIVE transaction
    const transactionData = {
      transactionType: 'RECEIVE',
      warehouseId: 'FMC',
      transactionDate: new Date().toISOString(),
      trackingNumber: 'API-CONT-TEST-001',
      items: [{
        skuId: 'TEST-SKU-001',
        batchLot: 'BATCH-001',
        cartonsIn: 100,
        storagePalletsIn: 5,
        storageCartonsPerPallet: 20,
        unitsPerCarton: 12
      }]
    }

    const response = await request.post('/api/transactions', {
      data: transactionData,
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json'
      }
    })

    expect(response.ok()).toBeTruthy()
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.transactionIds).toHaveLength(1)

    // Wait a bit for cost calculations to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check calculated costs via API
    const costsResponse = await request.get('/api/finance/calculated-costs', {
      headers: {
        'Cookie': authCookie
      }
    })

    expect(costsResponse.ok()).toBeTruthy()
    const costs = await costsResponse.json()
    
    // Find our transaction's costs
    const transactionCosts = costs.filter((c: any) => 
      c.transaction?.trackingNumber === 'API-CONT-TEST-001'
    )

    expect(transactionCosts.length).toBeGreaterThan(0)

    // Verify cost categories
    const categories = transactionCosts.map((c: any) => c.costCategory)
    expect(categories).toContain('CONTAINER')
    expect(categories).toContain('CARTON')
    expect(categories).toContain('PALLET')
  })

  test('SHIP transaction should automatically calculate costs via API', async ({ request }) => {
    // Create SHIP transaction
    const transactionData = {
      transactionType: 'SHIP',
      warehouseId: 'FMC',
      transactionDate: new Date().toISOString(),
      trackingNumber: 'API-SHIP-LTL-001',
      items: [{
        skuId: 'TEST-SKU-001',
        batchLot: 'BATCH-001',
        cartonsOut: 50,
        shippingPalletsOut: 3,
        shippingCartonsPerPallet: 17,
        unitsPerCarton: 12
      }]
    }

    const response = await request.post('/api/transactions', {
      data: transactionData,
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json'
      }
    })

    expect(response.ok()).toBeTruthy()
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.transactionIds).toHaveLength(1)

    // Wait a bit for cost calculations to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check calculated costs via API
    const costsResponse = await request.get('/api/finance/calculated-costs', {
      headers: {
        'Cookie': authCookie
      }
    })

    expect(costsResponse.ok()).toBeTruthy()
    const costs = await costsResponse.json()
    
    // Find our transaction's costs
    const transactionCosts = costs.filter((c: any) => 
      c.transaction?.trackingNumber === 'API-SHIP-LTL-001'
    )

    expect(transactionCosts.length).toBeGreaterThan(0)

    // Verify cost categories
    const categories = transactionCosts.map((c: any) => c.costCategory)
    expect(categories).toContain('CARTON')
    expect(categories).toContain('PALLET')
    expect(categories).toContain('SHIPMENT')

    // Verify LTL cost
    const ltlCost = transactionCosts.find((c: any) => 
      c.costCategory === 'SHIPMENT' && c.costName === 'LTL Transport'
    )
    expect(ltlCost).toBeTruthy()
    expect(parseFloat(ltlCost.totalCost)).toBe(50)
  })

  test('View cost rates via API', async ({ request }) => {
    const response = await request.get('/api/settings/rates', {
      headers: {
        'Cookie': authCookie
      }
    })

    expect(response.ok()).toBeTruthy()
    const rates = await response.json()
    
    expect(rates.length).toBeGreaterThan(0)
    
    // Verify some expected rates exist
    const rateNames = rates.map((r: any) => r.costName)
    expect(rateNames).toContain('Terminal Charges')
    expect(rateNames).toContain('Carton Handling')
    expect(rateNames).toContain('Storage per Week')
  })
})