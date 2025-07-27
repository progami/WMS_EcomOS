import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { businessLogger } from '@/lib/logger/server'

// Permission format: resource:action (e.g., 'invoice:create', 'inventory:read')
export interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description?: string | null
}

export interface UserWithPermissions {
  id: string
  role: UserRole
  permissions: Permission[]
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    // Full access to all resources
    'invoice:create', 'invoice:read', 'invoice:update', 'invoice:delete', 'invoice:dispute', 'invoice:reconcile', 'invoice:pay',
    'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete', 'inventory:adjust', 'inventory:transfer',
    'warehouse:create', 'warehouse:read', 'warehouse:update', 'warehouse:delete', 'warehouse:manage',
    'user:create', 'user:read', 'user:update', 'user:delete', 'user:manage',
    'sku:create', 'sku:read', 'sku:update', 'sku:delete', 'sku:manage',
    'rate:create', 'rate:read', 'rate:update', 'rate:delete', 'rate:manage',
    'report:view', 'report:export', 'report:financial', 'report:operational',
    'settings:read', 'settings:update', 'settings:manage',
    'audit:read', 'audit:export',
    'transaction:create', 'transaction:read', 'transaction:update', 'transaction:delete', 'transaction:reconcile',
    'cost:calculate', 'cost:adjust', 'cost:approve',
    'demo:setup', 'demo:manage',
    'amazon:sync', 'amazon:manage',
    'export:data', 'import:data'
  ],
  staff: [
    // Limited access based on operational needs
    'invoice:read', 'invoice:dispute',
    'inventory:read', 'inventory:create', 'inventory:update',
    'warehouse:read',
    'sku:read',
    'rate:read',
    'report:view', 'report:operational',
    'transaction:create', 'transaction:read',
    'export:data'
  ]
}

