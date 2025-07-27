import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    const users = await prisma.users.findMany({
      select: {
        username: true,
        email: true,
        role: true,
        is_demo: true,
        is_active: true
      }
    })
    
    console.log('\nExisting users in database:')
    console.log('='.repeat(60))
    
    if (users.length === 0) {
      console.log('No users found in database.')
      console.log('\nTo create demo users, you can:')
      console.log('1. Set environment variables:')
      console.log('   DEMO_ADMIN_PASSWORD=YourAdminPassword')
      console.log('   DEMO_STAFF_PASSWORD=YourStaffPassword')
      console.log('2. Run: curl -X POST http://localhost:3000/api/demo/setup')
      console.log('\nDemo users will be:')
      console.log('   Admin: demo-admin')
      console.log('   Staff: staff')
    } else {
      console.log('\nFound users:')
      users.forEach(user => {
        console.log(`\nUsername: ${user.username}`)
        console.log(`Email: ${user.email}`)
        console.log(`Role: ${user.role}`)
        console.log(`Demo User: ${user.is_demo ? 'Yes' : 'No'}`)
        console.log(`Active: ${user.is_active ? 'Yes' : 'No'}`)
      })
    }
    
    console.log('\n' + '='.repeat(60))
  } catch (error) {
    console.error('Error checking users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()