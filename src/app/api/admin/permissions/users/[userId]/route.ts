import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PermissionService } from '@/lib/services/permission-service'
import { withPermission } from '@/lib/middleware/permission-middleware'
import { businessLogger } from '@/lib/logger/server'
import { z } from 'zod'
import { PERMISSIONS } from '@/hooks/usePermissions'

export const dynamic = 'force-dynamic'

// Schema for permission updates
const updatePermissionsSchema = z.object({
  grant: z.array(z.string()).optional(),
  revoke: z.array(z.string()).optional()
})

// GET /api/admin/permissions/users/[userId] - Get user permissions
export async function GET(
  req: NextRequest,
  { params }: { params: { user_id: string } }
) {
  return withPermission(req, { permissions: PERMISSIONS.USER_MANAGE }, async () => {
    try {
      const permissions = await PermissionService.getUserPermissions(params.user_id952)
      
      return NextResponse.json({
        user_id: params.user_id,
        permissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          resource: p.resource,
          action: p.action,
          description: p.description
        }))
      })
    } catch (error) {
      businessLogger.error('Failed to get user permissions', { 
        user_id: params.user_id, 
        error 
      })
      return NextResponse.json(
        { error: 'Failed to get user permissions' },
        { status: 500 }
      )
    }
  })
}

// PATCH /api/admin/permissions/users/[userId] - Update user permissions
export async function PATCH(
  req: NextRequest,
  { params }: { params: { user_id: string } }
) {
  return withPermission(req, { permissions: PERMISSIONS.USER_MANAGE }, async () => {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await req.json()
      const validatedData = updatePermissionsSchema.parse(body)

      // Grant permissions
      if (validatedData.grant) {
        for (const permissionName of validatedData.grant) {
          await PermissionService.grantPermission(params.user_id, permissionName)
        }
      }

      // Revoke permissions
      if (validatedData.revoke) {
        for (const permissionName of validatedData.revoke) {
          await PermissionService.revokePermission(params.user_id, permissionName)
        }
      }

      // Get updated permissions
      const updatedPermissions = await PermissionService.getUserPermissions(params.user_id)

      businessLogger.info('User permissions updated', {
        user_id: params.user_id,
        granted: validatedData.grant,
        revoked: validatedData.revoke,
        updatedBy: session.user.id
      })

      return NextResponse.json({
        user_id: params.user_id,
        permissions: updatedPermissions.map(p => ({
          id: p.id,
          name: p.name,
          resource: p.resource,
          action: p.action,
          description: p.description
        }))
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid data', details: error.errors },
          { status: 400 }
        )
      }
      businessLogger.error('Failed to update user permissions', { 
        user_id: params.user_id, 
        error 
      })
      return NextResponse.json(
        { error: 'Failed to update user permissions' },
        { status: 500 }
      )
    }
  })
}