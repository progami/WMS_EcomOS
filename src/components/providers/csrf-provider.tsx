'use client'

import { useEffect } from 'react'
import { refreshCSRFToken } from '@/lib/utils/csrf'

/**
 * Provider component that ensures CSRF tokens are available
 */
export function CSRFProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Refresh CSRF token on mount
    refreshCSRFToken().catch(console.error)
    
    // Refresh token every 30 minutes
    const interval = setInterval(() => {
      refreshCSRFToken().catch(console.error)
    }, 30 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return <>{children}</>
}