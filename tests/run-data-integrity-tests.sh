#!/bin/bash

# Run Data Integrity Test Suite
echo "🔄 Running Data Integrity Test Suite..."
echo "======================================"

# Set test environment
export NODE_ENV=test
export DATABASE_URL=$DATABASE_URL_TEST

# Run data integrity tests
echo ""
echo "1. Concurrent Request Tests"
echo "   Testing race condition prevention..."
npm test -- tests/data-integrity/concurrent-requests.test.ts

echo ""
echo "2. Idempotency Tests"
echo "   Testing duplicate transaction prevention..."
npm test -- tests/data-integrity/idempotency.test.ts

echo ""
echo "3. Transaction Validation Tests"
echo "   Testing date validation and constraints..."
npm test -- tests/data-integrity/transaction-validation.test.ts

echo ""
echo "4. Reconciliation Accuracy Tests"
echo "   Testing inventory reconciliation..."
npm test -- tests/data-integrity/reconciliation-accuracy.test.ts

echo ""
echo "======================================"
echo "✅ Data Integrity Test Suite Complete"
echo ""

# Generate data integrity test report
echo "Generating data integrity test report..."
npm test -- tests/data-integrity --coverage --coverageDirectory=./test-results/data-integrity-coverage

echo ""
echo "📊 Data integrity test coverage report available at: ./test-results/data-integrity-coverage/lcov-report/index.html"