// LABELLED COLLECTOR CONTROL - not moving-review evidence.
//
// Usage: node tools/art/approach-fixture-control.mjs
//
// Proves two things about the combat approach in tools/art/animation-capture.mjs on the recorded
// stall geometry of `bunker` at `recruit` difficulty:
//   1. the map data the pure route module is tested on (src/shared/maps/bunker.js) equals the live
//      MAP and HMAP of the running page, cell by cell;
//   2. with the player and one hostile placed on the recorded geometry, the real in-page driver
//      (installCombatDriver) leaves the corner and comes within engagement range with line of sight.
// This file is the ONLY place in the repository that places the player and a hostile directly.
// The placement is a fixture of the control. Its record is written to the gitignored cache only,
// carries a fixed label, and is referenced by no report or summary as evidence.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ownedReviewPort } from './owned-review-port.mjs';
import { ROOT } from './pipeline.mjs';
import { installCombatDriver } from './animation-capture.mjs';
import { classifyStall } from './approach-route.mjs';
import { bunkerData } from '../../src/shared/maps/bunker.js';

export const CONTROL_LABEL = 'collector control with directly placed fixture; not moving-review evidence';
export const CONTROL_DIRECTORY = path.join(ROOT, '.planning/research/.cache/07-23');
const PLAYER_START = { x: 36, z: 31.93 };
const HOSTILE_START = { x: 35.97, z: 50 };
const ENGAGEMENT_RANGE_M = 14;
const MIN_DISPLACEMENT_M = 4;
const SIM_SECONDS_LIMIT = 20;
const WALL_LIMIT_MS = 600000;

function compareCells(label, nodeRows, pageRows) {
  let mismatches = 0;
  if (nodeRows.length !== pageRows.length) return { label, rows: [nodeRows.length, pageRows.length], mismatches: Infinity };
  for (let row = 0; row < nodeRows.length; row++) {
    if (nodeRows[row].length !== pageRows[row].length) { mismatches += Math.max(nodeRows[row].length, pageRows[row].length); continue; }
    for (let column = 0; column < nodeRows[row].length; column++)
      if (nodeRows[row][column] !== pageRows[row][column]) mismatches++;
  }
  return { label, rows: [nodeRows.length, pageRows.length], mismatches };
}

