import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { SimpleSpanProcessor, ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { monitoringService } from './monitoring-service'

// Configuration
const serviceName = process.env.OTEL_SERVICE_NAME || 'wms-application'
const environment = process.env.NODE_ENV || 'development'
const jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
const prometheusPort = parseInt(process.env.PROMETHEUS_PORT || '9090')

// Create resource
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
})

// Initialize tracer provider
let tracerProvider: NodeTracerProvider | null = null
let meterProvider: MeterProvider | null = null

export function initializeOpenTelemetry() {
  if (tracerProvider) {
    console.warn('OpenTelemetry already initialized')
    return
  }

  // Create tracer provider
  tracerProvider = new NodeTracerProvider({
    resource,
  })

  // Configure exporters based on environment
  if (environment === 'production') {
    // Use Jaeger in production
    const jaegerExporter = new JaegerExporter({
      endpoint: jaegerEndpoint,
    })
    
    tracerProvider.addSpanProcessor(
      new BatchSpanProcessor(jaegerExporter)
    )
  } else {
    // Use console exporter in development
    tracerProvider.addSpanProcessor(
      new SimpleSpanProcessor(new ConsoleSpanExporter())
    )
  }

  // Register the provider
  tracerProvider.register()

  // Register instrumentations
  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation({
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.body.size': request.headers['content-length'] || 0,
            'http.user_agent': request.headers['user-agent'] || 'unknown',
          })
          
          // Record metric
          monitoringService.recordMetric('http.requests', 1, 'count', {
            method: (request as any).method,
            path: (request as any).url,
          })
        },
        responseHook: (span, response) => {
          const statusCode = (response as any).statusCode
          span.setAttributes({
            'http.response.body.size': response.headers['content-length'] || 0,
          })
          
          // Record response metrics
          if (statusCode >= 400) {
            monitoringService.recordMetric('http.errors', 1, 'count', {
              status: statusCode.toString(),
            })
          }
        },
      }),
      new ExpressInstrumentation({
        requestHook: (span, info) => {
          span.setAttributes({
            'express.route': info.route,
            'express.type': info.layerType,
          })
        },
      }),
    ],
  })

  // Initialize metrics
  initializeMetrics()

  console.log(`OpenTelemetry initialized for service: ${serviceName}`)
}

function initializeMetrics() {
  // Create meter provider
  meterProvider = new MeterProvider({
    resource,
  })

  // Configure Prometheus exporter
  if (environment === 'production') {
    const prometheusExporter = new PrometheusExporter(
      {
        port: prometheusPort,
      },
      () => {
        console.log(`Prometheus metrics server started on port ${prometheusPort}`)
      }
    )

    meterProvider.addMetricReader(prometheusExporter)
  }

  // Create meters
  const meter = meterProvider.getMeter(serviceName)

  // Create custom metrics
  const httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
    description: 'Duration of HTTP requests in milliseconds',
    unit: 'ms',
  })

  const activeConnections = meter.createUpDownCounter('active_connections', {
    description: 'Number of active connections',
  })

  const dbQueryDuration = meter.createHistogram('db_query_duration_ms', {
    description: 'Duration of database queries in milliseconds',
    unit: 'ms',
  })

  const cacheHitRate = meter.createObservableGauge('cache_hit_rate', {
    description: 'Cache hit rate',
  })

  // Register callbacks for observable metrics
  cacheHitRate.addCallback(async (observableResult) => {
    const stats = monitoringService.getCacheStats()
    observableResult.observe(stats.hitRate, {
      cache_type: 'in_memory',
    })
  })

  // Subscribe to monitoring service events
  monitoringService.on('performance', (metric) => {
    httpRequestDuration.record(metric.duration, {
      method: metric.method,
      endpoint: metric.endpoint,
      status_code: metric.statusCode.toString(),
    })
  })

  monitoringService.on('database', (metric) => {
    dbQueryDuration.record(metric.duration, {
      operation: metric.operation,
      table: metric.table,
      error: metric.error ? 'true' : 'false',
    })
  })
}

// Get tracer instance
export function getTracer(name?: string) {
  if (!tracerProvider) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry() first.')
  }
  
  return tracerProvider.getTracer(name || serviceName)
}

// Utility function to create spans
export async function traceAsync<T>(
  spanName: string,
  fn: () => Promise<T>,
  options?: {
    attributes?: Record<string, any>
    kind?: any
  }
): Promise<T> {
  const tracer = getTracer()
  const span = tracer.startSpan(spanName, options)
  
  if (options?.attributes) {
    span.setAttributes(options.attributes)
  }
  
  try {
    const result = await fn()
    span.setStatus({ code: 1 }) // OK
    return result
  } catch (error) {
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.recordException(error as Error)
    throw error
  } finally {
    span.end()
  }
}

// Shutdown function
export async function shutdownOpenTelemetry() {
  if (tracerProvider) {
    await tracerProvider.shutdown()
    tracerProvider = null
  }
  
  if (meterProvider) {
    await meterProvider.shutdown()
    meterProvider = null
  }
  
  console.log('OpenTelemetry shut down')
}