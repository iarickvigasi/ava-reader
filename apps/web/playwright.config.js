// eslint-env node

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: "./e2e",
  testMatch: /.*\.playwright\.js/,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "corepack pnpm dev",
    cwd: __dirname,
    reuseExistingServer: true,
    timeout: 30_000,
    url: "http://127.0.0.1:3000",
  },
};
