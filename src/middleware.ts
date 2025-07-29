import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Redirect /operations to /operations/inventory
  if (pathname === '/operations') {
    const url = request.nextUrl.clone()
    url.pathname = '/operations/inventory'
    return NextResponse.redirect(url)
  }
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/error',
    '/api/auth',
    '/api/health',
    '/api/demo',
    '/api/logs',
  ]
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.includes(route))
  
  // Skip auth check for public routes, static files, and API routes
  if (isPublicRoute || pathname.includes('/_next') || pathname.includes('/favicon.ico')) {
    return NextResponse.next()
  }
  
  
  // Check for session
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET,
  })
  
  // If no token and trying to access protected route, redirect to login
  if (!token && !pathname.includes('/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}