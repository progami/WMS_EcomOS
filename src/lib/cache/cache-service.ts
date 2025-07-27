import { recordCacheOperation } from '../monitoring/monitoring-service'
import { cacheLogger } from '../logger/edge'

export interface CacheService {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: any, ttlSeconds?: number): Promise<void>
  invalidate(pattern: string): Promise<void>
  getStats(): Promise<CacheStats>
}

export interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRate: number
  evictions: number
  avgHitTime: number
  avgMissTime: number
}

// Enhanced in-memory cache with monitoring
export class InMemoryCacheService implements CacheService {
  private cache = new Map<string, { value: any; expiry: number; size: number }>()
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    hitTimes: [] as number[],
    missTimes: [] as number[]
  }
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024 // 100MB
  private currentSize = 0

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now()
    const item = this.cache.get(key)
    
    if (!item) {
      const duration = performance.now() - startTime
      this.stats.misses++
      this.stats.missTimes.push(duration)
      
      // Keep only last 1000 timing samples
      if (this.stats.missTimes.length > 1000) {
        this.stats.missTimes.shift()
      }
      
      recordCacheOperation('get', key, false, duration)
      cacheLogger.debug(`Cache miss: ${key}`, { duration })
      return null
    }
    
    if (Date.now() > item.expiry) {
      const duration = performance.now() - startTime
      this.cache.delete(key)
      this.currentSize -= item.size
      this.stats.misses++
      this.stats.missTimes.push(duration)
      
      recordCacheOperation('get', key, false, duration)
      cacheLogger.debug(`Cache miss (expired): ${key}`, { duration })
      return null
    }
    
    const duration = performance.now() - startTime
    this.stats.hits++
    this.stats.hitTimes.push(duration)
    
    // Keep only last 1000 timing samples
    if (this.stats.hitTimes.length > 1000) {
      this.stats.hitTimes.shift()
    }
    
    recordCacheOperation('get', key, true, duration)
    return item.value as T
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const startTime = performance.now()
    const serialized = JSON.stringify(value)
    const size = new Blob([serialized]).size
    
    // Check if we need to evict items
    if (this.currentSize + size > this.MAX_CACHE_SIZE) {
      await this.evictOldest(size)
    }
    
    const expiry = Date.now() + (ttlSeconds * 1000)
    const existingItem = this.cache.get(key)
    
    if (existingItem) {
      this.currentSize -= existingItem.size
    }
    
    this.cache.set(key, { value, expiry, size })
    this.currentSize += size
    
    const duration = performance.now() - startTime
    recordCacheOperation('set', key, true, duration, { size, ttl: ttlSeconds })
    
    cacheLogger.debug(`Cache set: ${key}`, { size, ttl: ttlSeconds, duration })
  }

  async invalidate(pattern: string): Promise<void> {
    const startTime = performance.now()
    const regex = new RegExp(pattern.replace('*', '.*'))
    let invalidatedCount = 0
    
    for (const [key, item] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        this.currentSize -= item.size
        invalidatedCount++
      }
    }
    
    const duration = performance.now() - startTime
    recordCacheOperation('invalidate', pattern, true, duration)
    
    cacheLogger.info(`Cache invalidated: ${pattern}`, { 
      invalidatedCount, 
      duration 
    })
  }

  async getStats(): Promise<CacheStats> {
    const avgHitTime = this.stats.hitTimes.length > 0
      ? this.stats.hitTimes.reduce((a, b) => a + b, 0) / this.stats.hitTimes.length
      : 0
    
    const avgMissTime = this.stats.missTimes.length > 0
      ? this.stats.missTimes.reduce((a, b) => a + b, 0) / this.stats.missTimes.length
      : 0
    
    const total = this.stats.hits + this.stats.misses
    
    return {
      size: this.currentSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      avgHitTime,
      avgMissTime
    }
  }

  private async evictOldest(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiry - b[1].expiry)
    
    let freedSpace = 0
    
    for (const [key, item] of entries) {
      if (freedSpace >= requiredSpace) break
      
      this.cache.delete(key)
      this.currentSize -= item.size
      freedSpace += item.size
      this.stats.evictions++
      
      cacheLogger.debug(`Cache evicted: ${key}`, { size: item.size })
    }
  }
}

// Export singleton instance
export const cacheService = new InMemoryCacheService()