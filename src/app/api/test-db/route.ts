import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get database connection info
    const dbUrl = process.env.DATABASE_URL || 'not set'
    
    // Test database connection and check columns
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_transactions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `
    
    // Check if supplier column exists
    const supplierColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_transactions' 
      AND column_name = 'supplier'
      AND table_schema = 'public'
    `
    
    return NextResponse.json({
      success: true,
      databaseUrl: dbUrl.replace(/:[^:@]+@/, ':****@'), // Hide password
      columns,
      supplierColumnExists: supplierColumn.length > 0,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: (process.env.DATABASE_URL || 'not set').replace(/:[^:@]+@/, ':****@')
    }, { status: 500 })
  }
}