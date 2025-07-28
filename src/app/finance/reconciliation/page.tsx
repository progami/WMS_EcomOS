'use client'

import React, { useState, useEffect } from 'react'
import { Calculator, AlertCircle, CheckCircle, XCircle, FileText, Save, MessageSquare, Loader2, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ReconciliationItem {
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
  reconciliationDetails?: {
    id: string
    calculatedCost: {
      id: string
      transactionReferenceId: string
      transactionType: string
      transactionDate: string
      quantityCharged: number
      calculatedCost: number
      sku: {
        skuCode: string
        description: string
      }
    }
  }[]
}

interface InvoiceReconciliation {
  id: string
  invoiceNumber: string
  warehouse: {
    id: string
    name: string
    code: string
  }
  billingPeriodStart: string
  billingPeriodEnd: string
  totalAmount: number
  status: string
  reconciliations: ReconciliationItem[]
}

export default function FinanceReconciliationPage() {
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId')
  
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [invoices, setInvoices] = useState<InvoiceReconciliation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())

  // Fetch warehouses
  useEffect(() => {
    fetchWarehouses()
  }, [])

  // Fetch reconciliation data
  useEffect(() => {
    if (invoiceId) {
      fetchSingleInvoiceReconciliation(invoiceId)
    } else {
      fetchReconciliationData()
    }
  }, [invoiceId, selectedPeriod, selectedWarehouse])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data = await response.json()
      setWarehouses(data)
    } catch (error) {
    }
  }

  const fetchSingleInvoiceReconciliation = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) throw new Error('Failed to fetch invoice')
      
      const data = await response.json()
      const invoice = data.invoice
      
      // Format for reconciliation view
      setInvoices([{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        warehouse: invoice.warehouse,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        reconciliations: invoice.reconciliations || []
      }])
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const fetchReconciliationData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      if (selectedPeriod) {
        // Parse period to get start/end dates
        const [year, month] = selectedPeriod.split('-')
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 16)
        const endDate = new Date(parseInt(year), parseInt(month), 15)
        params.append('startDate', startDate.toISOString())
        params.append('endDate', endDate.toISOString())
      }
      
      params.append('status', 'pending,reconciled,disputed')
      const response = await fetch(`/api/invoices?${params}`)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      
      const data = await response.json()
      setInvoices(data.invoices)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const runReconciliation = async () => {
    setProcessing(true)
    try {
      // This would trigger a batch reconciliation process
      const response = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          period: selectedPeriod
        })
      })
      
      if (!response.ok) throw new Error('Failed to run reconciliation')
      
      alert('Reconciliation process completed!')
      await fetchReconciliationData()
    } catch (error) {
      alert('Failed to run reconciliation')
    } finally {
      setProcessing(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedItem || !resolutionNote.trim()) return
    
    try {
      const response = await fetch(`/api/reconciliation/${selectedItem.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionNotes: resolutionNote
        })
      })
      
      if (!response.ok) throw new Error('Failed to add note')
      
      alert('Note added successfully!')
      setNoteModalOpen(false)
      setResolutionNote('')
      setSelectedItem(null)
      
      // Refresh data
      if (invoiceId) {
        await fetchSingleInvoiceReconciliation(invoiceId)
      } else {
        await fetchReconciliationData()
      }
    } catch (error) {
      alert('Failed to add note')
    }
  }

  const handleCreateDispute = async (invoiceId: string) => {
    if (!confirm('Create a dispute for this invoice?')) return
    
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disputed' })
      })
      
      if (!response.ok) throw new Error('Failed to create dispute')
      
      alert('Dispute created successfully!')
      
      // Refresh data
      if (invoiceId === invoiceId) {
        await fetchSingleInvoiceReconciliation(invoiceId)
      } else {
        await fetchReconciliationData()
      }
    } catch (error) {
      alert('Failed to create dispute')
    }
  }

  const calculateTotals = () => {
    const totals = invoices.reduce((acc, inv) => {
      const invTotals = inv.reconciliations.reduce((invAcc, item) => ({
        expectedAmount: invAcc.expectedAmount + item.expectedAmount,
        invoicedAmount: invAcc.invoicedAmount + item.invoicedAmount,
        difference: invAcc.difference + item.difference,
        matched: invAcc.matched + (item.status === 'match' ? 1 : 0),
        total: invAcc.total + 1
      }), { expectedAmount: 0, invoicedAmount: 0, difference: 0, matched: 0, total: 0 })
      
      return {
        expectedAmount: acc.expectedAmount + invTotals.expectedAmount,
        invoicedAmount: acc.invoicedAmount + invTotals.invoicedAmount,
        difference: acc.difference + invTotals.difference,
        matched: acc.matched + invTotals.matched,
        total: acc.total + invTotals.total
      }
    }, { expectedAmount: 0, invoicedAmount: 0, difference: 0, matched: 0, total: 0 })
    
    return {
      ...totals,
      matchRate: totals.total > 0 ? (totals.matched / totals.total) * 100 : 0
    }
  }

  const totals = calculateTotals()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const toggleItemExpansion = async (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
      
      // Load details if not already loaded
      const item = invoices.flatMap(i => i.reconciliations).find(r => r.id === itemId)
      if (item && !item.reconciliationDetails) {
        setLoadingDetails(prev => new Set(prev).add(itemId))
        
        try {
          const response = await fetch(`/api/reconciliation/${itemId}/details`)
          if (response.ok) {
            const data = await response.json()
            
            // Update the item with details
            setInvoices(prevInvoices => 
              prevInvoices.map(invoice => ({
                ...invoice,
                reconciliations: invoice.reconciliations.map(rec => 
                  rec.id === itemId 
                    ? { ...rec, reconciliationDetails: data.details }
                    : rec
                )
              }))
            )
          }
        } catch (error) {
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev)
            newSet.delete(itemId)
            return newSet
          })
        }
      }
    }
    
    setExpandedItems(newExpanded)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Invoice Reconciliation</h1>
              <p className="text-muted-foreground">
                Compare expected vs actual charges
              </p>
            </div>
            <div className="flex items-center gap-2">
            {!invoiceId && (
              <>
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
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Periods</option>
                  <option value="2024-01">Jan 16 - Feb 15, 2024</option>
                  <option value="2023-12">Dec 16 - Jan 15, 2024</option>
                  <option value="2023-11">Nov 16 - Dec 15, 2023</option>
                </select>
                <button 
                  onClick={runReconciliation}
                  disabled={processing}
                  className="action-button"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Run Reconciliation
                    </>
                  )}
                </button>
              </>
            )}
            {invoiceId && (
              <Link
                href="/finance/reconciliation"
                className="secondary-button"
              >
                View All Reconciliations
              </Link>
            )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.invoicedAmount)}</p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Total Expected</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.expectedAmount)}</p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Variance</p>
            <p className={`text-2xl font-bold ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(Math.abs(totals.difference))}
            </p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Match Rate</p>
            <p className="text-2xl font-bold text-green-600">{totals.matchRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Reconciliation Details */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No invoices found for reconciliation</p>
            </div>
          ) : (
            invoices.map((invoice) => {
              const invoiceTotals = invoice.reconciliations.reduce((acc, item) => ({
                expected: acc.expected + item.expectedAmount,
                invoiced: acc.invoiced + item.invoicedAmount,
                difference: acc.difference + item.difference
              }), { expected: 0, invoiced: 0, difference: 0 })
              
              const hasMatch = invoice.reconciliations.every(r => r.status === 'match')
              
              return (
                <div key={invoice.id} className="border rounded-lg overflow-hidden">
                  <div className={`px-6 py-4 ${
                    hasMatch ? 'bg-green-50' : 'bg-amber-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hasMatch ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold">{invoice.warehouse.name}</h3>
                          <p className="text-sm text-gray-600">
                            Invoice #{invoice.invoiceNumber} • 
                            {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Variance</p>
                        <p className={`text-lg font-bold ${
                          invoiceTotals.difference === 0 ? 'text-green-600' : 
                          invoiceTotals.difference > 0 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {formatCurrency(Math.abs(invoiceTotals.difference))}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {invoice.reconciliations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No reconciliation data available</p>
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="mt-2 text-primary hover:underline"
                        >
                          View Invoice Details
                        </Link>
                      </div>
                    ) : (
                      <>
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-sm text-gray-600">
                              <th className="pb-2">Cost Category</th>
                              <th className="pb-2">Description</th>
                              <th className="pb-2 text-right">Expected</th>
                              <th className="pb-2 text-right">Invoiced</th>
                              <th className="pb-2 text-right">Difference</th>
                              <th className="pb-2 text-center">Status</th>
                              <th className="pb-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {invoice.reconciliations.map((item) => (
                              <React.Fragment key={item.id}>
                                <tr className="hover:bg-gray-50">
                                  <td className="py-2">
                                    <div className="flex items-center gap-2">
                                      {item.status !== 'match' && (
                                        <button
                                          onClick={() => toggleItemExpansion(item.id)}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          {expandedItems.has(item.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </button>
                                      )}
                                      {item.costCategory}
                                    </div>
                                  </td>
                                  <td className="py-2">{item.costName}</td>
                                  <td className="py-2 text-right">{formatCurrency(item.expectedAmount)}</td>
                                  <td className="py-2 text-right">{formatCurrency(item.invoicedAmount)}</td>
                                  <td className="py-2 text-right">
                                    <span className={item.difference > 0 ? 'text-red-600' : item.difference < 0 ? 'text-green-600' : ''}>
                                      {formatCurrency(Math.abs(item.difference))}
                                    </span>
                                  </td>
                                  <td className="py-2 text-center">
                                    {item.status === 'match' ? (
                                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                    ) : item.status === 'overbilled' ? (
                                      <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-amber-600 mx-auto" />
                                    )}
                                  </td>
                                  <td className="py-2">
                                    {item.resolutionNotes ? (
                                      <div className="text-sm">
                                        <p className="text-gray-700">{item.resolutionNotes}</p>
                                        {item.resolvedBy && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            - {item.resolvedBy.fullName}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setSelectedItem(item)
                                          setNoteModalOpen(true)
                                        }}
                                        className="text-xs text-primary hover:underline"
                                      >
                                        Add note
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {expandedItems.has(item.id) && (
                                  <tr>
                                    <td colSpan={7} className="bg-gray-50 px-8 py-4">
                                      {loadingDetails.has(item.id) ? (
                                        <div className="flex items-center justify-center py-4">
                                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                        </div>
                                      ) : item.reconciliationDetails && item.reconciliationDetails.length > 0 ? (
                                        <div className="space-y-2">
                                          <h5 className="font-medium text-sm mb-2">Transaction Details</h5>
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr className="text-xs text-gray-500">
                                                <th className="text-left pb-1">Transaction ID</th>
                                                <th className="text-left pb-1">Type</th>
                                                <th className="text-left pb-1">Date</th>
                                                <th className="text-left pb-1">SKU</th>
                                                <th className="text-right pb-1">Quantity</th>
                                                <th className="text-right pb-1">Cost</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                              {item.reconciliationDetails.map(detail => (
                                                <tr key={detail.id} className="hover:bg-white">
                                                  <td className="py-1 font-mono text-xs">
                                                    {detail.calculatedCost.transactionReferenceId}
                                                  </td>
                                                  <td className="py-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                      detail.calculatedCost.transactionType === 'RECEIVE' ? 'bg-green-100 text-green-800' :
                                                      detail.calculatedCost.transactionType === 'SHIP' ? 'bg-red-100 text-red-800' :
                                                      detail.calculatedCost.transactionType === 'STORAGE' ? 'bg-blue-100 text-blue-800' :
                                                      'bg-gray-100 text-gray-800'
                                                    }`}>
                                                      {detail.calculatedCost.transactionType}
                                                    </span>
                                                  </td>
                                                  <td className="py-1">
                                                    {formatDate(detail.calculatedCost.transactionDate)}
                                                  </td>
                                                  <td className="py-1">
                                                    <div>
                                                      <div className="font-medium">{detail.calculatedCost.sku.skuCode}</div>
                                                      <div className="text-xs text-gray-500">{detail.calculatedCost.sku.description}</div>
                                                    </div>
                                                  </td>
                                                  <td className="py-1 text-right">
                                                    {detail.calculatedCost.quantityCharged}
                                                  </td>
                                                  <td className="py-1 text-right">
                                                    {formatCurrency(detail.calculatedCost.calculatedCost)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-500">No transaction details available</p>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                          <tfoot className="border-t">
                            <tr className="font-semibold">
                              <td className="pt-2" colSpan={2}>Total</td>
                              <td className="pt-2 text-right">{formatCurrency(invoiceTotals.expected)}</td>
                              <td className="pt-2 text-right">{formatCurrency(invoiceTotals.invoiced)}</td>
                              <td className="pt-2 text-right">
                                <span className={invoiceTotals.difference > 0 ? 'text-red-600' : invoiceTotals.difference < 0 ? 'text-green-600' : ''}>
                                  {formatCurrency(Math.abs(invoiceTotals.difference))}
                                </span>
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                        
                        <div className="mt-4 flex gap-2 justify-between">
                          <Link
                            href={`/finance/invoices/${invoice.id}`}
                            className="text-primary hover:underline"
                          >
                            View Invoice Details
                          </Link>
                          {invoiceTotals.difference !== 0 && invoice.status !== 'disputed' && (
                            <button 
                              onClick={() => handleCreateDispute(invoice.id)}
                              className="action-button"
                            >
                              Create Dispute
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Note Modal */}
        {noteModalOpen && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">Add Resolution Note</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {selectedItem.costCategory} - {selectedItem.costName}
                </p>
                <p className="text-sm">
                  Difference: <span className={selectedItem.difference > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatCurrency(Math.abs(selectedItem.difference))}
                  </span>
                </p>
              </div>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                placeholder="Enter resolution notes..."
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setNoteModalOpen(false)
                    setResolutionNote('')
                    setSelectedItem(null)
                  }}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!resolutionNote.trim()}
                  className="action-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}