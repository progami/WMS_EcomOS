# Idempotency Key Implementation

## Overview
Idempotency keys have been implemented to prevent duplicate transactions in the WMS system. This ensures that if a request is retried (due to network issues, user error, etc.), it won't create duplicate inventory transactions.

## Implementation Details

### 1. Database Schema
Added a new `idempotency_keys` table with the following structure:
- `id`: Unique identifier (CUID)
- `key`: The idempotency key (unique constraint)
- `user_id`: Reference to the user who made the request
- `expires_at`: Expiration timestamp (24 hours from creation)
- `created_at`: Creation timestamp

### 2. Service Layer
Created `IdempotencyService` at `/src/lib/services/idempotency-service.ts` with methods:
- `checkAndStore()`: Checks if a key exists and stores it if not
- `cleanupExpiredKeys()`: Removes expired keys
- `exists()`: Checks if a key exists without storing it
- `generateKey()`: Static method to generate unique keys

### 3. API Integration
The modern inventory API (`/api/inventory/transactions`) now:
- Accepts an optional `idempotencyKey` in the request body
- Returns a 409 Conflict status if a duplicate key is detected
- Logs duplicate attempts in the audit log

### 4. Frontend Integration
Both receive and ship pages already include idempotency keys:
- Generate a unique key for each transaction using `generateIdempotencyKey()`
- Include the key in the API request

### 5. Cleanup Job
Created a cleanup job at `/api/jobs/cleanup-idempotency` that:
- Can be called by admin users or a cron job
- Removes expired idempotency keys
- Logs cleanup operations in the audit log

## Usage

### Frontend Example
```typescript
import { generateIdempotencyKey } from '@/lib/utils/idempotency'

const transactionData = {
  idempotencyKey: generateIdempotencyKey(),
  transactionType: 'RECEIVE',
  // ... other transaction data
}

const response = await fetch('/api/inventory/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transactionData)
})
```

### Setting up Cleanup (Cron Job)
To automatically clean up expired keys, set up a cron job that calls:
```bash
curl -X POST https://your-domain.com/api/jobs/cleanup-idempotency \
  -H "x-cron-secret: $CRON_JOB_SECRET"
```

Set `CRON_JOB_SECRET` in your environment variables.

## Security Considerations
- Keys expire after 24 hours to prevent indefinite blocking
- Keys are tied to user IDs to prevent cross-user conflicts
- Duplicate attempts are logged for audit purposes

## Future Improvements
- Consider adding response caching for idempotent requests
- Add metrics for duplicate request attempts
- Consider shorter expiration times for high-volume operations