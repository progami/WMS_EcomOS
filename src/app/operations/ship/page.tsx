'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, Plus, Save, X, AlertTriangle, Upload, FileText, Mail, Check } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'

interface Sku {
  id: string
  skuCode: string
  description: string
  unitsPerCarton: number
}

interface InventoryItem {
  id: string
  sku: {
    id: string
    skuCode: string
    description: string
    unitsPerCarton: number
  }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
}

interface ShipItem {
  id: number
  skuCode: string
  batchLot: string
  cartons: number
  shippingPalletsOut: number
  units: number
  available: number
  shippingCartonsPerPallet?: number | null
  unitsPerCarton?: number
}

interface Attachment {
  name: string
  type: string
  size: number
  data?: string
  category: 'proof_of_pickup' | 'other'
}

export default function WarehouseShipPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [skus, setSkus] = useState<Sku[]>([])
  const [skuLoading, setSkuLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<{id: string; name: string; code: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [items, setItems] = useState<ShipItem[]>([
    { id: 1, skuCode: '', batchLot: '', cartons: 0, shippingPalletsOut: 0, units: 0, available: 0 }
  ])
  const [lastCarrier, setLastCarrier] = useState<string>('')
  const [proofOfPickupAttachment, setProofOfPickupAttachment] = useState<Attachment | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [lastShipmentData, setLastShipmentData] = useState<any>(null)

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), skuCode: '', batchLot: '', cartons: 0, shippingPalletsOut: 0, units: 0, available: 0 }
    ])
  }

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: Attachment['category']) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name} is too large. Maximum size is 5MB.`)
      return
    }
    
    // Convert to base64
    const reader = new FileReader()
    reader.onload = () => {
      const attachment: Attachment = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string,
        category
      }
      
      // Update specific attachment state
      if (category === 'proof_of_pickup') {
        setProofOfPickupAttachment(attachment)
      } else {
        setAttachments([...attachments, attachment])
      }
      
      toast.success(`${category === 'proof_of_pickup' ? 'Proof of Pickup' : 'Document'} uploaded`)
    }
    reader.readAsDataURL(file)
  }

  const removeProofOfPickupAttachment = () => {
    setProofOfPickupAttachment(null)
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        
        // Update availability and batch config when SKU or batch changes
        if ((field === 'skuCode' || field === 'batchLot') && updated.skuCode && updated.batchLot) {
          const inventoryItem = Array.isArray(inventory) ? inventory.find(inv => 
            inv.sku.skuCode === updated.skuCode && inv.batchLot === updated.batchLot
          ) : undefined
          if (inventoryItem) {
            updated.available = inventoryItem.currentCartons
            updated.shippingCartonsPerPallet = inventoryItem.shippingCartonsPerPallet
            updated.unitsPerCarton = inventoryItem.sku.unitsPerCarton
            // Calculate pallets based on batch-specific config
            if (updated.cartons > 0 && updated.shippingCartonsPerPallet) {
              const calculated = Math.ceil(updated.cartons / updated.shippingCartonsPerPallet)
              updated.shippingPalletsOut = calculated // Auto-set initially
            }
          } else {
            updated.available = 0
            updated.shippingCartonsPerPallet = null
            updated.unitsPerCarton = undefined
          }
        }
        
        // If SKU changed, update units based on unitsPerCarton and reset batch
        if (field === 'skuCode' && value) {
          const selectedSku = skus.find(sku => sku.skuCode === value)
          if (selectedSku && updated.cartons) {
            updated.units = updated.cartons * selectedSku.unitsPerCarton
            updated.unitsPerCarton = selectedSku.unitsPerCarton
          }
          // Clear batch lot when SKU changes
          updated.batchLot = ''
          updated.available = 0
          updated.shippingCartonsPerPallet = null
        }
        
        // Update cartons and recalculate pallets and units
        if (field === 'cartons') {
          updated.cartons = updated.available > 0 ? Math.min(value, updated.available) : value
          
          // Update units based on cartons
          if (updated.unitsPerCarton) {
            updated.units = updated.cartons * updated.unitsPerCarton
          }
          
          // Auto-calculate pallets based on batch-specific config
          if (updated.shippingCartonsPerPallet && updated.shippingCartonsPerPallet > 0) {
            const calculated = Math.ceil(updated.cartons / updated.shippingCartonsPerPallet)
            updated.shippingPalletsOut = calculated
          }
        }
        
        return updated
      }
      return item
    }))
  }

  useEffect(() => {
    fetchSkus()
    fetchWarehouses()
    fetchLastShipmentData()
    checkForShipmentPlan()
  }, [])

  const checkForShipmentPlan = () => {
    // Check if there's a shipment plan from the planning page
    const planData = sessionStorage.getItem('shipmentPlan')
    if (planData) {
      try {
        const plan = JSON.parse(planData)
        if (plan.source === 'fba-planning' && plan.items) {
          // Show a notification
          toast.success('Shipment plan loaded from FBA planning')
          
          // Pre-populate items after SKUs are loaded
          setTimeout(() => {
            const newItems = plan.items.map((planItem: any, index: number) => ({
              id: Date.now() + index,
              skuCode: planItem.skuCode,
              batchLot: '', // Will need to be selected
              cartons: planItem.suggestedCartons,
              shippingPalletsOut: 0,
              units: 0,
              available: 0
            }))
            setItems(newItems)
          }, 1000)
          
          // Clear the session storage
          sessionStorage.removeItem('shipmentPlan')
        }
      } catch (error) {
      }
    }
  }

  const fetchLastShipmentData = async () => {
    try {
      const response = await fetch('/api/transactions/ledger?transactionType=SHIP&limit=1')
      if (response.ok) {
        const data = await response.json()
        if (data.transactions && data.transactions.length > 0) {
          const lastShipment = data.transactions[0]
          // Extract carrier from notes if available
          const carrierMatch = lastShipment.notes?.match(/Carrier: ([^.]+)/)
          if (carrierMatch) {
            setLastCarrier(carrierMatch[1].trim())
          }
        }
      }
    } catch (error) {
    }
  }

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchInventory(selectedWarehouseId)
    } else {
      setInventory([])
    }
  }, [selectedWarehouseId])

  const fetchSkus = async () => {
    try {
      setSkuLoading(true)
      const response = await fetch('/api/skus')
      if (response.ok) {
        const data = await response.json()
        setSkus(data.filter((sku: any) => sku.isActive !== false))
      }
    } catch (error) {
      toast.error('Failed to load SKUs')
    } finally {
      setSkuLoading(false)
    }
  }

  const fetchInventory = async (warehouseId?: string) => {
    try {
      // Fetch directly from transaction ledger and calculate
      const url = warehouseId 
        ? `/api/transactions/ledger?warehouseId=${warehouseId}&limit=10000`
        : `/api/transactions/ledger?limit=10000`
      
      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        const transactions = result.transactions || []
        
        // Calculate balances from transactions
        const balanceMap = new Map<string, any>()
        
        for (const tx of transactions) {
          const key = `${tx.skuId}-${tx.batchLot}`
          
          const current = balanceMap.get(key) || {
            id: key,
            skuId: tx.skuId,
            batchLot: tx.batchLot,
            currentCartons: 0,
            currentUnits: 0,
            sku: tx.sku,
            warehouse: tx.warehouse,
            warehouseId: tx.warehouseId,
            shippingCartonsPerPallet: null,
            storageCartonsPerPallet: null
          }
          
          // Update quantities
          current.currentCartons += tx.cartonsIn - tx.cartonsOut
          current.currentUnits = current.currentCartons * (tx.sku?.unitsPerCarton || 1)
          
          // Capture pallet config from RECEIVE transactions
          if (tx.transactionType === 'RECEIVE') {
            if (tx.shippingCartonsPerPallet) current.shippingCartonsPerPallet = tx.shippingCartonsPerPallet
            if (tx.storageCartonsPerPallet) current.storageCartonsPerPallet = tx.storageCartonsPerPallet
          }
          
          balanceMap.set(key, current)
        }
        
        // Convert to array and filter negative balances
        const allInventory = Array.from(balanceMap.values()).filter(item => item.currentCartons >= 0)
        
        setInventory(allInventory)
      } else {
        setInventory([])
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
      setInventory([])
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data)
        // Auto-select user's warehouse if available
        if (session?.user.warehouseId) {
          setSelectedWarehouseId(session.user.warehouseId)
        }
      }
    } catch (error) {
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const formData = new FormData(e.target as HTMLFormElement)
    const shipDate = formData.get('shipDate') as string
    
    // Validate date is not in future
    const shipDateObj = new Date(shipDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    if (shipDateObj > today) {
      toast.error('Ship date cannot be in the future')
      return
    }
    
    // Validate date is not too old (5 years for historical data)
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    if (shipDateObj < fiveYearsAgo) {
      toast.error('Ship date is too far in the past (max 5 years)')
      return
    }
    
    // Validate items
    const validItems = items.filter(item => item.skuCode && item.cartons > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity')
      return
    }
    
    // Check for duplicate SKU/batch combinations
    const seen = new Set()
    for (const item of validItems) {
      const key = `${item.skuCode}-${item.batchLot}`
      if (seen.has(key)) {
        toast.error(`Duplicate SKU/Batch combination: ${item.skuCode} - ${item.batchLot}`)
        return
      }
      seen.add(key)
    }
    
    // Validate all numeric values are integers
    for (const item of validItems) {
      if (!Number.isInteger(item.cartons) || item.cartons <= 0 || item.cartons > 99999) {
        toast.error(`Invalid cartons value for SKU ${item.skuCode}. Must be between 1 and 99,999`)
        return
      }
      if (item.shippingPalletsOut && (!Number.isInteger(item.shippingPalletsOut) || item.shippingPalletsOut < 0 || item.shippingPalletsOut > 9999)) {
        toast.error(`Invalid shipping pallets value for SKU ${item.skuCode}. Must be between 0 and 9,999`)
        return
      }
      if (item.units && (!Number.isInteger(item.units) || item.units < 0)) {
        toast.error(`Invalid units value for SKU ${item.skuCode}. Must be non-negative`)
        return
      }
    }
    
    // Real-time inventory check before submission
    setLoading(true)
    toast('Verifying current inventory levels...', { icon: 'ℹ️' })
    
    try {
      // Re-fetch current inventory for final validation
      const inventoryResponse = await fetch(
        `/api/inventory/balances?warehouseId=${selectedWarehouseId}`
      )
      
      if (!inventoryResponse.ok) {
        toast.error('Failed to verify inventory. Please try again.')
        setLoading(false)
        return
      }
      
      const inventoryResult = await inventoryResponse.json()
      const currentInventory = inventoryResult.data || inventoryResult || []
      
      // Check each item against real-time inventory
      const inventoryIssues: string[] = []
      for (const item of validItems) {
        const currentStock = currentInventory.find((inv: any) => 
          inv.sku.skuCode === item.skuCode && inv.batchLot === item.batchLot
        )
        
        if (!currentStock) {
          inventoryIssues.push(`SKU ${item.skuCode} batch ${item.batchLot} no longer exists`)
        } else if (currentStock.currentCartons < item.cartons) {
          inventoryIssues.push(
            `Insufficient inventory for SKU ${item.skuCode} batch ${item.batchLot}: ` +
            `Available: ${currentStock.currentCartons}, Requested: ${item.cartons}`
          )
        }
      }
      
      if (inventoryIssues.length > 0) {
        toast.error('Inventory validation failed')
        inventoryIssues.forEach(issue => toast.error(issue))
        setLoading(false)
        return
      }
    } catch (error) {
      toast.error('Failed to verify inventory. Please check your connection.')
      setLoading(false)
      return
    }
    
    const referenceNumber = formData.get('orderNumber') as string
    const date = shipDate
    const pickupDate = formData.get('pickupDate') as string
    const sourceWarehouseId = formData.get('sourceWarehouse') as string
    const carrier = formData.get('carrier') as string
    const trackingNumber = formData.get('trackingNumber') as string
    const modeOfTransportation = formData.get('modeOfTransportation') as string
    const notes = formData.get('notes') as string
    
    // Get source warehouse name
    const sourceWarehouse = warehouses.find(w => w.id === sourceWarehouseId)
    
    // Combine all attachments
    const allAttachments: Attachment[] = []
    if (proofOfPickupAttachment) allAttachments.push(proofOfPickupAttachment)
    allAttachments.push(...attachments)
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SHIP',
          referenceNumber,
          date,
          pickupDate,
          items: validItems,
          notes: `Source: ${sourceWarehouse?.name || 'Unknown'}. Carrier: ${carrier}. Mode: ${modeOfTransportation}. Total Cartons: ${items.reduce((sum, item) => sum + item.cartons, 0)}. ${notes}`,
          warehouseId: sourceWarehouseId || session?.user.warehouseId,
          modeOfTransportation,
          trackingNumber: trackingNumber,
          attachments: allAttachments.length > 0 ? allAttachments : null,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Shipment saved successfully! ${data.message}`)
        
        // Store shipment data for email
        const shipmentData = {
          orderNumber: referenceNumber,
          trackingNumber: trackingNumber,
          shipDate: date,
          carrier,
          modeOfTransportation,
          warehouse: sourceWarehouse,
          items: validItems.map(item => {
            const sku = skus.find(s => s.skuCode === item.skuCode)
            return {
              ...item,
              description: sku?.description || ''
            }
          }),
          totalCartons: items.reduce((sum, item) => sum + item.cartons, 0),
          totalPallets: items.reduce((sum, item) => sum + item.shippingPalletsOut, 0),
          notes
        }
        setLastShipmentData(shipmentData)
        setShowEmailModal(true)
      } else {
        // Display specific error message from backend
        if (data.error) {
          toast.error(data.error)
        } else {
          toast.error('Failed to save shipment')
        }
        
        // Show additional details if available
        if (data.details) {
          if (typeof data.details === 'string') {
            toast.error(data.details)
          } else if (data.details.message) {
            toast.error(data.details.message)
          }
        }
      }
    } catch (error) {
      // Display network or unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to save shipment: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ship Goods</h1>
            <p className="text-muted-foreground">
              Process outbound shipments
            </p>
          </div>
          <button
            onClick={() => router.push('/operations/inventory')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Shipment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference ID
                  <span className="ml-1 text-xs text-gray-500">(Order Number)</span>
                </label>
                <input
                  type="text"
                  name="orderNumber"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., SO-2024-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Warehouse
                </label>
                <select
                  name="sourceWarehouse"
                  value={selectedWarehouseId}
                  onChange={(e) => {
                    setSelectedWarehouseId(e.target.value)
                    // Reset only batch-related fields when warehouse changes, preserve SKUs
                    setItems(items.map(item => ({
                      ...item,
                      batchLot: '', // Clear batch since it's warehouse-specific
                      available: 0, // Reset availability
                      shippingCartonsPerPallet: null
                    })))
                  }}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ship Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="shipDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  max={new Date().toISOString().slice(0, 16)}
                  min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="pickupDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  max={new Date().toISOString().slice(0, 16)}
                  min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier
                </label>
                <select
                  name="carrier"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  defaultValue={lastCarrier}
                >
                  <option value="">Select Carrier...</option>
                  <option value="Amazon Partnered Carrier UPS">Amazon Partnered Carrier UPS</option>
                  <option value="Amazon Freight">Amazon Freight</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="USPS">USPS</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode of Transportation
                </label>
                <select
                  name="modeOfTransportation"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select Mode...</option>
                  <option value="SPD">SPD - Small Parcel Delivery</option>
                  <option value="LTL">LTL - Less Than Truckload</option>
                  <option value="FTL">FTL - Full Truckload</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-1">
                    Tracking Number
                    <Tooltip 
                      content="FBA shipment ID for Amazon shipments" 
                      iconSize="sm"
                    />
                  </div>
                </label>
                <input
                  type="text"
                  name="trackingNumber"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., FBA15K7TRCBF"
                  required
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Items to Ship</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch/Lot
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cartons to Ship
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-1">
                        Units/Carton
                        <Tooltip 
                          content="From SKU master data" 
                          iconSize="sm"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Config
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Pallets
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 w-48">
                        <select
                          value={item.skuCode}
                          onChange={(e) => updateItem(item.id, 'skuCode', e.target.value)}
                          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                          disabled={skuLoading}
                        >
                          <option value="">Select SKU...</option>
                          {skus.map((sku) => (
                            <option key={sku.id} value={sku.skuCode}>
                              {sku.skuCode}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <select
                          value={item.batchLot}
                          onChange={(e) => updateItem(item.id, 'batchLot', e.target.value)}
                          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                          disabled={!item.skuCode}
                        >
                          <option value="">
                            {!item.skuCode ? "Select SKU first..." : "Select Batch..."}
                          </option>
                          {item.skuCode && Array.isArray(inventory) && inventory
                            .filter(inv => inv.sku.skuCode === item.skuCode)
                            .sort((a, b) => {
                              // First sort by availability (available first), then by quantity
                              if (a.currentCartons > 0 && b.currentCartons === 0) return -1
                              if (a.currentCartons === 0 && b.currentCartons > 0) return 1
                              return b.currentCartons - a.currentCartons
                            })
                            .map((inv) => (
                              <option 
                                key={`${inv.id}-${inv.batchLot}`} 
                                value={inv.batchLot}
                                className={inv.currentCartons === 0 ? 'text-red-500' : inv.currentCartons < 10 ? 'text-orange-600' : ''}
                                disabled={inv.currentCartons === 0}
                              >
                                {inv.batchLot} ({inv.currentCartons} cartons{inv.currentCartons === 0 ? ' - OUT OF STOCK' : inv.currentCartons < 10 ? ' - Low Stock' : ''})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 w-28 text-right">
                        {item.available > 0 ? (
                          <span className={item.cartons > item.available ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {item.available}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.cartons}
                          onChange={(e) => updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            // Prevent decimal point and negative sign
                            if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault()
                            }
                          }}
                          className={`w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                            item.cartons > item.available ? 'border-red-500 bg-red-50' : ''
                          }`}
                          min="0"
                          max={item.available}
                          step="1"
                          required
                        />
                        {item.cartons > item.available && (
                          <p className="text-xs text-red-600 mt-1">Exceeds available</p>
                        )}
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.unitsPerCarton || ''}
                          className="w-full px-2 py-1 border rounded text-right bg-gray-100 cursor-not-allowed"
                          readOnly
                          title="Units per carton is defined by the SKU master data"
                        />
                      </td>
                      <td className="px-4 py-3 w-32 text-center">
                        {item.shippingCartonsPerPallet ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-medium">{item.shippingCartonsPerPallet}</span>
                            <span className="text-xs text-gray-500">c/p</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.shippingPalletsOut}
                          onChange={(e) => {
                            const newPallets = parseInt(e.target.value) || 0
                            updateItem(item.id, 'shippingPalletsOut', newPallets)
                          }}
                          onKeyDown={(e) => {
                            // Prevent decimal point and negative sign
                            if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault()
                            }
                          }}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          min="0"
                          step="1"
                          placeholder={item.cartons > 0 && item.shippingCartonsPerPallet ? `${Math.ceil(item.cartons / item.shippingCartonsPerPallet)}` : ''}
                          title="Shipping pallets (auto-calculated, but can be overridden)"
                        />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.units}
                          className="w-full px-2 py-1 border rounded text-right bg-gray-100"
                          min="0"
                          readOnly
                          title="Units are calculated based on cartons × units per carton"
                        />
                      </td>
                      <td className="px-4 py-3 w-12">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={items.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      Total:
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.cartons, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.shippingPalletsOut, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.units, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Shipping Notes</h3>
            <textarea
              name="notes"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Any special instructions or notes..."
            />
          </div>

          {/* Attachments */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Required Documents</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload proof of pickup document (Max 5MB per file)
            </p>
            
            <div className="space-y-6">
              {/* Proof of Pickup */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Proof of Pickup</h4>
                    <p className="text-xs text-gray-600">Document confirming carrier pickup (BOL, pickup receipt, etc.)</p>
                  </div>
                  {proofOfPickupAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {proofOfPickupAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{proofOfPickupAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(proofOfPickupAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeProofOfPickupAttachment}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Click to upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'proof_of_pickup')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Other Attachments */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Additional Documents (Optional)</h4>
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-600">Click to upload additional documents</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, DOC, DOCX, XLS, XLSX</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        const files = e.target.files
                        if (files) {
                          Array.from(files).forEach(file => {
                            const event = new Event('change') as any
                            event.target = { files: [file] }
                            handleFileUpload(event as React.ChangeEvent<HTMLInputElement>, 'other')
                          })
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  
                  {attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-700">{file.name}</span>
                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/operations/inventory')}
              className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Process Shipment
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Email Modal */}
      {showEmailModal && lastShipmentData && (
        <EmailModal 
          shipmentData={lastShipmentData}
          onClose={() => {
            setShowEmailModal(false)
            router.push('/operations/inventory')
          }}
        />
      )}
    </DashboardLayout>
  )
}

// Email Modal Component
function EmailModal({ shipmentData, onClose }: { shipmentData: any; onClose: () => void }) {
  const [emailContent, setEmailContent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateEmail()
  }, [])

  const generateEmail = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inventory/shipments/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmailContent(data.email)
      } else {
        toast.error('Failed to generate email')
      }
    } catch (error) {
      toast.error('Error generating email')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  const openEmailClient = () => {
    if (!emailContent) return
    
    const mailtoLink = `mailto:${emailContent.to}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`
    window.open(mailtoLink, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Send Shipment Email
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            ) : emailContent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={emailContent.to}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-md bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(emailContent.to)}
                      className="px-3 py-2 border rounded-md hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={emailContent.subject}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-md bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(emailContent.subject)}
                      className="px-3 py-2 border rounded-md hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                  <div className="relative">
                    <textarea
                      value={emailContent.body}
                      readOnly
                      rows={12}
                      className="w-full px-3 py-2 border rounded-md bg-gray-50 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(emailContent.body)}
                      className="absolute top-2 right-2 px-3 py-1 bg-white border rounded-md hover:bg-gray-50"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>References stored:</strong> Order #{emailContent.references.orderNumber} | 
                    FBA: {emailContent.references.trackingNumber}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={openEmailClient}
              className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 sm:ml-3 sm:w-auto"
            >
              <Mail className="h-4 w-4 mr-2" />
              Open in Email Client
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Skip & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}