export class PermissionService {
  /**
   * Initialize default permissions in the database
   */
  static async initializePermissions(): Promise<void> {
    try {
      const permissionData = [
        // Invoice permissions
        { name: 'invoice:create', resource: 'invoice', action: 'create', description: 'Create new invoices' },
        { name: 'invoice:read', resource: 'invoice', action: 'read', description: 'View invoices' },
        { name: 'invoice:update', resource: 'invoice', action: 'update', description: 'Update invoices' },
        { name: 'invoice:delete', resource: 'invoice', action: 'delete', description: 'Delete invoices' },
        { name: 'invoice:dispute', resource: 'invoice', action: 'dispute', description: 'Dispute invoices' },
        { name: 'invoice:reconcile', resource: 'invoice', action: 'reconcile', description: 'Reconcile invoices' },
        { name: 'invoice:pay', resource: 'invoice', action: 'pay', description: 'Mark invoices as paid' },
        
        // Inventory permissions
        { name: 'inventory:create', resource: 'inventory', action: 'create', description: 'Create inventory transactions' },
        { name: 'inventory:read', resource: 'inventory', action: 'read', description: 'View inventory' },
        { name: 'inventory:update', resource: 'inventory', action: 'update', description: 'Update inventory' },
        { name: 'inventory:delete', resource: 'inventory', action: 'delete', description: 'Delete inventory records' },
        { name: 'inventory:adjust', resource: 'inventory', action: 'adjust', description: 'Adjust inventory quantities' },
        { name: 'inventory:transfer', resource: 'inventory', action: 'transfer', description: 'Transfer inventory between warehouses' },
        
        // Warehouse permissions
        { name: 'warehouse:create', resource: 'warehouse', action: 'create', description: 'Create warehouses' },
        { name: 'warehouse:read', resource: 'warehouse', action: 'read', description: 'View warehouses' },
        { name: 'warehouse:update', resource: 'warehouse', action: 'update', description: 'Update warehouse details' },
        { name: 'warehouse:delete', resource: 'warehouse', action: 'delete', description: 'Delete warehouses' },
        { name: 'warehouse:manage', resource: 'warehouse', action: 'manage', description: 'Manage warehouse settings' },
        
        // User permissions
        { name: 'user:create', resource: 'user', action: 'create', description: 'Create users' },
        { name: 'user:read', resource: 'user', action: 'read', description: 'View users' },
        { name: 'user:update', resource: 'user', action: 'update', description: 'Update user details' },
        { name: 'user:delete', resource: 'user', action: 'delete', description: 'Delete users' },
        { name: 'user:manage', resource: 'user', action: 'manage', description: 'Manage user permissions' },
        
        // SKU permissions
        { name: 'sku:create', resource: 'sku', action: 'create', description: 'Create SKUs' },
        { name: 'sku:read', resource: 'sku', action: 'read', description: 'View SKUs' },
        { name: 'sku:update', resource: 'sku', action: 'update', description: 'Update SKU details' },
        { name: 'sku:delete', resource: 'sku', action: 'delete', description: 'Delete SKUs' },
        { name: 'sku:manage', resource: 'sku', action: 'manage', description: 'Manage SKU configurations' },
        
        // Rate permissions
        { name: 'rate:create', resource: 'rate', action: 'create', description: 'Create rates' },
        { name: 'rate:read', resource: 'rate', action: 'read', description: 'View rates' },
        { name: 'rate:update', resource: 'rate', action: 'update', description: 'Update rates' },
        { name: 'rate:delete', resource: 'rate', action: 'delete', description: 'Delete rates' },
        { name: 'rate:manage', resource: 'rate', action: 'manage', description: 'Manage rate configurations' },
        
        // Report permissions
        { name: 'report:view', resource: 'report', action: 'view', description: 'View reports' },
        { name: 'report:export', resource: 'report', action: 'export', description: 'Export reports' },
        { name: 'report:financial', resource: 'report', action: 'financial', description: 'View financial reports' },
        { name: 'report:operational', resource: 'report', action: 'operational', description: 'View operational reports' },
        
        // Settings permissions
        { name: 'settings:read', resource: 'settings', action: 'read', description: 'View settings' },
        { name: 'settings:update', resource: 'settings', action: 'update', description: 'Update settings' },
        { name: 'settings:manage', resource: 'settings', action: 'manage', description: 'Manage system settings' },
        
        // Audit permissions
        { name: 'audit:read', resource: 'audit', action: 'read', description: 'View audit logs' },
        { name: 'audit:export', resource: 'audit', action: 'export', description: 'Export audit logs' },
        
        // Transaction permissions
        { name: 'transaction:create', resource: 'transaction', action: 'create', description: 'Create transactions' },
        { name: 'transaction:read', resource: 'transaction', action: 'read', description: 'View transactions' },
        { name: 'transaction:update', resource: 'transaction', action: 'update', description: 'Update transactions' },
        { name: 'transaction:delete', resource: 'transaction', action: 'delete', description: 'Delete transactions' },
        { name: 'transaction:reconcile', resource: 'transaction', action: 'reconcile', description: 'Reconcile transactions' },
        
        // Cost permissions
        { name: 'cost:calculate', resource: 'cost', action: 'calculate', description: 'Calculate costs' },
        { name: 'cost:adjust', resource: 'cost', action: 'adjust', description: 'Adjust cost calculations' },
        { name: 'cost:approve', resource: 'cost', action: 'approve', description: 'Approve cost adjustments' },
        
        // Demo permissions
        { name: 'demo:setup', resource: 'demo', action: 'setup', description: 'Setup demo data' },
        { name: 'demo:manage', resource: 'demo', action: 'manage', description: 'Manage demo environment' },
        
        // Amazon integration permissions
        { name: 'amazon:sync', resource: 'amazon', action: 'sync', description: 'Sync Amazon data' },
        { name: 'amazon:manage', resource: 'amazon', action: 'manage', description: 'Manage Amazon integration' },
        
        // Import/Export permissions
        { name: 'export:data', resource: 'export', action: 'data', description: 'Export data' },
        { name: 'import:data', resource: 'import', action: 'data', description: 'Import data' }
      ]

      // Upsert permissions
      for (const perm of permissionData) {
        await prisma.permissions.upsert({
          where: { name: perm.name },
          update: { description: perm.description },
          create: perm
        })
      }

      // Initialize role permissions
      await this.initializeRolePermissions()

      businessLogger.info('Permissions initialized successfully')
    } catch (error) {
      businessLogger.error('Failed to initialize permissions', { error })
      throw error
    }
  }

