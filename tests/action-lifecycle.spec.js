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
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), base: '/',
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

for (const remaining of [1, 0, -1]) {
  test(`melee: keyboard interrupts reload with ${remaining}ms remaining and hits on simulation time`, async ({ page }) => {
    const result = await page.evaluate(async remaining => {
      const { p, input, src } = window.actionProbe;
      const { enemies } = await import(src + 'entities/enemies.js');
      const { camera } = await import(src + 'scene.js');
      let hits = 0;
      // Use an actual pool slot and actual punch collision/damage path, without AI ticks.
      const target = enemies[0];
      target.dead = false; target.sndTeam = 'enemy';
      target.x = camera.position.x; target.z = camera.position.z - 1;
      target.takeDamage = () => { ++hits; };
      p.player.yaw = 0;
      p.startReload(); p.player.reloadTimer = remaining;
      p.player.aiming = true;
      input.setGameRunning(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }));
      input.setGameRunning(false);
      const immediate = { reload: p.player.reloading, aiming: p.player.aiming };
      p.updatePlayer(0.349); const before = hits;
      p.updatePlayer(0.001); const at = hits;
      p.updatePlayer(0.35); p.updatePlayer(0.01);
      return { immediate, before, at, after: hits, ammo: p.player.ammo,
        reserve: p.player.reserve, punching: p.player.punching };
    }, remaining);
    expect(result).toEqual({ immediate: { reload: false, aiming: false }, before: 0,
      at: 1, after: 1, ammo: 3, reserve: 50, punching: false });
  });
}

test('melee: real death before wall-clock marker cannot damage or persist into respawn', async ({ page }) => {
  await page.evaluate(async () => {
    const { p, input, src } = window.actionProbe;
    const { enemies, triggerDeath, spawnEnemyIntoSlot } = await import(src + 'entities/enemies.js');
    const { camera } = await import(src + 'scene.js');
    const target = enemies[0];
    spawnEnemyIntoSlot(target);
    target.dead = false; target.sndTeam = 'enemy'; target.x = camera.position.x;
    target.z = camera.position.z - 1; window.retiredHits = 0;
    target.takeDamage = () => { ++window.retiredHits; };
    p.player.yaw = 0; input.setGameRunning(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    triggerDeath();
  });
  await page.waitForTimeout(400); // Negative: the retired 350ms timeout used to fire while dead.
  const result = await page.evaluate(() => {
    const { p, input } = window.actionProbe;
    const deadHits = window.retiredHits;
    input.setGameRunning(false);
    p.player.dead = false; p.updatePlayer(1);
    return { deadHits, afterRevive: window.retiredHits, punching: p.player.punching };
  });
  expect(result).toEqual({ deadHits: 0, afterRevive: 0, punching: false });
});

test('melee: repeated input rejects throw, fire and reload without queuing', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { p, g, input, src } = window.actionProbe;
    const { tryShoot } = await import(src + 'combat/shoot.js');
    input.setGameRunning(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', repeat: true }));
    input.setGameRunning(false);
    g.tryThrowGrenade(); p.startReload(); tryShoot();
    p.player.aiming = true; p.updatePlayer(0.1);
    const during = { aiming: p.player.aiming, reload: p.player.reloading, ammo: p.player.ammo,
      energy: p.player.energy, throwing: p.player.throwingNade };
    p.updatePlayer(0.6); p.updatePlayer(0.9);
    return { during, punching: p.player.punching, grenades: g.grenades.length,
      phase: p.playerActions.presentation.kind };
  });
  expect(result).toEqual({ during: { aiming: false, reload: false, ammo: 3, energy: 100,
    throwing: false }, punching: false, grenades: 0, phase: 'ready' });
});

for (const route of ['weapon', 'menu', 'mode', 'round', 'respawn', 'buy-reset', 'buy-same',
  'editor-open', 'editor-playtest', 'editor-exit', 'online-entry']) {
  test(`retirement: ${route} invalidates pending action before replacement`, async ({ page }) => {
    const result = await page.evaluate(async route => {
      const { p, input, src } = window.actionProbe;
      const { getMode } = await import(src + 'modes/modeManager.js');
      const { emit } = await import(src + 'events.js');
      const buy = await import(src + 'modes/buyMenu.js');
      const editor = await import(src + 'editor/mapEditor.js');
      const tdm = await import(src + 'modes/tdm.js');
      // Configure each real replacement route before starting the action under test.
      if (route.startsWith('buy')) {
        buy.startBuyPhase();
        (await import(src + 'modes/economy.js')).resetEconomy();
      }
      if (route === 'respawn') tdm.startTdm(10, 10);
      if (route.startsWith('editor')) editor.openEditor();
      if (route === 'editor-exit') document.getElementById('ed-preview').click();
      input.setGameRunning(false);
      let markers = 0;
      p.startReload(); p.player.reloadTimer = 0;
      p.beginPlayerAction('melee', 0.7, [{ at: 0.35, run: () => ++markers }]);
      const generation = p.playerActions.generation;
      if (route === 'weapon') {
        input.setGameRunning(true);
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
      } else if (route === 'menu') {
        document.getElementById('pause-mainmenu-btn').click();
        await Promise.resolve(); await Promise.resolve();
      } else if (route === 'mode') document.getElementById('range-startbtn').click();
      else if (route === 'round') emit('snd:configure', {});
      else if (route === 'respawn') {
        emit('player:died');
        // Also prove the respawn itself cancels work before its direct field reset.
        p.beginPlayerAction('melee', 0.7, [{ at: 0.35, run: () => ++markers }]);
        getMode().tick(3.01);
      } else if (route === 'buy-reset') buy.startBuyPhase();
      else if (route === 'buy-same') buy.buyWeapon('pistol');
      else if (route === 'editor-open') editor.openEditor();
      else if (route === 'editor-playtest') document.getElementById('ed-playtest').click();
      else if (route === 'editor-exit') editor.exitEditorPreview();
      else if (route === 'online-entry') document.getElementById('mp-join-btn').click();
      input.setGameRunning(false);
      const immediate = p.playerActions.presentation;
      p.tickPlayerActions(2);
      return { retired: immediate.generation > generation, kind: immediate.kind, markers,
        reload: p.player.reloading, punching: !!p.player.punching, throwing: p.player.throwingNade };
    }, route);
    expect(result).toEqual({ retired: true, kind: 'ready', markers: 0,
      reload: false, punching: false, throwing: false });
  });
}
