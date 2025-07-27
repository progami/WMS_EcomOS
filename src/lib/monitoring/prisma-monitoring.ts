import { Prisma } from '@prisma/client'
import { recordDatabaseOperation } from './monitoring-service'
import { dbLogger } from '../logger'

interface QueryInfo {
  model?: string
  action?: string
  args?: any
  dataPath?: string[]
  runInTransaction?: boolean
  duration?: number
  error?: any
}

// Map to track query start times
const queryStartTimes = new Map<string, number>()

// Map to track lock acquisition times
const lockStartTimes = new Map<string, number>()

// Create a unique ID for each query
function createQueryId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Extract table name from model
function getTableName(model?: string): string {
  if (!model) return 'unknown'
  
  // Convert PascalCase to snake_case
  return model
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

// Detect if query might involve locks
function detectLockOperation(action?: string, args?: any): boolean {
  const lockActions = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert']
  
  if (action && lockActions.includes(action)) {
    return true
  }
  
  // Check for transactions
  if (args?.$transaction) {
    return true
  }
  
  // Check for SELECT ... FOR UPDATE patterns
  if (args?.where && (args?.lock || args?.forUpdate)) {
    return true
  }
  
  return false
}

// Estimate lock duration based on operation complexity
function estimateLockDuration(action?: string, args?: any): number {
  // This is a simplified estimation
  // In production, you'd want to track actual lock times from database
  
  if (action === 'updateMany' || action === 'deleteMany') {
    return 50 // Bulk operations typically hold locks longer
  }
  
  if (args?.$transaction) {
    return 100 // Transactions can hold locks for extended periods
  }
  
  return 10 // Single row operations
}

export function createPrismaMonitoringMiddleware(): Prisma.Middleware {
  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    const queryId = createQueryId()
    const startTime = performance.now()
    const info: QueryInfo = {
      model: params.model,
      action: params.action,
      args: params.args,
      dataPath: params.dataPath,
      runInTransaction: params.runInTransaction
    }
    
    // Track query start
    queryStartTimes.set(queryId, startTime)
    
    // Check if this might involve locks
    const mightLock = detectLockOperation(params.action, params.args)
    if (mightLock) {
      lockStartTimes.set(queryId, startTime)
    }
    
    try {
      // Execute the query
      const result = await next(params)
      
      // Calculate duration
      const duration = performance.now() - startTime
      info.duration = duration
      
      // Get table name
      const tableName = getTableName(params.model)
      
      // Record metrics
      const lockDuration = mightLock ? estimateLockDuration(params.action, params.args) : undefined
      const lockWaitTime = mightLock ? Math.max(0, duration - (lockDuration || 0)) : undefined
      
      recordDatabaseOperation(
        params.action || 'query',
        tableName,
        duration,
        {
          lockDuration,
          lockWaitTime,
          rowsAffected: result?.count || (Array.isArray(result) ? result.length : 1)
        }
      )
      
      // Log slow queries
      if (duration > 1000) {
        dbLogger.warn('Slow database query detected', {
          model: params.model,
          action: params.action,
          duration,
          args: JSON.stringify(params.args)
        })
      }
      
      // Log potential lock issues
      if (lockWaitTime && lockWaitTime > 100) {
        dbLogger.warn('High lock wait time detected', {
          model: params.model,
          action: params.action,
          lockWaitTime,
          lockDuration,
          duration
        })
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      info.duration = duration
      info.error = error
      
      // Record error metrics
      recordDatabaseOperation(
        params.action || 'query',
        getTableName(params.model),
        duration,
        {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )
      
      // Log database errors
      dbLogger.error('Database operation failed', {
        model: params.model,
        action: params.action,
        duration,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          code: (error as any).code,
          meta: (error as any).meta
        } : error
      })
      
      throw error
    } finally {
      // Cleanup
      queryStartTimes.delete(queryId)
      lockStartTimes.delete(queryId)
    }
  }
}

// Helper to analyze query patterns for optimization recommendations
export function analyzeQueryPatterns(recentQueries: QueryInfo[]): {
  slowQueries: QueryInfo[]
  frequentLocks: { model: string; count: number }[]
  recommendations: string[]
} {
  const slowQueries = recentQueries.filter(q => (q.duration || 0) > 1000)
  
  // Count lock operations by model
  const lockCounts = new Map<string, number>()
  recentQueries.forEach(q => {
    if (q.model && detectLockOperation(q.action, q.args)) {
      lockCounts.set(q.model, (lockCounts.get(q.model) || 0) + 1)
    }
  })
  
  const frequentLocks = Array.from(lockCounts.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (slowQueries.length > 0) {
    recommendations.push(`${slowQueries.length} slow queries detected. Consider adding indexes or optimizing query patterns.`)
  }
  
  if (frequentLocks.length > 0 && frequentLocks[0].count > 10) {
    recommendations.push(`High lock frequency on ${frequentLocks[0].model}. Consider batch operations or optimistic locking.`)
  }
  
  // Check for N+1 query patterns
  const modelCounts = new Map<string, number>()
  recentQueries.forEach(q => {
    if (q.model && q.action === 'findUnique') {
      modelCounts.set(q.model, (modelCounts.get(q.model) || 0) + 1)
    }
  })
  
  modelCounts.forEach((count, model) => {
    if (count > 10) {
      recommendations.push(`Potential N+1 query pattern detected for ${model}. Consider using include or batch queries.`)
    }
  })
  
  return {
    slowQueries,
    frequentLocks,
    recommendations
  }
}