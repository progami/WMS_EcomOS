'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Edit, Trash2, AlertCircle, CheckCircle, XCircle, Clock, DollarSign } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'

interface InvoiceDetail {
  id: string
  invoiceNumber: string
  warehouse: {
    id: string
    code: string
    name: string
    address?: string
    contactEmail?: string
    contactPhone?: string
  }
  billingPeriodStart: string
  billingPeriodEnd: string
  invoiceDate: string
  dueDate: string | null
  totalAmount: number
  status: 'pending' | 'reconciled' | 'disputed' | 'paid'
  lineItems: Array<{
    id: string
    costCategory: string
    costName: string
    quantity: number
    unitRate?: number
    amount: number
    }>
  reconciliations: Array<{
    id: string
    costCategory: string
    costName: string
    expectedAmount: number
    invoicedAmount: number
    difference: number
    status: 'match' | 'overbilled' | 'underbilled'
    resolutionNotes?: string
    resolvedBy?: {
      fullName: string
      email: string
    }
    resolvedAt?: string
  }>
  createdBy: {
    fullName: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

interface Summary {
  totalLineItems: number
  totalReconciliations: number
  matchedItems: number
  overbilledItems: number
  underbilledItems: number
  totalExpected: number
  totalInvoiced: number
  totalDifference: number
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'reconciliation'>('details')
  const [id, setId] = useState<string>('')

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (id) {
      fetchInvoice()
    }
  }, [id])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) throw new Error('Failed to fetch invoice')
      
      const data = await response.json()
      setInvoice(data.invoice)
      setSummary(data.summary)
    } catch (error) {
      // console.error('Error fetching invoice:', error)
      alert('Failed to load invoice')
      router.push('/finance/invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!confirm(`Update invoice status to ${newStatus}?`)) return

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update invoice')
      
      await fetchInvoice()
      alert('Invoice status updated!')
    } catch (error) {
      // console.error('Error updating invoice:', error)
      alert('Failed to update invoice')
    }
  }

  const handleAcceptInvoice = async () => {
    const paymentMethod = prompt('Enter payment method (e.g., Bank Transfer, Check, Wire):')
    if (!paymentMethod) return

    const paymentReference = prompt('Enter payment reference number:')
    if (!paymentReference) return

    try {
      const response = await fetch(`/api/invoices/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentMethod,
          paymentReference,
          paymentDate: new Date().toISOString(),
          notes: 'Accepted via invoice detail page'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept invoice')
      }
      
      const result = await response.json()
      await fetchInvoice()
      alert(`Invoice accepted and marked for payment! ${result.acceptedItems} items accepted.`)
    } catch (error: any) {
      // console.error('Error accepting invoice:', error)
      alert(error.message || 'Failed to accept invoice')
    }
  }

  const handleDisputeInvoice = async () => {
    const reason = prompt('Enter dispute reason:')
    if (!reason) return

    try {
      const response = await fetch(`/api/invoices/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          generalDisputeReason: reason,
          notes: 'Disputed via invoice detail page',
          contactWarehouse: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to dispute invoice')
      }
      
      const result = await response.json()
      await fetchInvoice()
      alert(`Invoice disputed successfully! ${result.disputedItems} items disputed totaling ${formatCurrency(result.totalDisputedAmount)}`)
    } catch (error: any) {
      // console.error('Error disputing invoice:', error)
      alert(error.message || 'Failed to dispute invoice')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete invoice')
      }
      
      alert('Invoice deleted successfully!')
      router.push('/finance/invoices')
    } catch (error: any) {
      // console.error('Error deleting invoice:', error)
      alert(error.message || 'Failed to delete invoice')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/export?type=invoices&invoiceId=${id}`)
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoice?.invoiceNumber}-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      // console.error('Error exporting:', error)
      alert('Failed to export invoice')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'reconciled':
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      case 'disputed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'paid':
        return <DollarSign className="h-5 w-5 text-green-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getReconciliationStatusBadge = (status: string) => {
    switch (status) {
      case 'match':
        return 'badge-success'
      case 'overbilled':
        return 'badge-error'
      case 'underbilled':
        return 'badge-warning'
      default:
        return 'badge'
    }
  }

  if (loading || !invoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600">Loading invoice...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/finance/invoices"
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
              <p className="text-muted-foreground">
                {invoice.warehouse.name} • {formatDate(invoice.invoiceDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="secondary-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            {invoice.status === 'reconciled' && (
              <>
                <button
                  onClick={handleAcceptInvoice}
                  className="action-button"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept & Pay
                </button>
                <button
                  onClick={handleDisputeInvoice}
                  className="secondary-button"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dispute
                </button>
              </>
            )}
            {invoice.status === 'pending' && (
              <button
                onClick={handleDisputeInvoice}
                className="secondary-button"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Dispute
              </button>
            )}
            {invoice.status !== 'paid' && (
              <>
                <Link
                  href={`/finance/invoices/${id}/edit`}
                  className="secondary-button"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 px-4 py-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status and Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Status</h3>
              {getStatusIcon(invoice.status)}
            </div>
            <p className="text-2xl font-bold capitalize">{invoice.status}</p>
            {invoice.status === 'pending' && (
              <button
                onClick={() => handleStatusUpdate('reconciled')}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Mark as Reconciled
              </button>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Amount</h3>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(invoice.totalAmount)}
            </p>
            <p className="text-sm text-gray-500">{invoice.lineItems.length} line items</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Reconciliation</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{summary?.matchedItems || 0}</span>
              <span className="text-sm text-gray-500">matched</span>
            </div>
            <div className="flex gap-4 text-sm mt-1">
              <span className="text-red-600">{summary?.overbilledItems || 0} over</span>
              <span className="text-yellow-600">{summary?.underbilledItems || 0} under</span>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Variance</h3>
            <p className={`text-2xl font-bold ${(summary?.totalDifference || 0) > 0 ? 'text-red-600' : (summary?.totalDifference || 0) < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(Math.abs(summary?.totalDifference || 0))}
            </p>
            <p className="text-sm text-gray-500">
              {(summary?.totalDifference || 0) > 0 ? 'Overbilled' : (summary?.totalDifference || 0) < 0 ? 'Underbilled' : 'No variance'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border rounded-lg">
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'details'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Invoice Details
              </button>
              <button
                onClick={() => setActiveTab('reconciliation')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'reconciliation'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Reconciliation ({summary?.totalReconciliations || 0})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'details' ? (
              <div className="space-y-6">
                {/* Invoice Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Invoice Information</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-600">Invoice Number</dt>
                        <dd className="font-medium">{invoice.invoiceNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Billing Period</dt>
                        <dd className="font-medium">
                          {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Invoice Date</dt>
                        <dd className="font-medium">{formatDate(invoice.invoiceDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Due Date</dt>
                        <dd className="font-medium">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : 'Not specified'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Warehouse Information</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-600">Name</dt>
                        <dd className="font-medium">{invoice.warehouse.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Code</dt>
                        <dd className="font-medium">{invoice.warehouse.code}</dd>
                      </div>
                      {invoice.warehouse.contactEmail && (
                        <div>
                          <dt className="text-sm text-gray-600">Email</dt>
                          <dd className="font-medium">{invoice.warehouse.contactEmail}</dd>
                        </div>
                      )}
                      {invoice.warehouse.contactPhone && (
                        <div>
                          <dt className="text-sm text-gray-600">Phone</dt>
                          <dd className="font-medium">{invoice.warehouse.contactPhone}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h3 className="font-semibold mb-3">Line Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Rate
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoice.lineItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm">{item.costCategory}</td>
                            <td className="px-4 py-3 text-sm">{item.costName}</td>
                            <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              {item.unitRate ? formatCurrency(item.unitRate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-semibold">
                            Total:
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-lg">
                            {formatCurrency(invoice.totalAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="space-y-4">
                {invoice.reconciliations.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No reconciliation data available</p>
                    <Link
                      href={`/finance/reconciliation?invoiceId=${invoice.id}`}
                      className="mt-4 inline-flex items-center text-primary hover:underline"
                    >
                      Start Reconciliation Process
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">Expected Total</h4>
                        <p className="text-xl font-bold">{formatCurrency(summary?.totalExpected || 0)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">Invoiced Total</h4>
                        <p className="text-xl font-bold">{formatCurrency(summary?.totalInvoiced || 0)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">Total Variance</h4>
                        <p className={`text-xl font-bold ${(summary?.totalDifference || 0) > 0 ? 'text-red-600' : (summary?.totalDifference || 0) < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {formatCurrency(Math.abs(summary?.totalDifference || 0))}
                        </p>
                      </div>
                    </div>

                    {/* Reconciliation Items */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cost Name
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Expected
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Invoiced
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Difference
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Resolution
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invoice.reconciliations.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 text-sm">{item.costCategory}</td>
                              <td className="px-4 py-3 text-sm">{item.costName}</td>
                              <td className="px-4 py-3 text-sm text-right">
                                {formatCurrency(item.expectedAmount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {formatCurrency(item.invoicedAmount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium">
                                <span className={item.difference > 0 ? 'text-red-600' : item.difference < 0 ? 'text-green-600' : ''}>
                                  {formatCurrency(Math.abs(item.difference))}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={getReconciliationStatusBadge(item.status)}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {item.resolutionNotes ? (
                                  <div>
                                    <p className="text-gray-700">{item.resolutionNotes}</p>
                                    {item.resolvedBy && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        by {item.resolvedBy.fullName} on {item.resolvedAt ? formatDate(item.resolvedAt) : ''}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Link
                        href={`/finance/reconciliation?invoiceId=${invoice.id}`}
                        className="action-button"
                      >
                        Manage Reconciliation
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p>
            Created by {invoice.createdBy.fullName} on {formatDate(invoice.createdAt)}
            {invoice.updatedAt !== invoice.createdAt && (
              <> • Last updated {formatDate(invoice.updatedAt)}</>
            )}
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}