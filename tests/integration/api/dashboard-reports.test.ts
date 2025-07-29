import { PrismaClient } from '@prisma/client'

import { setupTestDatabase, teardownTestDatabase, createTestUser } from './setup/test-db'
import { createAuthenticatedRequest } from './setup/authenticated-request'
import { 
  createTestSku, 
  createTestWarehouse, 
  createTestTransaction, 
  createTestInventoryBalance,
  createTestInvoice 
} from './setup/fixtures'




// No need to setup test auth - it's handled by authenticated request
describe('Dashboard and Reports API Endpoints', () => {
  let prisma: PrismaClient
  let databaseUrl: string
  let adminUser: any
  let regularUser: any
  let request: ReturnType<typeof createAuthenticatedRequest>

  beforeAll(async () => {
    const setup = await setupTestDatabase()
    prisma = setup.prisma
    databaseUrl = setup.databaseUrl

    // Create test users
    adminUser = await createTestUser(prisma, 'admin')
    regularUser = await createTestUser(prisma, 'staff')
    
    // Create authenticated request helper
    request = createAuthenticatedRequest(process.env.TEST_SERVER_URL || 'http://localhost:3000')
  })

  afterAll(async () => {
    await teardownTestDatabase(prisma, databaseUrl)
  })

  

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics for authenticated user', async () => {
      // Create test data
      const sku1 = await createTestSku(prisma)
      const sku2 = await createTestSku(prisma)
      const warehouse1 = await createTestWarehouse(prisma)
      const warehouse2 = await createTestWarehouse(prisma)

      // Create inventory balances
      await createTestInventoryBalance(prisma, sku1.id, warehouse1.id, { 
        currentCartons: 10, currentUnits: 240,
        totalQuantity: 100 
      })
      await createTestInventoryBalance(prisma, sku2.id, warehouse1.id, { 
        currentCartons: 10, currentUnits: 240,
        totalQuantity: 200 
      })
      await createTestInventoryBalance(prisma, sku1.id, warehouse2.id, { 
        currentCartons: 10, currentUnits: 240,
        totalQuantity: 150 
      })

      // Create recent transactions
      await createTestTransaction(prisma, sku1.id, warehouse1.id, regularUser.id, {
        transactionType: 'RECEIVE',
        cartonsIn: 10,
        transactionDate: new Date()
      })
      await createTestTransaction(prisma, sku2.id, warehouse1.id, regularUser.id, {
        transactionType: 'SHIP',
        cartonsOut: 3,
        transactionDate: new Date()
      })

      const response = await request
        .get('/api/dashboard/stats')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('totalSkus', 2)
      expect(response.body).toHaveProperty('totalWarehouses', 2)
      expect(response.body).toHaveProperty('totalInventory', 450)
      expect(response.body).toHaveProperty('recentTransactions')
      expect(response.body.recentTransactions).toHaveLength(2)
      expect(response.body).toHaveProperty('inventoryByWarehouse')
      expect(response.body).toHaveProperty('transactionSummary')
    })

    it('should return 401 for unauthenticated request', async () => {
      // Use supertest directly without auth headers for unauthenticated request
      const supertest = require('supertest')
      const response = await supertest(process.env.TEST_SERVER_URL || 'http://localhost:3000')
        .get('/api/dashboard/stats')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Unauthorized')
    })

    it('should include financial summary when requested', async () => {
      const warehouse = await createTestWarehouse(prisma)
      await createTestInvoice(prisma, warehouse.id, regularUser.id, adminUser.id, { 
        status: 'pending',
        totalAmount: 1000 
      })
      await createTestInvoice(prisma, warehouse.id, regularUser.id, adminUser.id, { 
        status: 'paid',
        totalAmount: 2000 
      })

      const response = await request
        .get('/api/dashboard/stats?includeFinancial=true')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('financialSummary')
      expect(response.body.financialSummary).toHaveProperty('totalPending', 1000)
      expect(response.body.financialSummary).toHaveProperty('totalPaid', 2000)
    })

    it('should filter by date range', async () => {
      const sku = await createTestSku(prisma)
      const warehouse = await createTestWarehouse(prisma)

      // Create transactions in different months
      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionDate: new Date('2024-01-01')
      })
      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionDate: new Date('2024-02-01')
      })
      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionDate: new Date('2024-03-01')
      })

      const response = await request
        .get('/api/dashboard/stats?startDate=2024-01-15&endDate=2024-02-15')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('recentTransactions')
      expect(response.body.recentTransactions).toHaveLength(1)
    })
  })

  describe('GET /api/reports', () => {
    it('should generate inventory summary report', async () => {
      const sku1 = await createTestSku(prisma, { skuCode: 'REPORT-001', description: 'Report Product 1' })
      const sku2 = await createTestSku(prisma, { skuCode: 'REPORT-002', description: 'Report Product 2' })
      const warehouse = await createTestWarehouse(prisma, { name: 'Report Warehouse' })

      await createTestInventoryBalance(prisma, sku1.id, warehouse.id, { 
        currentCartons: 10, currentUnits: 240,
        totalQuantity: 120 
      })
      await createTestInventoryBalance(prisma, sku2.id, warehouse.id, { 
        currentCartons: 10, currentUnits: 240,
        totalQuantity: 200 
      })

      const response = await request
        .get('/api/reports?type=inventory-summary')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('reportType', 'inventory-summary')
      expect(response.body).toHaveProperty('generatedAt')
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('summary')
      expect(response.body.data.summary).toHaveProperty('totalSkus', 2)
      expect(response.body.data.summary).toHaveProperty('totalQuantity', 320)
      expect(response.body.data.summary).toHaveProperty('totalAvailable', 300)
      expect(response.body.data).toHaveProperty('details')
      expect(response.body.data.details).toHaveLength(2)
    })

    it('should generate transaction history report', async () => {
      const sku = await createTestSku(prisma, { skuCode: 'TX-REPORT-001' })
      const warehouse = await createTestWarehouse(prisma)

      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionType: 'RECEIVE',
        cartonsIn: 10,
        transactionDate: new Date('2024-01-01')
      })
      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionType: 'SHIP',
        cartonsOut: 3,
        transactionDate: new Date('2024-01-15')
      })
      await createTestTransaction(prisma, sku.id, warehouse.id, regularUser.id, {
        transactionType: 'ADJUST_OUT',
        cartonsOut: 3,
        transactionDate: new Date('2024-01-20')
      })

      const response = await request
        .get('/api/reports?type=transaction-history&startDate=2024-01-01&endDate=2024-01-31')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('reportType', 'transaction-history')
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('transactions')
      expect(response.body.data.transactions).toHaveLength(3)
      expect(response.body.data).toHaveProperty('summary')
      expect(response.body.data.summary).toHaveProperty('totalReceived', 100)
      expect(response.body.data.summary).toHaveProperty('totalShipped', 30)
      expect(response.body.data.summary).toHaveProperty('totalAdjusted', 5)
    })

    it('should generate financial summary report', async () => {
      const warehouse = await createTestWarehouse(prisma)
      
      await createTestInvoice(prisma, warehouse.id, regularUser.id, adminUser.id, { 
        status: 'pending',
        totalAmount: 1000,
        invoiceDate: new Date('2024-01-15')
      })
      await createTestInvoice(prisma, warehouse.id, regularUser.id, adminUser.id, { 
        status: 'paid',
        totalAmount: 2000,
        invoiceDate: new Date('2024-01-20')
      })
      await createTestInvoice(prisma, warehouse.id, regularUser.id, adminUser.id, { 
        status: 'disputed',
        totalAmount: 500,
        invoiceDate: new Date('2024-01-25')
      })

      const response = await request
        .get('/api/reports?type=financial-summary&startDate=2024-01-01&endDate=2024-01-31')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('reportType', 'financial-summary')
      expect(response.body.data).toHaveProperty('totalInvoiced', 3500)
      expect(response.body.data).toHaveProperty('totalPaid', 2000)
      expect(response.body.data).toHaveProperty('totalPending', 1000)
      expect(response.body.data).toHaveProperty('totalDisputed', 500)
      expect(response.body.data).toHaveProperty('invoicesByStatus')
    })

    it('should generate SKU performance report', async () => {
      const sku1 = await createTestSku(prisma, { skuCode: 'PERF-001' })
      const sku2 = await createTestSku(prisma, { skuCode: 'PERF-002' })
      const warehouse = await createTestWarehouse(prisma)

      // Create transactions for SKU performance
      await createTestTransaction(prisma, sku1.id, warehouse.id, regularUser.id, {
        transactionType: 'RECEIVE',
        cartonsIn: 100,
        transactionDate: new Date('2024-01-01')
      })
      await createTestTransaction(prisma, sku1.id, warehouse.id, regularUser.id, {
        transactionType: 'SHIP',
        cartonsOut: 3,
        transactionDate: new Date('2024-01-15')
      })
      
      await createTestTransaction(prisma, sku2.id, warehouse.id, regularUser.id, {
        transactionType: 'RECEIVE',
        cartonsIn: 10,
        transactionDate: new Date('2024-01-01')
      })
      await createTestTransaction(prisma, sku2.id, warehouse.id, regularUser.id, {
        transactionType: 'SHIP',
        cartonsOut: 3,
        transactionDate: new Date('2024-01-20')
      })

      const response = await request
        .get('/api/reports?type=sku-performance&startDate=2024-01-01&endDate=2024-01-31')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('reportType', 'sku-performance')
      expect(response.body.data).toHaveProperty('skuMetrics')
      expect(response.body.data.skuMetrics).toHaveLength(2)
      
      const perf001 = response.body.data.skuMetrics.find((m: any) => m.skuCode === 'PERF-001')
      expect(perf001).toHaveProperty('turnoverRate')
      expect(perf001).toHaveProperty('totalReceived', 1000)
      expect(perf001).toHaveProperty('totalShipped', 800)
    })

    it('should generate warehouse utilization report', async () => {
      const warehouse1 = await createTestWarehouse(prisma, { 
        warehouseId: 'WH-UTIL-001',
        name: 'Utilization Warehouse 1' 
      })
      const warehouse2 = await createTestWarehouse(prisma, { 
        warehouseId: 'WH-UTIL-002',
        name: 'Utilization Warehouse 2' 
      })
      const sku = await createTestSku(prisma)

      await createTestInventoryBalance(prisma, sku.id, warehouse1.id, { 
        totalQuantity: 1000 
      })
      await createTestInventoryBalance(prisma, sku.id, warehouse2.id, { 
        totalQuantity: 500 
      })

      // Create transactions
      await createTestTransaction(prisma, sku.id, warehouse1.id, regularUser.id, {
        transactionType: 'RECEIVE',
        cartonsIn: 10,
        transactionDate: new Date()
      })
      await createTestTransaction(prisma, sku.id, warehouse2.id, regularUser.id, {
        transactionType: 'SHIP',
        cartonsOut: 5,
        transactionDate: new Date()
      })

      const response = await request
        .get('/api/reports?type=warehouse-utilization')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('reportType', 'warehouse-utilization')
      expect(response.body.data).toHaveProperty('warehouses')
      expect(response.body.data.warehouses).toHaveLength(2)
      
      const wh1 = response.body.data.warehouses.find((w: any) => w.warehouseId === 'WH-UTIL-001')
      expect(wh1).toHaveProperty('totalInventory', 1000)
      expect(wh1).toHaveProperty('transactionCount')
    })

    it('should validate report type', async () => {
      const response = await request
        .get('/api/reports?type=invalid-report')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error', expect.stringContaining('Invalid report type'))
    })

    it('should require date range for certain reports', async () => {
      const response = await request
        .get('/api/reports?type=transaction-history')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error', expect.stringContaining('Date range required'))
    })

    it('should export report as CSV when requested', async () => {
      const sku = await createTestSku(prisma, { skuCode: 'CSV-001' })
      const warehouse = await createTestWarehouse(prisma)
      await createTestInventoryBalance(prisma, sku.id, warehouse.id, { 
        currentCartons: 10, currentUnits: 240 
      })

      const response = await request
        .get('/api/reports?type=inventory-summary&format=csv')
        .withAuth('staff', regularUser.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/csv')
      expect(response.headers['content-disposition']).toContain('inventory-summary-report')
      expect(response.text).toContain('CSV-001')
    })

    it('should return 401 for unauthenticated request', async () => {
      // Use supertest directly without auth headers for unauthenticated request
      const supertest = require('supertest')
      const response = await supertest(process.env.TEST_SERVER_URL || 'http://localhost:3000')
        .get('/api/reports?type=inventory-summary')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Unauthorized')
    })
  })

  // Admin dashboard tests removed - admin dashboard page no longer exists
  // Admin users should use /admin/settings instead

  describe('GET /api/finance/reports', () => {
    it.skip('should generate cost analysis report - skipped: costLedger model not in schema', async () => {
      // This test is skipped because the costLedger model doesn't exist in the current schema
      // TODO: Update this test when cost ledger functionality is implemented
      expect(true).toBe(true)
    })

    it.skip('should generate profitability report - skipped: depends on costLedger model', async () => {
      // This test is skipped because it depends on the costLedger model which doesn't exist
      // TODO: Update this test when cost ledger functionality is implemented
      expect(true).toBe(true)
    })
  })
})