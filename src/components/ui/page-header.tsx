import React from 'react'
import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  description?: string
  icon?: LucideIcon
  iconColor?: string
  bgColor?: string
  borderColor?: string
  textColor?: string
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor = 'text-blue-600',
  bgColor = 'bg-blue-50',
  borderColor = 'border-blue-200',
  textColor = 'text-blue-800',
  actions
}: PageHeaderProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

// Helpful tips component that can be added below forms or tables
interface HelpfulTipsProps {
  title?: string
  tips: string[]
  icon?: LucideIcon
  iconColor?: string
  bgColor?: string
  borderColor?: string
  textColor?: string
}

export function HelpfulTips({
  title = 'Helpful Tips:',
  tips,
  icon: Icon,
  iconColor = 'text-blue-600',
  bgColor = 'bg-blue-50',
  borderColor = 'border-blue-200',
  textColor = 'text-blue-800'
}: HelpfulTipsProps) {
  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-start">
        {Icon && (
          <Icon className={`h-5 w-5 ${iconColor} mt-0.5 mr-3 flex-shrink-0`} />
        )}
        <div className={`text-sm ${textColor}`}>
          <p className="font-semibold mb-1">{title}</p>
          <ul className="list-disc list-inside space-y-1">
            {tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}