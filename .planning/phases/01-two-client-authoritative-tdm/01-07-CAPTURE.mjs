// Evidence-only normal-control attempt. Not imported by the game or served build.
// Status: deferred after two first-waypoint timeouts; no high-resolution images.
// Required production tests passed13/13. See evidence/01-07/manifest.json.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startMpFixture } from '../../../tests/helpers/mpServer.js';
import { MOUSE_SENS } from '../../../src/config.js';

const output = fileURLToPath(new URL('./evidence/01-07/high-resolution/', import.meta.url));
const snapshot = (page) => page.evaluate(() => window.__mpDebug());
async function focus(page) {
  await page.bringToFront();
  if (!(await page.evaluate(() => !!document.pointerLockElement))) {
    await page.locator('#mp-resume').click();
    await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  }
}
async function walk(page, id, x, z) {
  await focus(page);
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const p = (await snapshot(page)).players.find((p) => p.sessionId === id);
    const dx = x - p.x,
      dz = z - p.z,
      distance = Math.hypot(dx, dz);
    if (distance < 0.35) return;
    const forward = -dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw);
    const right = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
    const key =
      Math.abs(forward) > Math.abs(right)
        ? forward > 0
          ? 'KeyW'
          : 'KeyS'
        : right > 0
          ? 'KeyD'
          : 'KeyA';
    if (distance < 2) await page.keyboard.down('ControlLeft');
    await page.keyboard.down(key);
    try {
      // A full-size software render can delay DOM events. Hold the ordinary key
      // until server-observed movement instead of relying on a150ms pulse.
      await expect
        .poll(
          async () => {
            const current = (await snapshot(page)).players.find((p) => p.sessionId === id);
            return Math.hypot(current.x - p.x, current.z - p.z);
          },
          { timeout: 15000 }
        )
        .toBeGreaterThan(0.1);
    } finally {
      await page.keyboard.up(key);
      await page.keyboard.up('ControlLeft');
    }
    const seq = (await snapshot(page)).inputSeq;
    await expect
      .poll(async () => {
        const current = (await snapshot(page)).players.find((p) => p.sessionId === id);
        return !current.moving && current.lastConsumedSeq >= seq;
      })
      .toBe(true);
  }
  throw new Error(
    `Normal keyboard route timed out at ${x},${z}: ${JSON.stringify(await snapshot(page))}`
  );
}
async function aim(page, id) {
  await focus(page);
  await page.mouse.move(400, 300);
  let mx = 400,
    my = 300;
  for (let i = 0; i < 10; i++) {
    const s = await snapshot(page),
      p = s.players.find((p) => p.sessionId === s.sessionId),
      t = s.players.find((p) => p.sessionId === id);
    const dx = t ? t.x - p.x : 0,
      dz = t ? t.z - p.z : 0;
    const yaw = t ? Math.atan2(-dx, -dz) : 0,
      pitch = t ? Math.atan2(t.y - p.y - 0.1, Math.hypot(dx, dz)) : 0;
    const dyaw = Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)),
      dpitch = pitch - p.pitch;
    if (Math.abs(dyaw) < 0.02 && Math.abs(dpitch) < 0.02) return;
    mx -= dyaw / MOUSE_SENS;
    my -= dpitch / MOUSE_SENS;
    await page.mouse.move(mx, my);
    await page.waitForTimeout(250);
  }
  throw new Error('Normal mouse aim did not converge');
}
await mkdir(output, { recursive: true });
const fixture = await startMpFixture({
  tls: true,
  env: { VOD_COMBAT_SEED: '7' },
  testSettings: { killLimit: 2, matchSeconds: 600, respawnSeconds: 5, friendlyFire: 0.25 },
});
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    pages.push(page);
    await page.goto(fixture.url);
    await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await page.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(page)).sessionId).toBeTruthy();
    await page.evaluate(() => {
      const seen = { marker: false, numbers: [] };
      window.__captureFeedback = () => structuredClone(seen);
      new MutationObserver((records) => {
        for (const r of records) {
          if (r.target.id === 'xhair-dot' && r.target.style.background === 'rgb(231, 76, 60)')
            seen.marker = true;
          for (const n of r.addedNodes)
            if (n.nodeType === 1 && n.classList.contains('dmg-num'))
              seen.numbers.push(n.textContent);
        }
      }).observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style'],
      });
    });
  }
  const [a, b] = pages,
    first = await snapshot(a),
    target = (await snapshot(b)).sessionId;
  await expect.poll(async () => (await snapshot(a)).remoteActorCount).toBe(1);
  await aim(a, null);
  for (const [x, z] of [
    [62, 46],
    [62, 22],
    [34, 22],
    [34, 46],
    [18, 46],
  ])
    await walk(a, first.sessionId, x, z);
  await aim(a, target);
  await a.screenshot({ path: output + '01-current-rig.png' });
  await focus(b);
  await b.keyboard.down('ControlLeft');
  await expect.poll(async () => (await snapshot(a)).remoteActors[0]?.clip).toBe('crouch');
  await a.screenshot({ path: output + '02-replicated-crouch.png' });
  await b.keyboard.up('ControlLeft');
  await aim(a, target);
  await a.mouse.down();
  await a.mouse.up();
  await expect.poll(async () => (await snapshot(a)).lastConfirmedHit?.damage).toBeGreaterThan(0);
  await a.screenshot({ path: output + '03-shooter-confirmed.png' });
  await b.screenshot({ path: output + '04-victim-no-private-feedback.png' });
  const feedback = await Promise.all(
    pages.map((p) => p.evaluate(() => window.__captureFeedback()))
  );
  expect(feedback[0].marker).toBe(true);
  expect(feedback[0].numbers.length).toBeGreaterThan(0);
  expect(feedback[1]).toEqual({ marker: false, numbers: [] });
  for (let kill = 0; kill < 2; kill++) {
    await aim(a, target);
    await a.mouse.down();
    try {
      await expect
        .poll(async () => (await snapshot(b)).players.find((p) => p.sessionId === target).alive, {
          timeout: 15000,
        })
        .toBe(false);
    } finally {
      await a.mouse.up();
    }
    if (kill === 0) {
      await b.screenshot({ path: output + '05-death-respawn.png' });
      await expect
        .poll(
          async () =>
            (await snapshot(b)).players.find((p) => p.sessionId === target).lifeGeneration,
          { timeout: 15000 }
        )
        .toBe(2);
      await a.screenshot({ path: output + '06-respawn-current-rig.png' });
    }
  }
  for (const [i, p] of pages.entries()) {
    await expect(p.locator('#mp-results')).toBeVisible();
    await p.screenshot({ path: output + `07-results-window-${i + 1}.png` });
  }
  await expect.poll(async () => (await snapshot(a)).matchGeneration, { timeout: 20000 }).toBe(2);
  await a.screenshot({ path: output + '08-automatic-rematch.png' });
  await a.evaluate(() => document.exitPointerLock());
  await fixture.restart();
  await expect(a.locator('#mp-error-banner')).toBeVisible();
  await a.screenshot({ path: output + '09-top-disconnect-error.png' });
  await writeFile(
    output + 'capture.json',
    JSON.stringify(
      {
        captured: new Date().toISOString(),
        mode: 'headless-two-contexts',
        viewport: { width: 800, height: 600 },
        deviceScaleFactor: 1,
        transport: 'HTTPS/WSS',
        certificateTrust: 'ignoreHTTPSErrors automation bypass only',
        feedback,
        manualVisualAcceptance: 'pending',
      },
      null,
      2
    )
  );
  console.log(
    '[capture] PASS normal-control current rigs/crouch/private hits/death/respawn/results/rematch/error at800x600, device scale1'
  );
} finally {
  try {
    await browser?.close();
  } finally {
    await fixture.stop();
  }
}
