'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar, FileText, Package } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ReportAction {
  type: string
  period?: string
  warehouseId?: string
}

interface Warehouse {
  id: string
  name: string
}

export function AdminReportsClient() {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)
  const [customReportType, setCustomReportType] = useState('monthly-inventory')
  const [customPeriod, setCustomPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [customWarehouseId, setCustomWarehouseId] = useState('')
  const [customFormat, setCustomFormat] = useState('xlsx')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [generatingCustom, setGeneratingCustom] = useState(false)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data)
      }
    } catch (error) {
      // console.error('Error fetching warehouses:', error)
    }
  }

  const generateReport = async (reportType: string, reportName: string) => {
    setGeneratingReport(reportType)
    
    try {
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const period = `${year}-${month.toString().padStart(2, '0')}`

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          period,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `${reportType}-${period}.xlsx`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${reportName} generated successfully!`)
    } catch (error) {
      // console.error('Report generation error:', error)
      toast.error('Failed to generate report')
    } finally {
      setGeneratingReport(null)
    }
  }

  const generateCustomReport = async () => {
    setGeneratingCustom(true)
    
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: customReportType,
          period: customPeriod,
          warehouseId: customWarehouseId || undefined,
          format: customFormat
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `${customReportType}-${customPeriod}.${customFormat}`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Custom report generated successfully!')
    } catch (error) {
      // console.error('Custom report generation error:', error)
      toast.error('Failed to generate custom report')
    } finally {
      setGeneratingCustom(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Storage Reports */}
      <ReportSection
        title="Storage Reports"
        icon={Package}
        reports={[
          {
            name: 'Weekly Storage Summary',
            description: 'Storage charges by week for all warehouses',
            action: () => generateReport('storage-charges', 'Weekly Storage Summary'),
            loading: generatingReport === 'storage-charges',
          },
          {
            name: 'Monthly Storage Report',
            description: 'Detailed monthly storage costs by SKU',
            action: () => generateReport('monthly-inventory', 'Monthly Storage Report'),
            loading: generatingReport === 'monthly-inventory',
          },
          {
            name: 'Storage by SKU',
            description: 'Current storage costs broken down by SKU',
            action: () => generateReport('cost-summary', 'Storage by SKU'),
            loading: generatingReport === 'cost-summary',
          },
        ]}
      />

      {/* Financial Reports */}
      <ReportSection
        title="Financial Reports"
        icon={FileText}
        reports={[
          {
            name: 'Invoice Reconciliation',
            description: 'Compare invoiced amounts with calculated costs',
            action: () => generateReport('reconciliation', 'Invoice Reconciliation'),
            loading: generatingReport === 'reconciliation',
          },
          {
            name: 'Cost Analysis',
            description: 'Detailed breakdown of all warehouse costs',
            action: () => generateReport('cost-analysis', 'Cost Analysis'),
            loading: generatingReport === 'cost-analysis',
          },
          {
            name: 'Monthly Billing Summary',
            description: 'Summary of all charges for the billing period',
            action: () => generateReport('monthly-billing', 'Monthly Billing Summary'),
            loading: generatingReport === 'monthly-billing',
          },
        ]}
      />

      {/* Inventory Reports */}
      <ReportSection
        title="Inventory Reports"
        icon={Package}
        reports={[
          {
            name: 'Current Stock Levels',
            description: 'Real-time inventory levels across all warehouses',
            action: () => generateReport('inventory-balance', 'Current Stock Levels'),
            loading: generatingReport === 'inventory-balance',
          },
          {
            name: 'Inventory Ledger',
            description: 'All inventory movements for the period',
            action: () => generateReport('inventory-ledger', 'Inventory Ledger'),
            loading: generatingReport === 'inventory-ledger',
          },
          {
            name: 'Low Stock Alert',
            description: 'Items below minimum stock levels',
            action: () => generateReport('low-stock', 'Low Stock Alert'),
            loading: generatingReport === 'low-stock',
          },
        ]}
      />

      {/* Custom Reports */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Custom Reports
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Report Type</label>
              <select 
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={customReportType}
                onChange={(e) => setCustomReportType(e.target.value)}
              >
                <option value="monthly-inventory">Monthly Inventory</option>
                <option value="inventory-ledger">Inventory Ledger</option>
                <option value="storage-charges">Storage Charges</option>
                <option value="cost-summary">Cost Summary</option>
                <option value="inventory-balance">Current Inventory Balance</option>
                <option value="reconciliation">Invoice Reconciliation</option>
                <option value="cost-analysis">Cost Analysis</option>
                <option value="monthly-billing">Monthly Billing Summary</option>
                <option value="analytics-summary">Analytics Summary</option>
                <option value="performance-metrics">Performance Metrics</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <input
                type="month"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={customPeriod}
                onChange={(e) => setCustomPeriod(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Warehouse</label>
            <select 
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={customWarehouseId}
              onChange={(e) => setCustomWarehouseId(e.target.value)}
            >
              <option value="">All Warehouses</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Export Format</label>
            <select 
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={customFormat}
              onChange={(e) => setCustomFormat(e.target.value)}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>
          <button
            onClick={generateCustomReport}
            disabled={generatingCustom}
            className="w-full md:w-auto px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingCustom ? 'Generating...' : 'Generate Custom Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ReportSectionProps {
  title: string
  icon: React.ElementType
  reports: {
    name: string
    description: string
    action: () => void
    loading?: boolean
  }[]
}

function ReportSection({ title, icon: Icon, reports }: ReportSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report.name}
            className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
            onClick={report.action}
          >
            <h4 className="font-medium mb-1">{report.name}</h4>
            <p className="text-sm text-muted-foreground mb-3">
              {report.description}
            </p>
            <button
              disabled={report.loading}
              className="inline-flex items-center text-sm text-primary hover:underline disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-1" />
              {report.loading ? 'Generating...' : 'Download'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}