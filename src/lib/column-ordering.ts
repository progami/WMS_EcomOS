/**
 * Standardized Column Ordering Configuration
 * This file defines the consistent column order to be used across:
 * - Database queries
 * - UI table displays
 * - Export files
 */

export interface ColumnDefinition {
  fieldName: string // Database field name
  displayName: string // UI display name
  exportName: string // Export column header
  group: 'datetime' | 'type' | 'location' | 'product' | 'quantity' | 'shipping' | 'metadata'
  order: number
  showInUI: boolean
  showInExport: boolean
  isRelation?: boolean
  relationPath?: string // e.g., 'warehouse.name'
}

// Standardized column ordering for Inventory Transactions
export const INVENTORY_TRANSACTION_COLUMNS: ColumnDefinition[] = [
  // Date/Time Group
  {
    fieldName: 'transactionDate',
    displayName: 'Transaction Date',
    exportName: 'Transaction Date',
    group: 'datetime',
    order: 1,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'pickupDate',
    displayName: 'Pickup Date',
    exportName: 'Pickup Date',
    group: 'datetime',
    order: 2,
    showInUI: false,
    showInExport: true
  },

  // Type/Status Group
  {
    fieldName: 'transactionType',
    displayName: 'Type',
    exportName: 'Type',
    group: 'type',
    order: 3,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'isReconciled',
    displayName: 'Reconciled',
    exportName: 'Is Reconciled',
    group: 'type',
    order: 4,
    showInUI: true,
    showInExport: true
  },

  // Location Group
  {
    fieldName: 'warehouse',
    displayName: 'Warehouse',
    exportName: 'Warehouse',
    group: 'location',
    order: 5,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'warehouse.name'
  },

  // Product Group
  {
    fieldName: 'sku',
    displayName: 'SKU Code',
    exportName: 'SKU Code',
    group: 'product',
    order: 6,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'sku.skuCode'
  },
  {
    fieldName: 'skuDescription',
    displayName: 'SKU Description',
    exportName: 'SKU Description',
    group: 'product',
    order: 7,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'sku.description'
  },
  {
    fieldName: 'batchLot',
    displayName: 'Batch/Lot',
    exportName: 'Batch/Lot',
    group: 'product',
    order: 8,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'referenceId',
    displayName: 'Reference',
    exportName: 'Reference',
    group: 'product',
    order: 9,
    showInUI: false,
    showInExport: true
  },

  // Quantity Group
  {
    fieldName: 'cartonsIn',
    displayName: 'Cartons In',
    exportName: 'Cartons In',
    group: 'quantity',
    order: 10,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'cartonsOut',
    displayName: 'Cartons Out',
    exportName: 'Cartons Out',
    group: 'quantity',
    order: 11,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'storagePalletsIn',
    displayName: 'Storage Pallets In',
    exportName: 'Storage Pallets In',
    group: 'quantity',
    order: 12,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'shippingPalletsOut',
    displayName: 'Shipping Pallets Out',
    exportName: 'Shipping Pallets Out',
    group: 'quantity',
    order: 13,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'storageCartonsPerPallet',
    displayName: 'Storage Cartons/Pallet',
    exportName: 'Storage Cartons/Pallet',
    group: 'quantity',
    order: 14,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'shippingCartonsPerPallet',
    displayName: 'Shipping Cartons/Pallet',
    exportName: 'Shipping Cartons/Pallet',
    group: 'quantity',
    order: 15,
    showInUI: false,
    showInExport: true
  },

  // Shipping/Transport Group
  {
    fieldName: 'trackingNumber',
    displayName: 'Tracking Number',
    exportName: 'Tracking Number',
    group: 'shipping',
    order: 16,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'shipName',
    displayName: 'Ship Name',
    exportName: 'Ship Name',
    group: 'shipping',
    order: 17,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'modeOfTransportation',
    displayName: 'Mode of Transport',
    exportName: 'Mode of Transportation',
    group: 'shipping',
    order: 18,
    showInUI: false,
    showInExport: true
  },

  // Document Fields Group
  {
    fieldName: 'hasCommercialInvoice',
    displayName: 'Has Commercial Invoice',
    exportName: 'Has Commercial Invoice',
    group: 'metadata',
    order: 19,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasBillOfLading',
    displayName: 'Has Bill of Lading',
    exportName: 'Has Bill of Lading',
    group: 'metadata',
    order: 20,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasPackingList',
    displayName: 'Has Packing List',
    exportName: 'Has Packing List',
    group: 'metadata',
    order: 21,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasDeliveryNote',
    displayName: 'Has Delivery Note',
    exportName: 'Has Delivery Note',
    group: 'metadata',
    order: 22,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasCubeMaster',
    displayName: 'Has Cube Master',
    exportName: 'Has Cube Master',
    group: 'metadata',
    order: 23,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasTransactionCertificate',
    displayName: 'Has TC GRS',
    exportName: 'Has Transaction Certificate (TC GRS)',
    group: 'metadata',
    order: 24,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasCustomDeclaration',
    displayName: 'Has CDS',
    exportName: 'Has Custom Declaration (CDS)',
    group: 'metadata',
    order: 25,
    showInUI: false,
    showInExport: true
  },
  {
    fieldName: 'hasProofOfPickup',
    displayName: 'Has Proof of Pickup',
    exportName: 'Has Proof of Pickup',
    group: 'metadata',
    order: 26,
    showInUI: false,
    showInExport: true
  },
  
  // Metadata Group
  {
    fieldName: 'createdBy',
    displayName: 'Created By',
    exportName: 'Created By',
    group: 'metadata',
    order: 27,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'createdBy.fullName'
  },
  {
    fieldName: 'createdAt',
    displayName: 'Created At',
    exportName: 'Created At',
    group: 'metadata',
    order: 28,
    showInUI: false,
    showInExport: true
  }
]

