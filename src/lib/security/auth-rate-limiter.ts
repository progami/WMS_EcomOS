import { NextRequest } from 'next/server';
import { authLogger, securityLogger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

interface AuthRateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  lockoutDuration: number;
  lockoutThreshold: number;
  exponentialBackoff: boolean;
}

interface AuthAttemptEntry {
  count: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  lockoutUntil?: number;
  backoffMultiplier: number;
  shouldLockAccount?: boolean;
}

class AuthRateLimiter {
  private ipAttempts: Map<string, AuthAttemptEntry> = new Map();
  private userAttempts: Map<string, AuthAttemptEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes (only for in-memory fallback)
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean IP attempts
      for (const [key, entry] of this.ipAttempts.entries()) {
        if (entry.lastAttemptTime + 24 * 60 * 60 * 1000 < now) { // Remove after 24 hours
          this.ipAttempts.delete(key);
        }
      }
      
      // Clean user attempts
      for (const [key, entry] of this.userAttempts.entries()) {
        if (entry.lastAttemptTime + 24 * 60 * 60 * 1000 < now) { // Remove after 24 hours
          this.userAttempts.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  async checkAuthLimit(
    req: NextRequest, 
    username: string | null,
    config: AuthRateLimitConfig
  ): Promise<{ 
    allowed: boolean; 
    retryAfter?: number;
    reason?: string;
    shouldLockAccount?: boolean;
  }> {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const redis = getRedisClient();
    
    // Try Redis first
    if (redis) {
      try {
        // Check IP-based limits
        const ipKey = `auth_rate_limit:ip:${ip}`;
        const ipResult = await this.checkRedisLimit(redis, ipKey, now, config);
        if (!ipResult.allowed) {
          securityLogger.warn('IP rate limit exceeded (Redis)', {
            ip,
            attempts: ipResult.attempts,
            lockoutUntil: ipResult.lockoutUntil
          });
          return {
            allowed: false,
            retryAfter: ipResult.retryAfter,
            reason: 'ip_rate_limit'
          };
        }
        
        // Check username-based limits if username provided
        if (username) {
          const userKey = `auth_rate_limit:user:${username.toLowerCase()}`;
          const userResult = await this.checkRedisLimit(redis, userKey, now, config);
          if (!userResult.allowed) {
            securityLogger.warn('User rate limit exceeded (Redis)', {
              username,
              attempts: userResult.attempts,
              lockoutUntil: userResult.lockoutUntil
            });
            
            // Check if we should lock the account
            const shouldLockAccount = userResult.attempts >= config.lockoutThreshold;
            
            return {
              allowed: false,
              retryAfter: userResult.retryAfter,
              reason: 'user_rate_limit',
              shouldLockAccount
            };
          }
        }
        
        return { allowed: true };
      } catch (error) {
        console.error('Redis auth rate limit error, falling back to in-memory:', error);
        // Fall through to in-memory implementation
      }
    }
    
    // Fallback to in-memory
    const ipResult = this.checkLimit(this.ipAttempts, ip, now, config);
    if (!ipResult.allowed) {
      securityLogger.warn('IP rate limit exceeded', {
        ip,
        attempts: ipResult.attempts,
        lockoutUntil: ipResult.lockoutUntil
      });
      return {
        allowed: false,
        retryAfter: ipResult.retryAfter,
        reason: 'ip_rate_limit'
      };
    }
    
    if (username) {
      const userResult = this.checkLimit(this.userAttempts, username.toLowerCase(), now, config);
      if (!userResult.allowed) {
        securityLogger.warn('User rate limit exceeded', {
          username,
          attempts: userResult.attempts,
          lockoutUntil: userResult.lockoutUntil
        });
        
        const shouldLockAccount = userResult.attempts >= config.lockoutThreshold;
        
        return {
          allowed: false,
          retryAfter: userResult.retryAfter,
          reason: 'user_rate_limit',
          shouldLockAccount
        };
      }
    }
    
    return { allowed: true };
  }

  async recordFailedAttempt(
    req: NextRequest,
    username: string | null,
    config: AuthRateLimitConfig
  ): Promise<void> {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const redis = getRedisClient();
    
    if (redis) {
      try {
        // Record IP attempt
        const ipKey = `auth_rate_limit:ip:${ip}`;
        await this.recordRedisAttempt(redis, ipKey, now, config);
        
        // Record username attempt if provided
        if (username) {
          const userKey = `auth_rate_limit:user:${username.toLowerCase()}`;
          await this.recordRedisAttempt(redis, userKey, now, config);
        }
        return;
      } catch (error) {
        console.error('Redis record attempt error, falling back to in-memory:', error);
      }
    }
    
    // Fallback to in-memory
    this.recordAttempt(this.ipAttempts, ip, now, config);
    if (username) {
      this.recordAttempt(this.userAttempts, username.toLowerCase(), now, config);
    }
  }

  async recordSuccessfulLogin(
    req: NextRequest,
    username: string
  ): Promise<void> {
    const ip = this.getClientIp(req);
    const redis = getRedisClient();
    
    if (redis) {
      try {
        // Clear attempts for this IP and username
        await redis.del(`auth_rate_limit:ip:${ip}`);
        await redis.del(`auth_rate_limit:user:${username.toLowerCase()}`);
        
        authLogger.info('Successful login - clearing rate limit counters (Redis)', {
          ip,
          username
        });
        return;
      } catch (error) {
        console.error('Redis clear attempts error:', error);
      }
    }
    
    // Fallback to in-memory
    this.ipAttempts.delete(ip);
    this.userAttempts.delete(username.toLowerCase());
    
    authLogger.info('Successful login - clearing rate limit counters', {
      ip,
      username
    });
  }

  // Note: Account locking is handled in the auth handler to avoid Prisma in middleware
  markAccountForLockout(username: string): void {
    const entry = this.userAttempts.get(username.toLowerCase());
    if (entry) {
      entry.shouldLockAccount = true;
    }
  }

  private async checkRedisLimit(
    redis: any,
    key: string,
    now: number,
    config: AuthRateLimitConfig
  ): Promise<{ 
    allowed: boolean; 
    retryAfter?: number; 
    attempts: number;
    lockoutUntil?: number;
  }> {
    // Get entry from Redis
    const entryStr = await redis.get(key);
    
    if (!entryStr) {
      return { allowed: true, attempts: 0 };
    }
    
    const entry: AuthAttemptEntry = JSON.parse(entryStr);
    
    // Check if currently locked out
    if (entry.lockoutUntil && entry.lockoutUntil > now) {
      const retryAfter = Math.ceil((entry.lockoutUntil - now) / 1000);
      return { 
        allowed: false, 
        retryAfter, 
        attempts: entry.count,
        lockoutUntil: entry.lockoutUntil
      };
    }
    
    // Check if window has expired
    if (entry.firstAttemptTime + config.windowMs < now) {
      // Reset the entry
      await redis.del(key);
      return { allowed: true, attempts: 0 };
    }
    
    // Check if max attempts reached
    if (entry.count >= config.maxAttempts) {
      // Apply lockout
      const lockoutDuration = config.exponentialBackoff
        ? config.lockoutDuration * entry.backoffMultiplier
        : config.lockoutDuration;
        
      entry.lockoutUntil = now + lockoutDuration;
      entry.backoffMultiplier = Math.min(entry.backoffMultiplier * 2, 32); // Cap at 32x
      
      // Update in Redis with new lockout
      await redis.set(key, JSON.stringify(entry), 'EX', 86400); // 24 hour expiry
      
      const retryAfter = Math.ceil(lockoutDuration / 1000);
      return { 
        allowed: false, 
        retryAfter, 
        attempts: entry.count,
        lockoutUntil: entry.lockoutUntil
      };
    }
    
    return { allowed: true, attempts: entry.count };
  }

  private async recordRedisAttempt(
    redis: any,
    key: string,
    now: number,
    config: AuthRateLimitConfig
  ): Promise<void> {
    const entryStr = await redis.get(key);
    let entry: AuthAttemptEntry;
    
    if (!entryStr) {
      // Create new entry
      entry = {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
        backoffMultiplier: 1
      };
    } else {
      entry = JSON.parse(entryStr);
      
      // Check if window expired
      if (entry.firstAttemptTime + config.windowMs < now) {
        // Reset entry
        entry = {
          count: 1,
          firstAttemptTime: now,
          lastAttemptTime: now,
          backoffMultiplier: 1
        };
      } else {
        // Update existing entry
        entry.count++;
        entry.lastAttemptTime = now;
      }
    }
    
    // Save to Redis with 24 hour expiry
    await redis.set(key, JSON.stringify(entry), 'EX', 86400);
  }

  private checkLimit(
    store: Map<string, AuthAttemptEntry>,
    key: string,
    now: number,
    config: AuthRateLimitConfig
  ): { 
    allowed: boolean; 
    retryAfter?: number; 
    attempts: number;
    lockoutUntil?: number;
  } {
    const entry = store.get(key);
    
    if (!entry) {
      return { allowed: true, attempts: 0 };
    }
    
    // Check if currently locked out
    if (entry.lockoutUntil && entry.lockoutUntil > now) {
      const retryAfter = Math.ceil((entry.lockoutUntil - now) / 1000);
      return { 
        allowed: false, 
        retryAfter, 
        attempts: entry.count,
        lockoutUntil: entry.lockoutUntil
      };
    }
    
    // Check if window has expired
    if (entry.firstAttemptTime + config.windowMs < now) {
      // Reset the entry
      store.delete(key);
      return { allowed: true, attempts: 0 };
    }
    
    // Check if max attempts reached
    if (entry.count >= config.maxAttempts) {
      // Apply lockout
      const lockoutDuration = config.exponentialBackoff
        ? config.lockoutDuration * entry.backoffMultiplier
        : config.lockoutDuration;
        
      entry.lockoutUntil = now + lockoutDuration;
      entry.backoffMultiplier = Math.min(entry.backoffMultiplier * 2, 32); // Cap at 32x
      
      const retryAfter = Math.ceil(lockoutDuration / 1000);
      return { 
        allowed: false, 
        retryAfter, 
        attempts: entry.count,
        lockoutUntil: entry.lockoutUntil
      };
    }
    
    return { allowed: true, attempts: entry.count };
  }

  private recordAttempt(
    store: Map<string, AuthAttemptEntry>,
    key: string,
    now: number,
    config: AuthRateLimitConfig
  ): void {
    let entry = store.get(key);
    
    if (!entry || entry.firstAttemptTime + config.windowMs < now) {
      // Create new entry
      entry = {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
        backoffMultiplier: 1
      };
    } else {
      // Update existing entry
      entry.count++;
      entry.lastAttemptTime = now;
    }
    
    store.set(key, entry);
  }

  private getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
    return ip;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
let authRateLimiterInstance: AuthRateLimiter | null = null;

export function getAuthRateLimiter(): AuthRateLimiter {
  if (!authRateLimiterInstance) {
    authRateLimiterInstance = new AuthRateLimiter();
  }
  return authRateLimiterInstance;
}

// Auth rate limit configurations
export const authRateLimitConfig: AuthRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5, // 5 attempts before lockout
  lockoutDuration: 5 * 60 * 1000, // 5 minutes initial lockout
  lockoutThreshold: 10, // Lock account after 10 failed attempts
  exponentialBackoff: true // Double lockout duration for each subsequent lockout
};

// Helper function to check auth rate limits
export async function checkAuthRateLimit(
  req: NextRequest,
  username?: string
): Promise<Response | null> {
  const limiter = getAuthRateLimiter();
  const result = await limiter.checkAuthLimit(req, username || null, authRateLimitConfig);
  
  if (!result.allowed) {
    const message = result.reason === 'ip_rate_limit'
      ? 'Too many login attempts from this IP address'
      : 'Too many failed login attempts for this account';
      
    authLogger.warn('Auth rate limit exceeded', {
      reason: result.reason,
      retryAfter: result.retryAfter,
      shouldLockAccount: result.shouldLockAccount
    });
    
    // Mark account for lockout if threshold reached
    if (result.shouldLockAccount && username) {
      limiter.markAccountForLockout(username);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message,
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter || 60)
        }
      }
    );
  }
  
  return null;
}

// Export function to record failed attempts
export async function recordFailedLoginAttempt(req: NextRequest, username?: string): Promise<void> {
  const limiter = getAuthRateLimiter();
  await limiter.recordFailedAttempt(req, username || null, authRateLimitConfig);
}

// Export function to record successful login
export async function recordSuccessfulLogin(req: NextRequest, username: string): Promise<void> {
  const limiter = getAuthRateLimiter();
  await limiter.recordSuccessfulLogin(req, username);
}