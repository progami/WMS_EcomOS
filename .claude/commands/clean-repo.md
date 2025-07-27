---
description: Clean up temporary files, organize scripts, and remove unused test files from the repository
tools:
  - Task
  - Bash
  - Read
  - Glob
  - TodoWrite
---

# Repository Cleanup Task

Use the Task tool to analyze the repository and identify files for cleanup. The task should:

1. **Identify temporary test files** in the root directory:
   - Files matching patterns: test-*.js, check-*.js, debug-*.js, verify-*.js, manual-*.js
   - One-time script files that are no longer needed
   - Temporary output files

2. **Find backup and old files**:
   - Files ending with .backup, .old, -old.*, .orig
   - Prisma schema backups (schema.backup.prisma, schema.new.prisma)

3. **Locate loose documentation** that should be organized:
   - .md files in root (except README.md)
   - Should be moved to docs/ directory

4. **Analyze script usage**:
   - Check if scripts are imported or used anywhere
   - Identify one-time migration scripts

5. **Create a cleanup plan** with:
   - Files to delete (with reasons)
   - Files to move (with destinations)
   - Files to preserve (critical files)

6. **Safety checks**:
   - NEVER delete files in src/
   - NEVER delete package.json, tsconfig.json, or other config files
   - NEVER delete .env files
   - NEVER delete prisma/schema.prisma
   - Preserve all files in public/

After analysis, present the findings and ask for confirmation before proceeding with any deletions or moves.

$ARGUMENTS