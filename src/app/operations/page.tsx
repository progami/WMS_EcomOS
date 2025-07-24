import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { OperationsWorkflowHeader } from '@/components/operations/operations-workflow-header'
import Link from 'next/link'
import { 
  Package, 
  PackageOpen, 
  BookOpen, 
  Upload, 
  AlertTriangle, 
  TrendingUp,
  ArrowRight,
  ChevronRight,
  Truck
} from 'lucide-react'

interface OperationModule {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  details: string[]
}

interface OperationGroup {
  title: string
  description: string
  modules: OperationModule[]
  color: string
}

const operationGroups: OperationGroup[] = [
  {
    title: 'Outbound Operations',
    description: 'Plan and execute shipments to customers',
    color: 'border-purple-200 bg-purple-50',
    modules: [
      {
        title: 'Shipment Planning',
        description: 'Optimize and consolidate shipments for efficient delivery',
        href: '/market/shipment-planning',
        icon: TrendingUp,
        color: 'bg-purple-100 text-purple-700',
        details: [
          'Consolidate multiple orders into shipments',
          'Optimize pallet configuration',
          'Calculate shipping costs and timelines',
          'Generate shipping documentation'
        ]
      },
      {
        title: 'Ship Goods',
        description: 'Process outbound shipments and update inventory',
        href: '/operations/ship',
        icon: Truck,
        color: 'bg-purple-100 text-purple-700',
        details: [
          'Scan and verify items for shipment',
          'Deduct from inventory in real-time',
          'Print shipping labels and manifests',
          'Track shipment status'
        ]
      }
    ]
  },
  {
    title: 'Inbound Operations',
    description: 'Receive and process incoming inventory',
    color: 'border-green-200 bg-green-50',
    modules: [
      {
        title: 'Receive Goods',
        description: 'Record and verify incoming shipments into inventory',
        href: '/operations/receive',
        icon: Package,
        color: 'bg-green-100 text-green-700',
        details: [
          'Scan incoming items and pallets',
          'Verify against purchase orders',
          'Assign storage locations',
          'Update inventory counts automatically'
        ]
      }
    ]
  },
  {
    title: 'Reporting & Management',
    description: 'Track, analyze, and maintain inventory accuracy',
    color: 'border-blue-200 bg-blue-50',
    modules: [
      {
        title: 'Inventory Ledger',
        description: 'Complete transaction history and inventory movements',
        href: '/operations/inventory',
        icon: BookOpen,
        color: 'bg-blue-100 text-blue-700',
        details: [
          'View all inventory transactions',
          'Filter by date, product, or location',
          'Export detailed reports',
          'Audit trail for compliance'
        ]
      },
      {
        title: 'Import Attributes',
        description: 'Bulk update transaction data and attributes',
        href: '/operations/import-attributes',
        icon: Upload,
        color: 'bg-blue-100 text-blue-700',
        details: [
          'Import CSV files with transaction updates',
          'Bulk assign customer orders to shipments',
          'Update tracking numbers in bulk',
          'Validate data before importing'
        ]
      },
      {
        title: 'Pallet Variance',
        description: 'Identify and resolve inventory discrepancies',
        href: '/operations/pallet-variance',
        icon: AlertTriangle,
        color: 'bg-amber-100 text-amber-700',
        details: [
          'Compare system vs physical counts',
          'Track variance history and patterns',
          'Generate investigation reports',
          'Implement corrective actions'
        ]
      }
    ]
  }
]

export default function OperationsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Operations</h1>
          <p className="text-muted-foreground">
            Manage warehouse operations and inventory movements through an integrated workflow
          </p>
        </div>

        <OperationsWorkflowHeader />

        <div className="space-y-8">
          {operationGroups.map((group) => (
            <div key={group.title} className={`rounded-lg border-2 p-6 ${group.color}`}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{group.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{group.description}</p>
              </div>
              
              <div className={`grid grid-cols-1 gap-4 ${
                group.modules.length === 1 
                  ? 'md:grid-cols-1 max-w-md' 
                  : group.modules.length === 2 
                    ? 'md:grid-cols-2' 
                    : 'md:grid-cols-2 lg:grid-cols-3'
              }`}>
                {group.modules.map((module, moduleIndex) => (
                  <div key={module.href} className="relative">
                    <Link
                      href={module.href}
                      className="group block bg-white rounded-lg border p-6 hover:shadow-lg transition-all hover:border-gray-300"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className={`inline-flex p-2 rounded-lg ${module.color}`}>
                            <module.icon className="h-6 w-6" />
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-lg">{module.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {module.description}
                          </p>
                        </div>
                        
                        <ul className="space-y-1">
                          {module.details.slice(0, 3).map((detail, index) => (
                            <li key={index} className="text-xs text-gray-600 flex items-start">
                              <ChevronRight className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Link>
                    
                    {/* Workflow connector for modules within the same group */}
                    {moduleIndex < group.modules.length - 1 && (
                      <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                        <ArrowRight className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <h3 className="font-semibold mb-3 text-lg">Workflow Best Practices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Daily Operations Flow</h4>
              <ol className="space-y-1 text-gray-700">
                <li className="flex items-start">
                  <span className="font-medium mr-2">1.</span>
                  Start with <strong>Receive Goods</strong> for morning deliveries
                </li>
                <li className="flex items-start">
                  <span className="font-medium mr-2">2.</span>
                  Use <strong>Shipment Planning</strong> to optimize afternoon shipments
                </li>
                <li className="flex items-start">
                  <span className="font-medium mr-2">3.</span>
                  Process orders with <strong>Ship Goods</strong>
                </li>
                <li className="flex items-start">
                  <span className="font-medium mr-2">4.</span>
                  Review <strong>Inventory Ledger</strong> for daily reconciliation
                </li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">Weekly Maintenance Tasks</h4>
              <ul className="space-y-1 text-gray-700">
                <li className="flex items-start">
                  <ChevronRight className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                  Use <strong>Import Attributes</strong> for bulk updates from external systems
                </li>
                <li className="flex items-start">
                  <ChevronRight className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                  Check <strong>Pallet Variance</strong> to identify and resolve discrepancies
                </li>
                <li className="flex items-start">
                  <ChevronRight className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                  Generate reports from <strong>Inventory Ledger</strong> for management review
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}