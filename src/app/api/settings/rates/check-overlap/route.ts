import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rateId, warehouseId, costCategory, costName, effectiveDate, endDate } = body

    // Build the query to find overlapping rates
    const whereClause: any = {
      warehouseId,
      costName,
      // Exclude the current rate if editing
      ...(rateId && { NOT: { id: rateId } })
    }

    // Find potentially overlapping rates
    const existingRates = await prisma.costRate.findMany({
      where: whereClause,
      orderBy: { effectiveDate: 'asc' }
    })

    // Check for overlaps
    const effectiveDateObj = new Date(effectiveDate)
    const endDateObj = endDate ? new Date(endDate) : null

    for (const existingRate of existingRates) {
      const existingEffectiveDate = new Date(existingRate.effectiveDate)
      const existingEndDate = existingRate.endDate ? new Date(existingRate.endDate) : null

      // Check if periods overlap
      const overlap = checkPeriodOverlap(
        effectiveDateObj,
        endDateObj,
        existingEffectiveDate,
        existingEndDate
      )

      if (overlap) {
        // Special handling for Storage category
        if (costCategory === 'Storage') {
          return NextResponse.json({
            hasOverlap: true,
            message: `Only one storage rate is allowed per warehouse. An active storage rate already exists from ${existingEffectiveDate.toLocaleDateString()}${
              existingEndDate ? ` to ${existingEndDate.toLocaleDateString()}` : ' (no end date)'
            }`
          })
        }

        return NextResponse.json({
          hasOverlap: true,
          message: `This rate overlaps with an existing "${existingRate.costName}" rate from ${existingEffectiveDate.toLocaleDateString()}${
            existingEndDate ? ` to ${existingEndDate.toLocaleDateString()}` : ' (no end date)'
          }`
        })
      }
    }

    // Special check for Storage category - ensure only one active rate
    if (costCategory === 'Storage') {
      const activeStorageRates = await prisma.costRate.findMany({
        where: {
          warehouseId,
          costCategory: 'Storage',
          ...(rateId && { NOT: { id: rateId } }),
          OR: [
            // No end date (indefinite)
            { endDate: null },
            // End date is in the future
            { endDate: { gte: new Date() } }
          ]
        }
      })

      if (activeStorageRates.length > 0 && !endDateObj) {
        return NextResponse.json({
          hasOverlap: true,
          message: 'Only one active storage rate is allowed per warehouse. Please set an end date for the existing rate first.'
        })
      }
    }

    return NextResponse.json({ hasOverlap: false })
  } catch (error) {
    // console.error('Error checking rate overlap:', error)
    return NextResponse.json(
      { error: 'Failed to check overlap' },
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