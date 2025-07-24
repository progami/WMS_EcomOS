import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateInventoryBalances } from '@/lib/calculations/inventory-balance'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Only allow admin users to rebuild inventory
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { warehouseId } = body
    
    console.log('Starting inventory rebuild...', warehouseId ? `for warehouse ${warehouseId}` : 'for all warehouses')
    
    // Rebuild inventory balances from transaction history
    const updatedCount = await updateInventoryBalances(warehouseId)
    
    return NextResponse.json({
      success: true,
      message: `Successfully rebuilt inventory balances. Updated ${updatedCount} records.`,
      updatedCount
    })
  } catch (error) {
    console.error('Failed to rebuild inventory:', error)
    return NextResponse.json(
      { error: 'Failed to rebuild inventory balances' },
      { status: 500 }
    )
  }
}