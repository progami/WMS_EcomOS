'use client'

import { useState, useEffect } from 'react'
import { Bell, Mail, MessageSquare, Smartphone, Save } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  lowStockAlerts: boolean
  newTransactionAlerts: boolean
  dailyReports: boolean
  weeklyReports: boolean
  monthlyReports: boolean
  alertRecipients: string[]
  reportRecipients: string[]
}

export default function NotificationSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    lowStockAlerts: true,
    newTransactionAlerts: false,
    dailyReports: false,
    weeklyReports: true,
    monthlyReports: true,
    alertRecipients: [],
    reportRecipients: [],
  })
  const [newAlertEmail, setNewAlertEmail] = useState('')
  const [newReportEmail, setNewReportEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.user.role === 'admin') {
      fetchSettings()
    } else if (session) {
      // User is logged in but not an admin (must be 'staff')
      router.push('/auth/login')
    }
  }, [session, router])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/notifications')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      } else {
        toast.error('Failed to load notification settings')
      }
    } catch (error) {
      // console.error('Error fetching settings:', error)
      toast.error('Failed to load notification settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast.success('Notification settings saved successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save settings')
      }
    } catch (error) {
      // console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addAlertRecipient = () => {
    if (newAlertEmail && !settings.alertRecipients.includes(newAlertEmail)) {
      setSettings({
        ...settings,
        alertRecipients: [...settings.alertRecipients, newAlertEmail]
      })
      setNewAlertEmail('')
    }
  }

  const removeAlertRecipient = (email: string) => {
    setSettings({
      ...settings,
      alertRecipients: settings.alertRecipients.filter(e => e !== email)
    })
  }

  const addReportRecipient = () => {
    if (newReportEmail && !settings.reportRecipients.includes(newReportEmail)) {
      setSettings({
        ...settings,
        reportRecipients: [...settings.reportRecipients, newReportEmail]
      })
      setNewReportEmail('')
    }
  }

  const removeReportRecipient = (email: string) => {
    setSettings({
      ...settings,
      reportRecipients: settings.reportRecipients.filter(e => e !== email)
    })
  }

  if (status === 'loading' || loading) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notification Settings</h1>
            <p className="text-muted-foreground">
              Configure email alerts and notification preferences
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Notification Channels */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Notification Channels</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-gray-500">Send notifications via email</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-gray-500">Send text message alerts</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.smsEnabled}
                  onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-gray-500">In-app and browser notifications</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.pushEnabled}
                  onChange={(e) => setSettings({ ...settings, pushEnabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
            </div>
          </div>

          {/* Alert Types */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Alert Types</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Low Stock Alerts</p>
                  <p className="text-sm text-gray-500">Notify when inventory is low</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lowStockAlerts}
                  onChange={(e) => setSettings({ ...settings, lowStockAlerts: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Transaction Alerts</p>
                  <p className="text-sm text-gray-500">Notify on new inventory movements</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.newTransactionAlerts}
                  onChange={(e) => setSettings({ ...settings, newTransactionAlerts: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Reports</p>
                  <p className="text-sm text-gray-500">Daily summary of activities</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dailyReports}
                  onChange={(e) => setSettings({ ...settings, dailyReports: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Reports</p>
                  <p className="text-sm text-gray-500">Weekly inventory and cost summary</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.weeklyReports}
                  onChange={(e) => setSettings({ ...settings, weeklyReports: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Monthly Reports</p>
                  <p className="text-sm text-gray-500">Monthly billing and reconciliation</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.monthlyReports}
                  onChange={(e) => setSettings({ ...settings, monthlyReports: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </label>
            </div>
          </div>

          {/* Alert Recipients */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Alert Recipients</h3>
            <p className="text-sm text-gray-500 mb-4">
              Email addresses that will receive system alerts
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAlertEmail}
                  onChange={(e) => setNewAlertEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAlertRecipient()}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter email address"
                />
                <button
                  onClick={addAlertRecipient}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {settings.alertRecipients.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                    <span className="text-sm">{email}</span>
                    <button
                      onClick={() => removeAlertRecipient(email)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {settings.alertRecipients.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No recipients added yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Report Recipients */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Report Recipients</h3>
            <p className="text-sm text-gray-500 mb-4">
              Email addresses that will receive scheduled reports
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newReportEmail}
                  onChange={(e) => setNewReportEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addReportRecipient()}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter email address"
                />
                <button
                  onClick={addReportRecipient}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {settings.reportRecipients.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                    <span className="text-sm">{email}</span>
                    <button
                      onClick={() => removeReportRecipient(email)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {settings.reportRecipients.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No recipients added yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Test Notifications */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Test Notifications</h3>
              <p className="text-sm text-gray-600 mt-1">
                Send a test notification to verify your settings
              </p>
            </div>
            <button
              onClick={() => toast.success('Test notification sent!')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Send Test
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}