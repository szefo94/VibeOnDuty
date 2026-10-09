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

// Measurement aid, off unless PAUSE_SPEC_GUARD_SELECTOR is set. The page is then
// served src/main.js with the selector of its one press guard replaced by that
// value, so a case can be recorded as it behaves without part of the guard:
// '#pause-menu' leaves the banner and Skip unguarded, ':not(*)' matches nothing.
// The file on disk is not written. A run made this way is a record of what the
// guard prevents, never a result for the shipped source.
const GUARD_SELECTOR = process.env.PAUSE_SPEC_GUARD_SELECTOR;
const GUARD_CALL = /closest\?\.\('[^']*'\)/g;
let guardVariantError = null;

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

test.beforeEach(async ({ context }, testInfo) => {
  if (GUARD_SELECTOR === undefined) return;
  testInfo.annotations.push({ type: 'guard-variant', description: GUARD_SELECTOR });
  await context.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    const calls = body.match(GUARD_CALL) ?? [];
    if (calls.length !== 1) {
      guardVariantError = `expected one guard call in src/main.js, found ${calls.length}`;
      await route.abort();
      return;
    }
    await route.fulfill({ response, body: body.replace(GUARD_CALL, `closest?.(${JSON.stringify(GUARD_SELECTOR)})`) });
  });
});
test.afterEach(() => { expect(guardVariantError).toBeNull(); });

// The collector's three overrides, copied as they are from collectCombat in
// tools/art/animation-capture.mjs: the lock is granted inside the request.
function synchronousGrant() {
  let captured=false;
  Object.defineProperty(document,'pointerLockElement',{get:()=>captured?document.getElementById('c'):null});
  HTMLCanvasElement.prototype.requestPointerLock=()=>{captured=true;document.dispatchEvent(new Event('pointerlockchange'));};
  document.exitPointerLock=()=>{captured=false;document.dispatchEvent(new Event('pointerlockchange'));};
}

// The same synchronous grant, except that a release with nothing captured is silent,
// as in a browser: exitPointerLock() fires pointerlockchange only when it ends a lock.
// The collector's adapter above fires it on every release, which hides a state that
// depends on no event arriving.
function synchronousGrantSilentRelease() {
  let captured = false;
  const change = () => document.dispatchEvent(new Event('pointerlockchange'));
  Object.defineProperty(document, 'pointerLockElement', { get: () => captured ? document.getElementById('c') : null });
  HTMLCanvasElement.prototype.requestPointerLock = () => { captured = true; change(); };
  document.exitPointerLock = () => { if (!captured) return; captured = false; change(); };
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

// Read only: what the page saw during a press, in order, each entry with whether the
// pointer was captured at that moment. The listeners sit on window in the capture
// phase, so a click entry is taken before the pressed control's own handler runs.
function pressLog() {
  const log = window.__pressLog = [];
  const name = target => target?.id || target?.nodeName || '';
  for (const type of ['mousedown', 'mouseup', 'click'])
    window.addEventListener(type, event =>
      log.push({ type, target: name(event.target), captured: !!document.pointerLockElement }), true);
  document.addEventListener('pointerlockchange', () =>
    log.push({ type: 'pointerlockchange', captured: !!document.pointerLockElement }));
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

// One real press on a control (needs pressLog). `reached` is true when the click was
// delivered to that control; `capturedBeforeClick` is true when the pointer was
// captured at any moment from the press down to that delivery.
async function press(page, selector) {
  await page.evaluate(() => { window.__pressLog.length = 0; });
  await page.locator(selector).click();
  const log = await page.evaluate(() => window.__pressLog.slice());
  const id = selector.slice(1);
  const down = log.findIndex(entry => entry.type === 'mousedown' && entry.target === id);
  const click = log.findIndex((entry, index) => index > down && entry.type === 'click');
  return { log, reached: down !== -1 && click !== -1 && log[click].target === id,
    capturedBeforeClick: down === -1 ||
      log.slice(down, click === -1 ? undefined : click + 1).some(entry => entry.captured) };
}

// An offline match through its enabled start button, with the pointer captured.
async function startMatch(page, startButton) {
  await expect(page.locator(startButton)).toBeEnabled({ timeout: 20000 });
  await page.locator('.diff-card[data-diff="recruit"]').click();
  await page.locator(startButton).click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await settled(page);
}

// The pointer released as Esc does: the game is running, unlocked, and the pause menu is up.
async function pauseTdm(page) {
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
}

// Offline TDM through the enabled start button, then paused.
async function startTdmAndPause(page) {
  await page.goto(url);
  await startMatch(page, '#tdm-startbtn');
  await pauseTdm(page);
}

// Online TDM with no game server behind this Vite server: the join fails and the
// connection banner comes up. An offline match is then started and paused through
// the ordinary menu. Returns the matchmaking requests seen so far, which grows.
async function failJoinThenStartTdmAndPause(page) {
  const attempts = [];
  page.on('request', request => { if (request.url().includes('/matchmake/')) attempts.push(request.url()); });
  await page.goto(url);
  await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 20000 });
  await page.locator('#mp-join-btn').click();
  await expect(page.locator('#mp-error-banner')).toBeVisible();
  await expect(page.locator('#mp-join-btn')).toBeEnabled();
  expect(attempts).toHaveLength(1);
  await startMatch(page, '#tdm-startbtn');
  await pauseTdm(page);
  // No offline start clears the banner: it is still up over the running match.
  await expect(page.locator('#mp-error-banner')).toBeVisible();
  return attempts;
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

test('pause menu: a press on the empty part of the box does not capture the pointer', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await startTdmAndPause(page);
  // The title is inside the box and is not a control. Before the guard such a press
  // captured the pointer and so acted as an unlabelled resume; Resume is the control.
  await page.locator('#pause-title').click();
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
});

