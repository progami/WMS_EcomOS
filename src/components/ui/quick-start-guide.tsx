'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  CheckCircle, 
  Package, 
  FileText, 
  DollarSign, 
  BarChart3,
  ArrowRight,
  BookOpen
} from '@/lib/lucide-icons'

interface GuideStep {
  title: string
  description: string
  icon: React.ElementType
  link: string
  completed?: boolean
}

interface QuickStartGuideProps {
  userRole: string
}

export function QuickStartGuide({ userRole }: QuickStartGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dismissedPermanently, setDismissedPermanently] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check localStorage after component mounts to avoid hydration mismatch
    const dismissed = localStorage.getItem('quickStartDismissed') === 'true'
    setDismissedPermanently(dismissed)
    setIsOpen(!dismissed)
    setIsLoading(false)
  }, [])

  if (isLoading || dismissedPermanently) return null

  const guideSteps: Record<string, GuideStep[]> = {
    admin: [
      {
        title: 'Set Up Warehouses',
        description: 'Configure your warehouses and storage settings',
        icon: Package,
        link: '/config/warehouses'
      },
      {
        title: 'Configure SKUs',
        description: 'Add product SKUs and set up tracking parameters',
        icon: Package,
        link: '/config/products'
      },
      {
        title: 'Define Cost Rates',
        description: 'Set storage and handling rates for accurate billing',
        icon: DollarSign,
        link: '/config/rates'
      },
    ],
    staff: [
      {
        title: 'Check Inventory',
        description: 'Review current stock levels and warehouses',
        icon: Package,
        link: '/operations/inventory'
      },
      {
        title: 'Process Transactions',
        description: 'Receive shipments and ship orders',
        icon: Package,
        link: '/operations/receive'
      },
      {
        title: 'Process Invoices',
        description: 'Upload and reconcile warehouse invoices',
        icon: FileText,
        link: '/finance/invoices'
      },
      {
        title: 'Generate Reports',
        description: 'Create custom reports for business insights',
        icon: FileText,
        link: '/reports'
      }
    ]
  }

  const steps = guideSteps[userRole] || guideSteps.staff

  const handleDismiss = () => {
    setIsOpen(false)
  }

  const handleDismissPermanently = () => {
    localStorage.setItem('quickStartDismissed', 'true')
    setDismissedPermanently(true)
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">Quick Start Guide</h3>
            <p className="text-sm text-gray-600">Get started with your warehouse management tasks</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const isDisabled = (step as any).disabled
          const Component = isDisabled ? 'div' : 'a'
          
          return (
            <Component
              key={index}
              href={isDisabled ? undefined : step.link}
              className={`bg-white p-4 rounded-lg border ${
                isDisabled 
                  ? 'border-gray-200 opacity-60 cursor-not-allowed' 
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isDisabled ? 'bg-gray-100' : 'bg-blue-100 group-hover:bg-blue-200 transition-colors'
                }`}>
                  <step.icon className={`h-5 w-5 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm mb-1 ${
                    isDisabled ? 'text-gray-500' : 'group-hover:text-blue-600 transition-colors'
                  }`}>
                    {step.title}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {step.description}
                  </p>
                </div>
                {!isDisabled && (
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors mt-0.5" />
                )}
              </div>
            </Component>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          onClick={handleDismissPermanently}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          Don't show this again
        </button>
        <a
          href="/docs/quick-start"
          className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          View full documentation →
        </a>
      </div>
    </div>
  )
}