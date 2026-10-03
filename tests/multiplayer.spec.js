import { test, expect } from '@playwright/test';
import { startMpFixture } from './helpers/mpServer.js';
import { MOUSE_SENS } from '../src/config.js';

// Continuous WebGL screenshots delay keyboard release on software-rendered runners.
// Keep the action/network trace; capture explicit gameplay evidence below.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

/** @param {import('@playwright/test').Page} page */
async function snapshot(page) {
  return page.evaluate(() => window.__mpDebug());
}

async function focusControls(page) {
  await page.bringToFront();
  if (!(await page.evaluate(() => !!document.pointerLockElement))) {
    await page.locator('#pause-resume-btn').click();
    await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  }
}

/** Observe transient presentation without awarding outcomes or changing game state.
 * @param {import('@playwright/test').Page} page
 */
async function observeFeedback(page) {
  await page.evaluate(() => {
    const seen = { marker: false, numbers: [] };
    window.__observedFeedback = () => structuredClone(seen);
    new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target.id === 'xhair-dot' &&
          record.target.style.background === 'rgb(231, 76, 60)'
        )
          seen.marker = true;
        for (const node of record.addedNodes)
          if (node.nodeType === 1 && node.classList.contains('dmg-num'))
            seen.numbers.push(node.textContent);
      }
    }).observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style'],
    });
  });
}

/** Walk using ordinary keys and observed state; no teleport/test mutation API.
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 * @param {number} x
 * @param {number} z
 */
async function walkTo(page, sessionId, x, z) {
  await focusControls(page);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    const me = state.players.find((player) => player.sessionId === sessionId);
    const dx = x - me.x;
    const dz = z - me.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.35) return;
    const forward = -dx * Math.sin(me.yaw) - dz * Math.cos(me.yaw);
    const right = dx * Math.cos(me.yaw) - dz * Math.sin(me.yaw);
    const key =
      Math.abs(forward) > Math.abs(right)
        ? forward > 0
          ? 'KeyW'
          : 'KeyS'
        : right > 0
          ? 'KeyD'
          : 'KeyA';
    const precise = distance < 2;
    await page.keyboard.press(precise ? `ControlLeft+${key}` : key, {
      // Keep an intention alive across at least three 30 Hz steps. Very short
      // down/up pairs can reach the room in one batch and correctly cancel.
      delay: Math.min(150, Math.max(100, distance * 40)),
    });
    // Wait for the neutral command's replicated body before choosing another pulse.
    const releaseSeq = (await snapshot(page)).inputSeq;
    await expect.poll(async () => {
      const current = (await snapshot(page)).players.find((b) => b.sessionId === sessionId);
      return !current.moving && current.lastConsumedSeq >= releaseSeq;
    }).toBe(true);
  }
  throw new Error(
    `Keyboard route did not reach (${x}, ${z}) within 45s: ${JSON.stringify(await snapshot(page))}`
  );
}

async function aimAt(page, targetId) {
  await focusControls(page);
  await page.mouse.move(400, 300);
  await page.waitForTimeout(200);
  let mouseX = 400, mouseY = 300;
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await snapshot(page);
    const me = state.players.find((p) => p.sessionId === state.sessionId);
    const target = state.players.find((p) => p.sessionId === targetId);
    const dx = target ? target.x - me.x : 0, dz = target ? target.z - me.z : 0;
    const yaw = target ? Math.atan2(-dx, -dz) : 0;
    const pitch = target ? Math.atan2(target.y - me.y - 0.1, Math.hypot(dx, dz)) : 0;
    const yawError = Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw));
    const pitchError = pitch - me.pitch;
    if (Math.abs(yawError) < 0.02 && Math.abs(pitchError) < 0.02) return;
    mouseX -= yawError / MOUSE_SENS; mouseY -= pitchError / MOUSE_SENS;
    await page.mouse.move(mouseX, mouseY);
    await page.waitForTimeout(250);
  }
  throw new Error(`Real control aiming did not converge: ${JSON.stringify(await snapshot(page))}`);
}

