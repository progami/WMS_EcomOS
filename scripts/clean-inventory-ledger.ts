import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanInventoryLedger() {
  try {
    console.log('Cleaning inventory ledger...')
    
    // Delete all inventory transactions
    const deleteResult = await prisma.inventoryTransaction.deleteMany({})
    console.log(`Deleted ${deleteResult.count} inventory transactions`)
    
    // Inventory balances are now calculated at runtime from transactions
    console.log('Note: Inventory balances are now calculated at runtime from transactions')
    
    console.log('Inventory ledger cleaned successfully!')
  } catch (error) {
    console.error('Error cleaning inventory ledger:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanInventoryLedger()