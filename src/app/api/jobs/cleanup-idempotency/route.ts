import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cleanupExpiredIdempotencyKeys } from '@/lib/jobs/cleanup-idempotency-keys'

// This endpoint should be protected and only callable by admin users or a cron job with a secret
export async function POST(request: NextRequest) {
  try {
    // Check for cron job secret first
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret === process.env.CRON_JOB_SECRET) {
      // Valid cron job request
      const result = await cleanupExpiredIdempotencyKeys()
      return NextResponse.json(result)
    }

    // Otherwise, check for admin user session
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await cleanupExpiredIdempotencyKeys()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Idempotency cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup idempotency keys', details: error.message },
      { status: 500 }
    )
  }
}