import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FeatureFlagsService } from '@/lib/services/feature-flags-service';
import { logger } from '@/lib/logger/server';
import { z } from 'zod';

// Schema for updating feature flags
const updateFeatureFlagSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targetedUserIds: z.array(z.string()).optional(),
  targetedRoles: z.array(z.string()).optional(),
  environmentOverrides: z.object({
    development: z.boolean().optional(),
    staging: z.boolean().optional(),
    production: z.boolean().optional()
  }).optional()
});

// GET - Get a specific feature flag
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can view feature flag details
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = FeatureFlagsService.getInstance();
    const flag = await service.getFlag(params.name);

    if (!flag) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    return NextResponse.json({ flag });
  } catch (error) {
    logger.error('Error getting feature flag', { name: params.name, error });
    return NextResponse.json(
      { error: 'Failed to get feature flag' },
      { status: 500 }
    );
  }
}

// PATCH - Update a feature flag
export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can update feature flags
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateFeatureFlagSchema.parse(body);

    const service = FeatureFlagsService.getInstance();
    const flag = await service.updateFlag(params.name, validatedData);

    logger.info('Feature flag updated', {
      flagName: flag.name,
      updatedBy: session.user.id
    });

    return NextResponse.json({ flag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating feature flag', { name: params.name, error });
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a feature flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete feature flags
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = FeatureFlagsService.getInstance();
    await service.deleteFlag(params.name);

    logger.info('Feature flag deleted', {
      flagName: params.name,
      deletedBy: session.user.id
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting feature flag', { name: params.name, error });
    return NextResponse.json(
      { error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}