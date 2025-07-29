'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, CheckCircle2, Info } from '@/lib/lucide-icons'

export function DemoWelcome() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if this is a new demo session
    const hasSeenWelcome = sessionStorage.getItem('demoWelcomeShown')
    const isDemoMode = checkDemoMode()
    
    if (!hasSeenWelcome && isDemoMode) {
      setIsVisible(true)
      sessionStorage.setItem('demoWelcomeShown', 'true')
    }
  }, [])

  const checkDemoMode = () => {
    // For demo welcome, we assume if the component is rendered, we're in demo mode
    // This avoids authentication issues with the status endpoint
    return true
  }

  if (!isVisible) return null

  const features = [
    'Full inventory management system',
    'Real-time analytics and reporting',
    'Invoice generation and reconciliation',
    'Multi-warehouse support',
    'User role management',
    'Export and import capabilities'
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={() => setIsVisible(false)}
        />

        {/* Modal panel */}
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 sm:mx-0 sm:h-10 sm:w-10">
                <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 className="text-lg font-semibold leading-6 text-white" id="modal-title">
                  Welcome to WMS Demo! 🎉
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-purple-100">
                    You're now logged in as an admin with full access to explore all features.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Demo Data Loaded</p>
                  <p className="text-sm text-gray-600">
                    We've populated the system with sample warehouses, products, inventory, and transactions
                    so you can see how everything works.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Explore these features:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This is a demo environment. All data is temporary and can be
                  cleared at any time using the demo mode banner.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:from-purple-700 hover:to-pink-700 sm:ml-3 sm:w-auto"
              onClick={() => setIsVisible(false)}
            >
              Start Exploring
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              onClick={() => {
                setIsVisible(false)
                window.open('/docs/getting-started', '_blank')
              }}
            >
              View Documentation
            </button>
          </div>

          {/* Close button */}
          <button
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}