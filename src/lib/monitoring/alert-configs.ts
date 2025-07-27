import { monitoringService, AlertConfig } from './monitoring-service'
import { securityLogger, apiLogger, dbLogger } from '../logger'

// Define alert configurations
const alertConfigs: AlertConfig[] = [
  // Performance alerts
  {
    name: 'High API Response Time',
    metric: 'api.response_time',
    threshold: 2000, // 2 seconds
    operator: 'gt',
    windowMs: 5 * 60 * 1000, // 5 minutes
    consecutiveBreaches: 3,
    cooldownMs: 15 * 60 * 1000, // 15 minutes
    severity: 'high',
    callback: async (alert) => {
      apiLogger.error('High API response time alert triggered', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  {
    name: 'High Error Rate',
    metric: 'api.error_rate',
    threshold: 0.05, // 5% error rate
    operator: 'gt',
    windowMs: 5 * 60 * 1000,
    consecutiveBreaches: 2,
    cooldownMs: 10 * 60 * 1000,
    severity: 'critical',
    callback: async (alert) => {
      apiLogger.error('High error rate alert triggered', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  // Database alerts
  {
    name: 'Database Lock Duration',
    metric: 'db.lock_duration',
    threshold: 1000, // 1 second
    operator: 'gt',
    windowMs: 5 * 60 * 1000,
    consecutiveBreaches: 5,
    cooldownMs: 30 * 60 * 1000,
    severity: 'high',
    callback: async (alert) => {
      dbLogger.error('High database lock duration detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  {
    name: 'Slow Database Queries',
    metric: 'db.query_time',
    threshold: 5000, // 5 seconds
    operator: 'gt',
    windowMs: 10 * 60 * 1000,
    consecutiveBreaches: 3,
    cooldownMs: 20 * 60 * 1000,
    severity: 'medium',
    callback: async (alert) => {
      dbLogger.warn('Slow database queries detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  // Cache alerts
  {
    name: 'Low Cache Hit Rate',
    metric: 'cache.hit_rate',
    threshold: 0.7, // 70% hit rate
    operator: 'lt',
    windowMs: 15 * 60 * 1000,
    consecutiveBreaches: 5,
    cooldownMs: 60 * 60 * 1000,
    severity: 'medium',
    callback: async (alert) => {
      apiLogger.warn('Low cache hit rate detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  // Reconciliation alerts
  {
    name: 'High Reconciliation Discrepancies',
    metric: 'reconciliation.discrepancy_rate',
    threshold: 0.01, // 1% discrepancy rate
    operator: 'gt',
    windowMs: 30 * 60 * 1000,
    consecutiveBreaches: 2,
    cooldownMs: 60 * 60 * 1000,
    severity: 'critical',
    callback: async (alert) => {
      apiLogger.error('High reconciliation discrepancy rate', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  // Security alerts
  {
    name: 'Critical Security Events',
    metric: 'security.critical_events',
    threshold: 0, // Any critical event
    operator: 'gt',
    windowMs: 5 * 60 * 1000,
    consecutiveBreaches: 1,
    cooldownMs: 30 * 60 * 1000,
    severity: 'critical',
    callback: async (alert) => {
      securityLogger.error('Critical security event detected', {
        value: alert.value
      })
      
      // In production, send notifications to security team
      // await notifySecurityTeam(alert)
    }
  },
  
  {
    name: 'Rate Limit Violations',
    metric: 'security.rate_limit_violations',
    threshold: 10, // 10 violations
    operator: 'gt',
    windowMs: 5 * 60 * 1000,
    consecutiveBreaches: 1,
    cooldownMs: 15 * 60 * 1000,
    severity: 'high',
    callback: async (alert) => {
      securityLogger.warn('High rate limit violations detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  // Resource alerts
  {
    name: 'High Memory Usage',
    metric: 'system.memory_usage',
    threshold: 0.9, // 90% memory usage
    operator: 'gt',
    windowMs: 5 * 60 * 1000,
    consecutiveBreaches: 3,
    cooldownMs: 30 * 60 * 1000,
    severity: 'high',
    callback: async (alert) => {
      apiLogger.error('High memory usage detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  },
  
  {
    name: 'High Concurrent Requests',
    metric: 'api.concurrent_requests',
    threshold: 100,
    operator: 'gt',
    windowMs: 1 * 60 * 1000,
    consecutiveBreaches: 2,
    cooldownMs: 10 * 60 * 1000,
    severity: 'medium',
    callback: async (alert) => {
      apiLogger.warn('High concurrent requests detected', {
        value: alert.value,
        threshold: alert.config.threshold
      })
    }
  }
]

// Initialize alerts
export function initializeAlerts() {
  alertConfigs.forEach(config => {
    monitoringService.configureAlert(config)
  })
  
  console.log(`Initialized ${alertConfigs.length} monitoring alerts`)
}

// Add custom alert
export function addCustomAlert(config: AlertConfig) {
  monitoringService.configureAlert(config)
}

// Get alert status
export function getAlertStatus() {
  return {
    configured: alertConfigs.length,
    active: monitoringService.getActiveAlerts().length,
    configs: alertConfigs.map(c => ({
      name: c.name,
      metric: c.metric,
      threshold: c.threshold,
      operator: c.operator,
      severity: c.severity
    }))
  }
}