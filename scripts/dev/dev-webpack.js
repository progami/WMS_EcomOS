#!/usr/bin/env node
const { spawn } = require('child_process');

console.log('Starting Next.js dev server with webpack (no Turbopack)...');

// Force webpack by NOT passing --turbo
const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Ensure Turbopack is not enabled through env
    TURBOPACK: '0'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});