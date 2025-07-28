const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../logs/full-output.log');
const command = process.argv[2]; // 'dev' or 'start'
const args = process.argv.slice(3); // Remaining arguments

// Clear the log file before starting
fs.writeFileSync(logFilePath, '');

let childProcess;

// Enhanced environment to capture more logs
const enhancedEnv = {
  ...process.env,
  FORCE_COLOR: '0', // Disable color codes that might interfere
  CI: 'true', // Some tools log more in CI mode
  DEBUG: '*', // Enable all debug logs
  NODE_OPTIONS: '--trace-warnings' // Show warning stack traces
};

if (command === 'dev') {
  childProcess = spawn('npm', ['run', 'dev:original', ...args], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...enhancedEnv, NODE_ENV: 'development' },
    shell: true // Use shell to capture more output
  });
} else if (command === 'start') {
  childProcess = spawn('npm', ['run', 'start:original', ...args], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...enhancedEnv, NODE_ENV: 'production' },
    shell: true
  });
} else {
  console.error('Usage: node log-runner.js <dev|start> [args...]');
  process.exit(1);
}

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Helper to add timestamps
const addTimestamp = (data) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${data}`;
};

// Write initial message
logStream.write(addTimestamp(`Starting ${command} server...\n`));

// Handle stdout
childProcess.stdout.on('data', (data) => {
  const output = data.toString();
  logStream.write(output);
  process.stdout.write(output);
});

// Handle stderr
childProcess.stderr.on('data', (data) => {
  const output = data.toString();
  logStream.write(output);
  process.stderr.write(output);
});

childProcess.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  logStream.end();
});

childProcess.on('error', (err) => {
  console.error('Failed to start child process.', err);
  logStream.write(addTimestamp(`Error: ${err.message}\n`));
  logStream.end();
});

// Handle process termination
process.on('SIGINT', () => {
  logStream.write(addTimestamp('Received SIGINT, shutting down...\n'));
  childProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  logStream.write(addTimestamp('Received SIGTERM, shutting down...\n'));
  childProcess.kill('SIGTERM');
});
