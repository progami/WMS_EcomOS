import { prisma } from '@/lib/prisma'
import { CostCategory, TransactionType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { getBillingPeriod } from '@/lib/calculations/cost-aggregation'

interface TransactionItem {
  skuId: string
  batchLot: string
  quantityReceived?: number
  quantityShipped?: number
  unitsPerCarton?: number
  cartonsPerPallet?: number
  palletCount?: number
}

interface Transaction {
  transactionId: string
  transactionType: TransactionType
  warehouseId: string
  transactionDate: Date
  trackingNumber?: string | null
  items?: TransactionItem[]
  createdById: string
}

/**
 * Get the week ending date (Saturday) for a given date
 */
function getWeekEndingDate(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  result.setDate(result.getDate() + daysUntilSaturday)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Generate a unique calculated cost ID
 */
function generateCalculatedCostId(transaction: Transaction, costName: string, index: number = 0): string {
  return `${transaction.transactionId}-${costName.replace(/\s+/g, '-').toLowerCase()}-${index}`
}

/**
 * Calculate costs for a single transaction
 */
export async function triggerCostCalculation(transaction: Transaction) {
  try {
    // Get applicable cost rates for the warehouse
    const costRates = await prisma.costRate.findMany({
      where: {
        warehouseId: transaction.warehouseId,
        isActive: true,
        effectiveDate: {
          lte: transaction.transactionDate
        },
        OR: [
          { endDate: null },
          { endDate: { gte: transaction.transactionDate } }
        ]
      }
    })

    if (costRates.length === 0) {
      console.log(`No active cost rates found for warehouse ${transaction.warehouseId}`)
      return
    }

    const billingPeriod = getBillingPeriod(transaction.transactionDate)
    const billingWeekEnding = getWeekEndingDate(transaction.transactionDate)
    const calculatedCosts = []

    // Get transaction items if not already included
    let items = transaction.items
    if (!items || items.length === 0) {
      const itemsData = await prisma.inventoryTransactionItem.findMany({
        where: { transactionId: transaction.transactionId }
      })
      items = itemsData.map(item => ({
        skuId: item.skuId,
        batchLot: item.batchLot,
        quantityReceived: item.quantityReceived || 0,
        quantityShipped: item.quantityShipped || 0,
        unitsPerCarton: item.unitsPerCarton || 1,
        cartonsPerPallet: item.cartonsPerPallet || 1,
        palletCount: item.palletCount || 0
      }))
    }

    // Calculate total quantities across all items
    const totalQuantityReceived = items.reduce((sum, item) => sum + (item.quantityReceived || 0), 0)
    const totalQuantityShipped = items.reduce((sum, item) => sum + (item.quantityShipped || 0), 0)
    const totalPallets = items.reduce((sum, item) => sum + (item.palletCount || 0), 0)

    if (transaction.transactionType === 'RECEIVE') {
      // Container costs - only if tracking number exists
      if (transaction.trackingNumber) {
        const containerRates = costRates.filter(rate => 
          rate.costCategory === CostCategory.Container ||
          (rate.costName.toLowerCase().includes('container') ||
           rate.costName.toLowerCase().includes('terminal') ||
           rate.costName.toLowerCase().includes('port') ||
           rate.costName.toLowerCase().includes('customs') ||
           rate.costName.toLowerCase().includes('documentation') ||
           rate.costName.toLowerCase().includes('deferment') ||
           rate.costName.toLowerCase().includes('haulage') ||
           rate.costName.toLowerCase().includes('freight'))
        )

        containerRates.forEach((rate, index) => {
          const quantity = 1 // Container-related costs are per container
          const calculatedCost = new Decimal(rate.costValue).mul(quantity)
          
          calculatedCosts.push({
            calculatedCostId: generateCalculatedCostId(transaction, rate.costName, index),
            transactionType: transaction.transactionType,
            transactionReferenceId: transaction.transactionId,
            costRateId: rate.id,
            warehouseId: transaction.warehouseId,
            skuId: items[0]?.skuId || '', // Use first item's SKU
            batchLot: items[0]?.batchLot,
            transactionDate: transaction.transactionDate,
            billingWeekEnding: billingWeekEnding,
            billingPeriodStart: billingPeriod.start,
            billingPeriodEnd: billingPeriod.end,
            quantityCharged: new Decimal(quantity),
            applicableRate: rate.costValue,
            calculatedCost: calculatedCost,
            costAdjustmentValue: new Decimal(0),
            finalExpectedCost: calculatedCost,
            createdById: transaction.createdById
          })
        })
      }

      // Carton unloading costs
      const cartonUnloadingRate = costRates.find(rate => 
        rate.costCategory === CostCategory.Carton &&
        rate.costName.toLowerCase().includes('unloading')
      )
      
      if (cartonUnloadingRate && totalQuantityReceived > 0) {
        const calculatedCost = new Decimal(cartonUnloadingRate.costValue).mul(totalQuantityReceived)
        
        calculatedCosts.push({
          calculatedCostId: generateCalculatedCostId(transaction, cartonUnloadingRate.costName, 0),
          transactionType: transaction.transactionType,
          transactionReferenceId: transaction.transactionId,
          costRateId: cartonUnloadingRate.id,
          warehouseId: transaction.warehouseId,
          skuId: items[0]?.skuId || '',
          batchLot: items[0]?.batchLot,
          transactionDate: transaction.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(totalQuantityReceived),
          applicableRate: cartonUnloadingRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: transaction.createdById
        })
      }

      // Pallet handling costs
      const palletHandlingRate = costRates.find(rate => 
        rate.costCategory === CostCategory.Pallet &&
        rate.costName.toLowerCase().includes('handling')
      )
      
      if (palletHandlingRate && totalPallets > 0) {
        const calculatedCost = new Decimal(palletHandlingRate.costValue).mul(totalPallets)
        
        calculatedCosts.push({
          calculatedCostId: generateCalculatedCostId(transaction, palletHandlingRate.costName, 0),
          transactionType: transaction.transactionType,
          transactionReferenceId: transaction.transactionId,
          costRateId: palletHandlingRate.id,
          warehouseId: transaction.warehouseId,
          skuId: items[0]?.skuId || '',
          batchLot: items[0]?.batchLot,
          transactionDate: transaction.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(totalPallets),
          applicableRate: palletHandlingRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: transaction.createdById
        })
      }
    } else if (transaction.transactionType === 'SHIP') {
      // Carton handling costs
      const cartonHandlingRate = costRates.find(rate => 
        rate.costCategory === CostCategory.Carton &&
        rate.costName.toLowerCase().includes('handling') &&
        !rate.costName.toLowerCase().includes('unloading')
      )
      
      if (cartonHandlingRate && totalQuantityShipped > 0) {
        const calculatedCost = new Decimal(cartonHandlingRate.costValue).mul(totalQuantityShipped)
        
        calculatedCosts.push({
          calculatedCostId: generateCalculatedCostId(transaction, cartonHandlingRate.costName, 0),
          transactionType: transaction.transactionType,
          transactionReferenceId: transaction.transactionId,
          costRateId: cartonHandlingRate.id,
          warehouseId: transaction.warehouseId,
          skuId: items[0]?.skuId || '',
          batchLot: items[0]?.batchLot,
          transactionDate: transaction.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(totalQuantityShipped),
          applicableRate: cartonHandlingRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: transaction.createdById
        })
      }

      // Pallet handling costs
      const palletHandlingRate = costRates.find(rate => 
        rate.costCategory === CostCategory.Pallet &&
        rate.costName.toLowerCase().includes('handling')
      )
      
      if (palletHandlingRate && totalPallets > 0) {
        const calculatedCost = new Decimal(palletHandlingRate.costValue).mul(totalPallets)
        
        calculatedCosts.push({
          calculatedCostId: generateCalculatedCostId(transaction, palletHandlingRate.costName, 0),
          transactionType: transaction.transactionType,
          transactionReferenceId: transaction.transactionId,
          costRateId: palletHandlingRate.id,
          warehouseId: transaction.warehouseId,
          skuId: items[0]?.skuId || '',
          batchLot: items[0]?.batchLot,
          transactionDate: transaction.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(totalPallets),
          applicableRate: palletHandlingRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: transaction.createdById
        })
      }

      // Transport costs (LTL/FTL)
      const transportRates = costRates.filter(rate => 
        rate.costName.toUpperCase() === 'LTL' || 
        rate.costName.toUpperCase() === 'FTL'
      )

      // For simplicity, assume LTL if tracking number exists
      const transportRate = transportRates.find(rate => 
        transaction.trackingNumber ? rate.costName.toUpperCase() === 'LTL' : false
      )

      if (transportRate) {
        const quantity = 1 // Per shipment
        const calculatedCost = new Decimal(transportRate.costValue).mul(quantity)
        
        calculatedCosts.push({
          calculatedCostId: generateCalculatedCostId(transaction, transportRate.costName, 0),
          transactionType: transaction.transactionType,
          transactionReferenceId: transaction.transactionId,
          costRateId: transportRate.id,
          warehouseId: transaction.warehouseId,
          skuId: items[0]?.skuId || '',
          batchLot: items[0]?.batchLot,
          transactionDate: transaction.transactionDate,
          billingWeekEnding: billingWeekEnding,
          billingPeriodStart: billingPeriod.start,
          billingPeriodEnd: billingPeriod.end,
          quantityCharged: new Decimal(quantity),
          applicableRate: transportRate.costValue,
          calculatedCost: calculatedCost,
          costAdjustmentValue: new Decimal(0),
          finalExpectedCost: calculatedCost,
          createdById: transaction.createdById
        })
      }
    }

    // Create all calculated costs in the database
    if (calculatedCosts.length > 0) {
      await prisma.calculatedCost.createMany({
        data: calculatedCosts,
        skipDuplicates: true // Skip if calculatedCostId already exists
      })
      
      console.log(`Created ${calculatedCosts.length} calculated costs for transaction ${transaction.transactionId}`)
    }
  } catch (error) {
    console.error('Error calculating costs for transaction:', error)
    throw error
  }
}

export function shouldCalculateCosts(transaction: any): boolean {
  // Calculate costs for RECEIVE and SHIP transactions
  return transaction.transactionType === 'RECEIVE' || transaction.transactionType === 'SHIP'
}

export function validateTransactionForCostCalculation(transaction: any): boolean {
  // Validate that transaction has required fields
  return (
    transaction.transactionId &&
    transaction.transactionType &&
    transaction.warehouseId &&
    transaction.transactionDate &&
    (transaction.transactionType === 'RECEIVE' || transaction.transactionType === 'SHIP')
  )
}

export async function getPendingCostCalculations() {
  // Find transactions without calculated costs
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: { in: ['RECEIVE', 'SHIP'] },
      calculatedCosts: {
        none: {}
      }
    },
    include: {
      items: true
    },
    take: 100
  })

  return transactions
}