export async function runControl() {
  await fs.mkdir(CONTROL_DIRECTORY, { recursive: true });
  const started = Date.now();
  const port = await ownedReviewPort();
  const server = await createServer({ root: ROOT, base: '/', cacheDir: path.join(CONTROL_DIRECTORY, 'vite-cache'),
    logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true, hmr: false, open: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  let browser;
  const record = { label: CONTROL_LABEL, capturedAt: new Date().toISOString(), map: 'bunker', difficulty: 'recruit',
    playerStart: PLAYER_START, hostileStart: HOSTILE_START, dataAgreement: false, reachedEngagementRange: false };
  try {
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    record.listener = url;
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      localStorage.setItem('vod_graphics_quality_v1', 'low');
      let captured = false;
      Object.defineProperty(document, 'pointerLockElement', { get: () => captured ? document.getElementById('c') : null });
      HTMLCanvasElement.prototype.requestPointerLock = () => { captured = true; document.dispatchEvent(new Event('pointerlockchange')); };
      document.exitPointerLock = () => { captured = false; document.dispatchEvent(new Event('pointerlockchange')); };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('tdm-startbtn')?.disabled);
    await page.locator('.diff-card[data-diff="recruit"]').click();
    await page.locator('.map-card[data-map="bunker"]').click();
    await page.locator('#tdm-startbtn').click();
    // Minimal observation clock with the collector's capped frame delta (src/loop.js caps at 50 ms).
    await page.evaluate(async () => {
      const { player } = await import('/src/entities/player.js');
      const { camera } = await import('/src/scene.js');
      let sim = 0, last = null;
      const frame = () => { const now = performance.now(); if (last !== null) sim += Math.min((now - last) / 1000, .05); last = now; requestAnimationFrame(frame); };
      window.__movingSim = () => sim;
      window.__movingRead = () => ({ wallMs: performance.now(), simSeconds: sim, eye: camera.position.toArray(),
        hp: player.hp, energy: player.energy, dead: player.dead, mixerTime: null });
      requestAnimationFrame(frame);
    });
    await page.keyboard.press('KeyV');

    // 1. Data agreement: the live page arrays against the Node-loaded definition.
    const pageMap = await page.evaluate(async () => {
      const map = await import('/src/map.js');
      return { tiles: map.MAP.map(row => [...row]), heightmap: map.HMAP.map(row => [...row]), width: map.MAP_W, height: map.MAP_H };
    });
    const tiles = compareCells('tiles', bunkerData.tiles, pageMap.tiles);
    const heightmap = compareCells('heightmap', bunkerData.heightmap, pageMap.heightmap);
    record.dataAgreement = tiles.mismatches === 0 && heightmap.mismatches === 0
      && pageMap.width === bunkerData.width && pageMap.height === bunkerData.height;
    record.dataComparison = { tiles, heightmap, width: [bunkerData.width, pageMap.width], height: [bunkerData.height, pageMap.height] };

    // 2. Fixture (control only): direct placement on the recorded geometry; every other pool actor parked.
    await page.waitForFunction(() => window.__movingSim() > 1);
    record.fixture = await page.evaluate(async ({ player0, hostile0 }) => {
      const { enemies } = await import('/src/entities/enemies.js');
      const { camera } = await import('/src/scene.js');
      const hostile = enemies.filter(e => e.sndTeam !== 'friend');
      const chosen = hostile[0];
      for (const e of enemies) {
        if (e === chosen) continue;
        e.dead = true; if (e.mesh) e.mesh.visible = false;
      }
      chosen.dead = false; chosen.x = hostile0.x; chosen.z = hostile0.z; chosen.state = 'patrol'; chosen.alertTimer = 0;
      chosen.hp = 70; chosen.path = [];
      camera.position.x = player0.x; camera.position.z = player0.z;
      return { hostiles: hostile.length, parked: enemies.length - 1, eye: camera.position.toArray() };
    }, { player0: PLAYER_START, hostile0: HOSTILE_START });

    // The real driver, then the approach exactly as the collector starts it.
    await installCombatDriver(page);
    await page.evaluate(() => window.__combatDriverDispose());
    const beginSim = await page.evaluate(() => window.__movingSim());
    await page.evaluate(() => window.__combatDriverApproach());
    const samples = [], kinds = new Set();
    const begin = Date.now();
    let best = 0, minDistance = Infinity, reached = false, died = false;
    for (;;) {
      const s = await page.evaluate(async () => {
        const { enemies } = await import('/src/entities/enemies.js');
        const { camera } = await import('/src/scene.js');
        const { player } = await import('/src/entities/player.js');
        const { groundElevation } = await import('/src/map.js');
        const { hasLOS } = await import('/src/utils/los.js');
        const h = enemies.filter(e => e.sndTeam !== 'friend' && !e.dead)[0];
        const progress = window.__combatDriverProgress();
        return { sim: window.__movingSim(), x: camera.position.x, z: camera.position.z, dead: player.dead,
          hostile: h ? { x: h.x, z: h.z, state: h.state,
            los: hasLOS(camera.position.x, camera.position.y, camera.position.z, h.x, groundElevation(h.x, h.z) + .99, h.z) } : null,
          kind: progress.at(-1)?.step?.kind ?? null };
      });
      samples.push(s);
      if (s.kind) kinds.add(s.kind);
      best = Math.max(best, Math.hypot(s.x - PLAYER_START.x, s.z - PLAYER_START.z));
      if (s.hostile) {
        const distance = Math.hypot(s.hostile.x - s.x, s.hostile.z - s.z);
        minDistance = Math.min(minDistance, distance);
        if (distance <= ENGAGEMENT_RANGE_M && s.hostile.los === true) reached = true;
      }
      if (s.dead) died = true;
      if (reached && best > MIN_DISPLACEMENT_M) break;
      if (died || s.sim - beginSim >= SIM_SECONDS_LIMIT || Date.now() - begin >= WALL_LIMIT_MS) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const trace = await page.evaluate(() => window.__combatDriverTrace());
    await page.evaluate(() => window.__combatDriverDispose());
    Object.assign(record, { displacementM: best, minHostileDistanceM: Number.isFinite(minDistance) ? minDistance : null,
      reachedEngagementRange: reached, stepKinds: [...kinds], playerDied: died,
      stallClassifications: { final: classifyStall(trace), traceSamples: trace.length },
      simSeconds: samples.at(-1).sim - beginSim, wallMs: Date.now() - begin, pageErrors });
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
  record.totalWallMs = Date.now() - started;
  record.pass = record.dataAgreement === true && record.reachedEngagementRange === true && record.displacementM > MIN_DISPLACEMENT_M;
  await fs.writeFile(path.join(CONTROL_DIRECTORY, 'fixture-control.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runControl().then(record => {
    console.log(JSON.stringify({ label: record.label, pass: record.pass, dataAgreement: record.dataAgreement,
      reachedEngagementRange: record.reachedEngagementRange, displacementM: record.displacementM, stepKinds: record.stepKinds,
      simSeconds: record.simSeconds, wallMs: record.wallMs }));
    process.exitCode = record.pass ? 0 : 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
