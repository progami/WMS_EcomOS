import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Download, Calendar, TrendingUp, Package, DollarSign, FileText } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AdminReportsClient } from './client-page'
import { prisma } from '@/lib/prisma'

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login')
  }

  // Fetch current stats
  const currentMonth = new Date()
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  
  const [storageCost, movements, invoices] = await Promise.all([
    // Total storage cost this month
    prisma.storageLedger.aggregate({
      where: {
        weekEndingDate: {
          gte: startOfMonth,
          lte: currentMonth
        }
      },
      _sum: {
        calculatedWeeklyCost: true
      }
    }),
    // Total movements this month
    prisma.inventoryTransaction.count({
      where: {
        transactionDate: {
          gte: startOfMonth,
          lte: currentMonth
        }
      }
    }),
    // Invoices this month
    prisma.invoice.count({
      where: {
        invoiceDate: {
          gte: startOfMonth,
          lte: currentMonth
        }
      }
    })
  ])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Generate and view comprehensive reports
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Storage Cost"
            value={`£${(storageCost._sum.calculatedWeeklyCost || 0).toFixed(2)}`}
            period="This Month"
            change="+12%"
            icon={DollarSign}
          />
          <StatCard
            title="Inventory Turnover"
            value="4.2x"
            period="Last 30 Days"
            change="+0.5"
            icon={TrendingUp}
          />
          <StatCard
            title="Total Movements"
            value={movements.toString()}
            period="This Month"
            change="+8%"
            icon={Package}
          />
          <StatCard
            title="Invoices Processed"
            value={invoices.toString()}
            period="This Month"
            change="+15%"
            icon={FileText}
          />
        </div>

        {/* Report Generation Section */}
        <AdminReportsClient />

        {/* Recent Reports */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Recently Generated Reports</h3>
          <div className="text-sm text-muted-foreground">
            No reports generated yet. Select a report type above to get started.
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface StatCardProps {
  title: string
  value: string
  period: string
  change: string
  icon: React.ElementType
}

function StatCard({ title, value, period, change, icon: Icon }: StatCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs text-green-600">{change}</span>
      </div>
      <h3 className="text-2xl font-bold">{value}</h3>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{period}</p>
    </div>
  )
}

interface ReportItemProps {
  title: string
  description: string
  icon: React.ElementType
  onClick: () => void
}

function ReportItem({ title, description, icon: Icon, onClick }: ReportItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}