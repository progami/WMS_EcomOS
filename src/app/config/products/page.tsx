'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package2, Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ImportButton } from '@/components/ui/import-button'

interface SKU {
  id: string
  skuCode: string
  description: string
  asin: string | null
  packSize: number
  material?: string | null
  unitsPerCarton: number
  cartonWeightKg: number | null
  cartonDimensionsCm: string | null
  packagingType?: string | null
  isActive: boolean
  _count: {
    inventoryTransactions: number
    warehouseConfigs: number
  }
}

export default function AdminSkusPage() {
  const router = useRouter()
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [skuToDelete, setSkuToDelete] = useState<SKU | null>(null)

  useEffect(() => {
    fetchSkus()
  }, [searchTerm, showInactive])

  const fetchSkus = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (showInactive) params.append('includeInactive', 'true')
      
      const response = await fetch(`/api/skus?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch SKUs' }))
        throw new Error(errorData.details || errorData.error || 'Failed to fetch SKUs')
      }
      
      const data = await response.json()
      setSkus(data)
    } catch (error) {
      // console.error('Error fetching SKUs:', error)
      alert(error instanceof Error ? error.message : 'Failed to fetch SKUs')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (sku: SKU) => {
    setSkuToDelete(sku)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!skuToDelete) return

    try {
      const response = await fetch(`/api/skus?id=${skuToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete SKU')
      
      const result = await response.json()
      alert(result.message)
      await fetchSkus()
    } catch (error) {
      // console.error('Error deleting SKU:', error)
      alert('Failed to delete SKU')
    }
  }

  const handleToggleActive = async (sku: SKU) => {
    try {
      const response = await fetch(`/api/skus?id=${sku.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sku.isActive })
      })

      if (!response.ok) throw new Error('Failed to update SKU')
      
      await fetchSkus()
    } catch (error) {
      // console.error('Error updating SKU:', error)
      alert('Failed to update SKU')
    }
  }

  const handleEditSKU = (skuId: string) => {
    router.push(`/config/products/${skuId}/edit`)
  }

  const filteredSkus = skus.filter(sku => {
    if (!showInactive && !sku.isActive) return false
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    return (
      sku.skuCode.toLowerCase().includes(search) ||
      sku.description.toLowerCase().includes(search) ||
      (sku.asin && sku.asin.toLowerCase().includes(search))
    )
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <PageHeader
          title="SKU Management"
          subtitle="Manage product definitions and specifications"
          description="Define and manage Stock Keeping Units (SKUs) for products in your warehouse. Set up product codes, descriptions, dimensions, weights, and packaging specifications. These definitions are used throughout the system for inventory tracking and invoicing."
          icon={Package2}
          iconColor="text-indigo-600"
          bgColor="bg-indigo-50"
          borderColor="border-indigo-200"
          textColor="text-indigo-800"
          actions={
            <div className="flex gap-2">
              <ImportButton 
                entityName="skus" 
                onImportComplete={fetchSkus}
              />
              <Link 
                href="/config/products/new"
                className="action-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add SKU
              </Link>
            </div>
          }
        />

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by SKU code, description, or ASIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Show inactive</span>
          </label>
        </div>

        {/* SKU Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ASIN
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units/Carton
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carton Weight
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pack Size
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">Loading SKUs...</p>
                  </td>
                </tr>
              ) : filteredSkus.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <EmptyState
                      icon={Package2}
                      title={searchTerm || showInactive ? "No SKUs match your criteria" : "No SKUs defined yet"}
                      description={searchTerm || showInactive 
                        ? "Try adjusting your search or filters to find what you're looking for."
                        : "Start by adding your first SKU to begin tracking inventory."}
                      action={!searchTerm && !showInactive ? {
                        label: "Add First SKU",
                        onClick: () => router.push('/config/products/new')
                      } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredSkus.map((sku) => (
                <tr key={sku.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sku.skuCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {sku.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sku.asin || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {sku.unitsPerCarton}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {sku.cartonWeightKg ? `${sku.cartonWeightKg} kg` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {sku.packSize}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={sku.isActive ? 'badge-success' : 'badge-secondary'}>
                      {sku.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEditSKU(sku.id)}
                        className="text-primary hover:text-primary/80"
                        title="Edit SKU"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(sku)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete SKU"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(sku)}
                        className="text-xs text-primary hover:underline"
                        title={sku.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {sku.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SKU Summary */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">SKU Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <Package2 className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-2xl font-bold">{filteredSkus.length}</p>
              <p className="text-sm text-gray-600">Total SKUs</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {filteredSkus.filter(s => s.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Active SKUs</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-600">
                {filteredSkus.filter(s => !s.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Inactive SKUs</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {filteredSkus.filter(s => s.asin).length}
              </p>
              <p className="text-sm text-gray-600">With ASIN</p>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {skuToDelete && (
          <ConfirmDialog
            isOpen={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false)
              setSkuToDelete(null)
            }}
            onConfirm={handleDeleteConfirm}
            title={`Delete SKU ${skuToDelete.skuCode}?`}
            message={
              Object.values(skuToDelete._count).some(count => count > 0)
                ? "This SKU has related data and will be deactivated instead of deleted. Continue?"
                : "Are you sure you want to delete this SKU? This action cannot be undone."
            }
            confirmText="Delete"
            type="danger"
          />
        )}
      </div>
    </DashboardLayout>
  )
}