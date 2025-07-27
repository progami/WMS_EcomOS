#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Categories of files to clean
const CLEANUP_PATTERNS = {
  tempTestScripts: {
    patterns: [
      /^test-.*\.js$/,
      /^check-.*\.js$/,
      /^debug-.*\.js$/,
      /^verify-.*\.js$/,
      /^final-.*\.js$/,
      /^manual-.*\.js$/,
      /^analyze-.*\.js$/,
      /^fix-.*\.js$/,
      /^run-.*\.js$/
    ],
    description: 'Temporary test and debug scripts',
    targetDir: null, // null means delete
    excludePatterns: [/^test-utils\.js$/] // Preserve utility files
  },
  
  looseDocumentation: {
    patterns: [
      /^[A-Z_]+\.md$/,
      /^.*\.md$/
    ],
    description: 'Documentation files',
    targetDir: 'docs',
    excludePatterns: [/^README\.md$/, /^LICENSE/]
  },
  
  temporaryScripts: {
    patterns: [
      /^.*\.sh$/,
      /^capture-.*$/,
      /^.*-test\.json$/
    ],
    description: 'Shell scripts and test outputs',
    targetDir: null
  },
  
  backupFiles: {
    patterns: [
      /.*\.backup$/,
      /.*\.old$/,
      /.*-old\..*/,
      /.*\.orig$/
    ],
    description: 'Backup and old files',
    targetDir: null
  },
  
  prismaBackups: {
    patterns: [
      /^schema\.backup\.prisma$/,
      /^schema\.new\.prisma$/
    ],
    description: 'Prisma schema backups',
    targetDir: null,
    searchIn: ['prisma']
  },
  
  utilityScripts: {
    patterns: [
      /^.*\.js$/,
      /^.*\.ts$/
    ],
    description: 'Utility scripts in scripts directory',
    targetDir: 'scripts/utilities',
    searchIn: ['scripts'],
    excludePatterns: [
      /^migrations\//,
      /^production\//,
      /^setup-/,
      /^seed/
    ]
  }
};

// Files and directories to always preserve
const PRESERVE_PATTERNS = [
  /^\.git/,
  /^node_modules/,
  /^\.next/,
  /^out/,
  /^dist/,
  /^build/,
  /^\.env/,
  /^package.*\.json$/,
  /^tsconfig.*\.json$/,
  /^next\.config/,
  /^tailwind\.config/,
  /^postcss\.config/,
  /^\.eslintrc/,
  /^\.gitignore$/,
  /^README\.md$/,
  /^LICENSE/,
  /^src\//,
  /^public\//,
  /^prisma\/schema\.prisma$/,
  /^prisma\/migrations\//,
  /^\.claude\//
];

class RepoCleanup {
  constructor(options = {}) {
    this.dryRun = options.dryRun !== false;
    this.interactive = options.interactive || false;
    this.aggressive = options.aggressive || false;
    this.rootDir = process.cwd();
    this.report = {
      analyzed: 0,
      toDelete: [],
      toMove: [],
      preserved: [],
      errors: []
    };
  }

  async run() {
    console.log('🧹 Repository Cleanup Tool');
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`Root directory: ${this.rootDir}\n`);

    if (!this.dryRun) {
      await this.createBackupBranch();
    }

    // Analyze repository
    console.log('📊 Analyzing repository structure...');
    await this.analyzeDirectory(this.rootDir);

    // Process each category
    for (const [category, config] of Object.entries(CLEANUP_PATTERNS)) {
      await this.processCategory(category, config);
    }

    // Generate and show report
    await this.generateReport();

