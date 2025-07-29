import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function dropInventoryBalancesTable() {
  try {
    // Drop the inventory_balances table
    await prisma.$executeRaw`DROP TABLE IF EXISTS inventory_balances CASCADE`
    console.log('Dropped inventory_balances table successfully')
  } catch (error) {
    console.error('Error dropping table:', error)
  } finally {
    await prisma.$disconnect()
  }
}

dropInventoryBalancesTable()