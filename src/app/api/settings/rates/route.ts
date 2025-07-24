import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // All authenticated users can view rates

    const rates = await prisma.costRate.findMany({
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: [
        { warehouse: { name: 'asc' } },
        { costCategory: 'asc' },
        { effectiveDate: 'desc' }
      ]
    })

    // Return the data in the correct format
    const formattedRates = rates.map(rate => ({
      id: rate.id,
      warehouseId: rate.warehouseId,
      warehouse: rate.warehouse,
      costCategory: rate.costCategory,
      costName: rate.costName,
      costValue: parseFloat(rate.costValue.toString()),
      unitOfMeasure: rate.unitOfMeasure,
      effectiveDate: rate.effectiveDate.toISOString(),
      endDate: rate.endDate?.toISOString() || null
    }))

    return NextResponse.json(formattedRates)
  } catch (error) {
    // console.error('Error fetching rates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { warehouseId, costCategory, costName, costValue, unitOfMeasure, effectiveDate, endDate } = body

    // Validate required fields
    if (!warehouseId || !costCategory || !costName || costValue === undefined || !unitOfMeasure || !effectiveDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Special validation for Storage category
    if (costCategory === 'Storage') {
      // Check for existing active storage rate
      const existingStorageRate = await prisma.costRate.findFirst({
        where: {
          warehouseId,
          costCategory: 'Storage',
          effectiveDate: { lte: new Date(effectiveDate) },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date(effectiveDate) } }
          ]
        }
      })

      if (existingStorageRate) {
        return NextResponse.json(
          { error: 'An active storage rate already exists for this warehouse. Please end the existing rate first.' },
          { status: 400 }
        )
      }

      // Ensure correct unit for storage
      if (unitOfMeasure !== 'pallet/week') {
        return NextResponse.json(
          { error: 'Storage rates must use "pallet/week" as the unit of measure' },
          { status: 400 }
        )
      }
    }

    const newRate = await prisma.costRate.create({
      data: {
        warehouseId,
        costCategory,
        costName,
        costValue,
        unitOfMeasure,
        effectiveDate: new Date(effectiveDate),
        endDate: endDate ? new Date(endDate) : null,
        createdById: session.user.id
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
      id: newRate.id,
      warehouseId: newRate.warehouseId,
      warehouse: newRate.warehouse,
      costCategory: newRate.costCategory,
      costName: newRate.costName,
      costValue: parseFloat(newRate.costValue.toString()),
      unitOfMeasure: newRate.unitOfMeasure,
      effectiveDate: newRate.effectiveDate.toISOString(),
      endDate: newRate.endDate?.toISOString() || null
    }

    return NextResponse.json(formattedRate)
  } catch (error) {
    // console.error('Error creating rate:', error)
    return NextResponse.json(
      { error: 'Failed to create rate' },
      { status: 500 }
    )
  }
}