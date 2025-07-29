import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixDemoInvoices() {
  console.log('🔧 Fixing demo invoices with invalid dates and amounts...')
  
  try {
    // Find demo invoices from the specific warehouses
    const demoInvoices = await prisma.invoice.findMany({
      where: {
        warehouse: {
          name: {
            in: ['Manchester Distribution Center', 'London Central Warehouse']
          }
        }
      },
      include: {
        warehouse: true
      }
    })
    
    console.log(`Found ${demoInvoices.length} demo invoices to check`)
    
    // Fix each invoice
    for (const invoice of demoInvoices) {
      const currentDate = new Date()
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
      
      // Always update demo invoices with valid data
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          billingPeriodStart: lastMonth,
          billingPeriodEnd: lastMonthEnd,
          invoiceDate: lastMonthEnd,
          dueDate: new Date(lastMonthEnd.getTime() + 30 * 24 * 60 * 60 * 1000),
          totalAmount: 3000.00,
          subtotal: 2500.00,
          taxAmount: 500.00,
          issueDate: new Date(lastMonthEnd.getTime() + 5 * 24 * 60 * 60 * 1000),
          currency: 'GBP',
          status: 'pending'
        }
      })
      console.log(`✅ Fixed invoice ${invoice.invoiceNumber} for ${invoice.warehouse.name}`)
    }
    
    console.log('✨ Demo invoices fixed!')
    
  } catch (error) {
    console.error('❌ Error fixing demo invoices:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixDemoInvoices()