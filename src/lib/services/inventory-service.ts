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
      
      // Now lock the inventory balance row for update using raw query
      const balances = await tx.$queryRaw<any[]>`
        SELECT * FROM "inventory_balances" 
        WHERE "warehouse_id" = ${validatedInput.warehouseId} 
        AND "sku_id" = ${validatedInput.skuId} 
        AND "batch_lot" = ${validatedInput.batchLot}
        FOR UPDATE
      `;
      
      const balance = balances[0]

      // Calculate new balance
      let currentCartons = balance?.current_cartons || 0
      let currentPallets = balance?.current_pallets || 0
      
      currentCartons += validatedInput.cartonsIn - validatedInput.cartonsOut
      
      // Validate that balance won't go negative
      if (currentCartons < 0) {
        throw new Error(`Insufficient inventory: ${currentCartons} cartons would remain`)
      }

      // Get SKU details for unit calculation
      const sku = await tx.sku.findUnique({
        where: { id: validatedInput.skuId }
      })
      
      if (!sku) {
        throw new Error('SKU not found')
      }

      const currentUnits = currentCartons * sku.unitsPerCarton

      // Calculate pallets based on configuration
      if (currentCartons > 0) {
        const cartonsPerPallet = validatedInput.storageCartonsPerPallet || 
                                balance?.storage_cartons_per_pallet || 
                                1
        currentPallets = Math.ceil(currentCartons / cartonsPerPallet)
      } else {
        currentPallets = 0
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

      // Update or create the balance with version increment
      const updatedBalance = await tx.inventoryBalance.upsert({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId: validatedInput.warehouseId,
            skuId: validatedInput.skuId,
            batchLot: validatedInput.batchLot,
          }
        },
        update: {
          currentCartons,
          currentPallets,
          currentUnits,
          lastTransactionDate: validatedInput.transactionDate,
          lastUpdated: new Date(),
          shippingCartonsPerPallet: validatedInput.shippingCartonsPerPallet || balance?.shipping_cartons_per_pallet,
          storageCartonsPerPallet: validatedInput.storageCartonsPerPallet || balance?.storage_cartons_per_pallet,
          version: { increment: 1 } // Increment version for optimistic locking
        },
        create: {
          warehouseId: validatedInput.warehouseId,
          skuId: validatedInput.skuId,
          batchLot: validatedInput.batchLot,
          currentCartons,
          currentPallets,
          currentUnits,
          lastTransactionDate: validatedInput.transactionDate,
          shippingCartonsPerPallet: validatedInput.shippingCartonsPerPallet,
          storageCartonsPerPallet: validatedInput.storageCartonsPerPallet,
          version: 1
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
          newBalance: currentCartons,
        }
      })

      return { transaction, balance: updatedBalance }
    }, {
      ...options,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  }

  /**
   * Get inventory balance with optimistic locking
   */
  static async getBalance(
    warehouseId: string,
    skuId: string,
    batchLot: string
  ) {
    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_skuId_batchLot: {
          warehouseId,
          skuId,
          batchLot,
        }
      },
      include: {
        warehouse: true,
        sku: true,
      }
    })

    return balance
  }

  /**
   * Bulk create transactions with proper validation and locking
   */
  static async createBulkTransactions(
    transactions: InventoryTransactionInput[],
    userId: string,
    options: TransactionOptions = {}
  ) {
    // Validate all inputs first
    const validatedTransactions = transactions.map(t => inventoryTransactionSchema.parse(t))
    
    return withTransaction(async (tx) => {
      const results = []
      
      // Group by warehouse/sku/batch to minimize lock contention
      const grouped = validatedTransactions.reduce((acc, t) => {
        const key = `${t.warehouseId}-${t.skuId}-${t.batchLot}`
        if (!acc[key]) acc[key] = []
        acc[key].push(t)
        return acc
      }, {} as Record<string, typeof validatedTransactions>)

      // Process each group
      for (const [key, groupTransactions] of Object.entries(grouped)) {
        const [warehouseId, skuId, batchLot] = key.split('-')
        
        // Get advisory lock for this group
        const lockKey = getAdvisoryLockKey(warehouseId, skuId, batchLot)
        const lockResult = await tx.$queryRaw<[{ pg_try_advisory_xact_lock: boolean }]>`
          SELECT pg_try_advisory_xact_lock(${lockKey}::bigint)
        `
        
        if (!lockResult[0]?.pg_try_advisory_xact_lock) {
          throw new Error(`Could not acquire lock for ${skuId}/${batchLot}. Please try again.`)
        }
        
        // Lock the balance for this group using raw query
        const balances = await tx.$queryRaw<any[]>`
          SELECT * FROM "inventory_balances" 
          WHERE "warehouse_id" = ${warehouseId} 
          AND "sku_id" = ${skuId} 
          AND "batch_lot" = ${batchLot}
          FOR UPDATE
        `;
        
        const balance = balances[0]

        let currentCartons = balance?.current_cartons || 0
        const createdTransactions = []

        // Get SKU for this group
        const sku = await tx.sku.findUnique({ where: { id: skuId } })
        if (!sku) {
          throw new Error(`SKU not found: ${skuId}`)
        }

        // Process transactions in order
        for (const t of groupTransactions) {
          currentCartons += t.cartonsIn - t.cartonsOut
          
          if (currentCartons < 0) {
            throw new Error(`Insufficient inventory for ${skuId}/${batchLot}: ${currentCartons} cartons would remain`)
          }

          const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          
          const transaction = await tx.inventoryTransaction.create({
            data: {
              warehouseId: t.warehouseId,
              skuId: t.skuId,
              batchLot: t.batchLot,
              transactionType: t.transactionType,
              referenceId: t.referenceId,
              cartonsIn: t.cartonsIn,
              cartonsOut: t.cartonsOut,
              storagePalletsIn: t.storagePalletsIn,
              shippingPalletsOut: t.shippingPalletsOut,
              transactionDate: t.transactionDate,
              pickupDate: t.pickupDate,
              shippingCartonsPerPallet: t.shippingCartonsPerPallet,
              storageCartonsPerPallet: t.storageCartonsPerPallet,
              shipName: t.shipName,
              trackingNumber: t.trackingNumber,
              modeOfTransportation: t.modeOfTransportation,
              attachments: t.attachments,
              transactionId,
              createdById: userId,
              unitsPerCarton: sku.unitsPerCarton, // Capture SKU value at transaction time
            }
          })
          
          createdTransactions.push(transaction)
        }

        // Update balance once for the group
        const currentUnits = currentCartons * (sku.unitsPerCarton || 1)
        const lastTransaction = groupTransactions[groupTransactions.length - 1]
        const cartonsPerPallet = lastTransaction.storageCartonsPerPallet || 
                                balance?.storage_cartons_per_pallet || 
                                1
        const currentPallets = currentCartons > 0 ? Math.ceil(currentCartons / cartonsPerPallet) : 0

        await tx.inventoryBalance.upsert({
          where: {
            warehouseId_skuId_batchLot: {
              warehouseId,
              skuId,
              batchLot,
            }
          },
          update: {
            currentCartons,
            currentPallets,
            currentUnits,
            lastTransactionDate: lastTransaction.transactionDate,
            lastUpdated: new Date(),
            version: { increment: 1 } // Increment version for optimistic locking
          },
          create: {
            warehouseId,
            skuId,
            batchLot,
            currentCartons,
            currentPallets,
            currentUnits,
            lastTransactionDate: lastTransaction.transactionDate,
            version: 1
          }
        })

        results.push(...createdTransactions)
      }

      // Bulk audit log
      await auditLog({
        entityType: 'InventoryTransaction',
        entityId: 'BULK',
        action: 'CREATE_BULK',
        userId,
        data: {
          count: results.length,
          transactionIds: results.map(t => t.transactionId),
        }
      })

      return results
    }, {
      ...options,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000, // 30 second timeout for bulk operations
    })
  }

  /**
   * Recalculate inventory balance for a specific SKU/batch/warehouse
   * This is a reliable method that recalculates from the full transaction history
   */
  static async recalculateBalance(
    warehouseId: string,
    skuId: string,
    batchLot: string
  ): Promise<void> {
    // Get all transactions for this specific combination
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        warehouseId,
        skuId,
        batchLot,
      },
      orderBy: { transactionDate: 'asc' }
    })
    
    // Calculate the balance from transaction history
    let currentCartons = 0
    let lastTransactionDate: Date | null = null
    let storageCartonsPerPallet: number | null = null
    let shippingCartonsPerPallet: number | null = null
    let totalUnits = 0
    
    for (const transaction of transactions) {
      currentCartons += transaction.cartonsIn - transaction.cartonsOut
      lastTransactionDate = transaction.transactionDate
      
      // Calculate units using transaction's captured unitsPerCarton if available
      if (transaction.unitsPerCarton) {
        totalUnits += (transaction.cartonsIn - transaction.cartonsOut) * transaction.unitsPerCarton
      }
      
      // Capture batch-specific config from first RECEIVE transaction
      if (transaction.transactionType === 'RECEIVE' && 
          transaction.storageCartonsPerPallet && 
          transaction.shippingCartonsPerPallet &&
          !storageCartonsPerPallet) {
        storageCartonsPerPallet = transaction.storageCartonsPerPallet
        shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
      }
    }
    
    // Never allow negative balance
    currentCartons = Math.max(0, currentCartons)
    
    // Get SKU info for unit calculation fallback
    const sku = await prisma.sku.findUnique({
      where: { id: skuId }
    })
    
    // If we didn't calculate units from transactions, use SKU master
    if (totalUnits === 0 && currentCartons > 0 && sku) {
      totalUnits = currentCartons * (sku.unitsPerCarton || 1)
    }
    
    // If no batch config found, get warehouse SKU config
    if (!storageCartonsPerPallet || !shippingCartonsPerPallet) {
      const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
        where: {
          warehouseId,
          skuId,
          effectiveDate: { lte: lastTransactionDate || new Date() },
          OR: [
            { endDate: null },
            { endDate: { gte: lastTransactionDate || new Date() } }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      })
      
      storageCartonsPerPallet = warehouseConfig?.storageCartonsPerPallet || storageCartonsPerPallet || 50
      shippingCartonsPerPallet = warehouseConfig?.shippingCartonsPerPallet || shippingCartonsPerPallet || 50
    }
    
    const currentPallets = storageCartonsPerPallet && currentCartons > 0
      ? Math.ceil(currentCartons / storageCartonsPerPallet)
      : 0
    
    // Update or create balance record
    if (currentCartons > 0 || transactions.length > 0) {
      await prisma.inventoryBalance.upsert({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId,
            skuId,
            batchLot,
          }
        },
        update: {
          currentCartons,
          currentPallets,
          currentUnits: totalUnits,
          storageCartonsPerPallet,
          shippingCartonsPerPallet,
          lastTransactionDate,
          lastUpdated: new Date(),
        },
        create: {
          warehouseId,
          skuId,
          batchLot,
          currentCartons,
          currentPallets,
          currentUnits: totalUnits,
          storageCartonsPerPallet,
          shippingCartonsPerPallet,
          lastTransactionDate,
        }
      })
    } else if (currentCartons === 0) {
      // Delete zero-balance record if it exists
      await prisma.inventoryBalance.deleteMany({
        where: {
          warehouseId,
          skuId,
          batchLot,
          currentCartons: 0
        }
      })
    }
  }

  /**
   * Calculate point-in-time inventory balance
   */
  static async getPointInTimeBalance(
    warehouseId: string,
    date: Date,
    options: { skuId?: string; batchLot?: string } = {}
  ) {
    const where: Prisma.InventoryTransactionWhereInput = {
      warehouseId,
      transactionDate: { lte: date },
    }

    if (options.skuId) where.skuId = options.skuId
    if (options.batchLot) where.batchLot = options.batchLot

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        sku: true,
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Calculate balances from transactions
    const balances = new Map<string, any>()
    
    for (const transaction of transactions) {
      const key = `${transaction.skuId}-${transaction.batchLot}`
      const current = balances.get(key) || {
        skuId: transaction.skuId,
        sku: transaction.sku,
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentUnits: 0,
        lastTransactionDate: null,
      }
      
      current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
      // Use transaction's unitsPerCarton if available, otherwise fall back to SKU master
      const unitsPerCarton = transaction.unitsPerCarton || transaction.sku.unitsPerCarton || 1
      current.currentUnits = current.currentCartons * unitsPerCarton
      current.lastTransactionDate = transaction.transactionDate
      
      balances.set(key, current)
    }

    return Array.from(balances.values()).filter(b => b.currentCartons > 0)
  }
}