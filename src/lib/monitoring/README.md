# Monitoring System

This comprehensive monitoring system provides real-time metrics, logging, and alerting capabilities for the WMS application.

## Features

### 1. **Enhanced Logging**
- Integrated with monitoring metrics
- Automatic security event detection
- Buffered log transmission
- Support for multiple log levels and categories

### 2. **Performance Monitoring**
- API response time tracking
- Database query performance
- Cache hit/miss ratios
- Client-side performance metrics

### 3. **Database Monitoring**
- Query execution time tracking
- Lock duration and wait time monitoring
- Slow query detection
- N+1 query pattern detection

### 4. **Cache Monitoring**
- Hit/miss rate tracking
- Memory usage monitoring
- Eviction tracking
- Operation timing

### 5. **Security Monitoring**
- Failed login attempt tracking
- Rate limit violation monitoring
- Security event severity classification
- CSRF and authorization error detection

### 6. **Reconciliation Monitoring**
- Discrepancy tracking over time
- Success/failure rate monitoring
- Performance metrics for reconciliation operations

### 7. **Alert System**
- Configurable thresholds
- Multiple severity levels
- Cooldown periods to prevent alert fatigue
- Custom callback functions

### 8. **OpenTelemetry Integration**
- Distributed tracing
- Metrics collection
- Integration with Jaeger and Prometheus
- Automatic instrumentation

## Usage

### Initialization

```typescript
import { initializeMonitoring, startSystemMetricsCollection } from '@/lib/monitoring/initialize'

// In your app initialization
await initializeMonitoring()
startSystemMetricsCollection()
```

### Recording Custom Metrics

```typescript
import { recordMetric } from '@/lib/monitoring/monitoring-service'

// Record a simple metric
recordMetric('custom.metric', 42, 'count')

// Record with tags
recordMetric('api.custom_operation', 150, 'ms', {
  endpoint: '/api/custom',
  userId: 'user123'
})
```

### Database Operations

```typescript
import { recordDatabaseOperation } from '@/lib/monitoring/monitoring-service'

recordDatabaseOperation(
  'findMany',
  'users',
  125, // duration in ms
  {
    lockDuration: 10,
    lockWaitTime: 5,
    rowsAffected: 100
  }
)
```

### Cache Operations

```typescript
import { recordCacheOperation } from '@/lib/monitoring/monitoring-service'

recordCacheOperation(
  'get',
  'user:123',
  true, // hit
  2, // duration in ms
  {
    size: 1024,
    ttl: 300
  }
)
```

### Security Events

```typescript
import { recordSecurityEvent } from '@/lib/monitoring/monitoring-service'

recordSecurityEvent(
  'suspicious_activity',
  'high',
  {
    action: 'multiple_failed_logins',
    attempts: 5,
    timeWindow: '5m'
  },
  userId,
  ipAddress,
  userAgent
)
```

### Using Enhanced Loggers

```typescript
import { apiLogger, dbLogger, securityLogger } from '@/lib/logger'

// API logging with automatic metrics
apiLogger.info('API request processed', {
  endpoint: '/api/users',
  method: 'GET',
  duration: 150
})

// Database logging
dbLogger.warn('Slow query detected', {
  query: 'SELECT * FROM large_table',
  duration: 5000
})

// Security logging
securityLogger.error('Unauthorized access attempt', {
  userId: 'user123',
  resource: '/admin',
  ipAddress: '192.168.1.1'
})
```

## Configuration

### Environment Variables

```env
# OpenTelemetry
ENABLE_OPENTELEMETRY=true
OTEL_SERVICE_NAME=wms-application
JAEGER_ENDPOINT=http://localhost:14268/api/traces
PROMETHEUS_PORT=9090

# Logging Services
LOGGING_SERVICE_URL=https://logs.example.com/ingest
CLIENT_LOGGING_SERVICE_URL=https://logs.example.com/client
LOGGING_SERVICE_API_KEY=your-api-key

# Time Series Database
TIMESERIES_DB_ENABLED=true
TIMESERIES_DB_URL=http://localhost:8086
```

### Alert Configuration

Alerts are configured in `alert-configs.ts`:

```typescript
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
    // Custom alert handling
  }
}
```

## Monitoring Dashboard

Access the monitoring dashboard at `/admin/monitoring` (requires admin role).

Features:
- Real-time metrics visualization
- Active alerts display
- Performance trends
- Cache statistics
- Security event log
- Reconciliation tracking

## Best Practices

1. **Use appropriate metric names**: Follow the pattern `category.subcategory.metric`
2. **Add meaningful tags**: Include context like endpoint, userId, operation type
3. **Set reasonable alert thresholds**: Avoid alert fatigue with proper thresholds and cooldowns
4. **Monitor critical paths**: Focus on user-facing operations and business-critical functions
5. **Regular metric review**: Periodically review metrics to identify optimization opportunities

## Troubleshooting

### High Memory Usage
- Check for memory leaks in metric storage
- Reduce retention period if needed
- Increase cleanup frequency

### Missing Metrics
- Verify monitoring is initialized
- Check metric name spelling
- Ensure proper error handling around metric recording

### Alert Fatigue
- Adjust thresholds based on baseline performance
- Increase cooldown periods
- Use consecutive breach requirements

## Future Enhancements

1. **Grafana Integration**: Direct integration with Grafana dashboards
2. **Anomaly Detection**: ML-based anomaly detection for metrics
3. **Custom Dashboards**: User-configurable dashboard widgets
4. **Metric Aggregation**: Pre-aggregated metrics for faster queries
5. **Distributed Tracing**: Full request tracing across microservices