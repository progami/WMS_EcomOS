'use client'

import dynamic from 'next/dynamic'

// Lazy load heavy chart components to improve initial page load
const createLazyChart = (chartName: string) =>
  dynamic<any>(() => import('recharts').then((mod) => ({ default: mod[chartName] })), {
    ssr: false,
    loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
  })

// Lazy loaded chart components
export const AreaChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.AreaChart })), { ssr: false })
export const BarChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.BarChart })), { ssr: false })
export const LineChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.LineChart })), { ssr: false })
export const PieChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.PieChart })), { ssr: false })
export const RadarChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.RadarChart })), { ssr: false })
export const ComposedChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.ComposedChart })), { ssr: false })
export const ScatterChart = dynamic<any>(() => import('recharts').then((mod) => ({ default: mod.ScatterChart })), { ssr: false })

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