// Test-only browser instrumentation binds the actual bundled offline event bus.
// The production build/room has no mutation endpoint. An attacker can execute
// local JS; these exact legacy emits must still never award server outcomes.
async function bindOfflineAttackProbe(page) {
  await page.route('**/assets/index-*.js', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const emitters = [...source.matchAll(/([$\w]+)=\(([$\w]+),([$\w]+)\)=>\(([$\w]+)\[\2\]\?\?\[\]\)\.slice\(\)\.forEach\(([$\w]+)=>\5\(\3\)\)/g)];
    expect(emitters).toHaveLength(1);
    await route.fulfill({ response, body: `${source}\nwindow.__emitOfflineForTest = ${emitters[0][1]};` });
  });
}

for (const authority of [false, true]) test(`${authority ? 'authority' : 'combat'}: real M4 cover, ammo, reload and private hit outcomes agree${authority ? ' after forged offline outcomes' : ''}`, async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture({ env: { VOD_COMBAT_SEED: '7' } });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 }));
    const [shooter, victim] = await Promise.all(contexts.map((c) => c.newPage()));
    if (authority) await bindOfflineAttackProbe(shooter);
    for (const page of [shooter, victim]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId, { timeout: 30000 }).toBeTruthy();
      await observeFeedback(page);
    }
    await expect.poll(async () => (await snapshot(shooter)).players.length).toBe(2);
    const initial = await snapshot(shooter), targetId = (await snapshot(victim)).sessionId;
    const me = (state) => state.players.find((p) => p.sessionId === initial.sessionId);
    const target = (state) => state.players.find((p) => p.sessionId === targetId);
    if (authority) {
      await shooter.evaluate((targetSessionId) => {
        for (const name of ['enemy:killed', 'friendly:killed', 'player:died', 'damage', 'hit', 'kill', 'score'])
          window.__emitOfflineForTest(name, { sessionId: targetSessionId, damage: 999, score: 999, ammo: 999 });
      }, targetId);
      await expect.poll(async () => (await snapshot(victim)).currentTick).toBeGreaterThan(initial.currentTick + 3);
      const after = await snapshot(shooter), peer = await snapshot(victim);
      expect(after.score).toEqual({ alpha: 0, bravo: 0 });
      expect(peer.score).toEqual(after.score);
      for (const state of [after, peer]) {
        expect(state.players.every((p) => p.health === 100 && p.alive && p.ammo === 30)).toBe(true);
        expect(state.lastConfirmedHit).toBeNull();
      }
      expect(await shooter.evaluate(() => window.__observedFeedback())).toEqual({ marker: false, numbers: [] });
    }
    // Existing central cover separates the two spawn positions.
    await aimAt(shooter, targetId);
    await shooter.mouse.down(); await shooter.mouse.up();
    await expect.poll(async () => me(await snapshot(shooter)).ammo).toBe(29);
    const tick = (await snapshot(shooter)).currentTick;
    await expect.poll(async () => (await snapshot(victim)).currentTick).toBeGreaterThan(tick + 35);
    expect(target(await snapshot(victim)).health).toBe(100);
    expect((await snapshot(shooter)).lastConfirmedHit).toBeNull();
    await expect(shooter.locator('#ammo-cur')).toHaveText('29');
    await shooter.keyboard.press('KeyR');
    await expect(shooter.locator('#reloadwrap')).toBeVisible();
    await shooter.mouse.click(400, 300);
    expect(me(await snapshot(shooter)).ammo).toBe(29);
    await expect.poll(async () => me(await snapshot(victim)).ammo).toBe(30);
    await expect(shooter.locator('#ammo-rsv')).toHaveText('89');
    // Reach the target through normal keys around the existing central cover.
    await aimAt(shooter, null);
    await walkTo(shooter, initial.sessionId, 62, 46);
    await walkTo(shooter, initial.sessionId, 62, 22);
    await walkTo(shooter, initial.sessionId, 34, 22);
    await walkTo(shooter, initial.sessionId, 34, 46);
    await aimAt(shooter, targetId);
    await shooter.mouse.down(); await shooter.mouse.up();
    await expect.poll(async () => target(await snapshot(victim)).health).toBe(72);
    await expect.poll(async () => (await snapshot(shooter)).lastConfirmedHit?.damage).toBe(28);
    expect(me(await snapshot(shooter)).ammo).toBe(29);
    expect(me(await snapshot(victim)).ammo).toBe(29);
    expect((await snapshot(shooter)).score).toEqual((await snapshot(victim)).score);
    expect(await shooter.evaluate(() => window.__observedFeedback().numbers)).toEqual(['-28']);
    expect(await victim.evaluate(() => window.__observedFeedback())).toEqual({ marker: false, numbers: [] });
    await shooter.screenshot({ path: test.info().outputPath(`${authority ? 'authority' : 'combat'}-confirmed.png`) });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await fixture.stop();
  }
});

