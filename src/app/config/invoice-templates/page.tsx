'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  Copy,
  DollarSign,
  Package,
  Truck,
  Settings
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'react-hot-toast'

interface InvoiceTemplate {
  id: string
  warehouseId: string
  warehouse: { name: string; code: string }
  name: string
  description: string
  transactionType: 'RECEIVE' | 'SHIP' | 'BOTH'
  costMappings: {
    [key: string]: {
      enabled: boolean
      category: string
      calculationType: 'PER_CARTON' | 'PER_PALLET' | 'PER_UNIT' | 'FLAT_RATE' | 'PERCENTAGE'
      customRate?: number
      description?: string
    }
  }
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

const defaultCostCategories = [
  { key: 'storage', name: 'Storage', defaultType: 'PER_PALLET' },
  { key: 'container', name: 'Container Unloading', defaultType: 'FLAT_RATE' },
  { key: 'pallet', name: 'Pallet Handling', defaultType: 'PER_PALLET' },
  { key: 'carton', name: 'Carton Handling', defaultType: 'PER_CARTON' },
  { key: 'unit', name: 'Pick & Pack', defaultType: 'PER_UNIT' },
  { key: 'shipment', name: 'Shipping/Freight', defaultType: 'FLAT_RATE' },
  { key: 'accessorial', name: 'Additional Services', defaultType: 'FLAT_RATE' },
  { key: 'documentation', name: 'Documentation Fee', defaultType: 'FLAT_RATE' },
  { key: 'labeling', name: 'Labeling Service', defaultType: 'PER_UNIT' },
  { key: 'repackaging', name: 'Repackaging', defaultType: 'PER_CARTON' },
  { key: 'inspection', name: 'Quality Inspection', defaultType: 'PERCENTAGE' },
  { key: 'customs', name: 'Customs Clearance', defaultType: 'FLAT_RATE' }
]

export default function InvoiceTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [warehouses, setWarehouses] = useState<{id: string; name: string; code: string}[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null)
  const [formData, setFormData] = useState({
    warehouseId: '',
    name: '',
    description: '',
    transactionType: 'BOTH' as 'RECEIVE' | 'SHIP' | 'BOTH',
    costMappings: {} as any,
    isDefault: false
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    if (session.user.role !== 'admin') {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch warehouses
      const warehouseRes = await fetch('/api/warehouses')
      if (warehouseRes.ok) {
        const warehouseData = await warehouseRes.json()
        setWarehouses(warehouseData)
      }

      // API endpoint removed - set empty data
      setTemplates([])
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (template?: InvoiceTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        warehouseId: template.warehouseId,
        name: template.name,
        description: template.description,
        transactionType: template.transactionType,
        costMappings: template.costMappings,
        isDefault: template.isDefault
      })
    } else {
      setEditingTemplate(null)
      const defaultMappings: any = {}
      defaultCostCategories.forEach(cat => {
        defaultMappings[cat.key] = {
          enabled: false,
          category: cat.name,
          calculationType: cat.defaultType,
          description: ''
        }
      })
      setFormData({
        warehouseId: '',
        name: '',
        description: '',
        transactionType: 'BOTH',
        costMappings: defaultMappings,
        isDefault: false
      })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.warehouseId || !formData.name) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      const url = editingTemplate 
        ? `/api/warehouse-configs/invoice-templates/${editingTemplate.id}`
        : '/api/warehouse-configs/invoice-templates'
      
      const method = editingTemplate ? 'PUT' : 'POST'

      // API endpoints removed
      toast.error('Save feature not available')
    } catch (error) {
      toast.error('Failed to save template')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      // API endpoint removed
      toast.error('Delete feature not available')
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  const handleCopy = async (template: InvoiceTemplate) => {
    const newTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      isDefault: false
    }
    delete (newTemplate as any).id
    delete (newTemplate as any).createdAt
    delete (newTemplate as any).updatedAt
    delete (newTemplate as any).warehouse

    try {
      // API endpoint removed
      toast.error('Copy feature not available')
    } catch (error) {
      toast.error('Failed to copy template')
    }
  }

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
          title="Invoice Templates"
          subtitle="Configure warehouse-specific billing strategies"
          icon={FileText}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
          textColor="text-purple-800"
          actions={
            <button
              onClick={() => handleOpenModal()}
              className="primary-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </button>
          }
        />

