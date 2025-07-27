# Permission-Based Access Control System

## Overview

The WMS application now implements a comprehensive permission-based Role-Based Access Control (RBAC) system that replaces the previous binary role checks (admin/staff) with granular permission-based authorization.

## Key Components

### 1. Database Schema

Three new tables have been added to manage permissions:

- **permissions**: Stores all available permissions in the system
- **role_permissions**: Maps permissions to roles (admin, staff)
- **user_permissions**: Allows granting/revoking specific permissions to individual users

### 2. Permission Format

Permissions follow the format: `resource:action`

Examples:
- `invoice:create` - Create invoices
- `inventory:read` - View inventory
- `warehouse:manage` - Manage warehouse settings

### 3. Permission Service

Located at `/src/lib/services/permission-service.ts`, provides:
- Permission initialization
- User permission retrieval
- Permission checking methods
- Permission granting/revoking

### 4. Middleware

The `withPermission` middleware (`/src/lib/middleware/permission-middleware.ts`) protects API routes:

```typescript
export async function GET(req: NextRequest) {
  return withPermission(req, { permissions: PERMISSIONS.USER_READ }, async () => {
    // Route handler code
  })
}
```

### 5. Client-Side Hook

The `usePermissions` hook (`/src/hooks/usePermissions.ts`) provides permission checking in React components:

```typescript
const { hasPermission, can } = usePermissions()

if (can('create', 'invoice')) {
  // Show create invoice button
}
```

## Available Permissions

### Invoice Permissions
- `invoice:create` - Create new invoices
- `invoice:read` - View invoices
- `invoice:update` - Update invoices
- `invoice:delete` - Delete invoices
- `invoice:dispute` - Dispute invoices
- `invoice:reconcile` - Reconcile invoices
- `invoice:pay` - Mark invoices as paid

### Inventory Permissions
- `inventory:create` - Create inventory transactions
- `inventory:read` - View inventory
- `inventory:update` - Update inventory
- `inventory:delete` - Delete inventory records
- `inventory:adjust` - Adjust inventory quantities
- `inventory:transfer` - Transfer inventory between warehouses

### Warehouse Permissions
- `warehouse:create` - Create warehouses
- `warehouse:read` - View warehouses
- `warehouse:update` - Update warehouse details
- `warehouse:delete` - Delete warehouses
- `warehouse:manage` - Manage warehouse settings

### User Permissions
- `user:create` - Create users
- `user:read` - View users
- `user:update` - Update user details
- `user:delete` - Delete users
- `user:manage` - Manage user permissions

### Additional Permissions
- SKU management (`sku:*`)
- Rate management (`rate:*`)
- Report access (`report:*`)
- Settings management (`settings:*`)
- Audit log access (`audit:*`)
- Transaction management (`transaction:*`)
- Cost management (`cost:*`)
- Demo environment (`demo:*`)
- Amazon integration (`amazon:*`)
- Import/Export (`import:*`, `export:*`)

## Default Role Permissions

### Admin Role
- Has all permissions by default
- Can manage user permissions

### Staff Role
- Limited operational permissions:
  - View invoices and dispute them
  - Create and view inventory
  - View warehouses, SKUs, and rates
  - View operational reports
  - Export data

## Implementation Guide

### 1. Initialize Permissions

Run the initialization script to populate the database:

```bash
npm run initialize-permissions
```

Or via API:
```bash
POST /api/admin/permissions/initialize
```

### 2. Protect API Routes

Replace role checks with permission checks:

```typescript
// Before
if (!session || session.user.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// After
return withPermission(req, { permissions: PERMISSIONS.USER_CREATE }, async () => {
  // Route handler code
})
```

### 3. Update UI Components

Use the `usePermissions` hook:

```typescript
const { can } = usePermissions()

return (
  <div>
    {can('create', 'invoice') && (
      <Button onClick={createInvoice}>Create Invoice</Button>
    )}
  </div>
)
```

### 4. Manage User Permissions

Use the `UserPermissionsManager` component or API endpoints:

```typescript
// Grant permission
POST /api/admin/permissions/users/{userId}
{
  "grant": ["invoice:create", "invoice:update"]
}

// Revoke permission
POST /api/admin/permissions/users/{userId}
{
  "revoke": ["invoice:delete"]
}
```

## Migration Notes

### Backward Compatibility

- Existing admin users retain all permissions
- Existing staff users get default staff permissions
- The system maintains backward compatibility during transition

### Updating Existing Code

1. Search for `session.user.role === 'admin'` checks
2. Replace with appropriate permission checks
3. Update UI components to use `usePermissions` hook
4. Test thoroughly to ensure proper access control

## Security Considerations

1. **Permission Caching**: User permissions are cached in the JWT token for performance
2. **Session Invalidation**: Changing user permissions should invalidate their sessions
3. **Audit Logging**: All permission changes should be logged
4. **Principle of Least Privilege**: Grant only necessary permissions

## Best Practices

1. Use specific permissions rather than broad ones
2. Group related permissions logically
3. Document permission requirements for each feature
4. Regularly audit user permissions
5. Test permission checks thoroughly
6. Consider permission inheritance for complex scenarios

## API Reference

### Check User Permissions
```
GET /api/admin/permissions/users/{userId}
```

### Update User Permissions
```
PATCH /api/admin/permissions/users/{userId}
{
  "grant": ["permission1", "permission2"],
  "revoke": ["permission3"]
}
```

### Initialize Permissions
```
POST /api/admin/permissions/initialize
```

## Troubleshooting

### Common Issues

1. **"Forbidden" errors after implementation**
   - Ensure permissions are initialized in the database
   - Check that users have appropriate permissions assigned
   - Verify JWT tokens are refreshed after permission changes

2. **Performance issues**
   - Permissions are cached in JWT tokens
   - Use database indices on permission tables
   - Consider Redis caching for high-traffic scenarios

3. **Permission not found**
   - Run initialization script
   - Check permission name spelling
   - Ensure permission exists in DEFAULT_PERMISSIONS constant