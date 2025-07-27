#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Mapping of old model names to new model names
const modelMappings: Record<string, string> = {
  'audit_logs': 'AuditLog',
  'calculated_costs': 'CalculatedCost',
  'cost_rates': 'CostRate',
  'dispute_resolutions': 'DisputeResolution',
  'inventory_audit_log': 'InventoryAuditLog',
  'inventory_balances': 'InventoryBalance',
  'inventory_transactions': 'InventoryTransaction',
  'invoice_audit_logs': 'InvoiceAuditLog',
  'invoice_disputes': 'InvoiceDispute',
  'invoice_line_items': 'InvoiceLineItem',
  'invoice_reconciliations': 'InvoiceReconciliation',
  'invoices': 'Invoice',
  'payments': 'Payment',
  'reconciliation_details': 'ReconciliationDetail',
  'settings': 'Setting',
  'sku_versions': 'SkuVersion',
  'skus': 'Sku',
  'storage_ledger': 'StorageLedger',
  'users': 'User',
  'warehouse_notifications': 'WarehouseNotification',
  'warehouse_sku_configs': 'WarehouseSkuConfig',
  'warehouses': 'Warehouse',
  'idempotency_keys': 'IdempotencyKey',
  'permissions': 'Permission',
  'role_permissions': 'RolePermission',
  'user_permissions': 'UserPermission',
  'reconciliation_reports': 'ReconciliationReport',
  'reconciliation_discrepancies': 'ReconciliationDiscrepancy'
};

