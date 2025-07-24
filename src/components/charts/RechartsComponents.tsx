'use client'

import dynamic from 'next/dynamic'

// Lazy load heavy chart components to improve initial page load
const createLazyChart = (chartName: string) =>
  dynamic<any>(() => import('recharts').then((mod) => mod[chartName] as any), {
    ssr: false,
    loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
  })

// Lazy loaded chart components
export const AreaChart = createLazyChart('AreaChart')
export const BarChart = createLazyChart('BarChart')
export const LineChart = createLazyChart('LineChart')
export const PieChart = createLazyChart('PieChart')
export const RadarChart = createLazyChart('RadarChart')
export const ComposedChart = createLazyChart('ComposedChart')
export const ScatterChart = createLazyChart('ScatterChart')

// Re-export lightweight components directly
export {
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Pie,
  Cell,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Scatter,
  ZAxis
} from 'recharts'