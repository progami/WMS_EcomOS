import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Test login endpoint that only works in test environment
// This provides a secure way to authenticate in tests without backdoors

const testLoginSchema = z.object({
  username: z.string(),
  password: z.string()
})

export async function POST(request: Request) {
  // Only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    return NextResponse.json(
      { error: 'Test login is only available in test environment' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { username, password } = testLoginSchema.parse(body)

    // Find test user
    const user = await prisma.user.findFirst({
      where: {
        username,
        isDemo: true // Only allow demo/test users
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid test credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid test credentials' },
        { status: 401 }
      )
    }

    // Return user data for test authentication
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      warehouseId: user.warehouseId,
      isDemo: user.isDemo
    })
  } catch (error) {
    console.error('Test login error:', error)
    return NextResponse.json(
      { error: 'Test login failed' },
      { status: 500 }
    )
  }
}