// LABELLED COLLECTOR CONTROL - not moving-review evidence.
//
// Usage:
//   node tools/art/moving-online-control.mjs --label <name> [--tiers low,medium,high]
//        [--warm-up-minutes <n>] [--exact-rejections]
//   node tools/art/moving-online-control.mjs --read <label>[,<label>...] --tiers <list>
//
// Runs the real collectMovingOnline of tools/art/moving-online.mjs under the capture's browser
// conditions (headless Chromium, --use-gl=swiftshader, 800x600 full-pixel video at device scale
// factor 1) and judges whether every requested tier completed in time. Its records are written to
// the gitignored cache only (.planning/research/.cache/07-26/), carry a fixed label, bind to the
// bytes of the two collector files and are cited by no report or index as evidence.
// `staleInputSamples` is a sampled lower bound: window.__mpDebug() exposes only the latest
// rejection reason. `--exact-rejections` is diagnosis only and marks its record `diagnostic: true`;
// such a record never counts for acceptance.
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './pipeline.mjs';
import { MAX_STOP_STEP_M, STOP_LEAD_M, RELEASE_MARGIN_M, BACK_OFF_WITHIN_M, CROUCH_WITHIN_M, ARRIVAL_TOLERANCE_M, MATCH_SECONDS, TIER_DEADLINE_MS,
  TIER_TEARDOWN_ALLOWANCE_MS, WAYPOINTS } from './online-route.mjs';

