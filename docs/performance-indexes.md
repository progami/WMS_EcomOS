# Performance Indexes Documentation

## Overview

This document describes the performance-critical database indexes added to the WMS system as specified in TODO.md section 2.1. These indexes significantly improve query performance for the most common operations.

## Indexes Created

### 1. `idx_inventory_transactions_composite`

**Table:** `inventory_transactions`  
**Columns:** `warehouse_id, sku_id, batch_lot, transaction_date DESC`  
**Purpose:** Optimizes queries that filter by warehouse, SKU, and batch lot, ordered by transaction date

**Common queries optimized:**
- Inventory ledger views filtered by warehouse/SKU/batch
- Transaction history for specific items
- Recent activity reports

### 2. `idx_inventory_balances_lookup`

**Table:** `inventory_balances`  
**Columns:** `warehouse_id, sku_id, batch_lot`  
**Filter:** `WHERE current_cartons > 0`  
**Purpose:** Optimizes queries looking for items with available stock

**Common queries optimized:**
- Available inventory searches
- Stock availability checks
- Restock alert calculations

### 3. `idx_invoices_status_due`

**Table:** `invoices`  
**Columns:** `status, due_date`  
**Filter:** `WHERE status != 'paid'`  
**Purpose:** Optimizes queries for unpaid and overdue invoices

**Common queries optimized:**
- Accounts receivable aging reports
- Overdue invoice alerts
- Pending payment dashboards

### 4. `idx_storage_ledger_date`

**Table:** `storage_ledger`  
**Columns:** `week_ending_date DESC`  
**Purpose:** Optimizes queries that retrieve recent storage ledger entries

**Common queries optimized:**
- Recent storage cost calculations
- Weekly storage reports
- Storage trend analysis

## Performance Impact

These indexes provide the following performance improvements:

1. **Reduced query time**: Complex queries that previously took seconds now complete in milliseconds
2. **Lower database load**: More efficient query plans reduce CPU and I/O usage
3. **Better concurrency**: Faster queries mean shorter lock times and better multi-user performance

## Maintenance

- PostgreSQL automatically maintains these indexes during normal operations
- Monitor index usage with `pg_stat_user_indexes` to ensure they're being utilized
- Rebuild indexes periodically if they become fragmented: `REINDEX INDEX index_name;`

## Verification

To verify the indexes exist, run:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_inventory_transactions_composite',
    'idx_inventory_balances_lookup',
    'idx_invoices_status_due',
    'idx_storage_ledger_date'
  )
ORDER BY tablename, indexname;
```

## Application Script

To apply these indexes, run:

```bash
node scripts/apply-performance-indexes.js
```

This script will create all missing indexes and verify their existence.