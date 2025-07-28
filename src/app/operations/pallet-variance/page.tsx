'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  FileText,
  Plus,
  Minus,
  Download,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'react-hot-toast'

interface PalletVariance {
  id: string
  warehouseId: string
  warehouse: { name: string; code: string }
  skuId: string
  sku: { skuCode: string; description: string }
  batchLot: string
  systemPallets: number
  actualPallets: number
  variance: number
  variancePercentage: number
  lastPhysicalCount: string | null
  notes: string | null
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED'
  createdAt: string
  updatedAt: string
}

export default function PalletVariancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [variances, setVariances] = useState<PalletVariance[]>([])
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'pending'>('pending')
  const [selectedVariance, setSelectedVariance] = useState<PalletVariance | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustmentData, setAdjustmentData] = useState({
    actualPallets: 0,
    reason: '',
    notes: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    fetchVariances()
  }, [])

  const fetchVariances = async () => {
    try {
      setLoading(true)
      // API endpoint removed - set empty data
      setVariances([])
    } catch (error) {
      toast.error('Failed to load pallet variances')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdjustment = async () => {
    if (!selectedVariance || !adjustmentData.reason) {
      toast.error('Please provide a reason for the adjustment')
      return
    }

    try {
      const adjustmentType = adjustmentData.actualPallets > selectedVariance.systemPallets ? 'ADJUST_IN' : 'ADJUST_OUT'
      const palletDifference = Math.abs(adjustmentData.actualPallets - selectedVariance.systemPallets)
      
      // Calculate cartons based on the pallet configuration
      const cartonsToAdjust = palletDifference * 50 // Assuming 50 cartons per pallet as default

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedVariance.warehouseId,
          skuId: selectedVariance.skuId,
          batchLot: selectedVariance.batchLot,
          transactionType: adjustmentType,
          referenceId: `PALLET-ADJ-${Date.now()}`,
          cartonsIn: adjustmentType === 'ADJUST_IN' ? cartonsToAdjust : 0,
          cartonsOut: adjustmentType === 'ADJUST_OUT' ? cartonsToAdjust : 0,
          storagePalletsIn: adjustmentType === 'ADJUST_IN' ? palletDifference : 0,
          shippingPalletsOut: adjustmentType === 'ADJUST_OUT' ? palletDifference : 0,
          notes: `Pallet variance adjustment: ${adjustmentData.reason}. ${adjustmentData.notes}`,
          transactionDate: new Date().toISOString()
        })
      })

      if (response.ok) {
        // Update variance status
        // API endpoint removed - skip update

        toast.success('Adjustment created successfully')
        setShowAdjustModal(false)
        setSelectedVariance(null)
        setAdjustmentData({ actualPallets: 0, reason: '', notes: '' })
        fetchVariances()
      } else {
        toast.error('Failed to create adjustment')
      }
    } catch (error) {
      toast.error('Failed to create adjustment')
    }
  }

  const handleExport = () => {
    // API endpoint removed
    toast.error('Export feature not available')
  }

  const filteredVariances = variances.filter(v => {
    if (filter === 'positive') return v.variance > 0
    if (filter === 'negative') return v.variance < 0
    if (filter === 'pending') return v.status === 'PENDING'
    return true
  })

  const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0)
  const positiveCount = variances.filter(v => v.variance > 0).length
  const negativeCount = variances.filter(v => v.variance < 0).length
  const pendingCount = variances.filter(v => v.status === 'PENDING').length

  if (loading || status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Pallet Variance Management"
          subtitle="Track and reconcile differences between system and physical pallet counts"
          icon={Package}
          iconColor="text-orange-600"
          bgColor="bg-orange-50"
          borderColor="border-orange-200"
          textColor="text-orange-800"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchVariances}
                className="secondary-button"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="secondary-button"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Variance</p>
                <p className={`text-2xl font-bold ${totalVariance > 0 ? 'text-green-600' : totalVariance < 0 ? 'text-red-600' : ''}`}>
                  {totalVariance > 0 ? '+' : ''}{totalVariance} pallets
                </p>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overages</p>
                <p className="text-2xl font-bold text-green-600">{positiveCount}</p>
                <p className="text-xs text-gray-500">Physical &gt; System</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Shortages</p>
                <p className="text-2xl font-bold text-red-600">{negativeCount}</p>
                <p className="text-xs text-gray-500">Physical &lt; System</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All ({variances.length})
            </button>
            <button
              onClick={() => setFilter('positive')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'positive'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overages ({positiveCount})
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'negative'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Shortages ({negativeCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </nav>
        </div>

        {/* Variance Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch/Lot
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System Pallets
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Pallets
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVariances.map((variance) => (
                <tr key={variance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.warehouse.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <div className="font-medium">{variance.sku.skuCode}</div>
                      <div className="text-xs text-gray-500">{variance.sku.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.batchLot}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {variance.systemPallets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                    {variance.actualPallets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className={`inline-flex items-center gap-1 font-medium ${
                      variance.variance > 0 ? 'text-green-600' : variance.variance < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {variance.variance > 0 ? (
                        <Plus className="h-3 w-3" />
                      ) : variance.variance < 0 ? (
                        <Minus className="h-3 w-3" />
                      ) : null}
                      {Math.abs(variance.variance)} ({variance.variancePercentage.toFixed(1)}%)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      variance.status === 'RESOLVED' 
                        ? 'bg-green-100 text-green-800'
                        : variance.status === 'INVESTIGATING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {variance.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {variance.lastPhysicalCount 
                      ? new Date(variance.lastPhysicalCount).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.status !== 'RESOLVED' && (
                      <button
                        onClick={() => {
                          setSelectedVariance(variance)
                          setAdjustmentData({
                            actualPallets: variance.actualPallets,
                            reason: '',
                            notes: ''
                          })
                          setShowAdjustModal(true)
                        }}
                        className="text-primary hover:text-primary-dark"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVariances.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12">
                    <EmptyState
                      icon={CheckCircle}
                      title="No variances found"
                      description={filter === 'pending' 
                        ? "No pending variances to review."
                        : "No pallet variances match the selected filter."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {showAdjustModal && selectedVariance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create Pallet Adjustment</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm">
                  <p><span className="font-medium">SKU:</span> {selectedVariance.sku.skuCode}</p>
                  <p><span className="font-medium">Batch:</span> {selectedVariance.batchLot}</p>
                  <p><span className="font-medium">Warehouse:</span> {selectedVariance.warehouse.name}</p>
                  <p className="mt-2">
                    <span className="font-medium">System Count:</span> {selectedVariance.systemPallets} pallets
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Actual Physical Count *</label>
                <input
                  type="number"
                  value={adjustmentData.actualPallets}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    actualPallets: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                />
                {adjustmentData.actualPallets !== selectedVariance.systemPallets && (
                  <p className={`text-sm mt-1 ${
                    adjustmentData.actualPallets > selectedVariance.systemPallets 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {adjustmentData.actualPallets > selectedVariance.systemPallets ? 'Increase' : 'Decrease'} of{' '}
                    {Math.abs(adjustmentData.actualPallets - selectedVariance.systemPallets)} pallets
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason for Adjustment *</label>
                <select
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    reason: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select reason</option>
                  <option value="Physical count correction">Physical count correction</option>
                  <option value="Damaged pallets">Damaged pallets</option>
                  <option value="Misplaced inventory">Misplaced inventory</option>
                  <option value="Data entry error">Data entry error</option>
                  <option value="Theft or loss">Theft or loss</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    notes: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Provide additional details..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowAdjustModal(false)
                    setSelectedVariance(null)
                  }}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAdjustment}
                  disabled={!adjustmentData.reason || adjustmentData.actualPallets === selectedVariance.systemPallets}
                  className="primary-button"
                >
                  Create Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}