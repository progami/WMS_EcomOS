'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Building2, 
  Package, 
  DollarSign, 
  Users, 
  Settings as SettingsIcon,
  Database,
  Bell,
  Shield,
  ArrowRight,
  Download,
  Info,
  FileText,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader, HelpfulTips } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && (!session || session.user.role !== 'admin')) {
      router.push('/auth/login')
    }
  }, [status, session, router])

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
    return null
  }


  const handleExportData = async () => {
    setLoading('export')
    try {
      const response = await fetch('/api/export/all-data', {
        method: 'GET',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `warehouse-backup-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Data exported successfully!')
      } else {
        toast.error('Failed to export data')
      }
    } catch (error) {
      toast.error('Export failed')
    } finally {
      setLoading(null)
    }
  }


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="System Settings"
          icon={SettingsIcon}
          iconColor="text-gray-600"
          bgColor="bg-gray-50"
          borderColor="border-gray-200"
          textColor="text-gray-800"
        />

        {/* Settings Categories */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* System Configuration */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">System Configuration</h2>
            <div className="space-y-3">
              <SettingCard
                title="General Settings"
                description="Company info, timezone, and defaults"
                icon={SettingsIcon}
                href="/admin/settings/general"
              />
              <SettingCard
                title="Database"
                description="Backup, restore, and maintenance"
                icon={Database}
                href="/admin/settings/database"
              />
              <SettingCard
                title="Email Configuration"
                description="SMTP settings and email templates"
                icon={Bell}
                href="/admin/settings/email"
              />
              <SettingCard
                title="Audit Logs"
                description="System activity and change history"
                icon={FileText}
                href="/admin/settings/audit"
              />
            </div>
          </div>

          {/* User & Security */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">User & Security</h2>
            <div className="space-y-3">
              <SettingCard
                title="User Management"
                description="User accounts and permissions"
                icon={Users}
                href="/admin/users"
              />
              <SettingCard
                title="Security"
                description="Password policies and access controls"
                icon={Shield}
                href="/admin/settings/security"
              />
              <SettingCard
                title="API Keys"
                description="Manage API access and integrations"
                icon={Shield}
                href="/admin/settings/api-keys"
              />
              <SettingCard
                title="Session Management"
                description="Active sessions and timeout settings"
                icon={Users}
                href="/admin/settings/sessions"
              />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid gap-4">
            <QuickAction
              title="Export All Data"
              description="Download complete backup"
              icon={Download}
              onClick={handleExportData}
              loading={loading === 'export'}
            />
          </div>
        </div>

        {/* System Info */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">System Information</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoItem label="Version" value="0.1.0" />
            <InfoItem label="Database" value="PostgreSQL 15.4" />
            <InfoItem label="Environment" value="Development" />
            <InfoItem label="Last Backup" value="Never" />
            <InfoItem label="Active Users" value="3" />
            <InfoItem label="Total Transactions" value="208" />
          </div>
        </div>

        {/* Helpful Tips */}
        <HelpfulTips
          icon={Info}
          tips={[
            "Regularly back up your data using the Export function to prevent data loss.",
            "Configure cost rates before importing transactions to ensure accurate calculations.",
            "Set up email notifications to stay informed about important system events.",
            "Review user permissions periodically to maintain proper access control."
          ]}
        />
      </div>
    </DashboardLayout>
  )
}

interface SettingCardProps {
  title: string
  description: string
  icon: React.ElementType
  href: string
  iconColor?: string
}

function SettingCard({ title, description, icon: Icon, href, iconColor = "text-primary" }: SettingCardProps) {
  return (
    <Link href={href} className="block">
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}

interface QuickActionProps {
  title: string
  description: string
  icon: React.ElementType
  onClick: () => void
  loading?: boolean
  danger?: boolean
}

function QuickAction({ title, description, icon: Icon, onClick, loading, danger }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`p-4 border rounded-lg transition-all text-left relative overflow-hidden ${
        danger 
          ? 'hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
          : 'hover:shadow-md'
      } ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <Icon className={`h-5 w-5 ${
            danger ? 'text-red-600' : 'text-gray-600'
          }`} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </button>
  )
}

interface InfoItemProps {
  label: string
  value: string
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}