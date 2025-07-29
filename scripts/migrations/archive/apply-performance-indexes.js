const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyPerformanceIndexes() {
  console.log('Applying performance indexes...\n');
  
  const indexes = [
    {
      name: 'idx_inventory_transactions_composite',
      sql: `CREATE INDEX IF NOT EXISTS idx_inventory_transactions_composite 
            ON inventory_transactions(warehouse_id, sku_id, batch_lot, transaction_date DESC)`,
      description: 'Composite index for inventory transaction queries'
    },
    {
      name: 'idx_inventory_balances_lookup',
      sql: `CREATE INDEX IF NOT EXISTS idx_inventory_balances_lookup 
            ON inventory_balances(warehouse_id, sku_id, batch_lot) 
            WHERE current_cartons > 0`,
      description: 'Filtered index for active inventory balances'
    },
    {
      name: 'idx_invoices_status_due',
      sql: `CREATE INDEX IF NOT EXISTS idx_invoices_status_due 
            ON invoices(status, due_date) 
            WHERE status != 'paid'`,
      description: 'Filtered index for unpaid invoices'
    },
    {
      name: 'idx_storage_ledger_date',
      sql: `CREATE INDEX IF NOT EXISTS idx_storage_ledger_date 
            ON storage_ledger(week_ending_date DESC)`,
      description: 'Index for storage ledger date queries'
    }
  ];

  for (const index of indexes) {
    try {
      console.log(`Creating ${index.name}...`);
      console.log(`Description: ${index.description}`);
      
      await prisma.$executeRawUnsafe(index.sql);
      
      console.log(`✅ ${index.name} created successfully\n`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️ ${index.name} already exists, skipping\n`);
      } else {
        console.error(`❌ Error creating ${index.name}: ${error.message}\n`);
      }
    }
  }

  // Check which indexes exist on each table
  console.log('\nVerifying indexes...\n');
  
  const tables = ['inventory_transactions', 'inventory_balances', 'invoices', 'storage_ledger'];
  
  for (const table of tables) {
    console.log(`Indexes on ${table}:`);
    
    const indexes = await prisma.$queryRaw`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = ${table}
      ORDER BY indexname;
    `;
    
    for (const idx of indexes) {
      console.log(`  - ${idx.indexname}`);
    }
    console.log('');
  }
}

applyPerformanceIndexes()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });