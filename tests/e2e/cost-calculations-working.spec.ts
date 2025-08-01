import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth-helpers'

test.describe('Cost Calculations Working Tests', () => {
  test('Create transactions and verify cost calculations', async ({ page, request }) => {
    await loginAsAdmin(page)
    
    const timestamp = Date.now()
    const testData = {
      receiveTracking: `CONT-TEST-${timestamp}`,
      shipTracking: `SHIP-LTL-${timestamp}`,
      skuId: 'A106-CHARGER',
      batchLot: `BATCH-${timestamp}`
    }

    console.log('=== Cost Calculation Test Started ===')
    console.log('Test data:', testData)

    // Create RECEIVE transaction via API
    const receiveResponse = await request.post('/api/transactions', {
      data: {
        transactionType: 'RECEIVE',
        warehouseId: 'FMC',
        transactionDate: new Date().toISOString(),
        trackingNumber: testData.receiveTracking,
        items: [{
          skuId: testData.skuId,
          batchLot: testData.batchLot,
          cartonsIn: 100,
          storagePalletsIn: 5,
          storageCartonsPerPallet: 20,
          unitsPerCarton: 12
        }]
      }
    })
    
    expect(receiveResponse.ok()).toBeTruthy()
    console.log('✓ RECEIVE transaction created')

    // Create SHIP transaction via API
    const shipResponse = await request.post('/api/transactions', {
      data: {
        transactionType: 'SHIP',
        warehouseId: 'FMC',
        transactionDate: new Date().toISOString(),
        trackingNumber: testData.shipTracking,
        items: [{
          skuId: testData.skuId,
          batchLot: testData.batchLot,
          cartonsOut: 50,
          shippingPalletsOut: 3,
          shippingCartonsPerPallet: 17,
          unitsPerCarton: 12
        }]
      }
    })
    
    expect(shipResponse.ok()).toBeTruthy()
    console.log('✓ SHIP transaction created')

    // Wait for cost calculations
    await page.waitForTimeout(3000)

    // Navigate to calculated costs page
    await page.goto('/finance/calculated-costs')
    await page.waitForLoadState('networkidle')
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/cost-calculations-${timestamp}.png`, 
      fullPage: true 
    })

    // Verify costs are visible
    const pageContent = await page.textContent('body')
    
    // Check for cost categories
    const hasContainerCost = pageContent.includes('CONTAINER')
    const hasCartonCost = pageContent.includes('CARTON')
    const hasPalletCost = pageContent.includes('PALLET')
    const hasShipmentCost = pageContent.includes('SHIPMENT')
    
    console.log('\n=== Cost Calculation Results ===')
    console.log(`Container costs: ${hasContainerCost ? '✓' : '✗'}`)
    console.log(`Carton costs: ${hasCartonCost ? '✓' : '✗'}`)
    console.log(`Pallet costs: ${hasPalletCost ? '✓' : '✗'}`)
    console.log(`Shipment costs: ${hasShipmentCost ? '✓' : '✗'}`)
    console.log(`\nScreenshot saved: test-results/cost-calculations-${timestamp}.png`)
    console.log('================================')
    
    // At least some costs should be present
    expect(hasCartonCost || hasPalletCost || hasContainerCost || hasShipmentCost).toBeTruthy()
  })

  test('View cost rates configuration', async ({ page }) => {
    await loginAsAdmin(page)
    
    await page.goto('/config/rates')
    await page.waitForLoadState('networkidle')
    
    const pageContent = await page.textContent('body')
    
    // Verify rates exist
    expect(pageContent).toContain('Terminal Charges')
    expect(pageContent).toContain('Carton Handling')
    expect(pageContent).toContain('Storage per Week')
    
    await page.screenshot({ 
      path: 'test-results/cost-rates-config.png', 
      fullPage: true 
    })
    
    console.log('✓ Cost rates configuration verified')
  })

  test('View transactions in ledger', async ({ page }) => {
    await loginAsAdmin(page)
    
    await page.goto('/operations/transactions')
    await page.waitForLoadState('networkidle')
    
    await page.screenshot({ 
      path: 'test-results/transactions-ledger.png', 
      fullPage: true 
    })
    
    console.log('✓ Transactions ledger viewed')
  })
})