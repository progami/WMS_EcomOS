'use client'

import { MapPin, ExternalLink } from '@/lib/lucide-icons'

interface Warehouse {
  id: string
  code: string
  name: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface WarehouseMapSimpleProps {
  warehouses: Warehouse[]
  selectedWarehouseId?: string
}

export function WarehouseMapSimple({ 
  warehouses, 
  selectedWarehouseId
}: WarehouseMapSimpleProps) {
  const warehousesWithCoords = warehouses.filter(w => w.latitude && w.longitude)
  
  if (warehousesWithCoords.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">No warehouses available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {warehousesWithCoords.map((warehouse) => (
        <div
          key={warehouse.id}
          className={`border rounded-lg p-4 ${
            warehouse.id === selectedWarehouseId 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className={`h-5 w-5 ${
                  warehouse.id === selectedWarehouseId ? 'text-blue-600' : 'text-gray-600'
                }`} />
                <h4 className="font-semibold">{warehouse.name}</h4>
                <span className="text-sm text-gray-500">({warehouse.code})</span>
              </div>
              {warehouse.address && (
                <p className="text-sm text-gray-600 mt-1 ml-7">{warehouse.address}</p>
              )}
              <p className="text-xs text-gray-500 mt-1 ml-7">
                Coordinates: {warehouse.latitude?.toFixed(4)}, {warehouse.longitude?.toFixed(4)}
              </p>
            </div>
            <a
              href={`https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              View Map
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}