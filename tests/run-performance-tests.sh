#!/bin/bash

# Run Performance Test Suite
echo "⚡ Running Performance Test Suite..."
echo "==================================="

# Set test environment
export NODE_ENV=test
export DATABASE_URL=$DATABASE_URL_TEST

# Create performance reports directory
mkdir -p ./performance-reports

echo ""
echo "1. Baseline Performance Metrics"
echo "   Establishing performance baselines..."
npm test -- tests/performance/baseline-metrics.test.ts

echo ""
echo "2. Optimization Comparison"
echo "   Comparing before/after optimization..."
npm test -- tests/performance/optimization-comparison.test.ts

echo ""
echo "==================================="
echo "✅ Performance Test Suite Complete"
echo ""

# Check for performance reports
if [ -f "./performance-reports/baseline-metrics.json" ]; then
    echo "📊 Baseline metrics report: ./performance-reports/baseline-metrics.json"
fi

if [ -f "./performance-reports/optimization-comparison.json" ]; then
    echo "📊 Optimization comparison report: ./performance-reports/optimization-comparison.json"
    
    # Extract and display summary
    echo ""
    echo "Performance Summary:"
    echo "==================="
    node -e "
    const report = require('./performance-reports/optimization-comparison.json');
    if (report.comparisons) {
        report.comparisons.forEach(comp => {
            console.log(\`\${comp.operation}: \${comp.improvement.meanPercent.toFixed(1)}% improvement\`);
        });
    }
    " 2>/dev/null || echo "Unable to parse performance report"
fi