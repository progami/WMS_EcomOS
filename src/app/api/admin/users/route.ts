import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { invalidateAllUserSessions } from '@/lib/security/session-manager'
import { businessLogger, securityLogger } from '@/lib/logger'
import { sanitizeForDisplay, validateEmail, validateAlphanumeric } from '@/lib/security/input-sanitization'

export const dynamic = 'force-dynamic'

// Validation schemas with sanitization
const createUserSchema = z.object({
  username: z.string().min(3).max(50).refine(validateAlphanumeric, {
    message: "Username must be alphanumeric"
  }).transform(val => sanitizeForDisplay(val)),
  email: z.string().email(),
  fullName: z.string().min(1).transform(val => sanitizeForDisplay(val)),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff']),
  warehouseId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true)
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
  role: z.enum(['admin', 'staff']).optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional()
})

// GET /api/admin/users - List users
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search') ? sanitizeForDisplay(searchParams.get('search')!) : null
    const role = searchParams.get('role')
    const warehouseId = searchParams.get('warehouseId')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role) {
      where.role = role
    }

    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        warehouseId: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        lockedUntil: true,
        lockedReason: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    // console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users - Create user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createUserSchema.parse(body)

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: validatedData.username },
          { email: validatedData.email }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { 
          error: existingUser.username === validatedData.username 
            ? 'Username already exists' 
            : 'Email already exists' 
        },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        username: validatedData.username,
        email: validatedData.email,
        fullName: validatedData.fullName,
        passwordHash,
        role: validatedData.role,
        warehouseId: validatedData.warehouseId,
        isActive: validatedData.isActive
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        warehouseId: true,
        isActive: true
      }
    })

    businessLogger.info('User created successfully', {
      userId: user.id,
      username: user.username,
      role: user.role,
      createdBy: session.user.id
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updateUserSchema.parse(body)

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, username: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if email is being changed to one that already exists
    if (validatedData.email && validatedData.email !== currentUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: validatedData.email }
      })
      
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = { ...validatedData }
    
    // Hash password if provided
    if (validatedData.password) {
      updateData.passwordHash = await bcrypt.hash(validatedData.password, 10)
      delete updateData.password
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        warehouseId: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        isActive: true
      }
    })

    // If role changed, invalidate all user sessions
    if (validatedData.role && validatedData.role !== currentUser.role) {
      await invalidateAllUserSessions(userId)
      
      securityLogger.warn('User role changed - sessions invalidated', {
        userId,
        username: currentUser.username,
        oldRole: currentUser.role,
        newRole: validatedData.role,
        changedBy: session.user.id
      })
    }

    businessLogger.info('User updated successfully', {
      userId,
      username: currentUser.username,
      changes: Object.keys(validatedData),
      updatedBy: session.user.id
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    // console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Get user info before deletion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Invalidate all user sessions before deletion
    await invalidateAllUserSessions(userId)

    // Soft delete - set user as inactive
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    })

    securityLogger.warn('User deactivated', {
      userId,
      username: user.username,
      email: user.email,
      deactivatedBy: session.user.id
    })

    return NextResponse.json({ 
      message: 'User deactivated successfully',
      userId 
    })
  } catch (error) {
    // console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}