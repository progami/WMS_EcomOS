'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Building2, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'

interface Warehouse {
  id: string
  code: string
  name: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  contactEmail?: string
  contactPhone?: string
  isActive: boolean
}

export default function EditWarehousePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    contactEmail: '',
    contactPhone: '',
    isActive: true
  })
  const [errors, setErrors] = useState<any>({})

  useEffect(() => {
    fetchWarehouse()
  }, [params.id])

  const fetchWarehouse = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      
      const warehouses = await response.json()
      const warehouse = warehouses.find((w: Warehouse) => w.id === params.id)
      
      if (warehouse) {
        setWarehouse(warehouse)
        setFormData({
          code: warehouse.code,
          name: warehouse.name,
          address: warehouse.address || '',
          latitude: warehouse.latitude?.toString() || '',
          longitude: warehouse.longitude?.toString() || '',
          contactEmail: warehouse.contactEmail || '',
          contactPhone: warehouse.contactPhone || '',
          isActive: warehouse.isActive
        })
      } else {
        alert('Warehouse not found')
        router.push('/config/warehouses')
      }
    } catch (error) {
      // console.error('Error fetching warehouse:', error)
      alert('Failed to load warehouse')
      router.push('/admin/settings/warehouses')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: any = {}

    if (!formData.code.trim()) {
      newErrors.code = 'Warehouse code is required'
    } else if (formData.code.length > 10) {
      newErrors.code = 'Code must be 10 characters or less'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Warehouse name is required'
    }

    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email format'
    }

    if (formData.latitude && (isNaN(Number(formData.latitude)) || Number(formData.latitude) < -90 || Number(formData.latitude) > 90)) {
      newErrors.latitude = 'Latitude must be between -90 and 90'
    }

    if (formData.longitude && (isNaN(Number(formData.longitude)) || Number(formData.longitude) < -180 || Number(formData.longitude) > 180)) {
      newErrors.longitude = 'Longitude must be between -180 and 180'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSaving(true)
    try {
      const updateData: any = {
        name: formData.name,
        address: formData.address || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        contactEmail: formData.contactEmail || null,
        contactPhone: formData.contactPhone || null,
        isActive: formData.isActive
      }

      // Only update code if it changed
      if (formData.code !== warehouse?.code) {
        updateData.code = formData.code.toUpperCase()
      }

      const response = await fetch(`/api/warehouses?id=${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update warehouse')
      }

      alert('Warehouse updated successfully!')
      router.push('/config/warehouses')
    } catch (error: any) {
      // console.error('Error updating warehouse:', error)
      alert(error.message || 'Failed to update warehouse')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !warehouse) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/config/warehouses"
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Warehouse</h1>
            <p className="text-muted-foreground">
              Update warehouse information
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.code ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., FMC, VG001"
                  maxLength={10}
                />
                {errors.code && (
                  <p className="text-red-500 text-sm mt-1">{errors.code}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Unique identifier, max 10 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., Fulfillment Center Miami"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Full warehouse address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.contactEmail ? 'border-red-500' : ''
                  }`}
                  placeholder="warehouse@example.com"
                />
                {errors.contactEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.contactEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.latitude ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., 51.5074"
                />
                {errors.latitude && (
                  <p className="text-red-500 text-sm mt-1">{errors.latitude}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Optional: For map display</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.longitude ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., -0.1278"
                />
                {errors.longitude && (
                  <p className="text-red-500 text-sm mt-1">{errors.longitude}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Optional: For map display</p>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Active warehouse (can receive transactions)
              </label>
            </div>

            {formData.code !== warehouse.code && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> Changing the warehouse code may affect existing references and reports.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t">
            <Link
              href="/admin/settings/warehouses"
              className="secondary-button"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="action-button"
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </DashboardLayout>
  )
}