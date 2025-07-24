import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

// Create PrismaClient with proper connection pool settings
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// In development, we want to prevent too many instances
if (process.env.NODE_ENV === 'production') {
  // In production, always create a new instance
  exports.prisma = createPrismaClient()
} else {
  // In development, use singleton to prevent too many connections
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  exports.prisma = globalForPrisma.prisma
}

export const prisma = exports.prisma
export default prisma