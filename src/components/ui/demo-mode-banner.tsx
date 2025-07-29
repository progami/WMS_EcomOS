'use client'

import { useState, useEffect } from 'react'
import { X, Info, Trash2, Sparkles } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export function DemoModeBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkDemoModeStatus()
  }, [])

  const checkDemoModeStatus = async () => {
    try {
      const response = await fetch('/api/demo/status')
      if (response.ok) {
        const data = await response.json()
        setIsDemoMode(data.isDemoMode)
        setIsVisible(data.isDemoMode)
      }
    } catch (error) {
      // console.error('Error checking demo mode status:', error)
    }
  }

  const handleClearDemoData = async () => {
    if (!confirm('Are you sure you want to clear all demo data? This action cannot be undone.')) {
      return
    }

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
      setIsVisible(false)
      toast.success('Demo data cleared successfully!')
      
      // Refresh the page
      router.refresh()
    } catch (error) {
      // console.error('Error clearing demo data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to clear demo data')
    } finally {
      setIsClearing(false)
    }
  }

  if (!isVisible || !isDemoMode) {
    return null
  }

  return (
    <div className="relative">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span className="font-semibold">Demo Mode Active</span>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-purple-100">
                <Info className="h-4 w-4" />
                <span className="text-sm">
                  You're viewing sample data. Feel free to explore all features!
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleClearDemoData}
                disabled={isClearing}
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Clear Demo Data</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => setIsVisible(false)}
                className="rounded-md p-1 hover:bg-white/20 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Mobile info text */}
          <div className="sm:hidden pb-3">
            <div className="flex items-center space-x-2 text-purple-100">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                You're viewing sample data. Explore all features!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}