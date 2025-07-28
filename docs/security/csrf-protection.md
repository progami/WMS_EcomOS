# CSRF Protection Implementation

## Overview

The WMS application implements Cross-Site Request Forgery (CSRF) protection for all state-changing operations (POST, PUT, PATCH, DELETE) to prevent unauthorized actions from malicious websites.

## How It Works

1. **Token Generation**: When a user authenticates, a unique CSRF token is generated and stored as an HTTP-only cookie.
2. **Token Validation**: For state-changing requests, the server validates that the CSRF token in the request header matches the token in the cookie.
3. **Origin Validation**: The server also validates that requests come from allowed origins.

## Implementation Details

### Middleware Integration

CSRF protection is automatically applied in the Next.js middleware (`src/middleware.ts`):

```typescript
// Apply CSRF protection for state-changing operations
if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
  const csrfResponse = csrfProtection(request)
  if (csrfResponse) {
    return csrfResponse
  }
}
```

### Frontend Usage

#### Using fetchWithCSRF

The recommended way to make API requests is using the `fetchWithCSRF` utility:

```typescript
import { fetchWithCSRF } from '@/lib/utils/csrf'

const response = await fetchWithCSRF('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

#### Using API Client

The API client (`src/lib/api-client.ts`) automatically includes CSRF protection:

```typescript
import { apiPost, apiPut, apiDelete } from '@/lib/api-client'

// These methods automatically include CSRF token
await apiPost('/api/skus', skuData)
await apiPut('/api/skus/123', updatedData)
await apiDelete('/api/skus/123')
```

### Token Management

- Tokens are automatically generated when users authenticate
- Tokens are refreshed every 30 minutes via the CSRFProvider
- Tokens are stored as HTTP-only cookies for security

### Public Endpoints

The following endpoints are exempt from CSRF protection:
- `/api/health`
- `/api/auth/providers`
- `/api/demo`
- `/api/auth/csrf` (used to obtain tokens)

## Testing CSRF Protection

Use the provided test script to verify CSRF protection:

```bash
node scripts/test-csrf.js
```

This script tests:
1. Requests without CSRF tokens are blocked
2. CSRF tokens can be obtained
3. Requests with valid CSRF tokens are allowed
4. GET requests don't require CSRF tokens

## Troubleshooting

### "Invalid CSRF token" errors

1. Ensure you're using `fetchWithCSRF` or the API client for requests
2. Check that cookies are enabled in your browser
3. Verify the token hasn't expired (refresh the page)

### "Invalid origin" errors

1. Check that your request origin matches the allowed origins
2. For development, ensure `localhost:3000` is in the allowed origins
3. For production, update `CSRF_ALLOWED_ORIGINS` environment variable

## Security Considerations

1. **Never disable CSRF protection** for state-changing endpoints
2. **Always use HTTPS** in production to prevent token interception
3. **Keep tokens secure** - they're stored as HTTP-only cookies
4. **Validate both token and origin** for defense in depth

## Environment Variables

Configure allowed origins for CSRF protection:

```env
# Comma-separated list of allowed origins
CSRF_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```