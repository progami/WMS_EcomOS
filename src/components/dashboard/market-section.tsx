import Link from 'next/link'
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  RefreshCw,
  Cloud,
  ArrowRight,
  AlertTriangle,
  Calendar
} from 'lucide-react'
import {
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area
} from '@/components/charts/RechartsComponents'

interface MarketSectionProps {
  data?: {
    amazonMetrics?: {
      pendingShipments: number
      inboundInventory: number
      activeListings: number
    }
    reorderAlerts?: number
    plannedShipments?: number
    inventoryTrend?: Array<{ date: string; inventory: number }>
  }
  loading?: boolean
}

export function MarketSection({ data, loading }: MarketSectionProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Inventory Trend Chart */}
      {data?.inventoryTrend && data.inventoryTrend.length > 0 && (
        <div className="mb-6">
          <div className="border rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Inventory Levels Trend</h3>
              <p className="text-sm text-muted-foreground">Daily inventory for reorder planning</p>
            </div>
            <div className="h-64 sm:h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.inventoryTrend} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
                      if (!value) return ''
                      const date = new Date(value)
                      if (isNaN(date.getTime())) return ''
                      // Format as M/D for better spacing
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Inventory']}
                    labelFormatter={(label) => {
                      if (!label) return ''
                      const date = new Date(label)
                      if (isNaN(date.getTime())) return ''
                      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="inventory" 
                    stroke="#3B82F6" 
                    fillOpacity={1} 
                    fill="url(#colorInventory)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Amazon FBA Summary */}
        <Link href="/market/amazon" className="border rounded-lg p-4 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold">Amazon FBA</h3>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Pending Shipments: {data?.amazonMetrics?.pendingShipments || 0}</p>
              <p>Inbound Inventory: {data?.amazonMetrics?.inboundInventory || 0}</p>
              <p>Active Listings: {data?.amazonMetrics?.activeListings || 0}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
        </div>
      </Link>

      {/* Reorder Management */}
      <Link href="/market/shipment-planning" className="border rounded-lg p-4 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Reorder Management</h3>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold">{data?.reorderAlerts || 0}</p>
              <p className="text-sm text-muted-foreground">Items below threshold</p>
              {(data?.reorderAlerts || 0) > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Action required</span>
                </div>
              )}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
        </div>
      </Link>

      {/* Shipment Planning */}
      <Link href="/market/shipment-planning" className="border rounded-lg p-4 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Shipment Planning</h3>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold">{data?.plannedShipments || 0}</p>
              <p className="text-sm text-muted-foreground">Upcoming shipments</p>
              <p className="text-xs text-gray-500 mt-2">Next 7 days</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
        </div>
      </Link>

        {/* Quick Actions - Streamlined to single most relevant action */}
        <div className="md:col-span-2 lg:col-span-3 mt-2">
          <Link href="/market/shipment-planning" className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-medium">Plan New Shipment</span>
          </Link>
        </div>
      </div>
    </div>
  )
}