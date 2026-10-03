import { defineConfig } from '@playwright/test';
import { verifyFixtureIsolation } from './tests/helpers/mpServer.js';

// --list does not run fixtures/hooks. Prove concurrent build ownership here,
// without starting the server that the following plan implements.
if (process.argv.includes('--list')) await verifyFixtureIsolation();

export default defineConfig({
  testDir: './tests',
  testMatch: ['multiplayer.spec.js', 'hosting.spec.js'],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    headless: true,
    viewport: { width: 800, height: 600 },
    launchOptions: { args: ['--use-gl=swiftshader'] },
    trace: 'retain-on-failure',
  },
  // Each test starts its own production server through startMpFixture().
  // No Vite webServer and no reused server/build output.
});
