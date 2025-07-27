const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndFixSupplierColumn() {
  try {
    console.log('Checking for supplier column in inventory_transactions table...');
    
    // Try to query the supplier column
    try {
      const result = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_transactions' 
        AND column_name = 'supplier'
        AND table_schema = 'public'
      `;
      
      if (result.length === 0) {
        console.log('Supplier column does not exist. Adding it now...');
        
        // Add the supplier column
        await prisma.$executeRaw`
          ALTER TABLE inventory_transactions 
          ADD COLUMN IF NOT EXISTS supplier VARCHAR(255)
        `;
        
        console.log('Supplier column added successfully!');
      } else {
        console.log('Supplier column already exists.');
      }
    } catch (error) {
      if (error.code === 'P2022') {
        console.log('Column does not exist. Adding supplier column...');
        
        // Add the supplier column
        await prisma.$executeRaw`
          ALTER TABLE inventory_transactions 
          ADD COLUMN IF NOT EXISTS supplier VARCHAR(255)
        `;
        
        console.log('Supplier column added successfully!');
      } else {
        throw error;
      }
    }
    
    // Verify the column was added
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_transactions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    console.log('\nCurrent columns in inventory_transactions:');
    columns.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixSupplierColumn();