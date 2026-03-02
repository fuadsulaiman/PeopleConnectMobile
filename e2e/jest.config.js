/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.spec.ts', '<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'detox/runners/jest/reporter',
    ['jest-html-reporters', {
      publicPath: './e2e-report',
      filename: 'e2e-test-report.html',
      expand: true,
    }],
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
  },
};
