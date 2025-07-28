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


export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as HTMLElement).closest('.user-menu-container')) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  if (!session) return null

  // Check if user has admin role
  const isAdmin = session.user.role === 'admin'
  
  // Use base navigation for all users
  const userNavigation = baseNavigation

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
        isTabletCollapsed ? "md:w-16 lg:w-64" : "md:w-64"
      )}>
        <div className="flex grow flex-col gap-y-3 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 px-4 pb-3">
          <div className="flex h-16 shrink-0 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" scroll={false} className="flex items-center gap-2">
                <Package2 className="h-8 w-8 text-primary" />
                <span className={cn("text-xl font-bold transition-all duration-300", isTabletCollapsed && "md:hidden lg:inline")}>WMS</span>
              </Link>
              {/* Version */}
              <span className={cn("text-xs text-gray-500 transition-all duration-300", isTabletCollapsed && "md:hidden lg:inline")}>
                v0.1.0
              </span>
            </div>
            
            {/* User info and tablet collapse */}
            <div className="flex items-center gap-2">
              {/* User avatar/menu */}
              <div className={cn("relative transition-all duration-300 user-menu-container", isTabletCollapsed && "md:hidden lg:block")}>
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </button>
                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 py-1 z-50">
                    <div className="px-3 py-2 border-b dark:border-gray-700">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-medium truncate">{session.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                    </div>
                    
                    {/* Admin options */}
                    {isAdmin && (
                      <>
                        <div className="py-1 border-b dark:border-gray-700">
                          <Link
                            href="/admin/users"
                            onClick={() => setUserMenuOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                          >
                            <Users className="h-4 w-4" />
                            Users
                          </Link>
                          <Link
                            href="/admin/settings"
                            onClick={() => setUserMenuOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Settings
                          </Link>
                        </div>
                      </>
                    )}
                    
                    <button
                      onClick={() => signOut({ callbackUrl: '/auth/login' })}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              
              {/* Tablet collapse button */}
              <button
                onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
                className="hidden md:block lg:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-3">
                  {userNavigation.map((section, sectionIdx) => (
                    <li key={sectionIdx}>
                      {section.title && (
                        <div className={cn(
                          "px-2 pb-1 pt-2 text-xs font-semibold leading-5 text-gray-400 uppercase tracking-wider transition-all duration-300",
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
                              scroll={false}
                              className={cn(
                                pathname.startsWith(item.href)
                                  ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                  : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                'group flex gap-x-3 rounded-md py-1.5 px-2 text-sm leading-5 font-medium'
                              )}
                            >
                              <item.icon
                                className={cn(
                                  pathname.startsWith(item.href)
                                    ? 'text-primary'
                                    : 'text-gray-400 group-hover:text-primary',
                                  'h-5 w-5 shrink-0'
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
                  <Link href="/dashboard" scroll={false} className="flex items-center gap-2">
                    <Package2 className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold">WMS</span>
                  </Link>
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-3">
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
                                    scroll={false}
                                    className={cn(
                                      pathname.startsWith(item.href)
                                        ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                        : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                      'group flex gap-x-3 rounded-md py-1.5 px-2 text-sm leading-5 font-medium'
                                    )}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <item.icon
                                      className={cn(
                                        pathname.startsWith(item.href)
                                          ? 'text-primary'
                                          : 'text-gray-400 group-hover:text-primary',
                                        'h-5 w-5 shrink-0'
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