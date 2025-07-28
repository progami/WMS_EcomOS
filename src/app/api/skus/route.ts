import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sanitizeForDisplay, sanitizeSearchQuery, escapeRegex } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

// Validation schemas with sanitization
const createSkuSchema = z.object({
  skuCode: z.string().min(1).max(50).transform(val => sanitizeForDisplay(val)),
  asin: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  description: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  packSize: z.number().int().positive(),
  material: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  unitDimensionsCm: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  unitWeightKg: z.number().positive().optional(),
  unitsPerCarton: z.number().int().positive(),
  cartonDimensionsCm: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  cartonWeightKg: z.number().positive().optional(),
  packagingType: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
  isActive: z.boolean().default(true)
})

const updateSkuSchema = createSkuSchema.partial().extend({
  skuCode: z.string().min(1).max(50).optional()
})

// GET /api/skus - List SKUs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') ? sanitizeSearchQuery(searchParams.get('search')!) : null
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}
    
    if (!includeInactive) {
      where.isActive = true
    }

    if (search) {
      const escapedSearch = escapeRegex(search)
      where.OR = [
        { skuCode: { contains: escapedSearch, mode: 'insensitive' } },
        { description: { contains: escapedSearch, mode: 'insensitive' } },
        { asin: { contains: escapedSearch, mode: 'insensitive' } }
      ]
    }

    const skus = await prisma.sku.findMany({
      where,
      orderBy: { skuCode: 'asc' },
      include: {
        _count: {
          select: {
            inventoryTransactions: true,
            warehouseConfigs: true
          }
        }
      }
    })

    return NextResponse.json(skus)
  } catch (error) {
    // console.error('Error fetching SKUs:', error)
    return NextResponse.json({ error: 'Failed to fetch SKUs', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// POST /api/skus - Create new SKU
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSkuSchema.parse(body)

    // Check if SKU code already exists
    const existingSku = await prisma.sku.findUnique({
      where: { skuCode: validatedData.skuCode }
    })

    if (existingSku) {
      return NextResponse.json(
        { error: 'SKU code already exists' },
        { status: 400 }
      )
    }

    const sku = await prisma.sku.create({
      data: {
        skuCode: validatedData.skuCode,
        asin: validatedData.asin || null,
        description: validatedData.description,
        packSize: validatedData.packSize,
        material: validatedData.material || null,
        unitDimensionsCm: validatedData.unitDimensionsCm || null,
        unitWeightKg: validatedData.unitWeightKg || null,
        unitsPerCarton: validatedData.unitsPerCarton,
        cartonDimensionsCm: validatedData.cartonDimensionsCm || null,
        cartonWeightKg: validatedData.cartonWeightKg || null,
        packagingType: validatedData.packagingType || null,
        isActive: validatedData.isActive
      }
    })

    return NextResponse.json(sku, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error creating SKU:', error)
    return NextResponse.json({ error: 'Failed to create SKU' }, { status: 500 })
  }
}

// PATCH /api/skus - Update SKU
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('id')
    
    if (!skuId) {
      return NextResponse.json(
        { error: 'SKU ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateSkuSchema.parse(body)

    // If updating code, check if it's already in use
    if (validatedData.skuCode) {
      const existingSku = await prisma.sku.findFirst({
        where: {
          skuCode: validatedData.skuCode,
          id: { not: skuId }
        }
      })

      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU code already in use' },
          { status: 400 }
        )
      }
    }

    const updatedSku = await prisma.sku.update({
      where: { id: skuId },
      data: validatedData
    })

    return NextResponse.json(updatedSku)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error updating SKU:', error)
    return NextResponse.json({ error: 'Failed to update SKU' }, { status: 500 })
  }
}

// DELETE /api/skus - Delete SKU
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('id')
    
    if (!skuId) {
      return NextResponse.json(
        { error: 'SKU ID is required' },
        { status: 400 }
      )
    }

    // Check if SKU has related data
    const relatedData = await prisma.sku.findUnique({
      where: { id: skuId },
      include: {
        _count: {
          select: {
            inventoryTransactions: true,
            calculatedCosts: true
          }
        }
      }
    })

    if (!relatedData) {
      return NextResponse.json(
        { error: 'SKU not found' },
        { status: 404 }
      )
    }

    // Check if SKU has any related data
    const hasRelatedData = Object.values(relatedData._count).some(count => (count as number) > 0)
    
    if (hasRelatedData) {
      // Soft delete - just mark as inactive
      const updatedSku = await prisma.sku.update({
        where: { id: skuId },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'SKU deactivated (has related data)',
        sku: updatedSku
      })
    } else {
      // Hard delete - no related data
      await prisma.sku.delete({
        where: { id: skuId }
      })

      return NextResponse.json({
        message: 'SKU deleted successfully'
      })
    }
  } catch (error) {
    // console.error('Error deleting SKU:', error)
    return NextResponse.json({ error: 'Failed to delete SKU' }, { status: 500 })
  }
}