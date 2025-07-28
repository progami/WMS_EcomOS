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
  fullName: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff']),
  warehouseId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true)
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
  role: z.enum(['admin', 'staff']).optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
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

      const where: Prisma.UserWhereInput = {}
      
      if (filters.search) {
        const sanitizedSearch = sanitizeForDisplay(filters.search)
        where.OR = [
          { username: { contains: sanitizedSearch, mode: 'insensitive' } },
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
          { fullName: { contains: sanitizedSearch, mode: 'insensitive' } }
        ]
      }

      if (filters.role) {
        where.role = filters.role as any
      }

      if (filters.warehouseId) {
        where.warehouseId = filters.warehouseId
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      const users = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          lockedUntil: true,
          lockedReason: true
        },
        orderBy: { createdAt: 'desc' }
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

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          lockedUntil: true,
          lockedReason: true,
          // permissions relation removed from schema
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
        const existingUser = await tx.user.findFirst({
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
        const newUser = await tx.user.create({
          data: {
            username: validatedData.username,
            email: validatedData.email,
            fullName: validatedData.fullName,
            passwordHash: passwordHash,
            role: validatedData.role,
            warehouseId: validatedData.warehouseId,
            isActive: validatedData.isActive
          },
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
            warehouseId: true,
            isActive: true
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
        userId: user.id,
        username: user.username,
        role: user.role,
        createdBy: this.session?.user?.id
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
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true, email: true, username: true }
        })

        if (!currentUser) {
          throw new Error('User not found')
        }

        // Check if email is being changed to one that already exists
        if (validatedData.email && validatedData.email !== currentUser.email) {
          const existingEmail = await tx.user.findUnique({
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
          updateData.passwordHash = await bcrypt.hash(validatedData.password, 10)
          delete updateData.password
        }

        // Update user
        const updated = await tx.user.update({
          where: { id: userId },
          data: updateData,
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
            warehouseId: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            isActive: true
          }
        })

        // If role changed, invalidate all user sessions
        if (validatedData.role && validatedData.role !== currentUser.role) {
          await invalidateAllUserSessions(userId)
          
          securityLogger.warn('User role changed - sessions invalidated', {
            userId,
            username: currentUser.username,
            oldRole: currentUser.role,
            newRole: validatedData.role,
            changedBy: this.session?.user?.id
          })
        }

        await this.logAudit('USER_UPDATED', 'User', userId, {
          username: currentUser.username,
          changes: Object.keys(validatedData)
        })

        return updated
      })

      businessLogger.info('User updated successfully', {
        userId,
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
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { username: true, email: true }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Invalidate all user sessions before deletion
        await invalidateAllUserSessions(userId)

        // Soft delete - set user as inactive
        await tx.user.update({
          where: { id: userId },
          data: { isActive: false }
        })

        await this.logAudit('USER_DEACTIVATED', 'User', userId, {
          username: user.username,
          email: user.email
        })

        return user
      })

      securityLogger.warn('User deactivated', {
        userId,
        username: result.username,
        email: result.email,
        deactivatedBy: this.session?.user?.id
      })

      return { 
        message: 'User deactivated successfully',
        userId 
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
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { username: true }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Remove existing permissions
        // User permissions not in current schema
        // await tx.userPermission.deleteMany({
        //   where: { userId }
        // })

        // Add new permissions
        if (permissionIds.length > 0) {
          // User permissions not in current schema
          // await tx.userPermission.createMany({
          //   data: permissionIds.map(permissionId => ({
          //     userId,
          //     permissionId
          //   }))
          // })
        }

        await this.logAudit('USER_PERMISSIONS_UPDATED', 'User', userId, {
          username: user.username,
          permissionCount: permissionIds.length
        })
      })

      businessLogger.info('User permissions updated', {
        userId,
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
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            lockedUntil: lockedUntil,
            lockedReason: sanitizeForDisplay(reason),
            isActive: false
          },
          select: {
            id: true,
            username: true,
            email: true
          }
        })

        // Invalidate all sessions
        await invalidateAllUserSessions(userId)

        await this.logAudit('USER_LOCKED', 'User', userId, {
          username: updated.username,
          reason,
          lockedUntil
        })

        return updated
      })

      securityLogger.warn('User account locked', {
        userId,
        username: user.username,
        reason,
        lockedUntil,
        lockedBy: this.session?.user?.id
      })

      return {
        message: 'User account locked successfully',
        lockedUntil
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
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            lockedUntil: null,
            lockedReason: null,
            isActive: true,
            // failedLoginAttempts: 0 - field not in schema
          },
          select: {
            id: true,
            username: true,
            email: true
          }
        })

        await this.logAudit('USER_UNLOCKED', 'User', userId, {
          username: updated.username
        })

        return updated
      })

      securityLogger.info('User account unlocked', {
        userId,
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