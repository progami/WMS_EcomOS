#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Kill any existing process on port 3000
const { execSync } = require('child_process');
try {
  execSync('lsof -ti:3000 | xargs kill -9', { stdio: 'ignore' });
} catch (e) {
  // Ignore errors if no process is running
}

// Create log file
const logFile = fs.createWriteStream('complete-dev-logs.txt', { flags: 'w' });
const errorLogFile = fs.createWriteStream('complete-dev-errors.txt', { flags: 'w' });

// Load .env.local file
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key === 'PORT') {
        process.env.PORT = value;
      }
    }
  }
}

const port = process.env.PORT || '3000';
console.log(`Starting Next.js dev server on port ${port}...`);
console.log('All output will be logged to complete-dev-logs.txt');
console.log('Errors will be logged to complete-dev-errors.txt');

// Run next dev with the specified port
const child = spawn('npx', ['next', 'dev', '-p', port], {
  env: { ...process.env },
  shell: true
});

// Capture stdout
child.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  logFile.write(text);
  
  // Also write errors to error log
  if (text.includes('error') || text.includes('Error') || text.includes('⨯') || 
      text.includes('warn') || text.includes('Warning') || text.includes('failed')) {
    errorLogFile.write(text);
  }
});

// Capture stderr
child.stderr.on('data', (data) => {
  const text = data.toString();
  process.stderr.write(text);
  logFile.write(text);
  errorLogFile.write(text);
});

child.on('exit', (code) => {
  logFile.end();
  errorLogFile.end();
  process.exit(code);
});