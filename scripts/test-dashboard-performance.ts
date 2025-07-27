#!/usr/bin/env node
import { performance } from 'perf_hooks'
import { dashboardService } from '../src/lib/services/dashboard-service'
import { prisma } from '../src/lib/prisma'

async function testDashboardPerformance() {
  console.log('Testing Dashboard Performance...\n')
  
  // Test dates
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  try {
    // Test 1: Cold run (no cache)
    console.log('Test 1: Cold run (no cache)')
    const start1 = performance.now()
    const result1 = await dashboardService.getMetrics(startDate, endDate)
    const duration1 = performance.now() - start1
    console.log(`Duration: ${duration1.toFixed(2)}ms`)
    console.log(`Stats loaded: ${Object.keys(result1.stats).length}`)
    console.log(`Chart data loaded: ${Object.keys(result1.chartData).length}\n`)
    
    // Test 2: Warm run (should be faster due to database query cache)
    console.log('Test 2: Warm run (database cache)')
    const start2 = performance.now()
    const result2 = await dashboardService.getMetrics(startDate, endDate)
    const duration2 = performance.now() - start2
    console.log(`Duration: ${duration2.toFixed(2)}ms`)
    console.log(`Improvement: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%\n`)
    
    // Test 3: With cache enabled (if configured)
    if (process.env.DASHBOARD_CACHE_ENABLED === 'true') {
      console.log('Test 3: With application cache')
      const start3 = performance.now()
      const result3 = await dashboardService.getMetrics(startDate, endDate)
      const duration3 = performance.now() - start3
      console.log(`Duration: ${duration3.toFixed(2)}ms`)
      console.log(`Improvement vs cold: ${((duration1 - duration3) / duration1 * 100).toFixed(1)}%\n`)
    }
    
    // Show query parallelization benefit
    console.log('Query Parallelization Analysis:')
    console.log('- Previously: 17+ sequential queries')
    console.log('- Now: 9 parallel query groups')
    console.log('- Theoretical speedup: ~2-3x for database queries')
    console.log('- Actual speedup will vary based on database load\n')
    
  } catch (error) {
    console.error('Error during performance test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testDashboardPerformance().catch(console.error)