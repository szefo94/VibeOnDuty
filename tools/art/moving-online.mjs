import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { startMpFixture } from '../../tests/helpers/mpServer.js';
import { ROOT, hash } from './pipeline.mjs';
import { MOUSE_SENS } from '../../src/config.js';

const snapshot = page => page.evaluate(() => window.__mpDebug());
async function until(read, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await read(); if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Actual online observation deadline expired');
}
async function focus(page) {
  await page.bringToFront();
  if (!await page.evaluate(() => !!document.pointerLockElement)) {
    const control = await page.locator('#mp-resume').isVisible() ? '#mp-resume' : '#pause-resume-btn';
    await page.locator(control).click();
    await until(() => page.evaluate(() => !!document.pointerLockElement), Boolean);
  }
}
async function pulse(page, key, duration) {
  await page.evaluate(({ key, duration }) => {
    window.__movingInputReleased = false;
    const begin = event => {
      if (event.code !== key) return;
      document.removeEventListener('keydown', begin, true);
      setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true }));
        window.__movingInputReleased = true;
      }, duration);
    };
    document.addEventListener('keydown', begin, true);
  }, { key, duration });
  await page.keyboard.down(key);
  await until(() => page.evaluate(() => window.__movingInputReleased), Boolean);
  await page.keyboard.up(key);
  const seq = (await snapshot(page)).inputSeq;
  await until(() => snapshot(page), s => {
    const p = s.players.find(p => p.sessionId === s.sessionId);
    return !p.moving && p.lastConsumedSeq >= seq;
  });
}
async function walk(page, x, z) {
  await focus(page);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const s = await snapshot(page), p = s.players.find(p => p.sessionId === s.sessionId);
    const dx = x - p.x, dz = z - p.z, distance = Math.hypot(dx, dz);
    if (distance < .35) return;
    const forward = -dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw);
    const right = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
    const key = Math.abs(forward) > Math.abs(right) ? forward > 0 ? 'KeyW' : 'KeyS' : right > 0 ? 'KeyD' : 'KeyA';
    if (distance < 2) await page.keyboard.down('ControlLeft');
    try { await pulse(page, key, Math.min(150, Math.max(100, distance * 40))); }
    finally { await page.keyboard.up('ControlLeft'); }
  }
  throw Error(`Ordinary input route did not reach (${x},${z})`);
}
async function aim(page, targetId) {
  await focus(page);
  const s = await snapshot(page), p = s.players.find(p => p.sessionId === s.sessionId);
  const other = s.players.find(p => p.sessionId === targetId);
  const yaw = other ? Math.atan2(-(other.x - p.x), -(other.z - p.z)) : 0;
  let delta = yaw - p.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  await page.evaluate(({ x, y }) => document.dispatchEvent(new MouseEvent('mousemove', {
    movementX: x, movementY: y, bubbles: true })), { x: -delta / MOUSE_SENS, y: p.pitch / MOUSE_SENS });
  const seq = (await snapshot(page)).inputSeq;
  await until(() => snapshot(page), s => s.players.find(p => p.sessionId === s.sessionId).lastConsumedSeq > seq);
}
export async function collectMovingOnline(browser, directory) {
  const samples = [];
  for (const tier of ['low', 'medium', 'high']) {
    samples.push(await collectTier(browser, directory, tier));
    console.log(`Moving production M4 collection ${tier}: ${samples.at(-1).complete ? 'complete' : samples.at(-1).error}`);
  }
  return { complete: samples.every(sample => sample.complete), samples,
    observations: samples.flatMap(sample => sample.observations),
    media: samples.flatMap(sample => sample.media),
    authority: 'Three tiers, each with two real production M4 memberships; ordinary intentions and an unfrozen server clock.' };
}
async function collectTier(browser, directory, tier) {
  const fixture = await startMpFixture({ testSettings: { killLimit: 50, matchSeconds: 180,
    respawnSeconds: 3, friendlyFire: .25 }, env: { VOD_COMBAT_SEED: '7' } });
  const contexts = [], pages = [], observations = [], media = [];
  const report = { tier, complete: false, observations, media, authority: 'Two real production M4 memberships; ordinary keyboard/mouse intentions; server clock never frozen.' };
  try {
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ viewport: { width: 800, height: 600 },
        deviceScaleFactor: 1, recordVideo: { dir: directory, size: { width: 800, height: 600 } } });
      contexts.push(context); const page = await context.newPage(); pages.push(page);
      await context.addInitScript(tier => localStorage.setItem('vod_graphics_quality_v1', tier), tier);
      await page.goto(fixture.url);
      await page.waitForFunction(() => !document.getElementById('mp-join-btn').disabled, null, { timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await until(() => snapshot(page), s => !!s.sessionId);
    }
    const [a, b] = pages;
    await until(() => snapshot(a), s => s.players.length === 2);
    const first = await snapshot(a), targetId = (await snapshot(b)).sessionId;
    observations.push({ label: 'joined-blue-red', a: first, b: await snapshot(b) });
    await focus(b);
    await b.keyboard.down('ControlLeft'); observations.push({ label: 'crouch', b: await until(() => snapshot(b), s => s.players.find(p => p.sessionId === targetId).crouching) });
    await b.keyboard.up('ControlLeft'); await b.mouse.down({ button: 'right' });
    observations.push({ label: 'aim', b: await until(() => snapshot(b), s => s.players.find(p => p.sessionId === targetId).aiming) });
    await b.mouse.up({ button: 'right' });
    await aim(a, null);
    for (const [x, z] of [[62,46], [62,22], [34,22], [34,46]]) await walk(a, x, z);
    await aim(a, targetId);
    await a.evaluate(targetId => {
      const seen = { reload: null, death: null, fresh: null };
      window.__movingSeen = () => structuredClone(seen);
      window.__movingObserver = setInterval(() => {
        const s = window.__mpDebug(), p = s.players.find(p => p.sessionId === targetId);
        const actor = s.remoteActors.find(p => p.sessionId === targetId);
        if (!p || !actor) return;
        if (p.reloadRemaining > 0 && !seen.reload) seen.reload = { p, actor, tick: s.currentTick };
        if (!p.alive) seen.death = { p, actor, tick: s.currentTick };
        if (p.lifeGeneration > 1 && p.alive) seen.fresh = { p, actor, tick: s.currentTick };
      }, 10);
    }, targetId);
    await focus(b); await b.mouse.click(400, 300);
    await until(() => snapshot(b), s => s.players.find(p => p.sessionId === targetId).ammo < 30);
    await b.keyboard.press('KeyR');
    await until(() => a.evaluate(() => window.__movingSeen()), s => !!s.reload);
    await focus(a); await a.mouse.down();
    try { await until(() => snapshot(b), s => !s.players.find(p => p.sessionId === targetId).alive); }
    finally { await a.mouse.up(); }
    await until(() => a.evaluate(() => window.__movingSeen()), s => !!s.fresh, 20000);
    const seen = await a.evaluate(() => { clearInterval(window.__movingObserver); return window.__movingSeen(); });
    assert.equal(seen.reload.actor.pose.upper, 'reload');
    assert.equal(seen.death.actor.clip, 'death_front');
    assert.equal(seen.fresh.p.alive, true); assert.equal(seen.fresh.p.ammo, 30);
    assert.equal(seen.fresh.actor.lifeGeneration, seen.fresh.p.lifeGeneration);
    observations.push({ label: 'authoritative-reload-death-fresh-life', seen });
    for (let i = 0; i < pages.length; i++) {
      assert.equal(await pages[i].locator('#graphics-quality-menu').inputValue(), tier);
      const pixelPath = path.join(directory, `online-${tier}-${i}-fresh-life.png`);
      const pixels = await pages[i].screenshot({ path: pixelPath });
      observations.push({ label: 'fresh-life-pixels', client: i,
        path: path.relative(ROOT, pixelPath).replaceAll('\\', '/'), sha256: hash(pixels) });
    }
    report.complete = true;
  } catch (error) { report.error = error.message; }
  finally {
    try {
      await Promise.all(contexts.map(context => context.close()));
      for (const page of pages) {
        const filename = await page.video().path(), bytes = await fs.readFile(filename);
        media.push({ path: path.relative(ROOT, filename).replaceAll('\\', '/'), sha256: hash(bytes),
          bytes: bytes.length, format: 'WebM', continuousFullPixels: true });
      }
    } finally { await fixture.stop(); }
  }
  return report;
}
