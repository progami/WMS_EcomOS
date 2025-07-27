import { initializeFeatureFlags } from '@/lib/feature-flags';
import { logger } from '@/lib/logger/server';

/**
 * Initialize feature flags on application startup
 * This should be called once when the application starts
 */
export async function startupInitializeFeatureFlags() {
  try {
    logger.info('Initializing feature flags...');
    await initializeFeatureFlags();
    logger.info('Feature flags initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize feature flags', { error });
    // Don't throw - allow app to start even if feature flags fail to initialize
  }
}

// Export for use in app initialization
export default startupInitializeFeatureFlags;