// Field mappings for commonly used fields
const fieldMappings: Record<string, string> = {
  'table_name': 'tableName',
  'record_id': 'recordId',
  'user_id': 'userId',
  'ip_address': 'ipAddress',
  'user_agent': 'userAgent',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'warehouse_id': 'warehouseId',
  'sku_id': 'skuId',
  'batch_lot': 'batchLot',
  'transaction_id': 'transactionId',
  'transaction_type': 'transactionType',
  'cost_rate_id': 'costRateId',
  'invoice_id': 'invoiceId',
  'customer_id': 'customerId',
  'created_by': 'createdBy',
  'resolved_by': 'resolvedBy',
  'disputed_by': 'disputedBy',
  'performed_by': 'performedBy',
  'paid_by': 'paidBy',
  'read_by': 'readBy',
  'password_hash': 'passwordHash',
  'full_name': 'fullName',
  'last_login_at': 'lastLoginAt',
  'locked_until': 'lockedUntil',
  'locked_reason': 'lockedReason',
  'is_active': 'isActive',
  'is_demo': 'isDemo',
  'is_reconciled': 'isReconciled',
  'sku_code': 'skuCode',
  'pack_size': 'packSize',
  'units_per_carton': 'unitsPerCarton',
  'cartons_in': 'cartonsIn',
  'cartons_out': 'cartonsOut',
  'current_cartons': 'currentCartons',
  'current_pallets': 'currentPallets',
  'current_units': 'currentUnits',
  'shipping_cartons_per_pallet': 'shippingCartonsPerPallet',
  'storage_cartons_per_pallet': 'storageCartonsPerPallet',
  'storage_pallets_in': 'storagePalletsIn',
  'shipping_pallets_out': 'shippingPalletsOut',
  'transaction_date': 'transactionDate',
  'pickup_date': 'pickupDate',
  'payment_date': 'paymentDate',
  'due_date': 'dueDate',
  'paid_date': 'paidDate',
  'disputed_at': 'disputedAt',
  'resolved_at': 'resolvedAt',
  'performed_at': 'performedAt',
  'processed_at': 'processedAt',
  'paid_at': 'paidAt',
  'read_at': 'readAt',
  'expires_at': 'expiresAt',
  'billing_period_start': 'billingPeriodStart',
  'billing_period_end': 'billingPeriodEnd',
  'invoice_number': 'invoiceNumber',
  'invoice_date': 'invoiceDate',
  'issue_date': 'issueDate',
  'tax_amount': 'taxAmount',
  'total_amount': 'totalAmount',
  'paid_amount': 'paidAmount',
  'disputed_amount': 'disputedAmount',
  'resolution_amount': 'resolutionAmount',
  'payment_method': 'paymentMethod',
  'payment_reference': 'paymentReference',
  'billing_month': 'billingMonth',
  'billing_year': 'billingYear',
  'cost_category': 'costCategory',
  'cost_name': 'costName',
  'cost_value': 'costValue',
  'unit_of_measure': 'unitOfMeasure',
  'effective_date': 'effectiveDate',
  'end_date': 'endDate',
  'calculated_cost_id': 'calculatedCostId',
  'transaction_reference_id': 'transactionReferenceId',
  'billing_week_ending': 'billingWeekEnding',
  'quantity_charged': 'quantityCharged',
  'applicable_rate': 'applicableRate',
  'calculated_cost': 'calculatedCost',
  'cost_adjustment_value': 'costAdjustmentValue',
  'final_expected_cost': 'finalExpectedCost',
  'dispute_id': 'disputeId',
  'resolution_notes': 'resolutionNotes',
  'resolution_type': 'resolutionType',
  'attempted_by': 'attemptedBy',
  'attempted_at': 'attemptedAt',
  'error_message': 'errorMessage',
  'old_data': 'oldData',
  'new_data': 'newData',
  'last_transaction_date': 'lastTransactionDate',
  'last_updated': 'lastUpdated',
  'reference_id': 'referenceId',
  'ship_name': 'shipName',
  'tracking_number': 'trackingNumber',
  'mode_of_transportation': 'modeOfTransportation',
  'line_items_disputed': 'lineItemsDisputed',
  'contacted_warehouse': 'contactedWarehouse',
  'unit_rate': 'unitRate',
  'expected_amount': 'expectedAmount',
  'invoiced_amount': 'invoicedAmount',
  'suggested_amount': 'suggestedAmount',
  'expected_quantity': 'expectedQuantity',
  'invoiced_quantity': 'invoicedQuantity',
  'reconciliation_id': 'reconciliationId',
  'permission_id': 'permissionId',
  'report_type': 'reportType',
  'started_at': 'startedAt',
  'completed_at': 'completedAt',
  'total_warehouses': 'totalWarehouses',
  'total_skus': 'totalSkus',
  'total_discrepancies': 'totalDiscrepancies',
  'critical_discrepancies': 'criticalDiscrepancies',
  'summary_statistics': 'summaryStatistics',
  'report_id': 'reportId',
  'recorded_balance': 'recordedBalance',
  'calculated_balance': 'calculatedBalance',
  'discrepancy_details': 'discrepancyDetails',
  'version_identifier': 'versionIdentifier',
  'unit_dimensions_cm': 'unitDimensionsCm',
  'unit_weight_kg': 'unitWeightKg',
  'carton_dimensions_cm': 'cartonDimensionsCm',
  'carton_weight_kg': 'cartonWeightKg',
  'packaging_type': 'packagingType',
  'fba_stock': 'fbaStock',
  'fba_stock_last_updated': 'fbaStockLastUpdated',
  'sl_id': 'slId',
  'week_ending_date': 'weekEndingDate',
  'cartons_end_of_monday': 'cartonsEndOfMonday',
  'storage_pallets_charged': 'storagePalletsCharged',
  'applicable_weekly_rate': 'applicableWeeklyRate',
  'calculated_weekly_cost': 'calculatedWeeklyCost',
  'contact_email': 'contactEmail',
  'contact_phone': 'contactPhone',
  'max_stacking_height_cm': 'maxStackingHeightCm',
  'related_invoice_id': 'relatedInvoiceId',
};

