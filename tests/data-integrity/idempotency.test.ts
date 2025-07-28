/**
 * Data Integrity Test Suite: Idempotency Tests
 * Tests idempotency key functionality to prevent duplicate transactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const prisma = new PrismaClient();

describe('Idempotency Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let testWarehouseId: string;
  let testSkuId: string;
  let testBatchId: string;

  beforeAll(async () => {
    // Setup test data
    const warehouse = await prisma.warehouses.create({
      data: {
        name: 'Idempotency Test Warehouse',
        address: '456 Test Ave',
      },
    });
    testWarehouseId = warehouse.id;

    const sku = await prisma.sKU.create({
      data: {
        code: `IDEM-TEST-${Date.now()}`,
        name: 'Idempotency Test Product',
        description: 'Product for idempotency testing',
      },
    });
    testSkuId = sku.id;

    const batch = await prisma.batch.create({
      data: {
        batchNumber: `IDEM-BATCH-${Date.now()}`,
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

    // Idempotency middleware
    const idempotencyMiddleware = async (req: any, res: express.Response, next: express.NextFunction) => {
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
      
      if (idempotencyKey) {
        // Check if we've seen this key before
        const existingRequest = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey as string },
        });

        if (existingRequest) {
          // Return cached response
          return res.status(existingRequest.statusCode).json(existingRequest.response);
        }

        // Store the key for later
        req.idempotencyKey = idempotencyKey;
      }
      
      next();
    };

    // Store response for idempotency
    const storeIdempotentResponse = async (req: any, res: express.Response, statusCode: number, response: any) => {
      if (req.idempotencyKey) {
        await prisma.idempotencyKey.create({
          data: {
            key: req.idempotencyKey,
            requestHash: crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex'),
            response: response as any,
            statusCode,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });
      }
    };

    // Transaction endpoint with idempotency
    app.post('/api/transactions', idempotencyMiddleware, async (req, res) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const { type, skuId, warehouseId, batchId, quantity } = req.body;

          const balance = await tx.inventory_balances.findFirst({
            where: { skuId, warehouseId, batchId },
          });

          if (!balance) {
            throw new Error('Inventory balance not found');
          }

          if (type === 'SHIPMENT' && balance.availableQuantity < quantity) {
            throw new Error('Insufficient inventory');
          }

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
              idempotencyKey: req.idempotencyKey,
            },
          });

          return transaction;
        });

        const response = { success: true, transaction: result };
        await storeIdempotentResponse(req, res, 200, response);
        res.json(response);
      } catch (error: any) {
        const response = { error: error.message };
        await storeIdempotentResponse(req, res, 400, response);
        res.status(400).json(response);
      }
    });

    // Payment endpoint with idempotency
    app.post('/api/payments', idempotencyMiddleware, async (req, res) => {
      try {
        const { amount, orderId, paymentMethod } = req.body;

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 100));

        const payment = {
          id: uuidv4(),
          amount,
          orderId,
          paymentMethod,
          status: 'completed',
          processedAt: new Date(),
        };

        const response = { success: true, payment };
        await storeIdempotentResponse(req, res, 200, response);
        res.json(response);
      } catch (error: any) {
        const response = { error: error.message };
        await storeIdempotentResponse(req, res, 400, response);
        res.status(400).json(response);
      }
    });

    server = createServer(app);

    // Create idempotency key table if it doesn't exist
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          "key" TEXT UNIQUE NOT NULL,
          "requestHash" TEXT NOT NULL,
          "response" JSONB NOT NULL,
          "statusCode" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP(3) NOT NULL
        )
      `;
    } catch (error) {
      // Table might already exist
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$executeRaw`DELETE FROM "IdempotencyKey"`;
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
    // Clear idempotency keys
    await prisma.$executeRaw`DELETE FROM "IdempotencyKey"`;

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

  describe('Basic Idempotency', () => {
    it('should return same response for duplicate requests with same idempotency key', async () => {
      const idempotencyKey = uuidv4();
      const requestBody = {
        type: 'SHIPMENT',
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 100,
      };

      // First request
      const response1 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Duplicate request with same idempotency key
      const response2 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(200);
      expect(response2.body).toEqual(response1.body);

      // Verify only one transaction was created
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(1);

      // Verify inventory was only updated once
      const balance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId },
      });
      expect(balance?.quantity).toBe(900);
    });

    it('should process different requests with different idempotency keys', async () => {
      const key1 = uuidv4();
      const key2 = uuidv4();

      const response1 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', key1)
        .send({
          type: 'SHIPMENT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 100,
        });

      const response2 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', key2)
        .send({
          type: 'SHIPMENT',
          skuId: testSkuId,
          warehouseId: testWarehouseId,
          batchId: testBatchId,
          quantity: 200,
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.transaction.id).not.toBe(response2.body.transaction.id);

      // Verify both transactions were created
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(2);

      // Verify inventory was updated twice
      const balance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId },
      });
      expect(balance?.quantity).toBe(700); // 1000 - 100 - 200
    });
  });

  describe('Error Response Idempotency', () => {
    it('should cache and return error responses', async () => {
      const idempotencyKey = uuidv4();
      const requestBody = {
        type: 'SHIPMENT',
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 2000, // More than available
      };

      // First request should fail
      const response1 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(400);
      expect(response1.body.error).toMatch(/insufficient inventory/i);

      // Duplicate request should return cached error
      const response2 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(400);
      expect(response2.body).toEqual(response1.body);

      // Verify no transactions were created
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(0);
    });
  });

  describe('Concurrent Idempotent Requests', () => {
    it('should handle concurrent requests with same idempotency key', async () => {
      const idempotencyKey = uuidv4();
      const requestBody = {
        type: 'RECEIPT',
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 100,
      };

      // Send multiple concurrent requests with same key
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/transactions')
          .set('Idempotency-Key', idempotencyKey)
          .send(requestBody)
      );

      const responses = await Promise.all(requests);

      // All should return the same response
      const firstResponse = responses[0];
      responses.forEach(response => {
        expect(response.status).toBe(firstResponse.status);
        expect(response.body).toEqual(firstResponse.body);
      });

      // Verify only one transaction was created
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(1);

      // Verify inventory was only updated once
      const balance = await prisma.inventory_balances.findFirst({
        where: { skuId: testSkuId },
      });
      expect(balance?.quantity).toBe(1100); // 1000 + 100
    });
  });

  describe('Idempotency Key Validation', () => {
    it('should accept various idempotency key formats', async () => {
      const keyFormats = [
        uuidv4(),
        crypto.randomBytes(16).toString('hex'),
        `user-123-${Date.now()}`,
        'simple-key-12345',
      ];

      for (const key of keyFormats) {
        const response = await request(app)
          .post('/api/transactions')
          .set('Idempotency-Key', key)
          .send({
            type: 'RECEIPT',
            skuId: testSkuId,
            warehouseId: testWarehouseId,
            batchId: testBatchId,
            quantity: 10,
          });

        expect(response.status).toBe(200);
      }
    });

    it('should handle requests without idempotency keys', async () => {
      // Two identical requests without keys should create two transactions
      const requestBody = {
        type: 'SHIPMENT',
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 50,
      };

      const response1 = await request(app)
        .post('/api/transactions')
        .send(requestBody);

      const response2 = await request(app)
        .post('/api/transactions')
        .send(requestBody);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.transaction.id).not.toBe(response2.body.transaction.id);

      // Should create two transactions
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(2);
    });
  });

  describe('Idempotency Key Expiration', () => {
    it('should process request after key expiration', async () => {
      const idempotencyKey = uuidv4();
      const requestBody = {
        type: 'RECEIPT',
        skuId: testSkuId,
        warehouseId: testWarehouseId,
        batchId: testBatchId,
        quantity: 100,
      };

      // First request
      const response1 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(200);

      // Manually expire the key
      await prisma.$executeRaw`
        UPDATE "IdempotencyKey" 
        SET "expiresAt" = NOW() - INTERVAL '1 day' 
        WHERE "key" = ${idempotencyKey}
      `;

      // Clean up expired keys (simulating background job)
      await prisma.$executeRaw`
        DELETE FROM "IdempotencyKey" 
        WHERE "expiresAt" < NOW()
      `;

      // Same request should process again
      const response2 = await request(app)
        .post('/api/transactions')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(200);
      expect(response2.body.transaction.id).not.toBe(response1.body.transaction.id);

      // Should have created two transactions
      const transactions = await prisma.inventory_transactions.count({
        where: { skuId: testSkuId },
      });
      expect(transactions).toBe(2);
    });
  });

  describe('Payment Idempotency', () => {
    it('should prevent duplicate payment processing', async () => {
      const idempotencyKey = uuidv4();
      const paymentRequest = {
        amount: 1000,
        orderId: 'ORDER-123',
        paymentMethod: 'credit_card',
      };

      // First payment request
      const response1 = await request(app)
        .post('/api/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentRequest);

      expect(response1.status).toBe(200);
      expect(response1.body.payment.status).toBe('completed');

      // Duplicate payment request
      const response2 = await request(app)
        .post('/api/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentRequest);

      expect(response2.status).toBe(200);
      expect(response2.body).toEqual(response1.body);

      // Should return same payment ID
      expect(response2.body.payment.id).toBe(response1.body.payment.id);
    });

    it('should handle concurrent payment requests', async () => {
      const idempotencyKey = uuidv4();
      const paymentRequest = {
        amount: 5000,
        orderId: 'ORDER-456',
        paymentMethod: 'paypal',
      };

      // Send 10 concurrent payment requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/payments')
          .set('Idempotency-Key', idempotencyKey)
          .send(paymentRequest)
      );

      const responses = await Promise.all(requests);

      // All should return the same payment
      const paymentIds = responses.map(r => r.body.payment?.id);
      const uniquePaymentIds = [...new Set(paymentIds)];
      
      expect(uniquePaymentIds).toHaveLength(1);
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });
});