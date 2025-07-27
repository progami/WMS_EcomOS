// Enhanced logger implementation with monitoring integration
import { recordSecurityEvent, recordMetric } from './monitoring/monitoring-service'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, any>
  timestamp: Date
  logger: string
}

interface LoggerOptions {
  enableMetrics?: boolean
  enableSecurityTracking?: boolean
  metricsPrefix?: string
}

class Logger {
  private name: string
  private options: LoggerOptions
  private buffer: LogEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private readonly FLUSH_INTERVAL = 5000 // 5 seconds
  private readonly MAX_BUFFER_SIZE = 100

  constructor(name: string, options: LoggerOptions = {}) {
    this.name = name
    this.options = {
      enableMetrics: true,
      enableSecurityTracking: true,
      metricsPrefix: name.toLowerCase(),
      ...options
    }
    
    this.startFlushTimer()
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush()
      }
    }, this.FLUSH_INTERVAL)
  }

  private async flush() {
    const logs = [...this.buffer]
    this.buffer = []

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs })
        })
      } catch (error) {
        // Put logs back if send failed
        this.buffer.unshift(...logs)
      }
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
      logger: this.name
    }

    // Add to buffer for batch sending
    this.buffer.push(entry)
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush()
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${this.name}] ${entry.timestamp.toISOString()} ${level.toUpperCase()}`
      
      switch (level) {
        case 'error':
          console.error(prefix, message, context || '')
          break
        case 'warn':
          console.warn(prefix, message, context || '')
          break
        case 'debug':
          console.debug(prefix, message, context || '')
          break
        default:
          console.log(prefix, message, context || '')
      }
    }

    // Track metrics
    if (this.options.enableMetrics) {
      recordMetric(`logs.${this.options.metricsPrefix}.${level}`, 1, 'count')
    }

    // Track security events
    if (this.options.enableSecurityTracking && this.isSecurityEvent(message, context)) {
      const severity = this.getSecuritySeverity(level, message, context)
      recordSecurityEvent(
        `${this.name}: ${message}`,
        severity,
        context || {},
        context?.user_id,
        context?.ip_address3104,
        context?.user_agent3137
      )
    }
  }

  private isSecurityEvent(message: string, context?: Record<string, any>): boolean {
    const securityKeywords = [
      'auth', 'login', 'logout', 'password', 'token', 'unauthorized',
      'forbidden', 'security', 'csrf', 'rate limit', 'failed attempt',
      'suspicious', 'blocked', 'denied'
    ]

    const lowerMessage = message.toLowerCase()
    return securityKeywords.some(keyword => lowerMessage.includes(keyword)) ||
           context?.security === true
  }

  private getSecuritySeverity(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (context?.severity) {
      return context.severity
    }

    const lowerMessage = message.toLowerCase()
    
    // Critical security events
    if (lowerMessage.includes('breach') || 
        lowerMessage.includes('injection') ||
        lowerMessage.includes('exploit')) {
      return 'critical'
    }

    // High severity
    if (level === 'error' || 
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('rate limit exceeded')) {
      return 'high'
    }

    // Medium severity
    if (level === 'warn' || 
        lowerMessage.includes('failed') ||
        lowerMessage.includes('invalid')) {
      return 'medium'
    }

    return 'low'
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, any>) {
    this.log('error', message, context)
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  // Performance logging
  performance(operation: string, duration: number, context?: Record<string, any>) {
    this.info(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      duration,
      operation
    })
    
    if (this.options.enableMetrics) {
      recordMetric(`performance.${this.options.metricsPrefix}.${operation}`, duration, 'ms', context)
    }
  }

  // Security-specific logging
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: Record<string, any>) {
    const level: LogLevel = severity === 'critical' || severity === 'high' ? 'error' : 
                           severity === 'medium' ? 'warn' : 'info'
    
    this.log(level, `Security Event: ${event}`, {
      ...context,
      security: true,
      severity
    })
  }

  // Cleanup
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
  }
}

// Export logger instances with appropriate configurations
export const authLogger = new Logger('AUTH', {
  enableSecurityTracking: true,
  metricsPrefix: 'auth'
})

export const securityLogger = new Logger('SECURITY', {
  enableSecurityTracking: true,
  metricsPrefix: 'security'
})

export const apiLogger = new Logger('API', {
  enableMetrics: true,
  metricsPrefix: 'api'
})

export const dbLogger = new Logger('DATABASE', {
  enableMetrics: true,
  metricsPrefix: 'db'
})

export const cacheLogger = new Logger('CACHE', {
  enableMetrics: true,
  metricsPrefix: 'cache'
})

export const reconciliationLogger = new Logger('RECONCILIATION', {
  enableMetrics: true,
  metricsPrefix: 'reconciliation'
})

// Helper function to create custom loggers
export function createLogger(name: string, options?: LoggerOptions) {
  return new Logger(name, options)
}