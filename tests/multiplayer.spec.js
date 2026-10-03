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
  await page.bringToFront();
  const deadline = Date.now() + 15000;
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
    await page.keyboard.down(key);
    try {
      await page.waitForTimeout(Math.min(150, Math.max(40, distance * 40)));
    } finally {
      await page.keyboard.up(key);
    }
    // Wait for the neutral command's replicated body before choosing another pulse.
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Keyboard route did not reach (${x}, ${z}) within 15s: ${JSON.stringify(await snapshot(page))}`
  );
}

test('tracer: two browsers join and move', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture();
  expect((await fetch(`${fixture.url}/health`)).status).toBe(200);
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) {
      contexts.push(
        await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.5 })
      );
    }
    const [shooter, target] = await Promise.all(contexts.map((context) => context.newPage()));
    for (const page of [shooter, target]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 20000 });
      await page.mouse.move(400, 300);
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId).toBeTruthy();
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
    await shooter.bringToFront();
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

test('entry: assets gate online join, leave clears actors, and offline controls remain usable', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 0.5 });
  const peerContext = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.5 });
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
    await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 20000 });
    await expect(page.locator('#mp-actions')).toContainText('M4');
    await page.screenshot({ path: test.info().outputPath('online-menu.png') });

    await peer.goto(fixture.url);
    await expect(peer.locator('#mp-join-btn')).toBeEnabled({ timeout: 20000 });
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
    for (const key of ['Digit2', 'Digit3', 'Digit4', 'KeyF', 'KeyG', 'KeyT', 'KeyQ', 'KeyE', 'KeyZ', 'KeyB', 'Space', 'ControlLeft', 'ShiftLeft'])
      await page.keyboard.press(key);
    await page.mouse.click(400, 300, { button: 'middle' });
    await page.mouse.click(400, 300, { button: 'right' });
    const guarded = await snapshot(page);
    expect(guarded.presentation).toMatchObject({ weapon: 'm4', punching: false, throwingNade: false, dancing: false, aiming: false, mode: null });
    expect(guarded.lastConfirmedHit).toBeNull();
    expect(guarded.score).toEqual(initial.score);
    expect(guarded.players.find((p) => p.sessionId === me.sessionId).ammo).toBe(me.ammo);

    // Ordinary fire/reload changes the replicated inventory, not a browser-owned outcome.
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
