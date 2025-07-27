import { BaseService, ServiceContext } from './base.service'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { 
  sanitizeForDisplay, 
  validateAlphanumeric 
} from '@/lib/security/input-sanitization'
import { invalidateAllUserSessions } from '@/lib/security/session-manager'
import { businessLogger, securityLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(3).max(50).refine(validateAlphanumeric, {
    message: "Username must be alphanumeric"
  }).transform(val => sanitizeForDisplay(val)),
  email: z.string().email(),
  full_name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff']),
  warehouse_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true)
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
  role: z.enum(['admin', 'staff']).optional(),
  warehouse_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional()
})

export interface UserFilters {
  search?: string
  role?: string
  warehouseId?: string
  isActive?: boolean
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export class UserService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * List users with filtering
   */
  async listUsers(filters: UserFilters) {
    try {
      await this.requirePermission('user:read')

      const where: Prisma.usersWhereInput = {}
      
      if (filters.search) {
        const sanitizedSearch = sanitizeForDisplay(filters.search)
        where.OR = [
          { username: { contains: sanitizedSearch, mode: 'insensitive' } },
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
          { full_name: { contains: sanitizedSearch, mode: 'insensitive' } }
        ]
      }

      if (filters.role) {
        where.role = filters.role
      }

      if (filters.warehouse_id) {
        where.warehouse_id = filters.warehouse_id
      }

      if (filters.is_active2275 !== undefined) {
        where.is_active = filters.is_active2335
      }

      const users = await this.prisma.users.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          full_name: true,
          role: true,
          warehouse_id: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
          locked_until: true,
          locked_reason: true
        },
        orderBy: { created_at: 'desc' }
      })

      return users
    } catch (error) {
      this.handleError(error, 'listUsers')
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string) {
    try {
      await this.requirePermission('user:read')

      const user = await this.prisma.users.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          username: true,
          email: true,
          full_name: true,
          role: true,
          warehouse_id: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
          locked_until: true,
          locked_reason: true,
          permissions: {
            include: {
              permission: true
            }
          }
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      return user
    } catch (error) {
      this.handleError(error, 'getUser')
    }
  }

  /**
   * Create a new user
   */
  async createUser(data: z.infer<typeof createUserSchema>) {
    try {
      await this.requirePermission('user:create')
      
      const validatedData = createUserSchema.parse(data)

      const user = await this.executeInTransaction(async (tx) => {
        // Check if username or email already exists
        const existingUser = await tx.users.findFirst({
          where: {
            OR: [
              { username: validatedData.username },
              { email: validatedData.email }
            ]
          }
        })

        if (existingUser) {
          throw new Error(
            existingUser.username === validatedData.username 
              ? 'Username already exists' 
              : 'Email already exists'
          )
        }

        // Hash password
        const passwordHash = await bcrypt.hash(validatedData.password, 10)

        // Create user
        const newUser = await tx.users.create({
          data: {
            username: validatedData.username,
            email: validatedData.email,
            full_name: validatedData.full_name,
            password_hash: password_hash,
            role: validatedData.role,
            warehouse_id: validatedData.warehouse_id,
            is_active: validatedData.is_active5333
          },
          select: {
            id: true,
            username: true,
            email: true,
            full_name: true,
            role: true,
            warehouse_id: true,
            is_active: true
          }
        })

        await this.logAudit('USER_CREATED', 'User', newUser.id, {
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        })

        return newUser
      })

      businessLogger.info('User created successfully', {
        user_id: user.id,
        username: user.username,
        role: user.role,
        created_by: this.session?.user?.id
      })

      return user
    } catch (error) {
      this.handleError(error, 'createUser')
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: z.infer<typeof updateUserSchema>) {
    try {
      await this.requirePermission('user:update')
      
      const validatedData = updateUserSchema.parse(data)

      const updatedUser = await this.executeInTransaction(async (tx) => {
        // Get current user data
        const currentUser = await tx.users.findUnique({
          where: { id: user_id },
          select: { role: true, email: true, username: true }
        })

        if (!currentUser) {
          throw new Error('User not found')
        }

        // Check if email is being changed to one that already exists
        if (validatedData.email && validatedData.email !== currentUser.email) {
          const existingEmail = await tx.users.findUnique({
            where: { email: validatedData.email }
          })
          
          if (existingEmail) {
            throw new Error('Email already in use')
          }
        }

        // Prepare update data
        const updateData: any = { ...validatedData }
        
        // Hash password if provided
        if (validatedData.password) {
          updateData.password_hash = await bcrypt.hash(validatedData.password, 10)
          delete updateData.password
        }

        // Update user
        const updated = await tx.users.update({
          where: { id: user_id },
          data: updateData,
          select: {
            id: true,
            username: true,
            email: true,
            full_name: true,
            role: true,
            warehouse_id: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            is_active: true
          }
        })

        // If role changed, invalidate all user sessions
        if (validatedData.role && validatedData.role !== currentUser.role) {
          await invalidateAllUserSessions(userId)
          
          securityLogger.warn('User role changed - sessions invalidated', {
            user_id,
            username: currentUser.username,
            oldRole: currentUser.role,
            newRole: validatedData.role,
            changedBy: this.session?.user?.id
          })
        }

        await this.logAudit('USER_UPDATED', 'User', user_id, {
          username: currentUser.username,
          changes: Object.keys(validatedData)
        })

        return updated
      })

      businessLogger.info('User updated successfully', {
        user_id,
        username: updatedUser.username,
        changes: Object.keys(validatedData),
        updatedBy: this.session?.user?.id
      })

      return updatedUser
    } catch (error) {
      this.handleError(error, 'updateUser')
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string) {
    try {
      await this.requirePermission('user:delete')

      // Prevent self-deletion
      if (userId === this.session?.user?.id) {
        throw new Error('Cannot delete your own account')
      }

      const result = await this.executeInTransaction(async (tx) => {
        // Get user info before deletion
        const user = await tx.users.findUnique({
          where: { id: user_id },
          select: { username: true, email: true }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Invalidate all user sessions before deletion
        await invalidateAllUserSessions(userId)

        // Soft delete - set user as inactive
        await tx.users.update({
          where: { id: user_id },
          data: { is_active: false }
        })

        await this.logAudit('USER_DEACTIVATED', 'User', user_id, {
          username: user.username,
          email: user.email
        })

        return user
      })

      securityLogger.warn('User deactivated', {
        user_id,
        username: result.username,
        email: result.email,
        deactivatedBy: this.session?.user?.id
      })

      return { 
        message: 'User deactivated successfully',
        user_id 
      }
    } catch (error) {
      this.handleError(error, 'deleteUser')
    }
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(userId: string, permissionIds: string[]) {
    try {
      await this.requirePermission('user:permissions')

      await this.executeInTransaction(async (tx) => {
        // Verify user exists
        const user = await tx.users.findUnique({
          where: { id: user_id },
          select: { username: true }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Remove existing permissions
        await tx.users_permissions.deleteMany({
          where: { user_id }
        })

        // Add new permissions
        if (permissionIds.length > 0) {
          await tx.users_permissions.createMany({
            data: permissionIds.map(permission_id => ({
              user_id,
              permission_id
            }))
          })
        }

        await this.logAudit('USER_PERMISSIONS_UPDATED', 'User', user_id, {
          username: user.username,
          permissionCount: permissionIds.length
        })
      })

      businessLogger.info('User permissions updated', {
        user_id,
        permissionCount: permissionIds.length,
        updatedBy: this.session?.user?.id
      })

      return { message: 'Permissions updated successfully' }
    } catch (error) {
      this.handleError(error, 'updateUserPermissions')
    }
  }

  /**
   * Lock user account
   */
  async lockUser(userId: string, reason: string, duration?: number) {
    try {
      await this.requirePermission('user:lock')

      const lockedUntil = duration 
        ? new Date(Date.now() + duration * 60 * 1000) // duration in minutes
        : null // Permanent lock

      const user = await this.executeInTransaction(async (tx) => {
        const updated = await tx.users.update({
          where: { id: user_id },
          data: {
            locked_until: locked_until,
            locked_reason: sanitizeForDisplay(reason),
            is_active: false
          },
          select: {
            id: true,
            username: true,
            email: true
          }
        })

        // Invalidate all sessions
        await invalidateAllUserSessions(userId)

        await this.logAudit('USER_LOCKED', 'User', user_id, {
          username: updated.username,
          reason,
          locked_until
        })

        return updated
      })

      securityLogger.warn('User account locked', {
        user_id,
        username: user.username,
        reason,
        locked_until,
        lockedBy: this.session?.user?.id
      })

      return {
        message: 'User account locked successfully',
        locked_until
      }
    } catch (error) {
      this.handleError(error, 'lockUser')
    }
  }

  /**
   * Unlock user account
   */
  async unlockUser(userId: string) {
    try {
      await this.requirePermission('user:unlock')

      const user = await this.executeInTransaction(async (tx) => {
        const updated = await tx.users.update({
          where: { id: user_id },
          data: {
            locked_until: null,
            locked_reason: null,
            is_active: true,
            failed_login_attempts: 0
          },
          select: {
            id: true,
            username: true,
            email: true
          }
        })

        await this.logAudit('USER_UNLOCKED', 'User', user_id, {
          username: updated.username
        })

        return updated
      })

      securityLogger.info('User account unlocked', {
        user_id,
        username: user.username,
        unlockedBy: this.session?.user?.id
      })

      return {
        message: 'User account unlocked successfully'
      }
    } catch (error) {
      this.handleError(error, 'unlockUser')
    }
  }
}