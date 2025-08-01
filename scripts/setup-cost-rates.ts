import { PrismaClient, CostCategory } from '@prisma/client'

const prisma = new PrismaClient()

async function setupCostRates() {
  console.log('🏭 Setting up warehouses and cost rates...')
  
  try {
    // Get or create a system user
    let systemUser = await prisma.user.findFirst({
      where: { email: 'admin@example.com' }
    })
    
    if (!systemUser) {
      // Create a basic admin user for testing
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash('admin123', 10)
      
      systemUser = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          passwordHash: hashedPassword,
          fullName: 'System Admin',
          role: 'admin'
        }
      })
      console.log('✅ Created system admin user')
    }
    // Create FMC warehouse if not exists
    let fmcWarehouse = await prisma.warehouse.findUnique({
      where: { code: 'FMC' }
    })
    
    if (!fmcWarehouse) {
      fmcWarehouse = await prisma.warehouse.create({
        data: {
          code: 'FMC',
          name: 'FMC Warehouse',
          address: '123 FMC Street, Los Angeles, CA 90001',
          isActive: true
        }
      })
      console.log('✅ Created FMC warehouse')
    } else {
      console.log('⏭️  FMC warehouse already exists')
    }
    
    // Create Vglobal warehouse if not exists
    let vglobalWarehouse = await prisma.warehouse.findUnique({
      where: { code: 'Vglobal' }
    })
    
    if (!vglobalWarehouse) {
      vglobalWarehouse = await prisma.warehouse.create({
        data: {
          code: 'Vglobal',
          name: 'Vglobal Warehouse',
          address: '456 Vglobal Avenue, Houston, TX 77001',
          isActive: true
        }
      })
      console.log('✅ Created Vglobal warehouse')
    } else {
      console.log('⏭️  Vglobal warehouse already exists')
    }
    
    // Cost rates data
    const costRatesData = [
      // Container and port-related costs (for RECEIVE with container)
      { name: 'Terminal Charges', category: CostCategory.Container, value: 185, unit: 'per container' },
      { name: 'Port Processing Fee', category: CostCategory.Container, value: 24.5, unit: 'per container' },
      { name: 'Documentation Fee', category: CostCategory.Container, value: 65, unit: 'per container' },
      { name: 'Container Inspection', category: CostCategory.Container, value: 20, unit: 'per container' },
      { name: 'Customs Clearance', category: CostCategory.Container, value: 20, unit: 'per container' },
      { name: 'Port Charges', category: CostCategory.Container, value: 32, unit: 'per container' },
      { name: 'Deferment Fee', category: CostCategory.Container, value: 30, unit: 'per container' },
      { name: 'Haulage', category: CostCategory.Container, value: 835, unit: 'per container' },
      { name: 'Container Unloading', category: CostCategory.Container, value: 500, unit: 'per container' },
      { name: 'Freight', category: CostCategory.Container, value: 2000, unit: 'per container' },
      
      // Carton costs
      { name: 'Carton Handling', category: CostCategory.Carton, value: 1.3, unit: 'per carton' },
      { name: 'Carton Unloading Cost', category: CostCategory.Carton, value: 1.75, unit: 'per carton' },
      
      // Pallet costs
      { name: 'Storage cost per pallet / week', category: CostCategory.Storage, value: 3, unit: 'per pallet per week' },
      { name: 'Pallet handling', category: CostCategory.Pallet, value: 13.5, unit: 'per pallet' },
      
      // Transport costs
      { name: 'LTL', category: CostCategory.Accessorial, value: 50, unit: 'per shipment' },
      { name: 'FTL', category: CostCategory.Accessorial, value: 500, unit: 'per shipment' }
    ]
    
    // Create cost rates for both warehouses
    const warehouses = [fmcWarehouse, vglobalWarehouse]
    let createdCount = 0
    let skippedCount = 0
    
    for (const warehouse of warehouses) {
      for (const rateData of costRatesData) {
        // Check if rate already exists
        const existing = await prisma.costRate.findFirst({
          where: {
            warehouseId: warehouse.id,
            costName: rateData.name
          }
        })
        
        if (!existing) {
          await prisma.costRate.create({
            data: {
              warehouseId: warehouse.id,
              costCategory: rateData.category,
              costName: rateData.name,
              costValue: rateData.value,
              unitOfMeasure: rateData.unit,
              effectiveDate: new Date('2024-01-01'),
              isActive: true,
              createdById: systemUser.id
            }
          })
          createdCount++
        } else {
          skippedCount++
        }
      }
    }
    
    console.log(`✨ Cost rates setup completed!`)
    console.log(`   - Created: ${createdCount} rates`)
    console.log(`   - Skipped: ${skippedCount} existing rates`)
    
    // Display summary
    const totalRates = await prisma.costRate.count({
      where: {
        warehouse: {
          code: { in: ['FMC', 'Vglobal'] }
        }
      }
    })
    
    console.log(`\n📊 Total cost rates for FMC and Vglobal: ${totalRates}`)
    
  } catch (error) {
    console.error('❌ Error setting up cost rates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupCostRates()