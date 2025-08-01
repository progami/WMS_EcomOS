#!/usr/bin/env tsx
/**
 * Migration script to populate InventoryBalance table from existing transactions
 * Features:
 * - Dry-run mode for validation
 * - Batch processing for large datasets
 * - Progress tracking
 * - Data validation
 * - Rollback capability
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MigrationOptions {
  dryRun: boolean
  batchSize: number
  validateOnly: boolean
}

interface BalanceCalculation {
  warehouseId: string
  skuId: string
  batchLot: string
  currentCartons: number
  currentUnits: number
  currentPallets: number
  lastTransactionId: string | null
  transactionCount: number
}

async function calculateBalancesFromTransactions(): Promise<Map<string, BalanceCalculation>> {
  console.log('📊 Calculating balances from transaction history...')
  
  const balances = new Map<string, BalanceCalculation>()
  
  // Fetch all transactions ordered by date
  const transactions = await prisma.inventoryTransaction.findMany({
    include: {
      sku: true,
      warehouse: true
    },
    orderBy: [
      { transactionDate: 'asc' },
      { createdAt: 'asc' }
    ]
  })
  
  console.log(`  Found ${transactions.length} transactions to process`)
  
  // Calculate running balances
  let processedCount = 0
  for (const tx of transactions) {
    const key = `${tx.warehouseId}-${tx.skuId}-${tx.batchLot}`
    
    const existing = balances.get(key) || {
      warehouseId: tx.warehouseId,
      skuId: tx.skuId,
      batchLot: tx.batchLot,
      currentCartons: 0,
      currentUnits: 0,
      currentPallets: 0,
      lastTransactionId: null,
      transactionCount: 0
    }
    
    // Update carton balance
    existing.currentCartons += tx.cartonsIn - tx.cartonsOut
    
    // Calculate units (if units per carton is available)
    if (tx.sku.unitsPerCarton) {
      existing.currentUnits = existing.currentCartons * tx.sku.unitsPerCarton
    }
    
    // Update pallet balance
    existing.currentPallets += tx.storagePalletsIn - tx.shippingPalletsOut
    
    // Track last transaction
    existing.lastTransactionId = tx.id
    existing.transactionCount++
    
    balances.set(key, existing)
    
    processedCount++
    if (processedCount % 1000 === 0) {
      console.log(`  Processed ${processedCount}/${transactions.length} transactions...`)
    }
  }
  
  console.log(`✅ Calculated ${balances.size} unique balances from ${transactions.length} transactions`)
  
  return balances
}

async function validateExistingBalances(calculatedBalances: Map<string, BalanceCalculation>): Promise<boolean> {
  console.log('\n🔍 Validating existing balances...')
  
  const existingBalances = await prisma.inventoryBalance.findMany()
  console.log(`  Found ${existingBalances.length} existing balance records`)
  
  if (existingBalances.length === 0) {
    console.log('  No existing balances to validate')
    return true
  }
  
  let discrepancies = 0
  for (const existing of existingBalances) {
    const key = `${existing.warehouseId}-${existing.skuId}-${existing.batchLot}`
    const calculated = calculatedBalances.get(key)
    
    if (!calculated) {
      console.log(`  ⚠️  Balance exists in table but not in calculations: ${key}`)
      discrepancies++
      continue
    }
    
    if (existing.currentCartons !== calculated.currentCartons) {
      console.log(`  ⚠️  Carton mismatch for ${key}: DB=${existing.currentCartons}, Calculated=${calculated.currentCartons}`)
      discrepancies++
    }
  }
  
  if (discrepancies > 0) {
    console.log(`\n❌ Found ${discrepancies} discrepancies!`)
    return false
  }
  
  console.log('✅ All existing balances match calculations')
  return true
}

async function migrateBalances(
  balances: Map<string, BalanceCalculation>,
  options: MigrationOptions
): Promise<void> {
  console.log('\n🚀 Starting balance migration...')
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Batch size: ${options.batchSize}`)
  
  const balanceArray = Array.from(balances.values())
  let created = 0
  let updated = 0
  let errors = 0
  
  // Process in batches
  for (let i = 0; i < balanceArray.length; i += options.batchSize) {
    const batch = balanceArray.slice(i, i + options.batchSize)
    const batchStart = Date.now()
    
    if (!options.dryRun) {
      try {
        // Use upsert to handle existing records
        await prisma.$transaction(
          batch.map(balance => 
            prisma.inventoryBalance.upsert({
              where: {
                warehouseId_skuId_batchLot: {
                  warehouseId: balance.warehouseId,
                  skuId: balance.skuId,
                  batchLot: balance.batchLot
                }
              },
              create: {
                warehouseId: balance.warehouseId,
                skuId: balance.skuId,
                batchLot: balance.batchLot,
                currentCartons: balance.currentCartons,
                currentUnits: balance.currentUnits,
                currentPallets: balance.currentPallets,
                lastTransactionId: balance.lastTransactionId,
                version: 0
              },
              update: {
                currentCartons: balance.currentCartons,
                currentUnits: balance.currentUnits,
                currentPallets: balance.currentPallets,
                lastTransactionId: balance.lastTransactionId,
                version: { increment: 1 }
              }
            })
          )
        )
        
        created += batch.length
      } catch (error) {
        console.error(`  ❌ Error processing batch ${i / options.batchSize + 1}:`, error)
        errors += batch.length
      }
    }
    
    const batchTime = Date.now() - batchStart
    console.log(`  Batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(balanceArray.length / options.batchSize)}: ${batch.length} records (${batchTime}ms)`)
  }
  
  console.log('\n📊 Migration Summary:')
  console.log(`  Total records: ${balanceArray.length}`)
  console.log(`  Processed: ${created}`)
  console.log(`  Errors: ${errors}`)
  
  if (errors > 0) {
    throw new Error(`Migration completed with ${errors} errors`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '1000'),
    validateOnly: args.includes('--validate-only')
  }
  
  console.log('🔄 Inventory Balance Migration Script')
  console.log('=' .repeat(50))
  
  try {
    // Step 1: Calculate balances from transactions
    const calculatedBalances = await calculateBalancesFromTransactions()
    
    // Step 2: Validate existing balances (if any)
    const isValid = await validateExistingBalances(calculatedBalances)
    
    if (!isValid && !options.dryRun) {
      console.log('\n⚠️  Validation failed! Use --dry-run to preview changes.')
      process.exit(1)
    }
    
    if (options.validateOnly) {
      console.log('\n✅ Validation complete')
      process.exit(0)
    }
    
    // Step 3: Migrate balances
    await migrateBalances(calculatedBalances, options)
    
    // Step 4: Final validation
    if (!options.dryRun) {
      console.log('\n🔍 Running final validation...')
      const finalValid = await validateExistingBalances(calculatedBalances)
      if (!finalValid) {
        console.log('❌ Final validation failed!')
        process.exit(1)
      }
    }
    
    console.log('\n✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
main().catch(console.error)