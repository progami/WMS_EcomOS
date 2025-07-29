import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = await prisma.costRate.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })

    if (!rate) {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
    }

    const formattedRate = {
      id: rate.id,
      warehouseId: rate.warehouseId,
      warehouse: rate.warehouse,
      costCategory: rate.costCategory,
      costName: rate.costName,
      costValue: parseFloat(rate.costValue.toString()),
      unitOfMeasure: rate.unitOfMeasure,
      effectiveDate: rate.effectiveDate.toISOString(),
      endDate: rate.endDate?.toISOString() || null
    }

    return NextResponse.json(formattedRate)
  } catch (error) {
    // console.error('Error fetching rate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rate' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { costName, costValue, unitOfMeasure, endDate } = body

    // Validate required fields
    if (!costName || costValue === undefined || !unitOfMeasure) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get existing rate to check category
    const existingRate = await prisma.costRate.findUnique({
      where: { id }
    })

    if (!existingRate) {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
    }

    // Special validation for Storage category
    if (existingRate.costCategory === 'Storage' && unitOfMeasure !== 'pallet/week') {
      return NextResponse.json(
        { error: 'Storage rates must use "pallet/week" as the unit of measure' },
        { status: 400 }
      )
    }

    const updatedRate = await prisma.costRate.update({
      where: { id },
      data: {
        costName,
        unitOfMeasure,
        costValue,
        endDate: endDate ? new Date(endDate) : null,
        updatedAt: new Date()
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })

    const formattedRate = {
      id: updatedRate.id,
      warehouseId: updatedRate.warehouseId,
      warehouse: updatedRate.warehouse,
      costCategory: updatedRate.costCategory,
      costName: updatedRate.costName,
      costValue: parseFloat(updatedRate.costValue.toString()),
      unitOfMeasure: updatedRate.unitOfMeasure,
      effectiveDate: updatedRate.effectiveDate.toISOString(),
      endDate: updatedRate.endDate?.toISOString() || null
    }

    return NextResponse.json(formattedRate)
  } catch (error) {
    // console.error('Error updating rate:', error)
    return NextResponse.json(
      { error: 'Failed to update rate' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete rates
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.costRate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // console.error('Error deleting rate:', error)
    return NextResponse.json(
      { error: 'Failed to delete rate' },
      { status: 500 }
    )
  }
}