// Relations mappings
const relationMappings: Record<string, string> = {
  'users': 'user',
  'invoices': 'invoice',
  'skus': 'sku',
  'warehouses': 'warehouse',
  'calculated_costs': 'calculatedCost',
  'cost_rates': 'costRate',
  'inventory_balances': 'inventoryBalance',
  'inventory_transactions': 'inventoryTransaction',
  'invoice_audit_logs': 'invoiceAuditLog',
  'invoice_disputes': 'invoiceDispute',
  'invoice_line_items': 'invoiceLineItem',
  'invoice_reconciliations': 'invoiceReconciliation',
  'warehouse_notifications': 'warehouseNotification',
  'warehouse_sku_configs': 'warehouseSkuConfig',
  'audit_logs': 'auditLog',
  'payments': 'payment',
  'dispute_resolutions': 'disputeResolution',
  'reconciliation_details': 'reconciliationDetail',
  'sku_versions': 'skuVersion',
  'storage_ledger': 'storageLedger',
  'idempotency_keys': 'idempotencyKey',
  'permissions': 'permission',
  'role_permissions': 'rolePermission',
  'user_permissions': 'userPermission',
  'reconciliation_reports': 'reconciliationReport',
  'reconciliation_discrepancies': 'reconciliationDiscrepancy',
  'users_invoices_created_byTousers': 'createdByUser',
  'users_invoices_customer_idTousers': 'customer',
};

interface FileUpdate {
  file: string;
  changes: Array<{
    line: number;
    original: string;
    updated: string;
  }>;
}

