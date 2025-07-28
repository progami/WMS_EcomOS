import { BaseService, ServiceContext } from './base.service'
import { z } from 'zod'
import { 
  sanitizeForDisplay, 
  validateAlphanumeric 
} from '@/lib/security/input-sanitization'
import { businessLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

// Validation schemas
const createWarehouseSchema = z.object({
  code: z.string().min(1).max(10).refine(validateAlphanumeric, {
    message: "Warehouse code must be alphanumeric"
  }).transform(val => sanitizeForDisplay(val)),
  name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  isActive: z.boolean().default(true)
})

const updateWarehouseSchema = z.object({
  code: z.string().min(1).max(10).optional().refine(val => !val || validateAlphanumeric(val), {
    message: "Warehouse code must be alphanumeric"
  }).transform(val => val ? sanitizeForDisplay(val) : val),
  name: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
  address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable().transform(val => val ? sanitizeForDisplay(val) : val),
  isActive: z.boolean().optional()
})

export interface WarehouseFilters {
  includeInactive?: boolean
  includeAmazon?: boolean
}

export interface PaginationParams {
  page?: number
  limit?: number
}

// Transform snake_case warehouse to camelCase for frontend compatibility
function transformWarehouse(warehouse: any) {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    latitude: warehouse.latitude,
    longitude: warehouse.longitude,
    contactEmail: warehouse.contactEmail,
    contactPhone: warehouse.contactPhone,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
    _count: warehouse._count
  }
}