export const CONTROL_LABEL = 'collector control of the online route; not moving-review evidence';
export const CONTROL_DIRECTORY = path.join(ROOT, '.planning/research/.cache/07-26');
export const CRITERION_VERSION = 2;
export const MAX_TIER_WALL_MS = 360000;
export const MIN_TIME_REMAINING_S = 240;
export const REQUIRED_WARM_UP_MINUTES = 35; // for records whose label starts with `warm-`
const WARM_CONTEXT_MS = 120000;
const TIERS = ['low', 'medium', 'high'];
const BOUND_FILES = { movingOnlineSha256: 'tools/art/moving-online.mjs', onlineRouteSha256: 'tools/art/online-route.mjs' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const recordPath = label => path.join(CONTROL_DIRECTORY, `${label}.json`);

async function currentHashes() {
  const entries = await Promise.all(Object.entries(BOUND_FILES).map(async ([key, file]) =>
    [key, sha256(await fs.readFile(path.join(ROOT, file)))]));
  return Object.fromEntries(entries);
}

// Pure verdict over one record. Returns { pass, reasons }.
export function judge(record, tiers, hashes) {
  const reasons = [];
  if (!record || record.controlLabel !== CONTROL_LABEL) reasons.push('record does not carry the control label');
  if (record?.criterionVersion !== CRITERION_VERSION)
    reasons.push(`record was made under a superseded stop criterion (criterionVersion ${record?.criterionVersion ?? 'missing'}, ${CRITERION_VERSION} required)`);
  if (record?.diagnostic) reasons.push('diagnostic record (--exact-rejections) never counts');
  if (record?.status !== 'finished') reasons.push(`record status is ${record?.status ?? 'missing'}`);
  for (const key of Object.keys(BOUND_FILES))
    if (record?.[key] !== hashes[key]) reasons.push(`${key} differs from the current file bytes`);
  if (String(record?.label ?? '').startsWith('warm-') && !(record?.warmUp?.actualMinutes >= REQUIRED_WARM_UP_MINUTES))
    reasons.push(`warm-up ran ${record?.warmUp?.actualMinutes ?? 0} minutes, ${REQUIRED_WARM_UP_MINUTES} required`);
  for (const name of tiers) {
    const tier = record?.tiers?.find(entry => entry.tier === name);
    if (!tier) { reasons.push(`${name}: not in the record`); continue; }
    if (tier.complete !== true) reasons.push(`${name}: not complete (${tier.error ?? 'no error text'})`);
    if (!(tier.timing?.wallMs <= MAX_TIER_WALL_MS)) reasons.push(`${name}: wall time ${tier.timing?.wallMs} ms above ${MAX_TIER_WALL_MS}`);
    if (!(tier.timing?.timeRemainingAtEnd >= MIN_TIME_REMAINING_S)) reasons.push(`${name}: match time left ${tier.timing?.timeRemainingAtEnd} s below ${MIN_TIME_REMAINING_S}`);
    if (tier.timing?.matchSeconds !== MATCH_SECONDS) reasons.push(`${name}: match length ${tier.timing?.matchSeconds} is not ${MATCH_SECONDS}`);
    if ((tier.legs?.length ?? 0) !== WAYPOINTS.length) reasons.push(`${name}: ${tier.legs?.length ?? 0} legs, ${WAYPOINTS.length} expected`);
    for (const leg of tier.legs ?? []) {
      const at = `(${leg.waypoint})`;
      // Stop criterion version 2 (plan 07-26, Amendment 2): the stop step length is recorded, not judged.
      const stops = leg.stops ?? [];
      if (stops.length === 0) reasons.push(`${name}: leg ${at} has no recorded stop`);
      else {
        for (const stop of stops)
          if (!(stop.restAtM >= -ARRIVAL_TOLERANCE_M)) reasons.push(`${name}: leg ${at} has a stop at rest ${stop.restAtM} m, beyond the far side of the arrival box`);
        const last = stops.at(-1);
        if (!(Math.abs(last.restAtM) <= ARRIVAL_TOLERANCE_M)) reasons.push(`${name}: leg ${at} last stop at rest ${last.restAtM} m, outside the arrival box`);
      }
      if (leg.outsideLaneSamples !== 0) reasons.push(`${name}: leg ${at} has ${leg.outsideLaneSamples} samples outside the lane`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

const fixed = (value, digits = 1) => typeof value === 'number' ? value.toFixed(digits) : 'n/a';
function printRecord(record) {
  for (const tier of record.tiers ?? []) {
    console.log(`[control ${record.label}] tier ${tier.tier}: ${tier.complete ? 'complete' : 'FAILED ' + tier.error}; `
      + `wall ${tier.timing?.wallMs} ms; match time left ${fixed(tier.timing?.timeRemainingAtEnd)} s`);
    for (const leg of tier.legs ?? [])
      console.log(`[control ${record.label}]   leg (${leg.waypoint}): ${leg.wallMs} ms, ${leg.ticks} ticks, `
        + `${fixed(leg.framesPerSecond)} frames per second, staleInputSamples ${leg.staleInputSamples} (sampled lower bound), `
        + `corrections ${leg.corrections}, back-offs ${leg.backOffs ?? 0}, largest stop step ${fixed(leg.largestStopStepM, 2)} m, `
        + `outside lane ${leg.outsideLaneSamples}; stops released/rest `
        + `${(leg.stops ?? []).map(stop => `${fixed(stop.releasedAtM, 2)}/${fixed(stop.restAtM, 2)}`).join(' ') || 'none'}`);
    if (tier.failure) console.log(`[control ${record.label}]   failure ${JSON.stringify(tier.failure)}`);
    if (tier.exactRejections) console.log(`[control ${record.label}]   exact rejections (diagnostic) ${JSON.stringify(tier.exactRejections)}`);
  }
}

// Warm-up in the same browser, before the tiers: the offline game on an owned Vite listener, in
// contexts with 800x600 video, Training Range started through the enabled start button and walked
// with ordinary keys; each context is closed and replaced about every two minutes. It imitates the
// offline part of the capture and is not the same sequence of contexts. The pointer-lock stand-in
// below is the one the offline capture uses in headless Chromium; it applies to the warm-up only.
async function warmUp(browser, directory, minutes) {
  const { createServer } = await import('vite');
  const { ownedReviewPort } = await import('./owned-review-port.mjs');
  const port = await ownedReviewPort();
  const server = await createServer({ root: ROOT, base: '/', cacheDir: path.join(directory, 'vite-cache'),
    logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true, hmr: false, open: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  const started = Date.now(), until = started + minutes * 60000;
  let contexts = 0;
  const errors = [];
  try {
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    while (Date.now() < until) {
      const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1,
        recordVideo: { dir: path.join(directory, 'warm-up'), size: { width: 800, height: 600 } } });
      contexts++;
      try {
        await context.addInitScript(tier => {
          localStorage.setItem('vod_graphics_quality_v1', tier);
          let captured = false;
          Object.defineProperty(document, 'pointerLockElement', { get: () => captured ? document.getElementById('c') : null });
          HTMLCanvasElement.prototype.requestPointerLock = () => { captured = true; document.dispatchEvent(new Event('pointerlockchange')); };
          document.exitPointerLock = () => { captured = false; document.dispatchEvent(new Event('pointerlockchange')); };
        }, TIERS[(contexts - 1) % TIERS.length]);
        const page = await context.newPage();
        await page.goto(url);
        await page.waitForFunction(() => !document.getElementById('range-startbtn')?.disabled, null, { timeout: 60000 });
        await page.locator('#range-startbtn').click();
        const end = Math.min(until, Date.now() + WARM_CONTEXT_MS);
        for (let step = 0; Date.now() < end; step++) {
          const key = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][step % 4];
          await page.keyboard.down(key);
          try { await sleep(1500); } finally { await page.keyboard.up(key); }
          await sleep(500);
        }
      } catch (error) { errors.push(error.message); await sleep(1000); }
      finally { await context.close(); }
      if (errors.length > 5) throw Error(`warm-up failed repeatedly: ${errors.at(-1)}`);
    }
  } finally { await server.close(); }
  return { requestedMinutes: minutes, actualMinutes: (Date.now() - started) / 60000, contexts, errors };
}

// Diagnosis only: every context gets a read-only socket message listener counting rejection reasons.
function countExactRejections(browser, sink) {
  const create = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await create(options);
    await context.addInitScript(() => {
      const counts = window.__controlRejections = {};
      const Native = window.WebSocket, decoder = new TextDecoder('latin1');
      const reasons = ['stale_input', 'future_tick', 'duplicate_seq', 'queue_limit', 'rate_limit', 'wrong_generation',
        'invalid_shape', 'invalid_number', 'invalid_action'];
      window.WebSocket = class extends Native {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', event => {
            if (!(event.data instanceof ArrayBuffer) || event.data.byteLength > 200) return;
            const text = decoder.decode(event.data);
            if (!text.includes('inputRejected')) return;
            for (const reason of reasons) if (text.includes(reason)) counts[reason] = (counts[reason] ?? 0) + 1;
          });
        }
      };
    });
    const close = context.close.bind(context);
    context.close = async (...args) => {
      for (const page of context.pages())
        sink.push(await page.evaluate(() => ({ ...window.__controlRejections })).catch(() => null));
      return close(...args);
    };
    return context;
  };
}

