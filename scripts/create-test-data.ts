import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestData() {
  try {
    // Check if warehouse already exists
    let warehouse = await prisma.warehouse.findUnique({
      where: { code: 'WH001' }
    })

    if (!warehouse) {
      // Create a test warehouse
      warehouse = await prisma.warehouse.create({
        data: {
          name: 'Test Warehouse 1',
          code: 'WH001',
          address: '123 Test Street, Test City, CA 90210',
          contactEmail: 'warehouse@test.com',
          contactPhone: '+1-555-0123',
          isActive: true,
        }
      })
      console.log('✅ Created warehouse:', warehouse.name, '(ID:', warehouse.id, ')')
    } else {
      console.log('✅ Using existing warehouse:', warehouse.name, '(ID:', warehouse.id, ')')
    }

    // Check if SKU already exists
    let sku = await prisma.sku.findUnique({
      where: { skuCode: 'TEST-SKU-001' }
    })

    if (!sku) {
      // Create a test SKU
      sku = await prisma.sku.create({
        data: {
          skuCode: 'TEST-SKU-001',
          description: 'Test Product 1 - Blue Cotton T-Shirt',
          packSize: 1,
          material: 'Cotton',
          unitDimensionsCm: '30x40x2',
          unitWeightKg: new Decimal(0.2),
          unitsPerCarton: 24,
          cartonDimensionsCm: '50x40x30',
          cartonWeightKg: new Decimal(5.0),
          packagingType: 'Box',
          isActive: true,
        }
      })
      console.log('✅ Created SKU:', sku.skuCode, '(ID:', sku.id, ')')
    } else {
      console.log('✅ Using existing SKU:', sku.skuCode, '(ID:', sku.id, ')')
    }

    // First, we need a user to create transactions
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@warehouse.com' }
    })

    if (!systemUser) {
      const passwordHash = await bcrypt.hash('system123', 10)
      systemUser = await prisma.user.create({
        data: {
          email: 'system@warehouse.com',
          fullName: 'System User',
          passwordHash: passwordHash,
          role: 'admin',
          warehouseId: warehouse.id,
          isActive: true,
        }
      })
      console.log('✅ Created system user')
    }

    // Create a receiving transaction to add inventory
    const receiveTransaction = await prisma.inventoryTransaction.create({
      data: {
        transactionId: `REC-${Date.now()}`,
        warehouseId: warehouse.id,
        skuId: sku.id,
        batchLot: 'BATCH-001',
        transactionType: 'RECEIVE',
        referenceId: 'PO-12345',
        cartonsIn: 10,
        cartonsOut: 0,
        storagePalletsIn: 2,
        shippingPalletsOut: 0,
        transactionDate: new Date(),
        createdById: systemUser.id,
        supplier: 'Test Supplier Inc.',
        unitsPerCarton: sku.unitsPerCarton,
        storageCartonsPerPallet: 5,
        attachments: {
          notes: 'Initial test inventory'
        }
      }
    })
    console.log('✅ Created receiving transaction:', receiveTransaction.transactionId)

    // Get current inventory balance
    const inventoryBalance = await prisma.inventoryTransaction.aggregate({
      where: {
        warehouseId: warehouse.id,
        skuId: sku.id,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      }
    })

    const currentStock = (inventoryBalance._sum.cartonsIn || 0) - (inventoryBalance._sum.cartonsOut || 0)

    console.log('\n📦 Test data ready!')
    console.log('Warehouse Code:', warehouse.code)
    console.log('SKU Code:', sku.skuCode)
    console.log('Current Stock:', currentStock, 'cartons (', currentStock * sku.unitsPerCarton, 'units )')
    console.log('\nYou can now run your tests with this data!')

    // Clean up the script file
    await prisma.$disconnect()
    
  } catch (error) {
    console.error('❌ Error creating test data:', error)
    await prisma.$disconnect()
  }
}

createTestData()