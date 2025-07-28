import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      orderNumber, 
      trackingNumber, 
      shipDate, 
      carrier, 
      warehouse,
      items,
      totalCartons,
      totalPallets,
      notes 
    } = body

    // Generate email content
    const emailSubject = `FBA Shipment - ${orderNumber} - ${trackingNumber}`
    
    const emailBody = generateEmailBody({
      orderNumber,
      trackingNumber,
      shipDate,
      carrier,
      warehouse,
      items,
      totalCartons,
      totalPallets,
      notes,
      generatedBy: session.user.name || session.user.email
    })

    // In a real implementation, you would send this via an email service
    // For now, we'll return the email content for manual sending
    
    if (!warehouse.contactEmail) {
      return NextResponse.json(
        { error: 'Warehouse contact email not configured' }, 
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      email: {
        subject: emailSubject,
        body: emailBody,
        to: warehouse.contactEmail,
        references: {
          orderNumber,
          trackingNumber,
          shipmentId: `${orderNumber}-${new Date().getTime()}`
        }
      }
    })
  } catch (error) {
    // console.error('Email generation error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateEmailBody(data: any): string {
  const {
    orderNumber,
    trackingNumber,
    shipDate,
    carrier,
    warehouse,
    items,
    totalCartons,
    totalPallets,
    notes,
    generatedBy
  } = data

  const itemsTable = items.map((item: any) => 
    `${item.skuCode} - ${item.description}
    Batch: ${item.batchLot}
    Quantity: ${item.cartons} cartons (${item.pallets} pallets)
    Units: ${item.units}`
  ).join('\n\n')

  return `Dear ${warehouse.name} Team,

Please prepare the following shipment for Amazon FBA:

SHIPMENT DETAILS
================
Order Number: ${orderNumber}
FBA Tracking Number: ${trackingNumber}
Ship Date: ${new Date(shipDate).toLocaleDateString()}
Carrier: ${carrier}
Total: ${totalCartons} cartons on ${totalPallets} pallets

ITEMS TO SHIP
=============
${itemsTable}

SHIPPING INSTRUCTIONS
====================
1. Please prepare all items for pickup by ${carrier}
2. Use the FBA Tracking ID ${trackingNumber} on all shipment labels
3. Ensure all cartons are properly labeled with Amazon FBA labels
4. Stack pallets according to the carrier's requirements

${notes ? `ADDITIONAL NOTES
================
${notes}` : ''}

IMPORTANT REMINDERS
==================
- Please confirm receipt of this shipment request
- Notify us immediately if there are any issues with inventory availability
- Send proof of pickup once the carrier collects the shipment

This shipment was generated from the Warehouse Management System by ${generatedBy}.

Thank you for your cooperation.

Best regards,
Operations Team`
}

// Generate preview for UI
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return email template structure
    return NextResponse.json({
      template: {
        subject: 'FBA Shipment - [Order Number] - [FBA Tracking ID]',
        fields: [
          'orderNumber',
          'trackingNumber', 
          'shipDate',
          'carrier',
          'warehouse',
          'items',
          'totalCartons',
          'totalPallets',
          'notes'
        ]
      }
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get email template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}