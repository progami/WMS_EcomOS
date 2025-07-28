'use client'

import { useState, useEffect } from 'react'
import { Shield, Lock, Key, UserX, AlertTriangle, Save, Eye, EyeOff } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface SecuritySettings {
  passwordMinLength: number
  passwordRequireUppercase: boolean
  passwordRequireLowercase: boolean
  passwordRequireNumbers: boolean
  passwordRequireSpecialChars: boolean
  sessionTimeout: number
  maxLoginAttempts: number
  lockoutDuration: number
  twoFactorEnabled: boolean
  ipWhitelist: string[]
}

export default function SecuritySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [settings, setSettings] = useState<SecuritySettings>({
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    twoFactorEnabled: false,
    ipWhitelist: [],
  })

  const [ipInput, setIpInput] = useState('')

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
      const response = await fetch('/api/settings/security')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      toast.error('Failed to load security settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }
      
      toast.success('Security settings saved successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save security settings')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < settings.passwordMinLength) {
      toast.error(`Password must be at least ${settings.passwordMinLength} characters`)
      return
    }

    try {
      // In a real app, this would call an API to change password
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error('Failed to change password')
    }
  }

  const addIpAddress = () => {
    if (ipInput && /^(\d{1,3}\.){3}\d{1,3}$/.test(ipInput)) {
      setSettings(prev => ({
        ...prev,
        ipWhitelist: [...prev.ipWhitelist, ipInput]
      }))
      setIpInput('')
    } else {
      toast.error('Invalid IP address format')
    }
  }

  const removeIpAddress = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      ipWhitelist: prev.ipWhitelist.filter(item => item !== ip)
    }))
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
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground">
            Configure security policies and access controls
          </p>
        </div>

        {/* Password Policy */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password Policy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Minimum Password Length
              </label>
              <input
                type="number"
                min="6"
                max="32"
                value={settings.passwordMinLength}
                onChange={(e) => setSettings(prev => ({ ...prev, passwordMinLength: parseInt(e.target.value) }))}
                className="w-32 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.passwordRequireUppercase}
                  onChange={(e) => setSettings(prev => ({ ...prev, passwordRequireUppercase: e.target.checked }))}
                  className="mr-2"
                />
                Require uppercase letters (A-Z)
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.passwordRequireLowercase}
                  onChange={(e) => setSettings(prev => ({ ...prev, passwordRequireLowercase: e.target.checked }))}
                  className="mr-2"
                />
                Require lowercase letters (a-z)
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.passwordRequireNumbers}
                  onChange={(e) => setSettings(prev => ({ ...prev, passwordRequireNumbers: e.target.checked }))}
                  className="mr-2"
                />
                Require numbers (0-9)
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.passwordRequireSpecialChars}
                  onChange={(e) => setSettings(prev => ({ ...prev, passwordRequireSpecialChars: e.target.checked }))}
                  className="mr-2"
                />
                Require special characters (!@#$%^&*)
              </label>
            </div>
          </div>
        </div>

        {/* Session Management */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="h-5 w-5" />
            Session Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Login Attempts
              </label>
              <input
                type="number"
                min="3"
                max="10"
                value={settings.maxLoginAttempts}
                onChange={(e) => setSettings(prev => ({ ...prev, maxLoginAttempts: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Account Lockout Duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={settings.lockoutDuration}
                onChange={(e) => setSettings(prev => ({ ...prev, lockoutDuration: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.twoFactorEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, twoFactorEnabled: e.target.checked }))}
              className="mr-2"
            />
            Enable two-factor authentication for all users
          </label>
          {settings.twoFactorEnabled && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            </div>
          )}
        </div>

        {/* IP Whitelist */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserX className="h-5 w-5" />
            IP Address Whitelist
          </h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter IP address (e.g., 192.168.1.1)"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={addIpAddress}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Add IP
              </button>
            </div>
            {settings.ipWhitelist.length > 0 && (
              <div className="space-y-2">
                {settings.ipWhitelist.map((ip) => (
                  <div key={ip} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-mono text-sm">{ip}</span>
                    <button
                      onClick={() => removeIpAddress(ip)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Admin Password
          </h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={changePassword}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save Security Settings'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}