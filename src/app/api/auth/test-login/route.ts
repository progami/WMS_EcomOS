import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    // Find user
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: username },
          { username: username }
        ]
      }
    })
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found',
        username 
      }, { status: 404 })
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash)
    
    return NextResponse.json({
      success: isValid,
      user: isValid ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      } : null,
      passwordHashFirst10: user.password_hash.substring(0, 10),
      providedPassword: password
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}