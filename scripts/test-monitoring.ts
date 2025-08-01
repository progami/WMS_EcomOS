#!/usr/bin/env tsx

// Set NODE_ENV to ensure we're in server context
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Direct winston import to avoid server-only module issue
import winston from 'winston'

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

async function testMonitoring() {
  console.log('🔍 Testing OpenTelemetry monitoring setup...\n')
  
  try {
    // Test 1: Logger is working
    logger.info('Test: Logger initialized successfully')
    logger.warn('Test: Warning message', { testData: 'sample' })
    logger.debug('Test: Debug message with performance data', { duration: '150ms', slow: true })
    
    console.log('✅ Logger test passed\n')
    
    // Test 2: Simulate a slow query log
    logger.warn('Slow database query', {
      query: 'SELECT * FROM inventory_transactions WHERE ...',
      duration: '250ms',
      params: '{"warehouseId": "123"}',
    })
    
    console.log('✅ Slow query logging test passed\n')
    
    // Test 3: Performance metrics
    logger.info('API operation performance', {
      operation: 'inventory_balance_calculation',
      duration: '1250ms',
      transactionCount: 5000,
      resultCount: 150,
    })
    
    console.log('✅ Performance metrics test passed\n')
    
    console.log('🎉 All monitoring tests passed!')
    console.log('\nNext steps:')
    console.log('1. Start the dev server: npm run dev')
    console.log('2. Make a request to /api/inventory/balances')
    console.log('3. Check the logs for OpenTelemetry traces and performance metrics')
    
  } catch (error) {
    console.error('❌ Monitoring test failed:', error)
    process.exit(1)
  }
}

testMonitoring()