test('tracer: two browsers join and move', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  expect((await fetch(`${fixture.url}/health`)).status).toBe(200);
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) {
      contexts.push(
        await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 })
      );
    }
    const [shooter, target] = await Promise.all(contexts.map((context) => context.newPage()));
    for (const page of [shooter, target]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.mouse.move(400, 300);
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId, { timeout: 30000 }).toBeTruthy();
    }

    await expect.poll(async () => (await snapshot(shooter)).players.length).toBe(2);
    await expect.poll(async () => (await snapshot(target)).players.length).toBe(2);
    const initial = await snapshot(shooter);
    const second = await snapshot(target);
    expect(initial.sessionId).not.toBe(second.sessionId);
    expect(initial.roomId).toBe(second.roomId);
    expect(initial.mapId).toBe(second.mapId);
    expect(initial.mapId).toBe('bunker');
    expect(initial.usingGLTF).toBe(true);
    expect(second.usingGLTF).toBe(true);
    expect(await shooter.evaluate(() => Object.isFrozen(window.__mpDebug()))).toBe(true);
    await expect.poll(async () => (await snapshot(shooter)).remoteActorCount).toBe(1);
    await expect.poll(async () => (await snapshot(target)).remoteActorCount).toBe(1);

    const before = second.players.find((player) => player.sessionId === initial.sessionId);
    await focusControls(shooter);
    await shooter.keyboard.down('KeyW');
    try {
      await expect
        .poll(async () => {
          const state = await snapshot(target);
          const moved = state.players.find((player) => player.sessionId === initial.sessionId);
          return Math.hypot(moved.x - before.x, moved.z - before.z);
        })
        .toBeGreaterThan(0.25);
    } finally {
      await shooter.keyboard.up('KeyW');
    }

    // Greek Columns has central walls between the team spawns at z=46.
    // Walk around them through the open row at z=22 before aiming at the target.
    const current = await snapshot(shooter);
    const startBody = current.players.find((player) => player.sessionId === initial.sessionId);
    const targetBody = current.players.find((player) => player.sessionId === second.sessionId);
    const startLane = startBody.x < 48 ? 34 : 62;
    const targetLane = targetBody.x < 48 ? 34 : 62;
    await walkTo(shooter, initial.sessionId, startLane, startBody.z);
    await walkTo(shooter, initial.sessionId, startLane, 22);
    await walkTo(shooter, initial.sessionId, targetLane, 22);
    await walkTo(shooter, initial.sessionId, targetLane, targetBody.z);
    await shooter.mouse.move(400, 300);
    await shooter.waitForTimeout(150);
    const aiming = await snapshot(shooter);
    const body = aiming.players.find((player) => player.sessionId === initial.sessionId);
    const victim = aiming.players.find((player) => player.sessionId === second.sessionId);
    const dx = victim.x - body.x;
    const dz = victim.z - body.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(victim.y - body.y, Math.hypot(dx, dz));
    const yawDelta = Math.atan2(Math.sin(desiredYaw - body.yaw), Math.cos(desiredYaw - body.yaw));
    // Aim and fire through ordinary mouse input, never mutate trusted state.
    let aimX = 400 - yawDelta / MOUSE_SENS;
    let aimY = 300 - (desiredPitch - body.pitch) / MOUSE_SENS;
    await shooter.mouse.move(aimX, aimY);
    // Software WebGL can delay/coalesce a pointer-lock event. Correct through
    // ordinary mouse input until replicated aim agrees; keep the same strict bound.
    for (let attempt = 0; attempt < 4; attempt++) {
      await shooter.waitForTimeout(250);
      const state = await snapshot(shooter);
      const aimed = state.players.find((p) => p.sessionId === initial.sessionId);
      const error = Math.atan2(Math.sin(desiredYaw - aimed.yaw), Math.cos(desiredYaw - aimed.yaw));
      if (Math.abs(error) < 0.05) break;
      aimX -= error / MOUSE_SENS;
      aimY -= (desiredPitch - aimed.pitch) / MOUSE_SENS;
      await shooter.mouse.move(aimX, aimY);
    }
    await expect
      .poll(async () => {
        const state = await snapshot(shooter);
        const me = state.players.find((player) => player.sessionId === initial.sessionId);
        return Math.abs(Math.atan2(Math.sin(me.yaw - desiredYaw), Math.cos(me.yaw - desiredYaw)));
      })
      .toBeLessThan(0.05);
    await shooter.screenshot({ path: test.info().outputPath('current-rig.png') });
    const ammo = body.ammo;
    await observeFeedback(shooter);
    await observeFeedback(target);
    await shooter.mouse.down({ button: 'left' });
    await shooter.mouse.up({ button: 'left' });
    await expect.poll(() => shooter.evaluate(() => window.__observedFeedback().marker)).toBe(true);
    expect(await shooter.evaluate(() => window.__observedFeedback().numbers)).toHaveLength(1);
    expect(await target.evaluate(() => window.__observedFeedback().numbers)).toHaveLength(0);
    await expect
      .poll(async () => {
        const state = await snapshot(target);
        return state.players.find((player) => player.sessionId === second.sessionId).health;
      })
      .toBeLessThan(victim.health);
    const confirmed = await snapshot(shooter);
    expect(confirmed.players.find((player) => player.sessionId === initial.sessionId).ammo).toBe(
      ammo - 1
    );
    expect(confirmed.lastConfirmedHit).toMatchObject({ targetSessionId: second.sessionId });
    expect((await snapshot(target)).lastConfirmedHit).toBeNull();
    expect(confirmed.lastConfirmedHit.damage).toBeGreaterThan(0);
    expect(confirmed.lastConfirmedHit.impact).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    });
  } finally {
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      await fixture.stop();
    }
  }
});

