import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function createDemoUsers() {
  try {
    console.log('Creating demo users...')
    
    // Check if demo users already exist
    const existingUsers = await prisma.user.findMany({
      where: {
        username: { in: ['demo-admin', 'staff'] }
      }
    })
    
    if (existingUsers.length > 0) {
      console.log('Demo users already exist!')
      existingUsers.forEach(user => {
        console.log(`- ${user.username} (${user.role})`)
      })
      return
    }
    
    // Create demo admin
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin2024!'
    const adminHash = await bcrypt.hash(adminPassword, 10)
    
    const adminUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username: 'demo-admin',
        email: 'demo-admin@warehouse.com',
        passwordHash: adminHash,
        fullName: 'Demo Administrator',
        role: 'admin',
        is_active: true,
        is_demo: true,
        updated_at: new Date()
      }
    })
    
    console.log('✅ Created admin user:')
    console.log(`   Username: demo-admin`)
    console.log(`   Password: ${adminPassword}`)
    console.log(`   Email: ${adminUser.email}`)
    
    // Create demo staff
    const staffPassword = process.env.DEMO_STAFF_PASSWORD || 'DemoStaff2024!'
    const staffHash = await bcrypt.hash(staffPassword, 10)
    
    const staffUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username: 'staff',
        email: 'staff@warehouse.com',
        passwordHash: staffHash,
        fullName: 'Demo Staff',
        role: 'staff',
        is_active: true,
        is_demo: true,
        updated_at: new Date()
      }
    })
    
    console.log('\n✅ Created staff user:')
    console.log(`   Username: staff`)
    console.log(`   Password: ${staffPassword}`)
    console.log(`   Email: ${staffUser.email}`)
    
    console.log('\n' + '='.repeat(60))
    console.log('Demo users created successfully!')
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('Error creating demo users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createDemoUsers()