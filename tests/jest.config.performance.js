const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'Performance Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/performance/**/*.test.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/data-integrity/',
    '/unit/',
    '/integration/',
    '/security/'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: false,
          dynamicImport: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    }],
  },
  // Extended timeout for performance tests
  testTimeout: 120000,
  // Run performance tests serially
  maxWorkers: 1
};