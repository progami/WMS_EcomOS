import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Construction, Hammer, Wrench } from '@/lib/lucide-icons'

export default async function OrderManagementPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Order Management"
        />

        <div className="mt-8 flex flex-col items-center justify-center text-center py-16">
          <div className="relative">
            <Construction className="h-24 w-24 text-yellow-500 mb-6" />
            <Hammer className="h-8 w-8 text-yellow-600 absolute -right-2 -top-2 animate-bounce" />
            <Wrench className="h-8 w-8 text-yellow-600 absolute -left-2 bottom-0 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Under Construction
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
            We're working hard to bring you the Order Management module. 
            This feature will allow you to track and manage customer orders, 
            handle fulfillment workflows, and integrate with e-commerce platforms.
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-lg">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Coming Soon Features:
            </h3>
            <ul className="text-left text-yellow-800 dark:text-yellow-200 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Create and manage customer orders</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Order status tracking and updates</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Automated fulfillment workflows</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Integration with shipping carriers</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Order history and analytics</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
            Expected availability: Q2 2024
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}