import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

// Generate realistic SKU data
function generateSkuData(index: number) {
  const categories = [
    { prefix: 'ELEC', description: 'Electronics', packSizes: [1, 2, 4], unitsPerCarton: [12, 24, 48] },
    { prefix: 'HOME', description: 'Home & Garden', packSizes: [1, 3, 6], unitsPerCarton: [6, 12, 24] },
    { prefix: 'TOYS', description: 'Toys & Games', packSizes: [1, 2], unitsPerCarton: [12, 24, 36] },
    { prefix: 'SPRT', description: 'Sports & Outdoor', packSizes: [1, 2, 4], unitsPerCarton: [6, 12] },
    { prefix: 'BEAU', description: 'Beauty & Personal', packSizes: [1, 3, 6, 12], unitsPerCarton: [24, 48, 72] },
    { prefix: 'KITC', description: 'Kitchen & Dining', packSizes: [1, 2, 4, 6], unitsPerCarton: [6, 12, 24] },
    { prefix: 'OFFC', description: 'Office Supplies', packSizes: [1, 5, 10], unitsPerCarton: [12, 24, 48] },
    { prefix: 'CLTH', description: 'Clothing & Accessories', packSizes: [1], unitsPerCarton: [24, 36, 48] }
  ]

  const category = categories[index % categories.length]
  const productNum = faker.number.int({ min: 1000, max: 9999 })
  const variant = faker.helpers.arrayElement(['A', 'B', 'C', 'D', ''])
  
  const packSize = faker.helpers.arrayElement(category.packSizes)
  const unitsPerCarton = faker.helpers.arrayElement(category.unitsPerCarton)
  
  // Generate realistic dimensions based on category
  const unitLength = faker.number.float({ min: 5, max: 30, precision: 0.1 })
  const unitWidth = faker.number.float({ min: 5, max: 30, precision: 0.1 })
  const unitHeight = faker.number.float({ min: 2, max: 20, precision: 0.1 })
  
  const cartonLength = faker.number.float({ min: 30, max: 60, precision: 0.1 })
  const cartonWidth = faker.number.float({ min: 20, max: 50, precision: 0.1 })
  const cartonHeight = faker.number.float({ min: 15, max: 40, precision: 0.1 })
  
  // Weight calculations
  const unitWeight = faker.number.float({ min: 0.1, max: 2, precision: 0.001 })
  const cartonWeight = (unitWeight * unitsPerCarton) + faker.number.float({ min: 0.2, max: 0.5, precision: 0.001 })

  return {
    skuCode: `${category.prefix}-${productNum}${variant}`,
    asin: faker.datatype.boolean(0.7) ? `B0${faker.string.alphanumeric({ length: 8, casing: 'upper' })}` : null,
    description: `${faker.commerce.productName()} - ${category.description} ${variant ? `(${variant})` : ''}`.trim(),
    packSize,
    material: faker.helpers.arrayElement(['Plastic', 'Metal', 'Wood', 'Glass', 'Fabric', 'Paper', null]),
    unitDimensionsCm: `${unitLength}x${unitWidth}x${unitHeight}`,
    unitWeightKg: unitWeight,
    unitsPerCarton,
    cartonDimensionsCm: `${cartonLength}x${cartonWidth}x${cartonHeight}`,
    cartonWeightKg: cartonWeight,
    packagingType: faker.helpers.arrayElement(['Box', 'Bag', 'Blister', 'Bottle', 'Can', null]),
    isActive: true,
    fbaStock: faker.datatype.boolean(0.3) ? faker.number.int({ min: 0, max: 5000 }) : 0,
    fbaStockLastUpdated: faker.datatype.boolean(0.3) ? faker.date.recent({ days: 7 }) : null
  }
}

