import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { generateExportConfig, applyExportConfig } from '@/lib/dynamic-export'
import { inventoryBalanceConfig } from '@/lib/export-configurations'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const fullExport = searchParams.get('full') === 'true'
    const warehouse = searchParams.get('warehouse')
    const minCartons = searchParams.get('minCartons')
    const maxCartons = searchParams.get('maxCartons')
    const showLowStock = searchParams.get('showLowStock') === 'true'
    const showZeroStock = searchParams.get('showZeroStock') === 'true'

    // Build where clause
    let where: any = {}
    
    // If not full export, apply filters
    if (!fullExport) {
      // Get warehouse filter based on user role or filter
      if (session.user.role === 'staff' && session.user.warehouseId) {
        where.warehouseId = session.user.warehouseId
      } else if (warehouse) {
        where.warehouseId = warehouse
      }
      
      // Apply other filters
      const cartonFilters = []
      if (minCartons) {
        cartonFilters.push({ currentCartons: { gte: parseInt(minCartons) } })
      }
      if (maxCartons) {
        cartonFilters.push({ currentCartons: { lte: parseInt(maxCartons) } })
      }
      if (showLowStock) {
        cartonFilters.push({ currentCartons: { lt: 10, gt: 0 } })
      }
      if (showZeroStock) {
        cartonFilters.push({ currentCartons: 0 })
      }
      
      if (cartonFilters.length > 0) {
        where = { ...where, OR: cartonFilters }
      }
    } else {
      // For full export, only apply warehouse restriction for staff users
      if (session.user.role === 'staff' && session.user.warehouseId) {
        where.warehouseId = session.user.warehouseId
      }
    }

    // Fetch inventory data
    const inventoryBalances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
      },
      orderBy: [
        { warehouse: { name: 'asc' } },
        { sku: { skuCode: 'asc' } },
      ],
    })

    // Use dynamic export configuration
    const fieldConfigs = generateExportConfig('InventoryBalance', inventoryBalanceConfig)
    const exportData = applyExportConfig(inventoryBalances, fieldConfigs)

    // Create workbook
    const wb = XLSX.utils.book_new()
    let ws

    if (exportData.length > 0) {
      // Normal case - data exists
      ws = XLSX.utils.json_to_sheet(exportData)
      
      // Auto-size columns dynamically
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...exportData.slice(0, 100).map(row => String(row[key] || '').length)
        ) + 2
      }))
      ws['!cols'] = colWidths
    } else {
      // Empty data - create headers manually
      const headers = fieldConfigs.map(config => config.columnName || config.fieldName)
      const headerRow = headers.reduce((acc, header, index) => {
        const col = XLSX.utils.encode_col(index)
        acc[`${col}1`] = { t: 's', v: header }
        return acc
      }, {} as any)
      
      ws = {
        ...headerRow,
        '!ref': `A1:${XLSX.utils.encode_col(headers.length - 1)}1`,
        '!cols': headers.map(header => ({ wch: Math.max(header.length + 2, 15) }))
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventory_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    // console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}