import { Session } from 'next-auth'
import { PermissionService } from '@/lib/services/permission-service'

/**
 * Check if a session has a specific permission
 * This is a convenience function for checking permissions in server components
 */
export async function hasPermission(
  session: Session | null,
  permission: string
): Promise<boolean> {
  if (!session) return false
  
  // Admin role has all permissions by default
  if (session.user.role === 'admin') return true
  
  // Check cached permissions in session first
  if (session.user.permissions?.includes(permission)) return true
  
  // Fallback to database check
  return await PermissionService.hasPermission(session.user.id, permission)
}

/**
 * Check if a session has any of the specified permissions
 */
export async function hasAnyPermission(
  session: Session | null,
  permissions: string[]
): Promise<boolean> {
  if (!session) return false
  
  // Admin role has all permissions by default
  if (session.user.role === 'admin') return true
  
  // Check cached permissions in session first
  if (session.user.permissions) {
    const userPermissions = new Set(session.user.permissions)
    if (permissions.some(p => userPermissions.has(p))) return true
  }
  
  // Fallback to database check
  return await PermissionService.hasAnyPermission(session.user.id, permissions)
}

/**
 * Check if a session has all of the specified permissions
 */
export async function hasAllPermissions(
  session: Session | null,
  permissions: string[]
): Promise<boolean> {
  if (!session) return false
  
  // Admin role has all permissions by default
  if (session.user.role === 'admin') return true
  
  // Check cached permissions in session first
  if (session.user.permissions) {
    const userPermissions = new Set(session.user.permissions)
    if (permissions.every(p => userPermissions.has(p))) return true
  }
  
  // Fallback to database check
  return await PermissionService.hasAllPermissions(session.user.id, permissions)
}

/**
 * Helper to check if user can perform an action on a resource
 */
export async function can(
  session: Session | null,
  action: string,
  resource: string
): Promise<boolean> {
  return hasPermission(session, `${resource}:${action}`)
}

/**
 * Helper to check if user cannot perform an action on a resource
 */
export async function cannot(
  session: Session | null,
  action: string,
  resource: string
): Promise<boolean> {
  return !(await can(session, action, resource))
}