export async function runControl({ label, tiers, warmUpMinutes, exactRejections }) {
  const check = await import('node:child_process').then(({ spawnSync }) =>
    spawnSync('git', ['check-ignore', '-q', path.relative(ROOT, recordPath(label))], { cwd: ROOT }));
  if (check.status !== 0) throw Error('The control cache directory is not gitignored; refusing to write a record');
  await fs.mkdir(CONTROL_DIRECTORY, { recursive: true });
  const record = { label, controlLabel: CONTROL_LABEL, criterionVersion: CRITERION_VERSION, status: 'started', startedAt: new Date().toISOString(),
    diagnostic: exactRejections === true, requestedTiers: tiers, ...await currentHashes(),
    constants: { STOP_LEAD_M, RELEASE_MARGIN_M, BACK_OFF_WITHIN_M, CROUCH_WITHIN_M, ARRIVAL_TOLERANCE_M, MAX_STOP_STEP_M, MATCH_SECONDS, TIER_DEADLINE_MS, TIER_TEARDOWN_ALLOWANCE_MS,
      MAX_TIER_WALL_MS, MIN_TIME_REMAINING_S },
    warmUp: { requestedMinutes: warmUpMinutes, actualMinutes: 0 }, tiers: [] };
  // Exclusive create: a label is never reused, also when a run dies before it finishes.
  await fs.writeFile(recordPath(label), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  const directory = path.join(CONTROL_DIRECTORY, label);
  await fs.mkdir(directory, { recursive: true });
  const { chromium } = await import('@playwright/test');
  const { collectMovingOnline } = await import('./moving-online.mjs');
  const began = Date.now();
  let browser;
  try {
    // Launched exactly as the capture does (tools/art/animation-capture.mjs).
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    record.browser = browser.version();
    if (warmUpMinutes > 0) {
      console.log(`[control ${label}] warm-up ${warmUpMinutes} minutes in the same browser`);
      record.warmUp = await warmUp(browser, directory, warmUpMinutes);
    }
    const exact = [];
    if (exactRejections) countExactRejections(browser, exact);
    const report = await collectMovingOnline(browser, directory, { tiers });
    record.tiers = report.samples.map((sample, index) => ({ tier: sample.tier, complete: sample.complete, error: sample.error ?? null,
      timing: sample.timing ?? null, legs: sample.legs ?? [], failure: sample.failure ?? null,
      observationLabels: sample.observations.map(entry => entry.label), mediaCount: sample.media.length,
      ...(exactRejections ? { exactRejections: exact.slice(index * 2, index * 2 + 2) } : {}) }));
    record.status = 'finished';
  } catch (error) { record.status = 'error'; record.error = error.message; }
  finally {
    await browser?.close().catch(() => {});
    record.totalWallMs = Date.now() - began;
    record.finishedAt = new Date().toISOString();
    record.verdict = judge(record, tiers, await currentHashes());
    await fs.writeFile(recordPath(label), JSON.stringify(record, null, 2) + '\n');
  }
  return record;
}

export async function readControl(labels, tiers) {
  const hashes = await currentHashes();
  const results = [];
  for (const label of labels) {
    let record = null;
    try { record = JSON.parse(await fs.readFile(recordPath(label), 'utf8')); } catch { /* a missing record fails below */ }
    const verdict = record ? judge(record, tiers, hashes) : { pass: false, reasons: ['record missing or unreadable'] };
    results.push({ label, record, ...verdict });
  }
  return { pass: results.length > 0 && results.every(result => result.pass), results };
}

function parse(argv) {
  const options = { label: null, read: null, tiers: TIERS, warmUpMinutes: 0, exactRejections: false };
  for (let i = 0; i < argv.length; i++) {
    const value = () => { if (i + 1 >= argv.length) throw Error(`${argv[i]} needs a value`); return argv[++i]; };
    if (argv[i] === '--label') options.label = value();
    else if (argv[i] === '--read') options.read = value().split(',').filter(Boolean);
    else if (argv[i] === '--tiers') options.tiers = value().split(',').filter(Boolean);
    else if (argv[i] === '--warm-up-minutes') options.warmUpMinutes = Number(value());
    else if (argv[i] === '--exact-rejections') options.exactRejections = true;
    else throw Error(`Unknown option ${argv[i]}`);
  }
  if (!options.tiers.length || options.tiers.some(tier => !TIERS.includes(tier))) throw Error('--tiers takes low, medium, high');
  if (!(options.warmUpMinutes >= 0)) throw Error('--warm-up-minutes takes a non-negative number');
  for (const label of options.read ?? [options.label])
    if (!/^[a-z0-9][a-z0-9-]*$/.test(label ?? '')) throw Error('--label <name> or --read <label,...> is required (lower-case letters, digits, hyphen)');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const options = parse(process.argv.slice(2));
    console.log(`[control] ${CONTROL_LABEL}`);
    if (options.read) {
      const { pass, results } = await readControl(options.read, options.tiers);
      for (const result of results) {
        if (result.record) printRecord(result.record);
        console.log(`[control ${result.label}] ${result.pass ? 'PASS' : 'FAIL: ' + result.reasons.join('; ')}`);
      }
      process.exitCode = pass ? 0 : 1;
      return;
    }
    const record = await runControl(options);
    printRecord(record);
    if (record.warmUp?.requestedMinutes) console.log(`[control ${record.label}] warm-up ${fixed(record.warmUp.actualMinutes)} minutes, ${record.warmUp.contexts} contexts`);
    console.log(`[control ${record.label}] ${record.verdict.pass ? 'PASS' : 'FAIL: ' + record.verdict.reasons.join('; ')}; total ${record.totalWallMs} ms`);
    process.exitCode = record.verdict.pass ? 0 : 1;
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
