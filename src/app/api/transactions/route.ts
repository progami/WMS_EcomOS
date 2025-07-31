import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { businessLogger, perfLogger } from '@/lib/logger/index'
import { sanitizeForDisplay, validateAlphanumeric, validatePositiveInteger } from '@/lib/security/input-sanitization'
import { triggerCostCalculation, shouldCalculateCosts, validateTransactionForCostCalculation } from '@/lib/triggers/inventory-transaction-triggers'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const includeAttachments = searchParams.get('includeAttachments') === 'true'

    const transactions = await prisma.inventoryTransaction.findMany({
      take: limit,
      orderBy: { transactionDate: 'desc' },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true }
        },
        sku: {
          select: { id: true, skuCode: true, description: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        }
      }
    })

    // Extract notes from attachments for each transaction
    const transactionsWithNotes = transactions.map(transaction => {
      let notes = null;
      if (transaction.attachments && Array.isArray(transaction.attachments)) {
        const notesAttachment = (transaction.attachments as any[]).find(att => att.type === 'notes');
        if (notesAttachment) {
          notes = notesAttachment.content;
        }
      }
      
      return {
        ...transaction,
        notes
      };
    });

    return NextResponse.json({ transactions: transactionsWithNotes })
  } catch (error) {
    // console.error('Failed to fetch transactions:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch transactions' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, transactionType, referenceNumber, referenceId, date, transactionDate, pickupDate, items, shipName, trackingNumber, attachments, modeOfTransportation, notes, 
            warehouseId: bodyWarehouseId, skuId, batchLot, cartonsIn, cartonsOut, storagePalletsIn, shippingPalletsOut, supplier } = body
    
    // Sanitize text inputs
    const sanitizedReferenceNumber = referenceNumber ? sanitizeForDisplay(referenceNumber) : null
    const sanitizedReferenceId = referenceId ? sanitizeForDisplay(referenceId) : null
    const sanitizedShipName = shipName ? sanitizeForDisplay(shipName) : null
    const sanitizedTrackingNumber = trackingNumber ? sanitizeForDisplay(trackingNumber) : null
    const sanitizedModeOfTransportation = modeOfTransportation ? sanitizeForDisplay(modeOfTransportation) : null
    const sanitizedNotes = notes ? sanitizeForDisplay(notes) : null
    const sanitizedSupplier = supplier ? sanitizeForDisplay(supplier) : null

    // Handle both 'type' and 'transactionType' fields for backward compatibility
    const txType = type || transactionType
    const refNumber = sanitizedReferenceNumber || sanitizedReferenceId
    const txDate = date || transactionDate

    // Validate transaction type
    if (!txType || !['RECEIVE', 'SHIP', 'ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
      return NextResponse.json({ 
        error: 'Invalid transaction type. Must be RECEIVE, SHIP, ADJUST_IN, or ADJUST_OUT' 
      }, { status: 400 })
    }

    // Build items array for adjustment transactions
    let itemsArray = items
    if (['ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
      // For adjustments, create single item from individual fields
      if (!skuId || !batchLot) {
        return NextResponse.json({ 
          error: 'Missing required fields for adjustment: skuId and batchLot' 
        }, { status: 400 })
      }
      
      // Get SKU code from skuId
      const sku = await prisma.sku.findUnique({
        where: { id: skuId }
      })
      
      if (!sku) {
        return NextResponse.json({ 
          error: 'SKU not found' 
        }, { status: 404 })
      }
      
      itemsArray = [{
        skuCode: sku.skuCode,
        batchLot: batchLot,
        cartons: cartonsIn || cartonsOut || 0,
        pallets: storagePalletsIn || shippingPalletsOut || 0
      }]
    }

    // Validate required fields for non-adjustment transactions
    if (['RECEIVE', 'SHIP'].includes(txType) && (!refNumber || !txDate || !itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0)) {
      return NextResponse.json({ 
        error: 'Missing required fields: PI/CI/PO number, date, and items' 
      }, { status: 400 })
    }

    // Validate required fields for all transactions
    if (!refNumber || !txDate) {
      return NextResponse.json({ 
        error: 'Missing required fields: reference number and date' 
      }, { status: 400 })
    }

    // Validate date is not in the future
    const transactionDateObj = new Date(txDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    if (isNaN(transactionDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    if (transactionDateObj > today) {
      return NextResponse.json({ 
        error: 'Transaction date cannot be in the future' 
      }, { status: 400 })
    }

    // Historical date validation removed - businesses may need to enter old data for migration or corrections

    // Validate warehouse assignment for staff
    if (session.user.role === 'staff' && !session.user.warehouseId) {
      return NextResponse.json({ error: 'No warehouse assigned' }, { status: 400 })
    }

    const warehouseId = session.user.warehouseId || bodyWarehouseId

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID required' }, { status: 400 })
    }

    // Check for duplicate transaction (prevent double submission)
    const recentDuplicate = await prisma.inventoryTransaction.findFirst({
      where: {
        referenceId: refNumber,
        transactionType: txType as TransactionType,
        warehouseId,
        createdAt: {
          gte: new Date(Date.now() - 60000) // Within last minute
        }
      }
    })

    if (recentDuplicate) {
      return NextResponse.json({ 
        error: 'Duplicate transaction detected. A transaction with this reference was just processed.' 
      }, { status: 409 })
    }

    // Check for backdated transactions - prevent inserting transactions before the last transaction
    const lastTransaction = await prisma.inventoryTransaction.findFirst({
      where: { warehouseId },
      orderBy: { transactionDate: 'desc' },
      select: { transactionDate: true, transactionId: true }
    })

    if (lastTransaction && transactionDateObj < lastTransaction.transactionDate) {
      return NextResponse.json({ 
        error: `Cannot create backdated transactions. The last transaction in this warehouse was on ${lastTransaction.transactionDate.toLocaleDateString()}. New transactions must have a date on or after this date.`,
        details: {
          lastTransactionDate: lastTransaction.transactionDate,
          attemptedDate: transactionDateObj,
          lastTransactionId: lastTransaction.transactionId
        }
      }, { status: 400 })
    }

    // Validate all items before processing
    for (const item of itemsArray) {
      // Validate item structure
      if (!item.skuCode || !item.batchLot || typeof item.cartons !== 'number') {
        return NextResponse.json({ 
          error: `Invalid item structure. Each item must have skuCode, batchLot, and cartons` 
        }, { status: 400 })
      }
      
      // Validate cartons is a positive integer
      if (!Number.isInteger(item.cartons) || item.cartons <= 0) {
        return NextResponse.json({ 
          error: `Cartons must be positive integers. Invalid value for SKU ${item.skuCode}: ${item.cartons}` 
        }, { status: 400 })
      }
      
      // Validate maximum cartons (prevent unrealistic values)
      if (item.cartons > 99999) {
        return NextResponse.json({ 
          error: `Cartons value too large for SKU ${item.skuCode}. Maximum allowed: 99,999` 
        }, { status: 400 })
      }
      
      // Validate pallets if provided
      if (item.pallets !== undefined && item.pallets !== null) {
        if (!Number.isInteger(item.pallets) || item.pallets < 0 || item.pallets > 9999) {
          return NextResponse.json({ 
            error: `Pallets must be integers between 0 and 9,999. Invalid value for SKU ${item.skuCode}` 
          }, { status: 400 })
        }
      }
      
      // Validate and sanitize batch/lot
      if (!item.batchLot || item.batchLot.trim() === '') {
        return NextResponse.json({ 
          error: `Batch/Lot is required for SKU ${item.skuCode}` 
        }, { status: 400 })
      }
      
      // Validate batch lot is numeric for RECEIVE transactions
      if (txType === 'RECEIVE' && !/^\d+$/.test(item.batchLot.trim())) {
        // Log warning but don't block for now to avoid breaking existing workflows
        console.warn(`Non-numeric batch lot for SKU ${item.skuCode}: ${item.batchLot}`)
        // In future, enforce this validation:
        // return NextResponse.json({ 
        //   error: `Batch/Lot must be numeric for SKU ${item.skuCode}. Got: ${item.batchLot}` 
        // }, { status: 400 })
      }
      
      item.batchLot = sanitizeForDisplay(item.batchLot)
      item.skuCode = sanitizeForDisplay(item.skuCode)
    }

    // Check for duplicate SKU/batch combinations in the request
    const itemKeys = new Set()
    for (const item of itemsArray) {
      const key = `${item.skuCode}-${item.batchLot}`
      if (itemKeys.has(key)) {
        return NextResponse.json({ 
          error: `Duplicate SKU/Batch combination found: ${item.skuCode} - ${item.batchLot}` 
        }, { status: 400 })
      }
      itemKeys.add(key)
    }

    // Verify all SKUs exist and check inventory for SHIP transactions
    for (const item of itemsArray) {
      const sku = await prisma.sku.findFirst({
        where: { skuCode: item.skuCode }
      })

      if (!sku) {
        return NextResponse.json({ 
          error: `SKU ${item.skuCode} not found. Please create the SKU first.` 
        }, { status: 400 })
      }

      // For SHIP and ADJUST_OUT transactions, verify inventory availability
      if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
        // Calculate current balance from transactions
        const transactions = await prisma.inventoryTransaction.findMany({
          where: {
            warehouseId,
            skuId: sku.id,
            batchLot: item.batchLot,
            transactionDate: { lte: transactionDateObj }
          }
        })
        
        let currentCartons = 0
        for (const txn of transactions) {
          currentCartons += txn.cartonsIn - txn.cartonsOut
        }
        
        if (currentCartons < item.cartons) {
          return NextResponse.json({ 
            error: `Insufficient inventory for SKU ${item.skuCode} batch ${item.batchLot}. Available: ${currentCartons}, Requested: ${item.cartons}` 
          }, { status: 400 })
        }
      }
    }

    // Get warehouse for transaction ID generation
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId }
    })
    
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Start performance tracking
    const startTime = Date.now();
    
    // Create transactions with proper database transaction and locking
    const result = await prisma.$transaction(async (tx) => {
        const transactions = [];
        
        // Pre-fetch all SKUs to reduce queries
        const skuCodes = itemsArray.map((item: any) => item.skuCode);
        const skus = await tx.sku.findMany({
          where: { skuCode: { in: skuCodes } }
        });
        const skuMap = new Map(skus.map(sku => [sku.skuCode, sku]));
        
        for (const item of itemsArray) {
          const sku = skuMap.get(item.skuCode);
          if (!sku) {
            throw new Error(`SKU not found: ${item.skuCode}`);
          }

          // Generate transaction ID in format similar to Excel data
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
          
          // Get the count of existing transactions for today to determine sequence number
          const existingTransactionsCount = await tx.inventoryTransaction.count({
            where: {
              transactionId: {
                startsWith: `${warehouse.code}-${txType.slice(0, 3)}-${timestamp}`
              }
            }
          })
          
          // Use existing count + current batch position + 1
          const sequenceNum: number = existingTransactionsCount + transactions.length + 1
          const transactionId = `${warehouse.code}-${txType.slice(0, 3)}-${timestamp}-${sequenceNum.toString().padStart(3, '0')}`
      
          // Calculate pallet values
          let calculatedStoragePalletsIn = null
          let calculatedShippingPalletsOut = null
          let palletVarianceNotes = null
          let batchShippingCartonsPerPallet = item.shippingCartonsPerPallet
      
          if (['RECEIVE', 'ADJUST_IN'].includes(txType)) {
            // For adjustments, use provided pallets value directly
            if (txType === 'ADJUST_IN' && item.pallets) {
              calculatedStoragePalletsIn = item.pallets
            } else if (item.storageCartonsPerPallet > 0) {
              calculatedStoragePalletsIn = Math.ceil(item.cartons / item.storageCartonsPerPallet)
              if (item.pallets !== calculatedStoragePalletsIn) {
                palletVarianceNotes = `Storage pallet variance: Actual ${item.pallets}, Calculated ${calculatedStoragePalletsIn} (${item.cartons} cartons @ ${item.storageCartonsPerPallet}/pallet)`
              }
            }
          } else if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
            // For SHIP, get the batch-specific config from the original RECEIVE transaction
            const originalReceive = await tx.inventoryTransaction.findFirst({
              where: {
                warehouseId,
                skuId: sku.id,
                batchLot: item.batchLot,
                transactionType: 'RECEIVE'
              },
              orderBy: { transactionDate: 'asc' }
            });
            
            if (txType === 'ADJUST_OUT' && item.pallets) {
              calculatedShippingPalletsOut = item.pallets
            } else if (originalReceive?.shippingCartonsPerPallet) {
              batchShippingCartonsPerPallet = originalReceive.shippingCartonsPerPallet
              calculatedShippingPalletsOut = Math.ceil(item.cartons / batchShippingCartonsPerPallet)
              if (item.pallets !== calculatedShippingPalletsOut) {
                palletVarianceNotes = `Shipping pallet variance: Actual ${item.pallets}, Calculated ${calculatedShippingPalletsOut} (${item.cartons} cartons @ ${batchShippingCartonsPerPallet}/pallet)`
              }
            }
          }
      
          // Auto-generate reference ID based on format: {TrackingNumber}-{Warehouse}-{Batch}
          const autoGeneratedReferenceId = sanitizedTrackingNumber && warehouse?.code && item.batchLot 
            ? `${sanitizedTrackingNumber}-${warehouse.code}-${item.batchLot}`
            : refNumber // Fallback to provided reference number if components missing
          
          const transaction = await tx.inventoryTransaction.create({
            data: {
              transactionId,
              warehouseId,
              skuId: sku.id,
              batchLot: item.batchLot || 'NONE',
              transactionType: txType as TransactionType,
              referenceId: autoGeneratedReferenceId,
              cartonsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? item.cartons : 0,
              cartonsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? item.cartons : 0,
              storagePalletsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? (item.storagePalletsIn || item.pallets || calculatedStoragePalletsIn || 0) : 0,
              shippingPalletsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? (item.shippingPalletsOut || item.pallets || calculatedShippingPalletsOut || 0) : 0,
              storageCartonsPerPallet: txType === 'RECEIVE' ? item.storageCartonsPerPallet : null,
              shippingCartonsPerPallet: txType === 'RECEIVE' ? item.shippingCartonsPerPallet : (txType === 'SHIP' ? batchShippingCartonsPerPallet : null),
              shipName: txType === 'RECEIVE' ? sanitizedShipName : null,
              trackingNumber: sanitizedTrackingNumber || null,
              modeOfTransportation: txType === 'SHIP' ? sanitizedModeOfTransportation : null,
              supplier: txType === 'RECEIVE' ? sanitizedSupplier : null,
              attachments: (() => {
                const combinedAttachments = attachments || [];
                // For SHIP and adjustment transactions, add notes as a special attachment entry
                if (['SHIP', 'ADJUST_IN', 'ADJUST_OUT'].includes(txType) && sanitizedNotes) {
                  return [...combinedAttachments, { type: 'notes', content: sanitizedNotes }];
                }
                return combinedAttachments.length > 0 ? combinedAttachments : null;
              })(),
              transactionDate: new Date(txDate),
              pickupDate: pickupDate ? new Date(pickupDate) : new Date(txDate), // Use provided pickup date or default to transaction date
              createdById: session.user.id,
              unitsPerCarton: item.unitsPerCarton || sku.unitsPerCarton, // Capture units per carton - prefer provided value, fallback to SKU master
            }
          })

          transactions.push(transaction)
        }

        // Inventory balances are now calculated at runtime from transactions
        // No need to update a separate balance table
        
        return transactions;
    });

    const duration = Date.now() - startTime;
    
    // Log successful transaction completion
    businessLogger.info('Inventory transaction completed successfully', {
      transactionType: txType,
      referenceNumber: refNumber,
      warehouseId,
      transactionCount: result.length,
      transactionIds: result.map(t => t.transactionId),
      totalCartons: itemsArray.reduce((sum: number, item: any) => sum + item.cartons, 0),
      duration,
      userId: session.user.id
    });
    
    // Log performance metrics
    perfLogger.log('Transaction processing completed', {
      transactionType: txType,
      itemCount: itemsArray.length,
      duration,
      avgDurationPerItem: duration / itemsArray.length
    });
    
    // Trigger cost calculations for all created transactions
    for (const transaction of result) {
      if (shouldCalculateCosts(transaction.transactionType)) {
        const transactionData = {
          transactionId: transaction.transactionId,
          warehouseId: transaction.warehouseId,
          skuId: transaction.skuId,
          batchLot: transaction.batchLot,
          transactionType: transaction.transactionType,
          transactionDate: transaction.transactionDate,
          cartonsIn: transaction.cartonsIn,
          cartonsOut: transaction.cartonsOut,
          storagePalletsIn: transaction.storagePalletsIn,
          shippingPalletsOut: transaction.shippingPalletsOut,
          storageCartonsPerPallet: transaction.storageCartonsPerPallet || undefined,
          shippingCartonsPerPallet: transaction.shippingCartonsPerPallet || undefined,
        };

        if (validateTransactionForCostCalculation(transactionData)) {
          // Trigger cost calculation without awaiting
          triggerCostCalculation(transactionData).catch(error => {
            // console.error(`Failed to trigger cost calculation for ${transaction.transactionId}:`, error);
            businessLogger.error('Cost calculation trigger failed', {
              transactionId: transaction.transactionId,
              error: error.message
            });
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `${result.length} transactions created`,
      transactionIds: result.map(t => t.transactionId),
    })
  } catch (error: any) {
    // console.error('Transaction error:', error);
    
    // Check for specific error types
    if (error.message?.includes('Insufficient inventory')) {
      return NextResponse.json({ 
        error: error.message
      }, { status: 400 })
    }
    
    if (error.message?.includes('could not serialize') || 
        error.message?.includes('deadlock') ||
        error.message?.includes('concurrent update')) {
      return NextResponse.json({ 
        error: 'Transaction conflict detected. Please try again.',
        details: 'Another transaction is modifying the same inventory. Please retry your request.'
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Prevent updates to maintain immutability
export async function PUT(_request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be modified',
    message: 'To correct errors, please create an adjustment transaction (ADJUST_IN or ADJUST_OUT)'
  }, { status: 405 })
}

// Prevent deletes to maintain immutability
export async function DELETE(_request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be deleted',
    message: 'The inventory ledger maintains a permanent audit trail. To correct errors, please create an adjustment transaction'
  }, { status: 405 })
}