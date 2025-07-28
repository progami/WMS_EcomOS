'use client'

import dynamic from 'next/dynamic'

// Lazy load heavy chart components to improve initial page load
// Fixed for Next.js 15 compatibility
export const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const RadarChart = dynamic(() => import('recharts').then(mod => mod.RadarChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const ComposedChart = dynamic(() => import('recharts').then(mod => mod.ComposedChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

export const ScatterChart = dynamic(() => import('recharts').then(mod => mod.ScatterChart), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-gray-100 rounded" />
})

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