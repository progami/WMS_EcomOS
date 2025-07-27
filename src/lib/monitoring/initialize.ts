import { initializeAlerts } from './alert-configs'
import { initializeOpenTelemetry } from './opentelemetry'
import { monitoringService } from './monitoring-service'
import { apiLogger } from '../logger'

let initialized = false

export async function initializeMonitoring() {
  if (initialized) {
    console.warn('Monitoring already initialized')
    return
  }
  
  try {
    // Initialize OpenTelemetry if enabled
    if (process.env.ENABLE_OPENTELEMETRY === 'true') {
      initializeOpenTelemetry()
    }
    
    // Initialize alert configurations
    initializeAlerts()
    
    // Set up monitoring event listeners
    setupEventListeners()
    
    // Log system information
    logSystemInfo()
    
    initialized = true
    console.log('Monitoring system initialized successfully')
  } catch (error) {
    console.error('Failed to initialize monitoring:', error)
    throw error
  }
}

function setupEventListeners() {
  // Listen for critical security events
  monitoringService.on('critical_security', async (event) => {
    apiLogger.error('CRITICAL SECURITY EVENT', {
      event: event.event,
      severity: event.severity,
      details: event.details,
      user_id: event.user_id,
      ip_address: event.ip_address1230
    })
    
    // In production, send immediate alerts
    if (process.env.NODE_ENV === 'production') {
      // await sendSecurityAlert(event)
    }
  })
  
  // Listen for alerts
  monitoringService.on('alert', async (alert) => {
    apiLogger.warn('Monitoring Alert Triggered', {
      alert: alert.config.name,
      severity: alert.config.severity,
      value: alert.value,
      threshold: alert.config.threshold,
      message: alert.message
    })
  })
  
  // Listen for aggregation events (for custom dashboards)
  monitoringService.on('aggregation', (data) => {
    // This could be sent to a time-series database
    if (process.env.TIMESERIES_DB_ENABLED === 'true') {
      // await sendToTimeSeriesDB(data)
    }
  })
}

function logSystemInfo() {
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  }
  
  apiLogger.info('System Information', systemInfo)
  
  // Record initial metrics
  const memUsage = process.memoryUsage()
  monitoringService.recordMetric(
    'system.memory_usage',
    memUsage.heapUsed / memUsage.heapTotal,
    'ratio'
  )
}

// Periodic system metrics collection
export function startSystemMetricsCollection() {
  setInterval(() => {
    const memUsage = process.memoryUsage()
    
    // Memory metrics
    monitoringService.recordMetric(
      'system.memory_usage',
      memUsage.heapUsed / memUsage.heapTotal,
      'ratio'
    )
    
    monitoringService.recordMetric(
      'system.memory_heap_used',
      memUsage.heapUsed / 1024 / 1024,
      'MB'
    )
    
    monitoringService.recordMetric(
      'system.memory_rss',
      memUsage.rss / 1024 / 1024,
      'MB'
    )
    
    // CPU metrics (if available)
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage()
      monitoringService.recordMetric(
        'system.cpu_user',
        cpuUsage.user / 1000,
        'ms'
      )
      
      monitoringService.recordMetric(
        'system.cpu_system',
        cpuUsage.system / 1000,
        'ms'
      )
    }
    
    // Process metrics
    monitoringService.recordMetric(
      'system.uptime',
      process.uptime(),
      'seconds'
    )
  }, 30000) // Every 30 seconds
}

// Graceful shutdown
export async function shutdownMonitoring() {
  try {
    // Flush any pending metrics
    monitoringService.emit('flush')
    
    // Shutdown OpenTelemetry
    if (process.env.ENABLE_OPENTELEMETRY === 'true') {
      const { shutdownOpenTelemetry } = await import('./opentelemetry')
      await shutdownOpenTelemetry()
    }
    
    console.log('Monitoring system shut down successfully')
  } catch (error) {
    console.error('Error during monitoring shutdown:', error)
  }
}