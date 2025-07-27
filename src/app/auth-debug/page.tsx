'use client'

import { useSession, signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function AuthDebugPage() {
  const { data: session, status } = useSession()
  const [testResult, setTestResult] = useState<any>(null)
  const [sessionCheck, setSessionCheck] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Log to browser console (which will be sent to server)
    console.log('=== AUTH DEBUG PAGE LOADED ===')
    console.log('Client session status:', status)
    console.log('Client session data:', session)
    
    // Check server session
    checkServerSession()
  }, [status, session])

  const checkServerSession = async () => {
    try {
      const res = await fetch('/api/auth/session-check')
      const data = await res.json()
      console.log('Server session check:', data)
      setSessionCheck(data)
    } catch (error) {
      console.error('Server session check failed:', error)
      setSessionCheck({ error: String(error) })
    }
  }

  const testLogin = async () => {
    setLoading(true)
    try {
      // First test password validation
      const testRes = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo-admin',
          password: 'DemoAdmin2024!'
        })
      })
      const testData = await testRes.json()
      console.log('Password test result:', testData)
      setTestResult(testData)

      if (testData.success) {
        // Try actual login
        console.log('Attempting NextAuth signIn...')
        const result = await signIn('credentials', {
          emailOrUsername: 'demo-admin',
          password: 'DemoAdmin2024!',
          redirect: false
        })
        console.log('NextAuth signIn result:', result)
        setTestResult(prev => ({ ...prev, signInResult: result }))
        
        // Recheck sessions after login
        setTimeout(() => {
          checkServerSession()
        }, 1000)
      }
    } catch (error) {
      console.error('Test login error:', error)
      setTestResult({ error: String(error) })
    }
    setLoading(false)
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Auth Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-2">Client Session (useSession)</h2>
          <div className="text-sm">
            <p className="mb-1"><strong>Status:</strong> {status}</p>
            <pre className="bg-gray-100 p-2 rounded overflow-auto text-xs">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-2">Server Session Check</h2>
          <button 
            onClick={checkServerSession}
            className="mb-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
          <pre className="bg-gray-100 p-2 rounded overflow-auto text-xs">
            {JSON.stringify(sessionCheck, null, 2)}
          </pre>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white shadow">
        <h2 className="text-xl font-semibold mb-4">Test Login</h2>
        <div className="mb-4 text-sm">
          <p><strong>Username:</strong> demo-admin</p>
          <p><strong>Password:</strong> DemoAdmin2024!</p>
        </div>
        <button 
          onClick={testLogin}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Login'}
        </button>
        {testResult && (
          <pre className="mt-4 bg-gray-100 p-2 rounded overflow-auto text-xs">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="border rounded-lg p-4 bg-yellow-50 shadow">
        <h2 className="text-xl font-semibold mb-2">Browser Console Output</h2>
        <p className="text-sm text-gray-600">
          All console logs from this page are being sent to the server log file at:<br/>
          <code className="bg-gray-200 px-1 py-0.5 rounded">/logs/full-output.log</code>
        </p>
      </div>
    </div>
  )
}