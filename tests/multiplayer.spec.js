import { test, expect } from '@playwright/test';
import { startMpFixture } from './helpers/mpServer.js';
import { MOUSE_SENS } from '../src/config.js';

/** @param {import('@playwright/test').Page} page */
async function snapshot(page) {
  return page.evaluate(() => window.__mpDebug());
}

/** Walk using ordinary keys and observed state; no teleport/test mutation API.
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 * @param {number} x
 * @param {number} z
 */
async function walkTo(page, sessionId, x, z) {
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
    const key = Math.abs(forward) > Math.abs(right)
      ? (forward > 0 ? 'KeyW' : 'KeyS') : (right > 0 ? 'KeyD' : 'KeyA');
    await page.keyboard.down(key);
    try { await page.waitForTimeout(Math.min(150, Math.max(40, distance * 40))); }
    finally { await page.keyboard.up(key); }
  }
  throw new Error(`Keyboard route did not reach (${x}, ${z}) within 15s`);
}

test('tracer: two browsers join and move', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture();
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) {
      contexts.push(await browser.newContext({ viewport: { width: 800, height: 600 } }));
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
    expect(await shooter.evaluate(() => Object.isFrozen(window.__mpDebug()))).toBe(true);
    await expect.poll(async () => (await snapshot(shooter)).remoteActorCount).toBe(1);
    await expect.poll(async () => (await snapshot(target)).remoteActorCount).toBe(1);

    const before = second.players.find((player) => player.sessionId === initial.sessionId);
    await shooter.keyboard.down('KeyW');
    try {
      await expect.poll(async () => {
        const state = await snapshot(target);
        const moved = state.players.find((player) => player.sessionId === initial.sessionId);
        return Math.hypot(moved.x - before.x, moved.z - before.z);
      }).toBeGreaterThan(0.25);
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
    const aiming = await snapshot(shooter);
    const body = aiming.players.find((player) => player.sessionId === initial.sessionId);
    const victim = aiming.players.find((player) => player.sessionId === second.sessionId);
    const dx = victim.x - body.x;
    const dz = victim.z - body.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(victim.y - body.y, Math.hypot(dx, dz));
    const yawDelta = Math.atan2(Math.sin(desiredYaw - body.yaw), Math.cos(desiredYaw - body.yaw));
    // Aim and fire through ordinary mouse input, never mutate trusted state.
    await shooter.mouse.move(400 - yawDelta / MOUSE_SENS, 300 - (desiredPitch - body.pitch) / MOUSE_SENS);
    await expect.poll(async () => {
      const state = await snapshot(shooter);
      const me = state.players.find((player) => player.sessionId === initial.sessionId);
      return Math.abs(Math.atan2(Math.sin(me.yaw - desiredYaw), Math.cos(me.yaw - desiredYaw)));
    }).toBeLessThan(0.05);
    const ammo = body.ammo;
    const marker = expect(shooter.locator('#xhair-dot'))
      .toHaveCSS('background-color', 'rgb(231, 76, 60)');
    await shooter.mouse.down({ button: 'left' });
    await shooter.mouse.up({ button: 'left' });
    await marker;
    await expect(shooter.locator('.dmg-num')).toHaveCount(1);
    await expect(target.locator('.dmg-num')).toHaveCount(0);
    await expect.poll(async () => {
      const state = await snapshot(target);
      return state.players.find((player) => player.sessionId === second.sessionId).health;
    }).toBeLessThan(victim.health);
    const confirmed = await snapshot(shooter);
    expect(confirmed.players.find((player) => player.sessionId === initial.sessionId).ammo).toBe(ammo - 1);
    expect(confirmed.lastConfirmedHit).toMatchObject({ targetSessionId: second.sessionId });
    expect((await snapshot(target)).lastConfirmedHit).toBeNull();
    expect(confirmed.lastConfirmedHit.damage).toBeGreaterThan(0);
    expect(confirmed.lastConfirmedHit.impact).toEqual({
      x: expect.any(Number), y: expect.any(Number), z: expect.any(Number),
    });
  } finally {
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      await fixture.stop();
    }
  }
});