        {/* Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <p className="text-sm text-gray-600">{template.warehouse.name}</p>
                </div>
                {template.isDefault && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Default
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-500 mb-3">{template.description}</p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Transaction Type:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    template.transactionType === 'RECEIVE' ? 'bg-green-100 text-green-800' :
                    template.transactionType === 'SHIP' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {template.transactionType}
                  </span>
                </div>
                
                <div className="text-sm">
                  <span className="text-gray-500">Active Cost Types:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(template.costMappings)
                      .filter(([_, mapping]) => mapping.enabled)
                      .map(([key, mapping]) => (
                        <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {mapping.category}
                        </span>
                      ))
                    }
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleOpenModal(template)}
                  className="text-primary hover:text-primary-dark"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleCopy(template)}
                  className="text-gray-600 hover:text-gray-800"
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-800 ml-auto"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No invoice templates"
            description="Create your first invoice template to define warehouse-specific billing strategies."
            action={{
              label: 'Create Template',
              onClick: () => handleOpenModal()
            }}
          />
        )}
      </div>

      {/* Template Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingTemplate ? 'Edit Invoice Template' : 'Create Invoice Template'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Warehouse *</label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({...formData, warehouseId: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={!!editingTemplate}
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map(warehouse => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Standard FMC Billing"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Describe this billing template..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Transaction Type</label>
                    <select
                      value={formData.transactionType}
                      onChange={(e) => setFormData({...formData, transactionType: e.target.value as any})}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="BOTH">Both Receive & Ship</option>
                      <option value="RECEIVE">Receive Only</option>
                      <option value="SHIP">Ship Only</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">Set as default template</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Cost Type Configuration</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Enabled
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Cost Type
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Calculation Type
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Custom Rate
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {defaultCostCategories.map(category => {
                          const mapping = formData.costMappings[category.key] || {
                            enabled: false,
                            category: category.name,
                            calculationType: category.defaultType,
                            customRate: undefined,
                            description: ''
                          }

                          return (
                            <tr key={category.key}>
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={mapping.enabled}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      costMappings: {
                                        ...formData.costMappings,
                                        [category.key]: {
                                          ...mapping,
                                          enabled: e.target.checked
                                        }
                                      }
                                    })
                                  }}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">
                                {category.name}
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={mapping.calculationType}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      costMappings: {
                                        ...formData.costMappings,
                                        [category.key]: {
                                          ...mapping,
                                          calculationType: e.target.value as any
                                        }
                                      }
                                    })
                                  }}
                                  disabled={!mapping.enabled}
                                  className="text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  <option value="PER_CARTON">Per Carton</option>
                                  <option value="PER_PALLET">Per Pallet</option>
                                  <option value="PER_UNIT">Per Unit</option>
                                  <option value="FLAT_RATE">Flat Rate</option>
                                  <option value="PERCENTAGE">Percentage</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  value={mapping.customRate || ''}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      costMappings: {
                                        ...formData.costMappings,
                                        [category.key]: {
                                          ...mapping,
                                          customRate: e.target.value ? parseFloat(e.target.value) : undefined
                                        }
                                      }
                                    })
                                  }}
                                  disabled={!mapping.enabled}
                                  className="text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary w-24"
                                  placeholder="Optional"
                                  step="0.01"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={mapping.description || ''}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      costMappings: {
                                        ...formData.costMappings,
                                        [category.key]: {
                                          ...mapping,
                                          description: e.target.value
                                        }
                                      }
                                    })
                                  }}
                                  disabled={!mapping.enabled}
                                  className="text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary w-full"
                                  placeholder="Optional note"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="secondary-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="primary-button"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}