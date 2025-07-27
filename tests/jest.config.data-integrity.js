const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'Data Integrity Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/data-integrity/**/*.test.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/performance/',
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
  // Longer timeout for concurrent tests
  testTimeout: 30000
};