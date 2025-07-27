'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { MonitoringDashboard } from '@/components/monitoring/monitoring-dashboard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, Settings } from 'lucide-react'

export default function MonitoringPage() {
  const { data: session, status } = useSession()
  const [refreshInterval, setRefreshInterval] = useState('30000')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Redirect if not authenticated or not admin
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }
  
  const handleManualRefresh = () => {
    setIsRefreshing(true)
    // Trigger refresh by changing key
    setTimeout(() => setIsRefreshing(false), 1000)
  }
  
  const handleExportMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/export')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `monitoring-metrics-${new Date().toISOString()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export metrics:', error)
    }
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader 
        title="System Monitoring" 
        description="Real-time monitoring and metrics dashboard"
      />
      
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Controls</CardTitle>
          <CardDescription>Configure monitoring dashboard settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="refresh-interval" className="text-sm font-medium">
                Auto-refresh:
              </label>
              <Select
                value={refreshInterval}
                onValueChange={setRefreshInterval}
              >
                <SelectTrigger id="refresh-interval" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10000">10s</SelectItem>
                  <SelectItem value="30000">30s</SelectItem>
                  <SelectItem value="60000">1m</SelectItem>
                  <SelectItem value="300000">5m</SelectItem>
                  <SelectItem value="0">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMetrics}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/admin/monitoring/settings', '_blank')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Monitoring Dashboard */}
      <div key={isRefreshing ? 'refreshing' : 'normal'}>
        <MonitoringDashboard />
      </div>
    </div>
  )
}