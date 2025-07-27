/**
 * Data Integrity Test Suite: Transaction Validation Tests
 * Tests transaction date validation and data integrity rules
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { z } from 'zod';

const prisma = new PrismaClient();

// Transaction validation schema
const transactionSchema = z.object({
  type: z.enum(['RECEIPT', 'SHIPMENT', 'ADJUSTMENT', 'TRANSFER']),
  skuId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  transactionDate: z.string().datetime().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

describe('Transaction Validation Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let testWarehouseId: string;
  let testSkuId: string;
  let testBatchId: string;

  beforeAll(async () => {
    // Setup test data
    const warehouse = await prisma.warehouses.create({
      data: {
        name: 'Validation Test Warehouse',
        address: '789 Validation St',
      },
    });
    testWarehouseId = warehouse.id;

    const sku = await prisma.sKU.create({
      data: {
        code: `VAL-TEST-${Date.now()}`,
        name: 'Validation Test Product',
        description: 'Product for validation testing',
      },
    });
    testSkuId = sku.id;

    const batch = await prisma.batch.create({
      data: {
        batchNumber: `VAL-BATCH-${Date.now()}`,
        skuId: testSkuId,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    testBatchId = batch.id;

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

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req, res, next) => {
      req.user = { id: 'test-user', email: 'test@example.com' };
      next();
    });

    // Transaction validation middleware
    const validateTransaction = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const validatedData = transactionSchema.parse(req.body);
        req.body = validatedData;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        next(error);
      }
    };

    // Business rule validation
    const validateBusinessRules = async (req: any, res: express.Response, next: express.NextFunction) => {
      const { type, transactionDate, quantity, skuId, warehouseId, batchId } = req.body;

      // Validate transaction date
      if (transactionDate) {
        const txDate = new Date(transactionDate);
        const now = new Date();
        const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future
        const pastLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days in past

        if (txDate > futureLimit) {
          return res.status(400).json({
            error: 'Transaction date cannot be more than 1 day in the future',
          });
        }

        if (txDate < pastLimit) {
          return res.status(400).json({
            error: 'Transaction date cannot be more than 90 days in the past',
          });
        }
      }

      // Validate quantity limits
      if (quantity > 10000) {
        return res.status(400).json({
          error: 'Transaction quantity cannot exceed 10,000 units',
        });
      }

      // Validate SKU exists and is active
      const sku = await prisma.sKU.findUnique({
        where: { id: skuId },
      });

      if (!sku) {
        return res.status(400).json({
          error: 'SKU not found',
        });
      }

      // Validate warehouse exists
      const warehouse = await prisma.warehouses.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        return res.status(400).json({
          error: 'Warehouse not found',
        });
      }

      // Validate batch if provided
      if (batchId) {
        const batch = await prisma.batch.findUnique({
          where: { id: batchId },
        });

        if (!batch) {
          return res.status(400).json({
            error: 'Batch not found',
          });
        }

        if (batch.skuId !== skuId) {
          return res.status(400).json({
            error: 'Batch does not belong to the specified SKU',
          });
        }

        // Check batch expiry
        if (batch.expiryDate && batch.expiryDate < new Date()) {
          return res.status(400).json({
            error: 'Cannot transact with expired batch',
          });
        }
      }

      next();
    };

    // Transaction endpoint
    app.post('/api/transactions', validateTransaction, validateBusinessRules, async (req, res) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const { type, skuId, warehouseId, batchId, quantity, transactionDate, referenceNumber, notes } = req.body;

          // Get current balance
          const balance = await tx.inventory_balances.findFirst({
            where: { skuId, warehouseId, batchId },
          });

          if (!balance && type !== 'RECEIPT') {
            throw new Error('No inventory balance found for shipment/adjustment');
          }

          if (type === 'SHIPMENT' && balance && balance.availableQuantity < quantity) {
            throw new Error('Insufficient available inventory');
          }

          // Update balance
          if (balance) {
            const newQuantity = type === 'RECEIPT' 
              ? balance.quantity + quantity 
              : balance.quantity - quantity;

            if (newQuantity < 0) {
              throw new Error('Transaction would result in negative inventory');
            }

            await tx.inventory_balances.update({
              where: { id: balance.id },
              data: {
                quantity: newQuantity,
                availableQuantity: newQuantity - balance.reservedQuantity,
              },
            });
          } else if (type === 'RECEIPT') {
            // Create new balance for receipt
            await tx.inventory_balances.create({
              data: {
                skuId,
                warehouseId,
                batchId,
                quantity,
                availableQuantity: quantity,
                reservedQuantity: 0,
              },
            });
          }

          // Create transaction record
          const transaction = await tx.inventory_transactions.create({
            data: {
              type,
              skuId,
              warehouseId,
              batchId,
              quantity,
              transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
              referenceNumber: referenceNumber || `TXN-${Date.now()}`,
              notes,
              status: 'COMPLETED',
              userId: req.user.id,
            },
          });

          return transaction;
        });

        res.json({ success: true, transaction: result });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Reconciliation endpoint
    app.post('/api/reconciliation', async (req, res) => {
      try {
        const { warehouseId, skuId } = req.body;

        // Calculate balance from transactions
        const transactions = await prisma.inventory_transactions.findMany({
          where: {
            warehouseId,
            skuId,
            status: 'COMPLETED',
          },
          orderBy: { transactionDate: 'asc' },
        });

        const calculatedBalance = transactions.reduce((acc, tx) => {
          return acc + (tx.type === 'RECEIPT' ? tx.quantity : -tx.quantity);
        }, 0);

        // Get current balance
        const currentBalance = await prisma.inventory_balances.findFirst({
          where: { warehouseId, skuId },
        });

        const discrepancy = currentBalance ? currentBalance.quantity - calculatedBalance : -calculatedBalance;

        res.json({
          currentBalance: currentBalance?.quantity || 0,
          calculatedBalance,
          discrepancy,
          isReconciled: discrepancy === 0,
          transactionCount: transactions.length,
        });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    server = createServer(app);
  });

  afterAll(async () => {
    // Cleanup
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
    // Reset inventory
    await prisma.inventory_balances.updateMany({
      where: { skuId: testSkuId },
      data: {
        quantity: 1000,
        availableQuantity: 1000,
        reservedQuantity: 0,
      },
    });

    await prisma.inventory_transactions.deleteMany({
      where: { skuId: testSkuId },
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid transaction types', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'INVALID_TYPE',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].message).toMatch(/Invalid enum value/);
    });

    it('should reject negative quantities', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          quantity: -100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].message).toMatch(/positive/);
    });

    it('should reject invalid UUIDs', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: 'invalid-uuid',
          warehouseId: testWarehouseId,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].message).toMatch(/Invalid uuid/);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          // Missing skuId
          warehouseId: testWarehouseId,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].path).toContain('skuId');
    });
  });

  describe('Transaction Date Validation', () => {
    it('should reject future dates beyond 1 day', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          quantity: 100,
          transactionDate: futureDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot be more than 1 day in the future/);
    });

    it('should reject dates older than 90 days', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 91);

      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          quantity: 100,
          transactionDate: pastDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot be more than 90 days in the past/);
    });

    it('should accept valid transaction dates', async () => {
      const validDates = [
        new Date(), // Now
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours in future
      ];

      for (const date of validDates) {
        const response = await request(app)
          .post('/api/transactions')
          .send({
            type: 'RECEIPT',
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
            quantity: 10,
            transactionDate: date.toISOString(),
          });

        expect(response.status).toBe(200);
      }
    });

    it('should default to current date if not provided', async () => {
      const beforeTime = new Date();
      
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 100,
        });

      const afterTime = new Date();

      expect(response.status).toBe(200);
      const txDate = new Date(response.body.transaction.transactionDate);
      expect(txDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(txDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Business Rule Validation', () => {
    it('should reject quantities exceeding 10,000', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          quantity: 10001,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot exceed 10,000 units/);
    });

    it('should reject non-existent SKUs', async () => {
      const fakeSku = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: fakeSku,
          warehouseId: testWarehouseId,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('SKU not found');
    });

    it('should reject non-existent warehouses', async () => {
      const fakeWarehouse = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: fakeWarehouse,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Warehouse not found');
    });

    it('should reject batch not belonging to SKU', async () => {
      // Create another SKU and batch
      const anotherSku = await prisma.sKU.create({
        data: {
          code: `ANOTHER-${Date.now()}`,
          name: 'Another Product',
        },
      });

      const anotherBatch = await prisma.batch.create({
        data: {
          batchNumber: `ANOTHER-BATCH-${Date.now()}`,
          skuId: anotherSku.id,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: anotherBatch.id,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Batch does not belong to the specified SKU');

      // Cleanup
      await prisma.batch.delete({ where: { id: anotherBatch.id } });
      await prisma.sKU.delete({ where: { id: anotherSku.id } });
    });

    it('should reject transactions with expired batches', async () => {
      // Create expired batch
      const expiredBatch = await prisma.batch.create({
        data: {
          batchNumber: `EXPIRED-${Date.now()}`,
          skuId: testSkuId,
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      });

      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'SHIPMENT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: expiredBatch.id,
          quantity: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot transact with expired batch');

      // Cleanup
      await prisma.batch.delete({ where: { id: expiredBatch.id } });
    });
  });

  describe('Inventory Integrity', () => {
    it('should prevent negative inventory', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          type: 'SHIPMENT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 1500, // More than available (1000)
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/insufficient available inventory/i);

      // Verify inventory unchanged
      const balance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId },
      });
      expect(balance?.quantity).toBe(1000);
    });

    it('should handle sequential transactions correctly', async () => {
      // Receipt
      await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 500,
        })
        .expect(200);

      // Shipment
      await request(app)
        .post('/api/transactions')
        .send({
          type: 'SHIPMENT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 800,
        })
        .expect(200);

      // Verify final balance
      const balance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId },
      });
      expect(balance?.quantity).toBe(700); // 1000 + 500 - 800
    });
  });

  describe('Reconciliation Accuracy', () => {
    it('should accurately reconcile transaction history', async () => {
      // Create several transactions
      const transactions = [
        { type: 'RECEIPT', quantity: 200 },
        { type: 'SHIPMENT', quantity: 150 },
        { type: 'RECEIPT', quantity: 300 },
        { type: 'SHIPMENT', quantity: 250 },
        { type: 'ADJUSTMENT', quantity: -50 },
      ];

      for (const tx of transactions) {
        await request(app)
          .post('/api/transactions')
          .send({
            ...tx,
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
          })
          .expect(200);
      }

      // Reconcile
      const response = await request(app)
        .post('/api/reconciliation')
        .send({
          warehouseId: testWarehouseId,
          skuId: testSkuId,
        });

      expect(response.status).toBe(200);
      expect(response.body.isReconciled).toBe(true);
      expect(response.body.discrepancy).toBe(0);
      expect(response.body.transactionCount).toBe(5);

      // Calculate expected balance
      const expectedBalance = 1000 + // Initial
        transactions.reduce((acc, tx) => 
          acc + (tx.type === 'RECEIPT' ? tx.quantity : -tx.quantity), 0
        );

      expect(response.body.currentBalance).toBe(expectedBalance);
      expect(response.body.calculatedBalance).toBe(expectedBalance);
    });

    it('should detect discrepancies in inventory', async () => {
      // Create transactions
      await request(app)
        .post('/api/transactions')
        .send({
          type: 'RECEIPT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 500,
        });

      // Manually corrupt the balance
      await prisma.inventory_balances.updateMany({
        where: { skuId: testSkuId },
        data: { quantity: 1400 }, // Should be 1500
      });

      // Reconcile
      const response = await request(app)
        .post('/api/reconciliation')
        .send({
          warehouseId: testWarehouseId,
          skuId: testSkuId,
        });

      expect(response.status).toBe(200);
      expect(response.body.isReconciled).toBe(false);
      expect(response.body.discrepancy).toBe(-100); // 1400 - 1500
      expect(response.body.currentBalance).toBe(1400);
      expect(response.body.calculatedBalance).toBe(1500);
    });
  });
});