import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
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
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const config = await prisma.warehouseSkuConfig.findUnique({
      where: { id },
      include: {
        warehouse: true,
        sku: true
      }
    })

    if (!config) {
      return NextResponse.json(
        { message: 'Configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    // console.error('Error fetching warehouse config:', error)
    return NextResponse.json(
      { message: 'Failed to fetch configuration' },
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
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await request.json()
    
    // Get existing config to preserve warehouse and SKU
    const existing = await prisma.warehouseSkuConfig.findUnique({
      where: { id: id }
    })

    if (!existing) {
      return NextResponse.json(
        { message: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Check for overlapping configurations when changing end date
    if (data.endDate !== undefined) {
      const existingConfigs = await prisma.warehouseSkuConfig.findMany({
        where: {
          warehouseId: existing.warehouseId,
          skuId: existing.skuId,
          NOT: { id }
        },
        orderBy: { effectiveDate: 'asc' }
      })

      const effectiveDateObj = new Date(existing.effectiveDate)
      const endDateObj = data.endDate ? new Date(data.endDate) : null

      for (const config of existingConfigs) {
        const configEffectiveDate = new Date(config.effectiveDate)
        const configEndDate = config.endDate ? new Date(config.endDate) : null

        const overlap = checkPeriodOverlap(
          effectiveDateObj,
          endDateObj,
          configEffectiveDate,
          configEndDate
        )

        if (overlap) {
          return NextResponse.json(
            { 
              message: `This change would create an overlap with configuration from ${configEffectiveDate.toLocaleDateString()}${
                configEndDate ? ` to ${configEndDate.toLocaleDateString()}` : ' (no end date)'
              }`
            },
            { status: 400 }
          )
        }
      }
    }

    // Update configuration
    const config = await prisma.warehouseSkuConfig.update({
      where: { id },
      data: {
        storageCartonsPerPallet: data.storageCartonsPerPallet,
        shippingCartonsPerPallet: data.shippingCartonsPerPallet,
        maxStackingHeightCm: data.maxStackingHeightCm,
        endDate: data.endDate ? new Date(data.endDate) : null
      },
      include: {
        warehouse: true,
        sku: true
      }
    })

    return NextResponse.json(config)
  } catch (error) {
    // console.error('Error updating warehouse config:', error)
    return NextResponse.json(
      { message: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}

function checkPeriodOverlap(
  start1: Date,
  end1: Date | null,
  start2: Date,
  end2: Date | null
): boolean {
  // If either period is open-ended (no end date)
  if (!end1 && !end2) {
    // Both are open-ended, they will overlap
    return true
  }
  
  if (!end1) {
    // First period is open-ended
    return start1 <= (end2 as Date)
  }
  
  if (!end2) {
    // Second period is open-ended
    return end1 >= start2
  }
  
  // Both have end dates
  return start1 <= end2 && end1 >= start2
}