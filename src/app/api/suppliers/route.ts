import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // For now, return empty array since supplier column may not have data yet
    const suppliers: string[] = []
    
    try {
      // Try to get distinct suppliers from RECEIVE transactions
      const transactions = await prisma.inventoryTransaction.findMany({
        where: {
          transactionType: 'RECEIVE',
          supplier: {
            not: null
          }
        },
        select: {
          supplier: true
        },
        distinct: ['supplier']
      })

      // Extract and sort supplier names
      const supplierList = transactions
        .map(tx => tx.supplier)
        .filter(Boolean) as string[]
      
      suppliers.push(...supplierList)
    } catch (error) {
      console.error('Error querying suppliers:', error)
    }

    return NextResponse.json({
      suppliers: suppliers.sort(),
      count: suppliers.length
    })
  } catch (error) {
    console.error('Failed to fetch suppliers:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch suppliers' 
    }, { status: 500 })
  }
}