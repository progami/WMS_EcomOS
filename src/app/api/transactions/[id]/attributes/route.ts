import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { parseLocalDate } from '@/lib/utils/date-helpers'

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
      supplier,
      notes,
      attachments,
      referenceId,
      cartonsIn,
      cartonsOut,
      storagePalletsIn,
      shippingPalletsOut,
      unitsPerCarton,
      storageCartonsPerPallet,
      shippingCartonsPerPallet
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
      const parsedDate = parseLocalDate(pickupDate)
      sanitizedData.pickupDate = parsedDate
    }
    if (supplier !== undefined) {
      sanitizedData.supplier = supplier ? sanitizeForDisplay(supplier) : null
    }
    if (referenceId !== undefined) {
      sanitizedData.referenceId = referenceId ? sanitizeForDisplay(referenceId) : null
    }
    
    // Handle quantity fields
    if (cartonsIn !== undefined) {
      sanitizedData.cartonsIn = cartonsIn
    }
    if (cartonsOut !== undefined) {
      sanitizedData.cartonsOut = cartonsOut
    }
    if (storagePalletsIn !== undefined) {
      sanitizedData.storagePalletsIn = storagePalletsIn
    }
    if (shippingPalletsOut !== undefined) {
      sanitizedData.shippingPalletsOut = shippingPalletsOut
    }
    if (unitsPerCarton !== undefined) {
      sanitizedData.unitsPerCarton = unitsPerCarton
    }
    if (storageCartonsPerPallet !== undefined) {
      sanitizedData.storageCartonsPerPallet = storageCartonsPerPallet
    }
    if (shippingCartonsPerPallet !== undefined) {
      sanitizedData.shippingCartonsPerPallet = shippingCartonsPerPallet
    }
    
    // Handle attachments with notes
    if (attachments !== undefined || notes !== undefined) {
      // Get existing transaction to preserve other attachments
      const existingTx = await prisma.inventoryTransaction.findUnique({
        where: { id },
        select: { attachments: true }
      })
      
      let updatedAttachments: any[] = []
      
      // Handle existing attachments
      if (existingTx?.attachments && Array.isArray(existingTx.attachments)) {
        // Remove existing notes attachment
        updatedAttachments = (existingTx.attachments as any[]).filter((att: any) => att.type !== 'notes')
      }
      
      // Add new notes if provided
      if (notes) {
        updatedAttachments.push({ type: 'notes', content: sanitizeForDisplay(notes) })
      }
      
      // Merge with new attachments if provided
      if (attachments && Array.isArray(attachments)) {
        updatedAttachments = [...updatedAttachments, ...attachments]
      }
      
      sanitizedData.attachments = updatedAttachments.length > 0 ? updatedAttachments : null
    }

    // Get current transaction for audit log
    const currentTransaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: {
        shipName: true,
        trackingNumber: true,
        modeOfTransportation: true,
        pickupDate: true,
        supplier: true,
        attachments: true,
        referenceId: true,
        cartonsIn: true,
        cartonsOut: true,
        storagePalletsIn: true,
        shippingPalletsOut: true,
        unitsPerCarton: true,
        storageCartonsPerPallet: true,
        shippingCartonsPerPallet: true
      }
    })

    // Update transaction
    const updatedTransaction = await prisma.inventoryTransaction.update({
      where: { id },
      data: sanitizedData,
      select: {
        id: true,
        shipName: true,
        trackingNumber: true,
        modeOfTransportation: true,
        pickupDate: true,
        supplier: true,
        cartonsIn: true,
        cartonsOut: true,
        storagePalletsIn: true,
        shippingPalletsOut: true,
        unitsPerCarton: true,
        storageCartonsPerPallet: true,
        shippingCartonsPerPallet: true
      }
    })

    // Create audit log
    const changes: any = {
      fields: [],
      before: {},
      after: {}
    }

    // Track what changed
    if (shipName !== undefined && currentTransaction?.shipName !== sanitizedData.shipName) {
      changes.fields.push('shipName')
      changes.before.shipName = currentTransaction?.shipName
      changes.after.shipName = sanitizedData.shipName
    }
    if (trackingNumber !== undefined && currentTransaction?.trackingNumber !== sanitizedData.trackingNumber) {
      changes.fields.push('trackingNumber')
      changes.before.trackingNumber = currentTransaction?.trackingNumber
      changes.after.trackingNumber = sanitizedData.trackingNumber
    }
    if (supplier !== undefined && currentTransaction?.supplier !== sanitizedData.supplier) {
      changes.fields.push('supplier')
      changes.before.supplier = currentTransaction?.supplier
      changes.after.supplier = sanitizedData.supplier
    }
    if (referenceId !== undefined && currentTransaction?.referenceId !== sanitizedData.referenceId) {
      changes.fields.push('referenceId')
      changes.before.referenceId = currentTransaction?.referenceId
      changes.after.referenceId = sanitizedData.referenceId
    }

    if (changes.fields.length > 0) {
      await prisma.auditLog.create({
        data: {
          tableName: 'inventory_transactions',
          recordId: id,
          action: 'UPDATE',
          changes,
          userId: session.user.id
        }
      })
    }

    return NextResponse.json(updatedTransaction)
  } catch (error) {
    console.error('Failed to update transaction attributes:', error)
    return NextResponse.json({ 
      error: 'Failed to update transaction attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}