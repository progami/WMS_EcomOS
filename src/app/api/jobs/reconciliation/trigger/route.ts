import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runInventoryReconciliationJob } from '@/lib/jobs/inventory-reconciliation-job';
import { validateCSRFToken } from '@/lib/security/csrf-protection';

// POST /api/jobs/reconciliation/trigger - Manually trigger reconciliation job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admin users can trigger the job
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

    // Parse request body
    const body = await request.json();
    const { notifyOnCompletion = true, notifyOnCritical = true } = body;

    // Run the job
    const result = await runInventoryReconciliationJob({
      user_id: session.user.id,
      notifyOnCompletion,
      notifyOnCritical,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message || 'Job failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reportId: result.reportId,
      duration: result.duration,
      summary: result.summary,
    });

  } catch (error) {
    console.error('Error triggering reconciliation job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger reconciliation job' },
      { status: 500 }
    );
  }
}