  /**
   * Initialize default role permissions
   */
  private static async initializeRolePermissions(): Promise<void> {
    try {
      // Get all permissions
      const allPermissions = await prisma.permissions.findMany()
      const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]))

      // Set up permissions for each role
      for (const [role, permissionNames] of Object.entries(DEFAULT_PERMISSIONS)) {
        for (const permName of permissionNames) {
          const permId = permissionMap.get(permName)
          if (permId) {
            await prisma.role_permissions.upsert({
              where: {
                role_permission_id: {
                  role: role as UserRole,
                  permission_id: permId
                }
              },
              update: {},
              create: {
                role: role as UserRole,
                permission_id: permId
              }
            })
          }
        }
      }

      businessLogger.info('Role permissions initialized successfully')
    } catch (error) {
      businessLogger.error('Failed to initialize role permissions', { error })
      throw error
    }
  }

  /**
   * Get all permissions for a user (including role-based and user-specific)
   */
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: user_id },
        select: {
          role: true,
          user_permissions: {
            select: {
              granted: true,
              permissions: true
            }
          }
        }
      })

      if (!user) {
        return []
      }

      // Get role-based permissions
      const rolePermissions = await prisma.role_permissions.findMany({
        where: { role: user.role },
        select: {
          permissions: true
        }
      })

      // Combine role permissions with user-specific permissions
      const permissionMap = new Map<string, Permission>()

      // Add role permissions
      for (const rp of rolePermissions) {
        permissionMap.set(rp.permissions.id, rp.permissions)
      }

      // Apply user-specific permissions (can grant or revoke)
      for (const up of user.user_permissions) {
        if (up.granted) {
          permissionMap.set(up.permissions.id, up.permissions)
        } else {
          permissionMap.delete(up.permissions.id)
        }
      }

      return Array.from(permissionMap.values())
    } catch (error) {
      businessLogger.error('Failed to get user permissions', { user_id, error })
      return []
    }
  }

  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId)
      return permissions.some(p => p.name === permissionName)
    } catch (error) {
      businessLogger.error('Failed to check permission', { user_id, permissionName, error })
      return false
    }
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static async hasAnyPermission(userId: string, permissionNames: string[]): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId)
      const userPermissionNames = new Set(permissions.map(p => p.name))
      return permissionNames.some(name => userPermissionNames.has(name))
    } catch (error) {
      businessLogger.error('Failed to check permissions', { user_id, permissionNames, error })
      return false
    }
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static async hasAllPermissions(userId: string, permissionNames: string[]): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId)
      const userPermissionNames = new Set(permissions.map(p => p.name))
      return permissionNames.every(name => userPermissionNames.has(name))
    } catch (error) {
      businessLogger.error('Failed to check permissions', { user_id, permissionNames, error })
      return false
    }
  }

  /**
   * Grant a specific permission to a user
   */
  static async grantPermission(userId: string, permissionName: string): Promise<void> {
    try {
      const permission = await prisma.permissions.findUnique({
        where: { name: permissionName }
      })

      if (!permission) {
        throw new Error(`Permission '${permissionName}' not found`)
      }

      await prisma.users_permissions.upsert({
        where: {
          user_permission_id: {
            user_id: user_id,
            permission_id: permission.id
          }
        },
        update: { granted: true },
        create: {
          user_id: user_id,
          permission_id: permission.id,
          granted: true
        }
      })

      businessLogger.info('Permission granted', { user_id, permissionName })
    } catch (error) {
      businessLogger.error('Failed to grant permission', { user_id, permissionName, error })
      throw error
    }
  }

  /**
   * Revoke a specific permission from a user
   */
  static async revokePermission(userId: string, permissionName: string): Promise<void> {
    try {
      const permission = await prisma.permissions.findUnique({
        where: { name: permissionName }
      })

      if (!permission) {
        throw new Error(`Permission '${permissionName}' not found`)
      }

      await prisma.users_permissions.upsert({
        where: {
          user_permission_id: {
            user_id: user_id,
            permission_id: permission.id
          }
        },
        update: { granted: false },
        create: {
          user_id: user_id,
          permission_id: permission.id,
          granted: false
        }
      })

      businessLogger.info('Permission revoked', { user_id, permissionName })
    } catch (error) {
      businessLogger.error('Failed to revoke permission', { user_id, permissionName, error })
      throw error
    }
  }

  /**
   * Get permissions for a specific resource
   */
  static async getResourcePermissions(resource: string): Promise<Permission[]> {
    try {
      return await prisma.permissions.findMany({
        where: { resource },
        orderBy: { name: 'asc' }
      })
    } catch (error) {
      businessLogger.error('Failed to get resource permissions', { resource, error })
      return []
    }
  }

  /**
   * Check if user can access a specific warehouse
   */
  static async canAccessWarehouse(userId: string, warehouse_id: string): Promise<boolean> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: user_id },
        select: {
          role: true,
          warehouse_id: true
        }
      })

      if (!user) return false

      // Admins can access all warehouses
      if (user.role === 'admin') return true

      // Staff can only access their assigned warehouse
      return user.warehouse_id === warehouse_id
    } catch (error) {
      businessLogger.error('Failed to check warehouse access', { user_id, warehouse_id, error })
      return false
    }
  }
}