test('movement: real sprint jump crouch ADS, ramps, walls and camera restore agree in two browsers', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 }));
    const [page, peer] = await Promise.all(contexts.map((c) => c.newPage()));
    for (const p of [page, peer]) {
      await p.goto(fixture.url);
      await expect(p.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await p.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(p)).sessionId, { timeout: 30000 }).toBeTruthy();
      await p.evaluate(() => {
        const seen = { moving: false, airborne: false };
        window.__movementSeen = () => ({ ...seen });
        setInterval(() => {
          const state = window.__mpDebug();
          const b = state.players.find((p) => p.sessionId === state.players[0]?.sessionId);
          if (b?.moving) seen.moving = true;
          if (b?.onGround === false) seen.airborne = true;
        }, 10);
      });
    }
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    const initial = await snapshot(page);
    const id = initial.sessionId;
    const body = async (p = page) => (await snapshot(p)).players.find((b) => b.sessionId === id);
    const same = async (field, value) => {
      if ((field === 'moving' && value === true) || (field === 'onGround' && value === false)) {
        const observed = field === 'moving' ? 'moving' : 'airborne';
        for (const p of [page, peer]) await expect.poll(() => p.evaluate((key) => window.__movementSeen()[key], observed)).toBe(true);
        return;
      }
      try {
        await expect.poll(async () => (await body())[field]).toBe(value);
        await expect.poll(async () => (await body(peer))[field]).toBe(value);
      } catch (error) {
        throw new Error(`${field}=${value}: ${JSON.stringify(await snapshot(page))}`, { cause: error });
      }
    };
    await focusControls(page);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    try {
      await same('sprinting', true);
      await same('moving', true);
      await expect.poll(async () => (await body()).x).toBeGreaterThan(67);
    } finally { await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft'); }
    await same('moving', false);
    await page.keyboard.down('ControlLeft');
    try {
      await same('crouching', true);
      await expect.poll(async () => (await body()).y).toBeCloseTo(0.85, 5);
      await page.keyboard.down('KeyA');
      try { await same('moving', true); } finally { await page.keyboard.up('KeyA'); }
    } finally { await page.keyboard.up('ControlLeft'); }
    await same('crouching', false);
    await page.keyboard.down('Space');
    try { await same('onGround', false); } finally { await page.keyboard.up('Space'); }
    await same('onGround', true);
    await expect.poll(async () => (await body()).y).toBeCloseTo(1.65, 5);
    await page.mouse.down({ button: 'right' });
    try {
      await same('aiming', true);
      await expect.poll(async () => (await snapshot(page)).aimT).toBeGreaterThan(0.9);
      await expect.poll(async () => (await snapshot(page)).cameraFov).toBeLessThan(52);
    } finally { await page.mouse.up({ button: 'right' }); }
    await same('aiming', false);
    // East ramp (tile6) rises from x76 to80 into the existing 1.4m walkway.
    await walkTo(page, id, 74, 46);
    await walkTo(page, id, 74, 30);
    await walkTo(page, id, 78, 30);
    await expect.poll(async () => {
      const b = await body(); return Math.abs(b.y - (1.65 + (b.x - 76) / 4 * 1.4));
    }).toBeLessThan(0.001);
    await walkTo(page, id, 82, 30);
    await expect.poll(async () => (await body()).y).toBeCloseTo(3.05, 5);
    await page.keyboard.down('KeyC');
    try { await same('crouching', true); await expect.poll(async () => (await body()).y).toBeCloseTo(2.25, 5); }
    finally { await page.keyboard.up('KeyC'); }
    await same('crouching', false);
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(700);
    const restored = await snapshot(page);
    const current = restored.players.find((b) => b.sessionId === id);
    expect(restored.simulationEye).toEqual({ x: current.x, y: current.y, z: current.z });
    expect(restored.usingGLTF).toBe(true);
    await page.screenshot({ path: test.info().outputPath('movement-rig.png') });
    await page.keyboard.down('KeyD');
    try {
      await expect.poll(async () => (await body()).x).toBeGreaterThan(91.3);
      await page.waitForTimeout(300);
      expect((await body()).x).toBeLessThanOrEqual(92 - 0.35);
    } finally { await page.keyboard.up('KeyD'); }
    await same('moving', false);
    const stopped = await body();
    await expect.poll(async () => {
      const remote = await body(peer); return Math.abs(remote.x - stopped.x) + Math.abs(remote.y - stopped.y) + Math.abs(remote.z - stopped.z);
    }).toBeLessThan(0.00001);
    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#pause-resume-btn')).toBeVisible();
    await page.keyboard.down('KeyA');
    const tick = (await snapshot(page)).currentTick;
    try {
      await expect.poll(async () => (await snapshot(page)).currentTick).toBeGreaterThan(tick + 8);
      expect((await body()).x).toBe(stopped.x);
      expect((await body()).aiming).toBe(false);
    } finally { await page.keyboard.up('KeyA'); }
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await fixture.stop();
  }
});