async function findAllTypeScriptFiles(): Promise<string[]> {
  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!node_modules/**',
    '!dist/**',
    '!.next/**'
  ];
  
  return glob(patterns[0], { ignore: patterns.slice(1).filter(p => p.startsWith('!')) });
}

function updatePrismaImports(content: string): string {
  // Update Prisma imports
  const prismaImportRegex = /from\s+['"]@prisma\/client['"];?/g;
  let updatedContent = content;
  
  // Check if file imports specific types from Prisma
  const specificImportRegex = /import\s+(?:type\s+)?{\s*([^}]+)\s*}\s+from\s+['"]@prisma\/client['"];?/g;
  
  updatedContent = updatedContent.replace(specificImportRegex, (match, imports) => {
    const importList = imports.split(',').map((imp: string) => imp.trim());
    const updatedImports = importList.map((imp: string) => {
      // Check if it's a model name that needs updating
      if (modelMappings[imp]) {
        return modelMappings[imp];
      }
      return imp;
    });
    
    return match.replace(imports, updatedImports.join(', '));
  });
  
  return updatedContent;
}

function updateModelReferences(content: string): string {
  let updatedContent = content;
  
  // Update direct model references
  Object.entries(modelMappings).forEach(([oldName, newName]) => {
    // Update type annotations: : oldName or : oldName[]
    const typeRegex = new RegExp(`:\\s*${oldName}(\\[\\])?(?=\\s|;|,|\\)|>)`, 'g');
    updatedContent = updatedContent.replace(typeRegex, `: ${newName}$1`);
    
    // Update Prisma client references: prisma.oldName or db.oldName
    const prismaRegex = new RegExp(`(prisma|db)\\.${oldName}\\b`, 'g');
    updatedContent = updatedContent.replace(prismaRegex, `$1.${newName.charAt(0).toLowerCase() + newName.slice(1)}`);
    
    // Update imports and type references
    const importRegex = new RegExp(`\\b${oldName}\\b`, 'g');
    updatedContent = updatedContent.replace(importRegex, (match, offset) => {
      const before = updatedContent.charAt(offset - 1);
      const after = updatedContent.charAt(offset + match.length);
      
      // Don't replace if it's part of a larger identifier
      if (/[a-zA-Z0-9_]/.test(before) || /[a-zA-Z0-9_]/.test(after)) {
        return match;
      }
      
      // Don't replace if it's a property access (e.g., obj.oldName)
      if (before === '.') {
        return match;
      }
      
      return newName;
    });
  });
  
  // Update field references in object property access
  Object.entries(fieldMappings).forEach(([oldField, newField]) => {
    // Match patterns like .oldField, ['oldField'], or ["oldField"]
    const patterns = [
      new RegExp(`\\.${oldField}\\b`, 'g'),
      new RegExp(`\\['${oldField}'\\]`, 'g'),
      new RegExp(`\\["${oldField}"\\]`, 'g'),
    ];
    
    patterns.forEach((pattern, index) => {
      if (index === 0) {
        updatedContent = updatedContent.replace(pattern, `.${newField}`);
      } else if (index === 1) {
        updatedContent = updatedContent.replace(pattern, `['${newField}']`);
      } else {
        updatedContent = updatedContent.replace(pattern, `["${newField}"]`);
      }
    });
    
    // Update in object literals { oldField: value }
    const objectLiteralRegex = new RegExp(`(\\{[^}]*?)\\b${oldField}\\s*:`, 'g');
    updatedContent = updatedContent.replace(objectLiteralRegex, `$1${newField}:`);
    
    // Update in destructuring { oldField } = obj
    const destructuringRegex = new RegExp(`(\\{[^}]*?)\\b${oldField}\\b([^}]*?\\})`, 'g');
    updatedContent = updatedContent.replace(destructuringRegex, `$1${newField}$2`);
  });
  
  // Update relation names in include/select statements
  Object.entries(relationMappings).forEach(([oldRelation, newRelation]) => {
    // In include/select objects
    const includeRegex = new RegExp(`(include|select)\\s*:\\s*\\{[^}]*?\\b${oldRelation}\\s*:`, 'g');
    updatedContent = updatedContent.replace(includeRegex, (match) => {
      return match.replace(new RegExp(`\\b${oldRelation}\\s*:`), `${newRelation}:`);
    });
  });
  
  return updatedContent;
}

async function processFile(filePath: string): Promise<FileUpdate | null> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  let updatedContent = updatePrismaImports(content);
  updatedContent = updateModelReferences(updatedContent);
  
  if (content !== updatedContent) {
    const changes: FileUpdate['changes'] = [];
    const originalLines = content.split('\n');
    const updatedLines = updatedContent.split('\n');
    
    originalLines.forEach((line, index) => {
      if (line !== updatedLines[index]) {
        changes.push({
          line: index + 1,
          original: line,
          updated: updatedLines[index]
        });
      }
    });
    
    return {
      file: filePath,
      changes
    };
  }
  
  return null;
}

async function main() {
  console.log('🔍 Scanning for TypeScript files...');
  
  const files = await findAllTypeScriptFiles();
  console.log(`📁 Found ${files.length} TypeScript files to process`);
  
  const updates: FileUpdate[] = [];
  
  for (const file of files) {
    const update = await processFile(file);
    if (update) {
      updates.push(update);
    }
  }
  
  if (updates.length === 0) {
    console.log('✅ No updates needed!');
    return;
  }
  
  console.log(`\n📝 Found updates needed in ${updates.length} files:`);
  
  // Show preview of changes
  updates.forEach(update => {
    console.log(`\n📄 ${update.file}:`);
    update.changes.slice(0, 3).forEach(change => {
      console.log(`  Line ${change.line}:`);
      console.log(`    - ${change.original}`);
      console.log(`    + ${change.updated}`);
    });
    if (update.changes.length > 3) {
      console.log(`  ... and ${update.changes.length - 3} more changes`);
    }
  });
  
  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>(resolve => {
    readline.question('\n🤔 Do you want to apply these changes? (yes/no): ', resolve);
  });
  
  readline.close();
  
  if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('❌ Cancelled migration');
    return;
  }
  
  // Apply changes
  console.log('\n🚀 Applying changes...');
  
  for (const update of updates) {
    const content = await fs.promises.readFile(update.file, 'utf-8');
    let updatedContent = updatePrismaImports(content);
    updatedContent = updateModelReferences(updatedContent);
    await fs.promises.writeFile(update.file, updatedContent, 'utf-8');
    console.log(`✅ Updated ${update.file}`);
  }
  
  console.log('\n🎉 Migration complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the changes in your code');
  console.log('2. Run: npx prisma generate with the new schema');
  console.log('3. Create and apply the database migration');
  console.log('4. Test your application thoroughly');
}

// Run the migration
main().catch(console.error);