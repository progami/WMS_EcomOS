import { perfLogger } from '@/lib/logger/server'

interface PerformanceMetrics {
  operation: string
  duration: number
  metadata?: Record<string, any>
}

// Consistent thresholds for both dev and production
const SLOW_QUERY_THRESHOLD = parseInt(process.env.MONITOR_SLOW_QUERY_THRESHOLD || '100')
const SLOW_API_THRESHOLD = parseInt(process.env.MONITOR_SLOW_API_THRESHOLD || '100')

export function logPerformance(metrics: PerformanceMetrics) {
  const { operation, duration, metadata } = metrics
  
  // Only log operations that exceed threshold (100ms by default)
  // This provides a middle ground - not too verbose, but catches performance issues
  const threshold = operation.includes('api.') ? SLOW_API_THRESHOLD : SLOW_QUERY_THRESHOLD
  
  if (duration > threshold) {
    // Log slow operations with consistent format
    perfLogger.slow(operation, duration, threshold, metadata)
    
    // Also log the details for debugging
    perfLogger.log(`[SLOW] ${operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${threshold}ms`,
      ...metadata
    })
  }
}

export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
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
    
    // Always log errors regardless of duration
    perfLogger.log(`[ERROR] ${operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...metadata
    })
    
    throw error
  }
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