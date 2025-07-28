'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Package2,
  Home,
  Package,
  FileText,
  DollarSign,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  BarChart3,
  Warehouse,
  Calculator,
  Building,
  TrendingUp,
  BookOpen,
  Calendar,
  Cloud,
  Eye,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface NavSection {
  title: string
  items: Array<{
    name: string
    href: string
    icon: any
  }>
}

const baseNavigation: NavSection[] = [
  {
    title: '',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ]
  },
  {
    title: 'Market',
    items: [
      { name: 'Shipment Planning', href: '/market/shipment-planning', icon: TrendingUp },
      { name: 'Amazon FBA', href: '/market/amazon', icon: Cloud },
      { name: 'Order Management', href: '/market/orders', icon: FileText },
      { name: 'Reorder Alerts', href: '/market/reorder', icon: AlertTriangle },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Inventory Ledger', href: '/operations/inventory', icon: BookOpen },
      { name: 'Pallet Variance', href: '/operations/pallet-variance', icon: AlertTriangle },
    ]
  },
  {
    title: 'Finance',
    items: [
      { name: 'Dashboard', href: '/finance/dashboard', icon: DollarSign },
      { name: 'Storage Ledger', href: '/finance/storage-ledger', icon: Calendar },
      { name: 'Cost Ledger', href: '/finance/cost-ledger', icon: BarChart3 },
      { name: 'Invoices', href: '/finance/invoices', icon: FileText },
      { name: 'Reconciliation', href: '/finance/reconciliation', icon: Calculator },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Products (SKUs)', href: '/config/products', icon: Package },
      { name: 'Warehouses', href: '/config/warehouses', icon: Building },
      { name: 'Cost Rates', href: '/config/rates', icon: DollarSign },
      { name: 'Invoice Templates', href: '/config/invoice-templates', icon: FileText },
      { name: 'Reports & Analytics', href: '/finance/reports', icon: BarChart3 },
    ]
  },
]

const adminOnlySection: NavSection = {
  title: 'Admin',
  items: [
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]
}

export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)

  if (!session) return null

  // Check if user has admin role
  const isAdmin = session.user.role === 'admin'
  
  // Build navigation based on role
  const userNavigation = [...baseNavigation]
  if (isAdmin) {
    userNavigation.push(adminOnlySection)
  }

  // Get current page name for mobile header
  const getCurrentPageName = () => {
    for (const section of userNavigation) {
      for (const item of section.items) {
        if (pathname.startsWith(item.href)) {
          return item.name
        }
      }
    }
    return 'Dashboard'
  }

  return (
    <>
      {/* Desktop Navigation - responsive for tablets */}
      <div className={cn(
        "hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col transition-all duration-300",
        isTabletCollapsed ? "md:w-16 lg:w-72" : "md:w-72"
      )}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Package2 className="h-8 w-8 text-primary" />
              <span className={cn("text-xl font-bold transition-all duration-300", isTabletCollapsed && "md:hidden lg:inline")}>WMS</span>
            </Link>
            {/* Tablet collapse button */}
            <button
              onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
              className="hidden md:block lg:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-6">
                  {userNavigation.map((section, sectionIdx) => (
                    <li key={sectionIdx}>
                      {section.title && (
                        <div className={cn(
                          "px-2 pb-2 text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider transition-all duration-300",
                          isTabletCollapsed && "md:hidden lg:block"
                        )}>
                          {section.title}
                        </div>
                      )}
                      <ul role="list" className="space-y-1">
                        {section.items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className={cn(
                                pathname.startsWith(item.href)
                                  ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                  : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                              )}
                            >
                              <item.icon
                                className={cn(
                                  pathname.startsWith(item.href)
                                    ? 'text-primary'
                                    : 'text-gray-400 group-hover:text-primary',
                                  'h-6 w-6 shrink-0'
                                )}
                                aria-hidden="true"
                              />
                              <span className={cn(
                                "transition-all duration-300",
                                isTabletCollapsed && "md:hidden lg:inline"
                              )}>
                                {item.name}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-gray-500">{session.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 w-full"
                >
                  <LogOut className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-primary" />
                  <span className={cn(
                    "transition-all duration-300",
                    isTabletCollapsed && "md:hidden lg:inline"
                  )}>
                    Sign out
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm sm:px-6 md:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-400"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900 dark:text-white">
          {getCurrentPageName()}
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-900/80"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                <button
                  type="button"
                  className="-m-2.5 p-2.5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4">
                <div className="flex h-16 shrink-0 items-center">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <Package2 className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold">WMS</span>
                  </Link>
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-6">
                        {userNavigation.map((section, sectionIdx) => (
                          <li key={sectionIdx}>
                            {section.title && (
                              <div className="px-2 pb-2 text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                                {section.title}
                              </div>
                            )}
                            <ul role="list" className="space-y-1">
                              {section.items.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    className={cn(
                                      pathname.startsWith(item.href)
                                        ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                        : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                    )}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <item.icon
                                      className={cn(
                                        pathname.startsWith(item.href)
                                          ? 'text-primary'
                                          : 'text-gray-400 group-hover:text-primary',
                                        'h-6 w-6 shrink-0'
                                      )}
                                      aria-hidden="true"
                                    />
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}