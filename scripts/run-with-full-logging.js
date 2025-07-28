#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const logFilePath = path.join(__dirname, '../logs/full-output.log');

// Create logs directory if it doesn't exist
const logsDir = path.dirname(logFilePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Clear the log file
fs.writeFileSync(logFilePath, '');

// Create write stream with auto-flush
const logStream = fs.createWriteStream(logFilePath, { 
  flags: 'a',
  highWaterMark: 0 // Disable buffering
});

// Helper to filter out verbose messages while keeping errors and warnings
function shouldFilterMessage(data) {
  const message = data.toString().toLowerCase();
  const fullMessage = data.toString();
  
  // Always keep errors and warnings
  if (message.includes('error') || message.includes('warn') || 
      message.includes('failed') || message.includes('exception') ||
      message.includes('critical') || message.includes('fatal')) {
    return false;
  }
  
  // Filter out known verbose patterns
  if (fullMessage.includes('next:jsconfig-paths-plugin') && 
      !message.includes('error') && !message.includes('warn')) {
    return true;
  }
  
  // Filter out non-error compression logs
  if (fullMessage.includes('compression') && message.includes('gzip compression') &&
      !message.includes('error') && !message.includes('warn')) {
    return true;
  }
  
  // Filter out verbose router-server logs that aren't errors
  if (fullMessage.includes('next:router-server') && 
      (message.includes('invokerender') || message.includes('requesthandler!') || 
       message.includes('invoking middleware') || message.includes('middleware res 200')) &&
      !message.includes('error') && !message.includes('warn')) {
    return true;
  }
  
  return false;
}

// Helper to write to both console and file
function writeToAll(data, stream = 'stdout') {
  const timestamp = new Date().toISOString();
  const dataStr = data.toString();
  
  // Check if we should filter this message
  if (shouldFilterMessage(dataStr)) {
    return;
  }
  
  const message = `[${timestamp}] ${dataStr}`;
  
  // Write to file
  logStream.write(message);
  
  // Write to console
  if (stream === 'stderr') {
    process.stderr.write(data);
  } else {
    process.stdout.write(data);
  }
}

// Start the Next.js dev server
const child = spawn('node', ['scripts/dev/dev-with-port.js'], {
  stdio: 'pipe',
  env: {
    ...process.env,
    FORCE_COLOR: '0', // Disable colors
    NODE_ENV: 'development',
    // Capture all Next.js logs
    NEXT_TELEMETRY_DISABLED: '1',
    // Only debug specific modules that might have errors
    // Remove DEBUG: '*' to reduce verbosity
    // Capture Prisma logs at warning level
    PRISMA_LOG_LEVEL: 'warn',
    // Node.js debugging - keep trace-warnings for errors
    NODE_OPTIONS: '--trace-warnings',
    // Set log level to info to reduce verbosity
    LOG_LEVEL: 'info'
  },
  shell: false
});

// Capture stdout
child.stdout.on('data', (data) => {
  writeToAll(data.toString(), 'stdout');
});

// Capture stderr
child.stderr.on('data', (data) => {
  writeToAll(data.toString(), 'stderr');
});

// Also intercept console methods at the process level
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace
};

// Override console methods
console.log = (...args) => {
  const message = util.format(...args) + '\n';
  writeToAll(`[console.log] ${message}`, 'stdout');
};

console.error = (...args) => {
  const message = util.format(...args) + '\n';
  writeToAll(`[console.error] ${message}`, 'stderr');
};

console.warn = (...args) => {
  const message = util.format(...args) + '\n';
  writeToAll(`[console.warn] ${message}`, 'stderr');
};

console.info = (...args) => {
  const message = util.format(...args) + '\n';
  writeToAll(`[console.info] ${message}`, 'stdout');
};

console.debug = (...args) => {
  const message = util.format(...args) + '\n';
  writeToAll(`[console.debug] ${message}`, 'stdout');
};

console.trace = (...args) => {
  const message = util.format(...args) + '\n';
  const stack = new Error().stack;
  writeToAll(`[console.trace] ${message}\n${stack}`, 'stderr');
};

// Capture process stdout/stderr writes
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = function(chunk, encoding, callback) {
  logStream.write(chunk, encoding);
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function(chunk, encoding, callback) {
  logStream.write(chunk, encoding);
  return originalStderrWrite(chunk, encoding, callback);
};

// Handle child process events
child.on('close', (code) => {
  writeToAll(`\nChild process exited with code ${code}\n`, 'stdout');
  logStream.end();
  process.exit(code);
});

child.on('error', (err) => {
  writeToAll(`\nFailed to start child process: ${err.message}\n`, 'stderr');
  logStream.end();
  process.exit(1);
});

// Handle termination signals
process.on('SIGINT', () => {
  writeToAll('\nReceived SIGINT, shutting down...\n', 'stdout');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  writeToAll('\nReceived SIGTERM, shutting down...\n', 'stdout');
  child.kill('SIGTERM');
});

// Capture uncaught exceptions
process.on('uncaughtException', (err) => {
  writeToAll(`\nUncaught Exception: ${err.message}\n${err.stack}\n`, 'stderr');
  logStream.end();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  writeToAll(`\nUnhandled Rejection at: ${promise}\nReason: ${reason}\n`, 'stderr');
});

writeToAll('Starting Next.js development server with full logging...\n', 'stdout');