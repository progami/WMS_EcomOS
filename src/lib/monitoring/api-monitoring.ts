import { NextRequest, NextResponse } from 'next/server'
import { recordApiPerformance, recordMetric } from './monitoring-service'
import { apiLogger } from '../logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth'

interface ApiMonitoringOptions {
  skipPaths?: string[]
  slowThresholdMs?: number
  enableDetailedLogging?: boolean
}

const defaultOptions: ApiMonitoringOptions = {
  skipPaths: ['/api/health', '/api/metrics', '/api/logs'],
  slowThresholdMs: 1000,
  enableDetailedLogging: process.env.NODE_ENV === 'development'
}

export function withApiMonitoring(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ApiMonitoringOptions = {}
) {
  const config = { ...defaultOptions, ...options }
  
  return async (req: NextRequest): Promise<NextResponse> => {
    // Skip monitoring for certain paths
    const pathname = new URL(req.url).pathname
    if (config.skipPaths?.some(path => pathname.startsWith(path))) {
      return handler(req)
    }
    
    const startTime = performance.now()
    const method = req.method
    const endpoint = pathname
    
    // Get user info if available
    let user_id: string | undefined
    try {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id
    } catch (error) {
      // Ignore auth errors for monitoring
    }
    
    // Log API request
    apiLogger.info(`API Request: ${method} ${endpoint}`, {
      method,
      endpoint,
      user_id,
      user_agent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    })
    
    // Track concurrent requests
    recordMetric('api.concurrent_requests', 1, 'gauge')
    
    try {
      const response = await handler(req)
      const duration = performance.now() - startTime
      const statusCode = response.status
      
      // Record performance metrics
      recordApiPerformance(endpoint, method, statusCode, duration, userId)
      
      // Log slow requests
      if (duration > config.slowThresholdMs!) {
        apiLogger.warn(`Slow API request detected`, {
          method,
          endpoint,
          duration,
          statusCode,
          user_id
        })
      }
      
      // Log detailed response info in development
      if (config.enableDetailedLogging && statusCode >= 400) {
        try {
          const responseBody = await response.clone().json()
          apiLogger.error(`API Error Response`, {
            method,
            endpoint,
            statusCode,
            duration,
            error: responseBody.error || responseBody.message,
            user_id
          })
        } catch {
          // Ignore JSON parsing errors
        }
      }
      
      // Add monitoring headers
      const headers = new Headers(response.headers)
      headers.set('X-Response-Time', `${Math.round(duration)}ms`)
      headers.set('X-Request-Id', crypto.randomUUID())
      
      // Track response size
      const contentLength = headers.get('content-length')
      if (contentLength) {
        recordMetric('api.response_size', parseInt(contentLength), 'bytes', {
          endpoint,
          method
        })
      }
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Record error metrics
      recordApiPerformance(endpoint, method, 500, duration, user_id, errorMessage)
      
      // Log error
      apiLogger.error(`API Request failed`, {
        method,
        endpoint,
        duration,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        user_id
      })
      
      // Return error response
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          requestId: crypto.randomUUID()
        },
        { 
          status: 500,
          headers: {
            'X-Response-Time': `${Math.round(duration)}ms`
          }
        }
      )
    } finally {
      // Decrement concurrent requests
      recordMetric('api.concurrent_requests', -1, 'gauge')
    }
  }
}

// Batch API monitoring for multiple endpoints
export function createApiMonitor(globalOptions?: ApiMonitoringOptions) {
  return {
    GET: (handler: (req: NextRequest) => Promise<NextResponse>, options?: ApiMonitoringOptions) =>
      withApiMonitoring(handler, { ...globalOptions, ...options }),
    
    POST: (handler: (req: NextRequest) => Promise<NextResponse>, options?: ApiMonitoringOptions) =>
      withApiMonitoring(handler, { ...globalOptions, ...options }),
    
    PUT: (handler: (req: NextRequest) => Promise<NextResponse>, options?: ApiMonitoringOptions) =>
      withApiMonitoring(handler, { ...globalOptions, ...options }),
    
    PATCH: (handler: (req: NextRequest) => Promise<NextResponse>, options?: ApiMonitoringOptions) =>
      withApiMonitoring(handler, { ...globalOptions, ...options }),
    
    DELETE: (handler: (req: NextRequest) => Promise<NextResponse>, options?: ApiMonitoringOptions) =>
      withApiMonitoring(handler, { ...globalOptions, ...options })
  }
}