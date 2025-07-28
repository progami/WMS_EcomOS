import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface ReconciliationDiscrepancy {
  warehouse_id: string;
  warehouseName: string;
  sku_id: string;
  sku_code: string;
  batch_lot: string;
  recordedBalance: number;
  calculatedBalance: number;
  difference: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: {
    lastTransactionDate?: Date;
    transactionHistory?: Array<{
      transaction_id: string;
      type: string;
      cartons: number;
      date: Date;
    }>;
  };
}

interface ReconciliationSummary {
  totalWarehouses: number;
  totalSkus: number;
  totalDiscrepancies: number;
  criticalDiscrepancies: number;
  discrepanciesBySeverity: Record<string, number>;
  discrepanciesByWarehouse: Record<string, number>;
  totalCartonsRecorded: number;
  totalCartonsCalculated: number;
  absoluteDifference: number;
}

export class InventoryReconciliationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Run a complete inventory reconciliation
   * This is a READ-ONLY operation that compares inventory_transactions against inventory_balances
   */
  async runInventoryReconciliation(userId: string): Promise<string> {
    const reportId = uuidv4();
    
    try {
      // Create the report record
      await this.prisma.reconciliationReport.create({
        data: {
          id: reportId,
          report_type: 'INVENTORY',
          started_at: new Date(),
          status: 'IN_PROGRESS',
          created_by: userId,
        },
      });

      // Get all unique warehouse/sku/batch combinations from both tables
      const inventoryCombinations = await this.getInventoryCombinations();
      
      const discrepancies: ReconciliationDiscrepancy[] = [];
      let processedCount = 0;

      // Process each combination
      for (const combo of inventoryCombinations) {
        const discrepancy = await this.checkInventoryDiscrepancy(
          combo.warehouse_id,
          combo.sku_id,
          combo.batch_lot
        );

        if (discrepancy) {
          discrepancies.push(discrepancy);
        }

        processedCount++;
        
        // Update progress periodically
        if (processedCount % 100 === 0) {
          await this.updateReportProgress(reportId, processedCount, inventoryCombinations.length);
        }
      }

      // Calculate summary statistics
      const summary = this.calculateSummaryStatistics(discrepancies, inventoryCombinations.length);

      // Save discrepancies to database
      if (discrepancies.length > 0) {
        await this.saveDiscrepancies(reportId, discrepancies);
      }

      // Update report with final status
      await this.prisma.reconciliationReport.update({
        where: { id: reportId },
        data: {
          completed_at: new Date(),
          status: 'COMPLETED',
          total_warehouses: summary.totalWarehouses,
          total_skus: summary.totalSkus,
          total_discrepancies: summary.totalDiscrepancies,
          critical_discrepancies: summary.criticalDiscrepancies,
          summary_statistics: summary,
        },
      });

      // Send notifications if critical discrepancies found
      if (summary.criticalDiscrepancies > 0) {
        await this.sendCriticalDiscrepancyNotifications(reportId, summary.criticalDiscrepancies);
      }

      return reportId;
    } catch (error) {
      // Mark report as failed
      await this.prisma.reconciliationReport.update({
        where: { id: reportId },
        data: {
          completed_at: new Date(),
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      });
      throw error;
    }
  }

  /**
   * Get all unique warehouse/sku/batch combinations from transactions
   */
  private async getInventoryCombinations() {
    // Get combinations from inventory_transactions
    const transactionCombos = await this.prisma.inventoryTransaction.groupBy({
      by: ['warehouseId', 'skuId', 'batchLot'],
    });

    // Convert to the expected format
    const combinations = transactionCombos.map(combo => ({
      warehouse_id: combo.warehouseId,
      sku_id: combo.skuId,
      batch_lot: combo.batchLot,
    }));

    return combinations;
  }

  /**
   * Check for discrepancy in a specific warehouse/sku/batch combination
   */
  private async checkInventoryDiscrepancy(
    warehouse_id: string,
    sku_id: string,
    batch_lot: string
  ): Promise<ReconciliationDiscrepancy | null> {
    // Calculate balance from transactions
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        warehouseId: warehouse_id,
        skuId: sku_id,
        batchLot: batch_lot,
      },
      orderBy: { transactionDate: 'asc' },
    });

    let calculatedBalance = 0;
    const transactionHistory = [];
    let lastTransactionDate: Date | undefined;

    for (const tx of transactions) {
      const netCartons = tx.cartonsIn - tx.cartonsOut;
      calculatedBalance += netCartons;
      lastTransactionDate = tx.transactionDate;
      
      transactionHistory.push({
        transaction_id: tx.transactionId,
        type: tx.transactionType,
        cartons: netCartons,
        date: tx.transactionDate,
      });
    }

    // Since we no longer have a recorded balance table, we'll compare against 0
    // This service now checks for any SKU/batch combinations that have negative balances
    const difference = Math.abs(calculatedBalance);

    // Only report if there's a negative balance or other issue
    if (calculatedBalance >= 0) {
      return null; // No discrepancy - positive or zero balance
    }

    // Determine severity based on negative balance
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (Math.abs(calculatedBalance) > 100) {
      severity = 'CRITICAL';
    } else if (Math.abs(calculatedBalance) > 50) {
      severity = 'HIGH';
    } else if (Math.abs(calculatedBalance) > 10) {
      severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }

    // Get warehouse and SKU details
    const [warehouse, sku] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: warehouse_id } }),
      this.prisma.sku.findUnique({ where: { id: sku_id } })
    ]);

    return {
      warehouse_id,
      warehouseName: warehouse?.name || 'Unknown',
      sku_id,
      sku_code: sku?.skuCode || 'Unknown',
      batch_lot,
      recordedBalance: 0, // No recorded balance anymore
      calculatedBalance,
      difference: calculatedBalance, // Negative balance amount
      severity,
      details: {
        last_transaction_date: lastTransactionDate,
        transactionHistory: transactionHistory.slice(-10), // Last 10 transactions
      },
    };
  }

  /**
   * Calculate summary statistics for the reconciliation report
   */
  private calculateSummaryStatistics(
    discrepancies: ReconciliationDiscrepancy[],
    totalCombinations: number
  ): ReconciliationSummary {
    const warehouses = new Set(discrepancies.map(d => d.warehouse_id));
    const skus = new Set(discrepancies.map(d => d.sku_id));
    
    const discrepanciesBySeverity = discrepancies.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const discrepanciesByWarehouse = discrepancies.reduce((acc, d) => {
      acc[d.warehouseName] = (acc[d.warehouseName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCartonsRecorded = discrepancies.reduce((sum, d) => sum + d.recordedBalance, 0);
    const totalCartonsCalculated = discrepancies.reduce((sum, d) => sum + d.calculatedBalance, 0);
    const absoluteDifference = discrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0);

    return {
      totalWarehouses: warehouses.size,
      totalSkus: skus.size,
      totalDiscrepancies: discrepancies.length,
      criticalDiscrepancies: discrepanciesBySeverity['CRITICAL'] || 0,
      discrepanciesBySeverity,
      discrepanciesByWarehouse,
      totalCartonsRecorded,
      totalCartonsCalculated,
      absoluteDifference,
    };
  }

  /**
   * Save discrepancies to the database
   */
  private async saveDiscrepancies(reportId: string, discrepancies: ReconciliationDiscrepancy[]) {
    const discrepancyRecords = discrepancies.map(d => ({
      id: uuidv4(),
      report_id: reportId,
      warehouse_id: d.warehouse_id,
      sku_id: d.sku_id,
      batch_lot: d.batch_lot,
      recorded_balance: d.recordedBalance,
      calculated_balance: d.calculatedBalance,
      difference: d.difference,
      severity: d.severity,
      discrepancy_details: d.details,
    }));

    await this.prisma.reconciliationDiscrepancy.createMany({
      data: discrepancyRecords,
    });
  }

  /**
   * Update report progress (for long-running reconciliations)
   */
  private async updateReportProgress(reportId: string, processed: number, total: number) {
    const progress = Math.round((processed / total) * 100);
    console.log(`Reconciliation progress: ${progress}% (${processed}/${total})`);
  }

  /**
   * Send notifications for critical discrepancies
   */
  private async sendCriticalDiscrepancyNotifications(reportId: string, criticalCount: number) {
    // Get all admin users
    const adminUsers = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
    });

    // Create notifications for each admin
    const notifications = adminUsers.map(user => ({
      id: uuidv4(),
      warehouse_id: user.warehouseId || '', // System-wide notification
      type: 'RECONCILIATION_COMPLETE' as const,
      title: 'Critical Inventory Discrepancies Found',
      message: `Reconciliation completed with ${criticalCount} critical discrepancies requiring immediate attention. Report ID: ${reportId}`,
      created_at: new Date(),
    }));

    if (notifications.length > 0 && notifications[0].warehouse_id) {
      await this.prisma.warehouseNotification.createMany({
        data: notifications.filter(n => n.warehouse_id),
      });
    }

    console.log(`Sent ${notifications.length} critical discrepancy notifications`);
  }

  /**
   * Get a specific reconciliation report
   */
  async getReconciliationReport(reportId: string) {
    return await this.prisma.reconciliationReport.findUnique({
      where: { id: reportId },
      include: {
        user: true,
        discrepancies: {
          include: {
            warehouse: true,
            sku: true,
          },
        },
      },
    });
  }

  /**
   * Get recent reconciliation reports
   */
  async getRecentReports(limit: number = 10) {
    return await this.prisma.reconciliationReport.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        user: true,
      },
    });
  }

  /**
   * Get discrepancies for a specific warehouse
   */
  async getWarehouseDiscrepancies(warehouseId: string, reportId?: string) {
    const where: any = { warehouse_id: warehouse_id };
    if (reportId) {
      where.report_id = reportId;
    }

    return await this.prisma.reconciliationDiscrepancy.findMany({
      where,
      include: {
        reconciliationReport: true,
        warehouse: true,
        sku: true,
      },
      orderBy: [
        { severity: 'desc' },
        { difference: 'desc' },
      ],
    });
  }
}