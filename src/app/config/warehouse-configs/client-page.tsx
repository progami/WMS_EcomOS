'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building, Package2, Settings, AlertCircle, Edit, Plus } from '@/lib/lucide-icons'
import { PageHeader } from '@/components/ui/page-header'
import { ImportButton } from '@/components/ui/import-button'
import { useRouter } from 'next/navigation'

interface WarehouseConfig {
  id: string
  warehouseId: string
  skuId: string
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
  maxStackingHeightCm: number | null
  effectiveDate: string
  endDate: string | null
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
  createdBy: {
    fullName: string
    email: string
  }
}

interface WarehouseConfigsClientPageProps {
  configs: WarehouseConfig[]
  configsByWarehouse: Record<string, WarehouseConfig[]>
  stats: {
    totalConfigs: number
    activeConfigs: number
    uniqueSkus: number
    warehouses: number
  }
}

export default function WarehouseConfigsClientPage({ 
  configs, 
  configsByWarehouse, 
  stats 
}: WarehouseConfigsClientPageProps) {
  const router = useRouter()
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set())

  const toggleWarehouse = (warehouseName: string) => {
    const newExpanded = new Set(expandedWarehouses)
    if (newExpanded.has(warehouseName)) {
      newExpanded.delete(warehouseName)
    } else {
      newExpanded.add(warehouseName)
    }
    setExpandedWarehouses(newExpanded)
  }

  const handleImportComplete = () => {
    router.refresh()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString()
  }

  const isActive = (config: WarehouseConfig) => {
    return !config.endDate || new Date(config.endDate) > new Date()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse SKU Configurations"
        subtitle="Configure cartons per pallet for each warehouse and SKU"
        icon={Settings}
        iconColor="text-purple-600"
        bgColor="bg-purple-50"
        borderColor="border-purple-200"
        textColor="text-purple-800"
        actions={
          <div className="flex gap-2">
            <ImportButton 
              entityName="warehouseSkuConfigs" 
              onImportComplete={handleImportComplete}
            />
            <Link
              href="/config/warehouse-configs/new"
              className="action-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Configurations</p>
              <p className="text-2xl font-bold">{stats.totalConfigs}</p>
            </div>
            <Settings className="h-8 w-8 text-purple-600 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Configurations</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeConfigs}</p>
            </div>
            <Settings className="h-8 w-8 text-green-600 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Configured SKUs</p>
              <p className="text-2xl font-bold text-blue-600">{stats.uniqueSkus}</p>
            </div>
            <Package2 className="h-8 w-8 text-blue-600 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Warehouses</p>
              <p className="text-2xl font-bold text-teal-600">{stats.warehouses}</p>
            </div>
            <Building className="h-8 w-8 text-teal-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Important Configuration Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Storage cartons per pallet: Used for inbound palletization and storage calculations</li>
              <li>Shipping cartons per pallet: Used for outbound shipments and shipping calculations</li>
              <li>Configurations are date-effective - ensure no gaps in coverage for active SKUs</li>
              <li>Missing configurations will prevent proper pallet calculations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Configurations by Warehouse */}
      <div className="space-y-4">
        {Object.entries(configsByWarehouse).map(([warehouseName, warehouseConfigs]) => (
          <div key={warehouseName} className="bg-white rounded-lg border">
            <button
              onClick={() => toggleWarehouse(warehouseName)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-semibold">{warehouseName}</h3>
                <span className="text-sm text-gray-500">
                  ({warehouseConfigs.length} configurations)
                </span>
              </div>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  expandedWarehouses.has(warehouseName) ? 'transform rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            {expandedWarehouses.has(warehouseName) && (
              <div className="border-t">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Storage CPP
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipping CPP
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Height (cm)
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective Date
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {warehouseConfigs.map((config) => (
                      <tr key={config.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {config.sku.skuCode}
                            </p>
                            <p className="text-xs text-gray-500">
                              {config.sku.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {config.storageCartonsPerPallet}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {config.shippingCartonsPerPallet}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {config.maxStackingHeightCm || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {formatDate(config.effectiveDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={isActive(config) ? 'badge-success' : 'badge-secondary'}>
                            {isActive(config) ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/config/warehouse-configs/${config.id}/edit`}
                            className="text-primary hover:text-primary/80"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {configs.length === 0 && (
        <div className="text-center py-12">
          <Settings className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No configurations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first warehouse SKU configuration.
          </p>
          <div className="mt-6">
            <Link
              href="/config/warehouse-configs/new"
              className="action-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}