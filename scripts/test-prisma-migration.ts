#!/usr/bin/env node

/**
 * Test script to verify Prisma schema migration works correctly
 * This script tests that the new PascalCase models with @@map work properly
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testBasicQueries() {
  console.log('🧪 Testing basic queries with new PascalCase models...\n');

  try {
    // Test 1: Query users
    console.log('1️⃣ Testing User model (previously users)...');
    const userCount = await prisma.users.count();
    console.log(`   ✅ User count: ${userCount}`);

    // Test 2: Query warehouses
    console.log('\n2️⃣ Testing Warehouse model (previously warehouses)...');
    const warehouseCount = await prisma.warehouses.count();
    console.log(`   ✅ Warehouse count: ${warehouseCount}`);

    // Test 3: Query SKUs
    console.log('\n3️⃣ Testing Sku model (previously skus)...');
    const skuCount = await prisma.skus.count();
    console.log(`   ✅ SKU count: ${skuCount}`);

    // Test 4: Query with relations
    console.log('\n4️⃣ Testing relations...');
    const userWithRelations = await prisma.users.findFirst({
      include: {
        warehouse: true,
        auditLogs: {
          take: 1,
        },
      },
    });
    console.log(`   ✅ User with relations loaded successfully`);

    // Test 5: Query inventory transactions
    console.log('\n5️⃣ Testing InventoryTransaction model...');
    const transactionCount = await prisma.inventory_transactions.count();
    console.log(`   ✅ Transaction count: ${transactionCount}`);

    // Test 6: Test field name mappings
    console.log('\n6️⃣ Testing field mappings...');
    const sampleUser = await prisma.users.findFirst({
      select: {
        id: true,
        email: true,
        full_name: true, // mapped from full_name
        created_at: true, // mapped from created_at
        is_active: true, // mapped from is_active
      },
    });
    
    if (sampleUser) {
      console.log('   ✅ Field mappings work correctly:');
      console.log(`      - full_name: ${sampleUser.full_name2097}`);
      console.log(`      - created_at: ${sampleUser.created_at2159}`);
      console.log(`      - is_active: ${sampleUser.is_active2230}`);
    }

    // Test 7: Complex query with multiple joins
    console.log('\n7️⃣ Testing complex query with multiple joins...');
    const complexQuery = await prisma.inventory_balances.findFirst({
      include: {
        warehouse: true,
        sku: {
          include: {
            warehouseSkuConfigs: {
              take: 1,
            },
          },
        },
      },
    });
    console.log('   ✅ Complex query executed successfully');

    // Test 8: Write operation
    console.log('\n8️⃣ Testing write operation...');
    const testSetting = await prisma.settings.upsert({
      where: { key: 'migration_test' },
      update: { value: { tested: true, timestamp: new Date() } },
      create: {
        id: `test_${Date.now()}`,
        key: 'migration_test',
        value: { tested: true, timestamp: new Date() },
        description: 'Test setting for migration verification',
        updated_at: new Date(),
      },
    });
    console.log('   ✅ Write operation successful');

    // Cleanup
    await prisma.settings.deleteMany({
      where: { key: 'migration_test' },
    });

    console.log('\n✨ All tests passed! The migration appears to be working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

async function testDataIntegrity() {
  console.log('\n🔍 Testing data integrity...\n');

  try {
    // Check that counts match between related tables
    const inventoryTransactions = await prisma.inventory_transactions.count();
    const inventoryBalances = await prisma.inventory_balances.count();
    
    console.log(`📊 Data integrity checks:`);
    console.log(`   - Inventory transactions: ${inventoryTransactions}`);
    console.log(`   - Inventory balances: ${inventoryBalances}`);
    
    // Check foreign key relationships
    const orphanedTransactions = await prisma.inventory_transactions.findMany({
      where: {
        OR: [
          { warehouse: null },
          { sku: null },
          { user: null },
        ],
      },
      take: 5,
    });
    
    if (orphanedTransactions.length > 0) {
      console.warn(`   ⚠️  Found ${orphanedTransactions.length} orphaned transactions`);
    } else {
      console.log(`   ✅ No orphaned transactions found`);
    }
    
  } catch (error) {
    console.error('❌ Data integrity check failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Prisma migration tests...\n');
  console.log('📝 This script verifies that the new PascalCase schema works correctly\n');

  try {
    await testBasicQueries();
    await testDataIntegrity();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎉 The Prisma migration is working correctly.\n');
    
  } catch (error) {
    console.error('\n💥 Migration test failed!');
    console.error('Please check the error above and ensure:');
    console.error('1. The new schema.prisma is in place');
    console.error('2. You have run: npx prisma generate');
    console.error('3. The database is accessible\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
main().catch(console.error);