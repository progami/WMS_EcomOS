import { Metadata } from 'next';
import { InventoryReconciliationReport } from '@/components/reconciliation/inventory-reconciliation-report';

export const metadata: Metadata = {
  title: 'Inventory Reconciliation | Admin',
  description: 'Run and view inventory reconciliation reports',
};

export default function ReconciliationPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <InventoryReconciliationReport />
    </div>
  );
}