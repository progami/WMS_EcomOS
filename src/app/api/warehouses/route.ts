import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sanitizeForDisplay, validateAlphanumeric } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

// Validation schemas with sanitization
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

// GET /api/warehouses - List warehouses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeAmazon = searchParams.get('includeAmazon') === 'true'

    const where: any = includeInactive ? {} : { isActive: true }
    
    // Exclude Amazon FBA UK warehouse unless explicitly requested
    if (!includeAmazon) {
      where.NOT = {
        OR: [
          { code: 'AMZN' },
          { code: 'AMZN-UK' }
        ]
      }
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            inventoryBalances: true,
            invoices: true
          }
        }
      }
    })

    return NextResponse.json(warehouses)
  } catch (error) {
    // console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

// POST /api/warehouses - Create warehouse
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createWarehouseSchema.parse(body)

    // Check if warehouse code already exists (case-insensitive)
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: { equals: validatedData.code, mode: 'insensitive' } },
          { name: { equals: validatedData.name, mode: 'insensitive' } }
        ]
      }
    })

    if (existingWarehouse) {
      if (existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
        return NextResponse.json(
          { error: 'Warehouse code already exists (case-insensitive match)' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'Warehouse name already exists (case-insensitive match)' },
          { status: 400 }
        )
      }
    }

    const warehouse = await prisma.warehouse.create({
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
            inventoryBalances: true,
            invoices: true
          }
        }
      }
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouses - Update warehouse
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('id')
    
    if (!warehouseId) {
      return NextResponse.json(
        { error: 'Warehouse ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updateWarehouseSchema.parse(body)

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
      
      const existingWarehouse = await prisma.warehouse.findFirst({
        where: { OR: whereConditions }
      })

      if (existingWarehouse) {
        if (validatedData.code && existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
          return NextResponse.json(
            { error: 'Warehouse code already in use (case-insensitive match)' },
            { status: 400 }
          )
        } else if (validatedData.name && existingWarehouse.name.toLowerCase() === validatedData.name.toLowerCase()) {
          return NextResponse.json(
            { error: 'Warehouse name already in use (case-insensitive match)' },
            { status: 400 }
          )
        }
      }
    }

    const updatedWarehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: validatedData,
      include: {
        _count: {
          select: {
            users: true,
            inventoryBalances: true,
            invoices: true
          }
        }
      }
    })

    return NextResponse.json(updatedWarehouse)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error updating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouses - Delete warehouse
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('id')
    
    if (!warehouseId) {
      return NextResponse.json(
        { error: 'Warehouse ID is required' },
        { status: 400 }
      )
    }

    // Check if warehouse has related data
    const relatedData = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        _count: {
          select: {
            users: true,
            inventoryBalances: true,
            inventoryTransactions: true,
            invoices: true,
            calculatedCosts: true
          }
        }
      }
    })

    if (!relatedData) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // Check if warehouse has any related data
    const hasRelatedData = Object.values(relatedData._count).some(count => (count as number) > 0)
    
    if (hasRelatedData) {
      // Soft delete - just mark as inactive
      const updatedWarehouse = await prisma.warehouse.update({
        where: { id: warehouseId },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'Warehouse deactivated (has related data)',
        warehouse: updatedWarehouse
      })
    } else {
      // Hard delete - no related data
      await prisma.warehouse.delete({
        where: { id: warehouseId }
      })

      return NextResponse.json({
        message: 'Warehouse deleted successfully'
      })
    }
  } catch (error) {
    // console.error('Error deleting warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse' },
      { status: 500 }
    )
  }
}