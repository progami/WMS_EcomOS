import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete demo invoices
    const deletedInvoices = await prisma.invoice.deleteMany({
      where: {
        warehouse: {
          name: {
            in: ['Manchester Distribution Center', 'London Central Warehouse']
          }
        }
      }
    })

    // Delete demo transactions
    const deletedTransactions = await prisma.inventoryTransaction.deleteMany({
      where: {
        createdBy: {
          isDemo: true
        }
      }
    })

    // Delete demo users
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        isDemo: true
      }
    })

    // Delete demo warehouses
    const deletedWarehouses = await prisma.warehouse.deleteMany({
      where: {
        code: {
          in: ['LON-01', 'MAN-01']
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Demo data cleaned up successfully',
      deleted: {
        invoices: deletedInvoices.count,
        transactions: deletedTransactions.count,
        users: deletedUsers.count,
        warehouses: deletedWarehouses.count
      }
    })
  } catch (error) {
    console.error('Error cleaning up demo data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to clean up demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}