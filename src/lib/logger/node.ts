// src/lib/logger/node.ts
import winston from 'winston';
import 'winston-daily-rotate-file';
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

// Base logger configuration
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
      level: process.env.LOG_LEVEL || 'info',
    }),
  ];

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
        level: process.env.LOG_LEVEL || 'info',
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