/**
 * Performance Test Suite: Baseline Metrics Tests
 * Establishes baseline performance metrics before optimization
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];

  record(operation: string, duration: number, metadata?: Record<string, any>) {
    this.metrics.push({
      operation,
      duration,
      timestamp: new Date(),
      metadata,
    });
  }

  getMetrics() {
    return this.metrics;
  }

  getStats(operation: string) {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return null;

    const durations = operationMetrics.map(m => m.duration);
    const sorted = durations.sort((a, b) => a - b);

    return {
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      mean: durations.reduce((a, b) => a + b) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  async saveToFile(filename: string) {
    const stats: Record<string, any> = {};
    const operations = [...new Set(this.metrics.map(m => m.operation))];

    for (const op of operations) {
      stats[op] = this.getStats(op);
    }

    const report = {
      timestamp: new Date(),
      totalMetrics: this.metrics.length,
      operations: stats,
      rawMetrics: this.metrics,
    };

    await fs.writeFile(
      path.join(__dirname, '..', '..', 'performance-reports', filename),
      JSON.stringify(report, null, 2)
    );
  }
}

describe('Baseline Performance Metrics', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let tracker: PerformanceTracker;
  let testData: {
    warehouseIds: string[];
    skuIds: string[];
    batchIds: string[];
  };

  beforeAll(async () => {
    tracker = new PerformanceTracker();

    // Create test data
    const warehouses = await Promise.all(
      Array(3).fill(null).map((_, i) => 
        prisma.warehouses.create({
          data: {
            name: `Perf Test Warehouse ${i + 1}`,
            address: `${i + 1} Performance St`,
          },
        })
      )
    );

    const skus = await Promise.all(
      Array(100).fill(null).map((_, i) => 
        prisma.sKU.create({
          data: {
            code: `PERF-SKU-${i + 1}`,
            name: `Performance Test Product ${i + 1}`,
            description: `Product for performance testing`,
          },
        })
      )
    );

    const batches = await Promise.all(
      skus.slice(0, 50).map((sku, i) => 
        prisma.batch.create({
          data: {
            batchNumber: `PERF-BATCH-${i + 1}`,
            skuId: sku.id,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })
      )
    );

    // Create inventory balances
    for (const warehouse of warehouses) {
      for (let i = 0; i < 50; i++) {
        await prisma.inventory_balances.create({
          data: {
            warehouseId: warehouse.id,
            skuId: skus[i].id,
            batchId: batches[i]?.id,
            quantity: Math.floor(Math.random() * 1000) + 100,
            reservedQuantity: 0,
            availableQuantity: Math.floor(Math.random() * 1000) + 100,
          },
        });
      }
    }

    // Create historical transactions
    for (let i = 0; i < 1000; i++) {
      await prisma.inventory_transactions.create({
        data: {
          type: i % 2 === 0 ? 'RECEIPT' : 'SHIPMENT',
          skuId: skus[Math.floor(Math.random() * skus.length)].id,
          warehouseId: warehouses[Math.floor(Math.random() * warehouses.length)].id,
          quantity: Math.floor(Math.random() * 100) + 1,
          transactionDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          referenceNumber: `PERF-TXN-${i + 1}`,
          status: 'COMPLETED',
          userId: 'perf-test-user',
        },
      });
    }

    testData = {
      warehouseIds: warehouses.map(w => w.id),
      skuIds: skus.map(s => s.id),
      batchIds: batches.map(b => b.id),
    };

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req, res, next) => {
      req.user = { id: 'perf-test-user', email: 'perf@test.com' };
      next();
    });

    // API endpoints
    app.get('/api/inventory/balances', async (req, res) => {
      const start = performance.now();

      try {
        const { warehouseId, page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = warehouseId ? { warehouseId: String(warehouseId) } : {};

        const [balances, total] = await Promise.all([
          prisma.inventory_balances.findMany({
            where,
            skip,
            take: Number(limit),
            include: {
              sku: true,
              warehouse: true,
              batch: true,
            },
          }),
          prisma.inventory_balances.count({ where }),
        ]);

        const duration = performance.now() - start;
        tracker.record('inventory_balances_query', duration, { page, limit, total });

        res.json({
          data: balances,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
          queryTime: duration,
        });
      } catch (error: any) {
        const duration = performance.now() - start;
        tracker.record('inventory_balances_error', duration);
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/dashboard/summary', async (req, res) => {
      const start = performance.now();

      try {
        const [
          totalSkus,
          totalWarehouses,
          lowStockItems,
          recentTransactions,
          inventoryValue,
        ] = await Promise.all([
          prisma.sKU.count(),
          prisma.warehouses.count(),
          prisma.inventory_balances.count({
            where: { availableQuantity: { lt: 50 } },
          }),
          prisma.inventory_transactions.findMany({
            take: 10,
            orderBy: { transactionDate: 'desc' },
            include: {
              sku: true,
              warehouse: true,
            },
          }),
          prisma.$queryRaw`
            SELECT SUM(ib.quantity * COALESCE(s."unitPrice", 0)) as total_value
            FROM "InventoryBalance" ib
            JOIN "SKU" s ON ib."skuId" = s.id
          `,
        ]);

        const duration = performance.now() - start;
        tracker.record('dashboard_summary', duration);

        res.json({
          totalSkus,
          totalWarehouses,
          lowStockItems,
          recentTransactions,
          inventoryValue,
          queryTime: duration,
        });
      } catch (error: any) {
        const duration = performance.now() - start;
        tracker.record('dashboard_summary_error', duration);
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/transactions/history', async (req, res) => {
      const start = performance.now();

      try {
        const { skuId, warehouseId, startDate, endDate, page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (skuId) where.skuId = String(skuId);
        if (warehouseId) where.warehouseId = String(warehouseId);
        if (startDate || endDate) {
          where.transactionDate = {};
          if (startDate) where.transactionDate.gte = new Date(String(startDate));
          if (endDate) where.transactionDate.lte = new Date(String(endDate));
        }

        const [transactions, total] = await Promise.all([
          prisma.inventory_transactions.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { transactionDate: 'desc' },
            include: {
              sku: true,
              warehouse: true,
              batch: true,
            },
          }),
          prisma.inventory_transactions.count({ where }),
        ]);

        const duration = performance.now() - start;
        tracker.record('transaction_history_query', duration, { 
          filters: Object.keys(where).length,
          page,
          limit,
          total,
        });

        res.json({
          data: transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
          queryTime: duration,
        });
      } catch (error: any) {
        const duration = performance.now() - start;
        tracker.record('transaction_history_error', duration);
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/transactions/bulk', async (req, res) => {
      const start = performance.now();

      try {
        const { transactions } = req.body;
        
        const results = await prisma.$transaction(async (tx) => {
          const created = [];
          
          for (const transaction of transactions) {
            const balance = await tx.inventory_balances.findFirst({
              where: {
                skuId: transaction.skuId,
                warehouseId: transaction.warehouseId,
              },
            });

            if (!balance) {
              throw new Error(`No balance found for SKU ${transaction.skuId}`);
            }

            const newQuantity = transaction.type === 'RECEIPT'
              ? balance.quantity + transaction.quantity
              : balance.quantity - transaction.quantity;

            await tx.inventory_balances.update({
              where: { id: balance.id },
              data: { quantity: newQuantity, availableQuantity: newQuantity },
            });

            const txRecord = await tx.inventory_transactions.create({
              data: {
                ...transaction,
                transactionDate: new Date(),
                status: 'COMPLETED',
                userId: req.user.id,
              },
            });

            created.push(txRecord);
          }

          return created;
        });

        const duration = performance.now() - start;
        tracker.record('bulk_transaction_create', duration, { count: transactions.length });

        res.json({
          success: true,
          created: results.length,
          processingTime: duration,
        });
      } catch (error: any) {
        const duration = performance.now() - start;
        tracker.record('bulk_transaction_error', duration);
        res.status(400).json({ error: error.message });
      }
    });

    server = createServer(app);

    // Create performance reports directory
    try {
      await fs.mkdir(path.join(__dirname, '..', '..', 'performance-reports'), { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Save performance report
    await tracker.saveToFile('baseline-metrics.json');

    // Cleanup test data
    await prisma.inventory_transactions.deleteMany({
      where: { userId: 'perf-test-user' },
    });
    await prisma.inventory_balances.deleteMany({
      where: { warehouseId: { in: testData.warehouseIds } },
    });
    await prisma.batch.deleteMany({
      where: { id: { in: testData.batchIds } },
    });
    await prisma.sKU.deleteMany({
      where: { id: { in: testData.skuIds } },
    });
    await prisma.warehouses.deleteMany({
      where: { id: { in: testData.warehouseIds } },
    });

    await prisma.$disconnect();
    server.close();
  });

  describe('Query Performance Baseline', () => {
    it('should measure inventory balance query performance', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .get('/api/inventory/balances')
          .query({ page: 1, limit: 50 });

        expect(response.status).toBe(200);
        durations.push(response.body.queryTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      console.log(`Inventory Balance Query - Avg: ${avgDuration.toFixed(2)}ms`);

      // Baseline expectation (adjust based on your system)
      expect(avgDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should measure dashboard summary query performance', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .get('/api/dashboard/summary');

        expect(response.status).toBe(200);
        durations.push(response.body.queryTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      console.log(`Dashboard Summary Query - Avg: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(2000); // Complex query, allow 2 seconds
    });

    it('should measure transaction history query performance', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .get('/api/transactions/history')
          .query({ 
            page: 1, 
            limit: 50,
            warehouseId: testData.warehouseIds[0],
          });

        expect(response.status).toBe(200);
        durations.push(response.body.queryTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      console.log(`Transaction History Query - Avg: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(1500);
    });
  });

  describe('Write Operation Performance', () => {
    it('should measure single transaction performance', async () => {
      const iterations = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const response = await request(app)
          .post('/api/transactions')
          .send({
            type: i % 2 === 0 ? 'RECEIPT' : 'SHIPMENT',
            skuId: testData.skuIds[0],
            warehouseId: testData.warehouseIds[0],
            quantity: 10,
          });

        const duration = performance.now() - start;
        
        if (response.status === 200) {
          durations.push(duration);
          tracker.record('single_transaction_create', duration);
        }
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      console.log(`Single Transaction Create - Avg: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(500);
    });

    it('should measure bulk transaction performance', async () => {
      const bulkSizes = [10, 25, 50];
      
      for (const size of bulkSizes) {
        const transactions = Array(size).fill(null).map((_, i) => ({
          type: i % 2 === 0 ? 'RECEIPT' : 'SHIPMENT',
          skuId: testData.skuIds[i % testData.skuIds.length],
          warehouseId: testData.warehouseIds[0],
          quantity: 5,
          referenceNumber: `BULK-${Date.now()}-${i}`,
        }));

        const response = await request(app)
          .post('/api/transactions/bulk')
          .send({ transactions });

        expect(response.status).toBe(200);
        console.log(`Bulk Transaction (${size} items) - Time: ${response.body.processingTime.toFixed(2)}ms`);
        
        // Performance expectation: should scale linearly
        const timePerTransaction = response.body.processingTime / size;
        expect(timePerTransaction).toBeLessThan(100); // 100ms per transaction max
      }
    });
  });

  describe('Pagination Performance', () => {
    it('should measure performance across different page sizes', async () => {
      const pageSizes = [10, 25, 50, 100];
      
      for (const limit of pageSizes) {
        const response = await request(app)
          .get('/api/inventory/balances')
          .query({ page: 1, limit });

        expect(response.status).toBe(200);
        console.log(`Page Size ${limit} - Query Time: ${response.body.queryTime.toFixed(2)}ms`);
        
        // Larger pages should not drastically increase query time
        expect(response.body.queryTime).toBeLessThan(limit * 20); // 20ms per item max
      }
    });

    it('should measure deep pagination performance', async () => {
      const pages = [1, 5, 10, 20];
      const limit = 50;
      
      for (const page of pages) {
        const response = await request(app)
          .get('/api/transactions/history')
          .query({ page, limit });

        expect(response.status).toBe(200);
        console.log(`Page ${page} - Query Time: ${response.body.queryTime.toFixed(2)}ms`);
        
        // Deep pagination should not significantly degrade performance
        if (page > 1) {
          expect(response.body.queryTime).toBeLessThan(2000);
        }
      }
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle concurrent read requests efficiently', async () => {
      const concurrentRequests = 20;
      const start = performance.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/inventory/balances')
          .query({ page: 1, limit: 25 })
      );

      const responses = await Promise.all(requests);
      const totalDuration = performance.now() - start;

      const allSuccessful = responses.every(r => r.status === 200);
      expect(allSuccessful).toBe(true);

      console.log(`${concurrentRequests} Concurrent Reads - Total: ${totalDuration.toFixed(2)}ms`);
      console.log(`Average per request: ${(totalDuration / concurrentRequests).toFixed(2)}ms`);

      // Should handle concurrent reads efficiently
      expect(totalDuration).toBeLessThan(concurrentRequests * 200); // 200ms per request max
    });

    it('should handle mixed read/write operations', async () => {
      const operations = Array(20).fill(null).map((_, i) => {
        if (i % 4 === 0) {
          // Write operation
          return request(app)
            .post('/api/transactions')
            .send({
              type: 'RECEIPT',
              skuId: testData.skuIds[i % testData.skuIds.length],
              warehouseId: testData.warehouseIds[0],
              quantity: 10,
            });
        } else {
          // Read operation
          return request(app)
            .get('/api/inventory/balances')
            .query({ page: 1, limit: 10 });
        }
      });

      const start = performance.now();
      const responses = await Promise.all(operations);
      const duration = performance.now() - start;

      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(responses.length);

      console.log(`Mixed Operations (20) - Total: ${duration.toFixed(2)}ms`);
      tracker.record('mixed_operations', duration, { count: 20 });
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should track memory usage for large result sets', async () => {
      const memBefore = process.memoryUsage();

      // Query large dataset
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ limit: 500 });

      const memAfter = process.memoryUsage();

      const heapUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
      const externalUsed = (memAfter.external - memBefore.external) / 1024 / 1024;

      console.log(`Memory Usage for 500 transactions:`);
      console.log(`  Heap: ${heapUsed.toFixed(2)} MB`);
      console.log(`  External: ${externalUsed.toFixed(2)} MB`);

      tracker.record('memory_usage_large_query', heapUsed, { 
        recordCount: 500,
        external: externalUsed,
      });

      // Memory usage should be reasonable
      expect(heapUsed).toBeLessThan(50); // Less than 50MB for 500 records
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', async () => {
      // Run a final set of operations to ensure we have good data
      const operations = [
        { name: 'inventory_balances_small', endpoint: '/api/inventory/balances', query: { limit: 10 } },
        { name: 'inventory_balances_large', endpoint: '/api/inventory/balances', query: { limit: 100 } },
        { name: 'dashboard_summary', endpoint: '/api/dashboard/summary' },
        { name: 'transaction_history', endpoint: '/api/transactions/history', query: { limit: 50 } },
      ];

      for (const op of operations) {
        for (let i = 0; i < 5; i++) {
          await request(app)
            .get(op.endpoint)
            .query(op.query || {});
        }
      }

      // Get statistics
      const stats = {
        inventory_balances: tracker.getStats('inventory_balances_query'),
        dashboard_summary: tracker.getStats('dashboard_summary'),
        transaction_history: tracker.getStats('transaction_history_query'),
        single_transaction: tracker.getStats('single_transaction_create'),
        bulk_transaction: tracker.getStats('bulk_transaction_create'),
      };

      console.log('\n=== Performance Baseline Summary ===');
      Object.entries(stats).forEach(([operation, stat]) => {
        if (stat) {
          console.log(`\n${operation}:`);
          console.log(`  Count: ${stat.count}`);
          console.log(`  Min: ${stat.min.toFixed(2)}ms`);
          console.log(`  Max: ${stat.max.toFixed(2)}ms`);
          console.log(`  Mean: ${stat.mean.toFixed(2)}ms`);
          console.log(`  Median: ${stat.median.toFixed(2)}ms`);
          console.log(`  P95: ${stat.p95.toFixed(2)}ms`);
        }
      });

      // Ensure all critical operations have been measured
      expect(stats.inventory_balances).toBeDefined();
      expect(stats.dashboard_summary).toBeDefined();
      expect(stats.transaction_history).toBeDefined();
    });
  });
});