'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  DollarSign, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  PieChart
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'

// Helper function to get relative time
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  } else if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}

export default function FinanceDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [financialData, setFinancialData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (session && !hasFetched) {
      setHasFetched(true)
      fetchFinancialData()
    } else if (status === 'authenticated' && !session) {
      router.push('/auth/login')
    }
  }, [session, hasFetched, status, router])

  const fetchFinancialData = async () => {
    try {
      const response = await fetch('/api/finance/dashboard')
      if (response.ok) {
        const data = await response.json()
        setFinancialData(data)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch financial data' }))
        toast.error(errorData.details || errorData.error || 'Failed to fetch financial data')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch financial data')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  // Get current billing period (16th to 15th)
  const today = new Date()
  const billingStart = today.getDate() >= 16 
    ? new Date(today.getFullYear(), today.getMonth(), 16)
    : new Date(today.getFullYear(), today.getMonth() - 1, 16)
  const billingEnd = new Date(billingStart)
  billingEnd.setMonth(billingEnd.getMonth() + 1)
  billingEnd.setDate(15)

  const handleExportFinancialReport = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'monthly-billing',
          period: `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Financial report exported successfully!')
      }
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Actions */}
        <PageHeader
          title="Finance Dashboard"
          subtitle={`Billing Period: ${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`}
          icon={DollarSign}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
          textColor="text-emerald-800"
          actions={
            <button
              type="button"
              onClick={handleExportFinancialReport}
              className="action-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </button>
          }
        />

        {/* Financial KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {financialData ? (
            <>
              <FinancialCard
                title="Total Revenue"
                value={`£${parseFloat(financialData.kpis.totalRevenue).toLocaleString()}`}
                change={`${financialData.kpis.revenueChange > 0 ? '+' : ''}${financialData.kpis.revenueChange}%`}
                trend={financialData.kpis.revenueChange > 0 ? 'up' : financialData.kpis.revenueChange < 0 ? 'down' : 'neutral'}
                icon={DollarSign}
                color="green"
                description="This billing period"
              />
              <FinancialCard
                title="Outstanding Invoices"
                value={`£${parseFloat(financialData.kpis.outstandingAmount).toLocaleString()}`}
                change={`${financialData.kpis.outstandingCount} invoices`}
                trend="neutral"
                icon={FileText}
                color="amber"
                description="Pending payment"
              />
              <FinancialCard
                title="Cost Variance"
                value={`${financialData.kpis.costVariance}%`}
                change={`£${parseFloat(financialData.kpis.costSavings).toLocaleString()} ${financialData.kpis.costVariance < 0 ? 'saved' : 'over'}`}
                trend={financialData.kpis.costVariance < 0 ? 'down' : 'up'}
                icon={TrendingUp}
                color="blue"
                description="vs. invoiced"
              />
              <FinancialCard
                title="Collection Rate"
                value={`${financialData.kpis.collectionRate}%`}
                change="This period"
                trend={parseFloat(financialData.kpis.collectionRate) >= 90 ? 'up' : 'down'}
                icon={CheckCircle}
                color="purple"
                description="Payments received"
              />
            </>
          ) : (
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-6 rounded-lg border animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-32 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            ))
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 bg-white dark:bg-gray-800 border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Cost Breakdown by Category
            </h3>
            {financialData?.costBreakdown && financialData.costBreakdown.length > 0 ? (
              <>
                <div className="space-y-4">
                  {financialData.costBreakdown.map((item: any, index: number) => {
                    const total = financialData.costBreakdown.reduce((sum: number, cat: any) => sum + cat.amount, 0)
                    const percentage = total > 0 ? (item.amount / total) * 100 : 0
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-gray-500']
                    return (
                      <CostCategory
                        key={item.category}
                        name={item.category}
                        amount={item.amount}
                        percentage={percentage}
                        color={colors[index % colors.length]}
                      />
                    )
                  })}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Costs</span>
                    <span className="text-xl font-bold">
                      £{financialData.costBreakdown.reduce((sum: number, cat: any) => sum + cat.amount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No cost data available for this period
              </div>
            )}
          </div>

          {/* Invoice Status Summary */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Status
            </h3>
            {financialData?.invoiceStatus ? (
              <div className="space-y-3">
                <InvoiceStatus 
                  status="Paid" 
                  count={financialData.invoiceStatus.paid.count} 
                  amount={financialData.invoiceStatus.paid.amount} 
                  icon={CheckCircle} 
                  color="text-green-600" 
                />
                <InvoiceStatus 
                  status="Pending" 
                  count={financialData.invoiceStatus.pending.count} 
                  amount={financialData.invoiceStatus.pending.amount} 
                  icon={Clock} 
                  color="text-amber-600" 
                />
                <InvoiceStatus 
                  status="Overdue" 
                  count={financialData.invoiceStatus.overdue.count} 
                  amount={financialData.invoiceStatus.overdue.amount} 
                  icon={AlertCircle} 
                  color="text-red-600" 
                />
                <InvoiceStatus 
                  status="Disputed" 
                  count={financialData.invoiceStatus.disputed.count} 
                  amount={financialData.invoiceStatus.disputed.amount} 
                  icon={XCircle} 
                  color="text-gray-400" 
                />
              </div>
            ) : (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Financial Actions & Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Financial Actions */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Financial Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <FinancialAction
                title="Process Invoice"
                description="Record new 3PL invoice"
                icon={CreditCard}
                href="/finance/invoices/new"
              />
              <FinancialAction
                title="Reconciliation"
                description="Match invoices to costs"
                icon={Calculator}
                href="/finance/reconciliation"
              />
              <FinancialAction
                title="Cost Analysis"
                description="View detailed breakdown"
                icon={PieChart}
                href="/finance/reports"
              />
              <FinancialAction
                title="Rate Management"
                description="Update 3PL rates"
                icon={DollarSign}
                href="/config/rates"
              />
            </div>
          </div>

          {/* Recent Financial Activity */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Financial Activity
            </h3>
            {financialData?.recentActivity && financialData.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {financialData.recentActivity.map((activity: any) => {
                  const timeAgo = getTimeAgo(new Date(activity.time))
                  return (
                    <ActivityItem
                      key={activity.id}
                      type={activity.type}
                      title={activity.title}
                      amount={activity.amount}
                      time={timeAgo}
                      status={activity.status}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            )}
          </div>
        </div>

        {/* Billing Calendar & Deadlines */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Billing Calendar & Deadlines
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CalendarItem
              title="Invoice Cutoff"
              date={new Date(billingEnd.getTime() + 5 * 24 * 60 * 60 * 1000)}
              status="upcoming"
              description="3PL invoice submission deadline"
            />
            <CalendarItem
              title="Reconciliation Due"
              date={new Date(billingEnd.getTime() + 10 * 24 * 60 * 60 * 1000)}
              status="upcoming"
              description="Complete cost matching"
            />
            <CalendarItem
              title="Payment Due"
              date={new Date(billingEnd.getTime() + 30 * 24 * 60 * 60 * 1000)}
              status="future"
              description="3PL payment deadline"
            />
            <CalendarItem
              title="Month Close"
              date={new Date(billingEnd.getTime() + 15 * 24 * 60 * 60 * 1000)}
              status="future"
              description="Financial closing"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface FinancialCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  color: 'green' | 'amber' | 'blue' | 'purple'
  description: string
}

function FinancialCard({ title, value, change, trend, icon: Icon, color, description }: FinancialCardProps) {
  const colorClasses = {
    green: 'from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20',
    amber: 'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20',
    blue: 'from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20',
    purple: 'from-purple-50 to-pink-50 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20',
  }

  const iconColors = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
  }

  return (
    <div className={`p-6 rounded-lg border bg-gradient-to-br ${colorClasses[color]} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          <div className="flex items-center gap-2 mt-2">
            {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-green-600" />}
            {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-600" />}
            <span className="text-sm text-gray-600">{change}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <Icon className={`h-8 w-8 ${iconColors[color]}`} />
      </div>
    </div>
  )
}

interface CostCategoryProps {
  name: string
  amount: number
  percentage: number
  color: string
}

function CostCategory({ name, amount, percentage, color }: CostCategoryProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-sm font-semibold">£{amount.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="text-xs text-gray-500">{percentage}% of total</div>
    </div>
  )
}

interface InvoiceStatusProps {
  status: string
  count: number
  amount: number
  icon: React.ElementType
  color: string
}

function InvoiceStatus({ status, count, amount, icon: Icon, color }: InvoiceStatusProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium">{status}</span>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      <span className="text-sm font-semibold">£{amount.toLocaleString()}</span>
    </div>
  )
}

interface FinancialActionProps {
  title: string
  description: string
  icon: React.ElementType
  href: string
}

function FinancialAction({ title, description, icon: Icon, href }: FinancialActionProps) {
  return (
    <Link href={href} className="block">
      <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg hover:shadow-lg transition-all hover:border-primary cursor-pointer">
        <Icon className="h-6 w-6 text-primary mb-2" />
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </Link>
  )
}

interface ActivityItemProps {
  type: 'invoice' | 'payment' | 'reconciliation' | 'alert'
  title: string
  amount: number
  time: string
  status: 'success' | 'warning' | 'info'
}

function ActivityItem({ type, title, amount, time, status }: ActivityItemProps) {
  const statusColors = {
    success: 'text-green-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  }

  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{time}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${statusColors[status]}`}>
          £{amount.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

interface CalendarItemProps {
  title: string
  date: Date
  status: 'overdue' | 'upcoming' | 'future'
  description: string
}

function CalendarItem({ title, date, status, description }: CalendarItemProps) {
  const statusClasses = {
    overdue: 'bg-red-100 dark:bg-red-900/20 border-red-300',
    upcoming: 'bg-amber-100 dark:bg-amber-900/20 border-amber-300',
    future: 'bg-white dark:bg-gray-800 border-gray-300',
  }

  return (
    <div className={`p-4 rounded-lg border ${statusClasses[status]}`}>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-gray-600 mt-1">{date.toLocaleDateString()}</p>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </div>
  )
}