export class WarehouseService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * List warehouses with filtering and pagination
   */
  async listWarehouses(filters: WarehouseFilters, pagination: PaginationParams) {
    try {
      await this.requirePermission('warehouse:read')

      const { page, limit } = this.getPaginationParams(pagination)
      const skip = (page - 1) * limit

      const where: Prisma.WarehouseWhereInput = filters.includeInactive 
        ? {} 
        : { isActive: true }
      
      // Exclude Amazon FBA warehouses unless explicitly requested
      if (!filters.includeAmazon) {
        where.NOT = {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }

      const [warehouses, total] = await Promise.all([
        this.prisma.warehouse.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                users: true,
                inventoryBalance: true,
                invoices: true
              }
            }
          }
        }),
        this.prisma.warehouse.count({ where })
      ])

      // Transform snake_case to camelCase for frontend
      const transformedWarehouses = warehouses.map(transformWarehouse)
      
      return this.createPaginatedResponse(transformedWarehouses, total, { page, limit })
    } catch (error) {
      this.handleError(error, 'listWarehouses')
    }
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouse(warehouseId: string) {
    try {
      await this.requirePermission('warehouse:read')

      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          _count: {
            select: {
              users: true,
              inventory_balances: true,
              invoices: true,
              inventoryTransaction: true,
              calculatedCost: true
            }
          }
        }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      return transformWarehouse(warehouse)
    } catch (error) {
      this.handleError(error, 'getWarehouse')
    }
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(data: z.infer<typeof createWarehouseSchema>) {
    try {
      await this.requirePermission('warehouse:create')
      
      const validatedData = createWarehouseSchema.parse(data)

      const warehouse = await this.executeInTransaction(async (tx) => {
        // Check if warehouse code or name already exists (case-insensitive)
        const existingWarehouse = await tx.warehouse.findFirst({
          where: {
            OR: [
              { code: { equals: validatedData.code, mode: 'insensitive' } },
              { name: { equals: validatedData.name, mode: 'insensitive' } }
            ]
          }
        })

        if (existingWarehouse) {
          if (existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
            throw new Error('Warehouse code already exists (case-insensitive match)')
          } else {
            throw new Error('Warehouse name already exists (case-insensitive match)')
          }
        }

        const newWarehouse = await tx.warehouse.create({
          data: {
            code: validatedData.code,
            name: validatedData.name,
            address: validatedData.address || null,
            latitude: validatedData.latitude || null,
            longitude: validatedData.longitude || null,
            contactEmail: validatedData.contactEmail || null,
            contactPhone: validatedData.contactPhone || null,
            isActive: validatedData.isActive
          },
          include: {
            _count: {
              select: {
                users: true,
                inventoryBalance: true,
                invoices: true
              }
            }
          }
        })

        await this.logAudit('WAREHOUSE_CREATED', 'Warehouse', newWarehouse.id, {
          code: newWarehouse.code,
          name: newWarehouse.name
        })

        return newWarehouse
      })

      businessLogger.info('Warehouse created successfully', {
        warehouseId: warehouse.id,
        code: warehouse.code,
        name: warehouse.name
      })

      return transformWarehouse(warehouse)
    } catch (error) {
      this.handleError(error, 'createWarehouse')
    }
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(warehouseId: string, data: z.infer<typeof updateWarehouseSchema>) {
    try {
      await this.requirePermission('warehouse:update')
      
      const validatedData = updateWarehouseSchema.parse(data)

      const updatedWarehouse = await this.executeInTransaction(async (tx) => {
        // Check if warehouse exists
        const currentWarehouse = await tx.warehouse.findUnique({
          where: { id: warehouseId }
        })

        if (!currentWarehouse) {
          throw new Error('Warehouse not found')
        }

        // If updating code or name, check if they're already in use (case-insensitive)
        if (validatedData.code || validatedData.name) {
          const whereConditions = []
          
          if (validatedData.code) {
            whereConditions.push({
              code: { equals: validatedData.code, mode: 'insensitive' as const },
              id: { not: warehouseId }
            })
          }
          
          if (validatedData.name) {
            whereConditions.push({
              name: { equals: validatedData.name, mode: 'insensitive' as const },
              id: { not: warehouseId }
            })
          }
          
          const existingWarehouse = await tx.warehouse.findFirst({
            where: { OR: whereConditions }
          })

          if (existingWarehouse) {
            if (validatedData.code && existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
              throw new Error('Warehouse code already in use (case-insensitive match)')
            } else if (validatedData.name && existingWarehouse.name.toLowerCase() === validatedData.name.toLowerCase()) {
              throw new Error('Warehouse name already in use (case-insensitive match)')
            }
          }
        }

        // Transform camelCase to snake_case for database update
        const updateData: any = {}
        if (validatedData.code !== undefined) updateData.code = validatedData.code
        if (validatedData.name !== undefined) updateData.name = validatedData.name
        if (validatedData.address !== undefined) updateData.address = validatedData.address
        if (validatedData.latitude !== undefined) updateData.latitude = validatedData.latitude
        if (validatedData.longitude !== undefined) updateData.longitude = validatedData.longitude
        if (validatedData.contactEmail !== undefined) updateData.contactEmail = validatedData.contactEmail
        if (validatedData.contactPhone !== undefined) updateData.contactPhone = validatedData.contactPhone
        if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive

        const updated = await tx.warehouse.update({
          where: { id: warehouseId },
          data: updateData,
          include: {
            _count: {
              select: {
                users: true,
                inventoryBalance: true,
                invoices: true
              }
            }
          }
        })

        await this.logAudit('WAREHOUSE_UPDATED', 'Warehouse', warehouseId, {
          previousData: currentWarehouse,
          newData: updateData
        })

        return updated
      })

      businessLogger.info('Warehouse updated successfully', {
        warehouseId,
        changes: validatedData
      })

      return transformWarehouse(updatedWarehouse)
    } catch (error) {
      this.handleError(error, 'updateWarehouse')
    }
  }

  /**
   * Delete warehouse (soft delete if has related data)
   */
  async deleteWarehouse(warehouseId: string) {
    try {
      await this.requirePermission('warehouse:delete')

      const result = await this.executeInTransaction(async (tx) => {
        // Check if warehouse has related data
        const relatedData = await tx.warehouse.findUnique({
          where: { id: warehouseId },
          include: {
            _count: {
              select: {
                users: true,
                inventoryBalance: true,
                inventoryTransaction: true,
                invoices: true,
                calculatedCost: true
              }
            }
          }
        })

        if (!relatedData) {
          throw new Error('Warehouse not found')
        }

        // Check if warehouse has any related data
        const hasRelatedData = Object.values(relatedData._count).some(count => (count as number) > 0)
        
        if (hasRelatedData) {
          // Soft delete - just mark as inactive
          const updatedWarehouse = await tx.warehouse.update({
            where: { id: warehouseId },
            data: { isActive: false }
          })

          await this.logAudit('WAREHOUSE_DEACTIVATED', 'Warehouse', warehouseId, {
            code: relatedData.code,
            name: relatedData.name,
            reason: 'Has related data'
          })

          return {
            action: 'deactivated',
            warehouse: transformWarehouse(updatedWarehouse)
          }
        } else {
          // Hard delete - no related data
          await tx.warehouse.delete({
            where: { id: warehouseId }
          })

          await this.logAudit('WAREHOUSE_DELETED', 'Warehouse', warehouseId, {
            code: relatedData.code,
            name: relatedData.name
          })

          return {
            action: 'deleted'
          }
        }
      })

      businessLogger.info('Warehouse deletion completed', {
        warehouseId,
        action: result.action
      })

      return result
    } catch (error) {
      this.handleError(error, 'deleteWarehouse')
    }
  }

  /**
   * Get warehouse statistics
   */
  async getWarehouseStats(warehouseId: string) {
    try {
      await this.requirePermission('warehouse:read')

      const [
        inventoryStats,
        transactionStats,
        invoiceStats,
        userCount
      ] = await Promise.all([
        // Inventory statistics
        this.prisma.inventoryBalance.aggregate({
          where: { warehouseId: warehouseId },
          _sum: {
            currentCartons: true,
            currentPallets: true,
            currentUnits: true
          },
          _count: {
            skuId: true
          }
        }),
        
        // Transaction statistics
        this.prisma.inventoryTransaction.groupBy({
          by: ['transactionType'],
          where: {
            warehouseId: warehouseId,
            transactionDate: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
          },
          _count: true
        }),
        
        // Invoice statistics
        this.prisma.invoice.aggregate({
          where: { warehouseId: warehouseId },
          _sum: {
            totalAmount: true
          },
          _count: true
        }),
        
        // User count
        this.prisma.user.count({
          where: { warehouseId: warehouseId }
        })
      ])

      return {
        inventory: {
          totalSkus: inventoryStats._count.skuId,
          totalCartons: inventoryStats._sum.currentCartons || 0,
          totalPallets: inventoryStats._sum.currentPallets || 0,
          totalUnits: inventoryStats._sum.currentUnits || 0
        },
        transactions: {
          last30Days: transactionStats.reduce((acc, stat) => ({
            ...acc,
            [stat.transactionType.toLowerCase()]: stat._count
          }), {})
        },
        invoices: {
          total: invoiceStats._count,
          totalAmount: invoiceStats._sum.totalAmount || 0
        },
        users: userCount
      }
    } catch (error) {
      this.handleError(error, 'getWarehouseStats')
    }
  }
}