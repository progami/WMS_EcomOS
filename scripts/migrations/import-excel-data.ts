import * as XLSX from 'xlsx'
import { prisma } from '../../src/lib/prisma'
import * as path from 'path'
import * as fs from 'fs'
import type { Warehouse } from '@prisma/client'

// Helper function to convert Excel date to JS date
function excelDateToJSDate(excelDate: number): Date {
  return new Date((excelDate - 25569) * 86400 * 1000)
}

async function importSkuMaster(sheet: XLSX.WorkSheet) {
  console.log('\n📦 Importing SKU Master...')
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      if (!row.SKU) {
        skipped++
        continue
      }

      const result = await prisma.sku.upsert({
        where: { skuCode: row.SKU },
        update: {
          asin: row.ASIN || null,
          description: row.Description || '',
          packSize: parseInt(row.Pack_Size) || 1,
          material: row.Material || null,
          unitDimensionsCm: row.Unit_Dimensions_cm || null,
          unitWeightKg: parseFloat(row.Unit_Weight_KG) || null,
          unitsPerCarton: parseInt(row.Units_Per_Carton) || 1,
          cartonDimensionsCm: row.Carton_Dimensions_cm || null,
          cartonWeightKg: parseFloat(row.Carton_Weight_KG) || null,
          packagingType: row.Packaging_Type || null
        },
        create: {
          skuCode: row.SKU,
          asin: row.ASIN || null,
          description: row.Description || '',
          packSize: parseInt(row.Pack_Size) || 1,
          material: row.Material || null,
          unitDimensionsCm: row.Unit_Dimensions_cm || null,
          unitWeightKg: parseFloat(row.Unit_Weight_KG) || null,
          unitsPerCarton: parseInt(row.Units_Per_Carton) || 1,
          cartonDimensionsCm: row.Carton_Dimensions_cm || null,
          cartonWeightKg: parseFloat(row.Carton_Weight_KG) || null,
          packagingType: row.Packaging_Type || null
        }
      })
      console.log(`  ✅ Imported SKU: ${row.SKU} - ${row.Description}`)
      imported++
    } catch (error) {
      errors.push(`SKU ${row.SKU}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  console.log(`  📊 Summary: ${imported} imported, ${skipped} skipped, ${errors.length} errors`)
  if (errors.length > 0) {
    console.log('  ❌ Errors:', errors)
  }
  return { sheet: 'SKU Master', imported, skipped, errors }
}

async function importCostMaster(sheet: XLSX.WorkSheet) {
  console.log('\n💰 Importing Cost Master...')
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse mapping
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map<string, Warehouse>(warehouses.map(w => [w.name.toLowerCase(), w]))

  // Get admin user for createdById
  const adminUser = await prisma.user.findFirst({
    where: { role: 'admin' }
  })
  
  if (!adminUser) {
    throw new Error('No admin user found in database')
  }

  // Category mapping
  const categoryMap: { [key: string]: string } = {
    'storage': 'Storage',
    'container': 'Container',
    'pallet': 'Pallet',
    'carton': 'Carton',
    'unit': 'Unit',
    'shipment': 'Shipment',
    'accessorial': 'Accessorial'
  }

  // Group by warehouse for better logging
  const warehouseGroups = data.reduce((groups, row) => {
    const warehouse = row.warehouse?.toLowerCase()
    if (!warehouse) return groups
    if (!groups[warehouse]) groups[warehouse] = []
    groups[warehouse].push(row)
    return groups
  }, {} as Record<string, any[]>)

  for (const [warehouseName, rows] of Object.entries(warehouseGroups)) {
    console.log(`\n  🏢 Processing ${warehouseName.toUpperCase()} warehouse rates...`)
    
    for (const row of rows as any[]) {
      try {
        if (!row.warehouse || !row.cost_name || row.cost_value === undefined || row.cost_value === null) {
          skipped++
          continue
        }

        const warehouse = warehouseMap.get(row.warehouse.toLowerCase())
        if (!warehouse) {
          errors.push(`Warehouse ${row.warehouse} not found`)
          continue
        }

        const category = categoryMap[row.cost_category?.toLowerCase()] || 'Accessorial'
        const effectiveDate = row.effective_date 
          ? excelDateToJSDate(row.effective_date)
          : new Date()

        await prisma.costRate.create({
          data: {
            warehouseId: warehouse.id,
            costCategory: category as any,
            costName: row.cost_name,
            costValue: parseFloat(row.cost_value),
            unitOfMeasure: row.unit_of_measure || 'unit',
            effectiveDate,
            endDate: row.end_date ? excelDateToJSDate(row.end_date) : null,
            createdById: adminUser.id
          }
        })
        console.log(`    ✅ ${category}: ${row.cost_name} - $${row.cost_value} per ${row.unit_of_measure}`)
        imported++
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          skipped++
        } else {
          errors.push(`Cost ${row.cost_name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
  }

  console.log(`\n  📊 Summary: ${imported} imported, ${skipped} skipped, ${errors.length} errors`)
  if (errors.length > 0) {
    console.log('  ❌ Errors:', errors)
  }
  return { sheet: 'Cost Master', imported, skipped, errors }
}

async function importWarehouseConfig(sheet: XLSX.WorkSheet) {
  console.log('\n🏗️ Importing Warehouse Configurations...')
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse mapping
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map<string, Warehouse>(warehouses.map(w => [w.name.toLowerCase(), w]))

  // Get admin user for createdById
  const adminUser = await prisma.user.findFirst({
    where: { role: 'admin' }
  })
  
  if (!adminUser) {
    throw new Error('No admin user found in database')
  }

  for (const row of data) {
    try {
      if (!row.warehouse || !row.SKU) {
        skipped++
        continue
      }

      const warehouse = warehouseMap.get(row.warehouse.toLowerCase())
      if (!warehouse) {
        errors.push(`Warehouse ${row.warehouse} not found`)
        continue
      }

      const sku = await prisma.sku.findUnique({
        where: { skuCode: row.SKU }
      })
      if (!sku) {
        errors.push(`SKU ${row.SKU} not found`)
        continue
      }

      // Convert Excel date to JS date
      const effectiveDate = row.effective_date 
        ? excelDateToJSDate(row.effective_date)
        : new Date()

      await prisma.warehouseSkuConfig.create({
        data: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          storageCartonsPerPallet: parseInt(row.storage_cartons_per_pallet) || 1,
          shippingCartonsPerPallet: parseInt(row.shipping_cartons_per_pallet) || 1,
          maxStackingHeightCm: row.max_stacking_height_cm ? parseInt(row.max_stacking_height_cm) : null,
          effectiveDate,
          endDate: row.end_date ? excelDateToJSDate(row.end_date) : null,
          createdById: adminUser.id
        }
      })
      console.log(`  ✅ ${warehouse.name} - ${row.SKU}: Storage ${row.storage_cartons_per_pallet} cartons/pallet, Shipping ${row.shipping_cartons_per_pallet} cartons/pallet`)
      imported++
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Config for ${row.warehouse}/${row.SKU}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  console.log(`  📊 Summary: ${imported} imported, ${skipped} skipped, ${errors.length} errors`)
  if (errors.length > 0) {
    console.log('  ❌ Errors:', errors)
  }
  return { sheet: 'Warehouse Config', imported, skipped, errors }
}

async function main() {
  console.log('🚀 Starting Excel data import...')
  
  try {
    // Check if admin user exists
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    })
    
    if (!adminUser) {
      console.error('❌ No admin user found! Please create an admin user first.')
      console.log('💡 Run: npm run create-users')
      process.exit(1)
    }

    // Check if warehouses exist
    const warehouseCount = await prisma.warehouse.count()
    if (warehouseCount === 0) {
      console.error('❌ No warehouses found! Please seed the database first.')
      console.log('💡 Run: npm run seed')
      process.exit(1)
    }

    const filePath = path.join(__dirname, '..', 'data', 'Warehouse Management.xlsx')
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Excel file not found at: ${filePath}`)
      process.exit(1)
    }

    // Read the Excel file
    console.log(`📄 Reading Excel file: ${filePath}`)
    const workbook = XLSX.readFile(filePath)
    
    const results = []

    // Import in the specified order
    // 1. SKU Master first (other tables depend on SKUs)
    if (workbook.Sheets['sku master']) {
      const result = await importSkuMaster(workbook.Sheets['sku master'])
      results.push(result)
    } else {
      console.warn('⚠️  Sheet "sku master" not found')
    }

    // 2. Cost Master (rates for warehouses)
    if (workbook.Sheets['cost master']) {
      const result = await importCostMaster(workbook.Sheets['cost master'])
      results.push(result)
    } else {
      console.warn('⚠️  Sheet "cost master" not found')
    }

    // 3. Warehouse Config (pallet configurations)
    if (workbook.Sheets['warehouse config']) {
      const result = await importWarehouseConfig(workbook.Sheets['warehouse config'])
      results.push(result)
    } else {
      console.warn('⚠️  Sheet "warehouse config" not found')
    }

    // Summary
    console.log('\n\n📈 IMPORT SUMMARY')
    console.log('═'.repeat(50))
    
    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0
    
    results.forEach(result => {
      totalImported += result.imported
      totalSkipped += result.skipped
      totalErrors += result.errors.length
      
      console.log(`\n✅ ${result.sheet}:`)
      console.log(`   - ${result.imported} records imported`)
      console.log(`   - ${result.skipped} records skipped`)
      console.log(`   - ${result.errors.length} errors`)
    })
    
    console.log('\n📊 TOTALS:')
    console.log(`   - ${totalImported} total records imported`)
    console.log(`   - ${totalSkipped} total records skipped`)
    console.log(`   - ${totalErrors} total errors`)
    
    console.log('\n✨ Import completed!')

  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the import
main()