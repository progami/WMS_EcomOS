#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function cleanupDatabase() {
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA from the database!')
  console.log('This includes:')
  console.log('  - All users (including admin accounts)')
  console.log('  - All products and inventory')
  console.log('  - All customers and transactions')
  console.log('  - All invoices and financial data')
  console.log('  - All warehouse configurations')
  console.log('\nThe database schema will remain intact.\n')

  const confirmation = await question('Type "DELETE ALL DATA" to confirm: ')
  
  if (confirmation !== 'DELETE ALL DATA') {
    console.log('❌ Cleanup cancelled.')
    process.exit(0)
  }

  console.log('\n🗑️  Starting database cleanup...')

  try {
    // Delete in correct order to respect foreign key constraints
    console.log('Deleting audit logs...')
    await prisma.auditLog.deleteMany({})
    
    console.log('Deleting invoice reconciliations...')
    await prisma.invoiceReconciliation.deleteMany({})
    
    console.log('Deleting invoice line items...')
    await prisma.invoiceLineItem.deleteMany({})
    
    console.log('Deleting invoices...')
    await prisma.invoice.deleteMany({})
    
    console.log('Deleting calculated costs...')
    await prisma.calculatedCost.deleteMany({})
    
    console.log('Deleting inventory transactions...')
    await prisma.inventoryTransaction.deleteMany({})
    
    // console.log('Deleting inventory levels...')
    // await prisma.inventoryLevel.deleteMany({}) // Model doesn't exist
    
    console.log('Deleting SKU versions...')
    await prisma.skuVersion.deleteMany({})
    
    console.log('Deleting warehouse SKU configs...')
    await prisma.warehouseSkuConfig.deleteMany({})
    
    // console.log('Deleting inventory items...')
    // await prisma.inventoryItem.deleteMany({}) // Model doesn't exist
    
    console.log('Deleting cost rates...')
    await prisma.costRate.deleteMany({})
    
    // console.log('Deleting product category assignments...')
    // await prisma.productCategoryAssignment.deleteMany({}) // Model doesn't exist
    
    // console.log('Deleting product categories...')
    // await prisma.productCategory.deleteMany({}) // Model doesn't exist
    
    // console.log('Deleting products...')
    // await prisma.product.deleteMany({}) // Model doesn't exist
    
    // console.log('Deleting customers...')
    // await prisma.customer.deleteMany({}) // Model doesn't exist
    
    console.log('Deleting users...')
    await prisma.user.deleteMany({})
    
    console.log('Deleting warehouses...')
    await prisma.warehouse.deleteMany({})

    console.log('\n✅ Database cleanup completed successfully!')
    console.log('The database is now empty and ready for new data.')
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

cleanupDatabase()