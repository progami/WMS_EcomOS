import { prisma } from '@/lib/prisma';
import { InventoryReconciliationService } from '@/lib/services/inventory-reconciliation-service';

export interface ReconciliationJobOptions {
  userId?: string;
  notifyOnCompletion?: boolean;
  notifyOnCritical?: boolean;
}

/**
 * Run inventory reconciliation job
 * This can be scheduled via cron or triggered manually
 */
export async function runInventoryReconciliationJob(options: ReconciliationJobOptions = {}) {
  const startTime = new Date();
  console.log(`[Reconciliation Job] Starting at ${startTime.toISOString()}`);

  try {
    // Use system user if no user specified
    const userId = options.user_id649 || await getSystemUserId();
    
    // Check if there's already a reconciliation in progress
    const inProgressCount = await prisma.reconciliation_reports.count({
      where: {
        status: 'IN_PROGRESS',
        report_type: 'INVENTORY',
      },
    });

    if (inProgressCount > 0) {
      console.log('[Reconciliation Job] Another reconciliation is already in progress, skipping...');
      return {
        success: false,
        message: 'Another reconciliation is already in progress',
      };
    }

    // Run the reconciliation
    const reconciliationService = new InventoryReconciliationService(prisma);
    const reportId = await reconciliationService.runInventoryReconciliation(userId);

    // Get the completed report
    const report = await reconciliationService.getReconciliationReport(reportId);
    
    if (!report) {
      throw new Error('Failed to retrieve completed report');
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000; // seconds

    console.log(`[Reconciliation Job] Completed in ${duration}s`);
    console.log(`[Reconciliation Job] Report ID: ${reportId}`);
    console.log(`[Reconciliation Job] Total discrepancies: ${report.total_discrepancies}`);
    console.log(`[Reconciliation Job] Critical discrepancies: ${report.critical_discrepancies}`);

    // Send completion notification if requested
    if (options.notifyOnCompletion) {
      await sendCompletionNotification(reportId, report);
    }

    return {
      success: true,
      reportId,
      duration,
      summary: {
        totalDiscrepancies: report.total_discrepancies,
        criticalDiscrepancies: report.critical_discrepancies,
        status: report.status,
      },
    };

  } catch (error) {
    console.error('[Reconciliation Job] Error:', error);
    
    // Log the error
    await logJobError(error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get or create a system user for automated jobs
 */
async function getSystemUserId(): Promise<string> {
  let systemUser = await prisma.users.findFirst({
    where: {
      email: 'system@wms.local',
      role: 'admin',
    },
  });

  if (!systemUser) {
    // Create system user if it doesn't exist
    systemUser = await prisma.users.create({
      data: {
        id: 'system-user',
        email: 'system@wms.local',
        username: 'system',
        password_hash: '', // No login allowed
        full_name: 'System User',
        role: 'admin',
        is_active: true,
        updated_at: new Date(),
      },
    });
  }

  return systemUser.id;
}

/**
 * Send completion notification to admins
 */
async function sendCompletionNotification(reportId: string, report: any) {
  const adminUsers = await prisma.users.findMany({
    where: {
      role: 'admin',
      is_active: true,
      email: {
        not: 'system@wms.local',
      },
    },
  });

  const notifications = adminUsers.map(user => ({
    id: `notif-${Date.now()}-${user.id}`,
    warehouse_id: user.warehouse_id || '',
    type: 'RECONCILIATION_COMPLETE' as const,
    title: 'Inventory Reconciliation Completed',
    message: `Automated reconciliation completed. Found ${report.total_discrepancies} discrepancies (${report.critical_discrepancies} critical). Report ID: ${reportId}`,
    created_at: new Date(),
  }));

  if (notifications.length > 0) {
    await prisma.warehouses_notifications.createMany({
      data: notifications.filter(n => n.warehouse_id),
    });
  }
}

/**
 * Log job errors for monitoring
 */
async function logJobError(error: unknown) {
  try {
    await prisma.audit_logs.create({
      data: {
        id: `audit-${Date.now()}`,
        table_name: 'reconciliation_job',
        record_id: 'scheduled_job',
        action: 'ERROR',
        changes: {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : String(error),
        },
        user_id: await getSystemUserId(),
        created_at: new Date(),
      },
    });
  } catch (logError) {
    console.error('[Reconciliation Job] Failed to log error:', logError);
  }
}

/**
 * Get job status and history
 */
export async function getReconciliationJobHistory(limit: number = 10) {
  const reports = await prisma.reconciliation_reports.findMany({
    where: {
      report_type: 'INVENTORY',
    },
    orderBy: {
      started_at: 'desc',
    },
    take: limit,
    include: {
      users: {
        select: {
          id: true,
          email: true,
          full_name: true,
        },
      },
    },
  });

  return reports.map(report => ({
    id: report.id,
    startedAt: report.started_at,
    completedAt: report.completed_at,
    status: report.status,
    duration: report.completed_at ? 
      (report.completed_at.getTime() - report.started_at.getTime()) / 1000 : null,
    discrepancies: report.total_discrepancies,
    criticalDiscrepancies: report.critical_discrepancies,
    created_by: report.users,
    isAutomated: report.users.email === 'system@wms.local',
  }));
}