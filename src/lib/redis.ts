import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not configured, rate limiting will use in-memory storage')
    return null
  }

  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('Redis connection failed after 3 retries')
            return null
          }
          return Math.min(times * 50, 2000)
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY'
          if (err.message.includes(targetError)) {
            return true
          }
          return false
        },
      })

      redis.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      redis.on('connect', () => {
        console.log('Redis Client Connected')
      })
    } catch (error) {
      console.error('Failed to create Redis client:', error)
      redis = null
    }
  }

  return redis
}

export async function isRedisHealthy(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    console.error('Redis health check failed:', error)
    return false
  }
}