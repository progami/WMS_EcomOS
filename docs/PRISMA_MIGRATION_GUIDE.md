# Prisma Schema Refactoring Guide - Snake Case to PascalCase Migration

## Overview

This guide provides a safe, step-by-step approach to migrating your Prisma schema from snake_case to PascalCase naming convention. This is a high-risk operation that requires careful planning and execution.

## Migration Strategy

The migration follows a backward-compatible approach using Prisma's `@@map` directive, which allows us to:
1. Use PascalCase model names in the application code
2. Keep the existing snake_case table names in the database (initially)
3. Migrate gradually without breaking existing functionality

## Prerequisites

- [ ] Full database backup
- [ ] Staging environment for testing
- [ ] All tests passing
- [ ] No pending database migrations
- [ ] Maintenance window scheduled

## Migration Steps

### Phase 1: Prepare for Migration (Current State)

1. **Backup your database**
   ```bash
   pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Create a branch for the migration**
   ```bash
   git checkout -b feature/prisma-pascalcase-migration
   ```

3. **Save the current schema**
   ```bash
   cp prisma/schema.prisma prisma/schema.backup.prisma
   ```

### Phase 2: Update Prisma Schema with @@map (Safe Approach)

1. **Replace the current schema with the new PascalCase schema**
   ```bash
   cp prisma/schema.new.prisma prisma/schema.prisma
   ```

   The new schema uses PascalCase model names with `@@map` directives to maintain compatibility with existing snake_case tables.

2. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

   This will create a new Prisma Client that uses PascalCase in TypeScript but still connects to snake_case tables.

3. **Run the TypeScript migration script**
   ```bash
   npx ts-node scripts/migrate-prisma-models.ts
   ```

   This script will:
   - Update all TypeScript files to use new PascalCase model names
   - Update field references to camelCase
   - Update relation names
   - Show a preview of changes before applying them

4. **Test the application**
   - Run all unit tests
   - Run integration tests
   - Test critical user flows manually
   - Verify data integrity

### Phase 3: Deploy Code Changes (No Database Changes Yet)

At this point, your application uses PascalCase in code but still connects to snake_case tables.

1. **Deploy to staging**
   - Deploy the updated code
   - Run full test suite
   - Monitor for errors

2. **Deploy to production**
   - Deploy during maintenance window
   - Monitor closely for any issues
   - Keep rollback plan ready

### Phase 4: Rename Database Tables (Optional, Higher Risk)

If you want to also rename the actual database tables to PascalCase:

1. **Schedule extended maintenance window**

2. **Apply the table rename migration**
   ```bash
   psql -d your_database -f prisma/migrations/rename_tables_to_pascal_case.sql
   ```

3. **Remove @@map directives from Prisma schema**
   - Edit `prisma/schema.prisma`
   - Remove all `@@map("old_table_name")` directives
   - Remove all `@map("old_field_name")` directives

4. **Generate and apply Prisma migration**
   ```bash
   npx prisma migrate dev --name remove_table_mappings
   ```

5. **Deploy updated code**

## Rollback Procedures

### Rollback Code Changes (Phase 2-3)

1. **Revert to backup schema**
   ```bash
   cp prisma/schema.backup.prisma prisma/schema.prisma
   npx prisma generate
   ```

2. **Revert code changes**
   ```bash
   git checkout main -- src/
   ```

### Rollback Database Changes (Phase 4)

1. **Apply rollback SQL**
   ```bash
   psql -d your_database -f prisma/migrations/rollback_rename_tables.sql
   ```

2. **Restore original schema with @@map**
   ```bash
   cp prisma/schema.new.prisma prisma/schema.prisma
   npx prisma generate
   ```

## Testing Checklist

- [ ] All Prisma queries work correctly
- [ ] Relations are properly loaded
- [ ] No TypeScript errors
- [ ] API endpoints return correct data
- [ ] Database transactions complete successfully
- [ ] Performance is not degraded
- [ ] No data loss or corruption

## Common Issues and Solutions

### Issue: TypeScript compilation errors
**Solution**: Run the migration script again or manually update missed references

### Issue: Prisma Client generation fails
**Solution**: Check for syntax errors in schema.prisma, ensure all @@map directives are correct

### Issue: Runtime errors with undefined properties
**Solution**: Check that field names are correctly mapped with @map directives

### Issue: Relation loading fails
**Solution**: Verify relation names in include/select statements are updated

## Best Practices

1. **Test extensively in staging** before production deployment
2. **Monitor application logs** closely after deployment
3. **Keep the migration reversible** at each phase
4. **Document any custom changes** needed for your specific codebase
5. **Communicate with team** about the migration schedule

## Migration Verification

After migration, verify:

```typescript
// Old way (no longer works)
const users = await prisma.users.findMany();

// New way (should work)
const users = await prisma.user.findMany();
```

## Support

If you encounter issues:
1. Check the error messages carefully
2. Verify the schema.prisma file is correct
3. Ensure Prisma Client is regenerated
4. Review the TypeScript migration script output
5. Test with a simple query first

Remember: This is a high-risk operation. Always have a rollback plan ready!