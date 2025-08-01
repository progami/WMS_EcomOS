import { PrismaClient, Prisma, InventoryTransaction } from '@prisma/client'
import { createPerformanceLogger } from '@/lib/monitoring/performance'

const perf = createPerformanceLogger('service.inventory-balance')

export interface BalanceUpdate {
  warehouseId: string
  skuId: string
  batchLot: string
  cartonsChange: number
  unitsChange: number
  palletsChange: number
  lastTransactionId: string
  unitsPerCarton?: number
}

export class InventoryBalanceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Updates inventory balance atomically with transaction creation
   * Uses optimistic locking to handle concurrent updates
   */
  async updateBalanceWithTransaction(
    tx: Prisma.TransactionClient,
    transaction: InventoryTransaction & { sku?: { unitsPerCarton: number } }
  ): Promise<void> {
    const cartonsChange = transaction.cartonsIn - transaction.cartonsOut
    const palletsChange = transaction.storagePalletsIn - transaction.shippingPalletsOut
    const unitsPerCarton = transaction.sku?.unitsPerCarton || transaction.unitsPerCarton || 0
    const unitsChange = cartonsChange * unitsPerCarton

    await this.updateBalance(tx, {
      warehouseId: transaction.warehouseId,
      skuId: transaction.skuId,
      batchLot: transaction.batchLot,
      cartonsChange,
      unitsChange,
      palletsChange,
      lastTransactionId: transaction.id,
      unitsPerCarton
    })
  }

  /**
   * Updates or creates an inventory balance record
   * Implements retry logic for optimistic locking conflicts
   */
  private async updateBalance(
    tx: Prisma.TransactionClient,
    update: BalanceUpdate,
    retries = 3
  ): Promise<void> {
    try {
      await perf.measure('update_balance', async () => {
        // Try to find existing balance
        const existing = await tx.inventoryBalance.findUnique({
          where: {
            warehouseId_skuId_batchLot: {
              warehouseId: update.warehouseId,
              skuId: update.skuId,
              batchLot: update.batchLot
            }
          }
        })

        if (existing) {
          // Update existing balance with optimistic locking
          const result = await tx.inventoryBalance.updateMany({
            where: {
              warehouseId: update.warehouseId,
              skuId: update.skuId,
              batchLot: update.batchLot,
              version: existing.version // Optimistic lock
            },
            data: {
              currentCartons: { increment: update.cartonsChange },
              currentUnits: { increment: update.unitsChange },
              currentPallets: { increment: update.palletsChange },
              lastTransactionId: update.lastTransactionId,
              version: { increment: 1 }
            }
          })

          // If no rows updated, we have a version conflict
          if (result.count === 0) {
            throw new Error('Optimistic lock conflict')
          }
        } else {
          // Create new balance record
          await tx.inventoryBalance.create({
            data: {
              warehouseId: update.warehouseId,
              skuId: update.skuId,
              batchLot: update.batchLot,
              currentCartons: Math.max(0, update.cartonsChange),
              currentUnits: Math.max(0, update.unitsChange),
              currentPallets: Math.max(0, update.palletsChange),
              lastTransactionId: update.lastTransactionId,
              version: 0
            }
          })
        }
      })
    } catch (error: any) {
      // Retry on optimistic lock conflicts
      if (error.message === 'Optimistic lock conflict' && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
        return this.updateBalance(tx, update, retries - 1)
      }
      throw error
    }
  }

  /**
   * Recalculates balance for a specific SKU/warehouse/batch
   * Used for reconciliation and error recovery
   */
  async recalculateBalance(
    warehouseId: string,
    skuId: string,
    batchLot: string
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get all transactions for this combination
      const transactions = await tx.inventoryTransaction.findMany({
        where: { warehouseId, skuId, batchLot },
        include: { sku: true },
        orderBy: [
          { transactionDate: 'asc' },
          { createdAt: 'asc' }
        ]
      })

      // Calculate totals
      let totalCartons = 0
      let totalPallets = 0
      let lastTransactionId: string | null = null
      let unitsPerCarton = 0

      for (const tx of transactions) {
        totalCartons += tx.cartonsIn - tx.cartonsOut
        totalPallets += tx.storagePalletsIn - tx.shippingPalletsOut
        lastTransactionId = tx.id
        unitsPerCarton = tx.sku.unitsPerCarton
      }

      const totalUnits = totalCartons * unitsPerCarton

      // Update or create balance
      await tx.inventoryBalance.upsert({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId,
            skuId,
            batchLot
          }
        },
        create: {
          warehouseId,
          skuId,
          batchLot,
          currentCartons: Math.max(0, totalCartons),
          currentUnits: Math.max(0, totalUnits),
          currentPallets: Math.max(0, totalPallets),
          lastTransactionId,
          version: 0
        },
        update: {
          currentCartons: Math.max(0, totalCartons),
          currentUnits: Math.max(0, totalUnits),
          currentPallets: Math.max(0, totalPallets),
          lastTransactionId,
          version: { increment: 1 }
        }
      })
    })
  }

  /**
   * Gets current balance for a specific SKU/warehouse/batch
   */
  async getBalance(
    warehouseId: string,
    skuId: string,
    batchLot: string
  ) {
    return await this.prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_skuId_batchLot: {
          warehouseId,
          skuId,
          batchLot
        }
      },
      include: {
        warehouse: true,
        sku: true,
        lastTransaction: true
      }
    })
  }

  /**
   * Validates that stored balances match calculated balances
   * Returns array of discrepancies
   */
  async validateBalances(limit = 100): Promise<any[]> {
    const discrepancies: any[] = []
    
    const balances = await this.prisma.inventoryBalance.findMany({
      take: limit,
      orderBy: { lastUpdated: 'desc' }
    })

    for (const balance of balances) {
      // Calculate from transactions
      const transactions = await this.prisma.inventoryTransaction.findMany({
        where: {
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          batchLot: balance.batchLot
        }
      })

      let calculatedCartons = 0
      let calculatedPallets = 0

      for (const tx of transactions) {
        calculatedCartons += tx.cartonsIn - tx.cartonsOut
        calculatedPallets += tx.storagePalletsIn - tx.shippingPalletsOut
      }

      if (calculatedCartons !== balance.currentCartons || 
          calculatedPallets !== balance.currentPallets) {
        discrepancies.push({
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          batchLot: balance.batchLot,
          storedCartons: balance.currentCartons,
          calculatedCartons,
          cartonDifference: balance.currentCartons - calculatedCartons,
          storedPallets: balance.currentPallets,
          calculatedPallets,
          palletDifference: balance.currentPallets - calculatedPallets
        })
      }
    }

    return discrepancies
  }
}