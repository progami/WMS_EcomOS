#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('Starting Prisma field name fix...\n');

// Field mappings from camelCase to snake_case
const fieldMappings = {
  // Common fields
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  'isActive': 'is_active',
  'isDemo': 'is_demo',
  
  // User fields
  'fullName': 'full_name',
  'warehouseId': 'warehouse_id',
  'lastLoginAt': 'last_login_at',
  'lockedUntil': 'locked_until',
  'lockedReason': 'locked_reason',
  'passwordHash': 'password_hash',
  'failedLoginAttempts': 'failed_login_attempts',
  'permissionId': 'permission_id',
  'createdBy': 'created_by',
  'createdById': 'created_by_id',
  
  // Transaction fields
  'transactionId': 'transaction_id',
  'transactionType': 'transaction_type',
  'transactionDate': 'transaction_date',
  'skuId': 'sku_id',
  'batchLot': 'batch_lot',
  'referenceId': 'reference_id',
  'cartonsIn': 'cartons_in',
  'cartonsOut': 'cartons_out',
  'unitsPerCarton': 'units_per_carton',
  'currentCartons': 'current_cartons',
  'currentPallets': 'current_pallets',
  'currentUnits': 'current_units',
  'lastTransactionDate': 'last_transaction_date',
  
  // Warehouse fields
  'contactEmail': 'contact_email',
  'contactPhone': 'contact_phone',
  
  // SKU fields
  'skuCode': 'sku_code',
  'packSize': 'pack_size',
  'unitDimensionsCm': 'unit_dimensions_cm',
  'unitLengthCm': 'unit_length_cm',
  'unitWidthCm': 'unit_width_cm',
  'unitHeightCm': 'unit_height_cm',
  'unitVolumeCbm': 'unit_volume_cbm',
  'unitWeightKg': 'unit_weight_kg',
  'fbaForwardCost': 'fba_forward_cost',
  'fbaStock': 'fba_stock',
  'fbaStockLastUpdated': 'fba_stock_last_updated',
  
  // Invoice fields
  'invoiceNumber': 'invoice_number',
  'invoiceDate': 'invoice_date',
  'billingPeriodStart': 'billing_period_start',
  'billingPeriodEnd': 'billing_period_end',
  'issueDate': 'issue_date',
  'dueDate': 'due_date',
  'customerId': 'customer_id',
  'totalAmount': 'total_amount',
  'taxAmount': 'tax_amount',
  'lineItems': 'line_items',
  'costCategory': 'cost_category',
  'costName': 'cost_name',
  'unitRate': 'unit_rate',
  'disputedAmount': 'disputed_amount',
  'raisedById': 'raised_by_id',
  'resolvedById': 'resolved_by_id',
  
  // Storage ledger fields
  'weekEndingDate': 'week_ending_date',
  'cartonsEndOfMonday': 'cartons_end_of_monday',
  'storagePalletsCharged': 'storage_pallets_charged',
  'applicableWeeklyRate': 'applicable_weekly_rate',
  'calculatedWeeklyCost': 'calculated_weekly_cost',
  
  // Cost fields
  'rateName': 'rate_name',
  'rateType': 'rate_type',
  'costCategory': 'cost_category',
  'effectiveFrom': 'effective_from',
  'effectiveTo': 'effective_to',
  'calculatedById': 'calculated_by_id',
  
  // Reconciliation fields
  'invoiceId': 'invoice_id',
  'lineItemId': 'line_item_id',
  'expectedAmount': 'expected_amount',
  'actualAmount': 'actual_amount',
  'differenceAmount': 'difference_amount',
  'resolvedAt': 'resolved_at',
  
  // Feature flags
  'featureName': 'feature_name',
  'defaultValue': 'default_value',
  
  // Audit fields
  'userId': 'user_id',
  'entityType': 'entity_type',
  'entityId': 'entity_id',
  'ipAddress': 'ip_address',
  'userAgent': 'user_agent'
};

// Find all TypeScript/TSX files, excluding common build/dependency directories
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: [
    'node_modules/**',
    'dist/**',
    '.next/**',
    'build/**',
    'coverage/**',
    '**/*.d.ts',
    '**/migrations/**'
  ]
}).concat(glob.sync('scripts/**/*.ts', {
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**'
  ]
}));

console.log(`Found ${files.length} TypeScript/TSX files to process\n`);

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  console.log(`Processing: ${file}`);
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  let replacements = 0;

  // Replace field names in object literals and property access
  Object.entries(fieldMappings).forEach(([camelCase, snakeCase]) => {
    // Match patterns like { fieldName: value } or .fieldName or ['fieldName']
    const patterns = [
      // Object property definitions
      new RegExp(`([{,\\s])(${camelCase})(:)`, 'g'),
      // Property access with dot notation
      new RegExp(`(\\.)(${camelCase})(?![a-zA-Z0-9_])`, 'g'),
      // Property access with bracket notation
      new RegExp(`(\\[['"\`])(${camelCase})(['"\`]\\])`, 'g'),
      // Destructuring
      new RegExp(`([{,\\s])(${camelCase})(\\s*[,}])`, 'g'),
      // Where/select/include clauses
      new RegExp(`(:\\s*{\\s*)(${camelCase})(\\s*:)`, 'g')
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, (match, prefix, field, suffix) => {
          replacements++;
          modified = true;
          return `${prefix}${snakeCase}${suffix}`;
        });
      }
    });
  });

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`  ✓ Modified with ${replacements} replacements`);
    totalReplacements += replacements;
    filesModified++;
  } else {
    console.log('  - No changes needed');
  }
});

console.log('\n========================================');
console.log('Prisma field name fix completed!');
console.log(`Files processed: ${files.length}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log('========================================\n');

console.log('Now run:');
console.log('  npm run build');
console.log('to check if the TypeScript errors are resolved.\n');