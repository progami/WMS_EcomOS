'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from '@/lib/lucide-icons'
import { useSession } from 'next-auth/react'

export function Breadcrumb() {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  // Don't show breadcrumbs on home or login pages
  if (pathname === '/' || pathname === '/auth/login') {
    return null
  }

  // Parse the pathname into segments
  const segments = pathname.split('/').filter(Boolean)
  
  // Create breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    
    // Handle special cases for better labels
    let label = segment
    switch (segment) {
      case 'operations':
        label = 'Operations'
        break
      case 'finance':
        label = 'Finance'
        break
      case 'config':
        label = 'Configuration'
        break
      case 'admin':
        label = 'Admin'
        break
      case 'integrations':
        label = 'Integrations'
        break
      case 'transactions':
        label = 'Transactions'
        break
      case 'inventory':
        label = 'Inventory Ledger'
        break
      default:
        // For IDs and other segments, format them nicely
        if (segment.match(/^[a-f0-9-]+$/i) && segment.length > 20) {
          // Looks like an ID, truncate it
          label = segment.substring(0, 8) + '...'
        } else {
          label = segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }
    }
    
    return { href, label }
  })

  // Determine home link based on user role
  const homeLink = session?.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      <Link
        href={homeLink}
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.href} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              href={breadcrumb.href}
              className="hover:text-gray-900 transition-colors"
            >
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}