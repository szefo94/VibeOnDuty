import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

let server, url;
test.beforeAll(async () => {
  const probe = portProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    base: '/', server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
});

test('local: held movement blocked by terrain plants the real loaded feet', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const input = await import(src + 'input.js');
    const { camera } = await import(src + 'scene.js');
    const { playerActions, playerMesh } = await import(src + 'builders/enemyGLTF.js');
    const { MAP } = await import(src + 'map.js');
    input.setLocked(false);
    // Place within a solid cell: actual canMoveTo rejects the held W intention.
    const r = MAP.findIndex(row => row.some(v => v === 1));
    const c = MAP[r].findIndex(v => v === 1);
    camera.position.set(c * 4 + 2, 1.65, r * 4 + 2);
    player.yaw = 0; player.onGround = true;
    input.keys.KeyW = true;
    input.setGameRunning(true);
    const start = camera.position.clone();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    input.keys.KeyW = false; input.setGameRunning(false);
    const travelling = new Set(['walk', 'run', 'strafe_l', 'strafe_r', 'walk_back', 'run_back']);
    return { skinned: !!playerMesh, displacement: camera.position.distanceTo(start),
      travellingWeight: [...travelling].reduce((sum, key) => sum + (playerActions[key]?.isScheduled() ? playerActions[key].getEffectiveWeight() : 0), 0) };
  });
  expect(result.skinned).toBe(true);
  expect(result.displacement).toBeLessThan(0.01);
  expect(result.travellingWeight).toBeLessThan(0.01);
});
