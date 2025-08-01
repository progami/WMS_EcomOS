import { PrismaClient } from '@prisma/client'
import { perfLogger as logger } from '@/lib/logger/server'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

// Create PrismaClient with proper connection pool settings
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Log queries with timing (production-optimized)
  if (process.env.NODE_ENV !== 'production' || process.env.MONITOR_ENABLE_METRICS === 'true') {
    client.$on('query', (e) => {
      const duration = Number(e.duration)
      const slowThreshold = parseInt(process.env.MONITOR_SLOW_QUERY_THRESHOLD || '100')
      
      // In production, only log slow queries
      if (process.env.NODE_ENV === 'development' || duration > slowThreshold) {
        // Truncate query in production for security
        const queryToLog = process.env.NODE_ENV === 'production' 
          ? e.query.substring(0, 200) + (e.query.length > 200 ? '...' : '')
          : e.query
          
        logger.log('Prisma Query', {
          query: queryToLog,
          params: process.env.NODE_ENV === 'production' ? '[REDACTED]' : e.params,
          duration: `${duration}ms`,
          slow: duration > slowThreshold,
        })
      }
    })
  }

  // Log errors
  client.$on('error', (e) => {
    logger.log('Prisma Error', {
      target: e.target,
      message: e.message,
      level: 'error'
    })
  })

  // Log warnings
  client.$on('warn', (e) => {
    logger.log('Prisma Warning', {
      message: e.message,
      level: 'warn'
    })
  })

  return client
}

// Use singleton pattern to prevent multiple instances
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma