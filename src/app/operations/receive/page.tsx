'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package2, Plus, Save, X, AlertCircle, Upload, FileText, Loader2 } from 'lucide-react'
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

interface Attachment {
  name: string
  type: string
  size: number
  data?: string
  category: 'packing_list' | 'commercial_invoice' | 'bill_of_lading' | 'delivery_note' | 'cube_master' | 'transaction_certificate' | 'custom_declaration' | 'other'
}

export default function WarehouseReceivePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [skus, setSkus] = useState<Sku[]>([])
  const [skuLoading, setSkuLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<{id: string; name: string; code: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [suppliers, setSuppliers] = useState<string[]>([])
  
  // Dev environment defaults
  const isDev = process.env.NODE_ENV === 'development'
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [shipName, setShipName] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [tcNumber, setTcNumber] = useState('')
  const [ciNumber, setCiNumber] = useState('')
  const [packingListNumber, setPackingListNumber] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [packingListAttachment, setPackingListAttachment] = useState<Attachment | null>(null)
  const [commercialInvoiceAttachment, setCommercialInvoiceAttachment] = useState<Attachment | null>(null)
  const [billOfLadingAttachment, setBillOfLadingAttachment] = useState<Attachment | null>(null)
  const [deliveryNoteAttachment, setDeliveryNoteAttachment] = useState<Attachment | null>(null)
  const [cubeMasterAttachment, setCubeMasterAttachment] = useState<Attachment | null>(null)
  const [transactionCertificateAttachment, setTransactionCertificateAttachment] = useState<Attachment | null>(null)
  const [customDeclarationAttachment, setCustomDeclarationAttachment] = useState<Attachment | null>(null)
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState([
    { 
      id: 1, 
      skuCode: '', 
      batchLot: '', 
      cartons: 0, 
      storagePalletsIn: 0, 
      units: 0,
      unitsPerCarton: 1, // From SKU master data
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0,
      configLoaded: false,
      loadingBatch: false,
      isFirstBatch: false,
      unitValue: 0
    }
  ])

  useEffect(() => {
    fetchSkus()
    fetchWarehouses()
    fetchSuppliers()
  }, [])

  // Refetch SKU configs when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId) {
      // Refetch configs for all items that have SKUs selected
      items.forEach(item => {
        if (item.skuCode) {
          fetchSkuDefaults(item.id, item.skuCode)
        }
      })
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
      toast.error('Failed to load warehouses')
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      console.log('Suppliers API response:', data)
      if (response.ok) {
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
    }
  }

  const fetchNextBatchNumber = async (itemId: number, skuCode: string) => {
    try {
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, loadingBatch: true } : item
      ))
      
      const response = await fetch(`/api/skus/${encodeURIComponent(skuCode)}/next-batch`)
      if (response.ok) {
        const data = await response.json()
        
        // Check if this is the first batch for this SKU
        const checkResponse = await fetch(`/api/inventory/ledger-based?skuCode=${encodeURIComponent(skuCode)}&warehouseId=${selectedWarehouseId}`)
        let isFirstBatch = false
        if (checkResponse.ok) {
          const ledgerData = await checkResponse.json()
          isFirstBatch = !ledgerData.data || ledgerData.data.length === 0
        }
        
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { ...item, batchLot: data.suggestedBatchLot, loadingBatch: false, isFirstBatch } : item
        ))
      }
    } catch (error) {
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, loadingBatch: false } : item
      ))
    }
  }

  const addItem = () => {
    setItems([
      ...items,
      { 
        id: Date.now(), 
        skuCode: '', 
        batchLot: '', 
        cartons: 0, 
        storagePalletsIn: 0, 
        units: 0,
        unitsPerCarton: 1, // From SKU master data
        storageCartonsPerPallet: 0,
        shippingCartonsPerPallet: 0,
        configLoaded: false,
        loadingBatch: false,
        isFirstBatch: false,
        unitValue: 0
      }
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
      switch (category) {
        case 'packing_list':
          setPackingListAttachment(attachment)
          break
        case 'commercial_invoice':
          setCommercialInvoiceAttachment(attachment)
          break
        case 'bill_of_lading':
          setBillOfLadingAttachment(attachment)
          break
        case 'delivery_note':
          setDeliveryNoteAttachment(attachment)
          break
        case 'cube_master':
          setCubeMasterAttachment(attachment)
          break
        case 'transaction_certificate':
          setTransactionCertificateAttachment(attachment)
          break
        case 'custom_declaration':
          setCustomDeclarationAttachment(attachment)
          break
        default:
          setAttachments([...attachments, attachment])
      }
      
      toast.success(`${getCategoryLabel(category)} uploaded`)
    }
    reader.readAsDataURL(file)
  }

  const getCategoryLabel = (category: Attachment['category']): string => {
    switch (category) {
      case 'packing_list': return 'Packing List'
      case 'commercial_invoice': return 'Commercial Invoice'
      case 'bill_of_lading': return 'Bill of Lading'
      case 'delivery_note': return 'Delivery Note'
      case 'cube_master': return 'Cube Master Stacking Style'
      case 'transaction_certificate': return 'Transaction Certificate'
      case 'custom_declaration': return 'Custom Declaration Document'
      case 'other': return 'Other Document'
    }
  }

  const removeSpecificAttachment = (category: Attachment['category']) => {
    switch (category) {
      case 'packing_list':
        setPackingListAttachment(null)
        break
      case 'commercial_invoice':
        setCommercialInvoiceAttachment(null)
        break
      case 'bill_of_lading':
        setBillOfLadingAttachment(null)
        break
      case 'delivery_note':
        setDeliveryNoteAttachment(null)
        break
      case 'cube_master':
        setCubeMasterAttachment(null)
        break
      case 'transaction_certificate':
        setTransactionCertificateAttachment(null)
        break
      case 'custom_declaration':
        setCustomDeclarationAttachment(null)
        break
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const updateItem = async (id: number, field: string, value: any) => {
    setItems(prevItems => prevItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
    
    // If SKU code changed, fetch warehouse config and get next batch number
    if (field === 'skuCode' && value) {
      // Get units per carton from SKU master data
      const selectedSku = skus.find(sku => sku.skuCode === value)
      if (selectedSku) {
        setItems(prevItems => prevItems.map(item => {
          if (item.id === id) {
            const updatedItem = { ...item, unitsPerCarton: selectedSku.unitsPerCarton }
            // Recalculate units based on current cartons and new unitsPerCarton
            updatedItem.units = updatedItem.cartons * updatedItem.unitsPerCarton
            return updatedItem
          }
          return item
        }))
      }
      await fetchSkuDefaults(id, value)
      await fetchNextBatchNumber(id, value)
    }
    
    // If cartons changed, recalculate units
    if (field === 'cartons') {
      setItems(prevItems => {
        const item = prevItems.find(i => i.id === id)
        if (item) {
          const cartons = value
          const units = cartons * item.unitsPerCarton
          return prevItems.map(i => 
            i.id === id ? { ...i, units } : i
          )
        }
        return prevItems
      })
    }
  }
  
  const fetchSkuDefaults = async (itemId: number, skuCode: string) => {
    try {
      const warehouseId = selectedWarehouseId
      if (!warehouseId || !skuCode) {
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, configLoaded: true } : item))
        return
      }

      const sku = skus.find(s => s.skuCode === skuCode)
      if (!sku) {
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, configLoaded: true } : item))
        return
      }

      const configResponse = await fetch(`/api/warehouse-configs?warehouseId=${warehouseId}&skuId=${sku.id}`)
      let storageCartonsPerPallet = 1
      let shippingCartonsPerPallet = 1

      if (configResponse.ok) {
        const configs = await configResponse.json()
        if (configs.length > 0) {
          storageCartonsPerPallet = configs[0].storageCartonsPerPallet || 1
          shippingCartonsPerPallet = configs[0].shippingCartonsPerPallet || 1
        }
      }

      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const updatedItem = {
            ...item,
            unitsPerCarton: sku.unitsPerCarton,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            configLoaded: true,
          }
          // Recalculate units based on current cartons
          updatedItem.units = updatedItem.cartons * updatedItem.unitsPerCarton
          return updatedItem
        }
        return item
      }))
    } catch (error) {
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, configLoaded: true } : item))
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedWarehouseId) {
      toast.error('Please select a warehouse')
      return
    }
    
    // Validate supplier selection
    if (!selectedSupplier) {
      toast.error('Please enter a supplier')
      return
    }
    
    const formData = new FormData(e.target as HTMLFormElement)
    const receiptDate = formData.get('receiptDate') as string
    const pickupDate = formData.get('dropOffDate') as string
    
    // Validate date is not in future
    const receiptDateObj = new Date(receiptDate)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    if (receiptDateObj >= tomorrow) {
      toast.error('Receipt date cannot be in the future')
      return
    }
    
    // Validate date is not too old (5 years for historical imports)
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    if (receiptDateObj < fiveYearsAgo) {
      toast.error('Receipt date is too far in the past (max 5 years)')
      return
    }
    
    // Validate items
    const validItems = items.filter(item => item.skuCode && item.cartons > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity')
      return
    }
    
    // Validate pallet configurations
    for (const item of validItems) {
      if (!item.storageCartonsPerPallet || item.storageCartonsPerPallet <= 0) {
        toast.error(`Please enter storage cartons per pallet for SKU ${item.skuCode}`)
        return
      }
      if (!item.shippingCartonsPerPallet || item.shippingCartonsPerPallet <= 0) {
        toast.error(`Please enter shipping cartons per pallet for SKU ${item.skuCode}`)
        return
      }
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
      if (item.storagePalletsIn && (!Number.isInteger(item.storagePalletsIn) || item.storagePalletsIn < 0 || item.storagePalletsIn > 9999)) {
        toast.error(`Invalid storage pallets value for SKU ${item.skuCode}. Must be between 0 and 9,999`)
        return
      }
      if (item.units && (!Number.isInteger(item.units) || item.units < 0)) {
        toast.error(`Invalid units value for SKU ${item.skuCode}. Must be non-negative`)
        return
      }
      // Validate unit value for first batch
      if (item.isFirstBatch && (!item.unitValue || item.unitValue <= 0)) {
        toast.error(`Please enter a unit value for SKU ${item.skuCode} as this is the first batch`)
        return
      }
    }
    
    setLoading(true)
    
    const notes = formData.get('notes') as string
    
    // Build comprehensive notes
    let fullNotes = ''
    if (selectedSupplier) fullNotes += `Supplier: ${selectedSupplier}. `
    if (ciNumber) fullNotes += `CI #: ${ciNumber}. `
    if (packingListNumber) fullNotes += `Packing List #: ${packingListNumber}. `
    if (shipName) fullNotes += `Ship: ${shipName}. `
    if (trackingNumber) fullNotes += `Tracking: ${trackingNumber}. `
    if (tcNumber) fullNotes += `TC #: ${tcNumber}. `
    if (notes) fullNotes += notes
    
    // Combine all attachments
    const allAttachments: Attachment[] = []
    if (packingListAttachment) allAttachments.push(packingListAttachment)
    if (commercialInvoiceAttachment) allAttachments.push(commercialInvoiceAttachment)
    if (billOfLadingAttachment) allAttachments.push(billOfLadingAttachment)
    if (deliveryNoteAttachment) allAttachments.push(deliveryNoteAttachment)
    if (cubeMasterAttachment) allAttachments.push(cubeMasterAttachment)
    if (transactionCertificateAttachment) allAttachments.push(transactionCertificateAttachment)
    if (customDeclarationAttachment) allAttachments.push(customDeclarationAttachment)
    allAttachments.push(...attachments)
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'RECEIVE',
          referenceNumber: ciNumber, // Use CI number as reference
          date: receiptDate,
          pickupDate,
          items: validItems,
          notes: fullNotes,
          shipName,
          trackingNumber,
          supplier: selectedSupplier,
          attachments: allAttachments.length > 0 ? allAttachments : null,
          warehouseId: selectedWarehouseId,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Receipt saved successfully! ${data.message}`)
        router.push('/operations/inventory')
      } else {
        // Display specific error message from backend
        if (data.error) {
          toast.error(data.error)
        } else {
          toast.error('Failed to save receipt')
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
      toast.error(`Failed to save receipt: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Receive Goods</h1>
            <p className="text-muted-foreground">
              Record incoming inventory
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/operations/inventory')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="receive-form"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Receipt
                </>
              )}
            </button>
          </div>
        </div>

        <form id="receive-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Shipment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commercial Invoice #
                </label>
                <input
                  type="text"
                  value={ciNumber}
                  onChange={(e) => setCiNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., CI-2024-456"
                  title="Enter Commercial Invoice number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Packing List #
                </label>
                <input
                  type="text"
                  value={packingListNumber}
                  onChange={(e) => setPackingListNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., PL-2024-456"
                  title="Enter Packing List number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  list="supplier-options"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter or select supplier"
                  required
                />
                <datalist id="supplier-options">
                  {suppliers.map(supplier => (
                    <option key={supplier} value={supplier} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TC # GRS
                </label>
                <input
                  type="text"
                  value={tcNumber}
                  onChange={(e) => setTcNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., TC-2024-123"
                  title="Enter Transaction Certificate number GRS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
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
                  Receipt Date
                </label>
                <input
                  type="date"
                  name="receiptDate"
                  id="receiptDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={receiptDate}
                  max={new Date().toISOString().slice(0, 10)}
                  min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setReceiptDate(e.target.value)
                    // Update min date for dropoff date when receipt date changes
                    const dropOffInput = document.getElementById('dropOffDate') as HTMLInputElement
                    if (dropOffInput && e.target.value) {
                      dropOffInput.min = e.target.value
                      // If dropoff date is before receipt date, update it
                      if (dropOffInput.value && dropOffInput.value < e.target.value) {
                        dropOffInput.value = e.target.value
                      }
                    }
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drop off Date
                </label>
                <input
                  type="date"
                  name="dropOffDate"
                  id="dropOffDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={receiptDate}
                  min={receiptDate}
                  required
                />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ship Name
                  </label>
                  <input
                    type="text"
                    value={shipName}
                    onChange={(e) => setShipName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., MV Ocean Star"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-1">
                      Container Number
                      <Tooltip 
                        content="Container number (e.g., MSKU1234567)" 
                        iconSize="sm"
                      />
                    </div>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., MSKU1234567"
                  />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Items Received</h3>
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
                      Cartons
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
                      Storage Config
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Storage Pallets
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Config
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-1">
                        Unit Value
                        <Tooltip 
                          content="Value per unit (only for first batch)" 
                          iconSize="sm"
                        />
                      </div>
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
                        <div className="relative">
                          <input
                            type="text"
                            value={item.batchLot}
                            onChange={(e) => updateItem(item.id, 'batchLot', e.target.value)}
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={item.loadingBatch ? "Loading..." : "Enter batch/lot"}
                            required
                            title="Enter or modify the batch/lot number"
                          />
                          {item.loadingBatch && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.cartons === 0 ? '' : item.cartons}
                          onChange={(e) => {
                            const value = e.target.value
                            const newCartons = value === '' ? 0 : parseInt(value) || 0
                            
                            setItems(prevItems => prevItems.map(currentItem => {
                              if (currentItem.id === item.id) {
                                const updatedItem = { ...currentItem, cartons: newCartons }
                                
                                // Update units based on cartons
                                updatedItem.units = newCartons * currentItem.unitsPerCarton
                                
                                // Auto-calculate pallets if config is loaded
                                if (currentItem.storageCartonsPerPallet > 0 && newCartons > 0) {
                                  const calculatedPallets = Math.ceil(newCartons / currentItem.storageCartonsPerPallet)
                                  updatedItem.storagePalletsIn = calculatedPallets
                                }
                                
                                return updatedItem
                              }
                              return currentItem
                            }))
                          }}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          min="0"
                          required
                        />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.unitsPerCarton}
                          className="w-full px-2 py-1 border rounded text-right bg-gray-100 cursor-not-allowed"
                          readOnly
                          title="Units per carton is defined by the SKU master data"
                        />
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={item.storageCartonsPerPallet === 0 ? '' : item.storageCartonsPerPallet}
                            onChange={(e) => {
                              const value = e.target.value
                              const newValue = value === '' ? 0 : parseInt(value) || 0
                              updateItem(item.id, 'storageCartonsPerPallet', newValue)
                              // Auto-calculate and pre-fill pallets
                              if (newValue > 0 && item.cartons > 0) {
                                const calculatedPallets = Math.ceil(item.cartons / newValue)
                                updateItem(item.id, 'storagePalletsIn', calculatedPallets)
                              }
                            }}
                            className={`w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                              item.configLoaded && item.storageCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                            }`}
                            min="1"
                            placeholder={!item.skuCode ? "" : item.configLoaded ? "0" : "..."}
                            title={!item.skuCode ? 'Select SKU first' : item.configLoaded && item.storageCartonsPerPallet > 0 ? 'Loaded from warehouse config (editable)' : 'Enter value'}
                            required
                          />
                          <span className="text-xs text-gray-500">c/p</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.storagePalletsIn === 0 ? '' : item.storagePalletsIn}
                          onChange={(e) => {
                            const value = e.target.value
                            const newPallets = value === '' ? 0 : parseInt(value) || 0
                            updateItem(item.id, 'storagePalletsIn', newPallets)
                          }}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          min="0"
                          placeholder={item.cartons > 0 && item.storageCartonsPerPallet > 0 ? `${Math.ceil(item.cartons / item.storageCartonsPerPallet)}` : ''}
                          title="Storage pallets (auto-calculated, but can be overridden)"
                        />
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={item.shippingCartonsPerPallet === 0 ? '' : item.shippingCartonsPerPallet}
                            onChange={(e) => {
                              const value = e.target.value
                              updateItem(item.id, 'shippingCartonsPerPallet', value === '' ? 0 : parseInt(value) || 0)
                            }}
                            className={`w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                              item.configLoaded && item.shippingCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                            }`}
                            min="1"
                            placeholder={!item.skuCode ? "" : item.configLoaded ? "0" : "..."}
                            title={!item.skuCode ? 'Select SKU first' : item.configLoaded && item.shippingCartonsPerPallet > 0 ? 'Loaded from warehouse config (editable)' : 'Enter value'}
                            required
                          />
                          <span className="text-xs text-gray-500">c/p</span>
                        </div>
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
                      <td className="px-4 py-3 w-32">
                        {item.isFirstBatch ? (
                          <input
                            type="number"
                            value={item.unitValue === 0 ? '' : item.unitValue}
                            onChange={(e) => {
                              const value = e.target.value
                              const newValue = value === '' ? 0 : parseFloat(value) || 0
                              updateItem(item.id, 'unitValue', newValue)
                            }}
                            className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                            min="0"
                            step="0.0001"
                            placeholder="0.00"
                            title="Enter the value per unit for this first batch"
                            required={item.isFirstBatch}
                          />
                        ) : (
                          <span className="text-sm text-gray-500 italic">N/A</span>
                        )}
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
                    <td className="px-4 py-3 text-right font-semibold">
                      SKU Total:
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.cartons, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.storagePalletsIn, 0)}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.units, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Attachments */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Required Documents</h3>
              <span className="text-sm text-gray-600">Max 5MB per file</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Commercial Invoice */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      Commercial Invoice
                      {commercialInvoiceAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Invoice with pricing</p>
                  </div>
                </div>
                {commercialInvoiceAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{commercialInvoiceAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('commercial_invoice')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'commercial_invoice')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Bill of Lading */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      Bill of Lading
                      {billOfLadingAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Carrier document</p>
                  </div>
                </div>
                {billOfLadingAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{billOfLadingAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('bill_of_lading')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'bill_of_lading')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Packing List */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      Packing List
                      {packingListAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Items & quantities</p>
                  </div>
                </div>
                {packingListAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{packingListAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('packing_list')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'packing_list')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Delivery Note */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      Delivery Note
                      {deliveryNoteAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Proof of delivery</p>
                  </div>
                </div>
                {deliveryNoteAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{deliveryNoteAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('delivery_note')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'delivery_note')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Cube Master Stacking Style */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      Cube Master
                      {cubeMasterAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Pallet stacking config</p>
                  </div>
                </div>
                {cubeMasterAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{cubeMasterAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('cube_master')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'cube_master')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Transaction Certificate for GRS */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      TC GRS
                      {transactionCertificateAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Goods Receipt Slip</p>
                  </div>
                </div>
                {transactionCertificateAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{transactionCertificateAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('transaction_certificate')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'transaction_certificate')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Custom Declaration Document */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm flex items-center gap-1">
                      CDS
                      {customDeclarationAttachment && (
                        <span className="text-green-600">✓</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">Customs clearance</p>
                  </div>
                </div>
                {customDeclarationAttachment ? (
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{customDeclarationAttachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('custom_declaration')}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Upload</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(e, 'custom_declaration')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Other Attachments */}
              <div className="border rounded-lg p-3 bg-gray-50 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Additional Docs</h4>
                    <p className="text-xs text-gray-600 mt-0.5">Optional files</p>
                  </div>
                </div>
                <label className="cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded p-2 text-center hover:border-gray-400 transition-colors">
                    <Upload className="h-4 w-4 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-600 mt-1">Upload</p>
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
                  <div className="space-y-1 mt-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                        <div className="flex items-center gap-1 truncate">
                          <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                          <span className="text-gray-700 truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Notes</h3>
            <textarea
              name="notes"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Any additional notes or comments..."
              defaultValue={''}  
            />
          </div>

        </form>
      </div>
    </DashboardLayout>
  )
}