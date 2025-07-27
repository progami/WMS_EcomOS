# Authentication Rate Limiting Implementation

## Overview
This document describes the rate limiting implementation for authentication endpoints as required by TODO.md section 2.2.

## Implementation Details

### 1. Core Components

#### Auth Rate Limiter (`/src/lib/security/auth-rate-limiter.ts`)
- Implements both IP-based and username-based rate limiting
- Tracks failed login attempts with configurable thresholds
- Supports exponential backoff for repeated violations
- Configuration:
  - Window: 15 minutes
  - Max attempts: 5 before temporary lockout
  - Initial lockout duration: 5 minutes
  - Account lockout threshold: 10 failed attempts

#### Modified Auth Configuration (`/src/lib/auth.ts`)
- Integrated account locking mechanism
- Checks `locked_until` field before authentication
- Automatically unlocks accounts after lockout period expires
- Records failed attempts and triggers account lockout when threshold reached
- Clears failed attempts on successful login

#### NextAuth Route Handler (`/src/app/api/auth/[...nextauth]/route.ts`)
- Wraps NextAuth handler with rate limiting checks
- Applies IP-based rate limiting before authentication attempt
- Records failed/successful attempts for rate limiting
- Redirects to error page when rate limit exceeded

#### Logger (`/src/lib/logger.ts`)
- Simple logging implementation for auth and security events
- Logs to console in development
- Ready for production logging service integration

### 2. Database Schema Requirements

The implementation expects the following fields in the `users` table:
- `locked_until`: DateTime? - Timestamp when account lockout expires
- `locked_reason`: String? - Reason for account lockout

These fields are already present in the Prisma schema.

### 3. Security Features

1. **IP-Based Rate Limiting**
   - Prevents brute force attacks from single IP
   - 5 attempts allowed per 15-minute window
   - Applies to all authentication attempts

2. **Username-Based Rate Limiting**
   - Tracks failed attempts per username
   - Prevents targeted attacks on specific accounts
   - 10 failed attempts trigger account lockout

3. **Account Lockout**
   - Accounts are locked after reaching threshold
   - Lock duration: 5 minutes (with exponential backoff)
   - Locked accounts cannot authenticate even with correct password
   - Automatic unlock after lockout period expires

4. **Protection Against User Enumeration**
   - Failed attempts are recorded even for non-existent users
   - Consistent error messages prevent user enumeration

### 4. Error Handling

- Rate limit exceeded: Redirects to `/auth/error?error=RateLimitExceeded`
- Account locked: Shows specific error message with remaining lockout time
- Error page updated to handle rate limit errors

### 5. Testing

A verification script is provided at `/scripts/verify-rate-limiting.js` to test:
- IP-based rate limiting triggers after 5 attempts
- Username-based tracking and account lockout
- Locked accounts cannot login
- Rate limit recovery behavior

To run the verification:
```bash
node scripts/verify-rate-limiting.js
```

### 6. Production Considerations

1. **Distributed Systems**
   - Current implementation uses in-memory storage
   - For production with multiple servers, use Redis or similar
   - Rate limiter can be easily adapted to use external storage

2. **Monitoring**
   - All rate limit events are logged
   - Monitor for unusual patterns of failed attempts
   - Set up alerts for account lockouts

3. **Configuration**
   - Rate limit thresholds can be adjusted in `authRateLimitConfig`
   - Consider different thresholds for different user types
   - Implement IP allowlisting for trusted sources

4. **GDPR Compliance**
   - Failed attempt logs should be purged after reasonable time
   - Current implementation cleans up after 24 hours

## Usage

The rate limiting is automatically applied to all authentication attempts through NextAuth. No additional configuration is required beyond the initial setup.

### For Developers

When handling authentication errors in the UI:
```typescript
// Check for rate limit errors
if (error === 'RateLimitExceeded') {
  // Show appropriate message to user
  showError('Too many login attempts. Please try again later.');
}
```

### For System Administrators

Monitor these log entries:
- "Rate limit exceeded for login attempt" - IP or user hit rate limit
- "Account locked due to failed attempts" - User account locked
- "Login attempt on locked account" - Attempt on locked account
- "Account automatically unlocked" - Lockout period expired

## Security Best Practices

1. Never reveal whether a username exists
2. Use consistent timing for all authentication responses
3. Log all authentication events for audit trails
4. Regularly review and adjust rate limit thresholds
5. Implement additional protections like CAPTCHA for repeated failures
6. Consider geographic-based rules for suspicious activity