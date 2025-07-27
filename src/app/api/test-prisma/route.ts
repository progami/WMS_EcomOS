import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const count = await prisma.inventory_transactions.count()
    const first = await prisma.inventory_transactions.findFirst({
      select: {
        id: true,
        transaction_id: true,
        warehouse_id: true
      }
    })
    
    // Test raw query
    const rawTest = await prisma.$queryRaw`SELECT supplier FROM inventory_transactions LIMIT 1`
    
    return NextResponse.json({
      count,
      first,
      rawTest
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}