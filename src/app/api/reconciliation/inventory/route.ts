import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryReconciliationService } from '@/lib/services/inventory-reconciliation-service';
import { z } from 'zod';
import { validateCSRFToken } from '@/lib/security/csrf-protection';

// GET /api/reconciliation/inventory - Get recent reconciliation reports
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
    const reportId = searchParams.get('reportId');
    const warehouseId = searchParams.get('warehouseId');
    const limit = parseInt(searchParams.get('limit') || '10');

    const reconciliationService = new InventoryReconciliationService(prisma);

    if (reportId) {
      // Get specific report
      const report = await reconciliationService.getReconciliationReport(reportId);
      
      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ report });
    }

    if (warehouseId) {
      // Get discrepancies for a specific warehouse
      const discrepancies = await reconciliationService.getWarehouseDiscrepancies(warehouseId);
      return NextResponse.json({ discrepancies });
    }

    // Get recent reports
    const reports = await reconciliationService.getRecentReports(limit);
    return NextResponse.json({ reports });

  } catch (error) {
    console.error('Error fetching reconciliation data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data' },
      { status: 500 }
    );
  }
}

// POST /api/reconciliation/inventory - Trigger new reconciliation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admin users can trigger reconciliation
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Validate CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    if (!csrfToken || !validateCSRFToken(csrfToken, session.user.id)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Check if there's already a reconciliation in progress
    const inProgressCount = await prisma.reconciliation_reports.count({
      where: {
        status: 'IN_PROGRESS',
        report_type: 'INVENTORY',
      },
    });

    if (inProgressCount > 0) {
      return NextResponse.json(
        { error: 'A reconciliation is already in progress' },
        { status: 409 }
      );
    }

    const reconciliationService = new InventoryReconciliationService(prisma);
    
    // Run reconciliation asynchronously
    const reportId = await reconciliationService.runInventoryReconciliation(session.user.id);

    return NextResponse.json({
      message: 'Reconciliation started successfully',
      reportId,
    });

  } catch (error) {
    console.error('Error starting reconciliation:', error);
    return NextResponse.json(
      { error: 'Failed to start reconciliation' },
      { status: 500 }
    );
  }
}