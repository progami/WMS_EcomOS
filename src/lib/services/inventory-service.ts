import { Prisma, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withTransaction, TransactionOptions } from '@/lib/database/transaction-utils'
import { auditLog } from '@/lib/security/audit-logger'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { Money } from '@/lib/financial/money-utils'
import { z } from 'zod'
import crypto from 'crypto'

// Input validation schemas
const inventoryTransactionSchema = z.object({
  warehouseId: z.string().uuid(),
  skuId: z.string().uuid(),
  batchLot: z.string().min(1).max(100),
  transactionType: z.nativeEnum(TransactionType),
  referenceId: z.string().optional(),
  cartonsIn: z.number().int().min(0).default(0),
  cartonsOut: z.number().int().min(0).default(0),
  storagePalletsIn: z.number().int().min(0).default(0),
  shippingPalletsOut: z.number().int().min(0).default(0),
  transactionDate: z.date(),
  pickupDate: z.date().optional(),
  shippingCartonsPerPallet: z.number().int().positive().optional(),
  storageCartonsPerPallet: z.number().int().positive().optional(),
  shipName: z.string().optional(),
  trackingNumber: z.string().optional(),
  modeOfTransportation: z.string().optional(),
  attachments: z.any().optional(),
})

type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>

/**
 * Generate a hash key for advisory locks based on warehouse, SKU, and batch
 * PostgreSQL advisory locks use bigint, so we need to convert string to number
 */
function getAdvisoryLockKey(warehouseId: string, skuId: string, batchLot: string): bigint {
  const hash = crypto
    .createHash('sha256')
    .update(`${warehouseId}-${skuId}-${batchLot}`)
    .digest()
  
  // Take first 8 bytes and convert to bigint
  // Use absolute value to ensure positive number
  const lockKey = BigInt('0x' + hash.subarray(0, 8).toString('hex'))
  return lockKey > BigInt(0) ? lockKey : -lockKey
}

export class InventoryService {
  /**
   * Create an inventory transaction with proper locking and validation
   */
  static async createTransaction(
    input: InventoryTransactionInput,
    userId: string,
    options: TransactionOptions = {}
  ) {
    // Validate input
    const validatedInput = inventoryTransactionSchema.parse(input)
    
    return withTransaction(async (tx) => {
      // Get advisory lock first to prevent concurrent modifications
      const lockKey = getAdvisoryLockKey(
        validatedInput.warehouseId, 
        validatedInput.skuId, 
        validatedInput.batchLot
      )
      
      // Try to acquire advisory lock (wait up to 5 seconds)
      const lockResult = await tx.$queryRaw<[{ pg_try_advisory_xact_lock: boolean }]>`
        SELECT pg_try_advisory_xact_lock(${lockKey}::bigint)
      `
      
      if (!lockResult[0]?.pg_try_advisory_xact_lock) {
        throw new Error('Could not acquire lock for inventory operation. Please try again.')
      }
      
      // Calculate current balance from existing transactions
      const existingTransactions = await tx.inventoryTransaction.findMany({
        where: {
          warehouseId: validatedInput.warehouseId,
          skuId: validatedInput.skuId,
          batchLot: validatedInput.batchLot,
          transactionDate: { lte: validatedInput.transactionDate }
        }
      })
      
      let currentCartons = 0
      for (const txn of existingTransactions) {
        currentCartons += txn.cartonsIn - txn.cartonsOut
      }
      
      // Calculate new balance after this transaction
      const newBalance = currentCartons + validatedInput.cartonsIn - validatedInput.cartonsOut
      
      // Validate that balance won't go negative
      if (newBalance < 0) {
        throw new Error(`Insufficient inventory: only ${currentCartons} cartons available, attempting to ship ${validatedInput.cartonsOut}`)
      }

      // Get SKU details for unit calculation
      const sku = await tx.sku.findUnique({
        where: { id: validatedInput.skuId }
      })
      
      if (!sku) {
        throw new Error('SKU not found')
      }

      // Generate transaction ID
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // Create the transaction with units per carton captured
      const transaction = await tx.inventoryTransaction.create({
        data: {
          warehouseId: validatedInput.warehouseId,
          skuId: validatedInput.skuId,
          batchLot: validatedInput.batchLot,
          transactionType: validatedInput.transactionType,
          referenceId: validatedInput.referenceId,
          cartonsIn: validatedInput.cartonsIn,
          cartonsOut: validatedInput.cartonsOut,
          storagePalletsIn: validatedInput.storagePalletsIn,
          shippingPalletsOut: validatedInput.shippingPalletsOut,
          transactionDate: validatedInput.transactionDate,
          pickupDate: validatedInput.pickupDate,
          shippingCartonsPerPallet: validatedInput.shippingCartonsPerPallet,
          storageCartonsPerPallet: validatedInput.storageCartonsPerPallet,
          shipName: validatedInput.shipName,
          trackingNumber: validatedInput.trackingNumber,
          modeOfTransportation: validatedInput.modeOfTransportation,
          attachments: validatedInput.attachments,
          transactionId,
          createdById: userId,
          unitsPerCarton: sku.unitsPerCarton, // Capture SKU value at transaction time
        },
        include: {
          warehouse: true,
          sku: true,
        }
      })

      // Audit log
      await auditLog({
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        action: 'CREATE',
        userId,
        data: {
          transactionType: validatedInput.transactionType,
          cartonsIn: validatedInput.cartonsIn,
          cartonsOut: validatedInput.cartonsOut,
          newBalance,
        }
      })

      return transaction
    }, options)
  }

