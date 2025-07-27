'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function AuthTestPage() {
  const { data: session, status } = useSession()
  const [sessionCheck, setSessionCheck] = useState<any>(null)

  useEffect(() => {
    // Test browser logging
    console.log('Auth test page loaded')
    console.error('Test error logging')
    console.warn('Test warning logging')
    
    // Check session via API
    fetch('/api/auth/session-check')
      .then(res => res.json())
      .then(data => {
        console.log('Session check result:', data)
        setSessionCheck(data)
      })
      .catch(err => {
        console.error('Session check failed:', err)
      })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Client Session (useSession):</h2>
          <p>Status: {status}</p>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-sm overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold">Server Session Check:</h2>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-sm overflow-auto">
            {JSON.stringify(sessionCheck, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold">Test Credentials:</h2>
          <p>Username: demo-admin</p>
          <p>Password: DemoAdmin2024!</p>
        </div>
      </div>
    </div>
  )
}