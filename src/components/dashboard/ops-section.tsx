import Link from 'next/link'
import { 
  Package, 
  Package2, 
  ArrowRight,
  Activity,
  Warehouse,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from '@/components/charts/RechartsComponents'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

interface OpsSectionProps {
  data?: {
    totalInventory?: number
    inventoryChange?: string
    inventoryTrend?: 'up' | 'down' | 'neutral'
    activeSkus?: number
    warehouseDistribution?: Array<{
      name: string
      value: number
      percentage: number
    }>
    recentTransactions?: Array<{
      id: string
      type: string
      sku: string
      quantity: number
      warehouse: string
      date: string
    }>
  }
  loading?: boolean
}

export function OpsSection({ data, loading }: OpsSectionProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Inventory</p>
              <h3 className="text-2xl font-bold mt-1">{data?.totalInventory?.toLocaleString() || '--'}</h3>
              <div className="flex items-center gap-2 mt-2">
                {data?.inventoryTrend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : data?.inventoryTrend === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {data?.inventoryChange ? `${data.inventoryTrend === 'up' ? '+' : ''}${data.inventoryChange}%` : 'No change'}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active SKUs</p>
              <h3 className="text-2xl font-bold mt-1">{data?.activeSkus || '--'}</h3>
              <p className="text-xs text-muted-foreground mt-2">Products in stock</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Package2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Warehouses</p>
              <h3 className="text-2xl font-bold mt-1">{data?.warehouseDistribution?.length || 0}</h3>
              <p className="text-xs text-muted-foreground mt-2">
                {data?.warehouseDistribution 
                  ? `${data.warehouseDistribution.reduce((sum, w) => sum + w.value, 0).toLocaleString()} total cartons`
                  : 'Active locations'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Warehouse className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Distribution */}
      {data?.warehouseDistribution && data.warehouseDistribution.length > 0 && (
        <div className="border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Warehouse Distribution</h3>
            <p className="text-sm text-muted-foreground">Current inventory across locations</p>
          </div>
          <div className="h-64 sm:h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.warehouseDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3">
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.value.toLocaleString()} cartons ({data.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {data.warehouseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data?.recentTransactions && data.recentTransactions.length > 0 && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Link href="/operations/inventory" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentTransactions.slice(0, 3).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    transaction.type === 'RECEIVE' ? 'bg-green-100 dark:bg-green-900/30' :
                    transaction.type === 'SHIP' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {transaction.type === 'RECEIVE' ? (
                      <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400 rotate-180" />
                    ) : transaction.type === 'SHIP' ? (
                      <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{transaction.sku}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.quantity} cartons • {transaction.warehouse}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(transaction.date), 'MMM dd, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions - Streamlined to core daily operations */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/operations/receive" className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-medium">Receive</span>
        </Link>
        <Link href="/operations/ship" className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Package2 className="h-5 w-5 text-primary" />
          <span className="font-medium">Ship</span>
        </Link>
      </div>
    </div>
  )
}