const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

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
  // USE_TEST_AUTH removed for security
}

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Logging setup for production
if (!dev) {
  const winston = require('winston');
  require('winston-daily-rotate-file');
  
  const logDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
  
  // Create winston logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d'
      }),
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d'
      })
    ]
  });

  // Add console transport in development
  if (dev) {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  global.logger = logger;
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      // Log requests in production
      if (!dev && global.logger) {
        global.logger.info('Request', {
          method: req.method,
          url: req.url,
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      }

      // Handle all requests through Next.js
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      
      if (!dev && global.logger) {
        global.logger.error('Request handler error', {
          error: err.message,
          stack: err.stack,
          url: req.url
        });
      }
      
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`
      );
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});