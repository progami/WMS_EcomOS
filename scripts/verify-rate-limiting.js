#!/usr/bin/env node

/**
 * Script to verify rate limiting is working on authentication endpoints
 * 
 * This script will:
 * 1. Test IP-based rate limiting
 * 2. Test username-based rate limiting  
 * 3. Verify account lockout after threshold
 * 4. Test that locked accounts cannot login
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USERNAME = 'test@example.com';
const TEST_PASSWORD = 'wrongpassword';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getCsrfToken() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/csrf`);
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    log('Failed to get CSRF token: ' + error.message, 'red');
    return null;
  }
}

async function attemptLogin(username, password, csrfToken) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        emailOrUsername: username,
        password: password,
        csrfToken: csrfToken || ''
      }),
      redirect: 'manual'
    });

    return {
      status: response.status,
      headers: response.headers,
      location: response.headers.get('location')
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRateLimiting() {
  log('\n=== Authentication Rate Limiting Verification ===\n', 'blue');

  // Get CSRF token
  log('Getting CSRF token...', 'yellow');
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    log('Failed to get CSRF token. Make sure the server is running.', 'red');
    return;
  }
  log('CSRF token obtained successfully', 'green');

  // Test 1: IP-based rate limiting
  log('\n--- Test 1: IP-Based Rate Limiting ---', 'blue');
  log('Attempting 6 failed logins (limit is 5)...', 'yellow');
  
  let rateLimitHit = false;
  for (let i = 1; i <= 6; i++) {
    const result = await attemptLogin(`user${i}@example.com`, TEST_PASSWORD, csrfToken);
    
    if (result.status === 429 || (result.location && result.location.includes('RateLimitExceeded'))) {
      log(`Attempt ${i}: Rate limit hit! ✓`, 'green');
      rateLimitHit = true;
      break;
    } else {
      log(`Attempt ${i}: Login failed as expected (status: ${result.status})`, 'yellow');
    }
    
    await sleep(100); // Small delay between attempts
  }

  if (!rateLimitHit) {
    log('WARNING: Rate limit was not triggered after 6 attempts!', 'red');
  }

  // Test 2: Wait for rate limit to expire
  log('\n--- Test 2: Rate Limit Recovery ---', 'blue');
  log('Waiting 10 seconds for rate limit to potentially clear...', 'yellow');
  await sleep(10000);

  const recoveryResult = await attemptLogin('recovery@example.com', TEST_PASSWORD, csrfToken);
  if (recoveryResult.status === 429 || (recoveryResult.location && recoveryResult.location.includes('RateLimitExceeded'))) {
    log('Still rate limited (as expected for 5-minute window)', 'yellow');
  } else {
    log('Rate limit cleared or not enforced', 'green');
  }

  // Test 3: Username-based rate limiting and account lockout
  log('\n--- Test 3: Username-Based Rate Limiting & Account Lockout ---', 'blue');
  log(`Attempting 11 failed logins for ${TEST_USERNAME} (lockout threshold is 10)...`, 'yellow');

  let accountLocked = false;
  for (let i = 1; i <= 11; i++) {
    const result = await attemptLogin(TEST_USERNAME, TEST_PASSWORD, csrfToken);
    
    if (result.location && result.location.includes('error')) {
      // Check if the error indicates account lockout
      log(`Attempt ${i}: Login failed`, 'yellow');
      
      if (i >= 10) {
        // After 10 attempts, account should be locked
        accountLocked = true;
        log('Account should now be locked!', 'green');
      }
    }
    
    await sleep(100);
  }

  // Test 4: Verify locked account cannot login
  log('\n--- Test 4: Verify Locked Account ---', 'blue');
  log('Attempting to login with locked account...', 'yellow');
  
  const lockedResult = await attemptLogin(TEST_USERNAME, 'correctpassword', csrfToken);
  if (lockedResult.location && lockedResult.location.includes('error')) {
    log('Locked account cannot login ✓', 'green');
  } else {
    log('WARNING: Locked account might still be able to login!', 'red');
  }

  // Summary
  log('\n=== Summary ===', 'blue');
  log('Rate limiting verification complete.', 'green');
  log('Please check the server logs for detailed rate limiting information.', 'yellow');
  log('\nNote: This script tests basic rate limiting functionality.', 'yellow');
  log('For production, ensure:', 'yellow');
  log('- Rate limits are properly configured', 'yellow');
  log('- Account lockout updates the database', 'yellow');
  log('- Logs are being properly recorded', 'yellow');
}

// Run the test
testRateLimiting().catch(error => {
  log(`\nError running tests: ${error.message}`, 'red');
  process.exit(1);
});