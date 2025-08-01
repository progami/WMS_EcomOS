// Jest setup file
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
// USE_TEST_AUTH removed for security - use test-login endpoint instead
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3001';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-for-testing-only';
process.env.TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';