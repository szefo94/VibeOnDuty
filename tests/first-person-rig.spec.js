import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

let server, url;
test.beforeAll(async () => {
  const probe = portProbe(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    base: '/', server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
});
test('tracer: normal loaded game owns actual first-person arms and down-look body', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const rig = await import(new URL('src/builders/enemyGLTF.js', location.href).href);
    return { loaded: !!rig.playerMesh, view: !!rig.playerFirstPersonRig,
      arms: !!rig.playerFirstPersonRig?.arms, body: !!rig.playerFirstPersonRig?.body };
  });
  expect(result.loaded).toBe(true);
  expect(result.view && result.arms && result.body).toBe(true);
});
