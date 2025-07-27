# /clean-repo

A comprehensive repository cleanup command that carefully inspects and organizes the codebase.

## What it does

This command performs a thorough analysis of your repository to:

1. **Identify unused files** - Finds test scripts, one-time utilities, and temporary files that are no longer needed
2. **Organize files** - Moves files to appropriate directories based on their purpose
3. **Clean up test files** - Removes old test scripts and debugging utilities
4. **Preserve important files** - Never deletes configuration files, source code, or documentation without explicit confirmation
5. **Create a cleanup report** - Documents all proposed changes before execution

## Safety features

- **Dry run by default** - Shows what would be cleaned without making changes
- **Interactive mode** - Asks for confirmation on each category of files
- **Backup creation** - Creates a backup branch before making changes
- **Exclusion patterns** - Never touches critical files like .env, node_modules, or .git
- **Detailed logging** - Creates a log of all actions taken

## Usage

```
/clean-repo [options]

Options:
  --dry-run    Show what would be cleaned without making changes (default)
  --execute    Actually perform the cleanup (requires confirmation)
  --interactive Ask for confirmation on each file/directory
  --aggressive  Include more file types in cleanup (be careful!)
```

## File categories

### Temporary test scripts
- `test-*.js` files in root directory
- `check-*.js` files in root directory
- `debug-*.js` files in root directory
- `verify-*.js` files in root directory
- One-time migration or setup scripts

### Build artifacts
- `.next/` directory (can be regenerated)
- `out/` directory
- `dist/` directory
- Compiled files

### Documentation to organize
- Moves loose .md files to `docs/` directory
- Preserves README.md in root

### Scripts to organize
- Moves utility scripts to appropriate subdirectories
- Groups related scripts together

## What it preserves

- All source code in `src/`
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- Environment files (`.env*`)
- Git files (`.git/`, `.gitignore`)
- Important documentation (`README.md`, `LICENSE`)
- Database files (`prisma/`)
- Public assets (`public/`)

## Example workflow

1. Run `/clean-repo` to see what would be cleaned
2. Review the proposed changes
3. Run `/clean-repo --execute` to perform the cleanup
4. A backup branch is created automatically
5. Files are organized and cleaned
6. A report is generated showing all changes

## Implementation details

The command uses multiple subagents to:
- Analyze file usage and dependencies
- Detect one-time use scripts
- Identify test files that are no longer needed
- Group related files together
- Create appropriate directory structures

Each subagent specializes in different aspects:
- **File Analysis Agent** - Examines file contents and usage
- **Dependency Agent** - Checks if files are imported/required anywhere
- **Organization Agent** - Determines proper file locations
- **Safety Agent** - Ensures critical files are preserved