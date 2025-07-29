'use client'

import React, { useState } from 'react'
import { HelpCircle, Info } from '@/lib/lucide-icons'

interface TooltipProps {
  content: string
  children?: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  icon?: 'help' | 'info'
  iconSize?: 'sm' | 'md' | 'lg'
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  icon = 'help',
  iconSize = 'sm'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  const Icon = icon === 'help' ? HelpCircle : Info

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || (
          <Icon className={`${sizeClasses[iconSize]} text-gray-400 hover:text-gray-600`} />
        )}
      </div>
      
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}>
          <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-xs">
            {content}
            <div 
              className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
                position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
                position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
                position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
                'left-[-4px] top-1/2 -translate-y-1/2'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Quick helper for inline tooltips
interface InlineTooltipProps {
  label: string
  tooltip: string
  required?: boolean
}

export function InlineTooltip({ label, tooltip, required }: InlineTooltipProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <Tooltip content={tooltip} iconSize="sm" />
    </div>
  )
}