import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BarChart3, TrendingUp, Package2, Users, Activity, PieChart } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { ExportButton } from '@/components/common/export-button'
import type { Sku } from '@prisma/client'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Both admin and staff can access analytics
  if (!['admin', 'staff'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  // Get analytics data
  const totalTransactions = await prisma.inventoryTransaction.count()
  const totalWarehouses = await prisma.warehouse.count()
  const activeUsers = await prisma.user.count({ where: { isActive: true } })
  
  const inventoryValue = await prisma.inventoryBalance.aggregate({
    _sum: { currentCartons: true }
  })

  // Get top SKUs by volume
  const topSkus = await prisma.inventoryBalance.groupBy({
    by: ['skuId'],
    _sum: { currentCartons: true },
    orderBy: { _sum: { currentCartons: 'desc' } },
    take: 5,
  })

  const skus = await prisma.sku.findMany({
    where: { id: { in: topSkus.map(s => s.skuId) } }
  })

  const skuMap = new Map<string, Sku>(skus.map(s => [s.id, s]))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Operational insights and performance metrics
            </p>
          </div>
          <ExportButton
            endpoint="/api/reports"
            fileName="analytics_summary"
            buttonText="Export Analytics"
            formats={['xlsx', 'csv', 'pdf']}
          />
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="dashboard-card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Inventory</p>
                <h2 className="text-3xl font-bold text-blue-900 mt-1">
                  {(inventoryValue._sum.currentCartons || 0).toLocaleString()}
                </h2>
                <p className="text-xs text-blue-600 mt-1">Cartons in stock</p>
              </div>
              <Package2 className="h-10 w-10 text-blue-400" />
            </div>
          </div>

          <div className="dashboard-card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Transactions</p>
                <h2 className="text-3xl font-bold text-green-900 mt-1">{totalTransactions}</h2>
                <p className="text-xs text-green-600 mt-1">All time</p>
              </div>
              <Activity className="h-10 w-10 text-green-400" />
            </div>
          </div>

          <div className="dashboard-card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Warehouses</p>
                <h2 className="text-3xl font-bold text-purple-900 mt-1">{totalWarehouses}</h2>
                <p className="text-xs text-purple-600 mt-1">Active locations</p>
              </div>
              <BarChart3 className="h-10 w-10 text-purple-400" />
            </div>
          </div>

          <div className="dashboard-card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Active Users</p>
                <h2 className="text-3xl font-bold text-amber-900 mt-1">{activeUsers}</h2>
                <p className="text-xs text-amber-600 mt-1">System users</p>
              </div>
              <Users className="h-10 w-10 text-amber-400" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Top SKUs */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Top SKUs by Volume
            </h3>
            <div className="space-y-3">
              {topSkus.map((item, index) => {
                const sku = skuMap.get(item.skuId)
                const total = inventoryValue._sum.currentCartons || 1
                const percentage = ((item._sum.currentCartons || 0) / total) * 100
                
                return (
                  <div key={item.skuId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium text-gray-500">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{sku?.skuCode || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{sku?.description || ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{(item._sum.currentCartons || 0).toLocaleString()}</p>
                      <p className="text-sm text-gray-500">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trend Analysis */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Trends
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium">Inventory Growth</p>
                  <p className="text-sm text-gray-600">Month over month</p>
                </div>
                <p className="text-xl font-bold text-green-600">+12.5%</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">Transaction Volume</p>
                  <p className="text-sm text-gray-600">Weekly average</p>
                </div>
                <p className="text-xl font-bold text-blue-600">43.5</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="font-medium">Warehouse Utilization</p>
                  <p className="text-sm text-gray-600">Average capacity</p>
                </div>
                <p className="text-xl font-bold text-purple-600">67%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">98.5%</p>
              <p className="text-sm text-gray-600 mt-1">Order Accuracy</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">24h</p>
              <p className="text-sm text-gray-600 mt-1">Avg. Processing Time</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">156</p>
              <p className="text-sm text-gray-600 mt-1">Daily Transactions</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">3.2</p>
              <p className="text-sm text-gray-600 mt-1">Inventory Turns</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}