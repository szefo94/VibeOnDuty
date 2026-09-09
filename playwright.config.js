import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Hosted runners render WebGL on the CPU. Concurrent game loops contend for
  // that CPU and can time out even while their animation assertions are passing.
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 60000 : 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 800, height: 600 },
    launchOptions: {
      args: ['--use-gl=swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
