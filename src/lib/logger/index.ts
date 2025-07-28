// Edge-runtime and client-compatible logger
// This file conditionally exports the appropriate logger based on the runtime environment

// Re-export edge logger components for edge runtime and client
export {
  systemLogger,
  authLogger,
  apiLogger,
  dbLogger,
  businessLogger,
  securityLogger,
  perfLogger,
  cacheLogger,
  default
} from './edge';

// Type exports
export type {
  Logger,
  LogLevel,
  LogMetadata,
  LogEntry
} from './edge';