test('online error banner: a Return to menu press over an offline match returns to the menu without capturing the pointer', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await context.addInitScript(pressLog);
  await failJoinThenStartTdmAndPause(page);
  const seen = await press(page, '#mp-error-return-btn');
  expect.soft(seen.reached, 'the click was delivered to Return to menu').toBe(true);
  expect.soft(seen.capturedBeforeClick, 'the pointer was captured before the click was delivered').toBe(false);
  await expectMenuReturned(page);
  await expect(page.locator('#mp-error-banner')).toBeHidden();
});

test('online error banner: a Retry press over an offline match starts a fresh join attempt without capturing the pointer first', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await context.addInitScript(pressLog);
  const attempts = await failJoinThenStartTdmAndPause(page);
  const seen = await press(page, '#mp-retry-btn');
  expect.soft(seen.reached, 'the click was delivered to Retry').toBe(true);
  expect.soft(seen.capturedBeforeClick, 'the pointer was captured before the click was delivered').toBe(false);
  // Retry leaves the failed session and joins again. With no game server that attempt
  // fails too: the banner reports it and the pointer the join asked for is released.
  await expect.poll(() => attempts.length).toBe(2);
  await expect(page.locator('#mp-retry-btn')).toBeEnabled();
  await expect(page.locator('#mp-error-banner')).toBeVisible();
  await expect(page.locator('#pause-menu')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: false });
});

test('killcam: a Skip press after a wave death shows the death screen with the pointer released', async ({ context, page }) => {
  await context.addInitScript(synchronousGrant);
  await context.addInitScript(pressLog);
  await page.goto(url);
  await startMatch(page, '#startbtn');
  // Setup shortened from page script: the death is not played out. A live enemy is named
  // as the last attacker and the game's own death routine runs, as a fatal hit calls it.
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { enemies, triggerDeath } = await import(src + 'entities/enemies.js');
    const { player } = await import(src + 'entities/player.js');
    const attacker = enemies.find(enemy => !enemy.dead);
    if (!attacker) throw new Error('no live enemy to name as the attacker');
    player.lastAttacker = attacker;
    triggerDeath();
  });
  await expect(page.locator('#kc-skip')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: null, gameRunning: true, pointerLocked: false });
  const seen = await press(page, '#kc-skip');
  expect.soft(seen.reached, 'the click was delivered to Skip').toBe(true);
  expect.soft(seen.capturedBeforeClick, 'the pointer was captured before the click was delivered').toBe(false);
  await expect(page.locator('#overlay')).toContainText('KILLED IN ACTION');
  await expect(page.locator('#killcam-wrap')).toBeHidden();
  expect(await readState(page)).toEqual({ mode: null, gameRunning: false, pointerLocked: false });
});

test('killcam: a Skip press while paused at a lost TDM match end leaves no pause menu over the result', async ({ context, page }) => {
  await context.addInitScript(synchronousGrantSilentRelease);
  await context.addInitScript(pressLog);
  await page.goto(url);
  await startMatch(page, '#tdm-startbtn');
  // Setup shortened from page script: an enemy is named as the last attacker and the
  // mode's own tick is advanced past the match clock, so the match ends on time, lost at
  // 0 to 0 with the player alive, and the end-of-match killcam starts. Nothing else is set.
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { enemies } = await import(src + 'entities/enemies.js');
    const { player } = await import(src + 'entities/player.js');
    const { getMode } = await import(src + 'modes/modeManager.js');
    const attacker = enemies.find(enemy => !enemy.dead && enemy.sndTeam === 'enemy');
    if (!attacker) throw new Error('no live enemy to name as the attacker');
    player.lastAttacker = attacker;
    getMode().tick(601);
  });
  await expect(page.locator('#kc-skip')).toBeVisible();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: true, pointerLocked: true });
  // Esc during the killcam: the player is alive, so the pause menu comes up beside Skip.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('#pause-menu')).toBeVisible();
  const seen = await press(page, '#kc-skip');
  expect.soft(seen.reached, 'the click was delivered to Skip').toBe(true);
  expect.soft(seen.capturedBeforeClick, 'the pointer was captured before the click was delivered').toBe(false);
  await expect(page.locator('#snd-result')).toBeVisible();
  await expect(page.locator('#snd-result-title')).toHaveText('DEFEAT');
  await expect.soft(page.locator('#pause-menu'), 'the pause menu stayed up over the result').toBeHidden();
  expect(await readState(page)).toEqual({ mode: 'tdm', gameRunning: false, pointerLocked: false });
});
