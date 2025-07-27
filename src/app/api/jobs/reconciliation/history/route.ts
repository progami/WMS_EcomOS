import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getReconciliationJobHistory } from '@/lib/jobs/inventory-reconciliation-job';

// GET /api/jobs/reconciliation/history - Get reconciliation job history
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
    const limit = parseInt(searchParams.get('limit') || '10');

    const history = await getReconciliationJobHistory(limit);

    return NextResponse.json({
      history,
      total: history.length,
    });

  } catch (error) {
    console.error('Error fetching job history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job history' },
      { status: 500 }
    );
  }
}