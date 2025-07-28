import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InventoryService } from '@/lib/services/inventory-service';
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter';
import { validateCSRFToken } from '@/lib/security/csrf-protection';
import { sanitizeForDisplay } from '@/lib/security/input-sanitization';
import { auditLog } from '@/lib/security/audit-logger';
import { TransactionType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getPaginationParams, getPaginationSkipTake, createPaginatedResponse } from '@/lib/database/pagination';
import { triggerCostCalculation, shouldCalculateCosts, validateTransactionForCostCalculation } from '@/lib/triggers/inventory-transaction-triggers';

const transactionSchema = z.object({
  transactionType: z.nativeEnum(TransactionType),
  warehouseId: z.string().uuid(),
  skuId: z.string().uuid(),
  batchLot: z.string().min(1).max(100),
  referenceId: z.string().optional(),
  cartonsIn: z.number().int().min(0).default(0),
  cartonsOut: z.number().int().min(0).default(0),
  storagePalletsIn: z.number().int().min(0).default(0),
  shippingPalletsOut: z.number().int().min(0).default(0),
  transactionDate: z.string().datetime(),
  pickupDate: z.string().datetime().optional(),
  shippingCartonsPerPallet: z.number().int().positive().optional(),
  storageCartonsPerPallet: z.number().int().positive().optional(),
  shipName: z.string().optional(),
  trackingNumber: z.string().optional(),
  modeOfTransportation: z.string().optional(),
  attachments: z.any().optional(),
  unitsPerCarton: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api);
    if (rateLimitResponse) return rateLimitResponse;

    // CSRF protection
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = transactionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check warehouse access for staff users
    if (session.user.role === 'staff' && session.user.warehouseId !== data.warehouseId) {
      await auditLog({
        entityType: 'InventoryTransaction',
        entityId: 'ACCESS_DENIED',
        action: 'UNAUTHORIZED_ACCESS',
        userId: session.user.id,
        data: { attemptedWarehouseId: data.warehouseId }
      });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Sanitize text inputs
    const sanitizedData = {
      ...data,
      batchLot: sanitizeForDisplay(data.batchLot),
      referenceId: data.referenceId ? sanitizeForDisplay(data.referenceId) : undefined,
      shipName: data.shipName ? sanitizeForDisplay(data.shipName) : undefined,
      trackingNumber: data.trackingNumber ? sanitizeForDisplay(data.trackingNumber) : undefined,
      modeOfTransportation: data.modeOfTransportation ? sanitizeForDisplay(data.modeOfTransportation) : undefined,
      transactionDate: new Date(data.transactionDate),
      pickupDate: data.pickupDate ? new Date(data.pickupDate) : undefined,
    };

    // Create transaction with proper locking and validation
    const result = await InventoryService.createTransaction(
      sanitizedData,
      session.user.id
    );

    // Trigger cost calculations asynchronously
    if (shouldCalculateCosts(result.transactionType)) {
      const transactionData = {
        transactionId: result.transactionId,
        warehouseId: result.warehouseId,
        skuId: result.skuId,
        batchLot: result.batchLot,
        transactionType: result.transactionType,
        transactionDate: result.transactionDate,
        cartonsIn: result.cartonsIn,
        cartonsOut: result.cartonsOut,
        storagePalletsIn: result.storagePalletsIn,
        shippingPalletsOut: result.shippingPalletsOut,
        storageCartonsPerPallet: result.storageCartonsPerPallet || undefined,
        shippingCartonsPerPallet: result.shippingCartonsPerPallet || undefined,
      };

      if (validateTransactionForCostCalculation(transactionData)) {
        // Trigger cost calculation without awaiting
        triggerCostCalculation(transactionData, session.user.id).catch(error => {
          // console.error('Failed to trigger cost calculation:', error);
          // Log but don't fail the request
          auditLog({
            entityType: 'CostCalculation',
            entityId: result.transactionId,
            action: 'TRIGGER_FAILED',
            userId: session.user.id,
            data: { error: error.message }
          });
        });
      }
    }

    return NextResponse.json({
      success: true,
      transaction: result,
      balance: 0
    });
  } catch (error: any) {
    // console.error('Transaction error:', error);
    
    // Don't expose internal errors
    if (error.message.includes('Insufficient inventory')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const skuId = searchParams.get('skuId');
    const batchLot = searchParams.get('batchLot');
    const transactionType = searchParams.get('transactionType') as TransactionType | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};

    // Check warehouse access
    if (session.user.role === 'staff' && session.user.warehouseId) {
      where.warehouseId = session.user.warehouseId;
    } else if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (skuId) where.skuId = skuId;
    if (batchLot) where.batchLot = sanitizeForDisplay(batchLot);
    if (transactionType) where.transactionType = transactionType;

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(startDate);
      if (endDate) where.transactionDate.lte = new Date(endDate);
    }

    // Get pagination params
    const paginationParams = getPaginationParams(request);
    const { skip, take } = getPaginationSkipTake(paginationParams);

    // Get total count
    const total = await prisma.inventoryTransaction.count({ where });

    // Get transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      },
      orderBy: {
        transactionDate: 'desc'
      },
      skip,
      take
    });

    return NextResponse.json(createPaginatedResponse(transactions, total, paginationParams));
  } catch (error) {
    // console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}