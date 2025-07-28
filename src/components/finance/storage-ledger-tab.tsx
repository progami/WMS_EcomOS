'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Download, Package, DollarSign, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

interface StorageSnapshot {
  date: string
  weekNumber: number
  warehouse: { id: string; name: string; code: string }
  totalPallets: number
  rate: number
  cost: number
  items: {
    sku: { id: string; skuCode: string; description: string }
    batchLot: string
    cartons: number
    pallets: number
    cartonsPerPallet: number
    cost: number
  }[]
}

interface StorageLedgerTabProps {
  viewMode: 'live' | 'point-in-time'
  selectedDate: string
  searchQuery: string
  filters: any
  showFilters: boolean
  setShowFilters: (show: boolean) => void
  setFilters: (filters: any) => void
  warehouses: { id: string; name: string }[]
}

export function StorageLedgerTab({
  viewMode,
  selectedDate,
  searchQuery,
  filters,
  showFilters,
  setShowFilters,
  setFilters,
  warehouses
}: StorageLedgerTabProps) {
  const [snapshots, setSnapshots] = useState<StorageSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [aggregationView, setAggregationView] = useState<'weekly' | 'monthly'>('weekly')

  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        ...(filters.warehouse && { warehouseId: filters.warehouse })
      })
      
      
      // API endpoint removed - set empty data
      setSnapshots([])
    } catch (error) {
      toast.error(`Failed to load storage ledger: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [dateRange.start, dateRange.end, filters.warehouse])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStorageData()
    }, 100)
    return () => clearTimeout(timer)
  }, [fetchStorageData])

  const handleExport = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const params = new URLSearchParams({
      startDate: dateRange.start,
      endDate: dateRange.end,
      ...(filters.warehouse && { warehouseId: filters.warehouse })
    })
    // API endpoint removed
    toast.error('Export feature not available')
  }

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  // Helper function to determine billing period
  const getBillingPeriod = (date: Date) => {
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    
    if (day <= 15) {
      // Previous month 16th to current month 15th
      const startDate = new Date(year, month - 1, 16)
      const endDate = new Date(year, month, 15)
      return {
        start: startDate,
        end: endDate,
        label: `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
    } else {
      // Current month 16th to next month 15th
      const startDate = new Date(year, month, 16)
      const endDate = new Date(year, month + 1, 15)
      return {
        start: startDate,
        end: endDate,
        label: `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
    }
  }

  // Aggregate weekly snapshots into monthly billing periods
  const aggregateMonthlySnapshots = (weeklySnapshots: StorageSnapshot[]) => {
    const monthlyMap = new Map<string, any>()
    
    weeklySnapshots.forEach(snapshot => {
      const date = new Date(snapshot.date)
      const billingPeriod = getBillingPeriod(date)
      const key = `${billingPeriod.label}-${snapshot.warehouse.id}`
      
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          billingPeriod: billingPeriod.label,
          warehouse: snapshot.warehouse,
          weeks: [],
          totalPalletWeeks: 0,
          totalCost: 0,
          rate: snapshot.rate,
          itemsMap: new Map()
        })
      }
      
      const monthly = monthlyMap.get(key)
      monthly.weeks.push(snapshot.weekNumber)
      monthly.totalPalletWeeks += snapshot.totalPallets
      monthly.totalCost += snapshot.cost
      
      // Aggregate items
      snapshot.items.forEach(item => {
        const itemKey = `${item.sku.id}-${item.batchLot}`
        if (!monthly.itemsMap.has(itemKey)) {
          monthly.itemsMap.set(itemKey, {
            sku: item.sku,
            batchLot: item.batchLot,
            totalCartonWeeks: 0,
            totalPalletWeeks: 0,
            cartonsPerPallet: item.cartonsPerPallet,
            totalCost: 0
          })
        }
        const monthlyItem = monthly.itemsMap.get(itemKey)
        monthlyItem.totalCartonWeeks += item.cartons
        monthlyItem.totalPalletWeeks += item.pallets
        monthlyItem.totalCost += item.cost
      })
    })
    
    // Convert to array format
    const monthlySnapshots: any[] = []
    monthlyMap.forEach(monthly => {
      const items = Array.from(monthly.itemsMap.values())
      
      monthlySnapshots.push({
        ...monthly,
        weekCount: monthly.weeks.length,
        items: items.sort((a: any, b: any) => a.sku.skuCode.localeCompare(b.sku.skuCode))
      })
    })
    
    return monthlySnapshots.sort((a, b) => {
      const dateA = new Date(a.billingPeriod.split(' - ')[0])
      const dateB = new Date(b.billingPeriod.split(' - ')[0])
      return dateB.getTime() - dateA.getTime() || a.warehouse.name.localeCompare(b.warehouse.name)
    })
  }

  // Filter snapshots based on search
  const filteredSnapshots = snapshots.filter(snapshot => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        snapshot.warehouse.name.toLowerCase().includes(query) ||
        snapshot.warehouse.code.toLowerCase().includes(query) ||
        snapshot.items.some(item => 
          item.sku.skuCode.toLowerCase().includes(query) ||
          item.sku.description.toLowerCase().includes(query) ||
          item.batchLot.toLowerCase().includes(query)
        )
      )
    }
    return true
  })
  
  // Apply aggregation based on view
  const displaySnapshots = aggregationView === 'monthly' 
    ? aggregateMonthlySnapshots(filteredSnapshots)
    : filteredSnapshots

  // Calculate summary stats
  const totalCost = filteredSnapshots.reduce((sum, s) => sum + s.cost, 0)
  const totalPallets = filteredSnapshots.reduce((sum, s) => sum + s.totalPallets, 0)
  const avgRate = filteredSnapshots.length > 0 
    ? filteredSnapshots.reduce((sum, s) => sum + s.rate, 0) / filteredSnapshots.length 
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Storage Billing Information</p>
            <ul className="mt-2 space-y-1 text-blue-800">
              <li>• <strong>Regular Warehouses:</strong> Charged weekly based on Monday inventory counts (23:59:59)</li>
              <li>• <strong>Amazon FBA:</strong> Charged monthly based on average daily inventory volume</li>
              <li>• <strong>Billing Period:</strong> 16th of one month to 15th of the next</li>
              <li>• <strong>Snapshot Time:</strong> Every Monday at 23:59:59 CT</li>
              <li>• <strong>Monthly View:</strong> Shows total pallet-weeks (sum of all weekly pallets in the period)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Date Range and Export Controls */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-col gap-4">
          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Quick Select:</label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 30)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 90)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
            >
              Last 90 days
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setMonth(start.getMonth() - 6)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
            >
              Last 6 months
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const now = new Date()
                const start = new Date(now.getFullYear(), 0, 1)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
            >
              Year to date
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date('2020-01-01') // Or set to a very early date
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
            >
              All time
            </button>
          </div>
          
          {/* Date Inputs and Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs font-medium text-gray-500">From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
              <span className="text-gray-500">→</span>
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs font-medium text-gray-500">To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fetchStorageData()
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                Update
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-md p-1">
                <button
                  type="button"
                  onClick={() => setAggregationView('weekly')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    aggregationView === 'weekly' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setAggregationView('monthly')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    aggregationView === 'monthly' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => handleExport(e)}
                className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Filter by Warehouse</label>
              <select
                value={filters.warehouse}
                onChange={(e) => setFilters({ ...filters, warehouse: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Snapshots</p>
              <p className="text-2xl font-bold">{filteredSnapshots.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Pallets</p>
              <p className="text-2xl font-bold">{totalPallets.toLocaleString()}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Average Rate</p>
              <p className="text-2xl font-bold">{formatCurrency(avgRate)}</p>
              <p className="text-xs text-gray-500">per pallet/week</p>
            </div>
            <BarChart3 className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCost)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Storage Ledger Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {aggregationView === 'weekly' ? 'Weekly Storage Snapshots' : 'Monthly Storage Summary'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {aggregationView === 'weekly' 
              ? 'Monday inventory counts with storage costs. Click on a row to see SKU details.'
              : 'Monthly aggregation based on billing periods (16th to 15th). Click on a row to see SKU details.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {aggregationView === 'weekly' ? (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week Ending
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Billing Period
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weeks
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {aggregationView === 'weekly' ? 'Total Pallets' : 'Total Pallet-Weeks'}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate (£/pallet)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {aggregationView === 'weekly' ? 'Weekly Cost' : 'Total Cost'}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKUs
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displaySnapshots.map((snapshot) => {
                const key = aggregationView === 'weekly' 
                  ? `${snapshot.date}-${snapshot.warehouse.id}`
                  : `${snapshot.billingPeriod}-${snapshot.warehouse.id}`
                const isExpanded = expandedRows.has(key)
                
                return (
                  <>
                    <tr
                      key={key}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRow(key)}
                    >
                      {aggregationView === 'weekly' ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-medium">W{snapshot.weekNumber}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              {new Date(snapshot.date).toLocaleDateString('en-US', {
                                timeZone: 'America/Chicago',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              {snapshot.billingPeriod}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {snapshot.weekCount} weeks
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {snapshot.warehouse.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {aggregationView === 'weekly' 
                          ? snapshot.totalPallets.toLocaleString()
                          : snapshot.totalPalletWeeks.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(snapshot.rate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                        {formatCurrency(aggregationView === 'weekly' ? snapshot.cost : snapshot.totalCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {snapshot.items.length}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="text-sm">
                            <h4 className="font-medium mb-2">
                              {aggregationView === 'weekly' ? 'SKU Details' : 'Monthly SKU Summary'}
                            </h4>
                            {aggregationView === 'monthly' && (
                              <p className="text-xs text-gray-600 mb-3">
                                Weeks included: {snapshot.weeks.join(', ')}
                              </p>
                            )}
                            <table className="min-w-full">
                              <thead>
                                <tr className="text-xs text-gray-500 uppercase">
                                  <th className="text-left pb-2">SKU Code</th>
                                  <th className="text-left pb-2">Description</th>
                                  <th className="text-left pb-2">Batch/Lot</th>
                                  <th className="text-right pb-2">
                                    {aggregationView === 'weekly' ? 'Cartons' : 'Total Cartons'}
                                  </th>
                                  <th className="text-right pb-2">Config</th>
                                  <th className="text-right pb-2">
                                    {aggregationView === 'weekly' ? 'Pallets' : 'Total Pallets'}
                                  </th>
                                  <th className="text-right pb-2">
                                    {aggregationView === 'weekly' ? 'Cost Share' : 'Total Cost'}
                                  </th>
                                  <th className="text-right pb-2">%</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {snapshot.items.map((item: any, idx: number) => {
                                  const pallets = aggregationView === 'weekly' ? item.pallets : item.totalPalletWeeks
                                  const totalPallets = aggregationView === 'weekly' ? snapshot.totalPallets : snapshot.totalPalletWeeks
                                  const percentage = (pallets / totalPallets) * 100
                                  
                                  return (
                                    <tr key={idx}>
                                      <td className="py-2">{item.sku.skuCode}</td>
                                      <td className="py-2">{item.sku.description}</td>
                                      <td className="py-2">{item.batchLot}</td>
                                      <td className="py-2 text-right">
                                        {(aggregationView === 'weekly' ? item.cartons : item.totalCartonWeeks).toLocaleString()}
                                      </td>
                                      <td className="py-2 text-right">
                                        {item.cartonsPerPallet}/pallet
                                        {item.cartons === item.pallets && item.cartons <= 5 && (
                                          <span className="text-xs text-gray-500 ml-1" title="Minimum 1 pallet required">
                                            (min)
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 text-right font-medium">{pallets}</td>
                                      <td className="py-2 text-right font-medium text-green-600">
                                        {formatCurrency(aggregationView === 'weekly' ? item.cost : item.totalCost)}
                                      </td>
                                      <td className="py-2 text-right text-gray-500">
                                        {percentage.toFixed(1)}%
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {displaySnapshots.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={Calendar}
                      title={`No ${aggregationView} storage data found`}
                      description={searchQuery || filters.warehouse
                        ? "Try adjusting your search criteria or filters."
                        : `No ${aggregationView === 'weekly' ? 'Monday snapshots' : 'billing periods'} found in the selected date range.`}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{displaySnapshots.length}</span> {aggregationView} {aggregationView === 'weekly' ? 'snapshots' : 'periods'}
        {dateRange.start && dateRange.end && (
          <span className="text-xs text-gray-500 ml-2">
            (from {new Date(dateRange.start).toLocaleDateString()} to {new Date(dateRange.end).toLocaleDateString()})
          </span>
        )}
      </div>
    </div>
  )
}