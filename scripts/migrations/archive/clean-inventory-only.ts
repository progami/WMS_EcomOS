import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanInventoryOnly() {
  try {
    console.log('Cleaning inventory transactions only...')
    
    // Delete all inventory transactions
    const deleteResult = await prisma.inventoryTransaction.deleteMany({})
    console.log(`Deleted ${deleteResult.count} inventory transactions`)
    
    console.log('Inventory ledger cleaned successfully!')
    console.log('Note: Warehouses and other data remain intact')
  } catch (error) {
    console.error('Error cleaning inventory ledger:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanInventoryOnly()