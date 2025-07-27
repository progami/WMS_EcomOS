import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { monitoringService } from '@/lib/monitoring/monitoring-service'
import { withApiMonitoring } from '@/lib/monitoring/api-monitoring'

export const GET = withApiMonitoring(async (request: NextRequest) => {
  // Check authentication and authorization
  const session = await getServerSession(authOptions)
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get time window from query params (default: last hour)
    const searchParams = request.nextUrl.searchParams
    const windowMs = parseInt(searchParams.get('window') || '3600000')

    // Gather performance metrics
    const performanceMetrics = monitoringService.getRecentPerformanceMetrics(100)
    const performanceByEndpoint = new Map<string, { times: number[], errors: number }>()
    
    performanceMetrics.forEach(metric => {
      const key = metric.endpoint
      if (!performanceByEndpoint.has(key)) {
        performanceByEndpoint.set(key, { times: [], errors: 0 })
      }
      const data = performanceByEndpoint.get(key)!
      data.times.push(metric.duration)
      if (metric.statusCode >= 400) data.errors++
    })

    const endpoints = Array.from(performanceByEndpoint.entries()).map(([endpoint, data]) => ({
      endpoint,
      avgTime: data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0,
      count: data.times.length,
      errorRate: data.times.length > 0 ? data.errors / data.times.length : 0
    })).sort((a, b) => b.count - a.count).slice(0, 10)

    const totalRequests = performanceMetrics.length
    const totalErrors = performanceMetrics.filter(m => m.statusCode >= 400).length
    const avgResponseTime = totalRequests > 0 
      ? performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0
    const slowRequests = performanceMetrics.filter(m => m.duration > 1000).length

    // Database metrics
    const dbMetrics = monitoringService.getRecentDatabaseMetrics(100)
    const dbByOperation = new Map<string, { times: number[], count: number }>()
    
    dbMetrics.forEach(metric => {
      const key = `${metric.operation}-${metric.table}`
      if (!dbByOperation.has(key)) {
        dbByOperation.set(key, { times: [], count: 0 })
      }
      const data = dbByOperation.get(key)!
      data.times.push(metric.duration)
      data.count++
    })

    const operations = Array.from(dbByOperation.entries()).map(([key, data]) => {
      const [operation, table] = key.split('-')
      return {
        operation,
        table,
        avgTime: data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0,
        count: data.count
      }
    }).slice(0, 10)

    const avgQueryTime = dbMetrics.length > 0
      ? dbMetrics.reduce((sum, m) => sum + m.duration, 0) / dbMetrics.length
      : 0
    const slowQueries = dbMetrics.filter(m => m.duration > 1000).length
    const lockWaitTime = dbMetrics.length > 0
      ? dbMetrics.reduce((sum, m) => sum + (m.lockWaitTime || 0), 0) / dbMetrics.length
      : 0
    const dbErrorRate = dbMetrics.length > 0
      ? dbMetrics.filter(m => m.error).length / dbMetrics.length
      : 0

    // Cache metrics
    const cacheStats = monitoringService.getCacheStats()

    // Reconciliation metrics
    const reconciliationMetrics = monitoringService.getRecentReconciliationMetrics(50)
    const totalChecks = reconciliationMetrics.length
    const totalDiscrepancies = reconciliationMetrics.reduce((sum, m) => sum + m.discrepancies, 0)
    const totalRecords = reconciliationMetrics.reduce((sum, m) => sum + m.totalRecords, 0)
    const discrepancyRate = totalRecords > 0 ? totalDiscrepancies / totalRecords : 0

    const recentChecks = reconciliationMetrics.slice(0, 10).map(m => ({
      type: m.type,
      timestamp: m.timestamp.toISOString(),
      discrepancies: m.discrepancies,
      total: m.totalRecords
    }))

    // Security metrics
    const securityMetrics = monitoringService.getRecentSecurityMetrics(100)
    const totalSecurityEvents = securityMetrics.length
    const criticalEvents = securityMetrics.filter(m => m.severity === 'critical').length
    const rateLimitViolations = securityMetrics.filter(m => m.event === 'rate_limit_exceeded').length

    const recentSecurityEvents = securityMetrics.slice(0, 10).map(m => ({
      event: m.event,
      severity: m.severity,
      timestamp: m.timestamp.toISOString(),
      details: m.details
    }))

    // Active alerts
    const activeAlerts = monitoringService.getActiveAlerts().map(alert => ({
      id: alert.id,
      name: alert.config.name,
      severity: alert.config.severity,
      message: alert.message,
      triggeredAt: alert.triggeredAt.toISOString(),
      value: alert.value
    }))

    // Compile response
    const response = {
      performance: {
        avgResponseTime,
        totalRequests,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
        slowRequests,
        endpoints
      },
      database: {
        avgQueryTime,
        slowQueries,
        lockWaitTime,
        errorRate: dbErrorRate,
        operations
      },
      cache: {
        hitRate: cacheStats.hitRate,
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses,
        evictions: 0, // TODO: Get from cache service
        size: 0, // TODO: Get from cache service
        maxSize: 100 * 1024 * 1024 // 100MB
      },
      reconciliation: {
        totalChecks,
        totalDiscrepancies,
        discrepancyRate,
        recentChecks
      },
      security: {
        totalEvents: totalSecurityEvents,
        criticalEvents,
        recentEvents: recentSecurityEvents,
        rateLimitViolations
      },
      alerts: activeAlerts
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching monitoring metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring metrics' },
      { status: 500 }
    )
  }
}, {
  skipPaths: [] // Don't skip monitoring for this endpoint
})