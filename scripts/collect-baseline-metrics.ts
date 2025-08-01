#!/usr/bin/env tsx
/**
 * Collect baseline performance metrics for the WMS application
 * Run this script to measure current performance before optimizations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MetricResult {
  operation: string
  samples: number
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  p99: number
}

async function measureOperation(
  name: string, 
  operation: () => Promise<any>,
  samples: number = 10
): Promise<MetricResult> {
  const durations: number[] = []
  
  console.log(`\n📊 Measuring ${name}...`)
  
  // Warm up
  await operation()
  
  // Collect samples
  for (let i = 0; i < samples; i++) {
    const start = performance.now()
    await operation()
    const duration = performance.now() - start
    durations.push(duration)
    process.stdout.write(`  Sample ${i + 1}/${samples}: ${duration.toFixed(2)}ms\r`)
  }
  
  // Calculate statistics
  durations.sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)
  
  return {
    operation: name,
    samples,
    min: durations[0],
    max: durations[durations.length - 1],
    avg: sum / samples,
    p50: durations[Math.floor(samples * 0.5)],
    p95: durations[Math.floor(samples * 0.95)],
    p99: durations[Math.floor(samples * 0.99)]
  }
}

async function collectBaselineMetrics() {
  console.log('🔍 WMS Baseline Performance Metrics Collection')
  console.log('=' .repeat(50))
  
  const results: MetricResult[] = []
  
  try {
    // 1. Measure inventory balance calculation (current implementation)
    const inventoryResult = await measureOperation(
      'Inventory Balance Calculation (All Warehouses)',
      async () => {
        const transactions = await prisma.inventoryTransaction.findMany({
          include: {
            warehouse: true,
            sku: true
          },
          orderBy: [
            { transactionDate: 'asc' },
            { createdAt: 'asc' }
          ]
        })
        
        // Simulate balance calculation
        const balances = new Map()
        for (const tx of transactions) {
          const key = `${tx.warehouseId}-${tx.skuId}-${tx.batchLot}`
          const current = balances.get(key) || { cartons: 0 }
          current.cartons += tx.cartonsIn - tx.cartonsOut
          balances.set(key, current)
        }
        
        return balances.size
      },
      5 // Fewer samples as this is expensive
    )
    results.push(inventoryResult)
    
    // 2. Measure single SKU lookup
    const firstSku = await prisma.sku.findFirst()
    if (firstSku) {
      const skuResult = await measureOperation(
        'Single SKU Balance Query',
        async () => {
          const transactions = await prisma.inventoryTransaction.findMany({
            where: { skuId: firstSku.id },
            include: { warehouse: true, sku: true }
          })
          return transactions.length
        }
      )
      results.push(skuResult)
    }
    
    // 3. Measure transaction count
    const countResult = await measureOperation(
      'Transaction Count Query',
      async () => {
        return await prisma.inventoryTransaction.count()
      }
    )
    results.push(countResult)
    
    // 4. Measure user count (from test endpoint)
    const userCountResult = await measureOperation(
      'User Count Query',
      async () => {
        return await prisma.user.count()
      }
    )
    results.push(userCountResult)
    
    // 5. Measure recent transactions query
    const recentTxResult = await measureOperation(
      'Recent Transactions (Last 100)',
      async () => {
        return await prisma.inventoryTransaction.findMany({
          take: 100,
          orderBy: { transactionDate: 'desc' },
          include: { warehouse: true, sku: true }
        })
      }
    )
    results.push(recentTxResult)
    
    // Print results
    console.log('\n\n📊 BASELINE METRICS SUMMARY')
    console.log('=' .repeat(80))
    console.log(
      'Operation'.padEnd(40) +
      'Samples'.padEnd(10) +
      'Min'.padEnd(10) +
      'Avg'.padEnd(10) +
      'P95'.padEnd(10) +
      'P99'.padEnd(10) +
      'Max'
    )
    console.log('-' .repeat(80))
    
    for (const result of results) {
      console.log(
        result.operation.padEnd(40) +
        result.samples.toString().padEnd(10) +
        `${result.min.toFixed(1)}ms`.padEnd(10) +
        `${result.avg.toFixed(1)}ms`.padEnd(10) +
        `${result.p95.toFixed(1)}ms`.padEnd(10) +
        `${result.p99.toFixed(1)}ms`.padEnd(10) +
        `${result.max.toFixed(1)}ms`
      )
    }
    
    // Save to file
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `docs/baseline-metrics-${timestamp}.json`
    
    await require('fs').promises.writeFile(
      filename,
      JSON.stringify({
        date: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        results
      }, null, 2)
    )
    
    console.log(`\n✅ Metrics saved to ${filename}`)
    
    // Highlight critical findings
    const inventoryAvg = results.find(r => r.operation.includes('Inventory Balance'))?.avg || 0
    if (inventoryAvg > 1000) {
      console.log('\n⚠️  WARNING: Inventory balance calculation averaging > 1 second!')
      console.log('   This confirms the critical performance issue identified in the architecture review.')
    }
    
  } catch (error) {
    console.error('❌ Error collecting metrics:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the baseline collection
collectBaselineMetrics()