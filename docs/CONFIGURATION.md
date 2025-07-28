# Configuration Guide

This guide explains all configuration options for the Warehouse Management System.

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://[USERNAME]:[PASSWORD]@localhost:5432/[DATABASE_NAME]?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-using-openssl-rand-base64-32"

# Redis (for BullMQ)
REDIS_URL="redis://localhost:6379"
```

### Demo/Development Settings

```bash
# Demo admin credentials (required for demo setup)
DEMO_ADMIN_EMAIL="demo-admin@warehouse.com"
DEMO_ADMIN_PASSWORD="[YOUR_SECURE_PASSWORD]"
```

### Security Configuration

```bash
# CSRF allowed origins (comma-separated)
CSRF_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3002"

# Default fallback IP for rate limiting
DEFAULT_FALLBACK_IP="127.0.0.1"
```

### Amazon Integration

```bash
# Amazon SP API configuration
AMAZON_API_ENDPOINT="https://sellingpartnerapi-na.amazon.com"
AMAZON_MARKETPLACE_ID="ATVPDKIKX0DER"
AMAZON_API_VERSION="2021-01-01"

# Rate limits
AMAZON_RATE_LIMIT_MAX_REQUESTS="10"
AMAZON_RATE_LIMIT_PER_SECONDS="2"
AMAZON_RATE_LIMIT_BURST="0.5"

# Sync intervals (in minutes)
AMAZON_SYNC_INTERVAL_MINUTES="60"
AMAZON_BATCH_SIZE_MINUTES="15"
```

### Optional Email Configuration

```bash
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="[YOUR_EMAIL]@gmail.com"
EMAIL_SERVER_PASSWORD="[YOUR_APP_PASSWORD]"
EMAIL_FROM="noreply@warehouse-system.com"
```

### Application Settings

```bash
NODE_ENV="development"
PORT="3000"

# Logging
LOG_LEVEL="info"
LOG_TO_FILE="false"
LOG_DIR="./logs"
```

## Security Notes

1. **Never commit `.env` files** - Always use `.env.example` as a template
2. **Generate secure secrets** - Use `openssl rand -base64 32` for NEXTAUTH_SECRET
3. **Use strong passwords** - Especially for DEMO_ADMIN_PASSWORD in production
4. **Restrict CSRF origins** - Only add trusted domains to CSRF_ALLOWED_ORIGINS
5. **Database security** - Use connection pooling parameters in DATABASE_URL for production

## Production Deployment

For production deployments:

1. Set all required environment variables
2. Use strong, unique passwords
3. Configure proper CSRF origins
4. Enable SSL/TLS for database connections
5. Use a proper Redis instance (not localhost)
6. Set NODE_ENV="production"

## Development Mode

In development mode:
- Default CSRF origins include localhost:3000 and localhost:3002
- Demo credentials can be used (but should still be set via env vars)
- Logging is more verbose

## Troubleshooting

If you encounter configuration issues:

1. Check all required environment variables are set
2. Verify database and Redis connections
3. Ensure NEXTAUTH_SECRET is properly generated
4. Check logs for specific error messages
5. Verify CSRF origins match your deployment URLs