// Dashboard sub-components to reduce main component size
import { ReactNode } from 'react'
import { LucideIcon } from '@/lib/lucide-icons'

// Export the component interfaces for reuse
export interface EnhancedDashboardCardProps {
  title: string
  value: string
  description: string
  icon: LucideIcon
  trend: string
  trendUp: boolean | null
  sparklineData: number[]
  color: string
}

export interface SystemActionProps {
  title: string
  description: string
  icon: LucideIcon
  onClick: () => void
  loading?: boolean
  danger?: boolean
}

export interface StatusItemProps {
  label: string
  status: string
  indicator?: 'success' | 'warning' | 'error'
  icon?: LucideIcon
  details?: string
}

export interface InfoItemProps {
  label: string
  value: string
  icon?: LucideIcon
}

// Note: The actual component implementations should be moved here from the main dashboard file
// This would significantly reduce the size of the dashboard page component