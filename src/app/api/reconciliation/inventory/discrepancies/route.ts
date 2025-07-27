import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  reportId: z.string().optional(),
  warehouse_id: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// GET /api/reconciliation/inventory/discrepancies - Get discrepancy details with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      reportId: searchParams.get('reportId') || undefined,
      warehouse_id: searchParams.get('warehouseId') || undefined,
      severity: searchParams.get('severity') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    // Build where clause
    const where: any = {};
    if (params.reportId) where.report_id = params.reportId;
    if (params.warehouse_id) where.warehouse_id = params.warehouse_id;
    if (params.severity) where.severity = params.severity;

    // Get total count for pagination
    const totalCount = await prisma.reconciliation_discrepancies.count({ where });

    // Get discrepancies
    const discrepancies = await prisma.reconciliation_discrepancies.findMany({
      where,
      include: {
        reconciliation_reports: {
          select: {
            id: true,
            started_at: true,
            completed_at: true,
            status: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        skus: {
          select: {
            id: true,
            sku_code: true,
            description: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' },
        { difference: 'desc' },
      ],
      take: params.limit,
      skip: params.offset,
    });

    // Calculate summary statistics
    const severityCounts = await prisma.reconciliation_discrepancies.groupBy({
      by: ['severity'],
      where,
      _count: {
        severity: true,
      },
    });

    const summary = {
      total: totalCount,
      bySeverity: severityCounts.reduce((acc, item) => {
        acc[item.severity] = item._count.severity;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      discrepancies,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasNext: params.offset + params.limit < totalCount,
      },
      summary,
    });

  } catch (error) {
    console.error('Error fetching discrepancies:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch discrepancies' },
      { status: 500 }
    );
  }
}