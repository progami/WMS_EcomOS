import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

// GET /api/skus/[id] - Get a single SKU by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sku = await prisma.sku.findUnique({
      where: { id: params.id },
      include: {
        warehouseConfigs: true,
        _count: {
          select: {
            warehouseConfigs: true
          }
        }
      }
    })

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }

    return NextResponse.json(sku)
  } catch (error) {
    // console.error('Error fetching SKU:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SKU' },
      { status: 500 }
    )
  }
}

// PUT /api/skus/[id] - Update a SKU
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.skuCode || !body.description) {
      return NextResponse.json(
        { error: 'SKU code and description are required' },
        { status: 400 }
      )
    }

    // Check if SKU code is being changed and if new code already exists
    const existingSku = await prisma.sku.findFirst({
      where: {
        skuCode: body.skuCode,
        NOT: { id: params.id }
      }
    })

    if (existingSku) {
      return NextResponse.json(
        { error: 'SKU code already exists' },
        { status: 400 }
      )
    }

    // Update the SKU
    const updatedSku = await prisma.sku.update({
      where: { id: params.id },
      data: {
        skuCode: body.skuCode,
        asin: body.asin,
        description: body.description,
        packSize: body.packSize,
        material: body.material,
        unitDimensionsCm: body.unitDimensionsCm,
        unitWeightKg: body.unitWeightKg,
        unitsPerCarton: body.unitsPerCarton,
        cartonDimensionsCm: body.cartonDimensionsCm,
        cartonWeightKg: body.cartonWeightKg,
        packagingType: body.packagingType,
        isActive: body.isActive
      }
    })

    return NextResponse.json(updatedSku)
  } catch (error) {
    // console.error('Error updating SKU:', error)
    return NextResponse.json(
      { error: 'Failed to update SKU' },
      { status: 500 }
    )
  }
}

// DELETE /api/skus/[id] - Delete or deactivate a SKU
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if SKU has related data
    const sku = await prisma.sku.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            warehouseConfigs: true
          }
        }
      }
    })

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }

    // If SKU has related data, deactivate instead of delete
    if (sku._count.warehouseConfigs > 0) {
      const deactivatedSku = await prisma.sku.update({
        where: { id: params.id },
        data: { isActive: false }
      })
      
      return NextResponse.json({
        message: 'SKU deactivated due to existing relationships',
        sku: deactivatedSku
      })
    }

    // Otherwise, delete the SKU
    await prisma.sku.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'SKU deleted successfully'
    })
  } catch (error) {
    // console.error('Error deleting SKU:', error)
    return NextResponse.json(
      { error: 'Failed to delete SKU' },
      { status: 500 }
    )
  }
}