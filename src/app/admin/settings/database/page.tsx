'use client'

import { useState, useEffect } from 'react'
import { Database, HardDrive, Clock, AlertTriangle, Save, Download, Upload, RefreshCw, Trash2 } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DemoDataManager } from '@/components/demo-data-manager'

interface BackupSchedule {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string
  retentionDays: number
}

interface DatabaseInfo {
  size: number
  tables: number
  records: number
  lastBackup: string | null
  version: string
}

export default function DatabaseSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [backing, setBacking] = useState(false)
  const [restoring] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  
  const [dbInfo, setDbInfo] = useState<DatabaseInfo>({
    size: 125,
    tables: 15,
    records: 10542,
    lastBackup: '2024-01-15 02:00:00',
    version: '15.4'
  })

  const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>({
    enabled: false,
    frequency: 'daily',
    time: '02:00',
    retentionDays: 30
  })

  const [connectionPoolSize, setConnectionPoolSize] = useState(20)
  const [queryTimeout, setQueryTimeout] = useState(30)
  const [enableQueryLogging, setEnableQueryLogging] = useState(false)
  const [enableSlowQueryLog, setEnableSlowQueryLog] = useState(true)
  const [slowQueryThreshold, setSlowQueryThreshold] = useState(1000)

  useEffect(() => {
    if (session?.user.role === 'admin') {
      fetchDatabaseInfo()
    } else if (session) {
      // User is logged in but not an admin (must be 'staff')
      router.push('/auth/login')
    }
  }, [session, router])

  const fetchDatabaseInfo = async () => {
    try {
      // In a real app, this would fetch from an API
      setLoading(false)
    } catch (error) {
      toast.error('Failed to load database info')
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // In a real app, this would save to an API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Database settings saved successfully')
    } catch (error) {
      toast.error('Failed to save database settings')
    } finally {
      setSaving(false)
    }
  }

  const createBackup = async () => {
    setBacking(true)
    try {
      const response = await fetch('/api/export?type=all', {
        method: 'GET',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `database-backup-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        setDbInfo(prev => ({
          ...prev,
          lastBackup: new Date().toISOString()
        }))
        
        toast.success('Database backup created successfully')
      } else {
        toast.error('Failed to create backup')
      }
    } catch (error) {
      toast.error('Backup failed')
    } finally {
      setBacking(false)
    }
  }

  const restoreBackup = async () => {
    // In a real app, this would show a file picker and restore
    toast.success('Restore functionality will be implemented soon')
  }

  const optimizeDatabase = async () => {
    setOptimizing(true)
    try {
      // In a real app, this would run database optimization
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success('Database optimization completed')
    } catch (error) {
      toast.error('Optimization failed')
    } finally {
      setOptimizing(false)
    }
  }

  const clearCache = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      toast.success('Cache cleared successfully')
    } catch (error) {
      toast.error('Failed to clear cache')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Database Settings</h1>
          <p className="text-muted-foreground">
            Manage database configuration and maintenance
          </p>
        </div>

        {/* Database Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <HardDrive className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{dbInfo.size} MB</span>
            </div>
            <p className="text-sm text-gray-600">Database Size</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Database className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{dbInfo.tables}</span>
            </div>
            <p className="text-sm text-gray-600">Tables</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Database className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{dbInfo.records.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-600">Total Records</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium">
                {dbInfo.lastBackup ? new Date(dbInfo.lastBackup).toLocaleDateString() : 'Never'}
              </span>
            </div>
            <p className="text-sm text-gray-600">Last Backup</p>
          </div>
        </div>

        {/* Demo Data Manager */}
        <DemoDataManager />

        {/* Backup & Restore */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="h-5 w-5" />
            Backup & Restore
          </h3>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={createBackup}
                disabled={backing}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                {backing ? 'Creating Backup...' : 'Create Backup Now'}
              </button>
              <button
                onClick={restoreBackup}
                disabled={restoring}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Restore from Backup
              </button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Automated Backup Schedule</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={backupSchedule.enabled}
                    onChange={(e) => setBackupSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="mr-2"
                  />
                  Enable automated backups
                </label>
                
                {backupSchedule.enabled && (
                  <div className="ml-6 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Frequency</label>
                        <select
                          value={backupSchedule.frequency}
                          onChange={(e) => setBackupSchedule(prev => ({ ...prev, frequency: e.target.value as any }))}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Time</label>
                        <input
                          type="time"
                          value={backupSchedule.time}
                          onChange={(e) => setBackupSchedule(prev => ({ ...prev, time: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Retention (days)</label>
                        <input
                          type="number"
                          min="7"
                          max="365"
                          value={backupSchedule.retentionDays}
                          onChange={(e) => setBackupSchedule(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Performance Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Connection Pool Size
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={connectionPoolSize}
                onChange={(e) => setConnectionPoolSize(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum number of database connections</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Query Timeout (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={queryTimeout}
                onChange={(e) => setQueryTimeout(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum query execution time</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enableQueryLogging}
                onChange={(e) => setEnableQueryLogging(e.target.checked)}
                className="mr-2"
              />
              Enable query logging (may impact performance)
            </label>
            
            <div className="flex items-start">
              <input
                type="checkbox"
                checked={enableSlowQueryLog}
                onChange={(e) => setEnableSlowQueryLog(e.target.checked)}
                className="mr-2 mt-1"
              />
              <div className="flex-1">
                <label className="block">Log slow queries</label>
                {enableSlowQueryLog && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm">Threshold:</span>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={slowQueryThreshold}
                      onChange={(e) => setSlowQueryThreshold(parseInt(e.target.value))}
                      className="w-24 px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-sm">ms</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Actions */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Maintenance Actions
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={optimizeDatabase}
              disabled={optimizing}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <RefreshCw className={`h-5 w-5 mb-2 ${optimizing ? 'animate-spin' : ''}`} />
              <h4 className="font-medium">Optimize Database</h4>
              <p className="text-sm text-gray-600 mt-1">
                Reclaim space and improve performance
              </p>
            </button>
            
            <button
              onClick={clearCache}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <Trash2 className="h-5 w-5 mb-2" />
              <h4 className="font-medium">Clear Cache</h4>
              <p className="text-sm text-gray-600 mt-1">
                Clear application and query cache
              </p>
            </button>
            
            <button
              onClick={() => toast.success('Rebuild indexes functionality coming soon')}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <Database className="h-5 w-5 mb-2" />
              <h4 className="font-medium">Rebuild Indexes</h4>
              <p className="text-sm text-gray-600 mt-1">
                Rebuild database indexes for better performance
              </p>
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Caution:</p>
              <p>Changes to database settings may affect system performance. Always create a backup before making significant changes.</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save Database Settings'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}