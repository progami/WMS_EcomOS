'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertCircle, Activity, Database, Shield, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

interface MonitoringData {
  performance: {
    avgResponseTime: number
    totalRequests: number
    errorRate: number
    slowRequests: number
    endpoints: Array<{
      endpoint: string
      avgTime: number
      count: number
      errorRate: number
    }>
  }
  database: {
    avgQueryTime: number
    slowQueries: number
    lockWaitTime: number
    errorRate: number
    operations: Array<{
      operation: string
      table: string
      avgTime: number
      count: number
    }>
  }
  cache: {
    hitRate: number
    totalHits: number
    totalMisses: number
    evictions: number
    size: number
    maxSize: number
  }
  reconciliation: {
    totalChecks: number
    totalDiscrepancies: number
    discrepancyRate: number
    recentChecks: Array<{
      type: string
      timestamp: string
      discrepancies: number
      total: number
    }>
  }
  security: {
    totalEvents: number
    criticalEvents: number
    recentEvents: Array<{
      event: string
      severity: string
      timestamp: string
      details: any
    }>
    rateLimitViolations: number
  }
  alerts: Array<{
    id: string
    name: string
    severity: string
    message: string
    triggeredAt: string
    value: number
  }>
}

export function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds

  useEffect(() => {
    fetchMonitoringData()
    
    const interval = setInterval(fetchMonitoringData, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  async function fetchMonitoringData() {
    try {
      const response = await fetch('/api/monitoring/metrics')
      if (!response.ok) throw new Error('Failed to fetch monitoring data')
      
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map(alert => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {alert.name}
                <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {alert.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                {alert.message} (Value: {alert.value})
                <span className="text-sm text-muted-foreground ml-2">
                  {new Date(alert.triggeredAt).toLocaleString()}
                </span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performance.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {data.performance.slowRequests} slow requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.cache.hitRate * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.cache.totalHits} hits / {data.cache.totalMisses} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.performance.errorRate * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.security.rateLimitViolations} rate limit violations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.security.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {data.security.criticalEvents} critical
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Performance</CardTitle>
              <CardDescription>Average response times by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.performance.endpoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgTime" fill="#8884d8" name="Avg Time (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Operations</CardTitle>
              <CardDescription>Query performance by operation type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Avg Query Time</p>
                    <p className="text-2xl font-bold">{data.database.avgQueryTime.toFixed(1)}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Slow Queries</p>
                    <p className="text-2xl font-bold">{data.database.slowQueries}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lock Wait Time</p>
                    <p className="text-2xl font-bold">{data.database.lockWaitTime.toFixed(1)}ms</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {data.database.operations.map((op, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">
                        {op.operation} - {op.table}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {op.avgTime.toFixed(0)}ms
                        </span>
                        <Badge variant="secondary">{op.count}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>Cache utilization and hit rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Hit Rate</span>
                    <span className="text-sm">{(data.cache.hitRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={data.cache.hitRate * 100} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm">
                      {(data.cache.size / 1024 / 1024).toFixed(1)}MB / {(data.cache.maxSize / 1024 / 1024).toFixed(0)}MB
                    </span>
                  </div>
                  <Progress value={(data.cache.size / data.cache.maxSize) * 100} />
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Hits</p>
                    <p className="font-medium">{data.cache.totalHits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Misses</p>
                    <p className="font-medium">{data.cache.totalMisses.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Evictions</p>
                    <p className="font-medium">{data.cache.evictions.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reconciliation Discrepancies</CardTitle>
              <CardDescription>Track data consistency over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Checks</p>
                    <p className="text-2xl font-bold">{data.reconciliation.totalChecks}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Discrepancies</p>
                    <p className="text-2xl font-bold">{data.reconciliation.totalDiscrepancies}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Discrepancy Rate</p>
                    <p className="text-2xl font-bold">{(data.reconciliation.discrepancyRate * 100).toFixed(1)}%</p>
                  </div>
                </div>
                
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.reconciliation.recentChecks}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="discrepancies" stroke="#8884d8" name="Discrepancies" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Monitor security-related activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.security.recentEvents.map((event, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          event.severity === 'critical' ? 'destructive' : 
                          event.severity === 'high' ? 'default' : 
                          'secondary'
                        }
                      >
                        {event.severity}
                      </Badge>
                      <span className="text-sm font-medium">{event.event}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}