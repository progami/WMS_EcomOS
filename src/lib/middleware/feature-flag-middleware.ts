import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags';
import { logger } from '@/lib/logger/server';

/**
 * Middleware to check feature flags and apply security features conditionally
 */
export async function featureFlagMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Check if enhanced security is enabled
    const enhancedSecurityEnabled = await isFeatureEnabled(FEATURE_FLAGS.ENHANCED_SECURITY);
    
    if (enhancedSecurityEnabled) {
      // Additional security headers
      const response = await handler();
      
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      return response;
    }
    
    // If not enabled, just execute the handler
    return handler();
  } catch (error) {
    logger.error('Error in feature flag middleware', { error });
    // Continue without additional features on error
    return handler();
  }
}

/**
 * Check if permission system is enabled
 */
export async function checkPermissionSystem(): Promise<boolean> {
  return isFeatureEnabled(FEATURE_FLAGS.PERMISSION_SYSTEM);
}