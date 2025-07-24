import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessInvoice } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/invoices/[id]/accept - Accept an invoice and mark for payment
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
      paymentMethod, 
      paymentReference, 
      paymentDate,
      acceptedLineItems, // Optional: array of reconciliation IDs to accept
      notes 
    } = body;

    // Validate required fields
    if (!paymentMethod || !paymentReference) {
      return NextResponse.json(
        { error: 'Payment method and reference are required' },
        { status: 400 }
      );
    }

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

    // Check if invoice is already paid (idempotency check)
    if (invoice.status === 'paid') {
      // Check if this is the same payment reference (idempotent request)
      const lastPaymentNote = invoice.notes?.match(/Reference: ([^,\n]+)/);
      const existingReference = lastPaymentNote?.[1];
      
      if (existingReference === paymentReference) {
        // Same payment reference - idempotent response
        return NextResponse.json({
          message: 'Invoice already accepted with this payment reference',
          invoice: invoice,
          idempotent: true,
          paymentDetails: {
            method: paymentMethod,
            reference: paymentReference,
            status: 'already_processed'
          }
        }, { 
          status: 200,
          headers: {
            'X-Idempotent-Response': 'true'
          }
        });
      } else {
        // Different payment reference - error
        return NextResponse.json(
          { error: 'Invoice is already paid with a different payment reference' },
          { status: 409 }
        );
      }
    }

    // Start a transaction to update invoice and reconciliation records
    const result = await prisma.$transaction(async (tx) => {
      // If specific line items are accepted, update reconciliation records
      if (acceptedLineItems && acceptedLineItems.length > 0) {
        await tx.invoiceReconciliation.updateMany({
          where: {
            invoiceId,
            id: { in: acceptedLineItems },
          },
          data: {
            status: 'match', // Mark accepted items as matching
            resolutionNotes: `Accepted by ${session.user?.email} on ${new Date().toISOString()}. Payment method: ${paymentMethod}, Reference: ${paymentReference}`,
            resolvedById: session.user.id,
            resolvedAt: new Date(),
          },
        });

        // Check if there are any remaining disputed items
        const remainingDisputed = await tx.invoiceReconciliation.count({
          where: {
            invoiceId,
            status: { not: 'match' },
            id: { notIn: acceptedLineItems },
          },
        });

        // If some items remain disputed, mark invoice as partially accepted
        if (remainingDisputed > 0) {
          const updatedInvoice = await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'disputed',
              notes: `${notes || ''}\n\nPartially accepted by ${session.user?.email}. ${remainingDisputed} items remain disputed. Payment: ${paymentMethod} (${paymentReference})`,
            },
          });

          return {
            invoice: updatedInvoice,
            acceptedItems: acceptedLineItems.length,
            remainingDisputed,
          };
        }
      }

      // Update all reconciliation records to accepted if no specific items provided
      if (!acceptedLineItems) {
        await tx.invoiceReconciliation.updateMany({
          where: { invoiceId },
          data: {
            status: 'match',
            resolutionNotes: `Invoice accepted by ${session.user?.email} on ${new Date().toISOString()}. Payment method: ${paymentMethod}, Reference: ${paymentReference}`,
            resolvedById: session.user.id,
            resolvedAt: new Date(),
          },
        });
      }

      // Update invoice status to paid
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          notes: `${notes || ''}\n\nAccepted and marked for payment by ${session.user?.email} on ${new Date().toISOString()}. Payment method: ${paymentMethod}, Reference: ${paymentReference}, Date: ${paymentDate || new Date().toISOString()}`,
        },
      });

      // Create an audit log entry using the existing AuditLog model
      await tx.auditLog.create({
        data: {
          tableName: 'invoices',
          recordId: invoiceId,
          action: 'ACCEPTED',
          userId: session.user.id,
          changes: {
            previousStatus: invoice.status,
            newStatus: 'paid',
            paymentMethod,
            paymentReference,
            paymentDate,
            acceptedLineItems: acceptedLineItems || 'all',
            acceptedBy: session.user?.email,
          },
        },
      });

      return {
        invoice: updatedInvoice,
        acceptedItems: acceptedLineItems?.length || invoice.lineItems.length,
        remainingDisputed: 0,
        paymentDetails: {
          method: paymentMethod,
          reference: paymentReference,
          date: paymentDate || new Date().toISOString(),
        },
      };
    });

    return NextResponse.json({
      message: 'Invoice accepted successfully',
      invoice: result.invoice,
      acceptedItems: result.acceptedItems,
      remainingDisputed: result.remainingDisputed,
      paymentDetails: result.paymentDetails,
    });
  } catch (error) {
    // console.error('Error accepting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to accept invoice' },
      { status: 500 }
    );
  }
}