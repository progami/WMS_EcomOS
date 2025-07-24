import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/reconciliation/[id]/details - Get reconciliation transaction details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get reconciliation with details
    const reconciliation = await prisma.invoiceReconciliation.findUnique({
      where: { id: params.id },
      include: {
        reconciliationDetails: {
          include: {
            calculatedCost: {
              include: {
                sku: {
                  select: {
                    skuCode: true,
                    description: true
                  }
                },
                costRate: {
                  select: {
                    costName: true,
                    costCategory: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!reconciliation) {
      return NextResponse.json(
        { error: 'Reconciliation not found' },
        { status: 404 }
      )
    }

    // Format the details for the UI
    const formattedDetails = reconciliation.reconciliationDetails.map(detail => ({
      id: detail.id,
      calculatedCost: {
        id: detail.calculatedCost.id,
        transactionReferenceId: detail.calculatedCost.transactionReferenceId,
        transactionType: detail.calculatedCost.transactionType,
        transactionDate: detail.calculatedCost.transactionDate,
        quantityCharged: Number(detail.calculatedCost.quantityCharged),
        calculatedCost: Number(detail.calculatedCost.calculatedCost),
        sku: detail.calculatedCost.sku
      }
    }))

    return NextResponse.json({
      details: formattedDetails
    })
  } catch (error) {
    // console.error('Error fetching reconciliation details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation details' },
      { status: 500 }
    )
  }
}