test('entry: assets gate online join, leave clears actors, and offline controls remain usable', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 0.25 });
  const peerContext = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 });
  let releaseAssets;
  const assetGate = new Promise((resolve) => { releaseAssets = resolve; });
  try {
    const page = await context.newPage();
    const peer = await peerContext.newPage();
    let assetHeld = false;
    await page.route('**/models/enemy.glb', async (route) => {
      assetHeld = true;
      await assetGate;
      await route.continue();
    });
    await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => assetHeld).toBe(true);
    await expect(page.locator('#mp-join-btn')).toHaveCount(1);
    await expect(page.locator('#mp-leave-btn')).toHaveCount(1);
    await expect(page.locator('#mp-join-btn')).toBeDisabled();
    await expect(page.locator('#startbtn')).toBeDisabled();
    releaseAssets();
    await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await expect(page.locator('#mp-actions')).toContainText('M4');
    await page.screenshot({ path: test.info().outputPath('online-menu.png') });

    await peer.goto(fixture.url);
    await expect(peer.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await peer.locator('#mp-join-btn').click();
    await page.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    await expect.poll(async () => (await snapshot(page)).remoteActorCount).toBe(1);
    const initial = await snapshot(page);
    expect(initial.usingGLTF).toBe(true);
    const me = initial.players.find((p) => p.sessionId === initial.sessionId);
    await expect(page.locator('#tdm-label')).toHaveText(`ONLINE · ${me.team.toUpperCase()}`);
    await expect(page.locator('#hp-num')).toHaveText(String(me.health));
    await expect(page.locator('#ammo-cur')).toHaveText(String(me.ammo));
    await expect(page.locator('#tdm-us')).toHaveText(String(initial.score[me.team]));
    await focusControls(page);
    for (const key of ['Digit2', 'Digit3', 'Digit4', 'KeyF', 'KeyG', 'KeyT', 'KeyQ', 'KeyE', 'KeyZ', 'KeyB'])
      await page.keyboard.press(key);
    await page.mouse.click(400, 300, { button: 'middle' });
    await page.mouse.click(400, 300, { button: 'right' });
    const guarded = await snapshot(page);
    expect(guarded.presentation).toMatchObject({ weapon: 'm4', punching: false, throwingNade: false, dancing: false, aiming: false, mode: null });
    expect(guarded.lastConfirmedHit).toBeNull();
    expect(guarded.score).toEqual(initial.score);
    expect(guarded.players.find((p) => p.sessionId === me.sessionId).ammo).toBe(me.ammo);

    // Ordinary fire/reload changes the replicated inventory, not a browser-owned outcome.
    await focusControls(page);
    await page.mouse.click(400, 300);
    await expect.poll(async () => (await snapshot(page)).players.find((p) => p.sessionId === me.sessionId).ammo).toBe(29);
    await page.keyboard.press('KeyR');
    await expect(page.locator('#reloadwrap')).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).players.find((p) => p.sessionId === me.sessionId).ammo).toBe(30);
    await expect(page.locator('#ammo-rsv')).toHaveText('89');

    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#mp-leave-btn')).toBeVisible();
    await page.locator('#mp-leave-btn').click();
    await expect(page.locator('#overlay')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ sessionId: null, remoteActorCount: 0, phase: 'offline' });
    await expect.poll(async () => (await snapshot(peer)).players.length).toBe(1);
    await expect.poll(async () => (await snapshot(peer)).remoteActorCount).toBe(0);
    await expect(page.locator('#mp-join-btn')).toHaveCount(1);
    await expect(page.locator('#mp-join-btn')).toBeEnabled();

    // Rejoin exercises removal/reinstallation of the same named authority handlers.
    await page.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    const rejoined = await snapshot(page);
    expect(rejoined.sessionId).not.toBe(initial.sessionId);
    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#pause-mainmenu-btn')).toBeVisible();
    await page.locator('#pause-mainmenu-btn').click();
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#range-startbtn')).toBeEnabled();
    await page.locator('#range-startbtn').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.keyboard.press('Digit4');
    await expect(page.locator('#weapon-name')).toHaveText('M9');
    expect((await snapshot(page)).presentation).toMatchObject({ weapon: 'pistol', mode: 'range', gameRunning: true });
    expect((await snapshot(page)).sessionId).toBeNull();
    await page.screenshot({ path: test.info().outputPath('offline-after-online.png') });
  } finally {
    releaseAssets();
    await context.close();
    await peerContext.close();
    await fixture.stop();
  }
});
