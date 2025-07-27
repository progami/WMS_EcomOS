#!/usr/bin/env node

// Test script to verify error and warning logging still works
console.log('Starting log filtering test...');

// Test various log types
console.log('INFO: This is a regular info message');
console.warn('WARNING: This is a warning message - should be captured');
console.error('ERROR: This is an error message - should be captured');

// Test filtered patterns
console.log('next:jsconfig-paths-plugin: Module resolution - should be filtered');
console.log('compression gzip compression - should be filtered');
console.log('next:router-server:main requestHandler! - should be filtered');

// Test filtered patterns with errors
console.log('next:jsconfig-paths-plugin: ERROR Failed to resolve - should be captured');
console.warn('compression: WARNING compression failed - should be captured');

// Test exceptions
try {
  throw new Error('Test exception - should be captured');
} catch (e) {
  console.error('Exception caught:', e.message);
}

// Test critical messages
console.log('CRITICAL: System failure - should be captured');
console.log('FATAL: Database connection lost - should be captured');
console.log('Failed to connect - should be captured');

console.log('Log filtering test completed.');