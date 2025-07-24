import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessInvoice } from '@/lib/auth-utils';
import { Money } from '@/lib/financial-utils';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/invoices/[id]/dispute - Dispute an invoice or specific line items
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    const { 
      disputedLineItems, // Array of { reconciliationId, reason, suggestedAmount }
      generalDisputeReason, // For disputing entire invoice
      notes,
      contactWarehouse = true, // Flag to notify warehouse
    } = body;

    // Get the invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        reconciliations: true,
        warehouse: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check warehouse access
    if (!canAccessInvoice(session, invoice)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot dispute a paid invoice' },
        { status: 400 }
      );
    }

    // Start a transaction to update invoice and reconciliation records
    const result = await prisma.$transaction(async (tx) => {
      let disputedCount = 0;
      let totalDisputedAmount = 0;
      const disputeDetails: any[] = [];

      // Handle line-item specific disputes
      if (disputedLineItems && disputedLineItems.length > 0) {
        for (const item of disputedLineItems) {
          const reconciliation = await tx.invoiceReconciliation.findFirst({
            where: {
              id: item.reconciliationId,
              invoiceId,
            },
          });

          if (reconciliation) {
            // Store suggested amount in resolution notes since the field doesn't exist
            const resolutionNotes = item.suggestedAmount 
              ? `${item.reason} | Suggested amount: $${item.suggestedAmount}`
              : item.reason;

            await tx.invoiceReconciliation.update({
              where: { id: item.reconciliationId },
              data: {
                status: 'overbilled', // Use overbilled/underbilled as proxy for disputed
                resolutionNotes,
                resolvedById: session.user.id,
                resolvedAt: new Date(),
              },
            });

            disputedCount++;
            totalDisputedAmount += Money.fromPrismaDecimal(reconciliation.difference).abs().toNumber();
            disputeDetails.push({
              reconciliationId: item.reconciliationId,
              reason: item.reason,
              suggestedAmount: item.suggestedAmount,
              originalDifference: reconciliation.difference,
            });
          }
        }
      } else if (generalDisputeReason) {
        // Mark all reconciliation items as disputed
        const allReconciliations = await tx.invoiceReconciliation.findMany({
          where: { invoiceId },
        });

        for (const recon of allReconciliations) {
          await tx.invoiceReconciliation.update({
            where: { id: recon.id },
            data: {
              status: Number(recon.difference) > 0 ? 'overbilled' : 'underbilled',
              resolutionNotes: generalDisputeReason,
              resolvedById: session.user.id,
              resolvedAt: new Date(),
            },
          });

          totalDisputedAmount += Money.fromPrismaDecimal(recon.difference).abs().toNumber();
        }

        disputedCount = allReconciliations.length;
      }

      // Update invoice status to disputed
      const disputeTimestamp = new Date().toISOString();
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'disputed',
          notes: `${invoice.notes || ''}\n\n--- DISPUTE FILED ${disputeTimestamp} ---\nDisputed by: ${session.user?.email}\nReason: ${generalDisputeReason || 'See line item disputes'}\nDisputed Amount: $${totalDisputedAmount.toFixed(2)}\nItems Disputed: ${disputedCount}\n${notes ? `Additional Notes: ${notes}` : ''}`,
        },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          tableName: 'invoices',
          recordId: invoiceId,
          action: 'DISPUTED',
          userId: session.user.id,
          changes: {
            previousStatus: invoice.status,
            newStatus: 'disputed',
            disputedLineItems: disputeDetails,
            generalDisputeReason,
            disputedAmount: totalDisputedAmount,
            disputedBy: session.user?.email,
            contactWarehouse,
          },
        },
      });

      return {
        invoice: updatedInvoice,
        disputedItems: disputedCount,
        totalDisputedAmount,
        disputeDetails,
      };
    });

    return NextResponse.json({
      message: 'Invoice disputed successfully',
      invoice: result.invoice,
      disputedItems: result.disputedItems,
      totalDisputedAmount: result.totalDisputedAmount,
      disputeDetails: result.disputeDetails,
      warehouseNotified: contactWarehouse,
    });
  } catch (error) {
    // console.error('Error disputing invoice:', error);
    return NextResponse.json(
      { error: 'Failed to dispute invoice' },
      { status: 500 }
    );
  }
}

// GET /api/invoices/[id]/dispute - Get dispute details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;

    // Get invoice with reconciliations
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        reconciliations: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check warehouse access
    if (!canAccessInvoice(session, invoice)) {
      return NextResponse.json(
        { error: 'Access denied to this invoice' },
        { status: 403 }
      );
    }

    // Get disputed reconciliations (using overbilled/underbilled as proxy)
    const disputedReconciliations = invoice.reconciliations.filter(
      r => r.status !== 'match' && r.resolutionNotes
    );

    // Get audit logs for dispute history
    const disputeHistory = await prisma.auditLog.findMany({
      where: {
        tableName: 'invoices',
        recordId: invoiceId,
        action: 'DISPUTED',
      },
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        status: invoice.status,
        notes: invoice.notes,
      },
      disputedLineItems: disputedReconciliations,
      disputeHistory: disputeHistory.map(log => ({
        id: log.id,
        disputedAt: log.createdAt,
        disputedBy: log.user.email || log.user.fullName,
        details: log.changes,
      })),
    });
  } catch (error) {
    // console.error('Error fetching dispute details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispute details' },
      { status: 500 }
    );
  }
}