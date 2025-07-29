'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Package } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'

export default function NewSkuPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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

    setLoading(true)
    try {
      // Format dimensions back to string
      const formatDimensions = (dims: { length: string, width: string, height: string }) => {
        if (!dims.length && !dims.width && !dims.height) return undefined
        return `${dims.length || 0}x${dims.width || 0}x${dims.height || 0}`
      }
      
      const submitData = {
        ...formData,
        skuCode: formData.skuCode.toUpperCase(),
        packSize: parseInt(formData.packSize.toString()),
        unitsPerCarton: parseInt(formData.unitsPerCarton.toString()),
        unitWeightKg: formData.unitWeightKg ? parseFloat(formData.unitWeightKg) : undefined,
        cartonWeightKg: formData.cartonWeightKg ? parseFloat(formData.cartonWeightKg) : undefined,
        asin: formData.asin || undefined,
        material: formData.material || undefined,
        unitDimensionsCm: formatDimensions(unitDimensions),
        cartonDimensionsCm: formatDimensions(cartonDimensions),
        packagingType: formData.packagingType || undefined
      }

      const response = await fetch('/api/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create SKU')
      }

      alert('SKU created successfully!')
      router.push('/config/products')
    } catch (error: any) {
      // console.error('Error creating SKU:', error)
      alert(error.message || 'Failed to create SKU')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/config/products"
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create New SKU</h1>
            <p className="text-muted-foreground">
              Add a new product SKU to the system
            </p>
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
              disabled={loading}
              className="action-button"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create SKU
                </>
              )}
            </button>
          </div>
        </form>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Package className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">SKU Setup Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a consistent naming convention for SKU codes</li>
                <li>Include accurate dimensions and weights for shipping calculations</li>
                <li>Pack size refers to the selling unit quantity</li>
                <li>Units per carton is used for warehouse operations</li>
                <li>You can update these details later as needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}