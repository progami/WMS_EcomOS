import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    // Check if the user from session exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        warehouseId: true,
        warehouse: {
          select: {
            code: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      session: {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
        warehouseId: session.user.warehouseId
      },
      userExists: !!user,
      userData: user || null,
      message: user 
        ? 'User exists in database' 
        : 'User from session does not exist in database!'
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to check session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}