export async function triggerWeeklyStorageCalculation(weekEndingDate?: Date, userId?: string, warehouseId?: string) {
  const errors: string[] = []
  let processed = 0
  
  try {
    // Default to current week ending if not provided
    const weekEnd = weekEndingDate || getWeekEndingDate(new Date())
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    
    // Get billing period for the week
    const { year, month } = getBillingPeriod(weekEnd)
    
    // Get warehouses to process
    const warehouseCondition = warehouseId ? { id: warehouseId } : {}
    const warehouses = await prisma.warehouse.findMany({
      where: warehouseCondition
    })
    
    for (const warehouse of warehouses) {
      // Get storage cost rate for this warehouse
      const storageCostRate = await prisma.costRate.findFirst({
        where: {
          warehouseId: warehouse.id,
          costCategory: 'STORAGE',
          isActive: true,
          effectiveDate: { lte: weekEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: weekStart } }
          ]
        }
      })
      
      if (!storageCostRate) {
        errors.push(`No active storage rate found for warehouse ${warehouse.name}`)
        continue
      }
      
      // Get inventory balances at week end
      const inventoryBalances = await prisma.inventoryBalance.findMany({
        where: {
          warehouseId: warehouse.id,
          quantity: { gt: 0 }
        },
        include: {
          sku: true
        }
      })
      
      // Calculate storage costs for each SKU
      for (const balance of inventoryBalances) {
        if (balance.quantity === 0) continue
        
        // Get cartons per pallet for this SKU/warehouse
        const config = await prisma.warehouseSkuConfig.findUnique({
          where: {
            warehouseId_skuId: {
              warehouseId: warehouse.id,
              skuId: balance.skuId
            }
          }
        })
        
        const cartonsPerPallet = config?.cartonsPerPallet || 20
        const palletCount = Math.ceil(balance.quantity / cartonsPerPallet)
        
        // Calculate weekly storage cost
        const weeklyStorageCost = new Decimal(palletCount).mul(storageCostRate.costValue)
        
        if (weeklyStorageCost.gt(0)) {
          // Create calculated cost record
          const calculatedCostId = `storage-${warehouse.id}-${balance.skuId}-${weekEnd.toISOString().split('T')[0]}`
          
          await prisma.calculatedCost.upsert({
            where: { id: calculatedCostId },
            create: {
              id: calculatedCostId,
              costRateId: storageCostRate.id,
              warehouseId: warehouse.id,
              skuId: balance.skuId,
              costCategory: 'STORAGE',
              costName: 'Storage per Week',
              calculationType: 'WEEKLY_STORAGE',
              units: new Decimal(palletCount),
              unitCost: storageCostRate.costValue,
              totalCost: weeklyStorageCost,
              billingPeriodYear: year,
              billingPeriodMonth: month,
              effectiveDate: weekStart,
              calculatedDate: new Date(),
              createdById: userId || 'SYSTEM'
            },
            update: {
              units: new Decimal(palletCount),
              totalCost: weeklyStorageCost,
              calculatedDate: new Date()
            }
          })
          
          processed++
        }
      }
    }
    
    // Create storage ledger entries for the week
    for (const warehouse of warehouses) {
      const ledgerEntry = await prisma.storageLedger.create({
        data: {
          warehouseId: warehouse.id,
          weekEndingDate: weekEnd,
          calculatedAt: new Date(),
          createdById: userId || 'SYSTEM'
        }
      })
      
      // Log the calculation
      await prisma.auditLog.create({
        data: {
          entityType: 'StorageLedger',
          entityId: ledgerEntry.id,
          action: 'CREATE',
          userId: userId || 'SYSTEM',
          data: {
            weekEndingDate: weekEnd.toISOString(),
            warehouse: warehouse.name
          }
        }
      })
    }
    
    return {
      processed,
      errors
    }
  } catch (error: any) {
    errors.push(`Storage calculation error: ${error.message}`)
    return {
      processed,
      errors
    }
  }
}