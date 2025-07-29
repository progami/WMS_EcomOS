'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Building, Save, X, Calendar } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'

interface WarehouseConfig {
  id: string
  warehouseId: string
  skuId: string
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
  maxStackingHeightCm?: number
  effectiveDate: string
  endDate?: string
  warehouse: {
    id: string
    name: string
    code: string
  }
  sku: {
    id: string
    skuCode: string
    description: string
  }
}

export default function EditWarehouseConfigPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<WarehouseConfig | null>(null)
  
  const [formData, setFormData] = useState({
    storageCartonsPerPallet: '',
    shippingCartonsPerPallet: '',
    maxStackingHeightCm: '',
    endDate: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.push('/auth/login')
      return
    }
    fetchConfig()
  }, [session, status, router, params.id])

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/warehouse-configs/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setFormData({
          storageCartonsPerPallet: data.storageCartonsPerPallet.toString(),
          shippingCartonsPerPallet: data.shippingCartonsPerPallet.toString(),
          maxStackingHeightCm: data.maxStackingHeightCm?.toString() || '',
          endDate: data.endDate ? data.endDate.split('T')[0] : ''
        })
      } else {
        toast.error('Configuration not found')
        router.push('/config/warehouse-configs')
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      router.push('/admin/settings/warehouse-configs')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storageCartonsPerPallet || !formData.shippingCartonsPerPallet) {
      toast.error('Please enter cartons per pallet values')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse-configs/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageCartonsPerPallet: parseInt(formData.storageCartonsPerPallet),
          shippingCartonsPerPallet: parseInt(formData.shippingCartonsPerPallet),
          maxStackingHeightCm: formData.maxStackingHeightCm ? parseInt(formData.maxStackingHeightCm) : null,
          endDate: formData.endDate ? new Date(formData.endDate) : null
        })
      })

      if (response.ok) {
        toast.success('Configuration updated successfully')
        router.push('/config/warehouse-configs')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update configuration')
      }
    } catch (error) {
      toast.error('Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/settings/warehouse-configs')
  }

  if (loading || !config) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Edit Warehouse Configuration"
          subtitle={`${config.warehouse.name} - ${config.sku.skuCode}`}
          icon={Building}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
          textColor="text-purple-800"
        />

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
          {/* Read-only Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Configuration Details</h3>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <span className="text-gray-600">Warehouse:</span>
                <p className="font-medium">{config.warehouse.name} ({config.warehouse.code})</p>
              </div>
              <div>
                <span className="text-gray-600">SKU:</span>
                <p className="font-medium">{config.sku.skuCode} - {config.sku.description}</p>
              </div>
              <div>
                <span className="text-gray-600">Effective Date:</span>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(config.effectiveDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={config.effectiveDate.split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: When this configuration should end
              </p>
            </div>
          </div>


          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2 inline" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2 inline" />
              {saving ? 'Updating...' : 'Update Configuration'}
            </button>
          </div>
        </form>

        {/* Warning Section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>Changes will affect all future calculations from the effective date</li>
            <li>Historical calculations will not be affected</li>
            <li>To change warehouse or SKU, end this configuration and create a new one</li>
            <li>Setting an end date will deactivate this configuration after that date</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}