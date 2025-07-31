#!/bin/bash

echo "🔍 Transaction Debug Helper"
echo "=========================="
echo ""
echo "This script will help debug the 'Failed to load transaction' error"
echo ""

# Check if a transaction ID is provided
if [ -z "$1" ]; then
    echo "ℹ️  To debug a specific transaction, run: ./debug-transaction.sh <transaction-id>"
    echo ""
    echo "First, let's check recent transactions in the database..."
    echo ""
    
    # Get recent transactions
    npx --yes prisma db execute --stdin <<EOF
    SELECT id, transaction_id, reference_id, transaction_type, created_at 
    FROM inventory_transactions 
    ORDER BY created_at DESC 
    LIMIT 5;
EOF
else
    TRANSACTION_ID=$1
    echo "Checking transaction: $TRANSACTION_ID"
    echo ""
    
    # Check if transaction exists
    echo "1. Checking if transaction exists in database..."
    npx --yes prisma db execute --stdin <<EOF
    SELECT id, transaction_id, reference_id, transaction_type, created_at, supplier
    FROM inventory_transactions 
    WHERE id = '$TRANSACTION_ID';
EOF
    
    echo ""
    echo "2. Testing API endpoint..."
    # Test the API endpoint
    curl -v "http://localhost:3000/api/transactions/$TRANSACTION_ID" 2>&1 | grep -E "HTTP|error|{" | head -20
    
    echo ""
    echo "3. Checking for related data..."
    npx --yes prisma db execute --stdin <<EOF
    SELECT 
        t.id,
        t.reference_id,
        t.supplier,
        w.name as warehouse_name,
        s.sku_code,
        u.full_name as created_by
    FROM inventory_transactions t
    LEFT JOIN warehouses w ON t.warehouse_id = w.id
    LEFT JOIN skus s ON t.sku_id = s.id
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = '$TRANSACTION_ID';
EOF
fi

echo ""
echo "💡 Common issues:"
echo "   - If you see '401 Unauthorized': You need to be logged in"
echo "   - If you see '404 Not Found': The transaction ID doesn't exist"
echo "   - If you see '500 Internal Server Error': Check server logs"
echo ""
echo "To view server logs, run: npm run dev and check the terminal output"