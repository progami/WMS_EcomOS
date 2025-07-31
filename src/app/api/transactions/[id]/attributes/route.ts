import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      shipName, 
      trackingNumber, 
      modeOfTransportation,
      pickupDate,
      supplier
    } = body

    // Sanitize inputs
    const sanitizedData: any = {}
    
    if (shipName !== undefined) {
      sanitizedData.shipName = shipName ? sanitizeForDisplay(shipName) : null
    }
    if (trackingNumber !== undefined) {
      sanitizedData.trackingNumber = trackingNumber ? sanitizeForDisplay(trackingNumber) : null
    }
    if (modeOfTransportation !== undefined) {
      sanitizedData.modeOfTransportation = modeOfTransportation ? sanitizeForDisplay(modeOfTransportation) : null
    }
    if (pickupDate !== undefined) {
      sanitizedData.pickupDate = pickupDate ? new Date(pickupDate) : null
    }
    if (supplier !== undefined) {
      sanitizedData.supplier = supplier ? sanitizeForDisplay(supplier) : null
    }

    // Update transaction
    const updatedTransaction = await prisma.inventoryTransaction.update({
      where: { id },
      data: {
        ...sanitizedData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        shipName: true,
        trackingNumber: true,
        modeOfTransportation: true,
        pickupDate: true,
        supplier: true,
        updatedAt: true
      }
    })

    return NextResponse.json(updatedTransaction)
  } catch (error) {
    console.error('Failed to update transaction attributes:', error)
    return NextResponse.json({ 
      error: 'Failed to update transaction attributes' 
    }, { status: 500 })
  }
}