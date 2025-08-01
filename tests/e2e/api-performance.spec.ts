import { test, expect } from '@playwright/test'

test.describe('API Performance Verification', () => {
  test('API endpoints performance check', async ({ request }) => {
    console.log('\n🚀 API PERFORMANCE TEST\n')
    
    const endpoints = [
      { name: 'Health Check', url: '/api/health' },
      { name: 'Inventory Balances', url: '/api/inventory/balances' },
      { name: 'Transactions Ledger', url: '/api/transactions/ledger' },
      { name: 'Warehouses', url: '/api/warehouses' }
    ]
    
    const results = []
    
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint.name}...`)
      
      // Warm up request
      await request.get(endpoint.url).catch(() => {})
      
      // Measure 5 requests
      const times = []
      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        const response = await request.get(endpoint.url)
        const elapsed = Date.now() - start
        times.push(elapsed)
        
        if (i === 0) {
          console.log(`  Status: ${response.status()}`)
        }
      }
      
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      const min = Math.min(...times)
      const max = Math.max(...times)
      
      console.log(`  Average: ${avg}ms (min: ${min}ms, max: ${max}ms)`)
      
      results.push({
        endpoint: endpoint.name,
        average: avg,
        min,
        max,
        status: times.length === 5 ? 'PASS' : 'FAIL'
      })
      
      // Performance assertions
      if (endpoint.name === 'Inventory Balances') {
        expect(avg).toBeLessThan(150) // Should be under 150ms
      }
    }
    
    // Summary
    console.log('\n📊 PERFORMANCE SUMMARY:')
    console.log('━'.repeat(50))
    results.forEach(r => {
      const icon = r.average < 100 ? '🟢' : r.average < 200 ? '🟡' : '🔴'
      console.log(`${icon} ${r.endpoint}: ${r.average}ms avg`)
    })
    
    // Overall performance check
    const overallAvg = Math.round(results.reduce((a, b) => a + b.average, 0) / results.length)
    console.log(`\n📈 Overall Average: ${overallAvg}ms`)
    
    if (overallAvg < 100) {
      console.log('🎉 EXCELLENT PERFORMANCE!')
    } else if (overallAvg < 200) {
      console.log('✅ GOOD PERFORMANCE')
    } else {
      console.log('⚠️  PERFORMANCE NEEDS OPTIMIZATION')
    }
  })
})