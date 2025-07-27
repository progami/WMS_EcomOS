#!/bin/bash

# Run Security Test Suite
echo "🔒 Running Security Test Suite..."
echo "================================"

# Set test environment
export NODE_ENV=test
export DATABASE_URL=$DATABASE_URL_TEST

# Run security tests
echo ""
echo "1. Authentication Vulnerability Tests"
npm test -- tests/security/auth-vulnerability.test.ts

echo ""
echo "2. CSRF Protection Tests"
npm test -- tests/security/csrf-protection.test.ts

echo ""
echo "3. Rate Limiting Tests"
npm test -- tests/security/rate-limiting.test.ts

echo ""
echo "4. Access Control Tests"
npm test -- tests/security/access-control.test.ts

echo ""
echo "5. Permission-Based Access Tests"
npm test -- tests/security/permission-based-access.test.ts

echo ""
echo "================================"
echo "✅ Security Test Suite Complete"
echo ""

# Generate security test report
echo "Generating security test report..."
npm test -- tests/security --coverage --coverageDirectory=./test-results/security-coverage

echo ""
echo "📊 Security test coverage report available at: ./test-results/security-coverage/lcov-report/index.html"