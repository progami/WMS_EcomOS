import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PermissionService } from '@/lib/services/permission-service'
import { securityLogger } from '@/lib/logger/server'
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags'

export interface PermissionCheckOptions {
  permissions?: string | string[]
  requireAll?: boolean
  checkWarehouseAccess?: boolean
  warehouseIdParam?: string
}

/**
 * Middleware to check user permissions
 */
export async function withPermission(
  request: NextRequest,
  options: PermissionCheckOptions,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Skip permission check for admin users
    if (session.user.role === 'admin') {
      return await handler(request)
    }
    
    // Check if permission system is enabled via feature flag
    const permissionSystemEnabled = await isFeatureEnabled(FEATURE_FLAGS.PERMISSION_SYSTEM)
    
    // Check permissions if specified and feature is enabled
    if (options.permissions && permissionSystemEnabled) {
      const requiredPermissions = Array.isArray(options.permissions) 
        ? options.permissions 
        : [options.permissions]

      const hasPermission = options.requireAll
        ? await PermissionService.hasAllPermissions(session.user.id, requiredPermissions)
        : await PermissionService.hasAnyPermission(session.user.id, requiredPermissions)

      if (!hasPermission) {
        securityLogger.warn('Permission denied', {
          user_id: session.user.id,
          requiredPermissions,
          userRole: session.user.role,
          path: request.nextUrl.pathname
        })
        
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Check warehouse access if specified
    if (options.checkWarehouseAccess && options.warehouseIdParam) {
      const warehouseId = request.nextUrl.searchParams.get(options.warehouseIdParam) ||
                         request.headers.get(`x-${options.warehouseIdParam}`)

      if (warehouseId) {
        const canAccess = await PermissionService.canAccessWarehouse(
          session.user.id,
          warehouseId
        )

        if (!canAccess) {
          securityLogger.warn('Warehouse access denied', {
            user_id: session.user.id,
            warehouse_id,
            userRole: session.user.role,
            path: request.nextUrl.pathname
          })
          
          return NextResponse.json(
            { error: 'Forbidden: Cannot access this warehouse' },
            { status: 403 }
          )
        }
      }
    }

    // Call the handler if all checks pass
    return await handler(request)
  } catch (error) {
    securityLogger.error('Permission middleware error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to check if user has permission (for use in server components)
 */
export async function checkPermission(
  user_id: string,
  permission: string | string[],
  requireAll = false
): Promise<boolean> {
  const permissions = Array.isArray(permission) ? permission : [permission]
  
  if (requireAll) {
    return await PermissionService.hasAllPermissions(userId, permissions)
  } else {
    return await PermissionService.hasAnyPermission(userId, permissions)
  }
}

/**
 * Express-style middleware wrapper for easier use
 */
export function requirePermission(permission: string | string[], requireAll = false) {
  return async (req: NextRequest) => {
    return withPermission(
      req,
      { permissions: permission, requireAll },
      async () => NextResponse.next()
    )
  }
}