import { PrismaClient } from '@prisma/client'
import { Session } from 'next-auth'
import { businessLogger, apiLogger, perfLogger, securityLogger } from '@/lib/logger/server'
import { getWarehouseFilter } from '@/lib/auth-utils'

export interface ServiceContext {
  session: Session
  prisma: PrismaClient
}

export interface TransactionOptions {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
}

export abstract class BaseService {
  protected prisma: PrismaClient
  protected session: Session | null = null

  constructor(protected context: ServiceContext) {
    this.prisma = context.prisma
    this.session = context.session
  }

  /**
   * Execute database operations within a transaction
   */
  protected async executeInTransaction<T>(
    operation: (tx: PrismaClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const startTime = Date.now()
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      businessLogger.info(`Starting transaction`, {
        transaction_id,
        service: this.constructor.name,
        user_id: this.session?.user?.id
      })

      const result = await this.prisma.$transaction(
        async (tx) => {
          // Type assertion to handle Prisma transaction client type
          return await operation(tx as PrismaClient)
        },
        {
          isolationLevel: options?.isolationLevel,
          maxWait: 5000,
          timeout: 10000
        }
      )

      const duration = Date.now() - startTime
      perfLogger.log(`Transaction completed`, {
        transaction_id,
        service: this.constructor.name,
        duration
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      businessLogger.error(`Transaction failed`, {
        transaction_id,
        service: this.constructor.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        user_id: this.session?.user?.id
      })
      throw error
    }
  }

  /**
   * Log audit trail for important operations
   */
  protected async logAudit(
    action: string,
    entity_type: string,
    entity_id: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await this.prisma.audit_logs.create({
        data: {
          user_id: this.session?.user?.id || 'system',
          action,
          entity_type,
          entity_id,
          details: details ? JSON.stringify(details) : null,
          ip_address: null, // Can be extracted from request in actual implementation
          user_agent: null  // Can be extracted from request in actual implementation
        }
      })

      securityLogger.info(`Audit log created`, {
        action,
        entity_type,
        entity_id,
        user_id: this.session?.user?.id,
        service: this.constructor.name
      })
    } catch (error) {
      // Don't throw on audit log failures
      securityLogger.error(`Failed to create audit log`, {
        action,
        entity_type,
        entity_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: this.session?.user?.id
      })
    }
  }

  /**
   * Check if user has permission for a specific action
   */
  protected async checkPermission(permission: string): Promise<boolean> {
    if (!this.session?.user) {
      return false
    }

    // Admin users have all permissions
    if (this.session.user.role === 'admin') {
      return true
    }

    // Check specific permission for the user
    const userPermission = await this.prisma.users_permissions.findFirst({
      where: {
        user_id: this.session.user.id,
        permission: {
          name: permission
        }
      },
      include: {
        permission: true
      }
    })

    return !!userPermission
  }

  /**
   * Ensure user has required permission, throw if not
   */
  protected async requirePermission(permission: string): Promise<void> {
    const hasPermission = await this.checkPermission(permission)
    
    if (!hasPermission) {
      securityLogger.warn(`Permission denied`, {
        permission,
        user_id: this.session?.user?.id,
        service: this.constructor.name
      })
      throw new Error(`Permission denied: ${permission}`)
    }
  }

  /**
   * Get warehouse filter based on user permissions
   */
  protected getWarehouseFilter(warehouseId?: string): { warehouseId?: string } | null {
    if (!this.session) {
      return null
    }
    return getWarehouseFilter(this.session, warehouseId)
  }

  /**
   * Handle service errors consistently
   */
  protected handleError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    businessLogger.error(`Service operation failed`, {
      service: this.constructor.name,
      operation,
      error: errorMessage,
      user_id: this.session?.user?.id
    })

    // Re-throw with consistent error structure
    throw new Error(`${operation} failed: ${errorMessage}`)
  }

  /**
   * Validate required fields
   */
  protected validateRequired<T extends Record<string, any>>(
    data: T,
    requiredFields: (keyof T)[]
  ): void {
    const missingFields = requiredFields.filter(field => !data[field])
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }
  }

  /**
   * Sanitize data for safe storage
   */
  protected sanitizeData<T extends Record<string, any>>(data: T): T {
    const sanitized = { ...data }
    
    // Remove any potential script tags or dangerous content
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .trim()
      }
    })
    
    return sanitized
  }

  /**
   * Get pagination parameters with defaults
   */
  protected getPaginationParams(params: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    return {
      page: Math.max(1, params.page || 1),
      limit: Math.min(100, Math.max(1, params.limit || 10)),
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'desc'
    }
  }

  /**
   * Create paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    params: { page: number; limit: number }
  ) {
    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    }
  }
}