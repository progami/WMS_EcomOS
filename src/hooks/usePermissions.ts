import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

/**
 * Hook to check user permissions on the client side
 */
export function usePermissions() {
  const { data: session } = useSession()

  const permissions = useMemo(() => {
    return new Set(session?.user?.permissions || [])
  }, [session?.user?.permissions])

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: string): boolean => {
    // Admin role has all permissions by default
    if (session?.user?.role === 'admin') return true
    return permissions.has(permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (permissionList: string[]): boolean => {
    // Admin role has all permissions by default
    if (session?.user?.role === 'admin') return true
    return permissionList.some(permission => permissions.has(permission))
  }

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (permissionList: string[]): boolean => {
    // Admin role has all permissions by default
    if (session?.user?.role === 'admin') return true
    return permissionList.every(permission => permissions.has(permission))
  }

  /**
   * Check if user can perform an action on a resource
   */
  const can = (action: string, resource: string): boolean => {
    return hasPermission(`${resource}:${action}`)
  }

  /**
   * Check if user cannot perform an action on a resource
   */
  const cannot = (action: string, resource: string): boolean => {
    return !can(action, resource)
  }

  return {
    permissions: Array.from(permissions),
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    can,
    cannot,
    isAdmin: session?.user?.role === 'admin',
    isStaff: session?.user?.role === 'staff',
    isAuthenticated: !!session
  }
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = {
  // Invoice permissions
  INVOICE_CREATE: 'invoice:create',
  INVOICE_READ: 'invoice:read',
  INVOICE_UPDATE: 'invoice:update',
  INVOICE_DELETE: 'invoice:delete',
  INVOICE_DISPUTE: 'invoice:dispute',
  INVOICE_RECONCILE: 'invoice:reconcile',
  INVOICE_PAY: 'invoice:pay',
  
  // Inventory permissions
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  
  // Warehouse permissions
  WAREHOUSE_CREATE: 'warehouse:create',
  WAREHOUSE_READ: 'warehouse:read',
  WAREHOUSE_UPDATE: 'warehouse:update',
  WAREHOUSE_DELETE: 'warehouse:delete',
  WAREHOUSE_MANAGE: 'warehouse:manage',
  
  // User permissions
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // SKU permissions
  SKU_CREATE: 'sku:create',
  SKU_READ: 'sku:read',
  SKU_UPDATE: 'sku:update',
  SKU_DELETE: 'sku:delete',
  SKU_MANAGE: 'sku:manage',
  
  // Rate permissions
  RATE_CREATE: 'rate:create',
  RATE_READ: 'rate:read',
  RATE_UPDATE: 'rate:update',
  RATE_DELETE: 'rate:delete',
  RATE_MANAGE: 'rate:manage',
  
  // Report permissions
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
  REPORT_FINANCIAL: 'report:financial',
  REPORT_OPERATIONAL: 'report:operational',
  
  // Settings permissions
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_MANAGE: 'settings:manage',
  
  // Audit permissions
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:export',
  
  // Transaction permissions
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_READ: 'transaction:read',
  TRANSACTION_UPDATE: 'transaction:update',
  TRANSACTION_DELETE: 'transaction:delete',
  TRANSACTION_RECONCILE: 'transaction:reconcile',
  
  // Cost permissions
  COST_CALCULATE: 'cost:calculate',
  COST_ADJUST: 'cost:adjust',
  COST_APPROVE: 'cost:approve',
  
  // Demo permissions
  DEMO_SETUP: 'demo:setup',
  DEMO_MANAGE: 'demo:manage',
  
  // Amazon integration permissions
  AMAZON_SYNC: 'amazon:sync',
  AMAZON_MANAGE: 'amazon:manage',
  
  // Import/Export permissions
  EXPORT_DATA: 'export:data',
  IMPORT_DATA: 'import:data'
} as const