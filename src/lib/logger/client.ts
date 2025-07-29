// Client-side logger for browser environments
export interface ClientLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  metadata?: any;
  url?: string;
  userAgent?: string;
  userId?: string;
}

// Helper functions to avoid class property initializers
function sanitizeMetadata(metadata: any): any {
  if (!metadata) return metadata;

  // Remove sensitive data
  const sensitiveKeys = ['password', 'token', 'apiKey', 'creditCard', 'ssn'];
  
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    const sanitized = { ...metadata };
    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  return metadata;
}

function getUserId(): string | undefined {
  // Try to get user ID from various sources
  if (typeof window !== 'undefined') {
    // Check localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.id || user.userId;
      } catch {}
    }

    // Check session storage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      try {
        const user = JSON.parse(sessionUser);
        return user.id || user.userId;
      } catch {}
    }
  }

  return undefined;
}

function createEntry(
  level: ClientLogEntry['level'],
  category: string,
  message: string,
  metadata?: any
): ClientLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    metadata: sanitizeMetadata(metadata),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    userId: getUserId(),
  };
}

function logToConsole(entry: ClientLogEntry) {
  // Only log to console in development
  if (process.env.NODE_ENV === 'development') {
    const consoleMethod = entry.level === 'error' ? 'error' : 
                        entry.level === 'warn' ? 'warn' : 
                        entry.level === 'debug' ? 'debug' : 'log';
    
    console[consoleMethod](
      `[${entry.category}] ${entry.message}`,
      entry.metadata || ''
    );
  }
}

export const clientLogger = {
  info: (message: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('info', 'client', message, metadata);
      logToConsole(entry);
    }
  },
  warn: (message: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('warn', 'client', message, metadata);
      logToConsole(entry);
    }
  },
  error: (message: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('error', 'client', message, metadata);
      logToConsole(entry);
    }
  },
  debug: (message: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('debug', 'client', message, metadata);
      logToConsole(entry);
    }
  },
  action: (action: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('info', 'action', action, metadata);
      logToConsole(entry);
    }
  },
  navigation: (from: string, to: string, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('info', 'navigation', `Navigate from ${from} to ${to}`, {
        from,
        to,
        ...metadata,
      });
      logToConsole(entry);
    }
  },
  performance: (metric: string, value: number, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const entry = createEntry('info', 'performance', `${metric}: ${value}ms`, {
        metric,
        value,
        ...metadata,
      });
      logToConsole(entry);
    }
  },
  api: (method: string, endpoint: string, status: number, duration: number, metadata?: any) => {
    if (typeof window !== 'undefined') {
      const level = status >= 400 ? 'error' : 'info';
      const entry = createEntry(level, 'api', `${method} ${endpoint} - ${status}`, {
        method,
        endpoint,
        status,
        duration,
        ...metadata,
      });
      logToConsole(entry);
    }
  },
};

// Performance monitoring utilities
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start;
      clientLogger.performance(name, duration);
    });
  } else {
    const duration = performance.now() - start;
    clientLogger.performance(name, duration);
    return result;
  }
}

// React Error Boundary logger
export function logErrorToService(error: Error, errorInfo: any) {
  clientLogger.error('React Error Boundary', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    errorInfo,
    component: errorInfo.componentStack,
  });
}