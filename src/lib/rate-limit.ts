import { NextRequest, NextResponse } from 'next/server'

// Store for rate limit tracking (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configurations
export const loginRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts. Please try again later.',
}

export const apiRateLimit = {
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests. Please slow down.',
}

export const uploadRateLimit = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 uploads per 5 minutes
  message: 'Too many file uploads. Please wait before uploading more files.',
}

// Helper function to get client identifier
function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  // Use the first available IP or fallback to a default
  const ip = forwardedFor?.split(',')[0] || realIp || cfConnectingIp || '127.0.0.1'
  
  // For authenticated requests, use user ID + IP
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    return `${authHeader}-${ip}`
  }
  
  return ip
}

// Check rate limit
export function checkRateLimit(
  request: NextRequest,
  limit: { windowMs: number; max: number; message: string }
): { allowed: boolean; message?: string; retryAfter?: number } {
  const clientId = getClientId(request)
  const now = Date.now()
  
  // Get or create client record
  let clientRecord = rateLimitStore.get(clientId)
  
  // Clean up expired records periodically
  if (rateLimitStore.size > 1000) {
    for (const [id, record] of rateLimitStore.entries()) {
      if (record.resetTime < now) {
        rateLimitStore.delete(id)
      }
    }
  }
  
  // If no record or expired, create new one
  if (!clientRecord || clientRecord.resetTime < now) {
    clientRecord = {
      count: 0,
      resetTime: now + limit.windowMs,
    }
    rateLimitStore.set(clientId, clientRecord)
  }
  
  // Increment counter
  clientRecord.count++
  
  // Check if limit exceeded
  if (clientRecord.count > limit.max) {
    const retryAfter = Math.ceil((clientRecord.resetTime - now) / 1000)
    return {
      allowed: false,
      message: limit.message,
      retryAfter,
    }
  }
  
  return { allowed: true }
}

// Middleware wrapper for API routes
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  limit = apiRateLimit
): Promise<NextResponse> {
  const rateLimitCheck = checkRateLimit(request, limit)
  
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: rateLimitCheck.message,
        retryAfter: rateLimitCheck.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitCheck.retryAfter || 60),
          'X-RateLimit-Limit': String(limit.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + limit.windowMs).toISOString(),
        },
      }
    )
  }
  
  // Add rate limit headers to successful responses
  const response = await handler()
  const clientId = getClientId(request)
  const clientRecord = rateLimitStore.get(clientId)
  
  if (clientRecord) {
    response.headers.set('X-RateLimit-Limit', String(limit.max))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit.max - clientRecord.count)))
    response.headers.set('X-RateLimit-Reset', new Date(clientRecord.resetTime).toISOString())
  }
  
  return response
}