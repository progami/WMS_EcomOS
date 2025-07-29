'use client'

/*
 * Security Notes:
 * - Quick fill buttons are only visible in development (NODE_ENV === 'development')
 * - Passwords should be set via environment variables, not hardcoded
 * - In production, set these environment variables:
 *   - DEMO_ADMIN_PASSWORD (for demo setup API)
 *   - DEMO_STAFF_PASSWORD (for demo setup API)
 *   - NEXT_PUBLIC_DEMO_PASSWORD (for demo login - only if demo is enabled)
 * - Never set NEXT_PUBLIC_ADMIN_PASSWORD or NEXT_PUBLIC_STAFF_PASSWORD in production
 */

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Package2 } from '@/lib/lucide-icons'
import { withBasePath } from '@/lib/utils/base-path'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: '',
  })
  
  // Enable autofill properly
  useEffect(() => {
    // Remove readonly after component mounts to allow autofill
    const timer = setTimeout(() => {
      const emailInput = document.getElementById('emailOrUsername') as HTMLInputElement
      const passwordInput = document.getElementById('password') as HTMLInputElement
      
      if (emailInput) emailInput.removeAttribute('readonly')
      if (passwordInput) passwordInput.removeAttribute('readonly')
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Removed auto-fill on mount to allow buttons to work properly

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        emailOrUsername: formData.emailOrUsername,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Invalid email/username or password')
      } else {
        toast.success('Login successful!')
        
        // Use router.push for proper Next.js navigation
        const redirectUrl = callbackUrl || '/dashboard'
        router.push(redirectUrl)
        router.refresh()
      }
    } catch (error) {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <Package2 className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold">WMS</h1>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Warehouse Management System
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Allow autofill */}
          
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="emailOrUsername" className="sr-only">
                Email or Username
              </label>
              <input
                id="emailOrUsername"
                name="emailOrUsername"
                type="text"
                autoComplete="username email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Email or Username"
                value={formData.emailOrUsername}
                onChange={(e) =>
                  setFormData({ ...formData, emailOrUsername: e.target.value })
                }
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="loading-spinner" />
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}