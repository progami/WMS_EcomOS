'use client'

import { useEffect } from 'react'
import { initBrowserLogger } from '@/lib/browser-logger'

export function BrowserLoggerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initBrowserLogger()
  }, [])

  return <>{children}</>
}