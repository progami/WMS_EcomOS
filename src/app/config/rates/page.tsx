'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DollarSign, Plus, Edit2, Calendar, AlertCircle, Filter, X } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ImportButton } from '@/components/ui/import-button'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

interface CostRate {
  id: string
  warehouseId: string
  warehouse: { name: string; code: string }
  costCategory: string
  costName: string
  costValue: number
  unitOfMeasure: string
  effectiveDate: string
  endDate?: string
}

interface Warehouse {
  id: string
  name: string
  code: string
}

export default function AdminRatesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rates, setRates] = useState<CostRate[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [groupBy, setGroupBy] = useState<'warehouse' | 'category'>('warehouse')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    // Both admin and staff can view rates
    if (!['admin', 'staff'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
    fetchData()
  }, [session, status, router])

  const fetchData = async () => {
    try {
      // Fetch rates
      const ratesResponse = await fetchWithCSRF('/api/settings/rates')
      if (ratesResponse.ok) {
        const data = await ratesResponse.json()
        setRates(data)
      }

      // Fetch warehouses
      const warehouseResponse = await fetchWithCSRF('/api/warehouses')
      if (warehouseResponse.ok) {
        const data = await warehouseResponse.json()
        setWarehouses(data)
      }
    } catch (error) {
      toast.error('Failed to load rates')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryBadgeClass = (category: string) => {
    const classes: { [key: string]: string } = {
      Storage: 'badge-primary',
      Container: 'badge-purple',
      Carton: 'badge-success',
      Pallet: 'badge-warning',
      Unit: 'badge-pink',
      Shipment: 'badge-info',
      Accessorial: 'badge-secondary'
    }
    return classes[category] || 'badge-secondary'
  }

  const formatCurrency = (value: number) => {
    return `£${value.toFixed(2)}`
  }

  // Filter rates
  const filteredRates = rates.filter(rate => {
    if (selectedWarehouse !== 'all' && rate.warehouseId !== selectedWarehouse) return false
    if (selectedCategory !== 'all' && rate.costCategory !== selectedCategory) return false
    if (showActiveOnly) {
      const now = new Date()
      const effectiveDate = new Date(rate.effectiveDate)
      const endDate = rate.endDate ? new Date(rate.endDate) : null
      if (effectiveDate > now) return false // Future rates
      if (endDate && endDate < now) return false // Expired rates
    }
    return true
  })

  // Group rates
  const groupedRates = () => {
    if (groupBy === 'warehouse') {
      return warehouses.map(warehouse => ({
        key: warehouse.id,
        title: warehouse.name,
        subtitle: `${filteredRates.filter(r => r.warehouseId === warehouse.id).length} active rates`,
        rates: filteredRates.filter(r => r.warehouseId === warehouse.id)
      }))
    } else {
      const categories = ['Storage', 'Container', 'Carton', 'Pallet', 'Unit', 'Shipment', 'Accessorial']
      return categories.map(category => ({
        key: category,
        title: category,
        subtitle: getCategoryDescription(category),
        rates: filteredRates.filter(r => r.costCategory === category)
      })).filter(group => group.rates.length > 0)
    }
  }

  const getCategoryDescription = (category: string) => {
    const descriptions: { [key: string]: string } = {
      Storage: 'Storage charges (pallet/week or cubic foot/month)',
      Container: 'Container handling and unloading fees',
      Carton: 'Per carton charges for special handling',
      Pallet: 'Pallet movement and handling fees',
      Unit: 'Per unit charges for pick and pack',
      Shipment: 'Shipping and freight charges',
      Accessorial: 'Additional services and special charges'
    }
    return descriptions[category] || 'Other charges'
  }

  const getStatusBadge = (rate: CostRate) => {
    const now = new Date()
    const effectiveDate = new Date(rate.effectiveDate)
    const endDate = rate.endDate ? new Date(rate.endDate) : null

    if (endDate && endDate < now) {
      return <span className="text-xs text-gray-500">Expired</span>
    } else if (effectiveDate > now) {
      return <span className="text-xs text-blue-600">Future</span>
    } else {
      return <span className="text-xs text-green-600">Active</span>
    }
  }

  const hasActiveStorageRate = (warehouseId: string) => {
    const storageRates = rates.filter(r => 
      r.warehouseId === warehouseId && 
      r.costCategory === 'Storage' &&
      new Date(r.effectiveDate) <= new Date() &&
      (!r.endDate || new Date(r.endDate) >= new Date())
    )
    return storageRates.length > 1
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  // Get stats for the history section
  const activeRatesCount = rates.filter(rate => {
    const now = new Date()
    const effectiveDate = new Date(rate.effectiveDate)
    const endDate = rate.endDate ? new Date(rate.endDate) : null
    return effectiveDate <= now && (!endDate || endDate >= now)
  }).length

  const lastUpdateDate = rates.reduce((latest, rate) => {
    const rateDate = new Date(rate.effectiveDate)
    return rateDate > latest ? rateDate : latest
  }, new Date(0))

  const pendingChanges = rates.filter(rate => 
    new Date(rate.effectiveDate) > new Date()
  ).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Cost Rates Management"
          icon={DollarSign}
          actions={
            session?.user.role === 'admin' && (
              <div className="flex gap-2">
                <ImportButton 
                  entityName="costRates" 
                  onImportComplete={fetchData}
                />
                <Link
                  href="/config/rates/new"
                  className="action-button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rate
                </Link>
              </div>
            )
          }
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
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Group by:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupBy('warehouse')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    groupBy === 'warehouse' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Warehouse
                </button>
                <button
                  onClick={() => setGroupBy('category')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    groupBy === 'category' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Category
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Warehouses</option>
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
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  {['Storage', 'Container', 'Carton', 'Pallet', 'Unit', 'Shipment', 'Accessorial'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Active rates only</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {warehouses.some(w => hasActiveStorageRate(w.id)) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Multiple Active Storage Rates Detected</p>
                <p>Some warehouses have multiple active storage rates. This may cause calculation issues.</p>
              </div>
            </div>
          </div>
        )}

        {/* Rates by Group */}
        {groupedRates().map((group) => (
          <div key={group.key} className="border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">{group.title}</h2>
              <p className="text-sm text-gray-600">{group.subtitle}</p>
            </div>
            
            {group.rates.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No rates configured
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {groupBy === 'category' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Warehouse
                        </th>
                      )}
                      {groupBy === 'warehouse' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective Date
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {session?.user.role === 'admin' && (
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {group.rates.map((rate) => (
                      <tr key={rate.id} className="hover:bg-gray-50">
                        {groupBy === 'category' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rate.warehouse.name}
                          </td>
                        )}
                        {groupBy === 'warehouse' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={getCategoryBadgeClass(rate.costCategory)}>
                              {rate.costCategory}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {rate.costName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(rate.costValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rate.unitOfMeasure}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(rate.effectiveDate).toLocaleDateString()}
                          {rate.endDate && (
                            <span className="text-xs text-gray-400 block">
                              to {new Date(rate.endDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getStatusBadge(rate)}
                        </td>
                        {session?.user.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/config/rates/${rate.id}/edit`}
                              className="text-primary hover:text-primary/80"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Rate History Summary */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-indigo-600" />
              <div>
                <h3 className="text-lg font-semibold">Rate History</h3>
                <p className="text-sm text-gray-600">Overview of rate changes and status</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Last Rate Update</p>
              <p className="text-lg font-semibold">
                {lastUpdateDate.getTime() > 0 
                  ? lastUpdateDate.toLocaleDateString()
                  : 'No rates yet'
                }
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Active Rates</p>
              <p className="text-lg font-semibold">{activeRatesCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Pending Changes</p>
              <p className="text-lg font-semibold">{pendingChanges}</p>
            </div>
          </div>
        </div>

        {/* Category Reference */}
        <div className="bg-gray-50 border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Cost Category Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries({
              Storage: 'Storage charges (pallet/week or cubic foot/month)',
              Container: 'Container handling and unloading fees',
              Carton: 'Per carton charges for special handling',
              Pallet: 'Pallet movement and handling fees',
              Unit: 'Per unit charges for pick and pack',
              Shipment: 'Shipping and freight charges',
              Accessorial: 'Additional services and special charges'
            }).map(([category, description]) => (
              <div key={category} className="flex items-start gap-3">
                <span className={`${getCategoryBadgeClass(category)} mt-1`}>
                  {category}
                </span>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}