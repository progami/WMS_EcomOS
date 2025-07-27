import { NextResponse } from 'next/server'

export async function GET() {
  // Return a test page that will log to console
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Console Logging</title>
    </head>
    <body>
      <h1>Test Console Logging</h1>
      <div id="status">Check logs/full-output.log for results...</div>
      <script>
        // Override console methods to send to server
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn
        };
        
        async function sendLog(level, args) {
          try {
            await fetch('/api/logs/edge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                logs: [{
                  level: level,
                  message: '[console.' + level + '] ' + Array.from(args).map(a => 
                    typeof a === 'object' ? JSON.stringify(a) : String(a)
                  ).join(' '),
                  timestamp: new Date().toISOString()
                }]
              })
            });
          } catch (e) {
            originalConsole.error('Failed to send log:', e);
          }
        }
        
        console.log = function(...args) {
          originalConsole.log(...args);
          sendLog('info', args);
        };
        
        console.error = function(...args) {
          originalConsole.error(...args);
          sendLog('error', args);
        };
        
        console.warn = function(...args) {
          originalConsole.warn(...args);
          sendLog('warn', args);
        };
        
        // Test logs
        console.log('TEST: Console logging is working!');
        console.error('TEST: Error logging is working!');
        console.warn('TEST: Warning logging is working!');
        
        // Test error
        setTimeout(() => {
          try {
            throw new Error('TEST: Intentional error for testing');
          } catch (e) {
            console.error('Caught error:', e.message);
          }
        }, 1000);
        
        document.getElementById('status').innerHTML = 'Logs sent! Check logs/full-output.log';
      </script>
    </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}