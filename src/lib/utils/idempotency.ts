import crypto from 'crypto'

/**
 * Generate a unique idempotency key
 * @returns A unique idempotency key
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(16).toString('hex')
  return `${timestamp}-${random}`
}