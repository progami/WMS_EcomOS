import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWarehouses() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: {
          select: {
            users: true,
            inventoryTransactions: true,
            invoices: true
          }
        }
      }
    })
    
    console.log('Warehouses found:', warehouses.length)
    if (warehouses.length === 0) {
      console.log('No warehouses found in the database')
    } else {
      warehouses.forEach(w => {
        console.log(`\n${w.code}: ${w.name}`)
        console.log(`  Active: ${w.isActive}`)
        console.log(`  Users: ${w._count.users}`)
        console.log(`  Transactions: ${w._count.inventoryTransactions}`)
        console.log(`  Invoices: ${w._count.invoices}`)
      })
    }
  } catch (error) {
    console.error('Error checking warehouses:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWarehouses()