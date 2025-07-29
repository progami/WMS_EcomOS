import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'
import { 
  DollarSign, 
  FileText, 
  Calculator, 
  Calendar, 
  BarChart3,
  ArrowRight
} from '@/lib/lucide-icons'

const financeModules = [
  {
    title: 'Invoices',
    description: 'Manage customer invoices',
    href: '/finance/invoices',
    icon: FileText,
    color: 'bg-blue-100 text-blue-700'
  },
  {
    title: 'Reconciliation',
    description: 'Match invoices with expected charges',
    href: '/finance/reconciliation',
    icon: Calculator,
    color: 'bg-purple-100 text-purple-700'
  },
  {
    title: 'Storage Ledger',
    description: 'Weekly storage cost calculations',
    href: '/finance/storage-ledger',
    icon: Calendar,
    color: 'bg-amber-100 text-amber-700'
  },
  {
    title: 'Cost Ledger',
    description: 'Detailed cost breakdown',
    href: '/finance/cost-ledger',
    icon: BarChart3,
    color: 'bg-indigo-100 text-indigo-700'
  },
  {
    title: 'Reports',
    description: 'Financial reports and analytics',
    href: '/finance/reports',
    icon: BarChart3,
    color: 'bg-red-100 text-red-700'
  }
]

export default function FinancePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-muted-foreground">
            Manage invoicing, billing, and financial reconciliation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {financeModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group relative rounded-lg border p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className={`inline-flex p-2 rounded-lg ${module.color}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{module.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        <div className="border rounded-lg p-6 bg-green-50">
          <h3 className="font-semibold mb-2">Billing Cycle</h3>
          <p className="text-sm text-gray-700 mb-2">
            Our billing period runs from the <strong>16th of each month to the 15th of the following month</strong>.
          </p>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• Storage costs are calculated weekly (Monday snapshots)</li>
            <li>• Invoices are generated after the 15th of each month</li>
            <li>• Use Reconciliation to verify warehouse charges</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}