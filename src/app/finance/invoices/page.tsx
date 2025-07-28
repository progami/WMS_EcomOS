'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, FileText, Plus, Search, Eye, CreditCard, AlertCircle, Check, X, Loader2, Upload } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Invoice {
  id: string
  invoiceNumber: string
  warehouse: {
    id: string
    code: string
    name: string
  }
  billingPeriodStart: string
  billingPeriodEnd: string
  invoiceDate: string
  dueDate: string | null
  totalAmount: number
  status: 'pending' | 'reconciled' | 'disputed' | 'paid'
  lineItems: any[]
  reconciliations: any[]
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export default function FinanceInvoicesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      if (selectedStatus) params.append('status', selectedStatus)

      const response = await fetch(`/api/invoices?${params}`)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      
      const data = await response.json()
      setInvoices(data.invoices)
      setPagination(data.pagination)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  // Fetch warehouses
  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data = await response.json()
      setWarehouses(data)
    } catch (error) {
    }
  }

  useEffect(() => {
    fetchInvoices()
    fetchWarehouses()
  }, [pagination.page, searchTerm, selectedWarehouse, selectedStatus])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresManualEntry) {
          // Handle PDF manual entry
          router.push('/finance/invoices/new?manual=true&filename=' + encodeURIComponent(data.fileName))
        } else {
          throw new Error(data.error || 'Upload failed')
        }
      } else {
        // Success - refresh invoices
        await fetchInvoices()
        alert('Invoice uploaded successfully!')
      }
    } catch (error) {
      alert('Failed to upload invoice')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle invoice actions
  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/finance/invoices/${invoiceId}`)
  }

  const handleProcessInvoice = (invoiceId: string) => {
    router.push(`/finance/reconciliation?invoiceId=${invoiceId}`)
  }

  const handlePayInvoice = async (invoiceId: string) => {
    const paymentMethod = prompt('Enter payment method (e.g., Bank Transfer, Check, Wire):')
    if (!paymentMethod) return

    const paymentReference = prompt('Enter payment reference number:')
    if (!paymentReference) return

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentMethod,
          paymentReference,
          paymentDate: new Date().toISOString(),
          notes: 'Accepted via invoice list'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept invoice')
      }
      
      await fetchInvoices()
      alert('Invoice accepted and marked for payment!')
    } catch (error: any) {
      alert(error.message || 'Failed to accept invoice')
    }
  }

  const handleDisputeInvoice = async (invoiceId: string) => {
    const reason = prompt('Enter dispute reason:')
    if (!reason) return

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          generalDisputeReason: reason,
          notes: 'Disputed via invoice list',
          contactWarehouse: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to dispute invoice')
      }
      
      const result = await response.json()
      await fetchInvoices()
      alert(`Invoice disputed successfully! ${result.disputedItems} items disputed totaling ${formatCurrency(result.totalDisputedAmount)}`)
    } catch (error: any) {
      alert(error.message || 'Failed to dispute invoice')
    }
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ type: 'invoices' })
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      
      const response = await fetch(`/api/export?${params}`)
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('Failed to export data')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge-warning'
      case 'reconciled':
        return 'badge-info'
      case 'disputed':
        return 'badge-error'
      case 'paid':
        return 'badge-success'
      default:
        return 'badge'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Invoice Management</h1>
              <p className="text-muted-foreground">
                Process and manage warehouse invoices
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExport}
                className="secondary-button"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <Link 
                href="/finance/invoices/new"
                className="action-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice number, warehouse, or amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <select 
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="reconciled">Reconciled</option>
            <option value="disputed">Disputed</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* Invoice Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Billing Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">Loading invoices...</p>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.warehouse.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(invoice.status)}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleViewInvoice(invoice.id)}
                        className="text-primary hover:text-primary/80 mr-3"
                      >
                        <Eye className="h-4 w-4 inline" />
                        <span className="ml-1">View</span>
                      </button>
                      {invoice.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleProcessInvoice(invoice.id)}
                            className="text-primary hover:text-primary/80 mr-3"
                          >
                            Process
                          </button>
                          <button 
                            onClick={() => handleDisputeInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4 inline" />
                            <span className="ml-1">Dispute</span>
                          </button>
                        </>
                      )}
                      {invoice.status === 'reconciled' && (
                        <>
                          <button 
                            onClick={() => handlePayInvoice(invoice.id)}
                            className="text-green-600 hover:text-green-700 mr-3"
                          >
                            <Check className="h-4 w-4 inline" />
                            <span className="ml-1">Accept</span>
                          </button>
                          <button 
                            onClick={() => handleDisputeInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4 inline" />
                            <span className="ml-1">Dispute</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border rounded-lg">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.totalCount}</span>{' '}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}