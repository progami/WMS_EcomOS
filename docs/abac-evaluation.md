# ABAC (Attribute-Based Access Control) Evaluation for WMS

## Current Permission System Analysis

### Current Implementation (RBAC)
The WMS currently uses a Role-Based Access Control (RBAC) system with two roles:
- `admin`: Full system access
- `staff`: Limited operational access

**Location**: `prisma/schema.prisma`
```prisma
enum UserRole {
  admin
  staff
}
```

### Limitations of Current System
1. **Binary permissions**: Users either have full access or limited access
2. **No warehouse-specific permissions**: Cannot restrict users to specific warehouses
3. **No feature-level control**: Cannot grant access to specific features
4. **No time-based access**: Cannot set temporary permissions
5. **No data-level security**: Cannot restrict access to specific SKUs or customers

## Proposed ABAC Implementation

### 1. Core Attributes Structure
```typescript
interface UserAttributes {
  userId: string
  role: string[]
  warehouses: string[]
  departments: string[]
  clearanceLevel: number
  employmentType: 'full-time' | 'contractor' | 'temporary'
  shiftHours?: { start: string; end: string }
}

interface ResourceAttributes {
  resourceType: 'warehouse' | 'sku' | 'report' | 'invoice' | 'user'
  resourceId: string
  warehouseId?: string
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted'
  department?: string
}

interface EnvironmentAttributes {
  currentTime: Date
  ipAddress: string
  location?: string
  deviceType?: 'desktop' | 'mobile' | 'tablet'
}
```

### 2. Policy Engine Design
```typescript
interface Policy {
  id: string
  name: string
  effect: 'allow' | 'deny'
  conditions: PolicyCondition[]
  priority: number
}

interface PolicyCondition {
  attribute: string
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between'
  value: any
}
```

### 3. Database Schema Changes
```prisma
model User {
  // ... existing fields
  attributes    Json?
  policies      UserPolicy[]
}

model Policy {
  id            String        @id @default(uuid())
  name          String
  description   String?
  effect        PolicyEffect
  resourceType  String
  conditions    Json
  priority      Int           @default(0)
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  userPolicies  UserPolicy[]
  groupPolicies GroupPolicy[]
}

model UserPolicy {
  id        String   @id @default(uuid())
  userId    String
  policyId  String
  expiresAt DateTime?
  user      User     @relation(fields: [userId], references: [id])
  policy    Policy   @relation(fields: [policyId], references: [id])
  
  @@unique([userId, policyId])
}

enum PolicyEffect {
  allow
  deny
}
```

### 4. Implementation Phases

#### Phase 1: Foundation (2-3 weeks)
- Create policy engine core
- Add attributes to User model
- Implement basic policy evaluation
- Create policy management UI

#### Phase 2: Migration (1-2 weeks)
- Convert existing RBAC to ABAC policies
- Maintain backward compatibility
- Add migration scripts

#### Phase 3: Advanced Features (3-4 weeks)
- Warehouse-specific permissions
- Time-based access control
- Department-based restrictions
- Audit trail for policy changes

#### Phase 4: Optimization (1-2 weeks)
- Policy caching
- Performance optimization
- Conflict resolution rules

### 5. Example Policies

#### Warehouse-Specific Access
```json
{
  "name": "Warehouse A Staff Access",
  "effect": "allow",
  "resourceType": "warehouse",
  "conditions": [
    {
      "attribute": "user.warehouses",
      "operator": "contains",
      "value": "warehouse-a-id"
    },
    {
      "attribute": "resource.warehouseId",
      "operator": "equals",
      "value": "warehouse-a-id"
    }
  ]
}
```

#### Time-Based Access
```json
{
  "name": "Shift Hours Access",
  "effect": "allow",
  "resourceType": "*",
  "conditions": [
    {
      "attribute": "environment.currentTime",
      "operator": "between",
      "value": ["user.shiftHours.start", "user.shiftHours.end"]
    }
  ]
}
```

#### Report Access by Department
```json
{
  "name": "Finance Reports Access",
  "effect": "allow",
  "resourceType": "report",
  "conditions": [
    {
      "attribute": "user.departments",
      "operator": "contains",
      "value": "finance"
    },
    {
      "attribute": "resource.resourceType",
      "operator": "equals",
      "value": "financial-report"
    }
  ]
}
```

### 6. Benefits of ABAC

1. **Granular Control**: Fine-grained permissions at resource level
2. **Dynamic Authorization**: Permissions based on real-time attributes
3. **Scalability**: Easy to add new permission types without code changes
4. **Compliance**: Better audit trails and access control for regulations
5. **Flexibility**: Complex permission scenarios without role explosion

### 7. Implementation Considerations

1. **Performance**: Policy evaluation caching required
2. **Complexity**: More complex than RBAC, requires training
3. **Migration**: Careful planning to avoid access disruptions
4. **Testing**: Comprehensive test suite for policy evaluation
5. **UI/UX**: Intuitive policy management interface needed

### 8. Recommended Libraries

- **Casbin**: Powerful authorization library with ABAC support
- **OPA (Open Policy Agent)**: Policy engine for cloud-native environments
- **Custom Solution**: Lightweight implementation for specific WMS needs

### 9. Next Steps

1. **Approve ABAC approach**: Get stakeholder buy-in
2. **Choose implementation**: Library vs custom solution
3. **Design policy schema**: Finalize attribute and policy structure
4. **Create prototype**: Build proof of concept
5. **Plan migration**: Develop migration strategy from RBAC to ABAC

## Conclusion

Implementing ABAC will provide the WMS with a flexible, scalable permission system that can handle complex authorization requirements. The phased approach ensures minimal disruption while delivering incremental value.