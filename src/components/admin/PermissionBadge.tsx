'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PermissionBadgeProps {
  permission: string
  granted?: boolean
  className?: string
}

export function PermissionBadge({ permission, granted = true, className }: PermissionBadgeProps) {
  const [resource, action] = permission.split(':')
  
  const getResourceColor = (resource: string) => {
    const colors: Record<string, string> = {
      invoice: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
      inventory: 'bg-green-500/10 text-green-700 border-green-500/20',
      warehouse: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
      user: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
      sku: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
      rate: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
      report: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
      settings: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
      audit: 'bg-red-500/10 text-red-700 border-red-500/20',
      transaction: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
      cost: 'bg-pink-500/10 text-pink-700 border-pink-500/20',
      demo: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      amazon: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
      export: 'bg-lime-500/10 text-lime-700 border-lime-500/20',
      import: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
    }
    return colors[resource] || 'bg-gray-500/10 text-gray-700 border-gray-500/20'
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        granted ? getResourceColor(resource) : 'bg-gray-100 text-gray-400 border-gray-300 line-through',
        className
      )}
    >
      {resource}:{action}
    </Badge>
  )
}