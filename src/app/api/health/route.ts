import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isRedisHealthy } from '@/lib/redis';

// Health check endpoint for monitoring and CI
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || 'unknown',
    checks: {
      server: true,
      database: false,
      redis: false,
    },
  };

  // Check database connection
  if (process.env.DATABASE_URL) {
    try {
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      health.checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
      health.checks.database = false;
    }
  }

  // Check Redis connection
  if (process.env.REDIS_URL) {
    try {
      health.checks.redis = await isRedisHealthy();
    } catch (error) {
      console.error('Redis health check failed:', error);
      health.checks.redis = false;
    }
  }

  // Determine overall health status
  const isHealthy = health.checks.server && 
    (process.env.CI || health.checks.database); // In CI, database check is optional

  return NextResponse.json(health, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}