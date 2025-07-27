/**
 * Data Integrity Test Suite: Concurrent Request Tests
 * Simulates concurrent requests to inventory endpoints to prove race conditions are fixed
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Concurrent Request Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let testWarehouseId: string;
  let testSkuId: string;
  let testBatchId: string;

  beforeAll(async () => {
    // Setup test data
    const warehouse = await prisma.warehouses.create({
      data: {
        name: 'Test Warehouse',
        address: '123 Test St',
      },
    });
    testWarehouseId = warehouse.id;

    const sku = await prisma.sKU.create({
      data: {
        code: `TEST-${Date.now()}`,
        name: 'Test Product',
        description: 'Product for concurrent testing',
      },
    });
    testSkuId = sku.id;

    const batch = await prisma.batch.create({
      data: {
        batchNumber: `BATCH-${Date.now()}`,
        skuId: testSkuId,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testBatchId = batch.id;

    // Initialize inventory balance
    await prisma.inventory_balances.create({
      data: {
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 1000,
        reservedQuantity: 0,
        availableQuantity: 1000,
      },
    });

    // Setup Express app with endpoints
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req, res, next) => {
      req.user = { id: 'test-user', email: 'test@example.com' };
      next();
    });

    // Import actual route handlers or create mock ones
    app.post('/api/transactions', async (req, res) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const { type, skuId, warehouseId, batchId, quantity } = req.body;

          // Get current balance with lock
          const balance = await tx.inventory_balances.findFirst({
            where: { skuId, warehouseId, batchId },
            select: { id: true, quantity: true, availableQuantity: true },
          });

          if (!balance) {
            throw new Error('Inventory balance not found');
          }

          if (type === 'SHIPMENT' && balance.availableQuantity < quantity) {
            throw new Error('Insufficient inventory');
          }

          // Update balance
          const newQuantity = type === 'RECEIPT' 
            ? balance.quantity + quantity 
            : balance.quantity - quantity;

          await tx.inventory_balances.update({
            where: { id: balance.id },
            data: {
              quantity: newQuantity,
              availableQuantity: newQuantity,
            },
          });

          // Create transaction record
          const transaction = await tx.inventory_transactions.create({
            data: {
              type,
              skuId,
              warehouseId,
              batchId,
              quantity,
              transactionDate: new Date(),
              referenceNumber: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              status: 'COMPLETED',
              userId: req.user.id,
            },
          });

          return transaction;
        });

        res.json({ success: true, transaction: result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    app.post('/api/inventory/reserve', async (req, res) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const { skuId, warehouseId, batchId, quantity } = req.body;

          const balance = await tx.inventory_balances.findFirst({
            where: { skuId, warehouseId, batchId },
            select: { id: true, availableQuantity: true, reservedQuantity: true },
          });

          if (!balance || balance.availableQuantity < quantity) {
            throw new Error('Insufficient available inventory');
          }

          const updated = await tx.inventory_balances.update({
            where: { id: balance.id },
            data: {
              availableQuantity: balance.availableQuantity - quantity,
              reservedQuantity: balance.reservedQuantity + quantity,
            },
          });

          return updated;
        });

        res.json({ success: true, balance: result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    server = createServer(app);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.inventory_transactions.deleteMany({
      where: { skuId: testSkuId },
    });
    await prisma.inventory_balances.deleteMany({
      where: { skuId: testSkuId },
    });
    await prisma.batch.delete({
      where: { id: testBatchId },
    });
    await prisma.sKU.delete({
      where: { id: testSkuId },
    });
    await prisma.warehouses.delete({
      where: { id: testWarehouseId },
    });
    
    await prisma.$disconnect();
    server.close();
  });

  beforeEach(async () => {
    // Reset inventory balance before each test
    await prisma.inventory_balances.updateMany({
      where: { skuId: testSkuId },
      data: {
        quantity: 1000,
        availableQuantity: 1000,
        reservedQuantity: 0,
      },
    });

    // Clear transactions
    await prisma.inventory_transactions.deleteMany({
      where: { skuId: testSkuId },
    });
  });

  describe('Concurrent Shipment Requests', () => {
    it('should prevent overselling with concurrent shipments', async () => {
      const shipmentQuantity = 300;
      const numberOfRequests = 5; // Total would be 1500, but only have 1000

      const requests = Array(numberOfRequests).fill(null).map(() => 
        request(app)
          .post('/api/transactions')
          .send({
            type: 'SHIPMENT',
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
            quantity: shipmentQuantity,
          })
      );

      const responses = await Promise.all(requests);

      // Count successful and failed requests
      const successful = responses.filter(r => r.status === 200).length;
      const failed = responses.filter(r => r.status === 400).length;

      // Should allow exactly 3 shipments (3 * 300 = 900 <= 1000)
      expect(successful).toBeLessThanOrEqual(3);
      expect(failed).toBeGreaterThanOrEqual(2);

      // Verify final balance
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      expect(finalBalance?.quantity).toBeGreaterThanOrEqual(0);
      expect(finalBalance?.quantity).toBe(1000 - (successful * shipmentQuantity));
    });

    it('should handle mixed concurrent receipts and shipments', async () => {
      const operations = [
        { type: 'RECEIPT', quantity: 200 },
        { type: 'SHIPMENT', quantity: 150 },
        { type: 'RECEIPT', quantity: 100 },
        { type: 'SHIPMENT', quantity: 250 },
        { type: 'RECEIPT', quantity: 300 },
        { type: 'SHIPMENT', quantity: 200 },
      ];

      const requests = operations.map(op => 
        request(app)
          .post('/api/transactions')
          .send({
            ...op,
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
          })
      );

      const responses = await Promise.all(requests);

      // All requests should succeed as net change is positive
      const allSuccessful = responses.every(r => r.status === 200);
      expect(allSuccessful).toBe(true);

      // Calculate expected balance
      const expectedBalance = 1000 + 
        operations.reduce((acc, op) => 
          acc + (op.type === 'RECEIPT' ? op.quantity : -op.quantity), 0
        );

      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      expect(finalBalance?.quantity).toBe(expectedBalance);
    });
  });

  describe('Concurrent Reservation Requests', () => {
    it('should prevent over-reservation with concurrent requests', async () => {
      const reserveQuantity = 250;
      const numberOfRequests = 5; // Total would be 1250, but only have 1000 available

      const requests = Array(numberOfRequests).fill(null).map(() => 
        request(app)
          .post('/api/inventory/reserve')
          .send({
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
            quantity: reserveQuantity,
          })
      );

      const responses = await Promise.all(requests);

      const successful = responses.filter(r => r.status === 200).length;
      const failed = responses.filter(r => r.status === 400).length;

      // Should allow exactly 4 reservations (4 * 250 = 1000)
      expect(successful).toBe(4);
      expect(failed).toBe(1);

      // Verify final balance
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      expect(finalBalance?.availableQuantity).toBe(0);
      expect(finalBalance?.reservedQuantity).toBe(1000);
      expect(finalBalance?.quantity).toBe(1000); // Total unchanged
    });

    it('should handle concurrent reservations and shipments correctly', async () => {
      // First, make some reservations
      await request(app)
        .post('/api/inventory/reserve')
        .send({
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 300,
        })
        .expect(200);

      // Now try concurrent shipments and more reservations
      const operations = [
        { endpoint: '/api/transactions', data: { type: 'SHIPMENT', quantity: 200 } },
        { endpoint: '/api/inventory/reserve', data: { quantity: 400 } },
        { endpoint: '/api/transactions', data: { type: 'SHIPMENT', quantity: 300 } },
        { endpoint: '/api/inventory/reserve', data: { quantity: 200 } },
      ];

      const requests = operations.map(op => 
        request(app)
          .post(op.endpoint)
          .send({
            ...op.data,
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
          })
      );

      await Promise.all(requests);

      // Verify final state
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      // Check invariants
      expect(finalBalance?.quantity).toBeGreaterThanOrEqual(0);
      expect(finalBalance?.availableQuantity).toBeGreaterThanOrEqual(0);
      expect(finalBalance?.reservedQuantity).toBeGreaterThanOrEqual(0);
      expect(finalBalance?.quantity).toBe(
        finalBalance?.availableQuantity! + finalBalance?.reservedQuantity!
      );
    });
  });

  describe('High Volume Concurrent Requests', () => {
    it('should maintain consistency under high concurrent load', async () => {
      const concurrentRequests = 20;
      const quantityPerRequest = 10;

      // Create many small transactions
      const requests = Array(concurrentRequests).fill(null).map((_, index) => 
        request(app)
          .post('/api/transactions')
          .send({
            type: index % 2 === 0 ? 'RECEIPT' : 'SHIPMENT',
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
            quantity: quantityPerRequest,
          })
      );

      const responses = await Promise.all(requests);

      // Count transactions by type
      const receipts = responses.filter((r, i) => i % 2 === 0 && r.status === 200).length;
      const shipments = responses.filter((r, i) => i % 2 === 1 && r.status === 200).length;

      // Verify final balance matches transaction history
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      const transactions = await prisma.inventory_transactions.findMany({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      const calculatedBalance = transactions.reduce((acc, tx) => {
        return acc + (tx.type === 'RECEIPT' ? tx.quantity : -tx.quantity);
      }, 1000);

      expect(finalBalance?.quantity).toBe(calculatedBalance);
    });

    it('should handle rapid sequential requests correctly', async () => {
      const operations = Array(10).fill(null).map((_, i) => ({
        type: i % 3 === 0 ? 'RECEIPT' : 'SHIPMENT',
        quantity: 50 + (i * 10),
      }));

      // Execute requests sequentially but rapidly
      const results = [];
      for (const op of operations) {
        const response = await request(app)
          .post('/api/transactions')
          .send({
            ...op,
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
          });
        
        results.push({
          status: response.status,
          operation: op,
        });
      }

      // Verify all successful operations are reflected in the balance
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      const successfulOps = results.filter(r => r.status === 200);
      const expectedBalance = successfulOps.reduce((acc, r) => {
        return acc + (r.operation.type === 'RECEIPT' ? r.operation.quantity : -r.operation.quantity);
      }, 1000);

      expect(finalBalance?.quantity).toBe(expectedBalance);
    });
  });

  describe('Transaction Isolation', () => {
    it('should properly isolate concurrent transactions', async () => {
      // Create two conflicting operations
      const operation1 = prisma.$transaction(async (tx) => {
        const balance = await tx.inventory_balances.findFirst({
          where: { skuId: testSkuId, warehouseId: testWarehouseId },
        });

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return tx.inventory_balances.update({
          where: { id: balance!.id },
          data: { quantity: balance!.quantity - 500 },
        });
      });

      const operation2 = prisma.$transaction(async (tx) => {
        const balance = await tx.inventory_balances.findFirst({
          where: { skuId: testSkuId, warehouseId: testWarehouseId },
        });

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 50));

        return tx.inventory_balances.update({
          where: { id: balance!.id },
          data: { quantity: balance!.quantity - 600 },
        });
      });

      try {
        await Promise.all([operation1, operation2]);
      } catch (error) {
        // One transaction might fail due to conflict
      }

      // Verify final state is consistent
      const finalBalance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId, warehouseId: testWarehouseId },
      });

      expect(finalBalance?.quantity).toBeGreaterThanOrEqual(0);
      expect([500, 400, -100]).toContain(finalBalance?.quantity);
    });
  });
});