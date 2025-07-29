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

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true }
        },
        sku: {
          select: { id: true, skuCode: true, description: true, unitsPerCarton: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        }
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json(transaction)
  } catch (error) {
    // console.error('Failed to fetch transaction:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch transaction' 
    }, { status: 500 })
  }
}