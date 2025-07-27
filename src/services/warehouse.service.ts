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
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  is_active: z.boolean().default(true)
})

const updateWarehouseSchema = z.object({
  code: z.string().min(1).max(10).optional().refine(val => !val || validateAlphanumeric(val), {
    message: "Warehouse code must be alphanumeric"
  }).transform(val => val ? sanitizeForDisplay(val) : val),
  name: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
  address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().optional().nullable().transform(val => val ? sanitizeForDisplay(val) : val),
  is_active: z.boolean().optional()
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
    contact_email: warehouse.contact_email,
    contact_phone: warehouse.contact_phone,
    is_active: warehouse.is_active,
    created_at: warehouse.created_at,
    updated_at: warehouse.updated_at,
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

      const where: Prisma.warehousesWhereInput = filters.includeInactive 
        ? {} 
        : { is_active: true }
      
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
        this.prisma.warehouses.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                users: true,
                inventory_balances: true,
                invoices: true
              }
            }
          }
        }),
        this.prisma.warehouses.count({ where })
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

      const warehouse = await this.prisma.warehouses.findUnique({
        where: { id: warehouse_id },
        include: {
          _count: {
            select: {
              users: true,
              inventory_balances: true,
              invoices: true,
              inventory_transactions: true,
              calculated_costs: true
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
        const existingWarehouse = await tx.warehouses.findFirst({
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

        const newWarehouse = await tx.warehouses.create({
          data: {
            code: validatedData.code,
            name: validatedData.name,
            address: validatedData.address || null,
            latitude: validatedData.latitude || null,
            longitude: validatedData.longitude || null,
            contact_email: validatedData.contact_email || null,
            contact_phone: validatedData.contact_phone || null,
            is_active: validatedData.is_active
          },
          include: {
            _count: {
              select: {
                users: true,
                inventory_balances: true,
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
        warehouse_id: warehouse.id,
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
        const currentWarehouse = await tx.warehouses.findUnique({
          where: { id: warehouse_id }
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
              id: { not: warehouse_id }
            })
          }
          
          if (validatedData.name) {
            whereConditions.push({
              name: { equals: validatedData.name, mode: 'insensitive' as const },
              id: { not: warehouse_id }
            })
          }
          
          const existingWarehouse = await tx.warehouses.findFirst({
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
        if (validatedData.contact_email !== undefined) updateData.contact_email = validatedData.contact_email
        if (validatedData.contact_phone !== undefined) updateData.contact_phone = validatedData.contact_phone
        if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active

        const updated = await tx.warehouses.update({
          where: { id: warehouse_id },
          data: updateData,
          include: {
            _count: {
              select: {
                users: true,
                inventory_balances: true,
                invoices: true
              }
            }
          }
        })

        await this.logAudit('WAREHOUSE_UPDATED', 'Warehouse', warehouse_id, {
          previousData: currentWarehouse,
          newData: updateData
        })

        return updated
      })

      businessLogger.info('Warehouse updated successfully', {
        warehouse_id,
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
        const relatedData = await tx.warehouses.findUnique({
          where: { id: warehouse_id },
          include: {
            _count: {
              select: {
                users: true,
                inventory_balances: true,
                inventory_transactions: true,
                invoices: true,
                calculated_costs: true
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
          const updatedWarehouse = await tx.warehouses.update({
            where: { id: warehouse_id },
            data: { is_active: false }
          })

          await this.logAudit('WAREHOUSE_DEACTIVATED', 'Warehouse', warehouse_id, {
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
          await tx.warehouses.delete({
            where: { id: warehouse_id }
          })

          await this.logAudit('WAREHOUSE_DELETED', 'Warehouse', warehouse_id, {
            code: relatedData.code,
            name: relatedData.name
          })

          return {
            action: 'deleted'
          }
        }
      })

      businessLogger.info('Warehouse deletion completed', {
        warehouse_id,
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
        this.prisma.inventory_balances.aggregate({
          where: { warehouse_id: warehouse_id },
          _sum: {
            current_cartons: true,
            current_pallets: true,
            current_units: true
          },
          _count: {
            sku_id: true
          }
        }),
        
        // Transaction statistics
        this.prisma.inventory_transactions.groupBy({
          by: ['transaction_type'],
          where: {
            warehouse_id: warehouse_id,
            transaction_date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
          },
          _count: true
        }),
        
        // Invoice statistics
        this.prisma.invoices.aggregate({
          where: { warehouse_id: warehouse_id },
          _sum: {
            total_amount: true
          },
          _count: true
        }),
        
        // User count
        this.prisma.users.count({
          where: { warehouse_id: warehouse_id }
        })
      ])

      return {
        inventory: {
          totalSkus: inventoryStats._count.sku_id,
          totalCartons: inventoryStats._sum.current_cartons || 0,
          totalPallets: inventoryStats._sum.current_pallets || 0,
          totalUnits: inventoryStats._sum.current_units || 0
        },
        transactions: {
          last30Days: transactionStats.reduce((acc, stat) => ({
            ...acc,
            [stat.transaction_type.toLowerCase()]: stat._count
          }), {})
        },
        invoices: {
          total: invoiceStats._count,
          total_amount: invoiceStats._sum.total_amount || 0
        },
        users: userCount
      }
    } catch (error) {
      this.handleError(error, 'getWarehouseStats')
    }
  }
}