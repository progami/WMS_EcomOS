import Link from 'next/link'
import { 
  DollarSign, 
  FileText, 
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
  Calendar,
  FileSpreadsheet
} from '@/lib/lucide-icons'

interface FinSectionProps {
  data?: {
    storageCost?: string
    costChange?: string
    costTrend?: 'up' | 'down' | 'neutral'
    pendingInvoices?: number
    overdueInvoices?: number
    reconciliationStatus?: {
      matched: number
      mismatched: number
      pending: number
    }
    recentInvoices?: Array<{
      id: string
      clientName: string
      amount: string
      status: 'pending' | 'paid' | 'overdue'
      date: string
    }>
  }
  loading?: boolean
}

export function FinSection({ data, loading }: FinSectionProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Key Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Storage Cost</p>
              <h3 className="text-2xl font-bold mt-1">£{data?.storageCost || '--'}</h3>
              <div className="flex items-center gap-2 mt-2">
                {data?.costTrend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                ) : data?.costTrend === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {data?.costChange ? `${data.costTrend === 'up' ? '+' : ''}${data.costChange}%` : 'No change'}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Invoices</p>
              <h3 className="text-2xl font-bold mt-1">{data?.pendingInvoices || 0}</h3>
              {data?.overdueInvoices ? (
                <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
                  <AlertCircle className="h-3 w-3" />
                  <span>{data.overdueInvoices} overdue</span>
                </div>
              ) : (
                <p className="text-xs text-green-600 mt-2">All current</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <FileText className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Reconciliation</p>
              <div className="mt-1">
                {data?.reconciliationStatus ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{data.reconciliationStatus.matched}</span>
                      <span className="text-sm text-green-600">matched</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-red-600">{data.reconciliationStatus.mismatched} mismatched</span>
                      <span className="text-gray-600">{data.reconciliationStatus.pending} pending</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">--</p>
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Calculator className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Storage Cost Link */}
      <Link 
        href="/finance/storage-ledger" 
        className="block border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">View Storage Cost Trends</h3>
              <p className="text-sm text-muted-foreground">Detailed weekly and monthly cost analysis</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </Link>

      {/* Recent Invoices */}
      {data?.recentInvoices && data.recentInvoices.length > 0 && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Invoices</h3>
            <Link href="/finance/invoices" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentInvoices.slice(0, 3).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <div>
                    <p className="text-sm font-medium">{invoice.clientName}</p>
                    <p className="text-xs text-muted-foreground">Invoice #{invoice.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">£{invoice.amount}</p>
                  <p className={`text-xs ${
                    invoice.status === 'paid' ? 'text-green-600' :
                    invoice.status === 'overdue' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}