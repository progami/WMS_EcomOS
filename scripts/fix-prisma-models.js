#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Model name mappings (camelCase to snake_case)
const modelMappings = {
  'inventoryTransaction': 'inventory_transactions',
  'inventoryBalance': 'inventory_balances',
  'warehouse': 'warehouses',
  'user': 'users',
  'sku': 'skus',
  'invoice': 'invoices',
  'calculatedCost': 'calculated_costs',
  'storageLedger': 'storage_ledger',
  'costRate': 'cost_rates',
  'warehouseSkuConfig': 'warehouse_sku_configs',
  'skuVersion': 'sku_versions',
  'auditLog': 'audit_logs',
  'invoiceLineItem': 'invoice_line_items',
  'invoiceReconciliation': 'invoice_reconciliations',
  'setting': 'settings',
  'featureFlag': 'feature_flags',
  'userPermission': 'user_permissions',
  'invoiceDispute': 'invoice_disputes'
};

// Type name mappings for imports
const typeMappings = {
  'Warehouse': 'warehouses',
  'User': 'users',
  'Sku': 'skus',
  'Invoice': 'invoices',
  'CalculatedCost': 'calculated_costs',
  'StorageLedger': 'storage_ledger',
  'CostRate': 'cost_rates',
  'WarehouseSkuConfig': 'warehouse_sku_configs',
  'SkuVersion': 'sku_versions',
  'AuditLog': 'audit_logs',
  'InvoiceLineItem': 'invoice_line_items',
  'InvoiceReconciliation': 'invoice_reconciliations',
  'Setting': 'settings',
  'FeatureFlag': 'feature_flags',
  'UserPermission': 'user_permissions',
  'InvoiceDispute': 'invoice_disputes',
  'InventoryTransaction': 'inventory_transactions',
  'InventoryBalance': 'inventory_balances'
};

// Statistics
let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

// Function to process a single file
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fileReplacements = 0;

  // Replace prisma.modelName and tx.modelName patterns
  Object.entries(modelMappings).forEach(([camelCase, snakeCase]) => {
    // Match prisma.modelName, tx.modelName, or any variable that might be a transaction
    const regex = new RegExp(`((?:prisma|tx|transaction|trx)\\.)${camelCase}(?![a-zA-Z])`, 'g');
    const matches = content.match(regex) || [];
    if (matches.length > 0) {
      content = content.replace(regex, `$1${snakeCase}`);
      fileReplacements += matches.length;
      console.log(`  - Replaced ${matches.length} instances of ${camelCase} → ${snakeCase}`);
    }
  });

  // Handle Prisma type imports
  // Pattern 1: import { Type } from '@prisma/client'
  Object.entries(typeMappings).forEach(([typeName, snakeCase]) => {
    // Match import statements with the type
    const importRegex = new RegExp(`(import\\s*{[^}]*?)\\b${typeName}\\b([^}]*?}\\s*from\\s*['"]@prisma/client['"])`, 'g');
    const matches = content.match(importRegex) || [];
    if (matches.length > 0) {
      content = content.replace(importRegex, (match, before, after) => {
        // Check if it's already aliased
        if (match.includes(`${snakeCase} as ${typeName}`)) {
          return match;
        }
        // Replace the type with snake_case as alias
        return before.replace(typeName, `${snakeCase} as ${typeName}`) + after;
      });
      fileReplacements += matches.length;
      console.log(`  - Fixed import for ${typeName} → ${snakeCase} as ${typeName}`);
    }
  });

  // Pattern 2: Handle type usage in code (e.g., : Warehouse[], Warehouse | null)
  // This is already handled by the import aliasing above

  // Pattern 3: Handle Prisma namespace types (e.g., Prisma.WarehouseCreateInput)
  Object.entries(typeMappings).forEach(([typeName, snakeCase]) => {
    const prismaTypeRegex = new RegExp(`(Prisma\\.)${typeName}(Create|Update|Where|Select|Include|OrderBy|FindMany|FindUnique|FindFirst|Args|Input|Payload|CountArgs|GroupBy|Aggregate|Scalar|FieldRef|MinAggregateInput|MaxAggregateInput|AvgAggregateInput|SumAggregateInput|CountAggregateInput|MinFields|MaxFields|AvgFields|SumFields|CountFields)`, 'g');
    const matches = content.match(prismaTypeRegex) || [];
    if (matches.length > 0) {
      content = content.replace(prismaTypeRegex, `$1${snakeCase}$2`);
      fileReplacements += matches.length;
      console.log(`  - Replaced ${matches.length} instances of Prisma.${typeName}* types`);
    }
  });

  // Special case for $transaction handling
  content = content.replace(/\$transaction\s*\(\s*async\s*\(\s*(\w+)\s*\)/g, (match, txVar) => {
    // This ensures transaction variables are properly recognized
    return match;
  });

  // Write back if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modifiedFiles++;
    totalReplacements += fileReplacements;
    console.log(`  ✓ Modified with ${fileReplacements} replacements`);
  } else {
    console.log(`  - No changes needed`);
  }
}

// Main function
function main() {
  console.log('Starting Prisma model name fix...\n');

  // Find all TypeScript and TSX files
  const pattern = path.join(__dirname, '..', '**/*.{ts,tsx}');
  const files = glob.sync(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/migrations/**'
    ]
  });

  totalFiles = files.length;
  console.log(`Found ${totalFiles} TypeScript/TSX files to process\n`);

  // Process each file
  files.forEach(file => {
    processFile(file);
  });

  // Report summary
  console.log('\n=== Summary ===');
  console.log(`Total files processed: ${totalFiles}`);
  console.log(`Files modified: ${modifiedFiles}`);
  console.log(`Total replacements: ${totalReplacements}`);
  
  if (modifiedFiles > 0) {
    console.log('\n✓ Prisma model names have been fixed!');
    console.log('\nNext steps:');
    console.log('1. Run "npm run build" to check for any remaining TypeScript errors');
    console.log('2. Run your tests to ensure everything still works');
    console.log('3. Commit the changes');
  } else {
    console.log('\nNo changes were needed.');
  }
}

// Run the script
main();