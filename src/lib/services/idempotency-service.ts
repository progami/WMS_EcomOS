import { prisma } from '@/lib/prisma'

export class IdempotencyService {
  /**
   * Check if an idempotency key exists and store it if not
   * @param key The idempotency key
   * @param userId The user ID associated with the request
   * @returns true if the key was successfully stored (new request), false if it already exists (duplicate)
   */
  async checkAndStore(key: string, user_id: string): Promise<boolean> {
    try {
      await prisma.idempotency_keys.create({
        data: {
          key,
          user_id: user_id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      })
      return true
    } catch (error: any) {
      if (error.code === 'P2002') { // Unique constraint violation
        return false
      }
      throw error
    }
  }

  /**
   * Clean up expired idempotency keys
   * This should be called periodically (e.g., via a cron job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await prisma.idempotency_keys.deleteMany({
      where: {
        expires_at: {
          lt: new Date()
        }
      }
    })
    return result.count
  }

  /**
   * Check if a key exists without storing it
   * @param key The idempotency key to check
   * @returns true if the key exists and hasn't expired
   */
  async exists(key: string): Promise<boolean> {
    const existingKey = await prisma.idempotency_keys.findUnique({
      where: { key },
      select: { expires_at: true }
    })

    if (!existingKey) {
      return false
    }

    // Check if the key has expired
    if (existingKey.expires_at < new Date()) {
      // Clean up the expired key
      await prisma.idempotency_keys.delete({
        where: { key }
      })
      return false
    }

    return true
  }

  /**
   * Generate a unique idempotency key
   * @returns A unique idempotency key
   */
  static generateKey(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${timestamp}-${random}`
  }
}

// Export a singleton instance
export const idempotencyService = new IdempotencyService()