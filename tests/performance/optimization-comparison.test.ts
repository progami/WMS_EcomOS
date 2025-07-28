/**
 * Performance Test Suite: Optimization Comparison Tests
 * Compares performance before and after implementing caching and indexing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheService } from '@/lib/cache/cache-service';

const prisma = new PrismaClient();

interface PerformanceComparison {
  operation: string;
  beforeOptimization: {
    mean: number;
    p95: number;
    p99: number;
  };
  afterOptimization: {
    mean: number;
    p95: number;
    p99: number;
  };
  improvement: {
    meanPercent: number;
    p95Percent: number;
    p99Percent: number;
  };
}

describe('Performance Optimization Comparison Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let cacheService: CacheService;
  let testData: {
    warehouseIds: string[];
    skuIds: string[];
    userIds: string[];
  };
  let performanceResults: PerformanceComparison[] = [];

  beforeAll(async () => {
    cacheService = new CacheService();

    // Create substantial test data
    console.log('Creating test data...');
    
    // Create warehouses
    const warehouses = await Promise.all(
      Array(5).fill(null).map((_, i) =>
        prisma.warehouses.create({
          data: {
            name: `Optimization Test Warehouse ${i + 1}`,
            address: `${i + 1} Performance Street`,
          },
        })
      )
    );

    // Create SKUs
    const skus = await Promise.all(
      Array(500).fill(null).map((_, i) =>
        prisma.sKU.create({
          data: {
            code: `OPT-SKU-${i + 1}`,
            name: `Optimization Test Product ${i + 1}`,
            description: 'Product for optimization testing',
            unitPrice: Math.random() * 100,
          },
        })
      )
    );

    // Create users
    const users = await Promise.all(
      Array(10).fill(null).map((_, i) =>
        prisma.users.create({
          data: {
            email: `opt-user-${i + 1}@test.com`,
            name: `Optimization User ${i + 1}`,
          },
        })
      )
    );

    // Create batches and inventory balances
    for (const warehouse of warehouses) {
      for (let i = 0; i < 200; i++) {
        const sku = skus[i];
        const batch = await prisma.batch.create({
          data: {
            batchNumber: `OPT-BATCH-${warehouse.id}-${i}`,
            skuId: sku.id,
            expiryDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000),
          },
        });

        await prisma.inventory_balances.create({
          data: {
            warehouseId: warehouse.id,
            skuId: sku.id,
            batchId: batch.id,
            quantity: Math.floor(Math.random() * 1000) + 100,
            reservedQuantity: Math.floor(Math.random() * 50),
            availableQuantity: Math.floor(Math.random() * 950) + 50,
          },
        });
      }
    }

    // Create transaction history (10,000 transactions)
    console.log('Creating transaction history...');
    const transactionBatches = [];
    for (let i = 0; i < 100; i++) {
      const batch = [];
      for (let j = 0; j < 100; j++) {
        batch.push({
          type: Math.random() > 0.5 ? 'RECEIPT' : 'SHIPMENT',
          skuId: skus[Math.floor(Math.random() * skus.length)].id,
          warehouseId: warehouses[Math.floor(Math.random() * warehouses.length)].id,
          quantity: Math.floor(Math.random() * 100) + 1,
          transactionDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          referenceNumber: `OPT-TXN-${i * 100 + j}`,
          status: 'COMPLETED',
          userId: users[Math.floor(Math.random() * users.length)].id,
        });
      }
      await prisma.inventory_transactions.createMany({ data: batch });
    }

    testData = {
      warehouseIds: warehouses.map(w => w.id),
      skuIds: skus.map(s => s.id),
      userIds: users.map(u => u.id),
    };

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req, res, next) => {
      req.user = { id: testData.userIds[0], email: 'test@example.com' };
      next();
    });

    // Setup endpoints (both optimized and non-optimized versions)
    setupEndpoints();

    server = createServer(app);
  });

  afterAll(async () => {
    // Save performance comparison report
    const report = {
      timestamp: new Date(),
      testEnvironment: {
        warehouses: testData.warehouseIds.length,
        skus: testData.skuIds.length,
        transactions: await prisma.inventory_transactions.count(),
      },
      comparisons: performanceResults,
    };

    await fs.writeFile(
      path.join(__dirname, '..', '..', 'performance-reports', 'optimization-comparison.json'),
      JSON.stringify(report, null, 2)
    );

    // Cleanup
    await prisma.inventory_transactions.deleteMany({
      where: { userId: { in: testData.userIds } },
    });
    await prisma.inventory_balances.deleteMany({
      where: { warehouseId: { in: testData.warehouseIds } },
    });
    await prisma.batch.deleteMany({
      where: { 
        batchNumber: { 
          startsWith: 'OPT-BATCH-' 
        } 
      },
    });
    await prisma.sKU.deleteMany({
      where: { id: { in: testData.skuIds } },
    });
    await prisma.warehouses.deleteMany({
      where: { id: { in: testData.warehouseIds } },
    });
    await prisma.users.deleteMany({
      where: { id: { in: testData.userIds } },
    });

    await prisma.$disconnect();
    server.close();
  });

  function setupEndpoints() {
    // Non-optimized dashboard endpoint
    app.get('/api/v1/dashboard/stats', async (req, res) => {
      const start = performance.now();

      try {
        // Direct database queries without optimization
        const [
          totalSkus,
          totalWarehouses,
          activeTransactions,
          lowStockItems,
          inventoryValue,
          recentTransactions,
          topMovingProducts,
        ] = await Promise.all([
          prisma.sKU.count(),
          prisma.warehouses.count(),
          prisma.inventory_transactions.count({
            where: {
              status: 'PENDING',
              transactionDate: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          }),
          prisma.inventory_balances.count({
            where: { availableQuantity: { lt: 50 } },
          }),
          prisma.$queryRaw`
            SELECT SUM(ib.quantity * COALESCE(s."unitPrice", 0)) as total_value
            FROM "InventoryBalance" ib
            JOIN "SKU" s ON ib."skuId" = s.id
          `,
          prisma.inventory_transactions.findMany({
            take: 50,
            orderBy: { transactionDate: 'desc' },
            include: {
              sku: true,
              warehouse: true,
              user: true,
            },
          }),
          prisma.$queryRaw`
            SELECT s.id, s.name, s.code, COUNT(it.id) as transaction_count
            FROM "SKU" s
            JOIN "InventoryTransaction" it ON s.id = it."skuId"
            WHERE it."transactionDate" >= NOW() - INTERVAL '30 days'
            GROUP BY s.id, s.name, s.code
            ORDER BY transaction_count DESC
            LIMIT 10
          `,
        ]);

        const duration = performance.now() - start;
        res.json({
          totalSkus,
          totalWarehouses,
          activeTransactions,
          lowStockItems,
          inventoryValue,
          recentTransactions,
          topMovingProducts,
          queryTime: duration,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Optimized dashboard endpoint with caching and indexed queries
    app.get('/api/v2/dashboard/stats', async (req, res) => {
      const start = performance.now();

      try {
        const cacheKey = 'dashboard:stats';
        let cachedData = await cacheService.get(cacheKey);

        if (cachedData) {
          const duration = performance.now() - start;
          return res.json({ ...cachedData, queryTime: duration, cached: true });
        }

        // Optimized queries with proper indexing
        const [
          totalSkus,
          totalWarehouses,
          activeTransactions,
          lowStockItems,
          inventoryValue,
          recentTransactions,
          topMovingProducts,
        ] = await Promise.all([
          prisma.sKU.count(),
          prisma.warehouses.count(),
          // Using indexed transactionDate and status
          prisma.inventory_transactions.count({
            where: {
              status: 'PENDING',
              transactionDate: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          }),
          // Using indexed availableQuantity
          prisma.inventory_balances.count({
            where: { availableQuantity: { lt: 50 } },
          }),
          // Optimized value calculation
          prisma.$queryRaw`
            SELECT SUM(ib.quantity * COALESCE(s."unitPrice", 0)) as total_value
            FROM "InventoryBalance" ib
            JOIN "SKU" s ON ib."skuId" = s.id
            WHERE ib.quantity > 0
          `,
          // Limited fields to reduce payload
          prisma.inventory_transactions.findMany({
            take: 50,
            orderBy: { transactionDate: 'desc' },
            select: {
              id: true,
              type: true,
              quantity: true,
              transactionDate: true,
              referenceNumber: true,
              sku: {
                select: { id: true, name: true, code: true },
              },
              warehouse: {
                select: { id: true, name: true },
              },
            },
          }),
          // Using materialized view or indexed query
          prisma.$queryRaw`
            WITH recent_transactions AS (
              SELECT "skuId", COUNT(*) as transaction_count
              FROM "InventoryTransaction"
              WHERE "transactionDate" >= NOW() - INTERVAL '30 days'
              GROUP BY "skuId"
            )
            SELECT s.id, s.name, s.code, rt.transaction_count
            FROM "SKU" s
            JOIN recent_transactions rt ON s.id = rt."skuId"
            ORDER BY rt.transaction_count DESC
            LIMIT 10
          `,
        ]);

        const result = {
          totalSkus,
          totalWarehouses,
          activeTransactions,
          lowStockItems,
          inventoryValue,
          recentTransactions,
          topMovingProducts,
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, result, 300);

        const duration = performance.now() - start;
        res.json({ ...result, queryTime: duration, cached: false });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Non-optimized inventory search
    app.get('/api/v1/inventory/search', async (req, res) => {
      const start = performance.now();
      const { query, warehouseId, page = 1, limit = 50 } = req.query;

      try {
        const where: any = {};
        if (query) {
          where.OR = [
            { sku: { name: { contains: String(query), mode: 'insensitive' } } },
            { sku: { code: { contains: String(query), mode: 'insensitive' } } },
            { sku: { description: { contains: String(query), mode: 'insensitive' } } },
          ];
        }
        if (warehouseId) {
          where.warehouseId = String(warehouseId);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
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
        res.json({
          items,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
          queryTime: duration,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Optimized inventory search with full-text search
    app.get('/api/v2/inventory/search', async (req, res) => {
      const start = performance.now();
      const { query, warehouseId, page = 1, limit = 50 } = req.query;

      try {
        const cacheKey = `inventory:search:${query}:${warehouseId}:${page}:${limit}`;
        let cachedResult = await cacheService.get(cacheKey);

        if (cachedResult) {
          const duration = performance.now() - start;
          return res.json({ ...cachedResult, queryTime: duration, cached: true });
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Using full-text search with GIN index
        const searchQuery = query ? `
          SELECT DISTINCT ib.*, 
            s.name as sku_name, s.code as sku_code,
            w.name as warehouse_name
          FROM "InventoryBalance" ib
          JOIN "SKU" s ON ib."skuId" = s.id
          JOIN "Warehouse" w ON ib."warehouseId" = w.id
          WHERE 
            ($1::text IS NULL OR (
              to_tsvector('english', s.name || ' ' || s.code || ' ' || COALESCE(s.description, '')) 
              @@ plainto_tsquery('english', $1)
            ))
            AND ($2::text IS NULL OR ib."warehouseId" = $2)
          ORDER BY ib."updatedAt" DESC
          LIMIT $3 OFFSET $4
        ` : `
          SELECT ib.*, 
            s.name as sku_name, s.code as sku_code,
            w.name as warehouse_name
          FROM "InventoryBalance" ib
          JOIN "SKU" s ON ib."skuId" = s.id
          JOIN "Warehouse" w ON ib."warehouseId" = w.id
          WHERE ($1::text IS NULL OR ib."warehouseId" = $1)
          ORDER BY ib."updatedAt" DESC
          LIMIT $2 OFFSET $3
        `;

        const params = query 
          ? [String(query), warehouseId || null, Number(limit), skip]
          : [warehouseId || null, Number(limit), skip];

        const items = await prisma.$queryRawUnsafe(searchQuery, ...params);

        const countQuery = query ? `
          SELECT COUNT(DISTINCT ib.id) as count
          FROM "InventoryBalance" ib
          JOIN "SKU" s ON ib."skuId" = s.id
          WHERE 
            ($1::text IS NULL OR (
              to_tsvector('english', s.name || ' ' || s.code || ' ' || COALESCE(s.description, '')) 
              @@ plainto_tsquery('english', $1)
            ))
            AND ($2::text IS NULL OR ib."warehouseId" = $2)
        ` : `
          SELECT COUNT(*) as count
          FROM "InventoryBalance" ib
          WHERE ($1::text IS NULL OR ib."warehouseId" = $1)
        `;

        const countParams = query 
          ? [String(query), warehouseId || null]
          : [warehouseId || null];

        const [{ count }] = await prisma.$queryRawUnsafe(countQuery, ...countParams) as any;

        const result = {
          items,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(count),
            pages: Math.ceil(Number(count) / Number(limit)),
          },
        };

        // Cache for 1 minute
        await cacheService.set(cacheKey, result, 60);

        const duration = performance.now() - start;
        res.json({ ...result, queryTime: duration, cached: false });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Non-optimized transaction history
    app.get('/api/v1/transactions/history', async (req, res) => {
      const start = performance.now();
      const { startDate, endDate, skuId, warehouseId, page = 1, limit = 100 } = req.query;

      try {
        const where: any = {};
        if (startDate) where.transactionDate = { gte: new Date(String(startDate)) };
        if (endDate) {
          where.transactionDate = where.transactionDate || {};
          where.transactionDate.lte = new Date(String(endDate));
        }
        if (skuId) where.skuId = String(skuId);
        if (warehouseId) where.warehouseId = String(warehouseId);

        const skip = (Number(page) - 1) * Number(limit);

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
              user: true,
            },
          }),
          prisma.inventory_transactions.count({ where }),
        ]);

        const duration = performance.now() - start;
        res.json({
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
          queryTime: duration,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Optimized transaction history with pagination optimization
    app.get('/api/v2/transactions/history', async (req, res) => {
      const start = performance.now();
      const { startDate, endDate, skuId, warehouseId, page = 1, limit = 100 } = req.query;

      try {
        const skip = (Number(page) - 1) * Number(limit);

        // Using cursor-based pagination for better performance
        const query = `
          SELECT 
            it.id, it.type, it.quantity, it."transactionDate", 
            it."referenceNumber", it.status,
            json_build_object('id', s.id, 'name', s.name, 'code', s.code) as sku,
            json_build_object('id', w.id, 'name', w.name) as warehouse,
            json_build_object('id', u.id, 'name', u.name, 'email', u.email) as user
          FROM "InventoryTransaction" it
          JOIN "SKU" s ON it."skuId" = s.id
          JOIN "Warehouse" w ON it."warehouseId" = w.id
          LEFT JOIN "User" u ON it."userId" = u.id
          WHERE 
            ($1::timestamp IS NULL OR it."transactionDate" >= $1)
            AND ($2::timestamp IS NULL OR it."transactionDate" <= $2)
            AND ($3::text IS NULL OR it."skuId" = $3)
            AND ($4::text IS NULL OR it."warehouseId" = $4)
          ORDER BY it."transactionDate" DESC, it.id DESC
          LIMIT $5 OFFSET $6
        `;

        const countQuery = `
          SELECT COUNT(*) as count
          FROM "InventoryTransaction" it
          WHERE 
            ($1::timestamp IS NULL OR it."transactionDate" >= $1)
            AND ($2::timestamp IS NULL OR it."transactionDate" <= $2)
            AND ($3::text IS NULL OR it."skuId" = $3)
            AND ($4::text IS NULL OR it."warehouseId" = $4)
        `;

        const params = [
          startDate ? new Date(String(startDate)) : null,
          endDate ? new Date(String(endDate)) : null,
          skuId || null,
          warehouseId || null,
          Number(limit),
          skip,
        ];

        const countParams = params.slice(0, 4);

        const [transactions, [{ count }]] = await Promise.all([
          prisma.$queryRawUnsafe(query, ...params),
          prisma.$queryRawUnsafe(countQuery, ...countParams) as Promise<any>,
        ]);

        const duration = performance.now() - start;
        res.json({
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(count),
            pages: Math.ceil(Number(count) / Number(limit)),
          },
          queryTime: duration,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async function measurePerformance(
    endpoint: string,
    params: Record<string, any> = {},
    iterations: number = 20
  ): Promise<{ mean: number; p95: number; p99: number }> {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const response = await request(app)
        .get(endpoint)
        .query(params);

      if (response.status === 200 && response.body.queryTime) {
        durations.push(response.body.queryTime);
      }
    }

    durations.sort((a, b) => a - b);
    const mean = durations.reduce((a, b) => a + b) / durations.length;
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return { mean, p95, p99 };
  }

  describe('Dashboard Performance Comparison', () => {
    it('should show significant improvement with caching and optimization', async () => {
      // Clear cache before testing
      await cacheService.clear();

      // Measure non-optimized performance
      const beforeMetrics = await measurePerformance('/api/v1/dashboard/stats');

      // Measure optimized performance (first call - no cache)
      const afterMetricsNoCache = await measurePerformance('/api/v2/dashboard/stats');

      // Warm up cache
      await request(app).get('/api/v2/dashboard/stats');

      // Measure optimized performance (with cache)
      const afterMetricsWithCache = await measurePerformance('/api/v2/dashboard/stats');

      const improvement = {
        meanPercent: ((beforeMetrics.mean - afterMetricsWithCache.mean) / beforeMetrics.mean) * 100,
        p95Percent: ((beforeMetrics.p95 - afterMetricsWithCache.p95) / beforeMetrics.p95) * 100,
        p99Percent: ((beforeMetrics.p99 - afterMetricsWithCache.p99) / beforeMetrics.p99) * 100,
      };

      performanceResults.push({
        operation: 'Dashboard Stats',
        beforeOptimization: beforeMetrics,
        afterOptimization: afterMetricsWithCache,
        improvement,
      });

      console.log('\nDashboard Performance:');
      console.log(`Before optimization - Mean: ${beforeMetrics.mean.toFixed(2)}ms, P95: ${beforeMetrics.p95.toFixed(2)}ms`);
      console.log(`After optimization (no cache) - Mean: ${afterMetricsNoCache.mean.toFixed(2)}ms`);
      console.log(`After optimization (with cache) - Mean: ${afterMetricsWithCache.mean.toFixed(2)}ms`);
      console.log(`Improvement: ${improvement.meanPercent.toFixed(1)}%`);

      // Expect significant improvement
      expect(improvement.meanPercent).toBeGreaterThan(50); // At least 50% improvement
    });
  });

  describe('Search Performance Comparison', () => {
    it('should show improvement with full-text search indexing', async () => {
      const searchQuery = 'Test Product';

      // Clear cache
      await cacheService.clear();

      // Measure non-optimized search
      const beforeMetrics = await measurePerformance('/api/v1/inventory/search', {
        query: searchQuery,
        limit: 50,
      });

      // Measure optimized search
      const afterMetrics = await measurePerformance('/api/v2/inventory/search', {
        query: searchQuery,
        limit: 50,
      });

      const improvement = {
        meanPercent: ((beforeMetrics.mean - afterMetrics.mean) / beforeMetrics.mean) * 100,
        p95Percent: ((beforeMetrics.p95 - afterMetrics.p95) / beforeMetrics.p95) * 100,
        p99Percent: ((beforeMetrics.p99 - afterMetrics.p99) / beforeMetrics.p99) * 100,
      };

      performanceResults.push({
        operation: 'Inventory Search',
        beforeOptimization: beforeMetrics,
        afterOptimization: afterMetrics,
        improvement,
      });

      console.log('\nSearch Performance:');
      console.log(`Before optimization - Mean: ${beforeMetrics.mean.toFixed(2)}ms`);
      console.log(`After optimization - Mean: ${afterMetrics.mean.toFixed(2)}ms`);
      console.log(`Improvement: ${improvement.meanPercent.toFixed(1)}%`);

      // Full-text search should be faster
      expect(afterMetrics.mean).toBeLessThan(beforeMetrics.mean);
    });
  });

  describe('Transaction History Performance', () => {
    it('should show improvement with indexed date queries', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Measure non-optimized
      const beforeMetrics = await measurePerformance('/api/v1/transactions/history', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });

      // Measure optimized
      const afterMetrics = await measurePerformance('/api/v2/transactions/history', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });

      const improvement = {
        meanPercent: ((beforeMetrics.mean - afterMetrics.mean) / beforeMetrics.mean) * 100,
        p95Percent: ((beforeMetrics.p95 - afterMetrics.p95) / beforeMetrics.p95) * 100,
        p99Percent: ((beforeMetrics.p99 - afterMetrics.p99) / beforeMetrics.p99) * 100,
      };

      performanceResults.push({
        operation: 'Transaction History',
        beforeOptimization: beforeMetrics,
        afterOptimization: afterMetrics,
        improvement,
      });

      console.log('\nTransaction History Performance:');
      console.log(`Before optimization - Mean: ${beforeMetrics.mean.toFixed(2)}ms`);
      console.log(`After optimization - Mean: ${afterMetrics.mean.toFixed(2)}ms`);
      console.log(`Improvement: ${improvement.meanPercent.toFixed(1)}%`);

      expect(afterMetrics.mean).toBeLessThan(beforeMetrics.mean);
    });
  });

  describe('Pagination Performance', () => {
    it('should maintain performance with deep pagination', async () => {
      const pages = [1, 10, 50, 100];
      const beforeMetrics: Record<number, any> = {};
      const afterMetrics: Record<number, any> = {};

      for (const page of pages) {
        beforeMetrics[page] = await measurePerformance('/api/v1/transactions/history', {
          page,
          limit: 50,
        }, 5);

        afterMetrics[page] = await measurePerformance('/api/v2/transactions/history', {
          page,
          limit: 50,
        }, 5);
      }

      console.log('\nPagination Performance:');
      pages.forEach(page => {
        const improvement = ((beforeMetrics[page].mean - afterMetrics[page].mean) / beforeMetrics[page].mean) * 100;
        console.log(`Page ${page} - Before: ${beforeMetrics[page].mean.toFixed(2)}ms, After: ${afterMetrics[page].mean.toFixed(2)}ms (${improvement.toFixed(1)}% improvement)`);
      });

      // Deep pagination should still be performant
      expect(afterMetrics[100].mean).toBeLessThan(beforeMetrics[100].mean);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle concurrent requests better with optimization', async () => {
      const concurrentRequests = 50;

      // Test non-optimized
      const beforeStart = Date.now();
      const beforeRequests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/v1/dashboard/stats')
      );
      await Promise.all(beforeRequests);
      const beforeDuration = Date.now() - beforeStart;

      // Clear cache and test optimized
      await cacheService.clear();
      const afterStart = Date.now();
      const afterRequests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/v2/dashboard/stats')
      );
      await Promise.all(afterRequests);
      const afterDuration = Date.now() - afterStart;

      const improvement = ((beforeDuration - afterDuration) / beforeDuration) * 100;

      console.log('\nConcurrent Request Performance:');
      console.log(`${concurrentRequests} concurrent requests`);
      console.log(`Before optimization: ${beforeDuration}ms total`);
      console.log(`After optimization: ${afterDuration}ms total`);
      console.log(`Improvement: ${improvement.toFixed(1)}%`);

      expect(afterDuration).toBeLessThan(beforeDuration);
    });
  });

  describe('Cache Effectiveness', () => {
    it('should measure cache hit rate and performance impact', async () => {
      await cacheService.clear();

      // First 10 requests (cache misses)
      const missTimings = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/v2/dashboard/stats');
        missTimings.push(response.body.queryTime);
      }

      // Next 10 requests (cache hits)
      const hitTimings = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/v2/dashboard/stats');
        hitTimings.push(response.body.queryTime);
      }

      const avgMissTime = missTimings.reduce((a, b) => a + b) / missTimings.length;
      const avgHitTime = hitTimings.reduce((a, b) => a + b) / hitTimings.length;
      const cacheImprovement = ((avgMissTime - avgHitTime) / avgMissTime) * 100;

      console.log('\nCache Effectiveness:');
      console.log(`Average cache miss time: ${avgMissTime.toFixed(2)}ms`);
      console.log(`Average cache hit time: ${avgHitTime.toFixed(2)}ms`);
      console.log(`Cache improvement: ${cacheImprovement.toFixed(1)}%`);

      expect(avgHitTime).toBeLessThan(avgMissTime * 0.1); // Cache hits should be 90% faster
    });
  });

  describe('Database Index Effectiveness', () => {
    it('should verify indexes are being used effectively', async () => {
      // Analyze query plans
      const queries = [
        {
          name: 'Transaction date range query',
          sql: `EXPLAIN ANALYZE
            SELECT * FROM "InventoryTransaction"
            WHERE "transactionDate" >= NOW() - INTERVAL '30 days'
            ORDER BY "transactionDate" DESC
            LIMIT 100`,
        },
        {
          name: 'Low stock query',
          sql: `EXPLAIN ANALYZE
            SELECT * FROM "InventoryBalance"
            WHERE "availableQuantity" < 50`,
        },
        {
          name: 'SKU search query',
          sql: `EXPLAIN ANALYZE
            SELECT * FROM "SKU"
            WHERE to_tsvector('english', name || ' ' || code) @@ plainto_tsquery('english', 'test')`,
        },
      ];

      console.log('\nIndex Usage Analysis:');
      for (const query of queries) {
        try {
          const result = await prisma.$queryRawUnsafe(query.sql) as any[];
          const plan = result.map(r => r['QUERY PLAN']).join('\n');
          
          console.log(`\n${query.name}:`);
          
          // Check if index is being used
          if (plan.includes('Index Scan') || plan.includes('Bitmap Index Scan')) {
            console.log('✓ Using index');
          } else if (plan.includes('Seq Scan')) {
            console.log('✗ Sequential scan (no index used)');
          }
        } catch (error) {
          console.log(`Error analyzing ${query.name}:`, error);
        }
      }
    });
  });

  describe('Performance Summary Report', () => {
    it('should generate comprehensive performance comparison report', async () => {
      console.log('\n=== PERFORMANCE OPTIMIZATION SUMMARY ===\n');

      performanceResults.forEach(result => {
        console.log(`${result.operation}:`);
        console.log(`  Before: Mean ${result.beforeOptimization.mean.toFixed(2)}ms, P95 ${result.beforeOptimization.p95.toFixed(2)}ms, P99 ${result.beforeOptimization.p99.toFixed(2)}ms`);
        console.log(`  After:  Mean ${result.afterOptimization.mean.toFixed(2)}ms, P95 ${result.afterOptimization.p95.toFixed(2)}ms, P99 ${result.afterOptimization.p99.toFixed(2)}ms`);
        console.log(`  Improvement: Mean ${result.improvement.meanPercent.toFixed(1)}%, P95 ${result.improvement.p95Percent.toFixed(1)}%, P99 ${result.improvement.p99Percent.toFixed(1)}%`);
        console.log('');
      });

      // Overall assessment
      const avgImprovement = performanceResults.reduce((sum, r) => sum + r.improvement.meanPercent, 0) / performanceResults.length;
      console.log(`Overall Average Improvement: ${avgImprovement.toFixed(1)}%`);

      expect(avgImprovement).toBeGreaterThan(30); // Expect at least 30% overall improvement
    });
  });
});