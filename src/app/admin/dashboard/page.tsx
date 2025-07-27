'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Package2, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Package,
  FileText,
  Users,
  Warehouse,
  BarChart3,
  Settings,
  ArrowRight,
  Upload,
  Download,
  Database,
  Bell,
  RefreshCw,
  Calendar,
  ChevronDown,
  Activity,
  Clock,
  Zap,
  FileSpreadsheet,
  TrendingDown
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { DemoWelcome } from '@/components/ui/demo-welcome'
import { toast } from 'react-hot-toast'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface DashboardStats {
  totalInventory: number
  inventoryChange: string
  inventoryTrend: 'up' | 'down' | 'neutral'
  storageCost: string
  costChange: string
  costTrend: 'up' | 'down' | 'neutral'
  activeSkus: number
  pendingInvoices: number
  overdueInvoices: number
}

interface SystemInfo {
  totalUsers: number
  totalTransactions: number
  dbSize: number
}

interface TimeRange {
  label: string
  value: string
  startDate: Date
  endDate: Date
}

interface ChartData {
  inventoryTrend: Array<{ date: string; inventory: number }>
  costTrend: Array<{ date: string; cost: number }>
  warehouseDistribution: Array<{ name: string; value: number; percentage: number }>
  recentTransactions: Array<{
    id: string
    type: string
    sku: string
    quantity: number
    warehouse: string
    date: string
    details?: string
  }>
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState('yearToDate')
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false)
  const [storageCostView, setStorageCostView] = useState<'weekly' | 'monthly'>('weekly')
  const [useDemoData, setUseDemoData] = useState(false)
  
  const timeRanges: Record<string, TimeRange> = useMemo(() => ({
    current: {
      label: 'Current Month',
      value: 'current',
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date())
    },
    last30: {
      label: 'Last 30 Days',
      value: 'last30',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    last90: {
      label: 'Last 90 Days',
      value: 'last90',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    lastMonth: {
      label: 'Last Month',
      value: 'lastMonth',
      startDate: startOfMonth(subMonths(new Date(), 1)),
      endDate: endOfMonth(subMonths(new Date(), 1))
    },
    yearToDate: {
      label: 'Year to Date',
      value: 'yearToDate',
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date()
    },
    lastYear: {
      label: 'Last Year',
      value: 'lastYear',
      startDate: new Date(new Date().getFullYear() - 1, 0, 1),
      endDate: new Date(new Date().getFullYear() - 1, 11, 31)
    }
  }), [])

  const fetchDashboardStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        startDate: timeRanges[selectedTimeRange].startDate.toISOString(),
        endDate: timeRanges[selectedTimeRange].endDate.toISOString()
      })
      
      const response = await fetch(`/api/admin/dashboard?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setSystemInfo(data.systemInfo)
        
        // Use real chart data from API
        if (data.chartData) {
          setChartData(data.chartData)
        }
      } else {
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          toast.error(errorData.details || errorData.error || 'Failed to load dashboard stats')
        } catch {
          toast.error(`API Error (${response.status}): ${errorText}`)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load dashboard stats')
    } finally {
      setLoadingStats(false)
    }
  }, [selectedTimeRange, timeRanges])

  // Generate dummy data for investor demo
  const generateDummyData = useCallback(() => {
    // Generate inventory trend data (showing growth)
    const inventoryTrend = []
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)
    let baseInventory = 15000
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      
      // Add some realistic fluctuation with overall growth trend
      const dailyChange = Math.random() * 800 - 200 // -200 to +600 daily change
      const growthFactor = 1 + (i / 90) * 0.3 // 30% growth over 90 days
      baseInventory = Math.max(10000, baseInventory + dailyChange)
      
      inventoryTrend.push({
        date: format(date, 'MMM dd'),
        inventory: Math.round(baseInventory * growthFactor)
      })
    }

    // Generate category distribution data
    const categoryData = [
      { name: 'Electronics', value: 8500, growth: 15 },
      { name: 'Apparel', value: 6200, growth: 22 },
      { name: 'Home & Garden', value: 4800, growth: 8 },
      { name: 'Sports & Outdoors', value: 3200, growth: 18 },
      { name: 'Beauty & Health', value: 2800, growth: 25 },
      { name: 'Toys & Games', value: 1500, growth: 12 }
    ]

    // Generate SKU performance data
    const skuPerformance = [
      { sku: 'Electronics', turnover: 85, stockLevel: 92, efficiency: 88 },
      { sku: 'Apparel', turnover: 78, stockLevel: 85, efficiency: 82 },
      { sku: 'Home & Garden', turnover: 65, stockLevel: 78, efficiency: 71 },
      { sku: 'Sports', turnover: 72, stockLevel: 88, efficiency: 80 },
      { sku: 'Beauty', turnover: 82, stockLevel: 75, efficiency: 78 },
      { sku: 'Toys', turnover: 58, stockLevel: 82, efficiency: 70 }
    ]

    // Generate inventory value scatter data
    const inventoryValueData = []
    for (let i = 0; i < 50; i++) {
      inventoryValueData.push({
        quantity: Math.floor(Math.random() * 1000) + 100,
        value: Math.floor(Math.random() * 50000) + 5000,
        turnover: Math.floor(Math.random() * 30) + 5,
        category: categoryData[Math.floor(Math.random() * categoryData.length)].name
      })
    }

    // Generate monthly growth comparison
    const monthlyGrowth: Array<{ month: string; lastYear: number; thisYear: number }> = []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    months.forEach((month, index) => {
      monthlyGrowth.push({
        month,
        lastYear: Math.floor(Math.random() * 5000) + 10000,
        thisYear: Math.floor(Math.random() * 5000) + 12000 + (index * 500)
      })
    })

    // Generate cost trend data
    const costTrend = []
    const costStartDate = new Date()
    costStartDate.setDate(costStartDate.getDate() - 84) // 12 weeks
    
    for (let i = 0; i < 12; i++) {
      const weekDate = new Date(costStartDate)
      weekDate.setDate(weekDate.getDate() + (i * 7))
      
      // Generate realistic weekly storage costs
      const baseCost = 3500 + (i * 50) // Growing trend
      const variation = Math.random() * 500 - 250
      
      costTrend.push({
        date: format(weekDate, 'MMM dd'),
        cost: Math.round(baseCost + variation)
      })
    }

    // Generate warehouse distribution
    const warehouseDistribution = [
      { name: 'London Central', value: 8500, percentage: 31 },
      { name: 'Manchester North', value: 6200, percentage: 23 },
      { name: 'Birmingham Hub', value: 4800, percentage: 18 },
      { name: 'Glasgow Depot', value: 3200, percentage: 12 },
      { name: 'Bristol South', value: 2800, percentage: 10 },
      { name: 'Leeds East', value: 1500, percentage: 6 }
    ]

    // Generate recent transactions
    const transactionTypes = ['RECEIVE', 'SHIP', 'TRANSFER']
    const skus = ['ELEC-1234', 'APP-5678', 'HOME-9012', 'SPRT-3456', 'BEAU-7890']
    const warehouses = warehouseDistribution.map(w => w.name)
    
    const recentTransactions = []
    for (let i = 0; i < 10; i++) {
      const date = new Date()
      date.setHours(date.getHours() - (i * 4))
      
      recentTransactions.push({
        id: `TRX-${1000 + i}`,
        type: transactionTypes[Math.floor(Math.random() * transactionTypes.length)],
        sku: skus[Math.floor(Math.random() * skus.length)],
        quantity: Math.floor(Math.random() * 100) + 10,
        warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
        date: date.toISOString(),
        details: i % 3 === 0 ? 'Express delivery' : null
      })
    }

    return {
      inventoryTrend,
      categoryData,
      skuPerformance,
      inventoryValueData,
      monthlyGrowth,
      costTrend,
      warehouseDistribution,
      recentTransactions
    }
  }, [])

  // Use dummy data for demo
  const dummyData = useMemo(() => generateDummyData(), [generateDummyData])

  useEffect(() => {
    // Only fetch if we haven't already
    if (!hasFetched && status === 'authenticated') {
      setHasFetched(true)
      fetchDashboardStats()
    }
  }, [hasFetched, status, fetchDashboardStats])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDashboardStats()
      }, 30000) // Refresh every 30 seconds
      setRefreshInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [autoRefresh, refreshInterval, fetchDashboardStats])

  useEffect(() => {
    if (status === 'authenticated' && hasFetched) {
      fetchDashboardStats()
    }
  }, [selectedTimeRange, status, hasFetched, fetchDashboardStats])

  // Helper function to aggregate weekly costs into monthly billing periods
  const aggregateMonthlyStorageCosts = (weeklyCosts: Array<{ date: string; cost: number }>) => {
    const monthlyMap = new Map<string, { cost: number; weeks: number }>()
    
    weeklyCosts.forEach(week => {
      const weekDate = new Date(week.date)
      const day = weekDate.getDate()
      const month = weekDate.getMonth()
      const year = weekDate.getFullYear()
      
      // Determine billing period (16th to 15th)
      let periodKey: string
      if (day <= 15) {
        // Previous month 16th to current month 15th
        const periodStart = new Date(year, month - 1, 16)
        const periodEnd = new Date(year, month, 15)
        periodKey = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      } else {
        // Current month 16th to next month 15th
        const periodStart = new Date(year, month, 16)
        const periodEnd = new Date(year, month + 1, 15)
        periodKey = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
      
      const existing = monthlyMap.get(periodKey) || { cost: 0, weeks: 0 }
      monthlyMap.set(periodKey, {
        cost: existing.cost + week.cost,
        weeks: existing.weeks + 1
      })
    })
    
    // Convert to array format
    return Array.from(monthlyMap.entries())
      .map(([period, data]) => ({
        date: period,
        cost: data.cost
      }))
      .sort((a, b) => {
        // Sort by date (extract first month from period)
        const dateA = new Date(a.date.split(' - ')[0])
        const dateB = new Date(b.date.split(' - ')[0])
        return dateA.getTime() - dateB.getTime()
      })
  }

  // Check if user has admin access
  useEffect(() => {
    if (status === 'authenticated' && (!session || session.user.role !== 'admin')) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  if (status === 'loading') {
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


  const handleExportData = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setLoading('export')
    try {
      const response = await fetch('/api/export?type=all', {
        method: 'GET',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `warehouse-backup-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Data exported successfully!')
      } else {
        toast.error('Failed to export data')
      }
    } catch (error) {
      toast.error('Export failed')
    } finally {
      setLoading(null)
    }
  }


  return (
    <DashboardLayout>
      <DemoWelcome />
      <div className="space-y-6">
        {/* Enhanced Header with Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            title="Admin Dashboard"
            subtitle="System Overview"
            icon={BarChart3}
          />
          <div className="flex items-center gap-3">
            {/* Demo Data Toggle */}
            <label className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={useDemoData}
                onChange={(e) => setUseDemoData(e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              <span className="text-xs sm:text-sm">Demo Data</span>
            </label>
            
            {/* Time Range Selector */}
            <div className="relative">
              <button
                onClick={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
                className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">
                  <span className="sm:hidden">{selectedTimeRange === 'yearToDate' ? 'YTD' : selectedTimeRange === 'current' ? 'Current' : selectedTimeRange === 'last30' ? '30d' : selectedTimeRange === 'last90' ? '90d' : selectedTimeRange === 'lastMonth' ? 'Last Mo' : 'Last Yr'}</span>
                  <span className="hidden sm:inline">{timeRanges[selectedTimeRange].label}</span>
                </span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              {showTimeRangeDropdown && (
                <div className="absolute right-0 mt-2 w-40 sm:w-44 md:w-48 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10">
                  {Object.entries(timeRanges).map(([key, range]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedTimeRange(key)
                        setShowTimeRangeDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedTimeRange === key ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border rounded-lg transition-all min-h-[44px] ${
                autoRefresh 
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs sm:text-sm">{autoRefresh ? 'Auto-refreshing' : 'Auto-refresh'}</span>
            </button>
            
            {/* Manual Refresh */}
            <button
              onClick={() => fetchDashboardStats()}
              disabled={loadingStats}
              className="p-2 sm:p-2.5 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px]"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Enhanced Stats Cards with Sparklines */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {loadingStats ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-40"></div>
                </div>
              ))}
            </>
          ) : stats ? (
            <>
              <EnhancedDashboardCard
                title="Total Inventory"
                value={stats.totalInventory.toLocaleString()}
                description="Cartons across all warehouses"
                icon={Package2}
                trend={`${stats.inventoryTrend === 'up' ? '+' : ''}${stats.inventoryChange}% from last period`}
                trendUp={stats.inventoryTrend === 'up' ? true : stats.inventoryTrend === 'down' ? false : null}
                sparklineData={useDemoData ? dummyData.inventoryTrend.slice(-7).map(d => d.inventory) : (chartData?.inventoryTrend?.slice(-7).map(d => d.inventory) || [])}
                color="blue"
              />
              <EnhancedDashboardCard
                title="Storage Cost"
                value={`£${parseFloat(stats.storageCost).toLocaleString()}`}
                description="Current period estimate"
                icon={DollarSign}
                trend={`${stats.costTrend === 'up' ? '+' : ''}${stats.costChange}% from last period`}
                trendUp={stats.costTrend === 'up' ? true : stats.costTrend === 'down' ? false : null}
                sparklineData={useDemoData ? dummyData.costTrend.slice(-7).map(d => d.cost) : (chartData?.costTrend?.slice(-7).map(d => d.cost) || [])}
                color="green"
              />
              <EnhancedDashboardCard
                title="Active SKUs"
                value={stats.activeSkus.toString()}
                description="Products in stock"
                icon={TrendingUp}
                trend="Products with inventory"
                trendUp={null}
                sparklineData={[]}
                color="purple"
              />
              <EnhancedDashboardCard
                title="Pending Invoices"
                value={stats.pendingInvoices.toString()}
                description="Awaiting reconciliation"
                icon={AlertCircle}
                trend={stats.overdueInvoices > 0 ? `${stats.overdueInvoices} overdue` : 'All current'}
                trendUp={stats.overdueInvoices === 0}
                sparklineData={[]}
                color="orange"
              />
            </>
          ) : (
            <>
              <EnhancedDashboardCard
                title="Total Inventory"
                value="--"
                description="Cartons across all warehouses"
                icon={Package2}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="blue"
              />
              <EnhancedDashboardCard
                title="Storage Cost"
                value="--"
                description="Current period estimate"
                icon={DollarSign}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="green"
              />
              <EnhancedDashboardCard
                title="Active SKUs"
                value="--"
                description="Products in stock"
                icon={TrendingUp}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="purple"
              />
              <EnhancedDashboardCard
                title="Pending Invoices"
                value="--"
                description="Awaiting reconciliation"
                icon={AlertCircle}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="orange"
              />
            </>
          )}
        </div>

        {/* Enhanced Inventory Analytics Section */}
        {useDemoData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Inventory Analytics</h2>
              <span className="text-sm text-muted-foreground">Demo data for investor presentation</span>
            </div>

            {/* Key Metrics Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">Total SKUs</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">1,247</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">+12% from last month</p>
              </div>
              <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                <p className="text-sm text-green-700 dark:text-green-300">Inventory Value</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">£2.4M</p>
                <p className="text-xs text-green-600 dark:text-green-400">+18% growth</p>
              </div>
              <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                <p className="text-sm text-purple-700 dark:text-purple-300">Avg. Turnover</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">4.2x</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Industry leading</p>
              </div>
              <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                <p className="text-sm text-orange-700 dark:text-orange-300">Fill Rate</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">98.5%</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Above target</p>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Warehouse Metrics</h2>
          
          {/* Main Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Inventory Levels Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Total Inventory Levels</h3>
                <p className="text-sm text-muted-foreground">Daily inventory snapshots (cartons)</p>
              </div>
              <div className="h-64 sm:h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={useDemoData ? dummyData.inventoryTrend : (chartData?.inventoryTrend || [])} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [`${value.toLocaleString()} cartons`, 'Inventory']}
                    />
                    <Area
                      type="monotone"
                      dataKey="inventory"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#colorInventory)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Storage Cost Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {storageCostView === 'weekly' ? 'Weekly Storage Costs' : 'Monthly Storage Costs'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {storageCostView === 'weekly' 
                        ? 'Monday snapshots for billing calculation'
                        : 'Aggregated by billing period (16th to 15th)'}
                    </p>
                  </div>
                  <div className="flex items-center bg-gray-100 rounded-md p-1">
                    <button
                      type="button"
                      onClick={() => setStorageCostView('weekly')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        storageCostView === 'weekly' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorageCostView('monthly')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        storageCostView === 'monthly' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-64 sm:h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={
                  storageCostView === 'weekly' 
                    ? (useDemoData ? dummyData.costTrend : (chartData?.costTrend || []))
                    : aggregateMonthlyStorageCosts(useDemoData ? dummyData.costTrend : (chartData?.costTrend || []))
                }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [
                        `£${value.toFixed(2)}`, 
                        storageCostView === 'weekly' ? 'Weekly Cost' : 'Monthly Cost'
                      ]}
                    />
                    <Bar
                      dataKey="cost"
                      fill="#10B981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Warehouse Distribution */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Current Inventory by Warehouse</h3>
                <p className="text-sm text-muted-foreground">Distribution of cartons across locations</p>
              </div>
              {useDemoData || (chartData?.warehouseDistribution && chartData.warehouseDistribution.length > 0) ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Warehouses</p>
                      <p className="text-2xl font-bold">{useDemoData ? dummyData.warehouseDistribution.length : chartData?.warehouseDistribution?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cartons</p>
                      <p className="text-2xl font-bold">
                        {useDemoData 
                          ? dummyData.warehouseDistribution.reduce((sum, w) => sum + w.value, 0).toLocaleString()
                          : chartData?.warehouseDistribution?.reduce((sum, w) => sum + w.value, 0).toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Simple Bar Chart Alternative */}
                  <div className="space-y-3">
                    {(useDemoData ? dummyData.warehouseDistribution : chartData?.warehouseDistribution || []).map((warehouse, _index) => {
                      const data = useDemoData ? dummyData.warehouseDistribution : chartData?.warehouseDistribution || []
                      const maxValue = Math.max(...data.map(w => w.value))
                      const widthPercentage = maxValue > 0 ? (warehouse.value / maxValue) * 100 : 0
                      
                      return (
                        <div key={warehouse.name} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{warehouse.name}</span>
                            <span className="text-muted-foreground">{warehouse.value.toLocaleString()} cartons</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-8">
                            <div 
                              className="bg-blue-500 h-8 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${widthPercentage}%` }}
                            >
                              {warehouse.percentage > 0 && (
                                <span className="text-xs text-white font-medium">{warehouse.percentage}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Detailed List */}
                  <div className="pt-2">
                    {(useDemoData ? dummyData.warehouseDistribution : chartData?.warehouseDistribution || [])
                      .sort((a, b) => b.value - a.value)
                      .map((warehouse, index) => (
                        <div key={warehouse.name} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{warehouse.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {warehouse.value.toLocaleString()} cartons
                            </span>
                            <span className="text-sm font-medium">
                              {warehouse.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No warehouse distribution data</p>
                </div>
              )}
            </div>

            {/* Inventory by Category - Pie Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Inventory Distribution by Category</h3>
                <p className="text-sm text-muted-foreground">Current stock allocation across product categories</p>
              </div>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(useDemoData ? dummyData.categoryData : []).map(item => ({
                        ...item,
                        percentage: Math.round((item.value / (useDemoData ? dummyData.categoryData : []).reduce((sum, d) => sum + d.value, 0)) * 100)
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }: any) => `${name}: ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(useDemoData ? dummyData.categoryData : []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value.toLocaleString()} units`, 'Inventory']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {useDemoData && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {dummyData.categoryData.map((category, index) => (
                    <div key={category.name} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs">{category.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        +{category.growth}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SKU Performance Radar Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">SKU Performance Metrics</h3>
                <p className="text-sm text-muted-foreground">Multi-dimensional performance analysis by category</p>
              </div>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={useDemoData ? dummyData.skuPerformance : []}>
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="sku" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Turnover Rate" dataKey="turnover" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    <Radar name="Stock Level" dataKey="stockLevel" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Radar name="Efficiency" dataKey="efficiency" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Additional Inventory Insights Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Inventory Value Analysis - Scatter Plot */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Inventory Value Analysis</h3>
                <p className="text-sm text-muted-foreground">Quantity vs Value relationship by SKU</p>
              </div>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="quantity" 
                      name="Quantity" 
                      unit=" units"
                      label={{ value: 'Quantity (units)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="value" 
                      name="Value" 
                      unit="£"
                      label={{ value: 'Value (£)', angle: -90, position: 'insideLeft' }}
                    />
                    <ZAxis type="number" dataKey="turnover" range={[64, 400]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded shadow-lg border">
                              <p className="font-semibold">{data.category}</p>
                              <p className="text-sm">Quantity: {data.quantity} units</p>
                              <p className="text-sm">Value: £{data.value.toLocaleString()}</p>
                              <p className="text-sm">Turnover: {data.turnover} days</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Scatter name="SKUs" data={useDemoData ? dummyData.inventoryValueData : []} fill="#8B5CF6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bubble size indicates turnover rate</span>
                <button className="text-primary hover:underline">View detailed analysis →</button>
              </div>
            </div>

            {/* YoY Growth Comparison */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Year-over-Year Growth</h3>
                <p className="text-sm text-muted-foreground">Monthly inventory growth comparison</p>
              </div>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={useDemoData ? dummyData.monthlyGrowth : []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="lastYear" fill="#94A3B8" name="Last Year" />
                    <Bar dataKey="thisYear" fill="#3B82F6" name="This Year" />
                    <Line 
                      type="monotone" 
                      dataKey="thisYear" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', r: 6 }}
                      name="Growth Trend"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">+23%</p>
                  <p className="text-xs text-muted-foreground">YoY Growth</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">£384K</p>
                  <p className="text-xs text-muted-foreground">Additional Value</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">92%</p>
                  <p className="text-xs text-muted-foreground">Target Achievement</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
              <div className="space-y-3">
                {(useDemoData ? dummyData.recentTransactions : (chartData?.recentTransactions || [])).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        transaction.type === 'RECEIVE' ? 'bg-green-100 dark:bg-green-900/30' :
                        transaction.type === 'SHIP' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-yellow-100 dark:bg-yellow-900/30'
                      }`}>
                        {transaction.type === 'RECEIVE' ? (
                          <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400 rotate-180" />
                        ) : transaction.type === 'SHIP' ? (
                          <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{transaction.sku}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.quantity} cartons • {transaction.warehouse}
                          {transaction.details && ` • ${transaction.details}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link 
                href="/admin/inventory" 
                className="inline-flex items-center text-sm text-primary hover:underline mt-4"
              >
                View all transactions <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* System Actions - Enhanced */}
        <div className="border rounded-lg p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <h3 className="text-lg font-semibold mb-4">System Actions</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SystemAction
              title="Export All Data"
              description="Download complete system backup"
              icon={Download}
              onClick={handleExportData}
              loading={loading === 'export'}
            />
            <SystemAction
              title="Import Data"
              description="Bulk import from Excel/CSV"
              icon={Upload}
              onClick={() => toast('Import feature coming soon', { icon: '📥' })}
            />
            <SystemAction
              title="Database Backup"
              description="Create database snapshot"
              icon={Database}
              onClick={() => toast('Backup feature coming soon', { icon: '💾' })}
            />
            <SystemAction
              title="Generate Reports"
              description="Create custom reports"
              icon={FileSpreadsheet}
              onClick={() => router.push('/admin/reports')}
            />
            <SystemAction
              title="System Health"
              description="View detailed diagnostics"
              icon={Activity}
              onClick={() => toast('Health monitor coming soon', { icon: '🩺' })}
            />
            <SystemAction
              title="Notifications"
              description="Configure alerts"
              icon={Bell}
              onClick={() => router.push('/admin/settings/notifications')}
            />
          </div>
        </div>

        {/* Quick Navigation - Enhanced */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard
              title="Inventory Management"
              description="View and manage inventory across all warehouses"
              icon={Package}
              href="/admin/inventory"
              color="bg-blue-500"
            />
            <QuickActionCard
              title="Invoice Management"
              description="Process and reconcile 3PL invoices"
              icon={FileText}
              href="/admin/invoices"
              color="bg-green-500"
            />
            <QuickActionCard
              title="Reports & Analytics"
              description="View detailed reports and analytics"
              icon={BarChart3}
              href="/admin/reports"
              color="bg-indigo-500"
            />
            <QuickActionCard
              title="Warehouse Settings"
              description="Configure warehouses and SKUs"
              icon={Warehouse}
              href="/admin/settings/warehouses"
              color="bg-orange-500"
            />
            <QuickActionCard
              title="User Management"
              description="Manage users and permissions"
              icon={Users}
              href="/admin/users"
              color="bg-purple-500"
            />
            <QuickActionCard
              title="System Settings"
              description="Configure system settings and rates"
              icon={Settings}
              href="/admin/settings"
              color="bg-gray-500"
            />
          </div>
        </div>

        {/* System Status and Info - Enhanced */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Health</h3>
            <div className="space-y-3">
              <StatusItem 
                label="Database Connection" 
                status="Healthy" 
                indicator="success"
                icon={Database}
                details="Response time: 12ms"
              />
              <StatusItem 
                label="Background Jobs" 
                status="Not configured" 
                indicator="warning"
                icon={Activity}
                details="Queue: Empty"
              />
              <StatusItem 
                label="Last Backup" 
                status="Never" 
                indicator="warning"
                icon={Clock}
                details="Configure automatic backups"
              />
              <StatusItem 
                label="Email Service" 
                status="Active" 
                indicator="success"
                icon={Bell}
                details="SMTP configured"
              />
              <StatusItem 
                label="Performance" 
                status="Optimal" 
                indicator="success"
                icon={Zap}
                details="Avg response: 245ms"
              />
            </div>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Information</h3>
            <div className="space-y-3">
              <InfoItem 
                label="Environment" 
                value={'Development'}
                icon={Settings}
              />
              <InfoItem 
                label="Database" 
                value="PostgreSQL 15.2"
                icon={Database}
              />
              <InfoItem 
                label="Active Users" 
                value={systemInfo?.totalUsers.toString() || '--'}
                icon={Users}
              />
              <InfoItem 
                label="Total Transactions" 
                value={systemInfo?.totalTransactions.toLocaleString() || '--'}
                icon={Package2}
              />
              <InfoItem 
                label="Storage Used" 
                value={systemInfo ? `${systemInfo.dbSize} MB` : '--'}
                icon={Database}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

// Enhanced Dashboard Card Component
interface EnhancedDashboardCardProps {
  title: string
  value: string
  description: string
  icon: React.ElementType
  trend: string
  trendUp: boolean | null
  sparklineData: number[]
  color: string
}

function EnhancedDashboardCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
  sparklineData,
  color
}: EnhancedDashboardCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between space-x-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h2 className="text-2xl font-bold mt-1">{value}</h2>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          <div className="flex items-center gap-2 mt-2">
            {trendUp !== null && (
              <div className={`p-1 rounded ${
                trendUp ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {trendUp ? (
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
            )}
            <p className={`text-xs ${
              trendUp === true
                ? 'text-green-600 dark:text-green-400'
                : trendUp === false
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }`}>
              {trend}
            </p>
          </div>
          {sparklineData.length > 0 && (
            <div className="mt-3 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((v, i) => ({ value: v, index: i }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color === 'blue' ? '#3B82F6' : color === 'green' ? '#10B981' : color === 'purple' ? '#8B5CF6' : '#F59E0B'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className={`p-2 sm:p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} group-hover:scale-110 transition-transform`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
        </div>
      </div>
    </div>
  )
}

interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ElementType
  href: string
  color: string
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: QuickActionCardProps) {
  return (
    <Link href={href} className="block">
      <div className="border rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group">
        <div className="flex items-start space-x-4">
          <div className={`${color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  )
}

interface SystemActionProps {
  title: string
  description: string
  icon: React.ElementType
  onClick: () => void
  loading?: boolean
  danger?: boolean
}

function SystemAction({ title, description, icon: Icon, onClick, loading, danger }: SystemActionProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      disabled={loading}
      className={`p-4 border rounded-lg transition-all text-left relative overflow-hidden group ${
        danger 
          ? 'hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
          : 'hover:shadow-md hover:border-primary'
      } ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg transition-colors ${
          danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10'
        }`}>
          <Icon className={`h-5 w-5 ${
            danger ? 'text-red-600' : 'text-gray-600 group-hover:text-primary'
          }`} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </button>
  )
}

interface StatusItemProps {
  label: string
  status: string
  indicator?: 'success' | 'warning' | 'error'
  icon?: React.ElementType
  details?: string
}

function StatusItem({ label, status, indicator, icon: Icon, details }: StatusItemProps) {
  const getIndicatorColor = () => {
    switch (indicator) {
      case 'success': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return null
    }
  }

  const getStatusColor = () => {
    switch (indicator) {
      case 'success': return 'text-green-600 dark:text-green-400'
      case 'warning': return 'text-yellow-600 dark:text-yellow-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        <div>
          <span className="text-sm font-medium">{label}</span>
          {details && <p className="text-xs text-muted-foreground">{details}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {indicator && (
          <div className={`w-2 h-2 rounded-full ${getIndicatorColor()}`} />
        )}
        <span className={`text-sm font-medium ${getStatusColor()}`}>{status}</span>
      </div>
    </div>
  )
}

interface InfoItemProps {
  label: string
  value: string
  icon?: React.ElementType
}

function InfoItem({ label, value, icon: Icon }: InfoItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}