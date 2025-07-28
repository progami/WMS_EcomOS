import { prisma } from '../src/lib/prisma'

async function checkUsers() {
  try {
    // List all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        warehouseId: true,
        warehouse: {
          select: {
            code: true,
            name: true
          }
        }
      }
    })

    console.log('\n=== All Users in Database ===')
    console.log('Total users:', users.length)
    
    users.forEach(user => {
      console.log(`\nUser: ${user.email}`)
      console.log(`  ID: ${user.id}`)
      console.log(`  Username: ${user.username || 'N/A'}`)
      console.log(`  Role: ${user.role}`)
      console.log(`  Active: ${user.isActive}`)
      console.log(`  Warehouse: ${user.warehouse ? `${user.warehouse.code} - ${user.warehouse.name}` : 'None'}`)
    })

    // Check for admin user
    const adminUser = users.find(u => u.email === 'admin@warehouse.example.com')
    if (adminUser) {
      console.log('\n✅ Demo admin user exists with ID:', adminUser.id)
    } else {
      console.log('\n❌ Demo admin user not found!')
    }

  } catch (error) {
    console.error('Error checking users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()