// Generate warehouse data
function generateWarehouseData(index: number) {
  const warehouses = [
    { code: 'LAX', name: 'Los Angeles Distribution Center', lat: 34.0522, lng: -118.2437, city: 'Los Angeles, CA' },
    { code: 'CHI', name: 'Chicago Fulfillment Hub', lat: 41.8781, lng: -87.6298, city: 'Chicago, IL' },
    { code: 'NYC', name: 'New York Metro Warehouse', lat: 40.7128, lng: -74.0060, city: 'New York, NY' },
    { code: 'DAL', name: 'Dallas Logistics Center', lat: 32.7767, lng: -96.7970, city: 'Dallas, TX' },
    { code: 'MIA', name: 'Miami Distribution Facility', lat: 25.7617, lng: -80.1918, city: 'Miami, FL' },
    { code: 'SEA', name: 'Seattle Northwest Hub', lat: 47.6062, lng: -122.3321, city: 'Seattle, WA' },
    { code: 'ATL', name: 'Atlanta Southeast Center', lat: 33.7490, lng: -84.3880, city: 'Atlanta, GA' },
    { code: 'PHX', name: 'Phoenix Southwest Facility', lat: 33.4484, lng: -112.0740, city: 'Phoenix, AZ' }
  ]

  if (index < warehouses.length) {
    const warehouse = warehouses[index]
    return {
      code: warehouse.code,
      name: warehouse.name,
      address: `${faker.location.streetAddress()}, ${warehouse.city}`,
      latitude: warehouse.lat,
      longitude: warehouse.lng,
      contactEmail: `${warehouse.code.toLowerCase()}-ops@warehouse.example.com`,
      contactPhone: faker.phone.number('+1-###-###-####'),
      isActive: true
    }
  }

  // Generate additional warehouses if needed
  const code = `W${faker.string.alphanumeric({ length: 2, casing: 'upper' })}${index}`
  return {
    code,
    name: `${faker.company.name()} Warehouse`,
    address: faker.location.streetAddress({ useFullAddress: true }),
    latitude: parseFloat(faker.location.latitude()),
    longitude: parseFloat(faker.location.longitude()),
    contactEmail: faker.internet.email({ provider: 'warehouse.example.com' }),
    contactPhone: faker.phone.number('+1-###-###-####'),
    isActive: true
  }
}

