// Browser console logger that sends logs to server
// This runs only in the browser
export function initBrowserLogger() {
  if (typeof window === 'undefined') return;

  // Store original console methods
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };

  // Send log to server - DISABLED
  const sendLog = async (level: string, args: any[]) => {
    // Disabled: API endpoint removed
    return;
  };

  // Override console methods
  console.log = function(...args: any[]) {
    originalConsole.log(...args);
    sendLog('log', args);
  };

  console.error = function(...args: any[]) {
    originalConsole.error(...args);
    sendLog('error', args);
  };

  console.warn = function(...args: any[]) {
    originalConsole.warn(...args);
    sendLog('warn', args);
  };

  console.info = function(...args: any[]) {
    originalConsole.info(...args);
    sendLog('info', args);
  };

  console.debug = function(...args: any[]) {
    originalConsole.debug(...args);
    sendLog('debug', args);
  };

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    sendLog('error', [`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`]);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    sendLog('error', [`Unhandled promise rejection: ${event.reason}`]);
  });
}