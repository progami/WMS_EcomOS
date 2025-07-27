import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test bcrypt
    const testPassword = 'password123'
    const hash = await bcrypt.hash(testPassword, 10)
    const compareResult = await bcrypt.compare(testPassword, hash)
    
    // Get user
    const user = await prisma.users.findUnique({
      where: { email: 'demo-admin@warehouse.com' }
    })
    
    let passwordCheck = null
    if (user) {
      passwordCheck = await bcrypt.compare(testPassword, user.password_hash)
    }
    
    return NextResponse.json({
      bcryptWorks: true,
      hashTest: {
        original: testPassword,
        hash: hash,
        compareResult: compareResult
      },
      user: user ? {
        email: user.email,
        hasPasswordHash: !!user.password_hash,
        passwordHashLength: user.password_hash?.length,
        passwordCheck: passwordCheck
      } : null
    })
  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}