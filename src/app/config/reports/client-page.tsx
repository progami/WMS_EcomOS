'use client'

import { FileText, Package } from '@/lib/lucide-icons'
import { ReportGenerator } from '@/components/reports/report-generator'

export function AdminReportsClient() {
  const reportSections = [
    {
      title: 'Storage Reports',
      icon: Package,
      reports: [
        {
          name: 'Weekly Storage Summary',
          description: 'Storage charges by week for all warehouses',
          reportType: 'storage-charges',
        },
        {
          name: 'Monthly Storage Report',
          description: 'Detailed monthly storage costs by SKU',
          reportType: 'monthly-inventory',
        },
        {
          name: 'Storage by SKU',
          description: 'Current storage costs broken down by SKU',
          reportType: 'cost-summary',
        },
      ],
    },
    {
      title: 'Financial Reports',
      icon: FileText,
      reports: [
        {
          name: 'Invoice Reconciliation',
          description: 'Compare invoiced amounts with calculated costs',
          reportType: 'reconciliation',
        },
        {
          name: 'Cost Analysis',
          description: 'Detailed breakdown of all warehouse costs',
          reportType: 'cost-analysis',
        },
        {
          name: 'Monthly Billing Summary',
          description: 'Summary of all charges for the billing period',
          reportType: 'monthly-billing',
        },
      ],
    },
    {
      title: 'Inventory Reports',
      icon: Package,
      reports: [
        {
          name: 'Current Stock Levels',
          description: 'Real-time inventory levels across all warehouses',
          reportType: 'inventory-balance',
        },
        {
          name: 'Inventory Ledger',
          description: 'All inventory movements for the period',
          reportType: 'inventory-ledger',
        },
        {
          name: 'Low Stock Alert',
          description: 'Items below minimum stock levels',
          reportType: 'low-stock',
        },
      ],
    },
  ]

  const customReportTypes = [
    { value: 'monthly-inventory', label: 'Monthly Inventory' },
    { value: 'inventory-ledger', label: 'Inventory Ledger' },
    { value: 'storage-charges', label: 'Storage Charges' },
    { value: 'cost-summary', label: 'Cost Summary' },
    { value: 'inventory-balance', label: 'Current Inventory Balance' },
    { value: 'reconciliation', label: 'Invoice Reconciliation' },
    { value: 'cost-analysis', label: 'Cost Analysis' },
    { value: 'monthly-billing', label: 'Monthly Billing Summary' },
    { value: 'analytics-summary', label: 'Analytics Summary' },
    { value: 'performance-metrics', label: 'Performance Metrics' },
  ]

  return (
    <ReportGenerator 
      reportSections={reportSections} 
      showCustomFormat={true}
      customReportTypes={customReportTypes}
    />
  )
}