import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

export interface MetricData {
  name: string
  value: number
  unit: string
  tags?: Record<string, string>
  timestamp: Date
}

export interface AlertConfig {
  name: string
  metric: string
  threshold: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  windowMs: number
  consecutiveBreaches?: number
  cooldownMs?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  callback?: (alert: Alert) => void | Promise<void>
}

export interface Alert {
  id: string
  config: AlertConfig
  triggeredAt: Date
  value: number
  message: string
  resolved: boolean
  resolvedAt?: Date
}

export interface PerformanceMetric {
  endpoint: string
  method: string
  statusCode: number
  duration: number
  timestamp: Date
  userId?: string
  errorMessage?: string
}

export interface DatabaseMetric {
  operation: string
  table: string
  duration: number
  lockDuration?: number
  lockWaitTime?: number
  rowsAffected?: number
  timestamp: Date
  error?: string
}

export interface CacheMetric {
  operation: 'get' | 'set' | 'delete' | 'invalidate'
  key: string
  hit: boolean
  duration: number
  size?: number
  ttl?: number
  timestamp: Date
}

export interface ReconciliationMetric {
  type: string
  discrepancies: number
  totalRecords: number
  duration: number
  timestamp: Date
  details?: Record<string, any>
}

export interface SecurityMetric {
  event: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, any>
  timestamp: Date
}

