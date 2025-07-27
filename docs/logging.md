## Prompt for Implementation AI: Implement Comprehensive Client & Server Logging

**Goal:** Implement a robust, detailed logging system for both client and server components of the WMS application, ensuring all application-level output, errors, and performance metrics are captured. This includes integrating Winston for server-side logging, enhancing client-side log forwarding, and redirecting all `console` output to the logging system.

---

### 1. Install Required Dependencies

First, ensure all necessary logging-related packages are installed.

**Action:** Run the following command in the project root:

```bash
npm install winston winston-daily-rotate-file express-winston
```

---

### 2. Configure Server-Side Logger (`src/lib/logger/node.ts`)

This file will house the core Winston configuration for server-side logging, including different log levels, transports (console and file rotation), and category-specific loggers.

**Action:** Replace the entire content of `/Users/jarraramjad/Documents/ecom_os/WMS/src/lib/logger/node.ts` with the following code:

```typescript
// src/lib/logger/node.ts
import winston from 'winston';
import 'winston-daily-rotate-file'; // Required for DailyRotateFile transport
import expressWinston from 'express-winston';

// Define log levels and colors (matching edge.ts for consistency)
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
  perf: 7,
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey',
  perf: 'white',
};

winston.addColors(LOG_COLORS);

// Base logger configuration factory
const createWinstonLogger = (category: string) => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...args } = info;
          const ts = timestamp.slice(0, 19).replace('T', ' ');
          return `${ts} [${level}] [${category}] ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
        })
      ),
      level: (process.env.LOG_LEVEL || 'info') as winston.LogLevel,
    }),
  ];

  // Add file transport only in production environment
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: `logs/${category}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json() // Structured JSON logs for production
        ),
        level: (process.env.LOG_LEVEL || 'info') as winston.LogLevel,
      })
    );
  }

  return winston.createLogger({
    levels: LOG_LEVELS,
    transports,
    exitOnError: false, // Do not exit on handled exceptions
  });
};

// Category-specific loggers
export const systemLogger = createWinstonLogger('system');
export const authLogger = createWinstonLogger('auth');
export const apiLogger = createWinstonLogger('api');
export const dbLogger = createWinstonLogger('database');
export const businessLogger = createWinstonLogger('business');
export const securityLogger = createWinstonLogger('security');
export const perfLogger = createWinstonLogger('performance');
export const cacheLogger = createWinstonLogger('cache');

// Default logger (for general use)
export const logger = createWinstonLogger('application');
export const clientLogger = createWinstonLogger('client'); // For logs forwarded from client

// Middleware for HTTP request logging
export const middleware = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...args } = info;
          const ts = timestamp.slice(0, 19).replace('T', ' ');
          return `${ts} [${level}] [http] ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
        })
      ),
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  meta: true, // Log request and response details
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: true,
  colorize: true,
  ignoreRoute: (req) => req.url.startsWith('/_next') || req.url.startsWith('/api/health'), // Ignore Next.js internal routes and health checks
});

// Initialization function (e.g., for setting up global error handling)
export const initialize = () => {
  // Catch unhandled rejections and uncaught exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at Promise:', { promise, reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error });
    process.exit(1); // Exit after logging uncaught exceptions
  });

  logger.info('Server-side logging initialized.');
};

// Re-export default (for compatibility with existing imports)
export default logger;
```

---

### 3. Integrate Server-Side Logger into `server.js`

This step integrates the Winston logger and its HTTP middleware into the custom Next.js server. It also includes the crucial step of redirecting all `console` output to the logging system.

**Action:** Replace the entire content of `/Users/jarraramjad/Documents/ecom_os/WMS/server.js` with the following code:

```javascript
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const { initialize, middleware: httpLoggerMiddleware } = require('./src/lib/logger/node');

