'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { 
  Package2, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  BarChart3, 
  Truck, 
  FileText,
  Shield,
  Zap,
  Users
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleTryDemo = async () => {
    setIsLoading(true)
    
    try {
      // Always try to set up demo environment first (it will check internally if data already exists)
      const setupResponse = await fetch('/api/demo/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!setupResponse.ok) {
        const errorData = await setupResponse.json()
        throw new Error(errorData.error || 'Failed to set up demo environment')
      }

      // Wait a moment for the database transaction to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Then sign in as demo admin
      const result = await signIn('credentials', {
        emailOrUsername: 'demo-admin',
        password: 'SecureWarehouse2024!',
        redirect: false,
      })

      if (result?.error) {
        throw new Error('Failed to sign in to demo account')
      }

      toast.success('Welcome to WMS Demo! Explore all features with sample data.', {
        duration: 6000,
        icon: '🎉'
      })
      
      // Redirect to unified dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      // console.error('Error setting up demo:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to set up demo')
    } finally {
      setIsLoading(false)
    }
  }

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Real-time Analytics',
      description: 'Track inventory levels, costs, and performance with interactive dashboards'
    },
    {
      icon: <Truck className="h-6 w-6" />,
      title: 'Inventory Management',
      description: 'Manage SKUs, track movements, and optimize warehouse operations'
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Automated Billing',
      description: 'Generate invoices, track payments, and manage customer accounts'
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with role-based access control'
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Fast & Efficient',
      description: 'Optimized for speed with real-time updates and notifications'
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Multi-user Support',
      description: 'Collaborate with your team with different access levels'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3 px-4 py-2 bg-purple-100 dark:bg-purple-900/50 rounded-full">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Try it free with demo data
              </span>
            </div>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Modern Warehouse
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 pb-2">
              Management System
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            Streamline your warehouse operations with our comprehensive inventory tracking, 
            automated billing, and real-time analytics platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleTryDemo}
              disabled={isLoading}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg cursor-pointer hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Setting up demo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Try Demo</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <a
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Package2 className="h-5 w-5" />
              <span>Sign In</span>
            </a>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>No credit card required • Instant access • Real sample data</span>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to manage your warehouse
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Powerful features designed for modern 3PL operations
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to transform your warehouse operations?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Try the demo now and see how WMS can streamline your business
          </p>
          <button
            onClick={handleTryDemo}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-medium text-purple-600 bg-white rounded-lg cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Setting up demo...</span>
              </>
            ) : (
              <>
                <span>Start Your Free Demo</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Package2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">WMS</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Modern warehouse management for the digital age
          </p>
        </div>
      </footer>
    </div>
  )
}