  /**
   * Check if sufficient inventory is available (runtime calculation)
   */
  static async checkAvailability(
    warehouseId: string,
    skuId: string,
    batchLot: string,
    requiredCartons: number,
    asOfDate: Date = new Date()
  ): Promise<{ available: boolean; currentCartons: number }> {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        warehouseId,
        skuId,
        batchLot,
        transactionDate: { lte: asOfDate }
      }
    })
    
    let currentCartons = 0
    for (const txn of transactions) {
      currentCartons += txn.cartonsIn - txn.cartonsOut
    }
    
    return {
      available: currentCartons >= requiredCartons,
      currentCartons
    }
  }

  /**
   * Bulk check availability for multiple items
   */
  static async bulkCheckAvailability(
    items: Array<{
      warehouseId: string
      skuId: string
      batchLot: string
      requiredCartons: number
    }>,
    asOfDate: Date = new Date()
  ) {
    const results = await Promise.all(
      items.map(item => 
        this.checkAvailability(
          item.warehouseId,
          item.skuId,
          item.batchLot,
          item.requiredCartons,
          asOfDate
        )
      )
    )
    
    return items.map((item, index) => ({
      ...item,
      ...results[index]
    }))
  }

  /**
   * Get inventory history for a specific item
   */
  static async getInventoryHistory(
    warehouseId: string,
    skuId: string,
    batchLot: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {
      warehouseId,
      skuId,
      batchLot
    }
    
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = startDate
      if (endDate) where.transactionDate.lte = endDate
    }
    
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [
        { transactionDate: 'desc' },
        { createdAt: 'desc' }
      ]
    })
    
    // Calculate running balance
    let runningBalance = 0
    const transactionsWithBalance = transactions.reverse().map(txn => {
      runningBalance += txn.cartonsIn - txn.cartonsOut
      return {
        ...txn,
        runningBalance,
        units: runningBalance * (txn.unitsPerCarton || txn.sku.unitsPerCarton)
      }
    }).reverse()
    
    return transactionsWithBalance
  }

  /**
   * Transfer inventory between warehouses
   */
  static async transferInventory(
    fromWarehouseId: string,
    toWarehouseId: string,
    skuId: string,
    batchLot: string,
    cartonsToTransfer: number,
    userId: string,
    transferDate: Date = new Date(),
    referenceId?: string
  ) {
    return withTransaction(async (tx) => {
      // Create outbound transaction from source warehouse
      const outboundTxn = await this.createTransaction({
        warehouseId: fromWarehouseId,
        skuId,
        batchLot,
        transactionType: TransactionType.TRANSFER,
        cartonsIn: 0,
        cartonsOut: cartonsToTransfer,
        transactionDate: transferDate,
        referenceId: referenceId || `TRANSFER-${Date.now()}`
      }, userId, { tx })
      
      // Create inbound transaction to destination warehouse
      const inboundTxn = await this.createTransaction({
        warehouseId: toWarehouseId,
        skuId,
        batchLot,
        transactionType: TransactionType.TRANSFER,
        cartonsIn: cartonsToTransfer,
        cartonsOut: 0,
        transactionDate: transferDate,
        referenceId: outboundTxn.referenceId
      }, userId, { tx })
      
      return {
        outbound: outboundTxn,
        inbound: inboundTxn
      }
    })
  }

  /**
   * Perform inventory adjustment
   */
  static async adjustInventory(
    warehouseId: string,
    skuId: string,
    batchLot: string,
    adjustmentCartons: number,
    userId: string,
    reason: string,
    adjustmentDate: Date = new Date()
  ) {
    const transactionType = adjustmentCartons > 0 
      ? TransactionType.ADJUST_IN 
      : TransactionType.ADJUST_OUT
    
    const cartonsIn = adjustmentCartons > 0 ? Math.abs(adjustmentCartons) : 0
    const cartonsOut = adjustmentCartons < 0 ? Math.abs(adjustmentCartons) : 0
    
    return this.createTransaction({
      warehouseId,
      skuId,
      batchLot,
      transactionType,
      cartonsIn,
      cartonsOut,
      transactionDate: adjustmentDate,
      referenceId: reason
    }, userId)
  }

  /**
   * Get inventory summary across all warehouses for a SKU
   */
  static async getSkuInventorySummary(skuId: string, asOfDate: Date = new Date()) {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        skuId,
        transactionDate: { lte: asOfDate }
      },
      include: {
        warehouse: true
      }
    })
    
    // Group by warehouse and batch
    const summary = new Map<string, any>()
    
    for (const txn of transactions) {
      const key = `${txn.warehouseId}-${txn.batchLot}`
      const current = summary.get(key) || {
        warehouse: txn.warehouse,
        batchLot: txn.batchLot,
        currentCartons: 0,
        transactions: 0
      }
      
      current.currentCartons += txn.cartonsIn - txn.cartonsOut
      current.transactions++
      summary.set(key, current)
    }
    
    // Filter out zero balances and convert to array
    return Array.from(summary.values())
      .filter(item => item.currentCartons > 0)
      .sort((a, b) => {
        if (a.warehouse.name !== b.warehouse.name) {
          return a.warehouse.name.localeCompare(b.warehouse.name)
        }
        return a.batchLot.localeCompare(b.batchLot)
      })
  }
}