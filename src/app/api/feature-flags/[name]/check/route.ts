import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FeatureFlagsService } from '@/lib/services/feature-flags-service';
import { systemLogger as logger } from '@/lib/logger/server';

// GET - Check if a feature flag is enabled for the current user
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    const service = FeatureFlagsService.getInstance();
    const check = await service.checkFlag(
      params.name,
      session?.user?.id,
      session?.user?.role ? [session.user.role] : []
    );

    return NextResponse.json(check);
  } catch (error) {
    logger.error('Error checking feature flag', { name: params.name, error });
    // Return disabled by default on error
    return NextResponse.json({
      enabled: false,
      source: 'default'
    });
  }
}