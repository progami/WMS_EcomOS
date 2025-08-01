import { getServerSession as originalGetServerSession } from 'next-auth'
import { authOptions } from './auth'
import { UserRole } from '@prisma/client'

// Development-only mock session
const MOCK_SESSION = {
  user: {
    id: '96fe0757-cf1b-4be8-88c9-910bc545ffc1', // Demo admin ID
    email: 'demo-admin@warehouse.com',
    name: 'Demo Administrator',
    role: 'admin' as UserRole,
    warehouseId: undefined,
    isDemo: true,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
}

// Check if auth is bypassed
const BYPASS_AUTH = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'

// Export a wrapper that returns mock session in dev mode
export const getServerSession = async () => {
  if (BYPASS_AUTH) {
    return MOCK_SESSION
  }
  return originalGetServerSession(authOptions)
}