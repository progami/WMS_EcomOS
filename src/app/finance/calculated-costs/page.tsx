'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DollarSign, Filter, X, Calendar, BarChart3, FileText, Search, Download } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { formatCurrency } from '@/lib/utils'

interface CalculatedCost {
  warehouseId: string
  warehouseName: string
  costCategory: string
  costName: string
  quantity: number
  unitRate: number
  unit: string
  amount: number
  transactionId?: string
  costRateId?: string
  details?: {
    skuId?: string
    skuCode?: string
    description?: string
    batchLot?: string
    transactionType?: string
    transactionId?: string
    trackingNumber?: string
    transactionDate?: string
    count?: number
  }
}

interface Warehouse {
  id: string
  name: string
  code: string
}

export default function CalculatedCostsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [costs, setCosts] = useState<CalculatedCost[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    warehouse: '',
    category: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    // Finance and admin users can view calculated costs
    if (!['admin', 'finance', 'staff'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
    fetchData()
  }, [session, status, router])

  const fetchData = async () => {
    try {
      // Fetch warehouses first
      const warehouseResponse = await fetchWithCSRF('/api/warehouses')
      if (warehouseResponse.ok) {
        const warehouseData = await warehouseResponse.json()
        setWarehouses(warehouseData)
        
        // Fetch calculated costs for the first warehouse if any exist
        if (warehouseData.length > 0) {
          const firstWarehouseId = warehouseData[0].id
          await fetchCostsForWarehouse(firstWarehouseId)
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load calculated costs')
    } finally {
      setLoading(false)
    }
  }

  const fetchCostsForWarehouse = async (warehouseId: string) => {
    try {
      const params = new URLSearchParams({ warehouseId })
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      
      const response = await fetchWithCSRF(`/api/finance/calculated-costs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCosts(data.costs || [])
      } else {
        console.error('Failed to fetch calculated costs')
        setCosts([])
      }
    } catch (error) {
      console.error('Error fetching costs:', error)
      setCosts([])
    }
  }

  const handleWarehouseChange = (warehouseId: string) => {
    setFilters(prev => ({ ...prev, warehouse: warehouseId }))
    if (warehouseId) {
      fetchCostsForWarehouse(warehouseId)
    }
  }

  const getCategoryBadgeClass = (category: string) => {
    const classes: { [key: string]: string } = {
      STORAGE: 'badge-primary',
      CONTAINER: 'badge-purple',
      CARTON: 'badge-success',
      PALLET: 'badge-warning',
      UNIT: 'badge-pink',
      SHIPMENT: 'badge-info',
      ACCESSORIAL: 'badge-secondary'
    }
    return classes[category] || 'badge-secondary'
  }

  // Filter costs based on search and filters
  const filteredCosts = costs.filter(cost => {
    if (searchQuery && !cost.details?.transactionId?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !cost.costName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !cost.details?.skuCode?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !cost.details?.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (filters.category && cost.costCategory !== filters.category) return false
    return true
  })

  // Group costs by transaction for better display
  const groupedCosts = filteredCosts.reduce((acc, cost) => {
    const key = cost.details?.transactionId || cost.details?.trackingNumber || 'unknown'
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(cost)
    return acc
  }, {} as { [key: string]: CalculatedCost[] })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  const totalAmount = filteredCosts.reduce((sum, cost) => sum + cost.amount, 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Calculated Costs"
          icon={DollarSign}
          description="View calculated costs for transactions and storage"
        />

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Filter className="h-4 w-4" />
              Filters {showFilters ? <X className="h-4 w-4" /> : null}
            </button>
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by transaction ID, cost name, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <select
                  value={filters.warehouse}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {['STORAGE', 'CONTAINER', 'CARTON', 'PALLET', 'UNIT', 'SHIPMENT', 'ACCESSORIAL'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {Object.keys(groupedCosts).length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No calculated costs found</h3>
            <p className="text-gray-500">
              {warehouses.length === 0 
                ? 'No warehouses configured'
                : filters.warehouse
                  ? 'No costs found for the selected warehouse and filters'
                  : 'Please select a warehouse to view calculated costs'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedCosts).map(([transactionId, transactionCosts]) => (
              <div key={transactionId} className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Transaction: {transactionId}</h3>
                      {transactionCosts[0]?.details && (
                        <div className="text-sm text-gray-600 mt-1">
                          {transactionCosts[0].details.transactionType && `${transactionCosts[0].details.transactionType} • `}
                          {transactionCosts[0].details.trackingNumber && `${transactionCosts[0].details.trackingNumber} • `}
                          {transactionCosts[0].details.transactionDate && new Date(transactionCosts[0].details.transactionDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {formatCurrency(transactionCosts.reduce((sum, cost) => sum + cost.amount, 0))}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transactionCosts.length} cost item{transactionCosts.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Units
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Cost
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactionCosts.map((cost) => (
                        <tr key={`${cost.transactionId}-${cost.costName}-${cost.costRateId}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {cost.costName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={getCategoryBadgeClass(cost.costCategory)}>
                              {cost.costCategory}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{cost.details?.skuCode || 'N/A'}</div>
                              {cost.details?.description && (
                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                  {cost.details.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {cost.quantity.toFixed(0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(cost.unitRate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(cost.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold">Cost Summary</h3>
                <p className="text-sm text-gray-600">{filteredCosts.length} calculated cost items</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalAmount)}
              </div>
              <div className="text-sm text-gray-600">Total Amount</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}