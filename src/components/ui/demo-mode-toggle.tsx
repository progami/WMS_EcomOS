'use client'

import { useState, useEffect } from 'react'
import { Beaker, Sparkles, Trash2, AlertTriangle } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'

interface DemoModeToggleProps {
  onDataChange?: () => void
}

export function DemoModeToggle({ onDataChange }: DemoModeToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Check if demo mode is active on mount
  useEffect(() => {
    checkDemoModeStatus()
  }, [])

  const checkDemoModeStatus = async () => {
    try {
      const response = await fetch('/api/demo/status')
      if (response.ok) {
        const data = await response.json()
        setIsDemoMode(data.isDemoMode)
      }
    } catch (error) {
      // console.error('Error checking demo mode status:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleGenerateDemoData = async () => {
    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate demo data')
      }

      setIsDemoMode(true)
      toast.success('Demo data generated successfully!')
      
      // Refresh the page data if callback provided
      if (onDataChange) {
        onDataChange()
      }
    } catch (error) {
      // console.error('Error generating demo data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate demo data')
    } finally {
      setIsGenerating(false)
      setIsOpen(false)
    }
  }

  const handleClearDemoData = async () => {
    setIsClearing(true)
    
    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear demo data')
      }

      setIsDemoMode(false)
      toast.success('Demo data cleared successfully!')
      
      // Refresh the page data if callback provided
      if (onDataChange) {
        onDataChange()
      }
    } catch (error) {
      // console.error('Error clearing demo data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to clear demo data')
    } finally {
      setIsClearing(false)
      setIsOpen(false)
    }
  }

  // Don't render until we've checked the status
  if (isChecking) {
    return null
  }

  return (
    <>
      {/* Floating Demo Mode Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            group flex items-center gap-2 px-4 py-3 rounded-full shadow-lg
            transition-all duration-300 hover:scale-105
            ${isDemoMode 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }
          `}
        >
          <Beaker className="h-5 w-5" />
          <span className="font-medium">Demo Mode</span>
          {isDemoMode && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-white/20 rounded-full">
              ON
            </span>
          )}
        </button>
      </div>

      {/* Demo Mode Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6">
              {/* Header */}
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mb-4">
                  <Beaker className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Demo Mode
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Test the WMS system with sample data
                </p>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Important Notice</p>
                    <p>Generating demo data will replace all existing data in your system. This action cannot be undone.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {!isDemoMode ? (
                  <button
                    onClick={handleGenerateDemoData}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Generating Demo Data...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span>Generate Demo Data</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleClearDemoData}
                    disabled={isClearing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Clearing Demo Data...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-5 w-5" />
                        <span>Clear Demo Data</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>

              {/* Info */}
              <div className="text-center text-xs text-gray-500">
                Demo data includes sample inventory, transactions, and invoices
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}