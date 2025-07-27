# Service Layer Architecture

This directory contains the service layer implementation following Domain-Driven Design (DDD) principles. All business logic is encapsulated within these services, making the API routes thin layers that only handle HTTP concerns.

## Architecture Overview

```
src/
├── services/
│   ├── base.service.ts      # Base service class with common functionality
│   ├── invoice.service.ts   # Invoice management business logic
│   ├── warehouse.service.ts # Warehouse operations
│   ├── user.service.ts      # User management
│   ├── finance.service.ts   # Financial operations
│   ├── report.service.ts    # Report generation
│   └── index.ts            # Service exports and factory functions
└── app/api/                # Thin API routes that use services
```

## Base Service Class

The `BaseService` class provides common functionality for all services:

### Key Features:
- **Transaction Management**: `executeInTransaction()` for database consistency
- **Audit Logging**: `logAudit()` for tracking important operations
- **Permission Checking**: `checkPermission()` and `requirePermission()`
- **Error Handling**: Consistent error handling with `handleError()`
- **Data Validation**: Built-in validation and sanitization methods
- **Pagination**: Standardized pagination helpers

### Example Usage:

```typescript
export class InvoiceService extends BaseService {
  async createInvoice(data: CreateInvoiceDto) {
    // Permission check
    await this.requirePermission('invoice:create')
    
    // Execute in transaction
    const invoice = await this.executeInTransaction(async (tx) => {
      // Business logic here
      const invoice = await tx.invoice.create({ data })
      
      // Audit logging
      await this.logAudit('INVOICE_CREATED', 'Invoice', invoice.id, {
        invoiceNumber: invoice.invoiceNumber
      })
      
      return invoice
    })
    
    return invoice
  }
}
```

## Service Implementation Guidelines

### 1. Service Structure

Each service should:
- Extend the `BaseService` class
- Encapsulate all business logic for its domain
- Use dependency injection for database access
- Handle validation, permissions, and transactions

### 2. Error Handling

Services use consistent error handling:

```typescript
try {
  // Business logic
} catch (error) {
  this.handleError(error, 'operationName')
}
```

### 3. Permission Management

Services enforce permissions:

```typescript
// Check permission (returns boolean)
const hasPermission = await this.checkPermission('invoice:read')

// Require permission (throws if denied)
await this.requirePermission('invoice:create')
```

### 4. Transaction Management

Complex operations use transactions:

```typescript
const result = await this.executeInTransaction(async (tx) => {
  // All database operations use tx instead of this.prisma
  const invoice = await tx.invoice.create({ data })
  const lineItems = await tx.invoiceLineItem.createMany({ data })
  return { invoice, lineItems }
})
```

## API Route Integration

API routes become thin layers that:
1. Handle authentication
2. Extract request parameters
3. Call service methods
4. Return formatted responses

### Example API Route:

```typescript
// src/app/api/invoices/route.ts
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Use service layer
    const invoiceService = createInvoiceService(session)
    const result = await invoiceService.createInvoice(body)
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    // Handle errors based on type
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
```

## Service Factory Functions

Use factory functions to create service instances with proper dependencies:

```typescript
import { createInvoiceService } from '@/services'

// In API route
const invoiceService = createInvoiceService(session)
```

## Benefits

1. **Separation of Concerns**: Business logic separated from HTTP concerns
2. **Testability**: Services can be unit tested without HTTP layer
3. **Reusability**: Business logic can be reused across different interfaces
4. **Consistency**: Common patterns for permissions, transactions, and errors
5. **Maintainability**: Clear structure makes code easier to understand and modify

## Adding New Services

To add a new service:

1. Create the service file extending `BaseService`
2. Implement business logic methods
3. Add validation schemas
4. Export from `index.ts`
5. Create factory function
6. Update API routes to use the service

Example:

```typescript
// src/services/inventory.service.ts
export class InventoryService extends BaseService {
  async adjustInventory(data: AdjustInventoryDto) {
    await this.requirePermission('inventory:adjust')
    
    return this.executeInTransaction(async (tx) => {
      // Business logic
    })
  }
}

// src/services/index.ts
export function createInventoryService(session: Session) {
  return new InventoryService({ session, prisma })
}
```