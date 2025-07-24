import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
}

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const defaultOptions: TransactionOptions = {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, // Changed from Serializable to avoid visibility issues
    maxWait: 5000,
    timeout: 10000,
    ...options
  };

  const result = await prisma.$transaction(fn, defaultOptions);
  
  // Force connection pool refresh after transaction
  if (process.env.NODE_ENV === 'development') {
    // In development, we need to ensure the connection pool sees the changes
    await prisma.$queryRaw`SELECT 1`;
  }
  
  return result;
}

export async function withLock<T>(
  tableName: string,
  lockKey: string,
  fn: () => Promise<T>
): Promise<T> {
  // Use advisory locks for PostgreSQL
  const lockId = hashStringToInt(lockKey);
  
  return withTransaction(async (tx) => {
    // Acquire lock
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`;
    
    // Execute function with transaction context
    const result = await fn();
    
    // Lock is automatically released at end of transaction
    return result;
  });
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Inventory-specific transaction helpers
export async function updateInventoryWithLock(
  warehouseId: string,
  skuId: string,
  batchLot: string,
  updateFn: (currentBalance: any, tx: Prisma.TransactionClient) => Promise<any>
): Promise<any> {
  const lockKey = `inventory:${warehouseId}:${skuId}:${batchLot}`;
  
  return withTransaction(async (tx) => {
    // Use SELECT FOR UPDATE to lock the row
    const balance = await tx.$queryRaw<any[]>`
      SELECT * FROM "inventory_balances" 
      WHERE "warehouse_id" = ${warehouseId} 
      AND "sku_id" = ${skuId} 
      AND "batch_lot" = ${batchLot}
      FOR UPDATE
    `;
    
    if (!balance || balance.length === 0) {
      // Create new balance if doesn't exist
      const newBalance = await tx.inventoryBalance.create({
        data: {
          warehouseId,
          skuId,
          batchLot,
          currentCartons: 0,
          currentPallets: 0,
          currentUnits: 0,
          lastTransactionDate: new Date()
        }
      });
      return updateFn(newBalance, tx);
    }
    
    // Execute update function with transaction context
    return updateFn(balance[0], tx);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 30000
  });
}

// Invoice number generation with lock
export async function generateInvoiceNumber(): Promise<string> {
  return withLock('invoice', 'invoice_number_generation', async () => {
    return withTransaction(async (tx) => {
      // Get the last invoice number
      const lastInvoice = await tx.invoice.findFirst({
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true }
      });
      
      let nextNumber = 1;
      if (lastInvoice?.invoiceNumber) {
        const match = lastInvoice.invoiceNumber.match(/\d+/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }
      
      return `INV-${String(nextNumber).padStart(6, '0')}`;
    });
  });
}

// Batch operation helpers
export async function processBatchOperation<T>(
  batchId: string,
  operation: 'split' | 'merge',
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = `batch:${batchId}:${operation}`;
  
  return withLock('inventory_balance', lockKey, fn);
}

// FIFO batch selection with lock
export async function selectFIFOBatchWithLock(
  warehouseId: string,
  skuId: string,
  requiredQuantity: number
): Promise<any[]> {
  return withTransaction(async (tx) => {
    // Use raw query with FOR UPDATE to lock rows
    const batches = await tx.$queryRaw<any[]>`
      SELECT * FROM "inventory_balances" 
      WHERE "warehouseId" = ${warehouseId} 
      AND "skuId" = ${skuId} 
      AND "current_cartons" > 0
      ORDER BY "last_transaction_date" ASC, "created_at" ASC
      FOR UPDATE
    `;

    const selectedBatches = [];
    let remainingQuantity = requiredQuantity;

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const quantityToTake = Math.min(batch.current_cartons, remainingQuantity);
      selectedBatches.push({
        ...batch,
        quantityToTake
      });
      remainingQuantity -= quantityToTake;
    }

    if (remainingQuantity > 0) {
      throw new Error(`Insufficient inventory. Required: ${requiredQuantity}, Available: ${requiredQuantity - remainingQuantity}`);
    }

    return selectedBatches;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

// Concurrent-safe counter increment
export async function incrementCounter(
  tableName: string,
  counterId: string,
  incrementBy: number = 1
): Promise<number> {
  const lockKey = `counter:${tableName}:${counterId}`;
  
  return withLock(tableName, lockKey, async () => {
    return withTransaction(async (tx) => {
      // This would be table-specific, example for a generic counter table
      const result = await tx.$queryRaw<{count: number}[]>`
        UPDATE counters 
        SET count = count + ${incrementBy}
        WHERE table_name = ${tableName} AND counter_id = ${counterId}
        RETURNING count
      `;
      
      return result[0]?.count || 0;
    });
  });
}

// Retry mechanism for deadlocks
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a deadlock or serialization error
      if (error.code === 'P2034' || 
          error.code === '40001' || // serialization_failure
          error.code === '40P01' || // deadlock_detected
          error.message?.includes('deadlock') ||
          error.message?.includes('could not serialize') ||
          error.message?.includes('concurrent update')) {
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Batch inventory update with proper locking
export async function updateInventoryBatch(
  updates: Array<{
    warehouseId: string;
    skuId: string;
    batchLot: string;
    cartonsChange: number;
    transactionType: string;
  }>
): Promise<any[]> {
  return withTransaction(async (tx) => {
    const results = [];
    
    // Sort updates to avoid deadlocks (consistent lock ordering)
    const sortedUpdates = [...updates].sort((a, b) => {
      const keyA = `${a.warehouseId}-${a.skuId}-${a.batchLot}`;
      const keyB = `${b.warehouseId}-${b.skuId}-${b.batchLot}`;
      return keyA.localeCompare(keyB);
    });
    
    // Pre-fetch all SKUs to reduce queries
    const skuIds = [...new Set(sortedUpdates.map(u => u.skuId))];
    const skus = await tx.sku.findMany({
      where: { id: { in: skuIds } }
    });
    const skuMap = new Map(skus.map(sku => [sku.id, sku]));
    
    for (const update of sortedUpdates) {
      // Lock and get current balance
      const balances = await tx.$queryRaw<any[]>`
        SELECT * FROM "inventory_balances" 
        WHERE "warehouse_id" = ${update.warehouseId} 
        AND "sku_id" = ${update.skuId} 
        AND "batch_lot" = ${update.batchLot}
        FOR UPDATE
      `;
      
      let balance = balances[0];
      const newCartons = (balance?.current_cartons || 0) + update.cartonsChange;
      
      // Validate no negative inventory
      if (newCartons < 0) {
        throw new Error(
          `Insufficient inventory for SKU ${update.skuId} batch ${update.batchLot}. ` +
          `Current: ${balance?.current_cartons || 0}, Requested change: ${update.cartonsChange}`
        );
      }
      
      // Get SKU from pre-fetched map
      const sku = skuMap.get(update.skuId);
      
      if (!sku) {
        throw new Error(`SKU not found: ${update.skuId}`);
      }
      
      const newUnits = newCartons * sku.unitsPerCarton;
      
      // Get the proper warehouse SKU configuration if not on balance record
      let storageCartonsPerPallet = balance?.storage_cartons_per_pallet;
      let shippingCartonsPerPallet = balance?.shipping_cartons_per_pallet;
      
      if (!storageCartonsPerPallet || !shippingCartonsPerPallet) {
        const warehouseConfig = await tx.warehouseSkuConfig.findFirst({
          where: {
            warehouseId: update.warehouseId,
            skuId: update.skuId,
            effectiveDate: { lte: new Date() },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } }
            ]
          },
          orderBy: { effectiveDate: 'desc' }
        });
        
        storageCartonsPerPallet = warehouseConfig?.storageCartonsPerPallet || balance?.storage_cartons_per_pallet || 50;
        shippingCartonsPerPallet = warehouseConfig?.shippingCartonsPerPallet || balance?.shipping_cartons_per_pallet || 50;
      }
      
      const newPallets = newCartons > 0 ? Math.ceil(newCartons / storageCartonsPerPallet) : 0;
      
      if (balance) {
        // Update existing balance
        const updated = await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            currentCartons: newCartons,
            currentPallets: newPallets,
            currentUnits: newUnits,
            lastTransactionDate: new Date(),
            lastUpdated: new Date()
          }
        });
        results.push(updated);
      } else if (newCartons > 0) {
        // Create new balance
        const created = await tx.inventoryBalance.create({
          data: {
            warehouseId: update.warehouseId,
            skuId: update.skuId,
            batchLot: update.batchLot,
            currentCartons: newCartons,
            currentPallets: newPallets,
            currentUnits: newUnits,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            lastTransactionDate: new Date()
          }
        });
        results.push(created);
      }
    }
    
    return results;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 30000
  });
}