// Helper functions
export function getUIColumns(): ColumnDefinition[] {
  return INVENTORY_TRANSACTION_COLUMNS
    .filter(col => col.showInUI)
    .sort((a, b) => a.order - b.order)
}

export function getExportColumns(): ColumnDefinition[] {
  return INVENTORY_TRANSACTION_COLUMNS
    .filter(col => col.showInExport)
    .sort((a, b) => a.order - b.order)
}

export function getColumnByFieldName(fieldName: string): ColumnDefinition | undefined {
  return INVENTORY_TRANSACTION_COLUMNS.find(col => col.fieldName === fieldName)
}

export function getColumnGroups(): string[] {
  return ['datetime', 'type', 'location', 'product', 'quantity', 'shipping', 'metadata']
}

// Standardized column ordering for Inventory Balances
export const INVENTORY_BALANCE_COLUMNS: ColumnDefinition[] = [
  {
    fieldName: 'warehouse',
    displayName: 'Warehouse',
    exportName: 'Warehouse',
    group: 'location',
    order: 1,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'warehouse.name'
  },
  {
    fieldName: 'sku',
    displayName: 'SKU Code',
    exportName: 'SKU Code',
    group: 'product',
    order: 2,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'sku.skuCode'
  },
  {
    fieldName: 'skuDescription',
    displayName: 'Description',
    exportName: 'SKU Description',
    group: 'product',
    order: 3,
    showInUI: true,
    showInExport: true,
    isRelation: true,
    relationPath: 'sku.description'
  },
  {
    fieldName: 'batchLot',
    displayName: 'Batch/Lot',
    exportName: 'Batch/Lot',
    group: 'product',
    order: 4,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'currentCartons',
    displayName: 'Cartons',
    exportName: 'Current Cartons',
    group: 'quantity',
    order: 5,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'storageCartonsPerPallet',
    displayName: 'Storage Config',
    exportName: 'Storage Cartons/Pallet',
    group: 'quantity',
    order: 6,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'shippingCartonsPerPallet',
    displayName: 'Shipping Config',
    exportName: 'Shipping Cartons/Pallet',
    group: 'quantity',
    order: 7,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'currentPallets',
    displayName: 'Pallets',
    exportName: 'Current Pallets',
    group: 'quantity',
    order: 8,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'currentUnits',
    displayName: 'Units',
    exportName: 'Current Units',
    group: 'quantity',
    order: 9,
    showInUI: true,
    showInExport: true
  },
  {
    fieldName: 'lastTransactionDate',
    displayName: 'Last Activity',
    exportName: 'Last Activity',
    group: 'datetime',
    order: 10,
    showInUI: true,
    showInExport: true
  }
]

export function getBalanceUIColumns(): ColumnDefinition[] {
  return INVENTORY_BALANCE_COLUMNS
    .filter(col => col.showInUI)
    .sort((a, b) => a.order - b.order)
}

export function getBalanceExportColumns(): ColumnDefinition[] {
  return INVENTORY_BALANCE_COLUMNS
    .filter(col => col.showInExport)
    .sort((a, b) => a.order - b.order)
}