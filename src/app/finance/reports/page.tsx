import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FileText, Download, DollarSign, TrendingUp, Package2, Calendar } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function FinanceReportsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Both admin and staff can access finance reports
  if (!['admin', 'staff'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const reports = [
    {
      name: 'Monthly Billing Summary',
      description: 'Consolidated charges by warehouse and category',
      icon: DollarSign,
      category: 'Financial',
      lastGenerated: 'Today',
      featured: true,
    },
    {
      name: 'Invoice Reconciliation Report',
      description: 'Compare expected vs actual charges',
      icon: FileText,
      category: 'Financial',
      lastGenerated: 'Yesterday',
      featured: true,
    },
    {
      name: 'Storage Cost Analysis',
      description: 'Weekly storage charges breakdown',
      icon: Package2,
      category: 'Operations',
      lastGenerated: '2 days ago',
    },
    {
      name: 'Cost Variance Report',
      description: 'Identify billing discrepancies',
      icon: TrendingUp,
      category: 'Financial',
      lastGenerated: 'Last week',
    },
    {
      name: 'Warehouse Performance',
      description: 'Cost efficiency by warehouse',
      icon: TrendingUp,
      category: 'Analytics',
      lastGenerated: 'Last week',
    },
    {
      name: 'Annual Cost Trends',
      description: 'Year-over-year cost analysis',
      icon: Calendar,
      category: 'Analytics',
      lastGenerated: 'Monthly',
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Reports</h1>
            <p className="text-muted-foreground">
              Generate and download financial reports
            </p>
          </div>
          <button className="action-button">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Reports
          </button>
        </div>

        {/* Featured Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Featured Reports</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reports.filter(r => r.featured).map((report, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="badge-primary">{report.category}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{report.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{report.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Last generated: {report.lastGenerated}
                  </p>
                  <button className="inline-flex items-center text-sm text-primary hover:text-primary/80 font-medium">
                    <Download className="h-4 w-4 mr-1" />
                    Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4">All Reports</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {reports.filter(r => !r.featured).map((report, index) => (
              <div
                key={index}
                className="bg-white border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <report.icon className="h-8 w-8 text-gray-400 group-hover:text-primary transition-colors" />
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {report.category}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-primary mb-1">
                  {report.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">{report.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {report.lastGenerated}
                  </p>
                  <button className="inline-flex items-center text-sm text-primary hover:text-primary/80 font-medium">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Report Builder */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Custom Report Builder</h3>
              <p className="text-sm text-gray-600">Create custom reports with specific filters</p>
            </div>
            <button className="action-button">
              Create Custom Report
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <Package2 className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-medium">By Warehouse</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-medium">By Period</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-medium">By Cost Type</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-medium">Trends</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}