// Load environment variables only if not in CI
// This prevents dotenv from overriding DATABASE_URL set by CI
if (!process.env.CI) {
  require('dotenv').config({
    path: path.join(__dirname, `.env.${process.env.NODE_ENV || 'development'}`)
  });
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || (process.env.CI ? '0.0.0.0' : 'localhost');
const port = parseInt(process.env.PORT || '3000', 10);

// In CI, log more information about startup
if (process.env.CI) {
  console.log('Running in CI mode');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
  console.log('USE_TEST_AUTH:', process.env.USE_TEST_AUTH);
}

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize server-side logging
initialize();

// Redirect console methods to Winston logger for comprehensive capture
const originalConsole = {};
['log', 'error', 'warn', 'info', 'debug', 'trace'].forEach(methodName => {
  originalConsole[methodName] = console[methodName];
  console[methodName] = (...args) => {
    // Use the main application logger for console output
    // Ensure global.logger is available and has the method
    if (global.logger && typeof global.logger[methodName] === 'function') {
      global.logger[methodName](...args);
    } else {
      // Fallback to original console if logger is not yet initialized or method doesn't exist
      originalConsole[methodName](...args);
    }
  };
});


app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // Use HTTP request logger middleware
    httpLoggerMiddleware(req, res, async () => {
      try {
        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;

        // Handle all requests through Next.js
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err); // This will now be caught by our redirected console.error
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });
  })
    .once('error', (err) => {
      console.error('Server error:', err); // This will now be caught by our redirected console.error
      process.exit(1);
    })
    .listen(port, () => {
      console.log( // This will now be caught by our redirected console.log
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`
      );
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server'); // This will now be caught by our redirected console.log
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server'); // This will now be caught by our redirected console.log
  process.exit(0);
});
```

---

### 4. Configure Client-Side Logger (`src/lib/logger/edge.ts`)

This file handles client-side log buffering and forwarding to a server endpoint.

**Action:** Replace the entire content of `/Users/jarraramjad/Documents/ecom_os/WMS/src/lib/logger/edge.ts` with the following code:

```typescript
// src/lib/logger/edge.ts

// Edge-compatible logger that doesn't use Node.js modules
// This logger works in both edge runtime and client environments

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly' | 'perf';

export interface LogMetadata {
  category?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
}

export interface Logger {
  error: (message: string, metadata?: any) => void;
  warn: (message: string, metadata?: any) => void;
  info: (message: string, metadata?: any) => void;
  http: (message: string, metadata?: any) => void;
  verbose: (message: string, metadata?: any) => void;
  debug: (message: string, metadata?: any) => void;
  log?: (level: string, message: string, metadata?: any) => void;
}

// Log level priorities
const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
  perf: 7,
};

// Get current log level from environment
const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL || process.env.NEXT_PUBLIC_LOG_LEVEL || 'info';
  return envLevel as LogLevel;
};

// Check if a log should be output based on level
const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
};

// Format log message for console output
const formatLogMessage = (entry: LogEntry): string => {
  const { timestamp, level, message, metadata } = entry;
  let formatted = `${timestamp} [${level.toUpperCase()}]`;
  
  if (metadata?.category) {
    formatted += ` [${metadata.category}]`;
  }
  
  formatted += `: ${message}`;
  
  if (metadata && Object.keys(metadata).length > 0) {
    const { category, ...rest } = metadata;
    if (Object.keys(rest).length > 0) {
      formatted += ` ${JSON.stringify(rest)}`;
    }
  }
  
  return formatted;
};

// Redact sensitive information
function redactSensitiveData(data: any): any {
  if (!data) return data;

  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'creditCard',
    'ssn',
    'bankAccount',
  ];

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (typeof data === 'object') {
    const redacted = { ...data };
    Object.keys(redacted).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = redactSensitiveData(redacted[key]);
      }
    });
    return redacted;
  }

  return data;
}

// Base logger class
class EdgeLogger {
  private buffer: LogEntry[] = [];
  private flushEndpoint: string = '/api/logs/edge';
  private maxBufferSize: number = 100;
  private isEdgeRuntime: boolean = typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis;
  private isBrowser: boolean = typeof window !== 'undefined';

  constructor() {
    // In browser, set up periodic flushing
    if (this.isBrowser) {
      setInterval(() => this.flush(), 10000); // Flush every 10 seconds
      
      // Flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  private createEntry(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: redactSensitiveData(metadata),
    };
  }

  private _log(level: LogLevel, message: string, metadata?: LogMetadata) {
    if (!shouldLog(level)) return;

    const entry = this.createEntry(level, message, metadata);

    // Console output
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGS !== 'false') {
      const consoleMethod = level === 'error' ? 'error' : 
                          level === 'warn' ? 'warn' : 
                          level === 'debug' ? 'debug' : 'log';
      
      if (this.isBrowser || this.isEdgeRuntime) {
        console[consoleMethod](formatLogMessage(entry));
      } else {
        // In Node.js environment, let the server logger handle it
        console[consoleMethod](formatLogMessage(entry));
      }
    }

    // Buffer logs for remote sending (browser/edge only)
    if (this.isBrowser || this.isEdgeRuntime) {
      this.buffer.push(entry);
      if (this.buffer.length >= this.maxBufferSize) {
        this.flush();
      }
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      // Construct the full URL for the logs endpoint
      const baseUrl = this.isBrowser 
        ? window.location.origin 
        : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || '3002'}`);
      const url = `${baseUrl}${this.flushEndpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });

      if (!response.ok) {
        // Put logs back if failed
        this.buffer.unshift(...logs);
      }
    } catch (error) {
      // Put logs back if failed
      this.buffer.unshift(...logs);
      console.error('Failed to send logs:', error);
    }
  }

  // Public logging methods
  error(message: string, metadata?: LogMetadata) {
    this._log('error', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata) {
    this._log('warn', message, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this._log('info', message, metadata);
  }

  http(message: string, metadata?: LogMetadata) {
    this._log('http', message, metadata);
  }

  verbose(message: string, metadata?: LogMetadata) {
    this._log('verbose', message, metadata);
  }

  debug(message: string, metadata?: LogMetadata) {
    this._log('debug', message, metadata);
  }

  silly(message: string, metadata?: LogMetadata) {
    this._log('silly', message, metadata);
  }

  log(level: string, message: string, metadata?: LogMetadata) {
    this._log(level as LogLevel, message, metadata);
  }
}

// Create logger instance
const edgeLogger = new EdgeLogger();

// Category-specific loggers
export const systemLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'system', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'system', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'system', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'system', ...metadata }),
};

export const authLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'auth', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'auth', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'auth', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'auth', ...metadata }),
};

export const apiLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'api', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'api', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'api', ...metadata }),
  http: (message: string, metadata?: any) =>
    edgeLogger.http(message, { category: 'api', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'api', ...metadata }),
};

export const dbLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'database', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'database', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'database', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'database', ...metadata }),
};

export const businessLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'business', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'business', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'business', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'business', ...metadata }),
};

export const securityLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'security', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'security', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'security', ...metadata }),
  critical: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'security', critical: true, ...metadata }),
};

export const perfLogger = {
  log: (message: string, metadata?: any) =>
    edgeLogger.log('perf', message, { category: 'performance', ...metadata }),
  slow: (operation: string, duration: number, threshold: number, metadata?: any) => {
    if (duration > threshold) {
      edgeLogger.warn(`Slow operation detected: ${operation}`, {
        category: 'performance',
        operation,
        duration,
        threshold,
        ...metadata,
      });
    }
  },
};

export const cacheLogger = {
  info: (message: string, metadata?: any) =>
    edgeLogger.info(message, { category: 'cache', ...metadata }),
  error: (message: string, metadata?: any) =>
    edgeLogger.error(message, { category: 'cache', ...metadata }),
  warn: (message: string, metadata?: any) =>
    edgeLogger.warn(message, { category: 'cache', ...metadata }),
  debug: (message: string, metadata?: any) =>
    edgeLogger.debug(message, { category: 'cache', ...metadata }),
  verbose: (message: string, metadata?: any) =>
    edgeLogger.verbose(message, { category: 'cache', ...metadata }),
  http: (message: string, metadata?: any) =>
    edgeLogger.http(message, { category: 'cache', ...metadata }),
};

// Default export
export default edgeLogger;

// Explicitly export 'logger' and 'clientLogger' for consistent imports
export const logger = edgeLogger;
export const clientLogger = edgeLogger;
```

---

### 5. Configure Client-Side Log API Endpoint (`src/app/api/logs/edge/route.ts`)

This API route receives logs from the client-side `EdgeLogger` and processes them using the server-side `clientLogger`.

**Action:** Replace the entire content of `/Users/jarraramjad/Documents/ecom_os/WMS/src/app/api/logs/edge/route.ts` with the following code:

```typescript
// src/app/api/logs/edge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clientLogger } from '@/lib/logger/server'; // Use the server-side clientLogger

export async function POST(req: NextRequest) {
  try {
    const { logs } = await req.json();

    if (!Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
    }

    logs.forEach((logEntry: any) => {
      // Ensure logEntry has expected properties, and redact sensitive data if necessary
      const { level, message, metadata } = logEntry;
      // Dynamically call the appropriate logger method based on the log level
      if (clientLogger[level as keyof typeof clientLogger]) {
        (clientLogger[level as keyof typeof clientLogger] as Function)(message, metadata);
      } else {
        // Fallback for unknown log levels
        clientLogger.info(message, { ...metadata, level: level || 'unknown' });
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    clientLogger.error('Failed to receive client logs', { error });
    return NextResponse.json({ error: 'Failed to process logs' }, { status: 500 });
  }
}
```

---

### 6. Configure Logger Entry Points

These files ensure that the correct logger (client or server) is imported based on the environment.

**Action:**
*   **Create `/Users/jarraramjad/Documents/ecom_os/WMS/src/lib/logger/client.ts`** with the following content:

    ```typescript
    // src/lib/logger/client.ts
    import edgeLogger, {
      systemLogger, authLogger, apiLogger, dbLogger, businessLogger,
      securityLogger, perfLogger, cacheLogger
    } from './edge';

    export default edgeLogger;
    export const logger = edgeLogger; // Alias for default export
    export const clientLogger = edgeLogger; // Explicit client logger

    export {
      systemLogger, authLogger, apiLogger, dbLogger, businessLogger,
      securityLogger, perfLogger, cacheLogger
    };
    ```

*   **Create `/Users/jarraramjad/Documents/ecom_os/WMS/src/lib/logger/server.ts`** with the following content:

    ```typescript
    // src/lib/logger/server.ts
    import nodeLogger, {
      systemLogger, authLogger, apiLogger, dbLogger, businessLogger,
      securityLogger, perfLogger, cacheLogger
    } from './node';

    export default nodeLogger;
    export const logger = nodeLogger; // Alias for default export
    export const clientLogger = nodeLogger; // Explicit client logger

    export {
      systemLogger, authLogger, apiLogger, dbLogger, businessLogger,
      securityLogger, perfLogger, cacheLogger
    };
    ```

*   **Delete `/Users/jarraramjad/Documents/ecom_os/WMS/src/lib/logger/index.ts`** (if it still exists).

---

### 7. Update Existing Logger Imports

Ensure all existing imports of the logger throughout the application point to the correct new entry points (`@/lib/logger/client` for client-side code, `@/lib/logger/server` for server-side code).

**Action:** Review and update all files that import from `@/lib/logger`. For example:

*   **For server-side files (e.g., API routes, services):**
    *   Change `import { logger } from '@/lib/logger';` to `import { logger } from '@/lib/logger/server';`
    *   Change `import { businessLogger } from '@/lib/logger';` to `import { businessLogger } from '@/lib/logger/server';`
    *   And so on for all specific loggers (`apiLogger`, `dbLogger`, `perfLogger`, etc.).

*   **For client-side files (e.g., React components, hooks):**
    *   Change `import { logger } from '@/lib/logger';` to `import { logger } from '@/lib/logger/client';`
    *   Change `import { clientLogger } from '@/lib/logger';` to `import { clientLogger } from '@/lib/logger/client';`

---

### 8. Usage Examples and Best Practices

**Server-Side Usage:**

```typescript
// Example in an API route (e.g., src/app/api/users/route.ts)
import { businessLogger, apiLogger } from '@/lib/logger/server';

export async function GET(req: NextRequest) {
  try {
    apiLogger.info('Fetching all users', { userId: 'admin', ip: req.ip });
    // ... logic to fetch users
    businessLogger.debug('User data retrieved successfully', { count: users.length });
    return NextResponse.json(users);
  } catch (error) {
    apiLogger.error('Failed to fetch users', { error: error.message, stack: error.stack });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Example in a service (e.g., src/lib/services/permission-service.ts)
import { businessLogger, securityLogger, perfLogger } from '@/lib/logger/server';

export class PermissionService {
  static async initializePermissions(): Promise<void> {
    const startTime = process.hrtime.bigint();
    try {
      businessLogger.info('Starting permission initialization');
      // ... permission logic
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      perfLogger.log('Permission initialization completed', { durationMs });
      securityLogger.info('Permissions initialized successfully', { user: 'system' });
    } catch (error) {
      businessLogger.error('Failed to initialize permissions', { error: error.message });
      securityLogger.error('Security alert: Permission initialization failed', { error: error.message });
      throw error;
    }
  }
}
```

**Client-Side Usage:**

```typescript
// Example in a React component (e.g., src/app/dashboard/page.tsx or a custom hook)
import { clientLogger } from '@/lib/logger/client'; // Import from client entry point
import { useEffect } from 'react';

export default function DashboardPage() {
  useEffect(() => {
    clientLogger.info('Dashboard page loaded', { path: window.location.pathname });
    try {
      // Simulate an error
      if (Math.random() < 0.1) {
        throw new Error('Simulated client-side error');
      }
    } catch (error) {
      clientLogger.error('Client-side error on dashboard', {
        component: 'DashboardPage',
        error: error.message,
        stack: error.stack,
      });
    }
  }, []);

  return (
    <div>
      <h1>Welcome to the Dashboard</h1>
      {/* ... */}
    </div>
  );
}
```

---

### 9. Verification

After applying all the changes, perform the following steps to verify the comprehensive logging setup:

1.  **Clean and Build the application:**
    ```bash
    npm run clean && npm run build
    ```
    Ensure it compiles successfully without any errors.

2.  **Start the application with OS-level output redirection:**
    ```bash
    NODE_ENV=development npm run dev > logs/full-output.log 2>&1 &
    ```
    (For production, use `NODE_ENV=production npm run start > logs/full-output.log 2>&1 &`)

3.  **Check `logs/full-output.log`:**
    *   Confirm that it contains all console output, including Next.js development server messages (e.g., "✓ Ready in Xms", "Compiling /page..."), Webpack output, and any early startup messages.
    *   Verify that your application's Winston logs (from both server and client) are also present within this file.

4.  **Check Winston-specific log files:**
    *   In the `logs/` directory, verify that structured Winston logs (e.g., `application-YYYY-MM-DD.log`, `http-YYYY-MM-DD.log`, `client-YYYY-MM-DD.log`) are being generated correctly.
    *   Inspect their content to ensure they contain the expected structured log data.

This comprehensive approach will provide 100% visibility into all application output.
