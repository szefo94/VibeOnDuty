// Pause-menu presses under a pointer-lock adapter that really captures.
//
// Other offline specs replace requestPointerLock with a function that captures
// nothing, or activate a control from page script, so a press never re-captures
// the pointer there. Here every press is a real Playwright pointer action on a
// locator and the adapter reports the lock, as the motion collector's does.
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

// Model parameter, not a measurement of any browser: the delay after which the
// deferred adapter grants a requested lock. It sits between the few milliseconds
// of an immediate click and the 150 ms of a held press.
const GRANT_DELAY_MS = 50;

let server, url;
test.beforeAll(async ({ browser }) => {
  // The raised budget covers only this hook: an owned Vite server and one cold load.
  test.setTimeout(180000);
  const probe = portProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), base: '/',
    server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const warm = await browser.newPage();
  await warm.goto(url);
  await expect(warm.locator('#tdm-startbtn')).toBeEnabled({ timeout: 150000 });
  await warm.close();
});
test.afterAll(async () => { await server?.close(); });

// The collector's three overrides, copied as they are from collectCombat in
// tools/art/animation-capture.mjs: the lock is granted inside the request.
function synchronousGrant() {
  let captured=false;
  Object.defineProperty(document,'pointerLockElement',{get:()=>captured?document.getElementById('c'):null});
  HTMLCanvasElement.prototype.requestPointerLock=()=>{captured=true;document.dispatchEvent(new Event('pointerlockchange'));};
  document.exitPointerLock=()=>{captured=false;document.dispatchEvent(new Event('pointerlockchange'));};
}

// The same three overrides with the grant delivered in a later task. Requests and
// releases keep their order: a release issued while a grant is still in flight
// takes effect after that grant, so the later call decides the final state.
function deferredGrant(delayMs) {
  let captured = false, inFlight = 0;
  const change = () => document.dispatchEvent(new Event('pointerlockchange'));
  const later = value => { inFlight++; setTimeout(() => { inFlight--; captured = value; change(); }, delayMs); };
  Object.defineProperty(document, 'pointerLockElement', { get: () => captured ? document.getElementById('c') : null });
  HTMLCanvasElement.prototype.requestPointerLock = () => { later(true); };
  document.exitPointerLock = () => { if (inFlight) later(false); else { captured = false; change(); } };
  window.__deferredLock = { delayMs, get inFlight() { return inFlight; } };
}

// Read only: mode and gameRunning come from the game's own modules.
const readState = page => page.evaluate(async () => {
  const src = new URL('src/', location.href).href;
  const { getMode } = await import(src + 'modes/modeManager.js');
  const input = await import(src + 'input.js');
  return { mode: getMode()?.name ?? null, gameRunning: input.gameRunning,
    pointerLocked: !!document.pointerLockElement };
});
const settled = page => page.waitForFunction(() => !window.__deferredLock?.inFlight);

// Offline TDM through the enabled start button, then the pointer released as Esc
// does: the game is running, unlocked, and the pause menu is up.
async function startTdmAndPause(page) {
  await page.goto(url);
  await expect(page.locator('#tdm-startbtn')).toBeEnabled({ timeout: 20000 });
  await page.locator('.diff-card[data-diff="recruit"]').click();
  await page.locator('#tdm-startbtn').click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await settled(page);
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
}

async function expectMenuReturned(page) {
  await expect(page.locator('#overlay')).toBeVisible();
  await settled(page);
  expect(await readState(page)).toEqual({ mode: null, gameRunning: false, pointerLocked: false });
}

async function expectPlayingCaptured(page) {
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await expect(page.locator('#pause-menu')).toBeHidden();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: true });
}

test('pause menu: Main Menu press returns to the menu under a synchronous lock grant', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await startTdmAndPause(page);
  await page.locator('#pause-mainmenu-btn').click();
  await expectMenuReturned(page);
});

test('pause menu: a 150 ms Main Menu press returns to the menu under a deferred lock grant', async ({ context, page }) => {
  await context.addInitScript(deferredGrant, GRANT_DELAY_MS);
  await startTdmAndPause(page);
  await page.locator('#pause-mainmenu-btn').click({ delay: 150 });
  await expectMenuReturned(page);
});

test('pause menu: an immediate Main Menu click returns to the menu under a deferred lock grant', async ({ context, page }) => {
  await context.addInitScript(deferredGrant, GRANT_DELAY_MS);
  await startTdmAndPause(page);
  await page.locator('#pause-mainmenu-btn').click();
  await expectMenuReturned(page);
});

test('pause menu: the graphics-quality control stays usable while paused', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await startTdmAndPause(page);
  await page.locator('#graphics-quality-pause').click();
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
  await page.locator('#graphics-quality-pause').selectOption('low');
  await expect(page.locator('#graphics-quality-menu')).toHaveValue('low');
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
});

test('pause menu: Resume re-captures the pointer', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await startTdmAndPause(page);
  await page.locator('#pause-resume-btn').click();
  await expectPlayingCaptured(page);
});

test('pause menu: a canvas press re-captures the pointer while unlocked and running', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await startTdmAndPause(page);
  // Left edge at mid height: outside the centred pause box, on the game canvas.
  await page.locator('#c').click({ position: { x: 40, y: 300 } });
  await expectPlayingCaptured(page);
});
