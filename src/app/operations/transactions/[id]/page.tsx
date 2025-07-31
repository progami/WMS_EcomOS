'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  Package2, 
  Save, 
  X, 
  Upload, 
  FileText, 
  Loader2, 
  Edit2,
  History,
  AlertCircle,
  ArrowLeft
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'react-hot-toast'
import { useS3Upload } from '@/hooks/use-s3-upload'

interface Transaction {
  id: string
  transactionId: string
  transactionDate: string
  transactionType: 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'
  warehouse: { id: string; name: string; code: string }
  sku: { 
    id: string
    skuCode: string
    description: string
    unitsPerCarton: number
  }
  batchLot: string
  referenceId: string
  cartonsIn: number
  cartonsOut: number
  storagePalletsIn: number
  shippingPalletsOut: number
  createdBy: { id: string; fullName: string }
  createdAt: string
  updatedAt: string
  
  // Additional fields
  shipName?: string | null
  trackingNumber?: string | null
  pickupDate?: string | null
  attachments?: any
  supplier?: string | null
  
  // Pallet configs
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
  unitsPerCarton?: number | null
}

interface Attachment {
  name: string
  type: string
  size: number
  data?: string // For backward compatibility
  s3Key?: string // S3 key for new uploads
  s3Url?: string // Presigned URL for viewing
  category: string
}

