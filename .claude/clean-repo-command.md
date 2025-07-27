# Clean Repository Command

When the user types `/clean-repo`, execute the following:

1. First, use the Task tool to launch a general-purpose agent to analyze the repository structure and identify cleanup candidates
2. The agent should:
   - Scan for test scripts and one-time utilities in the root directory
   - Identify duplicate or backup files
   - Find loose documentation files that should be organized
   - Check for unused scripts and temporary files
   - Analyze file dependencies to ensure nothing important is deleted
3. Generate a detailed report of proposed changes
4. Ask the user for confirmation before proceeding
5. Execute the cleanup with appropriate safety measures

## Safety Rules
- NEVER delete source code files in src/
- NEVER delete configuration files (package.json, tsconfig.json, etc.)
- NEVER delete .env files
- NEVER delete the prisma/schema.prisma file
- Always create a backup branch before making changes
- Always run in dry-run mode first

## Execution
The cleanup should be done through the Node.js script at `.claude/scripts/clean-repo.js` with appropriate options based on user preference.