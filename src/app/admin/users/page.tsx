'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, MoreVertical, Mail, Shield } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login')
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">User Management</h1>
              <p className="text-muted-foreground">
                Manage users and their permissions
              </p>
            </div>
            <Link
              href="/admin/users/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UserCard
            name="System Administrator"
            email="admin@warehouse.com"
            role="admin"
            warehouse="All Warehouses"
            lastLogin="2 hours ago"
            isActive={true}
          />
          <UserCard
            name="Hashar (Finance Manager)"
            email="hashar@warehouse.com"
            role="staff"
            warehouse="All Warehouses"
            lastLogin="1 day ago"
            isActive={true}
          />
          <UserCard
            name="Umair (Operations Manager)"
            email="umair@warehouse.com"
            role="staff"
            warehouse="FMC"
            lastLogin="3 hours ago"
            isActive={true}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

interface UserCardProps {
  name: string
  email: string
  role: string
  warehouse: string
  lastLogin: string
  isActive: boolean
}

function UserCard({ name, email, role, warehouse, lastLogin, isActive }: UserCardProps) {
  const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      staff: 'bg-blue-100 text-blue-800',
    }
    
    const roleLabels: Record<string, string> = {
      admin: 'System Admin',
      staff: 'Staff',
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyles[role] || 'bg-gray-100 text-gray-800'}`}>
        {roleLabels[role] || role}
      </span>
    )
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-lg font-medium text-gray-600">
                {name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">{name}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {email}
              </p>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Role</span>
              {getRoleBadge(role)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Warehouse</span>
              <span className="text-sm font-medium">{warehouse}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Last Login</span>
              <span className="text-sm">{lastLogin}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        
        <button className="ml-4 text-gray-400 hover:text-gray-600">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}