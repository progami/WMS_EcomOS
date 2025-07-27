'use client'

import { useEffect } from 'react'

export default function TestConsolePage() {
  useEffect(() => {
    // Test all console methods
    console.log('TEST: console.log is working')
    console.error('TEST: console.error is working')
    console.warn('TEST: console.warn is working')
    console.info('TEST: console.info is working')
    console.debug('TEST: console.debug is working')
    
    // Test object logging
    console.log('TEST: Object logging', { test: 'object', nested: { value: 123 } })
    
    // Test error logging
    console.error('TEST: Error object', new Error('Test error with stack trace'))
    
    // Test unhandled promise rejection
    setTimeout(() => {
      Promise.reject('TEST: Unhandled promise rejection')
    }, 1000)
    
    // Test window.onerror
    setTimeout(() => {
      // @ts-ignore - intentionally cause error
      nonExistentFunction()
    }, 2000)
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Console Logging Test Page</h1>
      <p>Check logs/full-output.log for console output</p>
      <div className="mt-4 space-y-2">
        <p>✓ console.log test</p>
        <p>✓ console.error test</p>
        <p>✓ console.warn test</p>
        <p>✓ console.info test</p>
        <p>✓ console.debug test</p>
        <p>✓ Object logging test</p>
        <p>✓ Error with stack trace test</p>
        <p>✓ Unhandled promise rejection test (1 second delay)</p>
        <p>✓ window.onerror test (2 second delay)</p>
      </div>
    </div>
  )
}