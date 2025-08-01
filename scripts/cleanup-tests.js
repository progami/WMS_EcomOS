const fs = require('fs')
const path = require('path')

// Tests that are referenced in package.json scripts
const KEEP_TESTS = [
  // E2E tests used in CI and smoke tests
  'e2e/app-health-check.spec.ts',
  'e2e/basic-auth-flow.spec.ts',
  'e2e/simple-test.spec.ts',
  
  // Runtime tests for CI
  'e2e/auth-runtime.spec.ts',
  'e2e/dashboard-runtime.spec.ts',
  'e2e/finance-runtime.spec.ts',
  'e2e/sku-management-runtime.spec.ts',
  
  // Our new verification tests
  'e2e/api-performance.spec.ts',
  'e2e/phase2-verification.spec.ts',
  'e2e/final-verification.spec.ts',
  'e2e/system-summary.spec.ts',
  
  // Unit tests
  'unit/smoke.test.ts',
  'unit/components/ui/button.test.tsx',
  'unit/components/ui/alert.test.tsx',
  'unit/hooks/usePerformanceMonitor.test.ts',
  
  // Integration tests referenced in package.json
  'integration/external/api-resilience.test.ts',
  'integration/external/third-party-services.test.ts',
  'integration/external/webhook-handlers.test.ts',
]

// Test directories to analyze
const TEST_DIRS = [
  'tests/e2e',
  'tests/unit',
  'tests/integration',
  'tests/performance',
  'tests/security',
  'tests/vulnerability-tests',
  'tests/edge-cases',
  'tests/data-integrity'
]

console.log('🧹 TEST CLEANUP ANALYSIS\n')
console.log('Tests to keep:')
KEEP_TESTS.forEach(test => console.log(`  ✅ ${test}`))

console.log('\n\nAnalyzing test directories...\n')

let totalTests = 0
let testsToDelete = []

TEST_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    const files = getAllTestFiles(dir)
    totalTests += files.length
    
    files.forEach(file => {
      const relativePath = path.relative('tests', file)
      if (!KEEP_TESTS.includes(relativePath)) {
        testsToDelete.push(file)
      }
    })
  }
})

console.log(`Total test files: ${totalTests}`)
console.log(`Tests to keep: ${KEEP_TESTS.length}`)
console.log(`Tests to delete: ${testsToDelete.length}\n`)

if (testsToDelete.length > 0) {
  console.log('Tests to delete:')
  testsToDelete.slice(0, 20).forEach(test => {
    console.log(`  ❌ ${path.relative('tests', test)}`)
  })
  if (testsToDelete.length > 20) {
    console.log(`  ... and ${testsToDelete.length - 20} more`)
  }
}

function getAllTestFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  
  list.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTestFiles(filePath))
    } else if (file.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
      results.push(filePath)
    }
  })
  
  return results
}

// Generate cleanup script
const cleanupScript = `#!/bin/bash
# Test cleanup script
# Generated on ${new Date().toISOString()}

echo "🧹 Cleaning up unused test files..."

# Delete unused test files
${testsToDelete.map(file => `rm -f "${file}"`).join('\n')}

# Clean up empty directories
find tests -type d -empty -delete

echo "✅ Cleanup complete!"
`

fs.writeFileSync('scripts/cleanup-unused-tests.sh', cleanupScript)
console.log('\n✅ Generated cleanup script: scripts/cleanup-unused-tests.sh')
console.log('Run: bash scripts/cleanup-unused-tests.sh')