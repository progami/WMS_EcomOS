import { redirect } from 'next/navigation'

export default async function InvoiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Invoice editing is done through the new invoice page with query params
  redirect(`/finance/invoices/new?edit=${id}`)
}