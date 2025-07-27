#!/bin/bash

# Run All Enhanced Test Suites
echo "🚀 Running All Enhanced Test Suites"
echo "==================================="
echo ""

# Set test environment
export NODE_ENV=test
export DATABASE_URL=$DATABASE_URL_TEST

# Track overall results
FAILED_SUITES=0

# Function to run a test suite
run_suite() {
    local suite_name=$1
    local suite_path=$2
    
    echo "▶ Running $suite_name..."
    echo "-----------------------------------"
    
    if npm test -- $suite_path; then
        echo "✅ $suite_name PASSED"
    else
        echo "❌ $suite_name FAILED"
        FAILED_SUITES=$((FAILED_SUITES + 1))
    fi
    
    echo ""
}

# Create directories for results
mkdir -p ./test-results
mkdir -p ./performance-reports

# Run each test suite
echo "📋 Test Execution Plan:"
echo "1. Security Tests"
echo "2. Data Integrity Tests"
echo "3. Performance Tests"
echo "4. Integration Tests"
echo "5. Unit Tests"
echo ""

# 1. Security Tests
run_suite "Security Tests" "tests/security"

# 2. Data Integrity Tests
run_suite "Data Integrity Tests" "tests/data-integrity"

# 3. Performance Tests
run_suite "Performance Tests" "tests/performance"

# 4. Integration Tests
run_suite "Integration Tests" "tests/integration"

# 5. Unit Tests
run_suite "Unit Tests" "tests/unit"

# Summary Report
echo "==================================="
echo "📊 Test Suite Summary"
echo "==================================="
echo ""

if [ $FAILED_SUITES -eq 0 ]; then
    echo "✅ ALL TEST SUITES PASSED!"
    echo ""
    echo "Security Coverage:"
    echo "- Authentication vulnerability prevention ✓"
    echo "- CSRF protection ✓"
    echo "- Rate limiting ✓"
    echo "- Permission-based access control ✓"
    echo ""
    echo "Data Integrity Coverage:"
    echo "- Concurrent request handling ✓"
    echo "- Idempotency implementation ✓"
    echo "- Transaction validation ✓"
    echo "- Reconciliation accuracy ✓"
    echo ""
    echo "Performance Validation:"
    echo "- Baseline metrics established ✓"
    echo "- Optimization improvements verified ✓"
    echo ""
else
    echo "❌ $FAILED_SUITES TEST SUITE(S) FAILED"
    echo ""
    echo "Please review the failed tests above and fix any issues."
    exit 1
fi

# Generate combined coverage report
echo "Generating combined coverage report..."
npm test -- tests --coverage --coverageDirectory=./test-results/combined-coverage

echo ""
echo "📁 Test Results Available:"
echo "- Coverage Report: ./test-results/combined-coverage/lcov-report/index.html"
echo "- Performance Reports: ./performance-reports/"
echo ""
echo "🎉 Test execution complete!"