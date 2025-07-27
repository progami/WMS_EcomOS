/**
 * Data Integrity Test Suite: Reconciliation Accuracy Tests
 * Tests the accuracy of inventory reconciliation and data consistency
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ReconciliationService } from '@/lib/services/reconciliation-service';
import { InventoryService } from '@/lib/services/inventory-service';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

describe('Reconciliation Accuracy Tests', () => {
  let reconciliationService: ReconciliationService;
  let inventoryService: InventoryService;
  let testWarehouseId: string;
  let testSkuIds: string[];
  let testBatchIds: string[];
  let testUserId: string;

  beforeAll(async () => {
    reconciliationService = new ReconciliationService();
    inventoryService = new InventoryService();

    // Create test user
    const user = await prisma.users.create({
      data: {
        email: 'reconciliation-test@example.com',
        name: 'Reconciliation Test User',
      },
    });
    testUserId = user.id;

    // Create test warehouse
    const warehouse = await prisma.warehouses.create({
      data: {
        name: 'Reconciliation Test Warehouse',
        address: '789 Reconciliation Ave',
      },
    });
    testWarehouseId = warehouse.id;

    // Create test SKUs
    const skus = await Promise.all(
      Array(5).fill(null).map((_, i) =>
        prisma.sKU.create({
          data: {
            code: `RECON-SKU-${i + 1}`,
            name: `Reconciliation Test Product ${i + 1}`,
            description: 'Product for reconciliation testing',
            unitPrice: new Decimal(10 + i),
          },
        })
      )
    );
    testSkuIds = skus.map(s => s.id);

    // Create test batches
    const batches = await Promise.all(
      skus.map((sku, i) =>
        prisma.batch.create({
          data: {
            batchNumber: `RECON-BATCH-${i + 1}`,
            skuId: sku.id,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })
      )
    );
    testBatchIds = batches.map(b => b.id);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.inventory_transactions.deleteMany({
      where: { skuId: { in: testSkuIds } },
    });
    await prisma.inventory_balances.deleteMany({
      where: { skuId: { in: testSkuIds } },
    });
    await prisma.batch.deleteMany({
      where: { id: { in: testBatchIds } },
    });
    await prisma.sKU.deleteMany({
      where: { id: { in: testSkuIds } },
    });
    await prisma.warehouses.delete({
      where: { id: testWarehouseId },
    });
    await prisma.users.delete({
      where: { id: testUserId },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear all transactions and balances before each test
    await prisma.inventory_transactions.deleteMany({
      where: { skuId: { in: testSkuIds } },
    });
    await prisma.inventory_balances.deleteMany({
      where: { skuId: { in: testSkuIds } },
    });
  });

  describe('Transaction-Based Reconciliation', () => {
    it('should accurately calculate balance from transaction history', async () => {
      const skuId = testSkuIds[0];
      const batchId = testBatchIds[0];

      // Create a series of transactions
      const transactions = [
        { type: 'RECEIPT', quantity: 100 },
        { type: 'RECEIPT', quantity: 50 },
        { type: 'SHIPMENT', quantity: 30 },
        { type: 'SHIPMENT', quantity: 20 },
        { type: 'RECEIPT', quantity: 75 },
        { type: 'SHIPMENT', quantity: 25 },
      ];

      for (const tx of transactions) {
        await prisma.inventory_transactions.create({
          data: {
            type: tx.type as any,
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: tx.quantity,
            transactionDate: new Date(),
            referenceNumber: `RECON-${Date.now()}-${Math.random()}`,
            status: 'COMPLETED',
            userId: testUserId,
          },
        });
      }

      // Calculate expected balance
      const expectedBalance = transactions.reduce((acc, tx) => {
        return acc + (tx.type === 'RECEIPT' ? tx.quantity : -tx.quantity);
      }, 0);

      // Run reconciliation
      const reconciledBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId
      );

      expect(reconciledBalance).toBe(expectedBalance);
      expect(reconciledBalance).toBe(150); // 100 + 50 - 30 - 20 + 75 - 25
    });

    it('should detect discrepancies between stored balance and calculated balance', async () => {
      const skuId = testSkuIds[1];
      const batchId = testBatchIds[1];

      // Create inventory balance with incorrect value
      await prisma.inventory_balances.create({
        data: {
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 500, // Incorrect balance
          availableQuantity: 500,
          reservedQuantity: 0,
        },
      });

      // Create transactions that should sum to 300
      const transactions = [
        { type: 'RECEIPT', quantity: 200 },
        { type: 'RECEIPT', quantity: 150 },
        { type: 'SHIPMENT', quantity: 50 },
      ];

      for (const tx of transactions) {
        await prisma.inventory_transactions.create({
          data: {
            type: tx.type as any,
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: tx.quantity,
            transactionDate: new Date(),
            referenceNumber: `DISC-${Date.now()}-${Math.random()}`,
            status: 'COMPLETED',
            userId: testUserId,
          },
        });
      }

      // Run discrepancy check
      const discrepancies = await reconciliationService.findDiscrepancies(testWarehouseId);

      expect(discrepancies).toHaveLength(1);
      expect(discrepancies[0].skuId).toBe(skuId);
      expect(discrepancies[0].storedBalance).toBe(500);
      expect(discrepancies[0].calculatedBalance).toBe(300);
      expect(discrepancies[0].difference).toBe(200);
    });

    it('should handle date-range based reconciliation', async () => {
      const skuId = testSkuIds[2];
      const batchId = testBatchIds[2];

      // Create transactions over different dates
      const now = new Date();
      const transactions = [
        { date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), type: 'RECEIPT', quantity: 100 },
        { date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), type: 'SHIPMENT', quantity: 20 },
        { date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), type: 'RECEIPT', quantity: 50 },
        { date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), type: 'SHIPMENT', quantity: 30 },
        { date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), type: 'RECEIPT', quantity: 40 },
      ];

      for (const tx of transactions) {
        await prisma.inventory_transactions.create({
          data: {
            type: tx.type as any,
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: tx.quantity,
            transactionDate: tx.date,
            referenceNumber: `DATE-${tx.date.getTime()}-${Math.random()}`,
            status: 'COMPLETED',
            userId: testUserId,
          },
        });
      }

      // Reconcile for last 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId,
        sevenDaysAgo
      );

      // Should only include last 3 transactions
      expect(recentBalance).toBe(60); // 50 - 30 + 40
    });
  });

  describe('Multi-Warehouse Reconciliation', () => {
    it('should accurately reconcile inventory across multiple warehouses', async () => {
      const skuId = testSkuIds[3];
      const batchId = testBatchIds[3];

      // Create additional warehouse
      const warehouse2 = await prisma.warehouses.create({
        data: {
          name: 'Reconciliation Test Warehouse 2',
          address: '790 Reconciliation Blvd',
        },
      });

      try {
        // Create transactions in both warehouses
        await prisma.inventory_transactions.create({
          data: {
            type: 'RECEIPT',
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: 100,
            transactionDate: new Date(),
            referenceNumber: 'MW-1',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        await prisma.inventory_transactions.create({
          data: {
            type: 'RECEIPT',
            skuId,
            warehouseId: warehouse2.id,
            batchId,
            quantity: 150,
            transactionDate: new Date(),
            referenceNumber: 'MW-2',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        // Transfer between warehouses
        await prisma.inventory_transactions.create({
          data: {
            type: 'TRANSFER_OUT',
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: 30,
            transactionDate: new Date(),
            referenceNumber: 'MW-TRANSFER-1',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        await prisma.inventory_transactions.create({
          data: {
            type: 'TRANSFER_IN',
            skuId,
            warehouseId: warehouse2.id,
            batchId,
            quantity: 30,
            transactionDate: new Date(),
            referenceNumber: 'MW-TRANSFER-1',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        // Reconcile both warehouses
        const balance1 = await reconciliationService.calculateBalanceFromTransactions(
          skuId,
          testWarehouseId,
          batchId
        );
        const balance2 = await reconciliationService.calculateBalanceFromTransactions(
          skuId,
          warehouse2.id,
          batchId
        );

        expect(balance1).toBe(70); // 100 - 30
        expect(balance2).toBe(180); // 150 + 30
        expect(balance1 + balance2).toBe(250); // Total should be conserved
      } finally {
        await prisma.warehouses.delete({ where: { id: warehouse2.id } });
      }
    });
  });

  describe('Adjustment and Correction Handling', () => {
    it('should properly handle inventory adjustments', async () => {
      const skuId = testSkuIds[4];
      const batchId = testBatchIds[4];

      // Create initial transactions
      await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 100,
          transactionDate: new Date(),
          referenceNumber: 'ADJ-INIT-1',
          status: 'COMPLETED',
          userId: testUserId,
        },
      });

      // Physical count shows different quantity
      const physicalCount = 95;
      
      // Create adjustment transaction
      await prisma.inventory_transactions.create({
        data: {
          type: 'ADJUSTMENT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: -5, // Negative adjustment
          transactionDate: new Date(),
          referenceNumber: 'ADJ-PHYS-COUNT-1',
          status: 'COMPLETED',
          userId: testUserId,
          notes: 'Physical count adjustment - shrinkage',
        },
      });

      // Reconcile
      const reconciledBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId
      );

      expect(reconciledBalance).toBe(physicalCount);
    });

    it('should track adjustment reasons and patterns', async () => {
      const skuId = testSkuIds[0];
      const batchId = testBatchIds[0];

      // Create various adjustment transactions
      const adjustments = [
        { quantity: -5, reason: 'DAMAGE', notes: 'Water damage' },
        { quantity: -3, reason: 'THEFT', notes: 'Missing items' },
        { quantity: 2, reason: 'FOUND', notes: 'Found misplaced items' },
        { quantity: -1, reason: 'DAMAGE', notes: 'Broken in handling' },
      ];

      for (const adj of adjustments) {
        await prisma.inventory_transactions.create({
          data: {
            type: 'ADJUSTMENT',
            skuId,
            warehouseId: testWarehouseId,
            batchId,
            quantity: adj.quantity,
            transactionDate: new Date(),
            referenceNumber: `ADJ-${adj.reason}-${Date.now()}`,
            status: 'COMPLETED',
            userId: testUserId,
            notes: adj.notes,
            adjustmentReason: adj.reason,
          },
        });
      }

      // Analyze adjustment patterns
      const adjustmentAnalysis = await reconciliationService.analyzeAdjustments(
        testWarehouseId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date()
      );

      expect(adjustmentAnalysis.totalAdjustments).toBe(4);
      expect(adjustmentAnalysis.byReason.DAMAGE).toBe(2);
      expect(adjustmentAnalysis.byReason.THEFT).toBe(1);
      expect(adjustmentAnalysis.byReason.FOUND).toBe(1);
      expect(adjustmentAnalysis.netAdjustment).toBe(-7); // -5 -3 +2 -1
    });
  });

  describe('Pending Transaction Reconciliation', () => {
    it('should handle pending vs completed transactions correctly', async () => {
      const skuId = testSkuIds[1];
      const batchId = testBatchIds[1];

      // Create mix of pending and completed transactions
      await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 100,
          transactionDate: new Date(),
          referenceNumber: 'PEND-1',
          status: 'COMPLETED',
          userId: testUserId,
        },
      });

      await prisma.inventory_transactions.create({
        data: {
          type: 'SHIPMENT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 30,
          transactionDate: new Date(),
          referenceNumber: 'PEND-2',
          status: 'PENDING',
          userId: testUserId,
        },
      });

      await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 50,
          transactionDate: new Date(),
          referenceNumber: 'PEND-3',
          status: 'PENDING',
          userId: testUserId,
        },
      });

      // Reconcile only completed transactions
      const completedBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId,
        undefined,
        { includeStatus: ['COMPLETED'] }
      );

      // Reconcile including pending
      const allBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId,
        undefined,
        { includeStatus: ['COMPLETED', 'PENDING'] }
      );

      expect(completedBalance).toBe(100);
      expect(allBalance).toBe(120); // 100 - 30 + 50
    });
  });

  describe('Batch and Expiry Reconciliation', () => {
    it('should accurately track batch-level inventory', async () => {
      const skuId = testSkuIds[2];

      // Create multiple batches for same SKU
      const batch1 = await prisma.batch.create({
        data: {
          batchNumber: 'MULTI-BATCH-1',
          skuId,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      const batch2 = await prisma.batch.create({
        data: {
          batchNumber: 'MULTI-BATCH-2',
          skuId,
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        },
      });

      try {
        // Create transactions for different batches
        await prisma.inventory_transactions.create({
          data: {
            type: 'RECEIPT',
            skuId,
            warehouseId: testWarehouseId,
            batchId: batch1.id,
            quantity: 100,
            transactionDate: new Date(),
            referenceNumber: 'BATCH-1-REC',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        await prisma.inventory_transactions.create({
          data: {
            type: 'RECEIPT',
            skuId,
            warehouseId: testWarehouseId,
            batchId: batch2.id,
            quantity: 150,
            transactionDate: new Date(),
            referenceNumber: 'BATCH-2-REC',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        // Ship from specific batch (FIFO)
        await prisma.inventory_transactions.create({
          data: {
            type: 'SHIPMENT',
            skuId,
            warehouseId: testWarehouseId,
            batchId: batch1.id,
            quantity: 50,
            transactionDate: new Date(),
            referenceNumber: 'BATCH-1-SHIP',
            status: 'COMPLETED',
            userId: testUserId,
          },
        });

        // Reconcile by batch
        const batch1Balance = await reconciliationService.calculateBalanceFromTransactions(
          skuId,
          testWarehouseId,
          batch1.id
        );
        const batch2Balance = await reconciliationService.calculateBalanceFromTransactions(
          skuId,
          testWarehouseId,
          batch2.id
        );

        expect(batch1Balance).toBe(50);
        expect(batch2Balance).toBe(150);

        // Check near-expiry inventory
        const nearExpiryItems = await reconciliationService.getNearExpiryInventory(
          testWarehouseId,
          45 // Items expiring in 45 days
        );

        expect(nearExpiryItems).toHaveLength(1);
        expect(nearExpiryItems[0].batchId).toBe(batch1.id);
        expect(nearExpiryItems[0].quantity).toBe(50);
      } finally {
        await prisma.batch.deleteMany({
          where: { id: { in: [batch1.id, batch2.id] } },
        });
      }
    });
  });

  describe('Cost and Value Reconciliation', () => {
    it('should accurately calculate inventory value', async () => {
      const skuId = testSkuIds[3];
      const batchId = testBatchIds[3];

      // Create transactions with cost information
      await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 100,
          unitCost: new Decimal(10.50),
          transactionDate: new Date(),
          referenceNumber: 'COST-1',
          status: 'COMPLETED',
          userId: testUserId,
        },
      });

      await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 50,
          unitCost: new Decimal(11.00),
          transactionDate: new Date(),
          referenceNumber: 'COST-2',
          status: 'COMPLETED',
          userId: testUserId,
        },
      });

      await prisma.inventory_transactions.create({
        data: {
          type: 'SHIPMENT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 30,
          unitCost: new Decimal(10.50), // FIFO cost
          transactionDate: new Date(),
          referenceNumber: 'COST-3',
          status: 'COMPLETED',
          userId: testUserId,
        },
      });

      // Calculate weighted average cost
      const inventoryValue = await reconciliationService.calculateInventoryValue(
        skuId,
        testWarehouseId,
        batchId
      );

      expect(inventoryValue.quantity).toBe(120); // 100 + 50 - 30
      expect(inventoryValue.totalValue.toNumber()).toBeCloseTo(1285, 2); // (70 * 10.50) + (50 * 11.00)
      expect(inventoryValue.weightedAverageCost.toNumber()).toBeCloseTo(10.71, 2); // 1285 / 120
    });
  });

  describe('Reconciliation Performance', () => {
    it('should efficiently reconcile large transaction volumes', async () => {
      const skuId = testSkuIds[4];
      const batchId = testBatchIds[4];

      // Create large number of transactions
      const transactionCount = 1000;
      const transactions = [];

      for (let i = 0; i < transactionCount; i++) {
        transactions.push({
          type: i % 3 === 0 ? 'SHIPMENT' : 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: Math.floor(Math.random() * 20) + 1,
          transactionDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          referenceNumber: `PERF-${i}`,
          status: 'COMPLETED',
          userId: testUserId,
        });
      }

      await prisma.inventory_transactions.createMany({
        data: transactions,
      });

      const startTime = Date.now();
      const reconciledBalance = await reconciliationService.calculateBalanceFromTransactions(
        skuId,
        testWarehouseId,
        batchId
      );
      const duration = Date.now() - startTime;

      expect(reconciledBalance).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Verify calculation accuracy
      const expectedBalance = transactions.reduce((acc, tx) => {
        return acc + (tx.type === 'RECEIPT' ? tx.quantity : -tx.quantity);
      }, 0);

      expect(reconciledBalance).toBe(expectedBalance);
    });
  });

  describe('Audit Trail Verification', () => {
    it('should maintain complete audit trail for reconciliation', async () => {
      const skuId = testSkuIds[0];
      const batchId = testBatchIds[0];

      // Create transaction with full audit info
      const transaction = await prisma.inventory_transactions.create({
        data: {
          type: 'RECEIPT',
          skuId,
          warehouseId: testWarehouseId,
          batchId,
          quantity: 100,
          transactionDate: new Date(),
          referenceNumber: 'AUDIT-1',
          status: 'COMPLETED',
          userId: testUserId,
          notes: 'Test audit trail',
          source: 'API',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Client/1.0',
        },
      });

      // Verify audit fields are preserved
      const auditLog = await prisma.inventory_transactions.findUnique({
        where: { id: transaction.id },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(testUserId);
      expect(auditLog?.notes).toBe('Test audit trail');
      expect(auditLog?.source).toBe('API');
      expect(auditLog?.ipAddress).toBe('192.168.1.1');
      expect(auditLog?.userAgent).toBe('Test Client/1.0');
      expect(auditLog?.createdAt).toBeDefined();
    });
  });
});