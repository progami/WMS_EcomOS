import { perfLogger } from '@/lib/logger/server'

interface PerformanceMetrics {
  operation: string
  duration: number
  metadata?: Record<string, any>
}

// Production-optimized performance logger
export function logPerformance(metrics: PerformanceMetrics) {
  const { operation, duration, metadata } = metrics
  
  // In production, only log slow operations to reduce overhead
  if (process.env.NODE_ENV === 'production') {
    if (duration > 100) {
      perfLogger.slow(operation, duration, 100, metadata)
    }
  } else {
    // In development, log everything
    perfLogger.slow(operation, duration, 100, metadata)
    perfLogger.log(`Operation: ${operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      slow: duration > 100,
      ...metadata
    })
  }
}

export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  // Skip measurement entirely in production for non-critical paths
  if (process.env.NODE_ENV === 'production' && !shouldMeasureInProduction(operation)) {
    return fn()
  }
  
  const startTime = performance.now()
  
  try {
    const result = await fn()
    const duration = performance.now() - startTime
    
    logPerformance({
      operation,
      duration,
      metadata: {
        ...metadata,
        status: 'success'
      }
    })
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    
    logPerformance({
      operation,
      duration,
      metadata: {
        ...metadata,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    throw error
  }
}

// Define which operations should always be measured in production
function shouldMeasureInProduction(operation: string): boolean {
  const criticalOperations = [
    'api.inventory.balances',
    'api.transactions',
    'api.finance.cost-calculation',
    'database.query.slow'
  ]
  
  return criticalOperations.some(op => operation.startsWith(op))
}

export function createPerformanceLogger(context: string) {
  return {
    measure: <T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>) => 
      measureOperation(`${context}.${operation}`, fn, metadata),
    
    log: (operation: string, duration: number, metadata?: Record<string, any>) =>
      logPerformance({
        operation: `${context}.${operation}`,
        duration,
        metadata
      })
  }
}