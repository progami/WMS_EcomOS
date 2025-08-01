# Cost Rates Verification Guide

## 🚀 Manual Verification Steps

This guide will help you verify that cost rates are being calculated correctly for RECEIVE and SHIP transactions.

### Prerequisites
1. Ensure the dev server is running: `npm run dev`
2. Ensure cost rates are set up: `tsx scripts/setup-cost-rates.ts`
3. Open browser to: http://localhost:3000

### 📊 Expected Cost Rates (FMC Warehouse)

**Container Costs:**
- Container Import: $1,200.00
- Terminal Handling: $400.00
- Port Charges: $250.00
- Customs Inspection: $150.00
- Documentation: $75.00
- Duty Deferment: $30.00
- Haulage: $800.00

**Carton Costs:**
- Carton Unloading: $0.50 per carton
- Carton Handling: $0.75 per carton

**Pallet Costs:**
- Pallet Handling: $2.50 per pallet

**Storage Costs:**
- Pallet Storage: $8.50 per pallet per week

**Transport Costs:**
- LTL (Less Than Truckload): $350.00
- FTL (Full Truckload): $1,200.00

### 🧹 Step 0: Clean Test Data

```sql
-- Run these queries in your database to clean test data:
DELETE FROM calculated_costs WHERE transaction_reference_id LIKE 'TEST-%';
DELETE FROM inventory_transactions WHERE reference_id LIKE 'TEST-%';
DELETE FROM inventory_balances WHERE batch_lot = 'TEST';
```

### 📦 Step 1: Create RECEIVE Transaction

1. Navigate to **Operations > Inventory**
2. Click **"New Transaction"**
3. Select **RECEIVE** transaction type
4. Fill in the following:
   - PI/CI/PO Number: `TEST-PO-001`
   - Date: Today's date
   - Vessel/Flight: `TEST-VESSEL-001`
   - Supplier: `Test Supplier Inc`
   
5. Add items:
   - **Item 1:**
     - SKU: `TEST-SKU-001`
     - Batch/Lot: `TEST`
     - Cartons: `500`
     - Storage per pallet: `20`
     - Shipping per pallet: `25`
     - Units per carton: `12`
   
   - **Item 2:**
     - SKU: `TEST-SKU-002`
     - Batch/Lot: `TEST`
     - Cartons: `300`
     - Storage per pallet: `15`
     - Shipping per pallet: `20`
     - Units per carton: `10`

6. Click **"Create Transaction"**

**Expected Costs for RECEIVE:**
- Container costs: $2,905.00 (sum of all container-related costs)
- Carton Unloading: 800 cartons × $0.50 = $400.00
- Pallet Handling: 45 pallets × $2.50 = $112.50
- **Total RECEIVE: $3,417.50**

### 🚚 Step 2: Create SHIP Transaction

1. Navigate to **Operations > Inventory**
2. Click **"New Transaction"**
3. Select **SHIP** transaction type
4. Fill in the following:
   - SO/DO/Invoice: `TEST-SO-001`
   - Date: Today's date
   - Tracking: `TEST-TRACK-001`
   - Mode: `Truck`
   
5. Add items:
   - **Item 1:**
     - SKU: `TEST-SKU-001`
     - Batch/Lot: `TEST`
     - Cartons: `200`
   
   - **Item 2:**
     - SKU: `TEST-SKU-002`
     - Batch/Lot: `TEST`
     - Cartons: `150`

6. Click **"Create Transaction"**

**Expected Costs for SHIP:**
- Carton Handling: 350 cartons × $0.75 = $262.50
- Pallet Handling: 16 pallets × $2.50 = $40.00
- LTL Transport: $350.00
- **Total SHIP: $652.50**

### 📊 Step 3: Verify Calculated Costs

1. Navigate to **Finance > Calculated Costs**
2. You should see all the cost entries generated automatically
3. Verify the totals match the expected values above

### ✅ Verification Checklist

- [ ] RECEIVE transaction created successfully
- [ ] Container costs generated (7 entries totaling $2,905.00)
- [ ] Carton unloading cost = $400.00 (800 × $0.50)
- [ ] Pallet handling cost = $112.50 (45 × $2.50)
- [ ] SHIP transaction created successfully
- [ ] Carton handling cost = $262.50 (350 × $0.75)
- [ ] Pallet handling cost = $40.00 (16 × $2.50)
- [ ] LTL transport cost = $350.00
- [ ] All costs visible in Calculated Costs page
- [ ] Total costs: $4,070.00

### 🔍 Database Verification

Run this query to verify costs in the database:

```sql
SELECT 
  ct.transaction_type,
  ct.transaction_reference_id,
  cr.cost_name,
  ct.quantity_charged,
  ct.applicable_rate,
  ct.calculated_cost
FROM calculated_costs ct
JOIN cost_rates cr ON ct.cost_rate_id = cr.id
WHERE ct.transaction_reference_id LIKE '%TEST-%'
ORDER BY ct.transaction_type, cr.cost_name;
```

### 📸 Screenshots

Please take screenshots of:
1. The completed RECEIVE transaction
2. The completed SHIP transaction
3. The Calculated Costs page showing all generated costs

## 🎯 Summary

If all the costs are generated correctly and match the expected values, the cost rates implementation is working properly!