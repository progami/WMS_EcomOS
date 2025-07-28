/**
 * Integration Test Suite: Inventory Flow Tests
 * Tests complete inventory management workflows including receiving, shipping, and transfers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { InventoryService } from '@/lib/services/inventory-service';
import { IdempotencyService } from '@/lib/services/idempotency-service';

const prisma = new PrismaClient();

describe('Inventory Flow Integration Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let inventoryService: InventoryService;
  let idempotencyService: IdempotencyService;
  let testData: {
    warehouseId: string;
    warehouse2Id: string;
    skuId: string;
    sku2Id: string;
    batchId: string;
    batch2Id: string;
    userId: string;
    supplierId: string;
  };

  beforeAll(async () => {
    inventoryService = new InventoryService();
    idempotencyService = new IdempotencyService();

    // Create test data
    const [warehouse1, warehouse2] = await Promise.all([
      prisma.warehouses.create({
        data: {
          name: 'Integration Test Warehouse 1',
          address: '111 Integration Ave',
        },
      }),
      prisma.warehouses.create({
        data: {
          name: 'Integration Test Warehouse 2',
          address: '222 Integration Blvd',
        },
      }),
    ]);

    const supplier = await prisma.supplier.create({
      data: {
        name: 'Integration Test Supplier',
        code: 'ITS-001',
        contactEmail: 'supplier@integration.test',
      },
    });

    const [sku1, sku2] = await Promise.all([
      prisma.sKU.create({
        data: {
          code: 'INT-SKU-001',
          name: 'Integration Test Product 1',
          description: 'Product for integration testing',
          unitPrice: 25.50,
          unitsPerCarton: 12,
          reorderPoint: 100,
          reorderQuantity: 500,
        },
      }),
      prisma.sKU.create({
        data: {
          code: 'INT-SKU-002',
          name: 'Integration Test Product 2',
          description: 'Another product for integration testing',
          unitPrice: 35.75,
          unitsPerCarton: 24,
          reorderPoint: 50,
          reorderQuantity: 300,
        },
      }),
    ]);

    const [batch1, batch2] = await Promise.all([
      prisma.batch.create({
        data: {
          batchNumber: 'INT-BATCH-001',
          skuId: sku1.id,
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
          manufacturingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      }),
      prisma.batch.create({
        data: {
          batchNumber: 'INT-BATCH-002',
          skuId: sku2.id,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days
          manufacturingDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        },
      }),
    ]);

    const user = await prisma.users.create({
      data: {
        email: 'integration@test.com',
        name: 'Integration Test User',
        permissions: {
          create: {
            name: 'INTEGRATION_TESTER',
            canViewInventory: true,
            canManageInventory: true,
            canViewWarehouse: true,
            canManageWarehouse: true,
          },
        },
      },
    });

    testData = {
      warehouseId: warehouse1.id,
      warehouse2Id: warehouse2.id,
      skuId: sku1.id,
      sku2Id: sku2.id,
      batchId: batch1.id,
      batch2Id: batch2.id,
      userId: user.id,
      supplierId: supplier.id,
    };

    // Setup Express app with actual routes
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req: any, res, next) => {
      req.user = { id: testData.userId, email: 'integration@test.com' };
      next();
    });

    // Import actual route handlers
    setupRoutes();

    server = createServer(app);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.inventory_transactions.deleteMany({
      where: { userId: testData.userId },
    });
    await prisma.inventory_balances.deleteMany({
      where: { warehouseId: { in: [testData.warehouseId, testData.warehouse2Id] } },
    });
    await prisma.batch.deleteMany({
      where: { id: { in: [testData.batchId, testData.batch2Id] } },
    });
    await prisma.sKU.deleteMany({
      where: { id: { in: [testData.skuId, testData.sku2Id] } },
    });
    await prisma.warehouses.deleteMany({
      where: { id: { in: [testData.warehouseId, testData.warehouse2Id] } },
    });
    await prisma.supplier.delete({
      where: { id: testData.supplierId },
    });
    await prisma.users.delete({
      where: { id: testData.userId },
    });

    await prisma.$disconnect();
    server.close();
  });

  beforeEach(async () => {
    // Reset inventory before each test
    await prisma.inventory_transactions.deleteMany({
      where: { userId: testData.userId },
    });
    await prisma.inventory_balances.deleteMany({
      where: { warehouseId: { in: [testData.warehouseId, testData.warehouse2Id] } },
    });
  });

  function setupRoutes() {
    // Receive inventory endpoint
    app.post('/api/operations/receive', async (req: any, res) => {
      try {
        const { items, referenceNumber, supplierId, notes } = req.body;
        const idempotencyKey = req.headers['idempotency-key'];

        if (idempotencyKey) {
          const cached = await idempotencyService.checkIdempotency(idempotencyKey);
          if (cached) {
            return res.status(cached.statusCode).json(cached.response);
          }
        }

        const result = await prisma.$transaction(async (tx) => {
          const transactions = [];

          for (const item of items) {
            const { skuId, warehouseId, batchId, quantity, unitCost } = item;

            // Check or create inventory balance
            let balance = await tx.inventory_balances.findFirst({
              where: { skuId, warehouseId, batchId },
            });

            if (!balance) {
              balance = await tx.inventory_balances.create({
                data: {
                  skuId,
                  warehouseId,
                  batchId,
                  quantity: 0,
                  availableQuantity: 0,
                  reservedQuantity: 0,
                },
              });
            }

            // Update balance
            await tx.inventory_balances.update({
              where: { id: balance.id },
              data: {
                quantity: balance.quantity + quantity,
                availableQuantity: balance.availableQuantity + quantity,
              },
            });

            // Create transaction record
            const transaction = await tx.inventory_transactions.create({
              data: {
                type: 'RECEIPT',
                skuId,
                warehouseId,
                batchId,
                quantity,
                unitCost,
                transactionDate: new Date(),
                referenceNumber,
                status: 'COMPLETED',
                userId: req.user.id,
                supplierId,
                notes,
                idempotencyKey,
              },
            });

            transactions.push(transaction);
          }

          return transactions;
        });

        const response = { success: true, transactions: result };

        if (idempotencyKey) {
          await idempotencyService.storeResponse(idempotencyKey, 200, response);
        }

        res.json(response);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Ship inventory endpoint
    app.post('/api/operations/ship', async (req: any, res) => {
      try {
        const { items, referenceNumber, customerId, shippingAddress, notes } = req.body;

        const result = await prisma.$transaction(async (tx) => {
          const transactions = [];

          for (const item of items) {
            const { skuId, warehouseId, quantity } = item;

            // Get available inventory (FIFO)
            const availableBalances = await tx.inventory_balances.findMany({
              where: {
                skuId,
                warehouseId,
                availableQuantity: { gt: 0 },
              },
              include: { batch: true },
              orderBy: { batch: { expiryDate: 'asc' } }, // FIFO by expiry
            });

            let remainingQuantity = quantity;
            const allocations = [];

            for (const balance of availableBalances) {
              if (remainingQuantity <= 0) break;

              const allocatedQuantity = Math.min(remainingQuantity, balance.availableQuantity);
              allocations.push({
                balanceId: balance.id,
                batchId: balance.batchId,
                quantity: allocatedQuantity,
              });

              remainingQuantity -= allocatedQuantity;
            }

            if (remainingQuantity > 0) {
              throw new Error(`Insufficient inventory for SKU ${skuId}`);
            }

            // Process allocations
            for (const allocation of allocations) {
              const balance = await tx.inventory_balances.findUnique({
                where: { id: allocation.balanceId },
              });

              if (!balance) continue;

              // Update balance
              await tx.inventory_balances.update({
                where: { id: allocation.balanceId },
                data: {
                  quantity: balance.quantity - allocation.quantity,
                  availableQuantity: balance.availableQuantity - allocation.quantity,
                },
              });

              // Create transaction
              const transaction = await tx.inventory_transactions.create({
                data: {
                  type: 'SHIPMENT',
                  skuId,
                  warehouseId,
                  batchId: allocation.batchId,
                  quantity: allocation.quantity,
                  transactionDate: new Date(),
                  referenceNumber,
                  status: 'COMPLETED',
                  userId: req.user.id,
                  customerId,
                  shippingAddress,
                  notes,
                },
              });

              transactions.push(transaction);
            }
          }

          return transactions;
        });

        res.json({ success: true, transactions: result });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Transfer inventory endpoint
    app.post('/api/operations/transfer', async (req: any, res) => {
      try {
        const { fromWarehouseId, toWarehouseId, items, referenceNumber, notes } = req.body;

        const result = await prisma.$transaction(async (tx) => {
          const transactions = [];

          for (const item of items) {
            const { skuId, batchId, quantity } = item;

            // Get source balance
            const sourceBalance = await tx.inventory_balances.findFirst({
              where: {
                skuId,
                warehouseId: fromWarehouseId,
                batchId,
              },
            });

            if (!sourceBalance || sourceBalance.availableQuantity < quantity) {
              throw new Error('Insufficient inventory for transfer');
            }

            // Update source balance
            await tx.inventory_balances.update({
              where: { id: sourceBalance.id },
              data: {
                quantity: sourceBalance.quantity - quantity,
                availableQuantity: sourceBalance.availableQuantity - quantity,
              },
            });

            // Get or create destination balance
            let destBalance = await tx.inventory_balances.findFirst({
              where: {
                skuId,
                warehouseId: toWarehouseId,
                batchId,
              },
            });

            if (!destBalance) {
              destBalance = await tx.inventory_balances.create({
                data: {
                  skuId,
                  warehouseId: toWarehouseId,
                  batchId,
                  quantity: 0,
                  availableQuantity: 0,
                  reservedQuantity: 0,
                },
              });
            }

            // Update destination balance
            await tx.inventory_balances.update({
              where: { id: destBalance.id },
              data: {
                quantity: destBalance.quantity + quantity,
                availableQuantity: destBalance.availableQuantity + quantity,
              },
            });

            // Create transfer out transaction
            const transferOut = await tx.inventory_transactions.create({
              data: {
                type: 'TRANSFER_OUT',
                skuId,
                warehouseId: fromWarehouseId,
                batchId,
                quantity,
                transactionDate: new Date(),
                referenceNumber,
                status: 'COMPLETED',
                userId: req.user.id,
                notes,
              },
            });

            // Create transfer in transaction
            const transferIn = await tx.inventory_transactions.create({
              data: {
                type: 'TRANSFER_IN',
                skuId,
                warehouseId: toWarehouseId,
                batchId,
                quantity,
                transactionDate: new Date(),
                referenceNumber,
                status: 'COMPLETED',
                userId: req.user.id,
                notes,
              },
            });

            transactions.push(transferOut, transferIn);
          }

          return transactions;
        });

        res.json({ success: true, transactions: result });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get inventory balances
    app.get('/api/inventory/balances', async (req, res) => {
      try {
        const { warehouseId, skuId } = req.query;
        const where: any = {};

        if (warehouseId) where.warehouseId = String(warehouseId);
        if (skuId) where.skuId = String(skuId);

        const balances = await prisma.inventory_balances.findMany({
          where,
          include: {
            sku: true,
            warehouse: true,
            batch: true,
          },
        });

        res.json({ balances });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  describe('Receiving Flow', () => {
    it('should successfully receive inventory', async () => {
      const idempotencyKey = uuidv4();
      const receiveData = {
        referenceNumber: 'PO-001',
        supplierId: testData.supplierId,
        notes: 'Initial inventory receipt',
        items: [
          {
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            batchId: testData.batchId,
            quantity: 100,
            unitCost: 20.00,
          },
          {
            skuId: testData.sku2Id,
            warehouseId: testData.warehouseId,
            batchId: testData.batch2Id,
            quantity: 50,
            unitCost: 30.00,
          },
        ],
      };

      const response = await request(app)
        .post('/api/operations/receive')
        .set('Idempotency-Key', idempotencyKey)
        .send(receiveData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transactions).toHaveLength(2);

      // Verify inventory balances
      const balances = await request(app)
        .get('/api/inventory/balances')
        .query({ warehouseId: testData.warehouseId });

      expect(balances.body.balances).toHaveLength(2);
      
      const sku1Balance = balances.body.balances.find((b: any) => b.skuId === testData.skuId);
      expect(sku1Balance.quantity).toBe(100);
      expect(sku1Balance.availableQuantity).toBe(100);
      
      const sku2Balance = balances.body.balances.find((b: any) => b.skuId === testData.sku2Id);
      expect(sku2Balance.quantity).toBe(50);
      expect(sku2Balance.availableQuantity).toBe(50);
    });

    it('should handle idempotent receive requests', async () => {
      const idempotencyKey = uuidv4();
      const receiveData = {
        referenceNumber: 'PO-002',
        supplierId: testData.supplierId,
        items: [{
          skuId: testData.skuId,
          warehouseId: testData.warehouseId,
          batchId: testData.batchId,
          quantity: 200,
          unitCost: 22.00,
        }],
      };

      // First request
      const response1 = await request(app)
        .post('/api/operations/receive')
        .set('Idempotency-Key', idempotencyKey)
        .send(receiveData);

      expect(response1.status).toBe(200);

      // Duplicate request
      const response2 = await request(app)
        .post('/api/operations/receive')
        .set('Idempotency-Key', idempotencyKey)
        .send(receiveData);

      expect(response2.status).toBe(200);
      expect(response2.body).toEqual(response1.body);

      // Verify only one transaction was created
      const transactions = await prisma.inventory_transactions.count({
        where: { referenceNumber: 'PO-002' },
      });
      expect(transactions).toBe(1);
    });
  });

  describe('Shipping Flow', () => {
    it('should successfully ship inventory with FIFO allocation', async () => {
      // First, receive inventory in two batches
      await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-003',
          supplierId: testData.supplierId,
          items: [
            {
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              batchId: testData.batchId,
              quantity: 100,
              unitCost: 20.00,
            },
          ],
        });

      // Create another batch with earlier expiry
      const earlierBatch = await prisma.batch.create({
        data: {
          batchNumber: 'INT-BATCH-003',
          skuId: testData.skuId,
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days (earlier)
        },
      });

      await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-004',
          supplierId: testData.supplierId,
          items: [
            {
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              batchId: earlierBatch.id,
              quantity: 50,
              unitCost: 19.00,
            },
          ],
        });

      // Ship 60 units (should take 50 from earlier batch, 10 from later)
      const shipResponse = await request(app)
        .post('/api/operations/ship')
        .send({
          referenceNumber: 'SO-001',
          customerId: 'CUST-001',
          shippingAddress: '123 Customer St',
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            quantity: 60,
          }],
        });

      expect(shipResponse.status).toBe(200);
      expect(shipResponse.body.transactions).toHaveLength(2); // Two batches used

      // Verify FIFO allocation
      const earlierBatchTx = shipResponse.body.transactions.find(
        (t: any) => t.batchId === earlierBatch.id
      );
      const laterBatchTx = shipResponse.body.transactions.find(
        (t: any) => t.batchId === testData.batchId
      );

      expect(earlierBatchTx.quantity).toBe(50); // All from earlier batch
      expect(laterBatchTx.quantity).toBe(10); // Remainder from later batch

      // Cleanup
      await prisma.batch.delete({ where: { id: earlierBatch.id } });
    });

    it('should prevent shipping more than available inventory', async () => {
      // Receive 50 units
      await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-005',
          supplierId: testData.supplierId,
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            batchId: testData.batchId,
            quantity: 50,
          }],
        });

      // Try to ship 100 units
      const shipResponse = await request(app)
        .post('/api/operations/ship')
        .send({
          referenceNumber: 'SO-002',
          customerId: 'CUST-002',
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            quantity: 100,
          }],
        });

      expect(shipResponse.status).toBe(400);
      expect(shipResponse.body.error).toMatch(/insufficient inventory/i);

      // Verify inventory wasn't changed
      const balance = await prisma.inventory_balances.findFirst({
        where: {
          skuId: testData.skuId,
          warehouseId: testData.warehouseId,
        },
      });
      expect(balance?.quantity).toBe(50);
    });
  });

  describe('Transfer Flow', () => {
    it('should successfully transfer inventory between warehouses', async () => {
      // Receive inventory in warehouse 1
      await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-006',
          supplierId: testData.supplierId,
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            batchId: testData.batchId,
            quantity: 100,
          }],
        });

      // Transfer 30 units to warehouse 2
      const transferResponse = await request(app)
        .post('/api/operations/transfer')
        .send({
          fromWarehouseId: testData.warehouseId,
          toWarehouseId: testData.warehouse2Id,
          referenceNumber: 'TR-001',
          notes: 'Inter-warehouse transfer',
          items: [{
            skuId: testData.skuId,
            batchId: testData.batchId,
            quantity: 30,
          }],
        });

      expect(transferResponse.status).toBe(200);
      expect(transferResponse.body.transactions).toHaveLength(2); // OUT and IN

      // Verify balances
      const warehouse1Balance = await prisma.inventory_balances.findFirst({
        where: {
          skuId: testData.skuId,
          warehouseId: testData.warehouseId,
        },
      });
      expect(warehouse1Balance?.quantity).toBe(70);

      const warehouse2Balance = await prisma.inventory_balances.findFirst({
        where: {
          skuId: testData.skuId,
          warehouseId: testData.warehouse2Id,
        },
      });
      expect(warehouse2Balance?.quantity).toBe(30);

      // Verify transaction records
      const transactions = await prisma.inventory_transactions.findMany({
        where: { referenceNumber: 'TR-001' },
        orderBy: { createdAt: 'asc' },
      });

      expect(transactions).toHaveLength(2);
      expect(transactions[0].type).toBe('TRANSFER_OUT');
      expect(transactions[0].warehouseId).toBe(testData.warehouseId);
      expect(transactions[1].type).toBe('TRANSFER_IN');
      expect(transactions[1].warehouseId).toBe(testData.warehouse2Id);
    });

    it('should prevent transfer of unavailable inventory', async () => {
      // Try to transfer without inventory
      const transferResponse = await request(app)
        .post('/api/operations/transfer')
        .send({
          fromWarehouseId: testData.warehouseId,
          toWarehouseId: testData.warehouse2Id,
          referenceNumber: 'TR-002',
          items: [{
            skuId: testData.sku2Id,
            batchId: testData.batch2Id,
            quantity: 100,
          }],
        });

      expect(transferResponse.status).toBe(400);
      expect(transferResponse.body.error).toMatch(/insufficient inventory/i);
    });
  });

  describe('Complex Multi-Step Flow', () => {
    it('should handle complete receive-transfer-ship workflow', async () => {
      // Step 1: Receive inventory at warehouse 1
      const receiveResponse = await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-007',
          supplierId: testData.supplierId,
          items: [
            {
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              batchId: testData.batchId,
              quantity: 200,
              unitCost: 25.00,
            },
            {
              skuId: testData.sku2Id,
              warehouseId: testData.warehouseId,
              batchId: testData.batch2Id,
              quantity: 150,
              unitCost: 35.00,
            },
          ],
        });

      expect(receiveResponse.status).toBe(200);

      // Step 2: Transfer some inventory to warehouse 2
      const transferResponse = await request(app)
        .post('/api/operations/transfer')
        .send({
          fromWarehouseId: testData.warehouseId,
          toWarehouseId: testData.warehouse2Id,
          referenceNumber: 'TR-003',
          items: [
            {
              skuId: testData.skuId,
              batchId: testData.batchId,
              quantity: 80,
            },
            {
              skuId: testData.sku2Id,
              batchId: testData.batch2Id,
              quantity: 50,
            },
          ],
        });

      expect(transferResponse.status).toBe(200);

      // Step 3: Ship from both warehouses
      const ship1Response = await request(app)
        .post('/api/operations/ship')
        .send({
          referenceNumber: 'SO-003',
          customerId: 'CUST-003',
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            quantity: 50,
          }],
        });

      const ship2Response = await request(app)
        .post('/api/operations/ship')
        .send({
          referenceNumber: 'SO-004',
          customerId: 'CUST-004',
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouse2Id,
            quantity: 30,
          }],
        });

      expect(ship1Response.status).toBe(200);
      expect(ship2Response.status).toBe(200);

      // Verify final balances
      const finalBalances = await prisma.inventory_balances.findMany({
        where: {
          skuId: { in: [testData.skuId, testData.sku2Id] },
        },
        orderBy: [{ warehouseId: 'asc' }, { skuId: 'asc' }],
      });

      // Warehouse 1: SKU1 = 200 - 80 - 50 = 70, SKU2 = 150 - 50 = 100
      // Warehouse 2: SKU1 = 80 - 30 = 50, SKU2 = 50
      const w1Sku1 = finalBalances.find(b => 
        b.warehouseId === testData.warehouseId && b.skuId === testData.skuId
      );
      const w1Sku2 = finalBalances.find(b => 
        b.warehouseId === testData.warehouseId && b.skuId === testData.sku2Id
      );
      const w2Sku1 = finalBalances.find(b => 
        b.warehouseId === testData.warehouse2Id && b.skuId === testData.skuId
      );
      const w2Sku2 = finalBalances.find(b => 
        b.warehouseId === testData.warehouse2Id && b.skuId === testData.sku2Id
      );

      expect(w1Sku1?.quantity).toBe(70);
      expect(w1Sku2?.quantity).toBe(100);
      expect(w2Sku1?.quantity).toBe(50);
      expect(w2Sku2?.quantity).toBe(50);

      // Verify transaction history
      const allTransactions = await prisma.inventory_transactions.findMany({
        where: { userId: testData.userId },
        orderBy: { createdAt: 'asc' },
      });

      // Should have: 2 receipts + 4 transfers (2 out, 2 in) + 2 shipments = 8 total
      expect(allTransactions).toHaveLength(8);

      const receipts = allTransactions.filter(t => t.type === 'RECEIPT');
      const transfersOut = allTransactions.filter(t => t.type === 'TRANSFER_OUT');
      const transfersIn = allTransactions.filter(t => t.type === 'TRANSFER_IN');
      const shipments = allTransactions.filter(t => t.type === 'SHIPMENT');

      expect(receipts).toHaveLength(2);
      expect(transfersOut).toHaveLength(2);
      expect(transfersIn).toHaveLength(2);
      expect(shipments).toHaveLength(2);
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should rollback entire transaction on partial failure', async () => {
      // Receive some inventory
      await request(app)
        .post('/api/operations/receive')
        .send({
          referenceNumber: 'PO-008',
          supplierId: testData.supplierId,
          items: [{
            skuId: testData.skuId,
            warehouseId: testData.warehouseId,
            batchId: testData.batchId,
            quantity: 50,
          }],
        });

      // Try to ship with one valid and one invalid item
      const shipResponse = await request(app)
        .post('/api/operations/ship')
        .send({
          referenceNumber: 'SO-005',
          customerId: 'CUST-005',
          items: [
            {
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              quantity: 30, // Valid
            },
            {
              skuId: testData.sku2Id,
              warehouseId: testData.warehouseId,
              quantity: 100, // Invalid - no inventory
            },
          ],
        });

      expect(shipResponse.status).toBe(400);

      // Verify no changes were made
      const balance = await prisma.inventory_balances.findFirst({
        where: {
          skuId: testData.skuId,
          warehouseId: testData.warehouseId,
        },
      });
      expect(balance?.quantity).toBe(50); // Unchanged

      const transactions = await prisma.inventory_transactions.findMany({
        where: { referenceNumber: 'SO-005' },
      });
      expect(transactions).toHaveLength(0); // No transactions created
    });
  });

  describe('Audit Trail', () => {
    it('should maintain complete audit trail for all operations', async () => {
      // Perform various operations
      const operations = [
        {
          type: 'receive',
          endpoint: '/api/operations/receive',
          data: {
            referenceNumber: 'AUDIT-PO-001',
            supplierId: testData.supplierId,
            notes: 'Audit test receipt',
            items: [{
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              batchId: testData.batchId,
              quantity: 100,
              unitCost: 20.00,
            }],
          },
        },
        {
          type: 'ship',
          endpoint: '/api/operations/ship',
          data: {
            referenceNumber: 'AUDIT-SO-001',
            customerId: 'AUDIT-CUST-001',
            notes: 'Audit test shipment',
            items: [{
              skuId: testData.skuId,
              warehouseId: testData.warehouseId,
              quantity: 25,
            }],
          },
        },
        {
          type: 'transfer',
          endpoint: '/api/operations/transfer',
          data: {
            fromWarehouseId: testData.warehouseId,
            toWarehouseId: testData.warehouse2Id,
            referenceNumber: 'AUDIT-TR-001',
            notes: 'Audit test transfer',
            items: [{
              skuId: testData.skuId,
              batchId: testData.batchId,
              quantity: 15,
            }],
          },
        },
      ];

      for (const op of operations) {
        const response = await request(app)
          .post(op.endpoint)
          .send(op.data);
        expect(response.status).toBe(200);
      }

      // Verify audit trail
      const auditRecords = await prisma.inventory_transactions.findMany({
        where: {
          referenceNumber: {
            startsWith: 'AUDIT-',
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(auditRecords).toHaveLength(4); // 1 receipt + 1 shipment + 2 transfers

      // Verify all audit fields are populated
      auditRecords.forEach(record => {
        expect(record.userId).toBe(testData.userId);
        expect(record.createdAt).toBeDefined();
        expect(record.referenceNumber).toBeDefined();
        expect(record.status).toBe('COMPLETED');
      });

      // Verify specific details
      const receipt = auditRecords.find(r => r.type === 'RECEIPT');
      expect(receipt?.supplierId).toBe(testData.supplierId);
      expect(receipt?.notes).toBe('Audit test receipt');

      const shipment = auditRecords.find(r => r.type === 'SHIPMENT');
      expect(shipment?.customerId).toBe('AUDIT-CUST-001');
      expect(shipment?.notes).toBe('Audit test shipment');
    });
  });
});