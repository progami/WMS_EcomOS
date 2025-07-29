'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Package, Info, Loader2 } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'

export default function EditSkuPage() {
  const router = useRouter()
  const params = useParams()
  const skuId = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    skuCode: '',
    asin: '',
    description: '',
    packSize: 1,
    material: '',
    unitDimensionsCm: '',
    unitWeightKg: '',
    unitsPerCarton: 1,
    cartonDimensionsCm: '',
    cartonWeightKg: '',
    packagingType: '',
    isActive: true
  })
  
  // Separate state for dimension inputs
  const [unitDimensions, setUnitDimensions] = useState({ length: '', width: '', height: '' })
  const [cartonDimensions, setCartonDimensions] = useState({ length: '', width: '', height: '' })
  const [errors, setErrors] = useState<any>({})

  useEffect(() => {
    fetchSku()
  }, [skuId])

  const fetchSku = async () => {
    try {
      const response = await fetch(`/api/skus/${skuId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch SKU')
      }
      
      const data = await response.json()
      
      // Parse dimensions from string format "LxWxH"
      const parseAndValidateDimensions = (dimString: string) => {
        if (!dimString) return { length: '', width: '', height: '' }
        const parts = dimString.split('x').map(s => s.trim())
        // Handle both "10x5x3" and "10 x 5 x 3" formats
        return {
          length: parts[0] || '',
          width: parts[1] || '',
          height: parts[2] || ''
        }
      }
      
      const parsedUnitDims = parseAndValidateDimensions(data.unitDimensionsCm)
      const parsedCartonDims = parseAndValidateDimensions(data.cartonDimensionsCm)
      
      setUnitDimensions(parsedUnitDims)
      setCartonDimensions(parsedCartonDims)
      
      setFormData({
        skuCode: data.skuCode || '',
        asin: data.asin || '',
        description: data.description || '',
        packSize: data.packSize || 1,
        material: data.material || '',
        unitDimensionsCm: data.unitDimensionsCm || '',
        unitWeightKg: data.unitWeightKg || '',
        unitsPerCarton: data.unitsPerCarton || 1,
        cartonDimensionsCm: data.cartonDimensionsCm || '',
        cartonWeightKg: data.cartonWeightKg || '',
        packagingType: data.packagingType || '',
        isActive: data.isActive !== false
      })
    } catch (error) {
      // console.error('Error fetching SKU:', error)
      alert('Failed to load SKU details')
      router.push('/config/products')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: any = {}

    if (!formData.skuCode.trim()) {
      newErrors.skuCode = 'SKU code is required'
    } else if (formData.skuCode.length > 50) {
      newErrors.skuCode = 'SKU code must be 50 characters or less'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (formData.packSize < 1) {
      newErrors.packSize = 'Pack size must be at least 1'
    }

    if (formData.unitsPerCarton < 1) {
      newErrors.unitsPerCarton = 'Units per carton must be at least 1'
    }

    if (formData.unitWeightKg && parseFloat(formData.unitWeightKg) <= 0) {
      newErrors.unitWeightKg = 'Weight must be positive'
    }

    if (formData.cartonWeightKg && parseFloat(formData.cartonWeightKg) <= 0) {
      newErrors.cartonWeightKg = 'Weight must be positive'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSaving(true)
    try {
      // Format dimensions back to string
      const formatDimensions = (dims: { length: string, width: string, height: string }) => {
        if (!dims.length && !dims.width && !dims.height) return null
        return `${dims.length || 0}x${dims.width || 0}x${dims.height || 0}`
      }
      
      const submitData = {
        ...formData,
        skuCode: formData.skuCode.toUpperCase(),
        packSize: parseInt(formData.packSize.toString()),
        unitsPerCarton: parseInt(formData.unitsPerCarton.toString()),
        unitWeightKg: formData.unitWeightKg ? parseFloat(formData.unitWeightKg) : null,
        cartonWeightKg: formData.cartonWeightKg ? parseFloat(formData.cartonWeightKg) : null,
        asin: formData.asin || null,
        material: formData.material || null,
        unitDimensionsCm: formatDimensions(unitDimensions),
        cartonDimensionsCm: formatDimensions(cartonDimensions),
        packagingType: formData.packagingType || null,
      }

      const response = await fetch(`/api/skus/${skuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update SKU')
      }

      alert('SKU updated successfully!')
      router.push('/config/products')
    } catch (error: any) {
      // console.error('Error updating SKU:', error)
      alert(error.message || 'Failed to update SKU')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading SKU details...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header with Description */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/config/products"
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Edit SKU</h1>
              <p className="text-muted-foreground mt-1">
                Update product specifications and details
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU Code *
                  <span className="text-xs text-gray-500 ml-1">(Unique identifier)</span>
                </label>
                <input
                  type="text"
                  value={formData.skuCode}
                  onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.skuCode ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., PROD-001"
                  maxLength={50}
                />
                {errors.skuCode && (
                  <p className="text-red-500 text-sm mt-1">{errors.skuCode}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ASIN
                  <span className="text-xs text-gray-500 ml-1">(Amazon Standard ID)</span>
                </label>
                <input
                  type="text"
                  value={formData.asin}
                  onChange={(e) => setFormData({ ...formData, asin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Amazon ASIN"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                  <span className="text-xs text-gray-500 ml-1">(Product name/description)</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.description ? 'border-red-500' : ''
                  }`}
                  placeholder="Product description"
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">{errors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pack Size *
                  <span className="text-xs text-gray-500 ml-1">(Units per pack)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.packSize}
                  onChange={(e) => setFormData({ ...formData, packSize: parseInt(e.target.value) || 1 })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.packSize ? 'border-red-500' : ''
                  }`}
                />
                {errors.packSize && (
                  <p className="text-red-500 text-sm mt-1">{errors.packSize}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material
                </label>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Plastic, Metal, Wood"
                />
              </div>
            </div>
          </div>

          {/* Unit Specifications */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Unit Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Dimensions (cm)
                  <span className="text-xs text-gray-500 ml-1">(L x W x H)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={unitDimensions.length}
                    onChange={(e) => setUnitDimensions({ ...unitDimensions, length: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Length"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={unitDimensions.width}
                    onChange={(e) => setUnitDimensions({ ...unitDimensions, width: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Width"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={unitDimensions.height}
                    onChange={(e) => setUnitDimensions({ ...unitDimensions, height: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Height"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.unitWeightKg}
                  onChange={(e) => setFormData({ ...formData, unitWeightKg: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.unitWeightKg ? 'border-red-500' : ''
                  }`}
                />
                {errors.unitWeightKg && (
                  <p className="text-red-500 text-sm mt-1">{errors.unitWeightKg}</p>
                )}
              </div>
            </div>
          </div>

          {/* Carton Specifications */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Carton Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Units per Carton *
                  <span className="text-xs text-gray-500 ml-1">(For warehouse operations)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.unitsPerCarton}
                  onChange={(e) => setFormData({ ...formData, unitsPerCarton: parseInt(e.target.value) || 1 })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.unitsPerCarton ? 'border-red-500' : ''
                  }`}
                />
                {errors.unitsPerCarton && (
                  <p className="text-red-500 text-sm mt-1">{errors.unitsPerCarton}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Packaging Type
                </label>
                <input
                  type="text"
                  value={formData.packagingType}
                  onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Box, Bag, Pallet"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carton Dimensions (cm)
                  <span className="text-xs text-gray-500 ml-1">(L x W x H)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={cartonDimensions.length}
                    onChange={(e) => setCartonDimensions({ ...cartonDimensions, length: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Length"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={cartonDimensions.width}
                    onChange={(e) => setCartonDimensions({ ...cartonDimensions, width: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Width"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={cartonDimensions.height}
                    onChange={(e) => setCartonDimensions({ ...cartonDimensions, height: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Height"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carton Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.cartonWeightKg}
                  onChange={(e) => setFormData({ ...formData, cartonWeightKg: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.cartonWeightKg ? 'border-red-500' : ''
                  }`}
                />
                {errors.cartonWeightKg && (
                  <p className="text-red-500 text-sm mt-1">{errors.cartonWeightKg}</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
            <div className="space-y-4">

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Active SKU (available for transactions)
                </label>
              </div>
            </div>
          </div>


          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/config/products"
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Package className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">SKU Update Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Changes will apply to future transactions only</li>
                <li>Historical data will retain the values at the time of transaction</li>
                <li>Update dimensions and weights for accurate shipping calculations</li>
                <li>Deactivate SKUs instead of deleting to preserve historical data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}