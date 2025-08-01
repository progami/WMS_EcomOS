/**
 * Simple feature flag system for gradual rollout of architectural changes
 * In production, these should come from environment variables or a feature flag service
 */

export interface FeatureFlags {
  USE_INVENTORY_BALANCE_TABLE: boolean
  USE_REDIS_RATE_LIMITER: boolean
  USE_BACKGROUND_JOBS: boolean
  USE_OPTIMIZED_QUERIES: boolean
  ENABLE_PERFORMANCE_MONITORING: boolean
}

// Default feature flags
const defaultFlags: FeatureFlags = {
  USE_INVENTORY_BALANCE_TABLE: false,
  USE_REDIS_RATE_LIMITER: false,
  USE_BACKGROUND_JOBS: false,
  USE_OPTIMIZED_QUERIES: false,
  ENABLE_PERFORMANCE_MONITORING: true,
}

// Override from environment variables
function getFeatureFlags(): FeatureFlags {
  return {
    USE_INVENTORY_BALANCE_TABLE: process.env.FEATURE_USE_INVENTORY_BALANCE_TABLE === 'true' || defaultFlags.USE_INVENTORY_BALANCE_TABLE,
    USE_REDIS_RATE_LIMITER: process.env.FEATURE_USE_REDIS_RATE_LIMITER === 'true' || defaultFlags.USE_REDIS_RATE_LIMITER,
    USE_BACKGROUND_JOBS: process.env.FEATURE_USE_BACKGROUND_JOBS === 'true' || defaultFlags.USE_BACKGROUND_JOBS,
    USE_OPTIMIZED_QUERIES: process.env.FEATURE_USE_OPTIMIZED_QUERIES === 'true' || defaultFlags.USE_OPTIMIZED_QUERIES,
    ENABLE_PERFORMANCE_MONITORING: process.env.FEATURE_ENABLE_PERFORMANCE_MONITORING !== 'false', // Default true
  }
}

// Singleton instance
let flags: FeatureFlags | null = null

export function getFlags(): FeatureFlags {
  if (!flags) {
    flags = getFeatureFlags()
  }
  return flags
}

// Helper to check individual flags
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFlags()[flag]
}

// Log active feature flags on startup
export function logFeatureFlags(): void {
  const activeFlags = getFlags()
  console.log('🚀 Active Feature Flags:')
  Object.entries(activeFlags).forEach(([flag, enabled]) => {
    console.log(`  ${flag}: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`)
  })
}