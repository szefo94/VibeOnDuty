import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';

let server, url;
test.beforeAll(async () => {
  const probe = portProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: 'C:/Programowanie/VibeOnDuty', base: '/',
    server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 20000 });
  await page.locator('#range-startbtn').click();
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const p = await import(src + 'entities/player.js');
    const g = await import(src + 'entities/grenades.js');
    const input = await import(src + 'input.js');
    const rig = await import(src + 'builders/enemyGLTF.js');
    if (!rig.playerMesh) throw new Error('Normal shipped character failed to load');
    // Freeze only automatic gameplay; invoke the actual simulation in measured steps.
    input.setGameRunning(false);
    input.setLocked(true);
    p.player.ammo = 3; p.player.reserve = 50; p.player.energy = 100;
    window.actionProbe = { p, g, input, src };
  });
});

for (const remaining of [1, 0, -1]) {
  test(`throw: cancels reload before award with ${remaining}ms remaining`, async ({ page }) => {
    const result = await page.evaluate(remaining => {
      const { p, g } = window.actionProbe;
      p.startReload(); p.player.reloadTimer = remaining;
      p.player.aiming = true; p.player.aimT = 1;
      g.tryThrowGrenade();
      const immediate = { reload: p.player.reloading, aiming: p.player.aiming };
      p.player.aiming = true; // held gamepad ADS reasserts every frame
      p.updatePlayer(0.001);
      return { immediate, ammo: p.player.ammo, reserve: p.player.reserve,
        aiming: p.player.aiming, reloadUi: document.getElementById('reloadwrap').style.display };
    }, remaining);
    expect(result).toEqual({ immediate: { reload: false, aiming: false }, ammo: 3,
      reserve: 50, aiming: false, reloadUi: 'none' });
  });
}

test('throw: marker is simulation owned, once only, with held ADS suppressed', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { p, g } = window.actionProbe;
    g.tryThrowGrenade();
    g.tryThrowGrenade();
    p.updatePlayer(0.404);
    const before = g.grenades.length;
    p.player.aiming = true;
    p.updatePlayer(0.001);
    const at = g.grenades.length;
    p.updatePlayer(0.495);
    p.updatePlayer(0.01);
    return { before, at, after: g.grenades.length, throwing: p.player.throwingNade,
      aiming: p.player.aiming, energy: p.player.energy };
  });
  expect(result).toEqual({ before: 0, at: 1, after: 1, throwing: false,
    aiming: false, energy: 0 });
});
