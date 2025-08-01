import { NextRequest, NextResponse } from 'next/server'
import { createPerformanceLogger } from '@/lib/monitoring/performance'
import { prisma } from '@/lib/prisma'

const perf = createPerformanceLogger('api.test-monitoring')

export async function GET(req: NextRequest) {
  const startTime = performance.now()
  
  try {
    // Test 1: Simple operation
    await perf.measure('simple_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    
    // Test 2: Database query
    const userCount = await perf.measure('count_users', async () => {
      return await prisma.user.count()
    })
    
    // Test 3: Slow operation
    await perf.measure('slow_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })
    
    const totalDuration = performance.now() - startTime
    perf.log('total_request', totalDuration, {
      userCount,
      testComplete: true
    })
    
    const response = NextResponse.json({
      success: true,
      message: 'Performance monitoring test complete',
      userCount,
      duration: totalDuration
    })
    
    response.headers.set('X-Response-Time', `${totalDuration.toFixed(2)}ms`)
    return response
    
  } catch (error) {
    const totalDuration = performance.now() - startTime
    perf.log('total_request_error', totalDuration, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}