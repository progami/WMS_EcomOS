'use client'

import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AlertCircle, ArrowLeft, Home } from '@/lib/lucide-icons'

export default function NotFound() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">404</h1>
            <h2 className="text-2xl font-semibold">Page Not Found</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}