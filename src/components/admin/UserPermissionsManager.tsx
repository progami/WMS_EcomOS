'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { PermissionBadge } from './PermissionBadge'
import { Loader2, Search, Shield } from 'lucide-react'
import { PERMISSIONS } from '@/hooks/usePermissions'

interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description?: string | null
}

interface UserPermissionsManagerProps {
  user_id: string
  userName?: string
  userRole?: string
}

// Group permissions by resource
const groupPermissionsByResource = (permissions: Permission[]) => {
  const grouped: Record<string, Permission[]> = {}
  permissions.forEach(perm => {
    if (!grouped[perm.resource]) {
      grouped[perm.resource] = []
    }
    grouped[perm.resource].push(perm)
  })
  return grouped
}

export function UserPermissionsManager({ user_id, userName, userRole }: UserPermissionsManagerProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // Get all available permissions
  useEffect(() => {
    const fetchAllPermissions = async () => {
      try {
        // For now, we'll use the PERMISSIONS constant to generate the list
        const permissionList: Permission[] = Object.entries(PERMISSIONS).map(([key, name]) => {
          const [resource, action] = name.split(':')
          return {
            id: key,
            name,
            resource,
            action,
            description: null
          }
        })
        setAllPermissions(permissionList)
      } catch (error) {
        console.error('Failed to fetch all permissions:', error)
      }
    }
    fetchAllPermissions()
  }, [])

  // Fetch user permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch(`/api/admin/permissions/users/${user_id}`)
        if (!response.ok) throw new Error('Failed to fetch permissions')
        const data = await response.json()
        setPermissions(data.permissions)
        setSelectedPermissions(new Set(data.permissions.map((p: Permission) => p.name)))
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load user permissions',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }
    fetchPermissions()
  }, [userId, toast])

  const handlePermissionToggle = (permissionName: string) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permissionName)) {
      newSelected.delete(permissionName)
    } else {
      newSelected.add(permissionName)
    }
    setSelectedPermissions(newSelected)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const currentPermissionNames = new Set(permissions.map(p => p.name))
      const grant = Array.from(selectedPermissions).filter(p => !currentPermissionNames.has(p))
      const revoke = Array.from(currentPermissionNames).filter(p => !selectedPermissions.has(p))

      const response = await fetch(`/api/admin/permissions/users/${user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant, revoke })
      })

      if (!response.ok) throw new Error('Failed to update permissions')
      
      const data = await response.json()
      setPermissions(data.permissions)
      
      toast({
        title: 'Success',
        description: 'User permissions updated successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update permissions',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredPermissions = allPermissions.filter(perm =>
    perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.action.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedPermissions = groupPermissionsByResource(filteredPermissions)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Manage Permissions
        </CardTitle>
        {userName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>User: {userName}</span>
            {userRole && (
              <Badge variant="outline" className="text-xs">
                {userRole}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-6 max-h-[500px] overflow-y-auto">
          {Object.entries(groupedPermissions).map(([resource, perms]) => (
            <div key={resource} className="space-y-2">
              <h3 className="font-medium text-sm capitalize">
                {resource} Permissions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perms.map(perm => (
                  <label
                    key={perm.name}
                    className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedPermissions.has(perm.name)}
                      onCheckedChange={() => handlePermissionToggle(perm.name)}
                    />
                    <PermissionBadge permission={perm.name} />
                    {perm.description && (
                      <span className="text-xs text-muted-foreground">
                        {perm.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setSelectedPermissions(new Set(permissions.map(p => p.name)))}
            disabled={saving}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}