interface AuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  oldValue: any
  newValue: any
  changedBy: { id: string; fullName: string }
  createdAt: string
}

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  
  // Form states
  const [formData, setFormData] = useState({
    
    // Receive specific
    ciNumber: '',
    packingListNumber: '',
    tcNumber: '',
    supplier: '',
    shipName: '',
    trackingNumber: '',
    
    // Ship specific
    carrier: '',
    pickupDate: '',
    
    // Quantities (editable)
    cartons: 0,
    pallets: 0,
    units: 0,
    unitsPerCarton: 1,
    storageCartonsPerPallet: 0,
    shippingCartonsPerPallet: 0
  })
  
  // Attachment states
  const [attachments, setAttachments] = useState<{ [key: string]: Attachment | null }>({
    packingList: null,
    commercialInvoice: null,
    billOfLading: null,
    deliveryNote: null,
    cubeMaster: null,
    transactionCertificate: null,
    customDeclaration: null,
    proofOfPickup: null
  })
  
  // S3 Upload hook
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [currentUploadCategory, setCurrentUploadCategory] = useState<string | null>(null)
  const { uploadToS3, isUploading } = useS3Upload({
    onProgress: (progress) => {
      if (currentUploadCategory) {
        setUploadProgress(prev => ({ ...prev, [currentUploadCategory]: progress.percentage }))
      }
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  useEffect(() => {
    if (params.id) {
      fetchTransaction()
    }
  }, [params.id])

  const fetchTransaction = async () => {
    try {
      const response = await fetch(`/api/transactions/${params.id}`)
      if (!response.ok) throw new Error('Failed to fetch transaction')
      
      const data = await response.json()
      setTransaction(data)
      
      // Parse additional fields from transaction data
      const supplierMatch = data.supplier || ''
      const ciMatch = null
      const plMatch = null
      const tcMatch = null
      const carrierMatch = null
      const fbaMatch = null
      const trackingMatch = null
      const shipMatch = null
      
      // Set form data
      setFormData({
        ciNumber: data.referenceId || '',
        packingListNumber: '',
        tcNumber: '',
        supplier: supplierMatch,
        shipName: data.shipName || '',
        trackingNumber: data.trackingNumber || '',
        carrier: '',
        pickupDate: data.pickupDate || '',
        cartons: data.transactionType === 'RECEIVE' ? data.cartonsIn : data.cartonsOut,
        pallets: data.transactionType === 'RECEIVE' ? data.storagePalletsIn : data.shippingPalletsOut,
        units: (data.transactionType === 'RECEIVE' ? data.cartonsIn : data.cartonsOut) * (data.unitsPerCarton || data.sku.unitsPerCarton || 1),
        unitsPerCarton: data.unitsPerCarton || data.sku.unitsPerCarton || 1,
        storageCartonsPerPallet: data.storageCartonsPerPallet || 0,
        shippingCartonsPerPallet: data.shippingCartonsPerPallet || 0
      })
      
      // Set attachments if any
      if (data.attachments) {
        const existingAttachments: { [key: string]: Attachment | null } = {}
        if (Array.isArray(data.attachments)) {
          data.attachments.forEach((att: Attachment) => {
            if (att.category) {
              const categoryMap: { [key: string]: string } = {
                'packing_list': 'packingList',
                'commercial_invoice': 'commercialInvoice',
                'bill_of_lading': 'billOfLading',
                'delivery_note': 'deliveryNote',
                'cube_master': 'cubeMaster',
                'transaction_certificate': 'transactionCertificate',
                'custom_declaration': 'customDeclaration',
                'proof_of_pickup': 'proofOfPickup'
              }
              const key = categoryMap[att.category] || att.category
              existingAttachments[key] = att
            }
          })
        }
        setAttachments(prev => ({ ...prev, ...existingAttachments }))
      }
      
      // Fetch audit logs
      await fetchAuditLogs()
    } catch (error) {
      // console.error('Error fetching transaction:', error)
      toast.error('Failed to load transaction')
      router.push('/operations/inventory')
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch(`/api/audit-logs?entityType=transaction&entityId=${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setAuditLogs(data.logs || [])
      }
    } catch (error) {
      // console.error('Error fetching audit logs:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name} is too large. Maximum size is 5MB.`)
      return
    }
    
    // Show upload progress for this category
    setUploadProgress(prev => ({ ...prev, [category]: 0 }))
    setCurrentUploadCategory(category)
    
    try {
      // Upload to S3
      const result = await uploadToS3(file, {
        type: 'transaction',
        transactionId: params.id as string,
        documentType: category
      })
      
      if (result) {
        const attachment: Attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          s3Key: result.s3Key,
          s3Url: result.viewUrl,
          category
        }
        
        setAttachments(prev => ({ ...prev, [category]: attachment }))
        toast.success(`${getCategoryLabel(category)} uploaded`)
      }
    } finally {
      // Clear progress
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[category]
        return newProgress
      })
    }
  }

  const getCategoryLabel = (category: string): string => {
    const labels: { [key: string]: string } = {
      packingList: 'Packing List',
      commercialInvoice: 'Commercial Invoice',
      billOfLading: 'Bill of Lading',
      deliveryNote: 'Delivery Note',
      cubeMaster: 'Cube Master Stacking Style',
      transactionCertificate: 'Transaction Certificate',
      customDeclaration: 'Custom Declaration Document',
      proofOfPickup: 'Proof of Pickup'
    }
    return labels[category] || category
  }

  const handleSave = async () => {
    if (!transaction) return
    
    setSaving(true)
    
    try {
      // Build empty notes
      let fullNotes = ''
      
      // Prepare attachment array
      const attachmentArray = Object.entries(attachments)
        .filter(([_, att]) => att !== null)
        .map(([category, att]) => ({
          ...att!,
          category: category.replace(/([A-Z])/g, '_$1').toLowerCase() // Convert camelCase to snake_case
        }))
      
      // Calculate quantity changes
      const oldCartons = transaction.transactionType === 'RECEIVE' ? transaction.cartonsIn : transaction.cartonsOut
      const oldPallets = transaction.transactionType === 'RECEIVE' ? transaction.storagePalletsIn : transaction.shippingPalletsOut
      const quantityChanged = oldCartons !== formData.cartons || oldPallets !== formData.pallets
      
      // Update transaction
      const response = await fetch(`/api/transactions/${params.id}/attributes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: fullNotes,
          shipName: formData.shipName || null,
          trackingNumber: formData.trackingNumber || null,
          pickupDate: formData.pickupDate || null,
          referenceId: formData.ciNumber || transaction.referenceId,
          supplier: formData.supplier || null,
          attachments: attachmentArray.length > 0 ? attachmentArray : null,
          
          // Quantity updates (if changed)
          ...(quantityChanged && {
            cartonsIn: transaction.transactionType === 'RECEIVE' ? formData.cartons : 0,
            cartonsOut: transaction.transactionType === 'SHIP' ? formData.cartons : 0,
            storagePalletsIn: transaction.transactionType === 'RECEIVE' ? formData.pallets : 0,
            shippingPalletsOut: transaction.transactionType === 'SHIP' ? formData.pallets : 0,
            unitsPerCarton: formData.unitsPerCarton,
            storageCartonsPerPallet: formData.storageCartonsPerPallet || null,
            shippingCartonsPerPallet: formData.shippingCartonsPerPallet || null
          }),
          
          // Audit log data
          auditReason: quantityChanged ? 'Quantity adjustment' : 'Attribute update',
          oldValues: quantityChanged ? { cartons: oldCartons, pallets: oldPallets } : null
        })
      })
      
      if (!response.ok) throw new Error('Failed to update transaction')
      
      toast.success('Transaction updated successfully')
      setEditMode(false)
      await fetchTransaction() // Refresh data
    } catch (error) {
      // console.error('Error updating transaction:', error)
      toast.error('Failed to update transaction')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !transaction) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const isReceive = transaction.transactionType === 'RECEIVE'
  const isShip = transaction.transactionType === 'SHIP'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Transaction Details</h1>
              <p className="text-muted-foreground">
                {transaction.transactionId} • {new Date(transaction.transactionDate).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => router.push('/operations/inventory')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                <button
                  onClick={() => setShowAuditLog(!showAuditLog)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <History className="h-4 w-4 mr-2" />
                  Audit Log
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditMode(false)
                    fetchTransaction() // Reset form
                  }}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Transaction Type Badge */}
        <div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isReceive ? 'bg-green-100 text-green-800' : 
            isShip ? 'bg-red-100 text-red-800' :
            transaction.transactionType === 'ADJUST_IN' ? 'bg-blue-100 text-blue-800' :
            'bg-orange-100 text-orange-800'
          }`}>
            {transaction.transactionType}
          </span>
        </div>

        {/* Basic Information */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Core transaction fields (Warehouse, SKU, Batch/Lot, Date) cannot be edited to maintain data integrity. 
              For corrections, please void this transaction and create a new one.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse <span className="text-xs text-gray-500">(Read-only)</span>
              </label>
              <input
                type="text"
                value={transaction.warehouse.name}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
                title="Warehouse cannot be changed to maintain inventory integrity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU Code <span className="text-xs text-gray-500">(Read-only)</span>
              </label>
              <input
                type="text"
                value={transaction.sku.skuCode}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
                title="SKU cannot be changed to maintain inventory integrity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU Description <span className="text-xs text-gray-500">(Read-only)</span>
              </label>
              <input
                type="text"
                value={transaction.sku.description}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch/Lot <span className="text-xs text-gray-500">(Read-only)</span>
              </label>
              <input
                type="text"
                value={transaction.batchLot}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
                title="Batch/Lot cannot be changed to maintain traceability"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Date <span className="text-xs text-gray-500">(Read-only)</span>
              </label>
              <input
                type="text"
                value={new Date(transaction.transactionDate).toLocaleDateString()}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
                title="Transaction date cannot be changed to maintain chronological integrity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference ID {editMode && <span className="text-xs text-green-600">(Editable)</span>}
              </label>
              <input
                type="text"
                value={formData.ciNumber || transaction.referenceId}
                onChange={(e) => setFormData({ ...formData, ciNumber: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  editMode ? 'focus:outline-none focus:ring-2 focus:ring-primary' : 'bg-gray-100'
                }`}
                readOnly={!editMode}
              />
            </div>
          </div>
        </div>

        {/* Document Details */}
        {(isReceive || isShip) && (
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              {isReceive ? 'Shipment Details' : 'Shipping Details'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isReceive && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commercial Invoice #
                    </label>
                    <input
                      type="text"
                      value={formData.ciNumber}
                      onChange={(e) => setFormData({ ...formData, ciNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., CI-2024-456"
                      readOnly={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Packing List #
                    </label>
                    <input
                      type="text"
                      value={formData.packingListNumber}
                      onChange={(e) => setFormData({ ...formData, packingListNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., PL-2024-456"
                      readOnly={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      TC # GRS
                    </label>
                    <input
                      type="text"
                      value={formData.tcNumber}
                      onChange={(e) => setFormData({ ...formData, tcNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., TC-2024-123"
                      readOnly={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier
                    </label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Supplier name"
                      readOnly={!editMode}
                    />
                  </div>
                </>
              )}
              
              {isShip && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference ID <span className="text-xs text-gray-500">(Order Number)</span>
                    </label>
                    <input
                      type="text"
                      value={transaction.referenceId}
                      className="w-full px-3 py-2 border rounded-md bg-gray-100"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carrier
                    </label>
                    <select
                      value={formData.carrier}
                      onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                        !editMode ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                      disabled={!editMode}
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
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      value={formData.pickupDate ? new Date(formData.pickupDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      readOnly={!editMode}
                    />
                  </div>
                </>
              )}
              
              {isReceive && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ship Name
                    </label>
                    <input
                      type="text"
                      value={formData.shipName}
                      onChange={(e) => setFormData({ ...formData, shipName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., MV Ocean Star"
                      readOnly={!editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tracking Number
                      <span className="ml-1 text-gray-400 text-xs">(Container #)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., MSKU1234567"
                      readOnly={!editMode}
                    />
                  </div>
                </>
              )}
              
              {isShip && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number
                    <span className="ml-1 text-gray-400 text-xs">(FBA shipment ID)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., FBA15K7TRCBF"
                    readOnly={!editMode}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quantities */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Quantities</h3>
          {editMode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Editing quantities will adjust inventory balances</p>
                  <p>All changes are tracked in the audit log with your username and timestamp.</p>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cartons
              </label>
              <input
                type="number"
                value={formData.cartons}
                onChange={(e) => {
                  const cartons = parseInt(e.target.value) || 0
                  const units = cartons * formData.unitsPerCarton
                  setFormData({ ...formData, cartons, units })
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  editMode ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-100'
                }`}
                readOnly={!editMode}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units/Carton <span className="text-xs text-gray-500">{transaction?.unitsPerCarton ? '(Transaction-specific)' : '(From SKU)'}</span>
              </label>
              <input
                type="number"
                value={formData.unitsPerCarton}
                className="w-full px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed"
                readOnly
                title="Units per carton is defined by the SKU and cannot be changed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage Cartons/Pallet
              </label>
              <input
                type="number"
                value={formData.storageCartonsPerPallet}
                onChange={(e) => setFormData({ ...formData, storageCartonsPerPallet: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                readOnly={!editMode}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shipping Cartons/Pallet
              </label>
              <input
                type="number"
                value={formData.shippingCartonsPerPallet}
                onChange={(e) => setFormData({ ...formData, shippingCartonsPerPallet: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                readOnly={!editMode}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pallets
              </label>
              <input
                type="number"
                value={formData.pallets}
                onChange={(e) => setFormData({ ...formData, pallets: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  editMode ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-100'
                }`}
                readOnly={!editMode}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units
              </label>
              <input
                type="number"
                value={formData.units}
                className="w-full px-3 py-2 border rounded-md bg-gray-100"
                readOnly
                title="Units are calculated based on cartons × units per carton"
              />
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Required Documents</h3>
          {!editMode && Object.values(attachments).every(a => a === null) ? (
            <p className="text-sm text-gray-500">No documents attached. Edit transaction to upload documents.</p>
          ) : (
            <div className="space-y-4">
              {isReceive && (
                <>
                  <AttachmentField
                    label="Commercial Invoice"
                    category="commercialInvoice"
                    attachment={attachments.commercialInvoice}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, commercialInvoice: null }))}
                    disabled={!editMode}
                    uploadProgress={uploadProgress.commercialInvoice}
                  />
                  <AttachmentField
                    label="Bill of Lading"
                    category="billOfLading"
                    attachment={attachments.billOfLading}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, billOfLading: null }))}
                    disabled={!editMode}
                    uploadProgress={uploadProgress.billOfLading}
                  />
                  <AttachmentField
                    label="Packing List"
                    category="packingList"
                    attachment={attachments.packingList}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, packingList: null }))}
                    disabled={!editMode}
                    uploadProgress={uploadProgress.packingList}
                  />
                  <AttachmentField
                    label="Delivery Note"
                    category="deliveryNote"
                    attachment={attachments.deliveryNote}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, deliveryNote: null }))}
                    disabled={!editMode}
                    uploadProgress={uploadProgress.deliveryNote}
                  />
                  <AttachmentField
                    label="Cube Master Stacking Style for Storage Pallets"
                    category="cubeMaster"
                    attachment={attachments.cubeMaster}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, cubeMaster: null }))}
                    disabled={!editMode}
                    bgColor="bg-blue-50"
                    uploadProgress={uploadProgress.cubeMaster}
                  />
                  <AttachmentField
                    label="Transaction Certificate (TC) GRS"
                    category="transactionCertificate"
                    attachment={attachments.transactionCertificate}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, transactionCertificate: null }))}
                    disabled={!editMode}
                    bgColor="bg-green-50"
                    uploadProgress={uploadProgress.transactionCertificate}
                  />
                  <AttachmentField
                    label="Custom Declaration Document (CDS)"
                    category="customDeclaration"
                    attachment={attachments.customDeclaration}
                    onUpload={handleFileUpload}
                    onRemove={() => setAttachments(prev => ({ ...prev, customDeclaration: null }))}
                    disabled={!editMode}
                    bgColor="bg-yellow-50"
                    uploadProgress={uploadProgress.customDeclaration}
                  />
                </>
              )}
              
              {isShip && (
                <AttachmentField
                  label="Proof of Pickup"
                  category="proofOfPickup"
                  attachment={attachments.proofOfPickup}
                  onUpload={handleFileUpload}
                  onRemove={() => setAttachments(prev => ({ ...prev, proofOfPickup: null }))}
                  disabled={!editMode}
                  uploadProgress={uploadProgress.proofOfPickup}
                />
              )}
            </div>
          )}
        </div>


        {/* Metadata */}
        <div className="border rounded-lg p-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Transaction Metadata</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Created by:</span>
              <span className="ml-2 font-medium">{transaction.createdBy.fullName}</span>
            </div>
            <div>
              <span className="text-gray-600">Created at:</span>
              <span className="ml-2 font-medium">
                {new Date(transaction.createdAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Last updated:</span>
              <span className="ml-2 font-medium">
                {new Date(transaction.updatedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Transaction ID:</span>
              <span className="ml-2 font-medium font-mono">{transaction.transactionId}</span>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        {showAuditLog && (
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Audit Log</h3>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No changes recorded yet</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.action}</p>
                        {log.oldValue && log.newValue && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span>Changed from: </span>
                            <code className="bg-red-100 px-1 rounded">{JSON.stringify(log.oldValue)}</code>
                            <span> to </span>
                            <code className="bg-green-100 px-1 rounded">{JSON.stringify(log.newValue)}</code>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>{log.changedBy.fullName}</div>
                        <div>{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

// Attachment Field Component
function AttachmentField({ 
  label, 
  category, 
  attachment, 
  onUpload, 
  onRemove, 
  disabled,
  bgColor = 'bg-gray-50',
  uploadProgress
}: {
  label: string
  category: string
  attachment: Attachment | null
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, category: string) => void
  onRemove: () => void
  disabled: boolean
  bgColor?: string
  uploadProgress?: number
}) {
  return (
    <div className={`border rounded-lg p-4 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-medium text-sm">{label}</h4>
        </div>
        {attachment && (
          <span className="text-xs text-green-600 font-medium">✓ Uploaded</span>
        )}
      </div>
      {attachment ? (
        <div className="flex items-center justify-between bg-white p-2 rounded border">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">{attachment.name}</span>
            <span className="text-xs text-gray-500">({(attachment.size / 1024).toFixed(1)} KB)</span>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        !disabled && (
          uploadProgress !== undefined ? (
            <div className="border-2 border-blue-300 rounded p-2">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-xs text-blue-600">Uploading...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
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
                onChange={(e) => onUpload(e, category)}
                className="hidden"
              />
            </label>
          )
        )
      )}
    </div>
  )
}