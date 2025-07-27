import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { systemLogger } from '@/lib/logger/server';
import { cacheService } from '@/lib/cache/cache-service';
import crypto from 'crypto';

export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  // Percentage-based rollout (0-100)
  rolloutPercentage: number;
  // User IDs that should always see this feature
  targetedUserIds: string[];
  // User groups/roles that should see this feature
  targetedRoles: string[];
  // Environment-specific overrides
  environmentOverrides: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
  };
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface FeatureFlagCheck {
  enabled: boolean;
  source: 'percentage' | 'user' | 'role' | 'environment' | 'default';
}

export class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private readonly CACHE_TTL = 60; // 1 minute cache
  private readonly CACHE_PREFIX = 'feature_flag:';

  private constructor() {
  }

  public static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  /**
   * Check if a feature flag is enabled for the current user/context
   */
  async isEnabled(
    flagName: string,
    userId?: string,
    userRoles?: string[]
  ): Promise<boolean> {
    const check = await this.checkFlag(flagName, user_id, userRoles);
    return check.enabled;
  }

  /**
   * Get detailed information about a feature flag check
   */
  async checkFlag(
    flagName: string,
    userId?: string,
    userRoles?: string[]
  ): Promise<FeatureFlagCheck> {
    try {
      // Try to get from cache first
      const cacheKey = this.getCacheKey(flagName, userId);
      const cached = await cacheService.get<FeatureFlagCheck>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get the feature flag from database
      const flag = await this.getFlag(flagName);
      if (!flag) {
        return { enabled: false, source: 'default' };
      }

      // Check environment override first
      const environment = process.env.NODE_ENV as keyof typeof flag.environmentOverrides;
      if (flag.environmentOverrides[environment] !== undefined) {
        const result = { 
          enabled: flag.environmentOverrides[environment]!, 
          source: 'environment' as const 
        };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // If flag is globally disabled, return false
      if (!flag.enabled) {
        const result = { enabled: false, source: 'default' as const };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // Check user-specific targeting
      if (userId && flag.targetedUserIds.includes(userId)) {
        const result = { enabled: true, source: 'user' as const };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // Check role-based targeting
      if (userRoles && userRoles.some(role => flag.targetedRoles.includes(role))) {
        const result = { enabled: true, source: 'role' as const };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // Check percentage-based rollout
      if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        const enabled = this.isInRolloutPercentage(flagName, user_id, flag.rolloutPercentage);
        const result = { enabled, source: 'percentage' as const };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // If rollout is 100%, enable for everyone
      if (flag.rolloutPercentage >= 100) {
        const result = { enabled: true, source: 'percentage' as const };
        await cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
      }

      // Default to disabled
      const result = { enabled: false, source: 'default' as const };
      await cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      systemLogger.error('Error checking feature flag', { flagName, error });
      // In case of error, default to disabled
      return { enabled: false, source: 'default' };
    }
  }

  /**
   * Get a feature flag by name
   */
  async getFlag(name: string): Promise<FeatureFlag | null> {
    try {
      const flag = await prisma.feature_flags.findUnique({
        where: { name }
      });

      if (!flag) return null;

      return {
        id: flag.id,
        name: flag.name,
        description: flag.description || undefined,
        enabled: flag.enabled,
        rolloutPercentage: flag.rollout_percentage.toNumber(),
        targetedUserIds: flag.targeted_user_ids as string[],
        targetedRoles: flag.targeted_roles as string[],
        environmentOverrides: flag.environment_overrides as any,
        created_at: flag.created_at,
        updated_at: flag.updated_at,
        created_by: flag.created_by
      };
    } catch (error) {
      systemLogger.error('Error getting feature flag', { name, error });
      return null;
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      const flags = await prisma.feature_flags.findMany({
        orderBy: { name: 'asc' }
      });

      return flags.map(flag => ({
        id: flag.id,
        name: flag.name,
        description: flag.description || undefined,
        enabled: flag.enabled,
        rolloutPercentage: flag.rollout_percentage.toNumber(),
        targetedUserIds: flag.targeted_user_ids as string[],
        targetedRoles: flag.targeted_roles as string[],
        environmentOverrides: flag.environment_overrides as any,
        created_at: flag.created_at,
        updated_at: flag.updated_at,
        created_by: flag.created_by
      }));
    } catch (error) {
      systemLogger.error('Error getting all feature flags', { error });
      return [];
    }
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    data: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>,
    created_by: string
  ): Promise<FeatureFlag> {
    const flag = await prisma.feature_flags.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        rollout_percentage: data.rolloutPercentage,
        targeted_user_ids: data.targetedUserIds,
        targeted_roles: data.targetedRoles,
        environment_overrides: data.environmentOverrides,
        created_by: created_by,
        updated_at: new Date()
      }
    });

    // Clear cache for this flag
    await this.clearFlagCache(data.name);

    return {
      id: flag.id,
      name: flag.name,
      description: flag.description || undefined,
      enabled: flag.enabled,
      rolloutPercentage: flag.rollout_percentage.toNumber(),
      targetedUserIds: flag.targeted_user_ids as string[],
      targetedRoles: flag.targeted_roles as string[],
      environmentOverrides: flag.environment_overrides as any,
      created_at: flag.created_at,
      updated_at: flag.updated_at,
      created_by: flag.created_by
    };
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    name: string,
    updates: Partial<Omit<FeatureFlag, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<FeatureFlag> {
    const flag = await prisma.feature_flags.update({
      where: { name },
      data: {
        enabled: updates.enabled,
        description: updates.description,
        rollout_percentage: updates.rolloutPercentage,
        targeted_user_ids: updates.targetedUserIds,
        targeted_roles: updates.targetedRoles,
        environment_overrides: updates.environmentOverrides,
        updated_at: new Date()
      }
    });

    // Clear cache for this flag
    await this.clearFlagCache(name);

    return {
      id: flag.id,
      name: flag.name,
      description: flag.description || undefined,
      enabled: flag.enabled,
      rolloutPercentage: flag.rollout_percentage.toNumber(),
      targetedUserIds: flag.targeted_user_ids as string[],
      targetedRoles: flag.targeted_roles as string[],
      environmentOverrides: flag.environment_overrides as any,
      created_at: flag.created_at,
      updated_at: flag.updated_at,
      created_by: flag.created_by
    };
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(name: string): Promise<void> {
    await prisma.feature_flags.delete({
      where: { name }
    });

    // Clear cache for this flag
    await this.clearFlagCache(name);
  }

  /**
   * Check if a user is in the rollout percentage
   */
  private isInRolloutPercentage(
    flagName: string,
    user_id: string | undefined,
    percentage: number
  ): boolean {
    // Use a consistent identifier
    const identifier = userId || 'anonymous';
    
    // Create a hash of the flag name and identifier
    const hash = crypto
      .createHash('md5')
      .update(`${flagName}:${identifier}`)
      .digest('hex');
    
    // Convert hash to a number between 0-100
    const hashNumber = parseInt(hash.substring(0, 8), 16);
    const userPercentage = (hashNumber % 100) + 1;
    
    return userPercentage <= percentage;
  }

  /**
   * Get cache key for a flag check
   */
  private getCacheKey(flagName: string, userId?: string): string {
    return `${this.CACHE_PREFIX}${flagName}:${userId || 'anonymous'}`;
  }

  /**
   * Clear cache for a specific flag
   */
  private async clearFlagCache(flagName: string): Promise<void> {
    // Clear all cached entries for this flag
    // In a real implementation, you might want to use Redis SCAN
    // to find and delete all keys matching the pattern
    await cacheService.delete(`${this.CACHE_PREFIX}${flagName}:*`);
  }

  /**
   * Initialize default feature flags
   */
  async initializeDefaultFlags(): Promise<void> {
    const defaultFlags = [
      {
        name: 'FEATURE_MODERN_INVENTORY_API',
        description: 'Enable modern inventory API with improved performance',
        enabled: false,
        rolloutPercentage: 0,
        targetedUserIds: [],
        targetedRoles: ['admin'],
        environmentOverrides: {
          development: true,
          staging: false,
          production: false
        }
      },
      {
        name: 'FEATURE_OPTIMIZED_DASHBOARD',
        description: 'Enable optimized dashboard with caching and performance improvements',
        enabled: false,
        rolloutPercentage: 0,
        targetedUserIds: [],
        targetedRoles: ['admin'],
        environmentOverrides: {
          development: true,
          staging: false,
          production: false
        }
      },
      {
        name: 'FEATURE_ENHANCED_SECURITY',
        description: 'Enable enhanced security features including CSRF protection and rate limiting',
        enabled: true,
        rolloutPercentage: 100,
        targetedUserIds: [],
        targetedRoles: [],
        environmentOverrides: {
          development: true,
          staging: true,
          production: true
        }
      },
      {
        name: 'FEATURE_STANDARDIZED_SCHEMA',
        description: 'Enable standardized database schema with improved data consistency',
        enabled: false,
        rolloutPercentage: 0,
        targetedUserIds: [],
        targetedRoles: ['admin'],
        environmentOverrides: {
          development: true,
          staging: false,
          production: false
        }
      },
      {
        name: 'FEATURE_PERMISSION_SYSTEM',
        description: 'Enable granular permission system for role-based access control',
        enabled: false,
        rolloutPercentage: 0,
        targetedUserIds: [],
        targetedRoles: ['admin'],
        environmentOverrides: {
          development: true,
          staging: false,
          production: false
        }
      }
    ];

    for (const flagData of defaultFlags) {
      try {
        const existing = await this.getFlag(flagData.name);
        if (!existing) {
          await this.createFlag(flagData, 'system');
          systemLogger.info(`Initialized feature flag: ${flagData.name}`);
        }
      } catch (error) {
        systemLogger.error(`Error initializing feature flag: ${flagData.name}`, { error });
      }
    }
  }
}

// Helper function for easy access
export async function checkFeatureFlag(
  flagName: string,
  userId?: string,
  userRoles?: string[]
): Promise<boolean> {
  const service = FeatureFlagsService.getInstance();
  return service.isEnabled(flagName, user_id, userRoles);
}

// Feature flag names as constants
export const FEATURE_FLAGS = {
  MODERN_INVENTORY_API: 'FEATURE_MODERN_INVENTORY_API',
  OPTIMIZED_DASHBOARD: 'FEATURE_OPTIMIZED_DASHBOARD',
  ENHANCED_SECURITY: 'FEATURE_ENHANCED_SECURITY',
  STANDARDIZED_SCHEMA: 'FEATURE_STANDARDIZED_SCHEMA',
  PERMISSION_SYSTEM: 'FEATURE_PERMISSION_SYSTEM'
} as const;