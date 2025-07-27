#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common property names that have been corrupted with numbers
const propertyPatterns = [
  // Inventory related
  { pattern: /sku_code\d{4,}/g, replacement: 'sku_code' },
  { pattern: /batch_lot\d{4,}/g, replacement: 'batch_lot' },
  { pattern: /current_cartons\d{4,}/g, replacement: 'current_cartons' },
  { pattern: /current_pallets\d{4,}/g, replacement: 'current_pallets' },
  { pattern: /current_units\d{4,}/g, replacement: 'current_units' },
  { pattern: /warehouse_id\d{4,}/g, replacement: 'warehouse_id' },
  { pattern: /last_transaction_date\d{4,}/g, replacement: 'last_transaction_date' },
  
  // Transaction related
  { pattern: /transaction_date\d{4,}/g, replacement: 'transaction_date' },
  { pattern: /transaction_type\d{4,}/g, replacement: 'transaction_type' },
  { pattern: /reference_id\d{4,}/g, replacement: 'reference_id' },
  { pattern: /cartons_in\d{4,}/g, replacement: 'cartons_in' },
  { pattern: /cartons_out\d{4,}/g, replacement: 'cartons_out' },
  
  // User related
  { pattern: /full_name\d{4,}/g, replacement: 'full_name' },
  { pattern: /created_by\d{4,}/g, replacement: 'created_by' },
  { pattern: /created_at\d{4,}/g, replacement: 'created_at' },
  { pattern: /updated_at\d{4,}/g, replacement: 'updated_at' },
  
  // ID fields
  { pattern: /sku_id\d{4,}/g, replacement: 'sku_id' },
  { pattern: /user_id\d{4,}/g, replacement: 'user_id' },
  { pattern: /invoice_id\d{4,}/g, replacement: 'invoice_id' },
  
  // Other common fields
  { pattern: /calculated_weekly_cost\d{4,}/g, replacement: 'calculated_weekly_cost' },
];

// Files to process
const filePatterns = [
  'src/**/*.tsx',
  'src/**/*.ts',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx',
  '!node_modules/**'
];

let totalFixed = 0;
let filesProcessed = 0;

console.log('🔍 Searching for files with corrupted property names...\n');

// Find all TypeScript/TSX files
filePatterns.forEach(pattern => {
  if (pattern.startsWith('!')) return;
  
  const files = glob.sync(pattern, { ignore: ['node_modules/**', '**/*.test.*'] });
  
  files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fixCount = 0;
    
    // Apply all property pattern fixes
    propertyPatterns.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        fixCount += matches.length;
      }
    });
    
    // If content changed, write it back
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${fixCount} corruptions in: ${filePath}`);
      totalFixed += fixCount;
      filesProcessed++;
    }
  });
});

console.log('\n📊 Summary:');
console.log(`- Files processed: ${filesProcessed}`);
console.log(`- Total corruptions fixed: ${totalFixed}`);
console.log('\n✨ Property name corruption cleanup complete!');
console.log('\nNOTE: This script has made changes locally. Do NOT push to production without thorough testing.');