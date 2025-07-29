import { 
  TrendingUp
} from '@/lib/lucide-icons'
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
      {data?.inventoryTrend && data.inventoryTrend.length > 0 ? (
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
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No inventory data available
        </div>
      )}
    </div>
  )
}