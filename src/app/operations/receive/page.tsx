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
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [skus, setSkus] = useState<Sku[]>([])
  const [skuLoading, setSkuLoading] = useState(true)
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
  const [items, setItems] = useState([
    { 
      id: 1, 
      skuCode: '', 
      batchLot: '', 
      cartons: 0, 
      pallets: 0, 
      calculatedPallets: 0,
      units: 0,
      unitsPerCarton: 1, // From SKU master data
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0,
      configLoaded: false,
      palletVariance: false,
      loadingBatch: false
    }
  ])

  useEffect(() => {
    fetchSkus()
  }, [])

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

  const fetchNextBatchNumber = async (itemId: number, skuCode: string) => {
    try {
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, loadingBatch: true } : item
      ))
      
      const response = await fetch(`/api/skus/${encodeURIComponent(skuCode)}/next-batch`)
      if (response.ok) {
        const data = await response.json()
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { ...item, batchLot: data.suggestedBatchLot, loadingBatch: false } : item
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
        pallets: 0, 
        calculatedPallets: 0,
        units: 0,
        unitsPerCarton: 1, // From SKU master data
        storageCartonsPerPallet: 0,
        shippingCartonsPerPallet: 0,
        configLoaded: false,
        palletVariance: false,
        loadingBatch: false
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
        setItems(prevItems => prevItems.map(item => 
          item.id === id ? { ...item, unitsPerCarton: selectedSku.unitsPerCarton } : item
        ))
      }
      await fetchLastBatchDefaults(id, value)
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
  
  const fetchLastBatchDefaults = async (itemId: number, skuCode: string) => {
    try {
      const warehouseId = session?.user.warehouseId
      if (!warehouseId) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      // Get the last transaction for this SKU to fetch previous batch values
      const response = await fetch(`/api/transactions/ledger?warehouse=${warehouseId}&skuCode=${skuCode}&transactionType=RECEIVE&limit=1`)
      if (!response.ok) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      const data = await response.json()
      if (data.transactions && data.transactions.length > 0) {
        const lastTransaction = data.transactions[0]
        
        // Get the inventory balance for pallet configs
        const balanceResponse = await fetch(`/api/inventory/balances?warehouseId=${warehouseId}&skuCode=${skuCode}`)
        const balances = await balanceResponse.json()
        const lastBatch = balances.find((b: any) => b.batchLot === lastTransaction.batchLot) || balances[0]
        
        setItems(prevItems => prevItems.map(item => {
          if (item.id === itemId) {
            // Calculate units per carton from last transaction if available
            let unitsPerCarton = 1
            if (lastTransaction.cartonsIn > 0 && lastTransaction.sku?.unitsPerCarton) {
              // For now use SKU master until we have units stored per transaction
              unitsPerCarton = lastTransaction.sku.unitsPerCarton
            }
            
            return {
              ...item,
              unitsPerCarton,
              storageCartonsPerPallet: lastBatch?.storageCartonsPerPallet || 1,
              shippingCartonsPerPallet: lastBatch?.shippingCartonsPerPallet || 1,
              configLoaded: true
            }
          }
          return item
        }))
      } else {
        // No previous transactions found, still mark as loaded with default values
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
      }
    } catch (error) {
      // On error, still mark as loaded with defaults
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { 
          ...item, 
          configLoaded: true,
          storageCartonsPerPallet: 1,
          shippingCartonsPerPallet: 1
        } : item
      ))
    }
  }

  const fetchWarehouseConfig = async (itemId: number, skuCode: string) => {
    try {
      const warehouseId = session?.user.warehouseId
      if (!warehouseId) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      // First get the SKU ID
      const skuResponse = await fetch(`/api/skus?search=${skuCode}`)
      if (!skuResponse.ok) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      const skus = await skuResponse.json()
      const sku = skus.find((s: any) => s.skuCode === skuCode)
      if (!sku) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      // Then get the warehouse config
      const configResponse = await fetch(`/api/warehouse-configs?warehouseId=${warehouseId}&skuId=${sku.id}`)
      if (!configResponse.ok) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { 
            ...item, 
            configLoaded: true,
            storageCartonsPerPallet: 1,
            shippingCartonsPerPallet: 1
          } : item
        ))
        return
      }
      
      const configs = await configResponse.json()
      if (configs.length > 0) {
        const config = configs[0] // Get the most recent config
        setItems(prevItems => prevItems.map(item => {
          if (item.id === itemId) {
            const storageCartonsPerPallet = config.storageCartonsPerPallet || 0
            const shippingCartonsPerPallet = config.shippingCartonsPerPallet || 0
            const calculatedPallets = item.cartons > 0 && storageCartonsPerPallet > 0
              ? Math.ceil(item.cartons / storageCartonsPerPallet)
              : 0
            
            return { 
              ...item, 
              storageCartonsPerPallet,
              shippingCartonsPerPallet,
              configLoaded: true,
              calculatedPallets,
              // Only auto-update pallets if user hasn't manually entered a value
              pallets: item.pallets > 0 ? item.pallets : calculatedPallets,
              palletVariance: item.pallets > 0 && item.pallets !== calculatedPallets
            }
          }
          return item
        }))
      } else {
        // No config found, but mark as loaded with defaults
        setItems(prevItems => prevItems.map(item => {
          if (item.id === itemId) {
            return { 
              ...item, 
              storageCartonsPerPallet: 0,
              shippingCartonsPerPallet: 0,
              configLoaded: true,
              calculatedPallets: 0,
              pallets: 0,
              palletVariance: false
            }
          }
          return item
        }))
      }
    } catch (error) {
      // On error, still mark as loaded with defaults
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { 
          ...item, 
          configLoaded: true,
          storageCartonsPerPallet: 1,
          shippingCartonsPerPallet: 1
        } : item
      ))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const formData = new FormData(e.target as HTMLFormElement)
    const receiptDate = formData.get('receiptDate') as string
    const pickupDate = formData.get('pickupDate') as string
    
    // Validate date is not in future
    const receiptDateObj = new Date(receiptDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    if (receiptDateObj > today) {
      toast.error('Receipt date cannot be in the future')
      return
    }
    
    // Validate date is not too old
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    if (receiptDateObj < oneYearAgo) {
      toast.error('Receipt date is too far in the past (max 1 year)')
      return
    }
    
    // Check for backdated transactions
    try {
      const response = await fetch(`/api/transactions/ledger?warehouse=${session?.user.warehouseId}&limit=1`)
      if (response.ok) {
        const data = await response.json()
        if (data.transactions && data.transactions.length > 0) {
          const lastTransactionDate = new Date(data.transactions[0].transactionDate)
          if (receiptDateObj < lastTransactionDate) {
            toast.error(`Cannot create backdated transactions. The last transaction was on ${lastTransactionDate.toLocaleDateString()}. Please use a date on or after this date.`)
            return
          }
        }
      }
    } catch (error) {
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
      if (item.pallets && (!Number.isInteger(item.pallets) || item.pallets < 0 || item.pallets > 9999)) {
        toast.error(`Invalid pallets value for SKU ${item.skuCode}. Must be between 0 and 9,999`)
        return
      }
      if (item.units && (!Number.isInteger(item.units) || item.units < 0)) {
        toast.error(`Invalid units value for SKU ${item.skuCode}. Must be non-negative`)
        return
      }
    }
    
    setLoading(true)
    
    const supplier = formData.get('supplier') as string
    const notes = formData.get('notes') as string
    
    // Build comprehensive notes
    let fullNotes = ''
    if (supplier) fullNotes += `Supplier: ${supplier}. `
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
          attachments: allAttachments.length > 0 ? allAttachments : null,
          warehouseId: session?.user.warehouseId, // Include warehouse ID if not staff
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Receipt saved successfully! ${data.message}`)
        router.push('/operations/inventory')
      } else {
        toast.error(data.error || 'Failed to save receipt')
        if (data.details) {
        }
      }
    } catch (error) {
      toast.error('Failed to save receipt. Please try again.')
    } finally {
      setLoading(false)
    }
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
                  Supplier
                </label>
                <input
                  type="text"
                  name="supplier"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Date
                </label>
                <input
                  type="date"
                  name="receiptDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drop off Date
                </label>
                <input
                  type="date"
                  name="pickupDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                    Tracking Number
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Storage Cartons/Pallet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Cartons/Pallet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pallets
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
                              {sku.skuCode} - {sku.description}
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
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-gray-100"
                            placeholder={item.loadingBatch ? "Loading..." : "Select SKU first"}
                            required
                            readOnly
                            title="Batch number is automatically assigned based on the last batch for this SKU"
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
                                
                                // Calculate pallets if config is loaded
                                if (currentItem.configLoaded && currentItem.storageCartonsPerPallet > 0 && newCartons > 0) {
                                  const calculatedPallets = Math.ceil(newCartons / currentItem.storageCartonsPerPallet)
                                  updatedItem.calculatedPallets = calculatedPallets
                                  
                                  // Only auto-update actual pallets if user hasn't manually entered
                                  if (!currentItem.palletVariance) {
                                    updatedItem.pallets = calculatedPallets
                                  } else {
                                    // Recalculate variance
                                    updatedItem.palletVariance = updatedItem.pallets !== calculatedPallets
                                  }
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
                        <input
                          type="number"
                          value={item.storageCartonsPerPallet === 0 ? '' : item.storageCartonsPerPallet}
                          onChange={(e) => {
                            const value = e.target.value
                            const newValue = value === '' ? 0 : parseInt(value) || 0
                            updateItem(item.id, 'storageCartonsPerPallet', newValue)
                            // Recalculate pallets
                            if (newValue > 0 && item.cartons > 0) {
                              const calculatedPallets = Math.ceil(item.cartons / newValue)
                              updateItem(item.id, 'calculatedPallets', calculatedPallets)
                              // Check if we should update actual pallets
                              if (!item.palletVariance) {
                                updateItem(item.id, 'pallets', calculatedPallets)
                              } else {
                                updateItem(item.id, 'palletVariance', item.pallets !== calculatedPallets)
                              }
                            }
                          }}
                          className={`w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                            item.configLoaded && item.storageCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                          }`}
                          min="1"
                          placeholder={!item.skuCode ? "Select SKU first" : item.configLoaded ? "Enter value" : "Loading..."}
                          title={!item.skuCode ? 'Select SKU first' : item.configLoaded && item.storageCartonsPerPallet > 0 ? 'Loaded from warehouse config (editable)' : 'Enter value'}
                          required
                        />
                      </td>
                      <td className="px-4 py-3 w-32">
                        <input
                          type="number"
                          value={item.shippingCartonsPerPallet === 0 ? '' : item.shippingCartonsPerPallet}
                          onChange={(e) => {
                            const value = e.target.value
                            updateItem(item.id, 'shippingCartonsPerPallet', value === '' ? 0 : parseInt(value) || 0)
                          }}
                          className={`w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                            item.configLoaded && item.shippingCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                          }`}
                          min="1"
                          placeholder={!item.skuCode ? "Select SKU first" : item.configLoaded ? "Enter value" : "Loading..."}
                          title={!item.skuCode ? 'Select SKU first' : item.configLoaded && item.shippingCartonsPerPallet > 0 ? 'Loaded from warehouse config (editable)' : 'Enter value'}
                          required
                        />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={item.pallets === 0 ? '' : item.pallets}
                            onChange={(e) => {
                              const value = e.target.value
                              const newPallets = value === '' ? 0 : parseInt(value) || 0
                              const calculatedPallets = item.cartons > 0 && item.storageCartonsPerPallet > 0
                                ? Math.ceil(item.cartons / item.storageCartonsPerPallet)
                                : 0
                              updateItem(item.id, 'pallets', newPallets)
                              updateItem(item.id, 'calculatedPallets', calculatedPallets)
                              updateItem(item.id, 'palletVariance', newPallets !== calculatedPallets)
                            }}
                            className={`w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary ${
                              item.palletVariance ? 'border-yellow-500 bg-yellow-50' : ''
                            }`}
                            min="0"
                            title="Actual pallets (editable)"
                          />
                          {item.configLoaded && item.calculatedPallets > 0 && (
                            <div className="text-xs text-gray-500 text-right">
                              Calc: {item.calculatedPallets}
                              {item.palletVariance && (
                                <span className="text-yellow-600 ml-1" title="Variance between actual and calculated">
                                  (Δ {Math.abs(item.pallets - item.calculatedPallets)})
                                </span>
                              )}
                            </div>
                          )}
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
                    <td className="px-4 py-3 w-48 text-right font-semibold">
                      SKU Total:
                    </td>
                    <td className="px-4 py-3 w-40"></td>
                    <td className="px-4 py-3 w-28 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.cartons, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 w-28"></td>
                    <td className="px-4 py-3 w-32"></td>
                    <td className="px-4 py-3 w-32"></td>
                    <td className="px-4 py-3 w-28 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.pallets, 0)}
                    </td>
                    <td className="px-4 py-3 w-28 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.units, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 w-12"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Attachments */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Required Documents</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload the following documents for this shipment (Max 5MB per file)
            </p>
            
            <div className="space-y-6">
              {/* Commercial Invoice */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Commercial Invoice</h4>
                    <p className="text-xs text-gray-600">Invoice from supplier with pricing details</p>
                  </div>
                  {commercialInvoiceAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {commercialInvoiceAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{commercialInvoiceAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(commercialInvoiceAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('commercial_invoice')}
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
                      onChange={(e) => handleFileUpload(e, 'commercial_invoice')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Bill of Lading */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Bill of Lading</h4>
                    <p className="text-xs text-gray-600">Shipping document issued by carrier</p>
                  </div>
                  {billOfLadingAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {billOfLadingAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{billOfLadingAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(billOfLadingAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('bill_of_lading')}
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
                      onChange={(e) => handleFileUpload(e, 'bill_of_lading')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Packing List */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Packing List</h4>
                    <p className="text-xs text-gray-600">List of items, quantities, and packaging details</p>
                  </div>
                  {packingListAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {packingListAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{packingListAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(packingListAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('packing_list')}
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
                      onChange={(e) => handleFileUpload(e, 'packing_list')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Delivery Note */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Delivery Note</h4>
                    <p className="text-xs text-gray-600">Proof of delivery from carrier</p>
                  </div>
                  {deliveryNoteAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {deliveryNoteAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{deliveryNoteAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(deliveryNoteAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('delivery_note')}
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
                      onChange={(e) => handleFileUpload(e, 'delivery_note')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Cube Master Stacking Style */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Cube Master Stacking Style for Storage Pallets</h4>
                    <p className="text-xs text-gray-600">Document showing optimal pallet stacking configuration</p>
                  </div>
                  {cubeMasterAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {cubeMasterAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{cubeMasterAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(cubeMasterAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('cube_master')}
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
                      onChange={(e) => handleFileUpload(e, 'cube_master')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Transaction Certificate for GRS */}
              <div className="border rounded-lg p-4 bg-green-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Transaction Certificate (TC) GRS</h4>
                    <p className="text-xs text-gray-600">Goods Receipt Slip</p>
                  </div>
                  {transactionCertificateAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {transactionCertificateAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{transactionCertificateAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(transactionCertificateAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('transaction_certificate')}
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
                      onChange={(e) => handleFileUpload(e, 'transaction_certificate')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Custom Declaration Document */}
              <div className="border rounded-lg p-4 bg-yellow-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">Custom Declaration Document (CDS)</h4>
                    <p className="text-xs text-gray-600">Customs clearance documentation</p>
                  </div>
                  {customDeclarationAttachment && (
                    <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
                  )}
                </div>
                {customDeclarationAttachment ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{customDeclarationAttachment.name}</span>
                      <span className="text-xs text-gray-500">({(customDeclarationAttachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpecificAttachment('custom_declaration')}
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
                      onChange={(e) => handleFileUpload(e, 'custom_declaration')}
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

          {/* Notes */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
            <textarea
              name="notes"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Any additional notes or comments..."
            />
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
        </form>
      </div>
    </DashboardLayout>
  )
}