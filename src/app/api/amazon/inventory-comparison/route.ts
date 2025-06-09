import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // First, get the Amazon warehouse to ensure we have the correct ID
    const amazonWarehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: 'AMZN-UK' },
          { code: 'AMZN' },
          { name: 'Amazon FBA UK' },
          { name: { contains: 'Amazon' } }
        ]
      }
    })

    if (!amazonWarehouse) {
      console.warn('Amazon FBA UK warehouse not found')
      // Log all warehouses to help debug
      const allWarehouses = await prisma.warehouse.findMany()
      console.log('Available warehouses:', allWarehouses.map(w => ({ id: w.id, code: w.code, name: w.name })))
    } else {
      console.log('Found Amazon warehouse:', { id: amazonWarehouse.id, code: amazonWarehouse.code, name: amazonWarehouse.name })
    }

    // Get all SKUs from the database
    const skus = await prisma.sku.findMany({
      orderBy: {
        skuCode: 'asc'
      }
    })

    // Get inventory balances for all warehouses (excluding Amazon FBA)
    const inventoryBalances = await prisma.inventoryBalance.findMany({
      where: {
        warehouse: {
          NOT: {
            code: { in: ['AMZN-UK', 'AMZN'] }
          }
        }
      },
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    console.log(`Found ${inventoryBalances.length} inventory balance records (excluding Amazon)`)
    
    // Get Amazon FBA inventory separately
    let amazonInventory: any[] = []
    if (amazonWarehouse) {
      amazonInventory = await prisma.inventoryBalance.findMany({
        where: {
          warehouseId: amazonWarehouse.id
        },
        include: {
          sku: true
        }
      })
      console.log(`Found ${amazonInventory.length} Amazon FBA inventory records`)
    }

    // Calculate inventory for each SKU
    const inventoryData = skus.map(sku => {
      // Get warehouse balances (non-Amazon)
      const skuBalances = inventoryBalances.filter(balance => balance.skuId === sku.id)
      
      // Calculate total warehouse quantity (excluding Amazon)
      const warehouseCartons = skuBalances.reduce((sum, balance) => sum + balance.currentCartons, 0)
      
      // Get Amazon FBA quantity from SKU field
      const amazonUnits = sku.fbaStock || 0

      // Convert cartons to units
      const unitsPerCarton = sku.unitsPerCarton || 1
      const warehouseUnits = Math.max(0, warehouseCartons * unitsPerCarton)
      
      return {
        sku: sku.skuCode,
        description: sku.description || '',
        warehouseQty: warehouseUnits, // Total from all non-Amazon warehouses
        amazonQty: amazonUnits, // Amazon FBA units from SKU field
        total: warehouseUnits + amazonUnits, // Combined total
        unitsPerCarton: unitsPerCarton,
        lastUpdated: sku.fbaStockLastUpdated
      }
    })

    // Include all SKUs, even those with 0 stock
    // Sort by SKU code for consistent display
    const sortedInventory = inventoryData.sort((a, b) => a.sku.localeCompare(b.sku))
    
    console.log(`Total SKUs: ${skus.length}, Returning all SKUs including those with 0 stock`)

    return NextResponse.json(sortedInventory)
  } catch (error) {
    console.error('Error in inventory comparison:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inventory comparison',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}