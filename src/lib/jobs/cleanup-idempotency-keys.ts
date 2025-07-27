import { idempotencyService } from '@/lib/services/idempotency-service'
import { auditLog } from '@/lib/security/audit-logger'

/**
 * Cleanup expired idempotency keys
 * This should be run periodically (e.g., every hour or daily)
 */
export async function cleanupExpiredIdempotencyKeys() {
  try {
    const startTime = Date.now()
    const deletedCount = await idempotencyService.cleanupExpiredKeys()
    const duration = Date.now() - startTime

    if (deletedCount > 0) {
      await auditLog({
        entity_type: 'IdempotencyKey',
        entity_id: 'CLEANUP',
        action: 'EXPIRED_KEYS_DELETED',
        user_id: 'system',
        data: {
          deletedCount,
          duration,
          timestamp: new Date().toISOString()
        }
      })
    }

    return {
      success: true,
      deletedCount,
      duration
    }
  } catch (error: any) {
    await auditLog({
      entity_type: 'IdempotencyKey',
      entity_id: 'CLEANUP_ERROR',
      action: 'CLEANUP_FAILED',
      user_id: 'system',
      data: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    })

    throw error
  }
}