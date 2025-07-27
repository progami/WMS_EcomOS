/**
 * Unit Test Suite: Inventory Service Tests
 * Tests the core inventory service functionality in isolation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InventoryService } from '@/lib/services/inventory-service';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    inventoryBalance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    sKU: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    batch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    warehouse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrismaClient)),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('InventoryService Unit Tests', () => {
  let inventoryService: InventoryService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    inventoryService = new InventoryService();
    (inventoryService as any).prisma = mockPrisma;
  });

  describe('checkAvailability', () => {
    it('should return true when sufficient inventory is available', async () => {
      const mockBalance = {
        id: '1',
        skuId: 'sku-1',
        warehouseId: 'warehouse-1',
        quantity: 100,
        availableQuantity: 80,
        reservedQuantity: 20,
      };

      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(mockBalance);

      const result = await inventoryService.checkAvailability('sku-1', 'warehouse-1', 50);

      expect(result).toBe(true);
      expect(mockPrisma.inventoryBalance.findFirst).toHaveBeenCalledWith({
        where: {
          skuId: 'sku-1',
          warehouseId: 'warehouse-1',
          availableQuantity: { gte: 50 },
        },
      });
    });

    it('should return false when insufficient inventory', async () => {
      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(null);

      const result = await inventoryService.checkAvailability('sku-1', 'warehouse-1', 100);

      expect(result).toBe(false);
    });

    it('should check across all warehouses when no specific warehouse provided', async () => {
      const mockBalances = [
        { availableQuantity: 30 },
        { availableQuantity: 40 },
        { availableQuantity: 50 },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const result = await inventoryService.checkAvailability('sku-1', undefined, 100);

      expect(result).toBe(true); // 30 + 40 + 50 = 120 >= 100
      expect(mockPrisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: { skuId: 'sku-1' },
        select: { availableQuantity: true },
      });
    });
  });

  describe('reserveInventory', () => {
    it('should successfully reserve inventory', async () => {
      const mockBalance = {
        id: 'balance-1',
        availableQuantity: 100,
        reservedQuantity: 20,
      };

      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(mockBalance);
      mockPrisma.inventoryBalance.update.mockResolvedValue({
        ...mockBalance,
        availableQuantity: 70,
        reservedQuantity: 50,
      });

      const result = await inventoryService.reserveInventory(
        'sku-1',
        'warehouse-1',
        30,
        'order-123'
      );

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeDefined();
      expect(mockPrisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: {
          availableQuantity: 70,
          reservedQuantity: 50,
        },
      });
    });

    it('should fail to reserve when insufficient inventory', async () => {
      const mockBalance = {
        id: 'balance-1',
        availableQuantity: 20,
        reservedQuantity: 10,
      };

      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(mockBalance);

      const result = await inventoryService.reserveInventory(
        'sku-1',
        'warehouse-1',
        30,
        'order-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient inventory/i);
      expect(mockPrisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('should handle batch-specific reservations', async () => {
      const mockBalance = {
        id: 'balance-1',
        batchId: 'batch-1',
        availableQuantity: 50,
        reservedQuantity: 10,
      };

      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(mockBalance);
      mockPrisma.inventoryBalance.update.mockResolvedValue({
        ...mockBalance,
        availableQuantity: 30,
        reservedQuantity: 30,
      });

      const result = await inventoryService.reserveInventory(
        'sku-1',
        'warehouse-1',
        20,
        'order-456',
        'batch-1'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.inventoryBalance.findFirst).toHaveBeenCalledWith({
        where: {
          skuId: 'sku-1',
          warehouseId: 'warehouse-1',
          batchId: 'batch-1',
          availableQuantity: { gte: 20 },
        },
      });
    });
  });

  describe('releaseReservation', () => {
    it('should successfully release reservation', async () => {
      const mockBalance = {
        id: 'balance-1',
        availableQuantity: 50,
        reservedQuantity: 30,
      };

      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(mockBalance);
      mockPrisma.inventoryBalance.update.mockResolvedValue({
        ...mockBalance,
        availableQuantity: 70,
        reservedQuantity: 10,
      });

      const result = await inventoryService.releaseReservation(
        'sku-1',
        'warehouse-1',
        20,
        'reservation-123'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: {
          availableQuantity: 70,
          reservedQuantity: 10,
        },
      });
    });

    it('should handle release of non-existent reservation gracefully', async () => {
      mockPrisma.inventoryBalance.findFirst.mockResolvedValue(null);

      const result = await inventoryService.releaseReservation(
        'sku-1',
        'warehouse-1',
        20,
        'non-existent'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/inventory balance not found/i);
    });
  });

  describe('allocateInventoryFIFO', () => {
    it('should allocate inventory using FIFO by expiry date', async () => {
      const mockBalances = [
        {
          id: 'balance-1',
          batchId: 'batch-1',
          availableQuantity: 30,
          batch: { expiryDate: new Date('2024-06-01') },
        },
        {
          id: 'balance-2',
          batchId: 'batch-2',
          availableQuantity: 50,
          batch: { expiryDate: new Date('2024-08-01') },
        },
        {
          id: 'balance-3',
          batchId: 'batch-3',
          availableQuantity: 40,
          batch: { expiryDate: new Date('2024-07-01') },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const allocations = await inventoryService.allocateInventoryFIFO(
        'sku-1',
        'warehouse-1',
        75
      );

      expect(allocations).toHaveLength(3);
      expect(allocations[0]).toEqual({
        balanceId: 'balance-1',
        batchId: 'batch-1',
        quantity: 30,
        expiryDate: new Date('2024-06-01'),
      });
      expect(allocations[1]).toEqual({
        balanceId: 'balance-3',
        batchId: 'batch-3',
        quantity: 40,
        expiryDate: new Date('2024-07-01'),
      });
      expect(allocations[2]).toEqual({
        balanceId: 'balance-2',
        batchId: 'batch-2',
        quantity: 5,
        expiryDate: new Date('2024-08-01'),
      });
    });

    it('should throw error when insufficient inventory for allocation', async () => {
      const mockBalances = [
        {
          id: 'balance-1',
          batchId: 'batch-1',
          availableQuantity: 20,
          batch: { expiryDate: new Date('2024-06-01') },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      await expect(
        inventoryService.allocateInventoryFIFO('sku-1', 'warehouse-1', 50)
      ).rejects.toThrow(/insufficient inventory/i);
    });

    it('should handle allocations without batch information', async () => {
      const mockBalances = [
        {
          id: 'balance-1',
          batchId: null,
          availableQuantity: 100,
          batch: null,
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const allocations = await inventoryService.allocateInventoryFIFO(
        'sku-1',
        'warehouse-1',
        50
      );

      expect(allocations).toHaveLength(1);
      expect(allocations[0].quantity).toBe(50);
      expect(allocations[0].expiryDate).toBeUndefined();
    });
  });

  describe('calculateReorderNeeds', () => {
    it('should identify SKUs needing reorder', async () => {
      const mockSKUs = [
        {
          id: 'sku-1',
          code: 'PROD-001',
          name: 'Product 1',
          reorderPoint: 100,
          reorderQuantity: 500,
        },
        {
          id: 'sku-2',
          code: 'PROD-002',
          name: 'Product 2',
          reorderPoint: 50,
          reorderQuantity: 200,
        },
      ];

      const mockAggregations = [
        { _sum: { quantity: 80 }, skuId: 'sku-1' }, // Below reorder point
        { _sum: { quantity: 120 }, skuId: 'sku-2' }, // Above reorder point
      ];

      mockPrisma.sKU.findMany.mockResolvedValue(mockSKUs);
      mockPrisma.inventoryBalance.aggregate.mockImplementation(({ where }) => {
        const skuId = where.skuId;
        const agg = mockAggregations.find(a => a.skuId === skuId);
        return Promise.resolve(agg || { _sum: { quantity: 0 }, skuId });
      });

      const reorderNeeds = await inventoryService.calculateReorderNeeds();

      expect(reorderNeeds).toHaveLength(1);
      expect(reorderNeeds[0].skuId).toBe('sku-1');
      expect(reorderNeeds[0].currentQuantity).toBe(80);
      expect(reorderNeeds[0].reorderPoint).toBe(100);
      expect(reorderNeeds[0].suggestedOrderQuantity).toBe(500);
    });

    it('should calculate reorder needs for specific warehouse', async () => {
      const mockSKUs = [
        {
          id: 'sku-1',
          code: 'PROD-001',
          name: 'Product 1',
          reorderPoint: 100,
          reorderQuantity: 500,
        },
      ];

      mockPrisma.sKU.findMany.mockResolvedValue(mockSKUs);
      mockPrisma.inventoryBalance.aggregate.mockResolvedValue({
        _sum: { quantity: 75 },
        skuId: 'sku-1',
      });

      const reorderNeeds = await inventoryService.calculateReorderNeeds('warehouse-1');

      expect(mockPrisma.inventoryBalance.aggregate).toHaveBeenCalledWith({
        where: { skuId: 'sku-1', warehouseId: 'warehouse-1' },
        _sum: { quantity: true },
      });
      expect(reorderNeeds).toHaveLength(1);
    });
  });

  describe('getLowStockItems', () => {
    it('should identify low stock items', async () => {
      const mockBalances = [
        {
          id: 'balance-1',
          skuId: 'sku-1',
          warehouseId: 'warehouse-1',
          quantity: 15,
          availableQuantity: 10,
          sku: {
            code: 'PROD-001',
            name: 'Low Stock Product',
            reorderPoint: 50,
          },
          warehouse: { name: 'Main Warehouse' },
        },
        {
          id: 'balance-2',
          skuId: 'sku-2',
          warehouseId: 'warehouse-1',
          quantity: 200,
          availableQuantity: 180,
          sku: {
            code: 'PROD-002',
            name: 'Well Stocked Product',
            reorderPoint: 100,
          },
          warehouse: { name: 'Main Warehouse' },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const lowStockItems = await inventoryService.getLowStockItems(20);

      expect(lowStockItems).toHaveLength(1);
      expect(lowStockItems[0].skuId).toBe('sku-1');
      expect(lowStockItems[0].currentQuantity).toBe(15);
      expect(lowStockItems[0].threshold).toBe(20);
    });

    it('should filter by warehouse when specified', async () => {
      mockPrisma.inventoryBalance.findMany.mockResolvedValue([]);

      await inventoryService.getLowStockItems(50, 'warehouse-2');

      expect(mockPrisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: {
          quantity: { lt: 50 },
          warehouseId: 'warehouse-2',
        },
        include: {
          sku: true,
          warehouse: true,
        },
      });
    });
  });

  describe('getInventoryValue', () => {
    it('should calculate total inventory value', async () => {
      const mockBalances = [
        {
          quantity: 100,
          sku: { unitPrice: new Decimal(25.50) },
        },
        {
          quantity: 50,
          sku: { unitPrice: new Decimal(30.00) },
        },
        {
          quantity: 75,
          sku: { unitPrice: null }, // No price set
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const value = await inventoryService.getInventoryValue();

      expect(value.totalValue).toBe(4050); // (100 * 25.50) + (50 * 30.00)
      expect(value.itemCount).toBe(3);
      expect(value.totalQuantity).toBe(225);
    });

    it('should calculate value for specific warehouse', async () => {
      const mockBalances = [
        {
          quantity: 200,
          sku: { unitPrice: new Decimal(10.00) },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const value = await inventoryService.getInventoryValue('warehouse-1');

      expect(value.totalValue).toBe(2000);
      expect(mockPrisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'warehouse-1' },
        include: { sku: true },
      });
    });
  });

  describe('getExpiringInventory', () => {
    it('should identify inventory expiring within specified days', async () => {
      const now = new Date();
      const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const in40Days = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

      const mockBalances = [
        {
          id: 'balance-1',
          quantity: 50,
          batch: {
            batchNumber: 'BATCH-001',
            expiryDate: in10Days,
          },
          sku: { code: 'PROD-001', name: 'Expiring Soon' },
          warehouse: { name: 'Main Warehouse' },
        },
        {
          id: 'balance-2',
          quantity: 30,
          batch: {
            batchNumber: 'BATCH-002',
            expiryDate: in20Days,
          },
          sku: { code: 'PROD-002', name: 'Also Expiring' },
          warehouse: { name: 'Main Warehouse' },
        },
        {
          id: 'balance-3',
          quantity: 100,
          batch: {
            batchNumber: 'BATCH-003',
            expiryDate: in40Days,
          },
          sku: { code: 'PROD-003', name: 'Not Expiring Soon' },
          warehouse: { name: 'Main Warehouse' },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const expiringItems = await inventoryService.getExpiringInventory(30);

      expect(expiringItems).toHaveLength(2);
      expect(expiringItems[0].daysUntilExpiry).toBeLessThanOrEqual(10);
      expect(expiringItems[1].daysUntilExpiry).toBeLessThanOrEqual(20);
    });

    it('should handle items without batch information', async () => {
      const mockBalances = [
        {
          id: 'balance-1',
          quantity: 50,
          batch: null,
          sku: { code: 'PROD-001', name: 'No Batch' },
          warehouse: { name: 'Main Warehouse' },
        },
      ];

      mockPrisma.inventoryBalance.findMany.mockResolvedValue(mockBalances);

      const expiringItems = await inventoryService.getExpiringInventory(30);

      expect(expiringItems).toHaveLength(0);
    });
  });

  describe('transaction validation', () => {
    it('should validate transaction dates are not in the future', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = await inventoryService.validateTransactionDate(futureDate);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cannot be in the future/i);
    });

    it('should validate transaction dates are not too old', async () => {
      const oldDate = new Date('2020-01-01');

      const result = await inventoryService.validateTransactionDate(oldDate);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too old/i);
    });

    it('should accept valid transaction dates', async () => {
      const validDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const result = await inventoryService.validateTransactionDate(validDate);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});