import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FeatureFlagsService, FEATURE_FLAGS } from '@/lib/services/feature-flags-service';
import { NextRequest } from 'next/server';

/**
 * Check if a feature flag is enabled for the current request context
 * This is a convenience function for use in API routes and server components
 */
export async function isFeatureEnabled(
  flagName: string,
  req?: NextRequest
): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    const service = FeatureFlagsService.getInstance();
    
    return service.isEnabled(
      flagName,
      session?.user?.id,
      session?.user?.role ? [session.user.role] : []
    );
  } catch (error) {
    // Default to disabled on error
    return false;
  }
}

/**
 * Get feature flag check details for the current request context
 */
export async function checkFeatureFlag(flagName: string) {
  try {
    const session = await getServerSession(authOptions);
    const service = FeatureFlagsService.getInstance();
    
    return service.checkFlag(
      flagName,
      session?.user?.id,
      session?.user?.role ? [session.user.role] : []
    );
  } catch (error) {
    return { enabled: false, source: 'default' as const };
  }
}

/**
 * Initialize feature flags on application startup
 * This should be called once when the application starts
 */
export async function initializeFeatureFlags() {
  const service = FeatureFlagsService.getInstance();
  await service.initializeDefaultFlags();
}

// Re-export feature flag constants
export { FEATURE_FLAGS } from '@/lib/services/feature-flags-service';