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
};

// Default export
export default edgeLogger;