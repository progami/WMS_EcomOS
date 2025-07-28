import { PrismaClient } from '@prisma/client'

interface DemoDataConfig {
  tx: any // PrismaClient transaction
  adminUserId: string
  staffUserId: string
  warehouses: any[]
  skus: any[]
}

export async function generateSimpleDemoData(config: DemoDataConfig) {
  const { tx, adminUserId, staffUserId, warehouses, skus } = config
  const currentDate = new Date()
  
  // console.log('📦 Generating demo data with integrity rules...')
  
  // Track inventory state for integrity
  const inventoryMap = new Map<string, number>()
  
  // 1. Create initial inventory (must receive before shipping)
  for (const warehouse of warehouses) {
    for (const sku of skus.slice(0, 5)) { // Use first 5 SKUs for simplicity
      const batchLot = `BATCH-2024-${sku.skuCode}`
      const cartons = 100 + Math.floor(Math.random() * 100) // 100-200 cartons
      
      // Create receive transaction
      await tx.inventoryTransaction.create({
        data: {
          transactionId: `RCV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          warehouseId: warehouse.id,
          skuId: sku.id,
          batchLot,
          transactionType: 'RECEIVE',
          cartonsIn: cartons,
          storagePalletsIn: Math.ceil(cartons / 48),
          transactionDate: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          createdById: staffUserId,
          storageCartonsPerPallet: 48
        }
      })
      
      // Create inventory balance
      await tx.inventoryBalance.create({
        data: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          batchLot,
          currentCartons: cartons,
          currentPallets: Math.ceil(cartons / 48),
          currentUnits: cartons * sku.unitsPerCarton,
          lastTransactionDate: currentDate,
          storageCartonsPerPallet: 48,
          shippingCartonsPerPallet: 40,
        }
      })
      
      // Track inventory
      const key = `${warehouse.id}-${sku.id}-${batchLot}`
      inventoryMap.set(key, cartons)
    }
  }
  
  // 2. Create some shipments (respecting inventory levels)
  for (let i = 0; i < 10; i++) {
    const warehouse = warehouses[0]
    const sku = skus[Math.floor(Math.random() * 5)]
    const batchLot = `BATCH-2024-${sku.skuCode}`
    const key = `${warehouse.id}-${sku.id}-${batchLot}`
    
    const currentInventory = inventoryMap.get(key) || 0
    if (currentInventory < 20) continue // Skip if inventory too low
    
    const shipCartons = Math.min(Math.floor(Math.random() * 20) + 10, currentInventory - 10)
    
    // Create ship transaction
    await tx.inventoryTransaction.create({
      data: {
        transactionId: `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        warehouseId: warehouse.id,
        skuId: sku.id,
        batchLot,
        transactionType: 'SHIP',
        cartonsOut: shipCartons,
        shippingPalletsOut: Math.ceil(shipCartons / 40),
        transactionDate: new Date(currentDate.getTime() - (20 - i) * 24 * 60 * 60 * 1000),
        createdById: staffUserId,
        shippingCartonsPerPallet: 40,
        shipName: `ORDER-${String(i + 1).padStart(5, '0')}`,
        trackingNumber: `TRK${String(Math.floor(Math.random() * 1000000)).padStart(10, '0')}`,
      }
    })
    
    // Update inventory balance
    const balance = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId: warehouse.id,
        skuId: sku.id,
        batchLot
      }
    })
    
    if (balance) {
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          currentCartons: balance.currentCartons - shipCartons,
          currentPallets: Math.ceil((balance.currentCartons - shipCartons) / 48),
          currentUnits: (balance.currentCartons - shipCartons) * sku.unitsPerCarton,
          lastTransactionDate: currentDate,
        }
      })
    }
    
    // Update tracked inventory
    inventoryMap.set(key, currentInventory - shipCartons)
  }
  
  // 3. Create simple invoices with valid dates
  const today = new Date()
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  
  // Ensure dates are valid
  const billingStart = new Date(lastMonth.toISOString())
  const billingEnd = new Date(lastMonthEnd.toISOString())
  const invoiceDate = new Date(billingEnd.toISOString())
  const issueDate = new Date(billingEnd.getTime() + 5 * 24 * 60 * 60 * 1000)
  const dueDate = new Date(billingEnd.getTime() + 35 * 24 * 60 * 60 * 1000)
  
  for (const warehouse of warehouses) {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${new Date().getFullYear()}-${warehouse.code}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`,
        warehouseId: warehouse.id,
        customerId: adminUserId,
        billingPeriodStart: billingStart,
        billingPeriodEnd: billingEnd,
        invoiceDate: invoiceDate,
        issueDate: issueDate,
        dueDate: dueDate,
        subtotal: 2500.00,
        taxAmount: 500.00,
        totalAmount: 3000.00,
        currency: 'GBP',
        status: 'pending',
        createdById: adminUserId,
        billingMonth: lastMonth.getMonth() + 1,
        billingYear: lastMonth.getFullYear(),
      }
    })
    
    // Create line items with valid numeric values
    await tx.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        costCategory: 'Storage',
        costName: 'Pallet Storage',
        quantity: 50,
        unitRate: 25.00,
        amount: 1250.00,
      }
    })
    
    await tx.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        costCategory: 'Carton',
        costName: 'Processing Fees',
        quantity: 500,
        unitRate: 2.50,
        amount: 1250.00,
      }
    })
  }
  
  // console.log('✅ Demo data generated successfully!')
}