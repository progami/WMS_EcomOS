import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface IdempotencyOptions {
  ttlSeconds?: number // Time to live in seconds, default 24 hours
  operation: string
}

export async function withIdempotency(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  options: IdempotencyOptions
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  
  if (!idempotencyKey) {
    // If no idempotency key provided, proceed normally
    return handler()
  }
  
  const ttl = options.ttlSeconds || 24 * 60 * 60 // Default 24 hours
  const expiresAt = new Date(Date.now() + ttl * 1000)
  
  try {
    // Check if key already exists
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey }
    })
    
    if (existing) {
      // Return cached response
      return new NextResponse(
        JSON.stringify(existing.response),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotent-Replayed': 'true'
          }
        }
      )
    }
    
    // Execute handler and store result
    const response = await handler()
    const responseBody = await response.text()
    let parsedResponse
    
    try {
      parsedResponse = JSON.parse(responseBody)
    } catch {
      // If response is not JSON, store as is
      parsedResponse = { body: responseBody }
    }
    
    // Store idempotency key with response
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        operation: options.operation,
        response: parsedResponse,
        expiresAt
      }
    })
    
    // Return original response with idempotency header
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-Idempotent-Replayed': 'false'
      }
    })
    
  } catch (error) {
    // If there's a unique constraint violation, another request beat us
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      // Try to fetch the stored response
      const stored = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey }
      })
      
      if (stored) {
        return new NextResponse(
          JSON.stringify(stored.response),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotent-Replayed': 'true'
            }
          }
        )
      }
    }
    
    // Re-throw other errors
    throw error
  }
}

// Cleanup expired idempotency keys
export async function cleanupExpiredKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  })
  
  return result.count
}