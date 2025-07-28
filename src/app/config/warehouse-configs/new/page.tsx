'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Building, Save, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Warehouse {
  id: string
  name: string
  code: string
}

interface Sku {
  id: string
  skuCode: string
  description: string
}

export default function NewWarehouseConfigPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  
  const [formData, setFormData] = useState({
    warehouseId: '',
    skuId: '',
    storageCartonsPerPallet: '',
    shippingCartonsPerPallet: '',
    maxStackingHeightCm: '',
    effectiveDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.push('/auth/login')
      return
    }
    fetchData()
  }, [session, status, router])

  const fetchData = async () => {
    try {
      // Fetch warehouses
      const warehouseRes = await fetch('/api/warehouses')
      if (warehouseRes.ok) {
        const warehouseData = await warehouseRes.json()
        setWarehouses(warehouseData)
      }

      // Fetch SKUs
      const skuRes = await fetch('/api/skus')
      if (skuRes.ok) {
        const skuData = await skuRes.json()
        setSkus(skuData)
      }
    } catch (error) {
      toast.error('Failed to load data')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.warehouseId || !formData.skuId) {
      toast.error('Please select warehouse and SKU')
      return
    }

    if (!formData.storageCartonsPerPallet || !formData.shippingCartonsPerPallet) {
      toast.error('Please enter cartons per pallet values')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/warehouse-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: formData.warehouseId,
          skuId: formData.skuId,
          storageCartonsPerPallet: parseInt(formData.storageCartonsPerPallet),
          shippingCartonsPerPallet: parseInt(formData.shippingCartonsPerPallet),
          maxStackingHeightCm: formData.maxStackingHeightCm ? parseInt(formData.maxStackingHeightCm) : null,
          effectiveDate: new Date(formData.effectiveDate)
        })
      })

      if (response.ok) {
        toast.success('Configuration created successfully')
        router.push('/config/warehouse-configs')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create configuration')
      }
    } catch (error) {
      toast.error('Failed to create configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/settings/warehouse-configs')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Warehouse Configuration"
          subtitle="Set cartons per pallet for a SKU"
          icon={Building}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
          textColor="text-purple-800"
        />

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Warehouse Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>

            {/* SKU Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.skuId}
                onChange={(e) => setFormData({ ...formData, skuId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select SKU</option>
                {skus.map(sku => (
                  <option key={sku.id} value={sku.id}>
                    {sku.skuCode} - {sku.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Storage Cartons per Pallet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Cartons per Pallet <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={formData.storageCartonsPerPallet}
                onChange={(e) => setFormData({ ...formData, storageCartonsPerPallet: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 48"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for calculating storage charges (max: 200)
              </p>
            </div>

            {/* Shipping Cartons per Pallet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipping Cartons per Pallet <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={formData.shippingCartonsPerPallet}
                onChange={(e) => setFormData({ ...formData, shippingCartonsPerPallet: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 40"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Used when shipping goods (may differ from storage)
              </p>
            </div>

            {/* Max Stacking Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Stacking Height (cm)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={formData.maxStackingHeightCm}
                onChange={(e) => setFormData({ ...formData, maxStackingHeightCm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 180"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Maximum height when stacked
              </p>
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                When this configuration becomes active
              </p>
            </div>
          </div>


          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2 inline" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2 inline" />
              {loading ? 'Creating...' : 'Create Configuration'}
            </button>
          </div>
        </form>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Important Information</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Cartons per pallet values directly impact billing calculations</li>
            <li>Storage configuration is used for storage charges (weekly for standard warehouses, monthly for Amazon)</li>
            <li>Shipping configuration is used when goods are shipped out</li>
            <li>Values should reflect actual physical constraints</li>
            <li>Changes take effect from the specified date forward</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}