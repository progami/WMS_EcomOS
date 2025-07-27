import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FeatureFlagsService } from '@/lib/services/feature-flags-service';
import { logger } from '@/lib/logger/server';
import { z } from 'zod';

// Schema for creating/updating feature flags
const featureFlagSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  enabled: z.boolean(),
  rolloutPercentage: z.number().min(0).max(100),
  targetedUserIds: z.array(z.string()),
  targetedRoles: z.array(z.string()),
  environmentOverrides: z.object({
    development: z.boolean().optional(),
    staging: z.boolean().optional(),
    production: z.boolean().optional()
  })
});

// GET - List all feature flags
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can view feature flags
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = FeatureFlagsService.getInstance();
    const flags = await service.getAllFlags();

    return NextResponse.json({ flags });
  } catch (error) {
    logger.error('Error listing feature flags', { error });
    return NextResponse.json(
      { error: 'Failed to list feature flags' },
      { status: 500 }
    );
  }
}

// POST - Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can create feature flags
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = featureFlagSchema.parse(body);

    const service = FeatureFlagsService.getInstance();
    const flag = await service.createFlag(validatedData, session.user.id);

    logger.info('Feature flag created', {
      flagName: flag.name,
      created_by: session.user.id
    });

    return NextResponse.json({ flag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating feature flag', { error });
    return NextResponse.json(
      { error: 'Failed to create feature flag' },
      { status: 500 }
    );
  }
}