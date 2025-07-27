import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PermissionService } from '@/lib/services/permission-service'
import { withPermission } from '@/lib/middleware/permission-middleware'
import { logger } from '@/lib/logger/server'

export const dynamic = 'force-dynamic'

// POST /api/admin/permissions/initialize - Initialize permissions in the database
export async function POST(req: NextRequest) {
  return withPermission(req, { permissions: 'settings:manage' }, async () => {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Initialize permissions
      await PermissionService.initializePermissions()

      logger.info('Permissions initialized', {
        user_id: session.user.id,
        username: session.user.email
      })

      return NextResponse.json({ 
        message: 'Permissions initialized successfully',
        success: true 
      })
    } catch (error) {
      logger.error('Failed to initialize permissions', { error })
      return NextResponse.json(
        { error: 'Failed to initialize permissions' },
        { status: 500 }
      )
    }
  })
}