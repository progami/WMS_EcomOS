import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get all cookies
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    
    // Get session
    const session = await getServerSession(authOptions)
    
    // Check for session token cookie
    const sessionToken = cookieStore.get('next-auth.session-token')
    const csrfToken = cookieStore.get('next-auth.csrf-token')
    const callbackUrl = cookieStore.get('next-auth.callback-url')
    
    return NextResponse.json({
      hasSession: !!session,
      session,
      cookies: {
        all: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })),
        sessionToken: sessionToken ? 'EXISTS' : 'MISSING',
        csrfToken: csrfToken ? 'EXISTS' : 'MISSING',
        callbackUrl: callbackUrl?.value || null
      },
      authOptions: {
        secret: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
        url: process.env.NEXTAUTH_URL || 'NOT SET'
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to debug session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}