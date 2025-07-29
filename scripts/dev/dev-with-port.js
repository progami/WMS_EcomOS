#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Get PORT from environment or use default
const port = process.env.PORT || '3002';

console.log(`Starting Next.js dev server on port ${port}...`);

// Get additional arguments passed to the script
const extraArgs = process.argv.slice(2);

// Check if --turbo flag is explicitly passed
const useTurbo = extraArgs.includes('--turbo');

// Run next dev with the specified port
// Note: Temporarily disabled --turbo by default due to HMR issues with lucide-react
const args = ['next', 'dev', '-p', port, ...extraArgs];
if (!extraArgs.length) {
  console.log('Note: Running without Turbopack. Use "npm run dev -- --turbo" to enable Turbopack.');
}
const child = spawn('npx', args, {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});