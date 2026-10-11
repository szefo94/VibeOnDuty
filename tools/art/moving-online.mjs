import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { startMpFixture } from '../../tests/helpers/mpServer.js';
import { ROOT, hash } from './pipeline.mjs';
import { MOUSE_SENS } from '../../src/config.js';
// Every number of the route and every bound lives in the tested pure helper; none is repeated here.
import { MAX_CORRECTIONS, MATCH_SECONDS, TIER_DEADLINE_MS, LEG_BOUND_MS, ACTION_BOUND_MS, DEATH_BOUND_MS,
  FRESH_LIFE_BOUND_MS, POLL_MS, RETRY_MS, HEALTH_IDLE_MS, PROGRESS_SEEN_M, routeLegs, insideBox, outsideLane, chooseKey, alongTrack,
  shouldCrouch, shouldRelease, shouldBackOff, oppositeKey, recentFramesPerSecond, classifyLeg, legSummary,
  boundedMs } from './online-route.mjs';

// The collector sends only ordinary keyboard and mouse input and only observes through
// window.__mpDebug() and its own window properties (__movingFrames, __movingSeen, __movingObserver).
// It writes no game or room state and installs no socket wrapper.
const TIERS = ['low', 'medium', 'high'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const snapshot = page => page.evaluate(() => window.__mpDebug());
const own = state => state.players.find(p => p.sessionId === state.sessionId);
const point = p => `(${p.x.toFixed(2)},${p.z.toFixed(2)})`;
// An error whose message starts with its kind; `failure` is copied into the tier report.
function failure(kind, detail, fields = {}) {
  const error = Error(`${kind}: ${detail}`);
  error.failure = { kind, waypoint: null, position: null, framesPerSecond: null, staleInputSamples: null, ...fields };
  return error;
}
// Passive frame counter, installed with the page: an animation-frame callback that only increments a
// number on a collector-owned window property.
function installFrameCounter() {
  window.__movingFrames = 0;
  const count = () => { window.__movingFrames++; requestAnimationFrame(count); };
  requestAnimationFrame(count);
}
// budget: { startedAt } of the tier. Every wait uses the smaller of its own bound and the time left
// to the tier deadline.
async function until(budget, read, predicate, timeout = 15000) {
  const left = boundedMs(budget.startedAt, Date.now(), Infinity);
  const deadline = Date.now() + Math.min(timeout, left);
  while (Date.now() < deadline) {
    const state = await read(); if (predicate(state)) return state;
    await sleep(POLL_MS);
  }
  if (left <= timeout) throw failure('tier_deadline', `no observation before the ${TIER_DEADLINE_MS} ms tier deadline`);
  throw Error('Actual online observation deadline expired');
}
async function focus(page, budget) {
  await page.bringToFront();
  if (!await page.evaluate(() => !!document.pointerLockElement)) {
    const control = await page.locator('#mp-resume').isVisible() ? '#mp-resume' : '#pause-resume-btn';
    await page.locator(control).click();
    await until(budget, () => page.evaluate(() => !!document.pointerLockElement), Boolean);
  }
}
// Hold walking: one movement key stays down across frames until the server reports the body moving
// and the first sample at or inside the release threshold; arrival is a per-axis box. `legs` receives
// one summary per call, also on failure.
async function walk(page, budget, from, waypoint, legs) {
  const started = Date.now(), samples = [];
  const length = Math.hypot(waypoint[0] - from[0], waypoint[1] - from[1]);
  const bound = boundedMs(budget.startedAt, started, LEG_BOUND_MS);
  let held = null, crouching = false, presses = 0, backOffs = 0, last = null;
  const read = async () => {
    const { state, frames } = await page.evaluate(() => ({ state: window.__mpDebug(), frames: window.__movingFrames ?? 0 }));
    const p = own(state);
    const along = alongTrack(p, from, waypoint);
    last = { tick: state.currentTick, wallMs: Date.now() - started, frames, x: p.x, z: p.z, yaw: p.yaw, moving: p.moving,
      crouching: p.crouching, along, remaining: length - along, held, lastInputRejection: state.lastInputRejection,
      locked: state.inputLocked, outside: outsideLane(p, from, waypoint) };
    samples.push(last);
    return last;
  };
  const release = async () => {
    const key = held, crouched = crouching;
    held = null; crouching = false;
    if (key) await page.keyboard.up(key);
    if (crouched) await page.keyboard.up('ControlLeft');
  };
  // staleInputSamples is a sampled lower bound: window.__mpDebug() exposes only the latest rejection reason.
  const fail = kind => {
    const summary = legSummary(samples), fps = summary.framesPerSecond;
    return failure(kind, `waypoint (${waypoint[0]},${waypoint[1]}), position ${last ? point(last) : 'unknown'}, `
      + `${fps === null ? 'unknown' : fps.toFixed(1)} frames per second, ${summary.staleInputSamples} sampled stale_input `
      + `(lower bound), ${presses} key presses, ${Date.now() - started} ms`,
    { waypoint, position: last ? { x: last.x, z: last.z } : null, framesPerSecond: fps,
      staleInputSamples: summary.staleInputSamples });
  };
  const check = () => {
    if (Date.now() - started >= bound) throw fail(bound < LEG_BOUND_MS ? 'tier_deadline' : 'leg_bound');
  };
  try {
    for (;;) {
      // Every decision starts with the pointer captured: without it the page sends neutral input only.
      await focus(page, budget);
      let s = await read();
      if (insideBox(s, waypoint)) return;
      check();
      const toward = chooseKey(s, s.yaw, waypoint);
      if (++presses > MAX_CORRECTIONS) throw fail('corrections');
      // A body at rest just outside the box steps back first: one step toward the waypoint could
      // pass the far side of the box.
      const backOff = shouldBackOff(s, waypoint, toward, s.yaw);
      const key = backOff ? oppositeKey(toward) : toward;
      if (backOff) backOffs++;
      if (shouldCrouch(s, waypoint, toward, s.yaw)) { crouching = true; await page.keyboard.down('ControlLeft'); }
      const pressedAt = s.along;
      let effective = false;
      held = key;
      await page.keyboard.down(key);
      for (;;) {
        await sleep(POLL_MS);
        s = await read();
        // A key is never released before it took effect: a press that the server has not applied yet
        // would otherwise be a tap without movement. A step back ends as soon as it took effect.
        effective = effective || s.moving || Math.abs(s.along - pressedAt) > PROGRESS_SEEN_M;
        const framesPerSecond = recentFramesPerSecond(samples) ?? budget.framesPerSecond ?? null;
        if (effective && (backOff || shouldRelease(s, waypoint, toward, s.yaw, s.crouching, framesPerSecond)
          || chooseKey(s, s.yaw, waypoint) !== toward)) break;
        if (classifyLeg(samples) === 'stalled') throw fail('stalled');
        check();
        if (!crouching && shouldCrouch(s, waypoint, toward, s.yaw)) { crouching = true; await page.keyboard.down('ControlLeft'); }
      }
      await release();
      // Decide again only when the player is reported not moving and two consecutive snapshots, the
      // second from a later tick, agree.
      for (let previous = null; ;) {
        await sleep(POLL_MS);
        s = await read();
        if (!s.moving && previous && s.tick > previous.tick && previous.x === s.x && previous.z === s.z) break;
        previous = s;
        check();
      }
    }
  } finally {
    await release().catch(() => {});
    const summary = legSummary(samples);
    // The next leg starts with this leg's frame rate until it has measured its own.
    if (summary.framesPerSecond !== null) budget.framesPerSecond = summary.framesPerSecond;
    legs.push({ waypoint, backOffs, ...summary });
  }
}
async function aim(page, budget, targetId) {
  await focus(page, budget);
  const s = await snapshot(page), p = s.players.find(p => p.sessionId === s.sessionId);
  const other = s.players.find(p => p.sessionId === targetId);
  const yaw = other ? Math.atan2(-(other.x - p.x), -(other.z - p.z)) : 0;
  let delta = yaw - p.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  await page.evaluate(({ x, y }) => document.dispatchEvent(new MouseEvent('mousemove', {
    movementX: x, movementY: y, bubbles: true })), { x: -delta / MOUSE_SENS, y: p.pitch / MOUSE_SENS });
  const seq = (await snapshot(page)).inputSeq;
  await until(budget, () => snapshot(page), s => s.players.find(p => p.sessionId === s.sessionId).lastConsumedSeq > seq);
}
// Offers the same ordinary input again every RETRY_MS until the observation is seen. A retry changes
// how often the input is offered, never what the observation proves.
async function offer(budget, kind, input, read, seen) {
  const started = Date.now(), bound = boundedMs(budget.startedAt, started, ACTION_BOUND_MS);
  let offers = 0;
  while (Date.now() - started < bound) {
    await input(); offers++;
    const retryAt = Date.now() + RETRY_MS;
    do {
      const state = await read(); if (seen(state)) return state;
      await sleep(POLL_MS);
    } while (Date.now() < retryAt && Date.now() - started < bound);
  }
  throw failure(bound < ACTION_BOUND_MS ? 'tier_deadline' : 'action_bound', `${kind} not observed after ${offers} offers in ${bound} ms`);
}
// Aim, hold the mouse button; when the target's health has not dropped for HEALTH_IDLE_MS, release,
// aim again and hold again.
async function holdFireUntilDeath(a, b, budget, targetId) {
  const started = Date.now(), bound = boundedMs(budget.startedAt, started, DEATH_BOUND_MS);
  let holds = 0;
  while (Date.now() - started < bound) {
    await aim(a, budget, targetId);
    holds++;
    await a.mouse.down();
    try {
      let health = null, droppedAt = Date.now();
      while (Date.now() - started < bound) {
        const state = await snapshot(b), target = state.players.find(p => p.sessionId === targetId);
        if (!target.alive) return;
        if (health === null || target.health < health) { health = target.health; droppedAt = Date.now(); }
        else if (Date.now() - droppedAt >= HEALTH_IDLE_MS) break;
        await sleep(POLL_MS);
      }
    } finally { await a.mouse.up().catch(() => {}); }
  }
  throw failure(bound < DEATH_BOUND_MS ? 'tier_deadline' : 'death_bound', `target alive after ${holds} fire holds in ${bound} ms`);
}
// options.tiers: optional subset or order of tiers (used by the labelled control); the capture tool
// calls this with two arguments and collects the three tiers in the existing order.
export async function collectMovingOnline(browser, directory, options = {}) {
  const samples = [];
  for (const tier of options.tiers ?? TIERS) {
    samples.push(await collectTier(browser, directory, tier));
    console.log(`Moving production M4 collection ${tier}: ${samples.at(-1).complete ? 'complete' : samples.at(-1).error}`);
  }
  return { complete: samples.every(sample => sample.complete), samples,
    observations: samples.flatMap(sample => sample.observations),
    media: samples.flatMap(sample => sample.media),
    authority: 'Three tiers, each with two real production M4 memberships; ordinary intentions and an unfrozen server clock.' };
}
async function runTier(browser, directory, tier, fixture, budget, { contexts, pages, observations, legs }) {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1, recordVideo: { dir: directory, size: { width: 800, height: 600 } } });
    contexts.push(context); const page = await context.newPage(); pages.push(page);
    await context.addInitScript(tier => localStorage.setItem('vod_graphics_quality_v1', tier), tier);
    await context.addInitScript(installFrameCounter);
    await page.goto(fixture.url);
    await page.waitForFunction(() => !document.getElementById('mp-join-btn').disabled, null,
      { timeout: Math.max(1, boundedMs(budget.startedAt, Date.now(), 60000)) });
    await page.locator('#mp-join-btn').click();
    await until(budget, () => snapshot(page), s => !!s.sessionId);
  }
  const [a, b] = pages;
  await until(budget, () => snapshot(a), s => s.players.length === 2);
  const first = await snapshot(a), targetId = (await snapshot(b)).sessionId;
  observations.push({ label: 'joined-blue-red', a: first, b: await snapshot(b) });
  await focus(b, budget);
  await b.keyboard.down('ControlLeft');
  try { observations.push({ label: 'crouch', b: await until(budget, () => snapshot(b), s => s.players.find(p => p.sessionId === targetId).crouching) }); }
  finally { await b.keyboard.up('ControlLeft').catch(() => {}); }
  await b.mouse.down({ button: 'right' });
  try { observations.push({ label: 'aim', b: await until(budget, () => snapshot(b), s => s.players.find(p => p.sessionId === targetId).aiming) }); }
  finally { await b.mouse.up({ button: 'right' }).catch(() => {}); }
  await aim(a, budget, null);
  for (const [from, waypoint] of routeLegs()) await walk(a, budget, from, waypoint, legs);
  await aim(a, budget, targetId);
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
  await offer(budget, 'fire', async () => { await focus(b, budget); await b.mouse.click(400, 300); },
    () => snapshot(b), s => s.players.find(p => p.sessionId === targetId).ammo < 30);
  await offer(budget, 'reload', async () => { await focus(b, budget); await b.keyboard.press('KeyR'); },
    () => a.evaluate(() => window.__movingSeen()), s => !!s.reload);
  await holdFireUntilDeath(a, b, budget, targetId);
  // The observer reads authoritative state every 10 ms; the remote actor of the new life appears with
  // the next rendered frame. Wait, within the same bound, until the observer has seen both agree; the
  // assertions below are unchanged.
  await until(budget, () => a.evaluate(() => window.__movingSeen()),
    s => !!s.fresh && s.fresh.actor.lifeGeneration === s.fresh.p.lifeGeneration, FRESH_LIFE_BOUND_MS);
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
}
async function collectTier(browser, directory, tier) {
  const budget = { startedAt: Date.now() };
  const fixture = await startMpFixture({ testSettings: { killLimit: 50, matchSeconds: MATCH_SECONDS,
    respawnSeconds: 3, friendlyFire: .25 }, env: { VOD_COMBAT_SEED: '7' } });
  const contexts = [], pages = [], observations = [], media = [], legs = [];
  const report = { tier, complete: false, observations, media, authority: 'Two real production M4 memberships; ordinary keyboard/mouse intentions; server clock never frozen.', legs };
  let expiry = null, timeRemainingAtEnd = null;
  try {
    // The tier body races a hard timer, so no single hung browser call can outlive the tier deadline.
    const run = runTier(browser, directory, tier, fixture, budget, { contexts, pages, observations, legs });
    run.catch(() => {});
    await Promise.race([run, new Promise((_, reject) => {
      expiry = setTimeout(() => reject(failure('tier_deadline', `tier gave up at ${TIER_DEADLINE_MS} ms`)),
        boundedMs(budget.startedAt, Date.now(), Infinity));
    })]);
    report.complete = true;
  } catch (error) {
    report.error = error.message;
    report.failure = error.failure ?? { kind: String(error.message).split(/[\s:]/)[0], waypoint: null, position: null,
      framesPerSecond: null, staleInputSamples: null };
  }
  finally {
    clearTimeout(expiry);
    try {
      if (pages[0]) timeRemainingAtEnd = await Promise.race([
        snapshot(pages[0]).then(state => state.timeRemaining, () => null), sleep(3000).then(() => null)]);
      await Promise.all(contexts.map(context => context.close()));
      for (const page of pages) {
        const filename = await page.video().path(), bytes = await fs.readFile(filename);
        media.push({ path: path.relative(ROOT, filename).replaceAll('\\', '/'), sha256: hash(bytes),
          bytes: bytes.length, format: 'WebM', continuousFullPixels: true });
      }
    } finally { await fixture.stop(); }
  }
  // wallMs covers the whole tier: fixture start, collection and teardown.
  report.timing = { wallMs: Date.now() - budget.startedAt, timeRemainingAtEnd, matchSeconds: MATCH_SECONDS };
  return report;
}
