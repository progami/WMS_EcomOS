// Script to help identify and fix field name issues
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/operations/inventory/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Map of camelCase to snake_case
const fieldMap = {
  'transactionId': 'transaction_id',
  'transactionDate': 'transaction_date',
  'pickupDate': 'pickup_date',
  'isReconciled': 'is_reconciled',
  'transactionType': 'transaction_type',
  'warehouse\\.': 'warehouses.',
  'sku\\.': 'skus.',
  'skuCode': 'sku_code',
  'batchLot': 'batch_lot',
  'referenceId': 'reference_id',
  'cartonsIn': 'cartons_in',
  'cartonsOut': 'cartons_out',
  'storagePalletsIn': 'storage_pallets_in',
  'shippingPalletsOut': 'shipping_pallets_out',
  'storageCartonsPerPallet': 'storage_cartons_per_pallet',
  'shippingCartonsPerPallet': 'shipping_cartons_per_pallet',
  'shipName': 'ship_name',
  'trackingNumber': 'tracking_number',
  'modeOfTransportation': 'mode_of_transportation',
  'createdBy\\.': 'users.',
  'fullName': 'full_name',
  'createdAt': 'created_at',
  'unitsPerCarton': 'units_per_carton'
};

// Find all occurrences
for (const [camel, snake] of Object.entries(fieldMap)) {
  const regex = new RegExp(`\\.${camel}(?![a-zA-Z0-9_])`, 'g');
  const matches = content.match(regex);
  if (matches) {
    console.log(`Found ${matches.length} occurrences of .${camel}`);
  }
  
  // Also check for object access like transaction.field
  const regex2 = new RegExp(`(?:transaction|t|item|balance)\\[['"]${camel}['"]]`, 'g');
  const matches2 = content.match(regex2);
  if (matches2) {
    console.log(`Found ${matches2.length} occurrences of ['${camel}']`);
  }
}

// Also look for filter references
const filterRegex = /transaction\.(transactionType|isReconciled|transactionDate|batchLot)/g;
const filterMatches = content.match(filterRegex);
if (filterMatches) {
  console.log('Filter references:', filterMatches.length);
  filterMatches.forEach(match => console.log('  ', match));
}

// Look for warehouse/sku references
const warehouseRegex = /transaction\.warehouse\./g;
const warehouseMatches = content.match(warehouseRegex);
if (warehouseMatches) {
  console.log('Warehouse references:', warehouseMatches.length);
}

const skuRegex = /transaction\.sku\./g;
const skuMatches = content.match(skuRegex);
if (skuMatches) {
  console.log('SKU references:', skuMatches.length);
}