async function main() {
  console.log('🌱 Starting database seed...')

  try {
    // Check if data already exists
    const existingWarehouses = await prisma.warehouse.count()
    const existingSkus = await prisma.sku.count()
    const existingUsers = await prisma.user.count()

    if (existingWarehouses > 0 || existingSkus > 0) {
      console.log('⚠️  Database already contains data. To reseed, please clear the database first.')
      console.log(`   Existing: ${existingWarehouses} warehouses, ${existingSkus} SKUs, ${existingUsers} users`)
      return
    }

    console.log('📦 Creating warehouses...')
    const warehouses = []
    for (let i = 0; i < 8; i++) {
      const warehouseData = generateWarehouseData(i)
      const warehouse = await prisma.warehouse.create({
        data: warehouseData
      })
      warehouses.push(warehouse)
      console.log(`   ✓ Created warehouse: ${warehouse.code} - ${warehouse.name}`)
    }

    console.log('👤 Creating demo admin user...')
    const adminPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
      data: {
        email: 'admin@warehouse.example.com',
        username: 'admin',
        passwordHash: adminPassword,
        fullName: 'System Administrator',
        role: 'admin',
        isActive: true,
        isDemo: true
      }
    })
    console.log(`   ✓ Created admin user: ${admin.email}`)

    console.log('👥 Creating warehouse staff users...')
    for (const warehouse of warehouses.slice(0, 4)) {
      const staffPassword = await bcrypt.hash('staff123', 10)
      const staff = await prisma.user.create({
        data: {
          email: `staff-${warehouse.code.toLowerCase()}@warehouse.example.com`,
          username: `staff-${warehouse.code.toLowerCase()}`,
          passwordHash: staffPassword,
          fullName: `${warehouse.code} Warehouse Staff`,
          role: 'staff',
          warehouseId: warehouse.id,
          isActive: true,
          isDemo: true
        }
      })
      console.log(`   ✓ Created staff for ${warehouse.code}: ${staff.email}`)
    }

    console.log('📋 Creating SKUs...')
    const skus = []
    for (let i = 0; i < 50; i++) {
      const skuData = generateSkuData(i)
      const sku = await prisma.sku.create({
        data: skuData
      })
      skus.push(sku)
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✓ Created ${i + 1} SKUs...`)
      }
    }
    console.log(`   ✓ Created ${skus.length} SKUs total`)

    console.log('⚙️  Creating warehouse-SKU configurations...')
    let configCount = 0
    for (const warehouse of warehouses.slice(0, 4)) {
      // Each warehouse gets a random subset of SKUs configured
      const skuSubset = faker.helpers.arrayElements(skus, { min: 20, max: 35 })
      
      for (const sku of skuSubset) {
        await prisma.warehouseSkuConfig.create({
          data: {
            warehouseId: warehouse.id,
            skuId: sku.id,
            storageCartonsPerPallet: faker.helpers.arrayElement([40, 48, 56, 60, 72]),
            shippingCartonsPerPallet: faker.helpers.arrayElement([40, 48, 56, 60, 72]),
            maxStackingHeightCm: faker.helpers.arrayElement([180, 200, 220, 240, null]),
            effectiveDate: new Date(),
            createdById: admin.id
          }
        })
        configCount++
      }
    }
    console.log(`   ✓ Created ${configCount} warehouse-SKU configurations`)

    console.log('💰 Creating cost rates for warehouses...')
    const costTemplates = {
      Storage: [
        { name: 'Pallet Storage - Standard', value: 0.50, unit: 'per pallet per day' },
        { name: 'Pallet Storage - Climate Controlled', value: 0.75, unit: 'per pallet per day' }
      ],
      Carton: [
        { name: 'Inbound Receipt', value: 2.50, unit: 'per carton' },
        { name: 'Outbound Pick & Pack', value: 3.00, unit: 'per carton' }
      ],
      Pallet: [
        { name: 'Pallet Movement', value: 15.00, unit: 'per pallet' },
        { name: 'Pallet Wrap', value: 5.00, unit: 'per pallet' }
      ],
      Shipment: [
        { name: 'LTL Shipping Base', value: 75.00, unit: 'per shipment' },
        { name: 'FTL Shipping Base', value: 500.00, unit: 'per shipment' }
      ],
      Accessorial: [
        { name: 'Labeling Service', value: 0.25, unit: 'per unit' },
        { name: 'Repackaging Service', value: 5.00, unit: 'per carton' }
      ]
    }

    let rateCount = 0
    for (const warehouse of warehouses.slice(0, 4)) {
      for (const [category, templates] of Object.entries(costTemplates)) {
        for (const template of templates) {
          // Add some variation to the base rates
          const variation = faker.number.float({ min: 0.9, max: 1.1, precision: 0.01 })
          await prisma.costRate.create({
            data: {
              warehouseId: warehouse.id,
              costCategory: category as any,
              costName: template.name,
              costValue: template.value * variation,
              unitOfMeasure: template.unit,
              effectiveDate: new Date(),
              isActive: true,
              createdById: admin.id
            }
          })
          rateCount++
        }
      }
    }
    console.log(`   ✓ Created ${rateCount} cost rates`)

    // REMOVED: Direct inventory balance creation that bypassed transaction system
    // Inventory balances should ONLY be created through transactions
    console.log('⚠️  Skipping inventory balance creation - balances must come from transactions')

    console.log('\n✅ Database seeding completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   - ${warehouses.length} warehouses`)
    console.log(`   - ${skus.length} SKUs`)
    console.log(`   - ${await prisma.user.count()} users`)
    console.log(`   - ${configCount} warehouse-SKU configurations`)
    console.log(`   - ${rateCount} cost rates`)
    console.log(`   - ${balanceCount} inventory balances`)
    
    console.log('\n🔐 Demo credentials:')
    console.log('   Admin: admin@warehouse.example.com / admin123')
    console.log('   Staff: staff-[code]@warehouse.example.com / staff123')
    console.log('   (where [code] is lax, chi, nyc, or dal)')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })