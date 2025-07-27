# Feature Flags System

## Overview

The feature flags system enables safe, controlled rollout of new features and changes in the WMS application. It supports percentage-based rollouts, user/role targeting, and environment-specific configurations.

## Key Features

- **Boolean Flags**: Simple on/off switches for features
- **Percentage Rollouts**: Gradually roll out features to a percentage of users
- **User Targeting**: Enable features for specific users
- **Role Targeting**: Enable features for specific roles (admin, manager, etc.)
- **Environment Overrides**: Different settings for development, staging, and production
- **Caching**: Performance-optimized with 1-minute cache TTL

## Available Feature Flags

### FEATURE_MODERN_INVENTORY_API
- **Description**: Enable modern inventory API with improved performance
- **Default**: Disabled
- **Rollout Strategy**: Start with admin users in development, then gradually increase percentage

### FEATURE_OPTIMIZED_DASHBOARD
- **Description**: Enable optimized dashboard with caching and performance improvements
- **Default**: Disabled
- **Rollout Strategy**: Test with internal users first, then percentage rollout

### FEATURE_ENHANCED_SECURITY
- **Description**: Enable enhanced security features including CSRF protection and rate limiting
- **Default**: Enabled (100% rollout)
- **Rollout Strategy**: Already rolled out to all users

### FEATURE_STANDARDIZED_SCHEMA
- **Description**: Enable standardized database schema with improved data consistency
- **Default**: Disabled
- **Rollout Strategy**: Admin-only during migration phase

### FEATURE_PERMISSION_SYSTEM
- **Description**: Enable granular permission system for role-based access control
- **Default**: Disabled
- **Rollout Strategy**: Admin users first, then gradual rollout by role

## Usage

### Server-Side (API Routes)

```typescript
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags';

// In your API route
export async function GET(req: NextRequest) {
  const useModernAPI = await isFeatureEnabled(FEATURE_FLAGS.MODERN_INVENTORY_API);
  
  if (useModernAPI) {
    // Use new implementation
    return modernInventoryHandler(req);
  }
  
  // Use legacy implementation
  return legacyInventoryHandler(req);
}
```

### Client-Side (React Components)

```typescript
import { useFeatureFlag, FEATURE_FLAGS } from '@/hooks/useFeatureFlag';

export function InventoryPage() {
  const { enabled, loading } = useFeatureFlag(FEATURE_FLAGS.MODERN_INVENTORY_API);
  
  if (loading) return <Spinner />;
  
  if (enabled) {
    return <ModernInventoryView />;
  }
  
  return <LegacyInventoryView />;
}
```

### Feature Flag Badge

Display a badge when a feature is enabled for the current user:

```typescript
import { ModernInventoryBadge } from '@/components/feature-flag-badge';

export function InventoryHeader() {
  return (
    <div className="flex items-center gap-2">
      <h1>Inventory Management</h1>
      <ModernInventoryBadge />
    </div>
  );
}
```

## Admin Management

Admins can manage feature flags through the UI at `/admin/feature-flags`.

### Creating a Flag

1. Navigate to `/admin/feature-flags`
2. Click "New Flag"
3. Enter flag name (e.g., `FEATURE_NEW_CHECKOUT`)
4. Configure settings:
   - Description
   - Enabled status
   - Rollout percentage
   - Targeted users/roles
   - Environment overrides

### Rollout Strategies

#### Percentage-Based Rollout

1. Start with 0% (disabled)
2. Enable for 10% of users
3. Monitor metrics and errors
4. Gradually increase to 25%, 50%, 100%

#### Role-Based Rollout

1. Enable for `admin` role first
2. Add `manager` role after testing
3. Finally enable for `warehouse_staff` and `customer`

#### User-Specific Testing

1. Add specific user IDs to test with real accounts
2. Remove user IDs once feature is stable

## API Endpoints

### Check Flag Status
```
GET /api/feature-flags/{name}/check
```

### List All Flags (Admin)
```
GET /api/feature-flags
```

### Create Flag (Admin)
```
POST /api/feature-flags
Body: {
  name: string,
  description?: string,
  enabled: boolean,
  rolloutPercentage: number,
  targetedUserIds: string[],
  targetedRoles: string[],
  environmentOverrides: object
}
```

### Update Flag (Admin)
```
PATCH /api/feature-flags/{name}
Body: Partial flag configuration
```

### Delete Flag (Admin)
```
DELETE /api/feature-flags/{name}
```

## Database Schema

```sql
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage DECIMAL(5,2) DEFAULT 0,
  targeted_user_ids JSONB DEFAULT '[]',
  targeted_roles JSONB DEFAULT '[]',
  environment_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL,
  created_by TEXT REFERENCES users(id)
);
```

## Best Practices

1. **Always provide fallbacks**: Ensure the application works when flags are disabled
2. **Monitor rollouts**: Watch error rates and performance metrics during rollouts
3. **Clean up old flags**: Remove flags once features are 100% rolled out and stable
4. **Use descriptive names**: Flag names should clearly indicate what they control
5. **Document changes**: Update this documentation when adding new flags

## Rollout Checklist

- [ ] Create feature flag in development environment
- [ ] Test with targeted users
- [ ] Enable for admin role
- [ ] Start percentage rollout (10%)
- [ ] Monitor metrics for 24 hours
- [ ] Increase to 25% if stable
- [ ] Monitor for another 24 hours
- [ ] Increase to 50%, then 100%
- [ ] Remove flag code after 2 weeks of stability
- [ ] Archive flag in database

## Troubleshooting

### Flag Not Working

1. Check cache - flags are cached for 1 minute
2. Verify user session is available
3. Check environment overrides
4. Review flag configuration in admin UI

### Performance Issues

1. Ensure cache is working properly
2. Check database connection pool
3. Monitor flag check frequency

### Rollback Procedure

1. Set rollout percentage to 0
2. Or disable flag entirely
3. Clear cache if needed
4. Monitor for immediate effect