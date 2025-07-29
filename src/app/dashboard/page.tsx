'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useClientLogger } from '@/hooks/useClientLogger'
import { 
  Package2, 
  TrendingUp, 
  Calendar,
  ChevronDown
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { DemoWelcome } from '@/components/ui/demo-welcome'
import { SectionHeader } from '@/components/dashboard/section-header'
import { MarketSection } from '@/components/dashboard/market-section'
import { toast } from 'react-hot-toast'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

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
  // Market data
  amazonMetrics?: {
    pendingShipments: number
    inboundInventory: number
    activeListings: number
  }
  reorderAlerts?: number
  plannedShipments?: number
  // Finance data
  reconciliationStatus?: {
    matched: number
    mismatched: number
    pending: number
  }
  recentInvoices?: Array<{
    id: string
    clientName: string
    amount: string
    status: 'pending' | 'paid' | 'overdue'
    date: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { logAction, logPerformance, logError } = useClientLogger()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('yearToDate')
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false)
  const [hasError, setHasError] = useState(false)
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard')
    }
  }, [status, router])
  
  // Always use real data, never demo data
  const useDemoData = false
  const isAdmin = session?.user?.role === 'admin'
  
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
    const startTime = performance.now()
    
    try {
      logAction('dashboard_stats_fetch_started', { timeRange: selectedTimeRange })
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        startDate: timeRanges[selectedTimeRange].startDate.toISOString(),
        endDate: timeRanges[selectedTimeRange].endDate.toISOString()
      })
      
      const response = await fetch(`/api/dashboard/stats?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || data)
        
        // Use real chart data from API
        if (data.chartData) {
          setChartData(data.chartData)
        }
        
        const duration = performance.now() - startTime
        logPerformance('dashboard_stats_fetch', duration, {
          timeRange: selectedTimeRange,
          hasData: !!data
        })
      } else {
        setHasError(true)
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          toast.error(errorData.details || errorData.error || 'Failed to load dashboard stats')
        } catch {
          toast.error(`API Error (${response.status}): ${errorText}`)
        }
      }
    } catch (error) {
      const duration = performance.now() - startTime
      logError('Failed to fetch dashboard stats', error)
      logPerformance('dashboard_stats_fetch_error', duration)
      setHasError(true)
      
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('401')) {
        router.push('/WMS/auth/login?callbackUrl=/WMS/dashboard')
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard stats')
      }
    } finally {
      setLoadingStats(false)
    }
  }, [selectedTimeRange, timeRanges, logAction, logPerformance, logError])


  // Fetch data when authenticated or when time range changes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardStats()
    }
  }, [status, selectedTimeRange, fetchDashboardStats])

  // Show loading only while checking authentication
  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  // If unauthenticated, the useEffect redirect will handle it
  if (status === 'unauthenticated' || !session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-500">Redirecting to login...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Show loading while fetching stats (only for authenticated users)
  if (loadingStats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  // Show error state if data fetch failed
  if (hasError && !stats && !useDemoData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <p className="text-red-500 text-lg">Failed to load dashboard data</p>
            <p className="text-gray-500">Please check your connection and try again</p>
            <button
              onClick={() => {
                setHasError(false)
                fetchDashboardStats()
              }}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }


  // Prepare data for sections
  const marketData = {
    data: {
      amazonMetrics: chartData?.amazonMetrics,
      reorderAlerts: chartData?.reorderAlerts,
      plannedShipments: chartData?.plannedShipments,
      inventoryTrend: chartData?.inventoryTrend
    }
  }

  const opsData = {
    data: {
      totalInventory: stats?.totalInventory,
      inventoryChange: stats?.inventoryChange,
      inventoryTrend: stats?.inventoryTrend,
      activeSkus: stats?.activeSkus,
      warehouseDistribution: chartData?.warehouseDistribution,
      recentTransactions: chartData?.recentTransactions
    }
  }

  const finData = {
    data: {
      storageCost: stats?.storageCost,
      costChange: stats?.costChange,
      costTrend: stats?.costTrend,
      pendingInvoices: stats?.pendingInvoices,
      overdueInvoices: stats?.overdueInvoices,
      reconciliationStatus: chartData?.reconciliationStatus,
      recentInvoices: chartData?.recentInvoices,
      costTrendData: chartData?.costTrend
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {session.user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            
          </div>
        </div>


        {/* Main Dashboard Sections */}
        <div className="grid gap-6">
          {/* Market Section - Inventory Level Graph Only */}
          <div className="border rounded-lg p-6 bg-white dark:bg-gray-900">
            <SectionHeader 
              title="Inventory Levels" 
              icon={TrendingUp} 
              description="Daily inventory trend for the last 30 days"
            />
            <MarketSection data={marketData.data} loading={loadingStats} />
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