    if (!this.dryRun && (this.report.toDelete.length > 0 || this.report.toMove.length > 0)) {
      console.log('\n✅ Cleanup completed!');
      console.log(`📝 Report saved to: cleanup-report-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  async createBackupBranch() {
    try {
      const branchName = `backup/pre-cleanup-${new Date().toISOString().split('T')[0]}`;
      execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' });
      execSync('git checkout -', { stdio: 'ignore' });
      console.log(`✅ Created backup branch: ${branchName}\n`);
    } catch (error) {
      console.error('⚠️  Could not create backup branch:', error.message);
    }
  }

  async analyzeDirectory(dir, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        this.report.analyzed++;
        
        // Skip if should be preserved
        if (this.shouldPreserve(relPath)) {
          this.report.preserved.push(relPath);
          continue;
        }
        
        if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
          await this.analyzeDirectory(fullPath, relPath);
        }
      }
    } catch (error) {
      this.report.errors.push({ path: relativePath, error: error.message });
    }
  }

  async processCategory(category, config) {
    console.log(`\n🔍 Processing: ${config.description}`);
    
    const searchDirs = config.searchIn || [''];
    const matches = [];
    
    for (const searchDir of searchDirs) {
      const dir = path.join(this.rootDir, searchDir);
      const files = await this.findMatchingFiles(dir, config.patterns, config.excludePatterns);
      matches.push(...files.map(f => path.join(searchDir, f)));
    }
    
    if (matches.length === 0) {
      console.log('  ✓ No files found');
      return;
    }
    
    console.log(`  Found ${matches.length} files:`);
    matches.forEach(file => console.log(`    - ${file}`));
    
    if (this.interactive && !this.dryRun) {
      const answer = await this.prompt(`\nProcess these ${matches.length} files? (y/n): `);
      if (answer.toLowerCase() !== 'y') {
        console.log('  ⏭️  Skipped');
        return;
      }
    }
    
    // Process files
    for (const file of matches) {
      if (config.targetDir) {
        this.report.toMove.push({ from: file, to: path.join(config.targetDir, path.basename(file)) });
      } else {
        this.report.toDelete.push(file);
      }
    }
    
    if (!this.dryRun) {
      await this.executeActions(matches, config);
    }
  }

  async findMatchingFiles(dir, patterns, excludePatterns = []) {
    const matches = [];
    
    try {
      const entries = await fs.readdir(dir);
      
      for (const entry of entries) {
        // Check if matches any pattern
        const matchesPattern = patterns.some(pattern => pattern.test(entry));
        const excludedPattern = excludePatterns.some(pattern => pattern.test(entry));
        
        if (matchesPattern && !excludedPattern) {
          matches.push(entry);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return matches;
  }

  async executeActions(files, config) {
    if (config.targetDir) {
      // Create target directory if needed
      const targetPath = path.join(this.rootDir, config.targetDir);
      await fs.mkdir(targetPath, { recursive: true });
      
      // Move files
      for (const file of files) {
        const source = path.join(this.rootDir, file);
        const dest = path.join(targetPath, path.basename(file));
        
        try {
          await fs.rename(source, dest);
          console.log(`    ✓ Moved: ${file} → ${config.targetDir}/`);
        } catch (error) {
          console.error(`    ✗ Error moving ${file}: ${error.message}`);
        }
      }
    } else {
      // Delete files
      for (const file of files) {
        const filePath = path.join(this.rootDir, file);
        
        try {
          await fs.unlink(filePath);
          console.log(`    ✓ Deleted: ${file}`);
        } catch (error) {
          console.error(`    ✗ Error deleting ${file}: ${error.message}`);
        }
      }
    }
  }

  shouldPreserve(filePath) {
    return PRESERVE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = ['node_modules', '.git', '.next', 'out', 'dist', 'build'];
    return skipDirs.includes(dirName);
  }

  async generateReport() {
    console.log('\n📋 Cleanup Report');
    console.log('================');
    console.log(`Files analyzed: ${this.report.analyzed}`);
    console.log(`Files to delete: ${this.report.toDelete.length}`);
    console.log(`Files to move: ${this.report.toMove.length}`);
    console.log(`Files preserved: ${this.report.preserved.length}`);
    
    if (this.report.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${this.report.errors.length}`);
      this.report.errors.forEach(err => {
        console.log(`  - ${err.path}: ${err.error}`);
      });
    }
    
    if (!this.dryRun) {
      const reportPath = path.join(this.rootDir, `cleanup-report-${new Date().toISOString().split('T')[0]}.json`);
      await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    }
  }

  prompt(question) {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question(question, (answer) => {
        readline.close();
        resolve(answer);
      });
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: !args.includes('--execute'),
  interactive: args.includes('--interactive'),
  aggressive: args.includes('--aggressive')
};

// Run cleanup
const cleanup = new RepoCleanup(options);
cleanup.run().catch(console.error);