class MonitoringService extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map()
  private alerts: Map<string, Alert> = new Map()
  private alertConfigs: Map<string, AlertConfig> = new Map()
  private alertBreachCounts: Map<string, number> = new Map()
  private alertCooldowns: Map<string, Date> = new Map()
  
  // Metric aggregation windows
  private readonly RETENTION_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours
  private readonly AGGREGATION_INTERVAL_MS = 60 * 1000 // 1 minute
  
  // Performance tracking
  private performanceMetrics: PerformanceMetric[] = []
  private databaseMetrics: DatabaseMetric[] = []
  private cacheMetrics: CacheMetric[] = []
  private reconciliationMetrics: ReconciliationMetric[] = []
  private securityMetrics: SecurityMetric[] = []
  
  // Cache statistics
  private cacheHits = 0
  private cacheMisses = 0
  
  constructor() {
    super()
    this.startAggregation()
    this.startCleanup()
  }
  
  // Core metric recording
  recordMetric(name: string, value: number, unit: string = 'count', tags?: Record<string, string>) {
    const metric: MetricData = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date()
    }
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    this.metrics.get(name)!.push(metric)
    
    // Check alerts
    this.checkAlerts(name, value)
    
    // Emit metric event
    this.emit('metric', metric)
  }
  
  // Performance monitoring
  recordApiPerformance(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    userId?: string,
    errorMessage?: string
  ) {
    const metric: PerformanceMetric = {
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date(),
      user_id,
      errorMessage
    }
    
    this.performanceMetrics.push(metric)
    
    // Record as standard metric
    this.recordMetric('api.response_time', duration, 'ms', {
      endpoint,
      method,
      status: statusCode.toString()
    })
    
    // Record error rate
    if (statusCode >= 400) {
      this.recordMetric('api.error_rate', 1, 'count', {
        endpoint,
        method,
        status: statusCode.toString()
      })
    }
    
    this.emit('performance', metric)
  }
  
  // Database monitoring
  recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    options?: {
      lockDuration?: number
      lockWaitTime?: number
      rowsAffected?: number
      error?: string
    }
  ) {
    const metric: DatabaseMetric = {
      operation,
      table,
      duration,
      timestamp: new Date(),
      ...options
    }
    
    this.databaseMetrics.push(metric)
    
    // Record standard metrics
    this.recordMetric('db.query_time', duration, 'ms', { operation, table })
    
    if (options?.lockDuration) {
      this.recordMetric('db.lock_duration', options.lockDuration, 'ms', { operation, table })
    }
    
    if (options?.lockWaitTime) {
      this.recordMetric('db.lock_wait_time', options.lockWaitTime, 'ms', { operation, table })
    }
    
    if (options?.error) {
      this.recordMetric('db.errors', 1, 'count', { operation, table, error: options.error })
    }
    
    this.emit('database', metric)
  }
  
  // Cache monitoring
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'invalidate',
    key: string,
    hit: boolean,
    duration: number,
    options?: {
      size?: number
      ttl?: number
    }
  ) {
    const metric: CacheMetric = {
      operation,
      key,
      hit,
      duration,
      timestamp: new Date(),
      ...options
    }
    
    this.cacheMetrics.push(metric)
    
    // Update cache statistics
    if (operation === 'get') {
      if (hit) {
        this.cacheHits++
      } else {
        this.cacheMisses++
      }
    }
    
    // Record standard metrics
    this.recordMetric('cache.operation_time', duration, 'ms', { operation })
    
    if (operation === 'get') {
      this.recordMetric('cache.hit_rate', hit ? 1 : 0, 'ratio', { key })
    }
    
    this.emit('cache', metric)
  }
  
  // Reconciliation monitoring
  recordReconciliation(
    type: string,
    discrepancies: number,
    totalRecords: number,
    duration: number,
    details?: Record<string, any>
  ) {
    const metric: ReconciliationMetric = {
      type,
      discrepancies,
      totalRecords,
      duration,
      timestamp: new Date(),
      details
    }
    
    this.reconciliationMetrics.push(metric)
    
    // Record standard metrics
    this.recordMetric('reconciliation.discrepancies', discrepancies, 'count', { type })
    this.recordMetric('reconciliation.duration', duration, 'ms', { type })
    this.recordMetric('reconciliation.discrepancy_rate', 
      totalRecords > 0 ? discrepancies / totalRecords : 0, 
      'ratio', 
      { type }
    )
    
    this.emit('reconciliation', metric)
  }
  
  // Security monitoring
  recordSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const metric: SecurityMetric = {
      event,
      severity,
      details,
      timestamp: new Date(),
      user_id,
      ip_address,
      user_agent
    }
    
    this.securityMetrics.push(metric)
    
    // Record standard metrics
    this.recordMetric('security.events', 1, 'count', { event, severity })
    
    // Special handling for critical events
    if (severity === 'critical') {
      this.recordMetric('security.critical_events', 1, 'count', { event })
      
      // Emit critical security alert
      this.emit('critical_security', metric)
    }
    
    this.emit('security', metric)
  }
  
  // Alert management
  configureAlert(config: AlertConfig) {
    this.alertConfigs.set(config.name, config)
  }
  
  private checkAlerts(metricName: string, value: number) {
    for (const [alertName, config] of this.alertConfigs) {
      if (config.metric !== metricName) continue
      
      // Check if in cooldown
      const cooldownEnd = this.alertCooldowns.get(alertName)
      if (cooldownEnd && cooldownEnd > new Date()) continue
      
      // Check threshold
      let breached = false
      switch (config.operator) {
        case 'gt':
          breached = value > config.threshold
          break
        case 'lt':
          breached = value < config.threshold
          break
        case 'eq':
          breached = value === config.threshold
          break
        case 'gte':
          breached = value >= config.threshold
          break
        case 'lte':
          breached = value <= config.threshold
          break
      }
      
      if (breached) {
        // Track consecutive breaches
        const breachCount = (this.alertBreachCounts.get(alertName) || 0) + 1
        this.alertBreachCounts.set(alertName, breachCount)
        
        // Check if we should trigger alert
        const requiredBreaches = config.consecutiveBreaches || 1
        if (breachCount >= requiredBreaches) {
          this.triggerAlert(config, value)
          
          // Reset breach count and set cooldown
          this.alertBreachCounts.set(alertName, 0)
          if (config.cooldownMs) {
            this.alertCooldowns.set(
              alertName,
              new Date(Date.now() + config.cooldownMs)
            )
          }
        }
      } else {
        // Reset breach count if threshold not breached
        this.alertBreachCounts.set(alertName, 0)
      }
    }
  }
  
  private triggerAlert(config: AlertConfig, value: number) {
    const alert: Alert = {
      id: `${config.name}-${Date.now()}`,
      config,
      triggeredAt: new Date(),
      value,
      message: `Alert: ${config.name} - ${config.metric} is ${value} (threshold: ${config.operator} ${config.threshold})`,
      resolved: false
    }
    
    this.alerts.set(alert.id, alert)
    
    // Execute callback if provided
    if (config.callback) {
      config.callback(alert).catch(err => {
        console.error('Alert callback error:', err)
      })
    }
    
    // Emit alert event
    this.emit('alert', alert)
  }
  
  // Metric retrieval and aggregation
  getMetrics(name: string, windowMs?: number): MetricData[] {
    const metrics = this.metrics.get(name) || []
    
    if (windowMs) {
      const cutoff = new Date(Date.now() - windowMs)
      return metrics.filter(m => m.timestamp > cutoff)
    }
    
    return metrics
  }
  
  getAggregatedMetrics(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    windowMs: number,
    groupBy?: string
  ): Record<string, number> {
    const metrics = this.getMetrics(name, windowMs)
    
    if (!groupBy) {
      const values = metrics.map(m => m.value)
      return {
        [aggregation]: this.aggregate(values, aggregation)
      }
    }
    
    // Group by tag
    const groups = new Map<string, number[]>()
    for (const metric of metrics) {
      const groupKey = metric.tags?.[groupBy] || 'unknown'
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(metric.value)
    }
    
    const result: Record<string, number> = {}
    for (const [key, values] of groups) {
      result[key] = this.aggregate(values, aggregation)
    }
    
    return result
  }
  
  private aggregate(values: number[], type: string): number {
    if (values.length === 0) return 0
    
    switch (type) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0)
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
      case 'count':
        return values.length
      default:
        return 0
    }
  }
  
  // Cache statistics
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      missRate: total > 0 ? this.cacheMisses / total : 0
    }
  }
  
  // Get recent metrics for dashboards
  getRecentPerformanceMetrics(limit: number = 100): PerformanceMetric[] {
    return this.performanceMetrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  getRecentDatabaseMetrics(limit: number = 100): DatabaseMetric[] {
    return this.databaseMetrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  getRecentReconciliationMetrics(limit: number = 100): ReconciliationMetric[] {
    return this.reconciliationMetrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  getRecentSecurityMetrics(limit: number = 100): SecurityMetric[] {
    return this.securityMetrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
  }
  
  // Cleanup old data
  private startCleanup() {
    setInterval(() => {
      const cutoff = new Date(Date.now() - this.RETENTION_PERIOD_MS)
      
      // Clean metrics
      for (const [name, metrics] of this.metrics) {
        const filtered = metrics.filter(m => m.timestamp > cutoff)
        if (filtered.length === 0) {
          this.metrics.delete(name)
        } else {
          this.metrics.set(name, filtered)
        }
      }
      
      // Clean specific metric arrays
      this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff)
      this.databaseMetrics = this.databaseMetrics.filter(m => m.timestamp > cutoff)
      this.cacheMetrics = this.cacheMetrics.filter(m => m.timestamp > cutoff)
      this.reconciliationMetrics = this.reconciliationMetrics.filter(m => m.timestamp > cutoff)
      this.securityMetrics = this.securityMetrics.filter(m => m.timestamp > cutoff)
      
      // Clean resolved alerts older than 1 hour
      const alertCutoff = new Date(Date.now() - 60 * 60 * 1000)
      for (const [id, alert] of this.alerts) {
        if (alert.resolved && alert.resolved_at13960 && alert.resolved_at13980 < alertCutoff) {
          this.alerts.delete(id)
        }
      }
    }, this.AGGREGATION_INTERVAL_MS)
  }
  
  // Periodic aggregation
  private startAggregation() {
    setInterval(() => {
      this.emit('aggregation', {
        timestamp: new Date(),
        metrics: this.getAllMetricsSummary()
      })
    }, this.AGGREGATION_INTERVAL_MS)
  }
  
  private getAllMetricsSummary() {
    const summary: Record<string, any> = {}
    
    for (const [name, metrics] of this.metrics) {
      const recentMetrics = this.getMetrics(name, this.AGGREGATION_INTERVAL_MS)
      if (recentMetrics.length > 0) {
        const values = recentMetrics.map(m => m.value)
        summary[name] = {
          count: values.length,
          sum: this.aggregate(values, 'sum'),
          avg: this.aggregate(values, 'avg'),
          min: this.aggregate(values, 'min'),
          max: this.aggregate(values, 'max')
        }
      }
    }
    
    return summary
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService()

// Export convenience functions
export function recordMetric(name: string, value: number, unit?: string, tags?: Record<string, string>) {
  monitoringService.recordMetric(name, value, unit, tags)
}

export function recordApiPerformance(
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  userId?: string,
  errorMessage?: string
) {
  monitoringService.recordApiPerformance(endpoint, method, statusCode, duration, user_id, errorMessage)
}

export function recordDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  options?: {
    lockDuration?: number
    lockWaitTime?: number
    rowsAffected?: number
    error?: string
  }
) {
  monitoringService.recordDatabaseOperation(operation, table, duration, options)
}

export function recordCacheOperation(
  operation: 'get' | 'set' | 'delete' | 'invalidate',
  key: string,
  hit: boolean,
  duration: number,
  options?: {
    size?: number
    ttl?: number
  }
) {
  monitoringService.recordCacheOperation(operation, key, hit, duration, options)
}

export function recordReconciliation(
  type: string,
  discrepancies: number,
  totalRecords: number,
  duration: number,
  details?: Record<string, any>
) {
  monitoringService.recordReconciliation(type, discrepancies, totalRecords, duration, details)
}

export function recordSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
) {
  monitoringService.recordSecurityEvent(event, severity, details, user_id, ip_address, userAgent)
}