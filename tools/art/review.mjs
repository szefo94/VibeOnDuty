import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ownedReviewPort } from './owned-review-port.mjs';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT, CACHE, hash, iterationPath } from './pipeline.mjs';
import { producerContract, candidateLineage } from './animation-budget-v2.mjs';
import { MANIFEST_PATH, verifyRuntimeDependencies } from './runtime-dependencies.mjs';
import { ACCEPTANCE_PATH, TUPLE_PATHS, assertNoMotionTransaction } from './motion-acceptance.mjs';
import * as paired from './animation-budget-paired.mjs';

// This owns a loopback-only Vite server and separate browser contexts. It never connects
// to multiplayer or adds a production debug/mutation API. Only the model GET is routed.
export async function reviewIteration(directory, candidates) {
  await iterationPath([CACHE], directory);
  for (const filename of Object.values(candidates)) await iterationPath([directory], filename);
  const port = await reviewPort();
  const server = await createServer({ root: ROOT, base: '/',
    cacheDir: path.join(directory, 'vite-cache'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  let browser;
  const frames = {};
  try {
    await server.listen(port);
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}/`;
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    for (const [label, candidate] of Object.entries(candidates)) {
      const bytes = await fs.readFile(candidate);
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 },
        deviceScaleFactor: 1, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => {
          // Test-only deterministic observation: freeze render ticks; sample the normal
          // player mixer directly after entering the real Training Range.
          window.requestAnimationFrame = () => 0;
          let seed = 67245;
          Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296; };
          HTMLCanvasElement.prototype.requestPointerLock = () => {};
          localStorage.setItem('vod_graphics_quality_v1', 'medium');
        });
        const page = await context.newPage();
        page.setDefaultTimeout(45000);
        let requests = 0;
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/models/enemy.glb', async (route) => {
          const method = route.request().method();
          if (!['GET', 'HEAD'].includes(method)) {
            errors.push('Unexpected model request method: ' + method);
            await route.abort(); return;
          }
          if (method === 'GET') requests++;
          await route.fulfill({ status: 200, contentType: 'model/gltf-binary',
            headers: { 'content-length': String(bytes.length) }, body: method === 'HEAD' ? '' : bytes });
        });
        await page.goto(url);
        await page.locator('#range-startbtn').waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.getElementById('range-startbtn').disabled);
        await page.locator('#range-startbtn').click();
        const result = await page.evaluate(async () => {
          const src = new URL('src/', location.href).href;
          const g = await import(src + 'builders/enemyGLTF.js');
          const { playerBody } = await import(src + 'builders/playerBody.js');
          const { scene, camera, renderer } = await import(src + 'scene.js');
          const { renderComicScene } = await import(src + 'comicOutline.js');
          const { wpn, weapon3p } = await import(src + 'builders/weapon.js');
          const { getMode } = await import(src + 'modes/modeManager.js');
          const { PLAYER_H } = await import(src + 'config.js');
          const T = window.__THREE;
          if (getMode()?.name !== 'range' || !g.playerMesh?.getObjectByName('HumanBody'))
            throw Error('Real game human/Training Range not ready');
          playerBody.visible = false; g.playerMesh.visible = true;
          g.playerMesh.position.set(camera.position.x, camera.position.y - PLAYER_H, camera.position.z);
          g.playerMesh.rotation.set(0, 0, 0);
          g.playerMixer.stopAllAction(); g.playerMixer.setTime(0);
          g.playerActions.idle.reset().setEffectiveWeight(1).play(); g.playerMixer.update(0.4);
          wpn.visible = false; weapon3p.visible = true;
          scene.updateMatrixWorld(true);
          const head = g.playerMesh.getObjectByName('Head').getWorldPosition(new T.Vector3());
          const cameraPosition = [head.x + 0.62, head.y + 0.04, head.z + 1.05];
          const target = [head.x, head.y - 0.055, head.z];
          camera.position.fromArray(cameraPosition); camera.fov = 24;
          camera.lookAt(...target); camera.updateProjectionMatrix();
          renderer.setPixelRatio(1); renderer.setSize(1280, 960);
          renderComicScene(renderer, scene, camera);
          const gl = renderer.getContext();
          const frame = new Uint8Array(1280 * 960 * 4);
          gl.readPixels(0, 0, 1280, 960, gl.RGBA, gl.UNSIGNED_BYTE, frame);
          // Hash later in Node, but retain unambiguous raw RGBA identity from this render.
          let raw = '';
          for (let at = 0; at < frame.length; at += 32768)
            raw += String.fromCharCode(...frame.subarray(at, at + 32768));
          const lights = [];
          scene.traverse((n) => { if (n.isLight) lights.push({ type: n.type,
            color: n.color.toArray(), intensity: n.intensity, position: n.position.toArray() }); });
          return { image: renderer.domElement.toDataURL('image/png'), rgba: btoa(raw),
            mode: getMode().name, pose: { action: 'idle', time: 0.4 },
            camera: { position: cameraPosition, target, fov: camera.fov }, lights,
            viewport: [1280, 960], dpr: 1, exposure: renderer.toneMappingExposure,
            renderer: gl.getParameter(gl.RENDERER), human: true,
            mount: weapon3p.parent.name, panels: [-1, 1].map((sign) =>
              !!g.playerMesh.getObjectByName('HelmetSidePanel' + sign)) };
        });
        assert.equal(requests, 1, 'Candidate must enter through one normal game model GET');
        assert.deepEqual(errors, []);
        assert.equal(result.mount, 'hand_r');
        assert.deepEqual(result.panels, [true, true]);
        const imageBytes = Buffer.from(result.image.split(',')[1], 'base64');
        const rgba = Buffer.from(result.rgba, 'base64');
        await fs.writeFile(path.join(directory, label + '-game.png'), imageBytes);
        delete result.image; delete result.rgba;
        frames[label] = { ...result, modelHash: hash(bytes), imageHash: hash(imageBytes),
          pixelHash: hash(rgba), routedRequests: requests, image: label + '-game.png' };
      } finally { await context.close(); }
    }
    for (const label of ['changed', 'restored'])
      for (const field of ['pose', 'camera', 'lights', 'viewport', 'dpr', 'exposure'])
        assert.deepEqual(frames[label][field], frames.before[field], 'Matched ' + field);
    assert.notEqual(frames.before.pixelHash, frames.changed.pixelHash, 'Changed area must render differently');
    assert.equal(frames.before.pixelHash, frames.restored.pixelHash, 'Restored game appearance must match');
    const report = { frames, matched: true, changedVisible: true, restoredPixelsEqual: true,
      meaning: 'Actual game loader/player rig in Training Range; static matched render using normal scene, lighting and selective ink. SwiftShader is not device/FPS qualification.' };
    await fs.writeFile(path.join(directory, 'review.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

// Static samples use the real scene/rig/mount and prepared aliases. RAF is held only
// in this owned offline browser, so camera/pose/light comparisons are reproducible.
// Timings below measure warmed animation + comic render + GPU completion, not play FPS.
export async function captureGameplay() {
  const directory = path.join(CACHE, 'final-review');
  await iterationPath([CACHE], directory);
  await fs.mkdir(directory, { recursive: true });
  const port = await reviewPort();
  const server = await createServer({ root: ROOT, base: '/',
    cacheDir: path.join(directory, 'vite-cache'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  let browser;
  const frames = [], measurements = [];
  const identities = {};
  for (const name of ['public/models/enemy.glb', 'public/textures/comic-slice.png',
    'tools/art/sources/soldier.blend', 'tools/art/character-params.json',
    'tools/art/build_soldier.py', 'tools/art/review.mjs'])
    identities[name] = hash(await fs.readFile(path.join(ROOT, name)));
  const revision = (await promisify(execFile)('git', ['rev-parse', 'HEAD'],
    { cwd: ROOT, windowsHide: true })).stdout.trim();
  try {
    await server.listen(port);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    for (const map of ['range', 'bunker']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
      try {
        await context.addInitScript(() => {
          window.requestAnimationFrame = () => 0;
          HTMLCanvasElement.prototype.requestPointerLock = () => {};
          let seed = 67245;
          Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
          localStorage.setItem('vod_graphics_quality_v1', 'medium');
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.setDefaultTimeout(45000);
        await page.goto(url);
        try {
          await page.waitForFunction(() => !document.getElementById('range-startbtn').disabled, null, { polling: 100 });
        } catch (error) {
          await page.screenshot({ path: path.join(directory, 'load-failure.png') });
          throw Error('Game assets did not settle: ' + JSON.stringify(errors) + ' ' + error.message);
        }
        if (map === 'bunker') await page.locator('.map-card[data-map="bunker"]').click();
        await page.locator(map === 'range' ? '#range-startbtn' : '#tdm-startbtn').click();
        await page.evaluate(async () => {
          const src = new URL('src/', location.href).href;
          const g = await import(src + 'builders/enemyGLTF.js');
          const { playerBody } = await import(src + 'builders/playerBody.js');
          const { scene, camera, renderer } = await import(src + 'scene.js');
          const ink = await import(src + 'comicOutline.js');
          const quality = await import(src + 'graphicsQuality.js');
          const { wpn, weapon3p } = await import(src + 'builders/weapon.js');
          const { PLAYER_H } = await import(src + 'config.js');
          const { sunLight } = await import(src + 'lighting.js');
          const { enemies } = await import(src + 'entities/enemies.js');
          const eye = camera.position.clone();
          g.playerMesh.position.set(eye.x, eye.y - PLAYER_H, eye.z);
          g.playerMesh.rotation.set(0, 0, 0); playerBody.visible = false;
          g.playerMesh.visible = true;
          for (const enemy of enemies) if (enemy.mesh) enemy.mesh.visible = false;
          const originalSun = sunLight.intensity;
          window.__artReview = { g, playerBody, scene, camera, renderer, ink, quality,
            wpn, weapon3p, eye, sunLight, originalSun, T: window.__THREE };
          if (!g.playerMesh.getObjectByName('HumanBody')) throw Error('Actual human missing');
        });
        const poses = [['idle', 0.4], ['walk', 0.35], ['run', 0.25],
          ['walk_back', 0.35], ['run_back', 0.25], ['strafe_l', 0.35], ['strafe_r', 0.35],
          ['crouch', 0.4], ['crouch_walk', 0.35], ['jump_start', 0.15],
          ['jump_loop', 0.3], ['jump_land', 0.15], ['reload', 0.65], ['nade', 0.4],
          ['punch_cross', 0.25], ['punch_jab', 0.2], ['death', 0.75], ['roll', 0.4]];
        const specs = [];
        if (map === 'range') {
          for (const [pose, time] of poses) specs.push({ pose, time, view: 'armed', tier: 'medium', light: 'range-ambient' });
          for (const tier of ['low', 'medium', 'high'])
            for (const view of ['face-front', 'face-three-quarter', 'hands', 'first-person'])
              specs.push({ pose: 'idle', time: 0.4, view, tier, light: 'range-ambient' });
        } else {
          for (const tier of ['low', 'medium', 'high'])
            for (const light of ['daylight', 'shadow'])
              for (const view of ['teams-near', 'teams-far', 'columns'])
                specs.push({ pose: 'idle', time: 0.4, view, tier, light });
          for (const [pose, time] of [['walk', 0.35], ['crouch', 0.4], ['jump_loop', 0.3], ['death', 0.75]])
            specs.push({ pose, time, view: 'teams-near', tier: 'medium', light: 'daylight' });
          for (const tier of ['low', 'medium', 'high'])
            for (const light of ['daylight', 'shadow'])
              specs.push({ pose: 'idle', time: 0.4, view: 'first-person', tier, light });
        }
        for (const spec of specs) {
          const result = await page.evaluate(async (spec) => {
            const r = window.__artReview;
            const { g, playerBody, scene, camera, renderer, ink, quality, wpn, weapon3p, T } = r;
            quality.setGraphicsQuality(spec.tier); quality.applyGraphicsQuality(renderer, 1);
            renderer.setSize(1280, 960);
            r.sunLight.intensity = spec.light === 'shadow' ? 0 : r.originalSun;
            g.playerMixer.stopAllAction(); g.playerMixer.setTime(0);
            const action = g.playerActions[spec.pose];
            if (!action) throw Error('Missing actual prepared alias ' + spec.pose);
            action.reset().setEffectiveWeight(1).play(); g.playerMixer.update(spec.time);
            playerBody.visible = false;
            g.playerMesh.visible = spec.view !== 'first-person';
            weapon3p.visible = !['nade', 'punch_cross', 'punch_jab', 'death'].includes(spec.pose);
            wpn.visible = spec.view === 'first-person';
            const clones = [];
            if (spec.view.startsWith('teams')) {
              g.playerMesh.visible = false;
              for (const [i, color] of [0x4488ff, 0xff5555].entries()) {
                const actor = g.buildEnemyMesh(r.eye.x + (i ? 0.65 : -0.65), r.eye.z);
                actor.mesh.position.y = g.playerMesh.position.y;
                actor.mesh.rotation.y = 0;
                actor.mixer.stopAllAction(); actor.mixer.setTime(0);
                actor.actions[spec.pose].reset().setEffectiveWeight(1).play(); actor.mixer.update(spec.time);
                const mount = actor.mesh.getObjectByName('enemyWeaponMount');
                if (mount) mount.visible = weapon3p.visible;
                g.tintEnemyMesh(actor.mesh, color); scene.add(actor.mesh); clones.push(actor);
              }
            }
            scene.updateMatrixWorld(true);
            const head = g.playerMesh.getObjectByName('Head').getWorldPosition(new T.Vector3());
            const base = g.playerMesh.position.clone();
            let target = [base.x, base.y + 0.95, base.z], position = [base.x + 1.3, base.y + 1.1, base.z + 3.2], fov = 44;
            if (spec.view === 'face-front') { target = [head.x, head.y - 0.04, head.z]; position = [head.x, head.y, head.z + 2.5]; fov = 14; }
            if (spec.view === 'face-three-quarter') { target = [head.x, head.y - 0.06, head.z]; position = [head.x + 1.4, head.y, head.z + 2.1]; fov = 14; }
            if (spec.view === 'hands') { target = [base.x, base.y + 1.28, base.z + 0.25]; position = [base.x + 2.2, base.y + 1.35, base.z + 2]; fov = 18; }
            if (spec.view === 'first-person') { position = r.eye.toArray(); target = [r.eye.x, r.eye.y, r.eye.z - 5]; fov = 75; }
            if (spec.view === 'teams-near') { position = [base.x, base.y + 1.25, base.z + 4]; fov = 45; }
            if (spec.view === 'teams-far') { position = [base.x, base.y + 1.6, base.z + 15]; fov = 60; }
            if (spec.view === 'columns') { position = [34, 3.2, 36]; target = [46, 2, 40]; fov = 75; g.playerMesh.visible = false; }
            camera.position.fromArray(position); camera.fov = fov; camera.lookAt(...target); camera.updateProjectionMatrix();
            renderer.info.autoReset = false; renderer.info.reset();
            ink.renderComicScene(renderer, scene, camera);
            const costs = { ...renderer.info.render, ...renderer.info.memory, programs: renderer.info.programs.length };
            const image = renderer.domElement.toDataURL('image/png');
            const lights = [];
            scene.traverse((n) => { if (n.isLight) lights.push({ type: n.type, color: n.color.toArray(), intensity: n.intensity, position: n.position.toArray() }); });
            const data = { image, camera: { position, target, fov }, exposure: renderer.toneMappingExposure, lights,
              keyLightIntensity: r.sunLight.intensity, shadows: renderer.shadowMap.enabled,
              actorCount: clones.length || (g.playerMesh.visible ? 1 : 0), mount: weapon3p.parent.name,
              clip: action.getClip().name, costs, fallbackVisible: playerBody.visible,
              eyeDistance: camera.position.distanceTo(base) };
            for (const actor of clones) g.disposeEnemyMesh(actor.mesh, actor.mixer);
            return data;
          }, spec);
          const bytes = Buffer.from(result.image.split(',')[1], 'base64'); delete result.image;
          const filename = `${map}-${spec.tier}-${spec.light}-${spec.view}-${spec.pose}.png`;
          await fs.writeFile(path.join(directory, filename), bytes);
          frames.push({ ...spec, map, ...result, image: filename, sha256: hash(bytes), dimensions: [1280, 960], dpr: 1 });
        }
        if (map === 'bunker') {
          for (const tier of ['low', 'medium', 'high']) {
            const sample = await page.evaluate(async (tier) => {
              const r = window.__artReview, { g, renderer, scene, camera, ink, quality, playerBody } = r;
              quality.setGraphicsQuality(tier); quality.applyGraphicsQuality(renderer, 1);
              r.sunLight.intensity = r.originalSun; playerBody.visible = false; g.playerMesh.visible = true; r.wpn.visible = false; r.weapon3p.visible = true;
              g.playerMixer.stopAllAction(); g.playerActions.walk.reset().setEffectiveWeight(1).play();
              camera.position.set(g.playerMesh.position.x + 1.3, g.playerMesh.position.y + 1.1, g.playerMesh.position.z + 3.2);
              camera.fov = 44; camera.lookAt(g.playerMesh.position.x, g.playerMesh.position.y + 0.95, g.playerMesh.position.z); camera.updateProjectionMatrix();
              const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
              const tick = () => { const t = performance.now(); g.playerMixer.update(1/60); renderer.info.reset();
                ink.renderComicScene(renderer, scene, camera); gl.finish(); return performance.now() - t; };
              for (let i = 0; i < 12; i++) tick();
              const start = performance.now(), times = [];
              for (let i = 0; i < 40; i++) times.push(tick());
              const durationMs = performance.now() - start;
              times.sort((a,b) => a-b);
              const samples = [];
              for (let i = 0; i < 6; i++) {
                const actor = g.buildEnemyMesh(g.playerMesh.position.x + 0.5, g.playerMesh.position.z);
                actor.mesh.position.y = g.playerMesh.position.y; scene.add(actor.mesh); actor.mixer.update(0.4);
                g.tintEnemyMesh(actor.mesh, i % 2 ? 0xff5555 : 0x4488ff);
                ink.renderComicScene(renderer, scene, camera); gl.finish();
                g.disposeEnemyMesh(actor.mesh, actor.mixer); tick();
                samples.push({ ...renderer.info.memory, programs: renderer.info.programs.length });
              }
              return { tier, frames: times.length, warmupFrames: 12, durationMs, medianMs: times[20], p95Ms: times[38],
                minMs: times[0], maxMs: times[39], viewport: [1280,960], dpr: 1, actorCount: 1,
                renderer: gl.getParameter(gl.RENDERER), gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
                calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                programs: renderer.info.programs.length, memory: { ...renderer.info.memory }, retirementSamples: samples,
                scope: 'Warmed actual scene + mixer + comic render + synchronous GPU finish in headless Chromium SwiftShader. No input/network/whole-game FPS or representative hardware certification.' };
            }, tier);
            assert.deepEqual(sample.retirementSamples.slice(3), Array(3).fill(sample.retirementSamples[2]), 'Warmed resource plateau');
            measurements.push(sample);
          }
        }
        assert.deepEqual(errors, []);
        console.log(`Completed ${map}: ${frames.length} cumulative full-pixel frames`);
      } finally { await context.close(); }
    }
    await composeReviewSheets(directory, frames, browser);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), revision, identities,
    frames, measurements, cleanup: 'owned browser and loopback server closed',
    lighting: 'Daylight = authored scene key; shadow comparison = key disabled, authored ambient/fill retained. Controlled shadow readability probe, not every natural occluder.',
    device: { os: process.platform, arch: process.arch, node: process.version,
      tested: 'Windows host, headless Chromium software WebGL only', unmeasured: ['phone', 'integrated GPU', 'Raspberry Pi', '60 FPS gameplay'] },
    humanAestheticAcceptance: 'pending' };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Captured ${frames.length} full-resolution actual-game frames and ${measurements.length} warmed tiers: ${directory}`);
  return report;
}

async function composeReviewSheets(directory, frames, browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const primary = [
      ['range', 'high', 'face-front', 'idle'], ['range', 'high', 'hands', 'idle'],
      ['range', 'medium', 'armed', 'crouch'], ['range', 'medium', 'armed', 'jump_loop'],
      ['bunker', 'high', 'first-person', 'idle'], ['bunker', 'high', 'teams-near', 'idle'],
      ['bunker', 'high', 'teams-far', 'idle'], ['bunker', 'high', 'columns', 'idle'],
    ].map(([map,tier,view,pose]) => frames.find((f) => f.map === map && f.tier === tier && f.view === view && f.pose === pose && f.light !== 'shadow'));
    const groups = [primary];
    for (let at = 0; at < frames.length; at += 8) groups.push(frames.slice(at, at + 8));
    for (const [index, group] of groups.entries()) {
      const items = await Promise.all(group.map(async (f) => ({ label: `${f.map} | ${f.tier} | ${f.light} | ${f.view} | ${f.pose}`,
        data: 'data:image/png;base64,' + (await fs.readFile(path.join(directory, f.image))).toString('base64') })));
      const data = await page.evaluate(async (items) => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = Math.ceil(items.length / 2) * 512;
        const c = canvas.getContext('2d'); c.fillStyle = '#10141c'; c.fillRect(0,0,canvas.width,canvas.height);
        for (const [i,item] of items.entries()) {
          const img = new Image(); img.src = item.data; await img.decode();
          const x = (i%2)*640, y = Math.floor(i/2)*512;
          c.drawImage(img,x,y+32,640,480); c.fillStyle = '#ffffff'; c.font = '16px monospace'; c.fillText(item.label,x+8,y+22);
        }
        return canvas.toDataURL('image/png');
      }, items);
      await fs.writeFile(path.join(directory, index === 0 ? 'pose-sheet.png' : `review-sheet-${index}.png`), Buffer.from(data.split(',')[1], 'base64'));
    }
  } finally { await context.close(); }
}

async function reviewPort() {
  return ownedReviewPort();
}

const ANIMATION_EVIDENCE = path.join(ROOT,
  '.planning/phases/07-movement-matched-and-action-safe-animation/evidence');

export async function animationIdentities(read = filename => fs.readFile(filename)) {
  assertNoMotionTransaction();
  const names = ['index.html', 'style.css', 'public/models/enemy.glb',
    'public/textures/comic-slice.png', 'tools/art/provenance.json', MANIFEST_PATH,
    'tools/art/sources/motion.blend',
    'tools/art/sources/soldier.blend', 'tools/art/character-params.json', 'tools/art/build_soldier.py'];
  async function collect(directory) {
    for (const entry of await fs.readdir(path.join(ROOT, directory), { withFileTypes: true })) {
      const name = directory + '/' + entry.name;
      if (entry.isDirectory()) await collect(name);
      else if (entry.name.endsWith('.js')) names.push(name);
    }
  }
  await collect('src');
  try { await fs.access(path.join(ROOT, ACCEPTANCE_PATH)); names.push(ACCEPTANCE_PATH); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const identities = {}, dependencyBytes = {};
  for (const name of names.sort()) {
    const bytes = await read(path.join(ROOT, name));
    identities[name] = hash(bytes);
    if (name === MANIFEST_PATH) dependencyBytes.manifestBytes = bytes;
    if (name === 'tools/art/provenance.json') dependencyBytes.provenanceBytes = bytes;
    for (const [key, file] of Object.entries(TUPLE_PATHS)) if (name === file) dependencyBytes[key] = bytes;
    if (name === ACCEPTANCE_PATH) dependencyBytes.acceptanceBytes = bytes;
  }
  verifyRuntimeDependencies(identities, dependencyBytes);
  // Re-read actual tuple after collection as well. A transaction that started and
  // completed between snapshots cannot make a historical snapshot current.
  verifyRuntimeDependencies(identities);
  assertNoMotionTransaction();
  identities.captureSampler = hash(sampleAnimationPage.toString());
  return identities;
}

// Controlled moving playback in the loaded current game. Hold only this browser's
// offline game RAF; use the retained native RAF for paced, continuous rendered samples.
// This measures animation + actual scene rendering, not input/network/gameplay FPS.
async function sampleAnimationPage(page, specification) {
  return page.evaluate(async ({ tier, actorCount, captureFrames, failAt, candidate, renderedView }) => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const a = await import(src + 'builders/enemyAnimations.js');
    const fp = candidate ? await import(src + 'builders/firstPersonRig.js') : null;
    const handling = candidate ? await import(src + 'builders/weaponHandling.js') : null;
    const resources = candidate ? await import(src + 'builders/characterResources.js') : null;
    const { scene, camera, renderer } = await import(src + 'scene.js');
    const { playerBody } = await import(src + 'builders/playerBody.js');
    const { wpn, weapon3p } = await import(src + 'builders/weapon.js');
    const ink = await import(src + 'comicOutline.js');
    const quality = await import(src + 'graphicsQuality.js');
    const { getMode } = await import(src + 'modes/modeManager.js');
    const T = window.__THREE;
    if (getMode()?.name !== 'range' || !g.playerMesh?.getObjectByName('HumanBody'))
      throw Error('Actual enabled Training Range human missing');
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      fov: camera.fov, tier: quality.getGraphicsQuality(), autoReset: renderer.info.autoReset };
    const borrowed = [g.playerMesh, playerBody, wpn, weapon3p].map(node => [node, node.visible]);
    const actors = [], shared = new Set(), maps = new Set(), ownedGeometry = new Set();
    let view = null;
    const viewDraws={arms:0,body:0,weapon:0},viewCallbacks=[];
    let viewEvidence=null;
    let sharedDisposals = 0, callbacks = 0, restored = false;
    const watches = [], sequence = [], poseSignatures = new Set(), resourceSamples = [];
    const timings = { frameIntervalMs: [], mixerMs: [], inertiaMs: [], correctionMs: [], renderMs: [] };
    if(candidate)for(const name of ['selectionMs','coreCorrectionMs','viewMs'])timings[name]=[];
    const transitions = [ ['idle', 0.4], ['walk', 1.2], ['walk_back', 1.1],
      ['strafe_l', 1.0], ['strafe_r', 1.0], ['run', 1.1], ['crouch', 0.5],
      ['crouch_walk', 1.1], ['jump_start', 0.2], ['jump_loop', 0.7],
      ['jump_land', 0.2], ['reload', 1.8], ['idle', 0.4] ];
    const dt = 1 / 20;
    const costs = () => ({ ...renderer.info.memory, programs: renderer.info.programs.length });
    const build = index => {
      const actor = g.buildEnemyMesh(saved.position.x + (index % 4 - 1.5) * 0.75,
        saved.position.z + Math.floor(index / 4) * 0.8);
      if (!actor?.mesh.getObjectByName('HumanBody')) throw Error('Real cloned human missing');
      actor.mesh.position.y = saved.position.y - 1.7;
      actor._bones = [];
      actor.mesh.traverse(node => { if (node.isBone) actor._bones.push(node); });
      actor.currentClip = 'idle'; actor.mesh.rotation.y = 0;
      scene.add(actor.mesh); return actor;
    };
    const render = () => { renderer.info.reset();
      if(renderedView&&view?.weapon)fp.renderFirstPersonRig(view,{weapon:wpn,firstPerson:true,active:true},()=>ink.renderComicScene(renderer,scene,camera));
      else ink.renderComicScene(renderer, scene, camera);
      renderer.getContext().finish(); };
    const watchView=()=>{if(!renderedView||viewCallbacks.length||!view?.weapon)return;
      for(const [kind,root]of [['arms',view.arms],['body',view.body],['weapon',view.weapon]])root.traverse(node=>{
        if(!node.isMesh)return;const original=node.onBeforeRender;
        node.onBeforeRender=function(...args){const geometry=args[3],material=args[4],group=args[5];
          if(args[2]===camera&&material.visible!==false&&material.colorWrite!==false&&material.opacity>0&&
            (group?.count??geometry.index?.count??geometry.attributes.position.count)>0)viewDraws[kind]++;
          original.apply(this,args);};
        viewCallbacks.push([node,original]);
      });
    };
    let failure, keeperIntact = false, packedMaps = 0, ownership, afterRetirement;
    const wallStart = performance.now();
    try {
      for (const [node] of borrowed) node.visible = false;
      quality.setGraphicsQuality(tier); quality.applyGraphicsQuality(renderer, 1);
      renderer.setSize(1280, 960); renderer.info.autoReset = false;
      camera.position.set(saved.position.x + 2.4, saved.position.y + 0.3, saved.position.z + 5);
      camera.fov = 44; camera.lookAt(saved.position.x, saved.position.y - 0.65, saved.position.z);
      camera.updateProjectionMatrix();
      for (let i = 0; i < actorCount; i++) actors.push(build(i));
      if (candidate) {
        view = fp.createFirstPersonRig({ source: actors[0].mesh });
        scene.add(view.arms, view.body);
        if(renderedView) {
          camera.position.copy(actors[0].mesh.position).add(new T.Vector3(0,1.65,0));
          camera.quaternion.setFromEuler(new T.Euler(-1.3,Math.PI,0,'YXZ'));
          camera.fov=75;camera.updateProjectionMatrix();
          a.tickPresentation(actors[0],{identity:'0',generation:'candidate',sampleTimeSeconds:0,
            position:{x:0,y:1.65,z:0},bodyYaw:-Math.PI,aimYaw:-Math.PI,pitch:-1.1,weapon:'m4',alive:true,onGround:true,
            action:{kind:'ready'}},1/20);
          const sourceRoot=actors[0].mesh.getObjectByName('enemyWeaponMount')?.children[0];
          fp.updateFirstPersonRig(view,{pose:actors[0].presentation,camera,weapon:wpn,thirdPerson:false,
            rawCorrections:handling.getWeaponHandling(sourceRoot)?.corrections??[]});watchView();
        }
      }
      actors[0].mesh.traverse(node => {
        if (node.isSkinnedMesh) shared.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          for (const texture of [material?.map, material?.normalMap]) if (texture) maps.add(texture);
      });
      for (const resource of [...shared, ...maps]) {
        const listener = () => sharedDisposals++;
        resource.addEventListener('dispose', listener); watches.push([resource, listener]);
      }
      packedMaps = [...maps].filter(map => map.image?.width > 0).length;
      if (!packedMaps) throw Error('Normal packed map decoding missing');
      for (const actor of actors) actor.mesh.traverse(node => {
        if (node.geometry && !shared.has(node.geometry)) ownedGeometry.add(node.geometry);
      });
      // Warm deterministic clone/ink programs, retaining all measured actors as keepers.
      for (let cycle = 0; cycle < 8; cycle++) {
        const temporary = build(actorCount);
        g.tintEnemyMesh(temporary.mesh, cycle % 2 ? 0xff5555 : 0x4488ff);
        temporary.mixer.update(0.2); render();
        g.disposeEnemyMesh(temporary.mesh, temporary.mixer); render();
        resourceSamples.push(costs());
      }
      keeperIntact = actors.every(actor => {
        let intact = true;
        actor.mesh.traverse(node => { if (node.isSkinnedMesh)
          intact &&= node.geometry.attributes.position.count > 0 &&
            (renderedView&&actor===actors[0]&&!node.skeleton.boneTexture
              ? node.skeleton.bones.length===65&&node.skeleton.boneInverses.length===65
              : node.skeleton.boneTexture?.image?.data.length > 0); });
        return intact;
      });
      for (let i = 0; i < 12; i++) { for (const actor of actors) actor.mixer.update(dt); render(); }
      // Record media in a separate playback so PNG encoding cannot skew repeat dispersion.
      for (const mediaPass of captureFrames ? [false, true] : [false]) {
      for (const actor of actors) {
        actor.mixer.stopAllAction(); actor.mixer.setTime(0);
        actor.currentClip = null; actor._inLocoMode = false;
      }
      let previous = performance.now(), frame = 0;
      const path = actors.map(() => ({ x: 0, z: 0 }));
      for (const [clip, seconds] of transitions) {
        for (let step = 0; step < Math.ceil(seconds / dt); step++) {
          callbacks++;
          await new Promise(resolve => window.__baselineRaf(() => { callbacks--; resolve(); }));
          const begin = performance.now();
          let start = begin;
          if (candidate) {
            let mixerMs=0,inertiaMs=0,correctionMs=0,selectionMs=0,coreCorrectionMs=0;
            for (const [index, actor] of actors.entries()) {
              const speed = clip === 'run' ? 9 : ['walk','walk_back','strafe_l','strafe_r'].includes(clip) ? 6 : clip === 'crouch_walk' ? 4.32 : 0;
              const facing=renderedView?-1:1;
              path[index].x += facing*(clip === 'strafe_l' ? -1 : clip === 'strafe_r' ? 1 : 0)*speed*dt;
              path[index].z += facing*(clip === 'walk_back' ? 1 : ['walk','run','crouch_walk'].includes(clip) ? -1 : 0)*speed*dt;
              const prepared=performance.now();
              a.tickPresentation(actor,{identity:String(index),generation:'candidate',sampleTimeSeconds:frame*dt,
                position:{x:path[index].x,y:1.65,z:path[index].z},bodyYaw:renderedView?-Math.PI:0,aimYaw:renderedView?-Math.PI:0,pitch:renderedView?-1.1:0,alive:true,
                crouching:clip.startsWith('crouch'),onGround:!['jump_start','jump_loop'].includes(clip),
                verticalVelocity:clip==='jump_start'?5:0,sprinting:clip==='run',weapon:'m4',
                action:clip==='reload'?{kind:'reload',total:1.8,remaining:Math.max(0,1.8-step*dt)}:{kind:'ready'}},dt,false);
              const selected=performance.now()-prepared;correctionMs+=selected;selectionMs+=selected;
              const costs={};a.finishPresentation(actor,dt,costs);
              mixerMs+=costs.mixerMs;inertiaMs+=costs.inertiaMs;correctionMs+=costs.correctionMs;
              coreCorrectionMs+=costs.correctionMs;
            }
            const fitted=performance.now();
            const eyeHeight=actors[0].presentation.crouching ? .85 : 1.65;
            if(renderedView)camera.position.copy(actors[0].mesh.position).add(new T.Vector3(0,eyeHeight,0));
            const root=actors[0].mesh.getObjectByName('enemyWeaponMount')?.children[0];
            const sourceHandling=handling.getWeaponHandling(root);
            fp.updateFirstPersonRig(view,{pose:actors[0].presentation,camera,weapon:wpn,thirdPerson:!renderedView,dt,eyeHeight,
              spineQuaternion:actors[0]._presentationCorrection?.get(actors[0].mesh.getObjectByName('spine_03')),
              rawCorrections:sourceHandling?.corrections??[]});
            watchView();const viewMs=performance.now()-fitted;correctionMs+=viewMs;
            if(!mediaPass){timings.mixerMs.push(mixerMs);timings.inertiaMs.push(inertiaMs);timings.correctionMs.push(correctionMs);
              timings.selectionMs.push(selectionMs);timings.coreCorrectionMs.push(coreCorrectionMs);timings.viewMs.push(viewMs);}
          } else {
          for (const actor of actors) {
            if (['idle', 'walk', 'run', 'strafe_l', 'strafe_r'].includes(clip)) {
              a.enterLocoMode(actor);
              a.setLocoWeights(actor.actions, clip === 'idle' ? 0 : clip === 'run' ? 1 : 0.45,
                clip === 'strafe_l' ? -1 : clip === 'strafe_r' ? 1 : 0);
            } else {
              a.exitLocoMode(actor); a.crossfade(actor, clip, 0.2);
              if (['reload', 'jump_start', 'jump_land'].includes(clip))
                a.fitActionDuration(actor.actions[clip], seconds);
            }
          }
          if (!mediaPass) timings.correctionMs.push(performance.now() - start);
          start = performance.now();
          for (const actor of actors) actor.mixer.update(dt);
          if (!mediaPass) timings.mixerMs.push(performance.now() - start);
          start = performance.now();
          for (const actor of actors) a.tickInertia(actor, dt);
          if (!mediaPass) timings.inertiaMs.push(performance.now() - start);
          }
          start = performance.now(); render();
          if (!mediaPass) timings.renderMs.push(performance.now() - start);
          const end = performance.now();
          if (!mediaPass) timings.frameIntervalMs.push(end - previous);
          const bone = actors[0].mesh.getObjectByName('calf_l') || actors[0]._bones.at(-1);
          poseSignatures.add(bone.quaternion.toArray().map(n => n.toFixed(4)).join(','));
          if (mediaPass) sequence.push({ frame, clip, simulationTime: frame * dt,
            image: renderer.domElement.toDataURL('image/png') });
          if(renderedView&&[0,100,180].includes(frame)) {
            const reachesScene=root=>{for(let node=root;node;node=node.parent)if(node===scene)return true;return false;};
            const skeletons=new Set();for(const root of [view.arms,view.body])root.traverse(node=>{if(node.skeleton)skeletons.add(node.skeleton);});
            viewEvidence={draws:{...viewDraws},attached:[view.arms,view.body,view.weapon].every(reachesScene),
              allocatedBoneTextures:[...skeletons].filter(s=>s.boneTexture?.image?.data.length>0).length,
              selectedVisibleMeshes:[view.arms,view.body].map(root=>{let count=0;root.traverse(n=>{if(n.isMesh&&n.visible&&n.geometry.userData.selectedTriangles>0)count++;});return count;}),
              cameraEye:camera.position.toArray(),cameraPitch:-1.3,fov:camera.fov,drawCalls:renderer.info.render.calls};
            viewEvidence.sourceRoot=actors[0].mesh.position.toArray();
            viewEvidence.cameraYaw=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ').y;
            viewEvidence.eyeHeight=camera.position.y-actors[0].mesh.position.y;
            viewEvidence.sourceScale=actors[0].mesh.scale.toArray();
            viewEvidence.sourceActorCount=actors.length;viewEvidence.proxyEntityCount=1;
            viewEvidence.cameraColocatedXZ=camera.position.x===actors[0].mesh.position.x&&camera.position.z===actors[0].mesh.position.z;
            if(!viewEvidence.attached||viewEvidence.allocatedBoneTextures!==2||!Object.values(viewDraws).every(n=>n>0))throw Error('Essential view was not actually drawn');
            sequence.push({frame,clip,simulationTime:frame*dt,viewEvidence,image:renderer.domElement.toDataURL('image/png')});
          }
          // Exclude evidence encoding from the next measured frame interval in both repeats.
          previous = performance.now();
          frame++;
          if (failAt === 'render' && frame === 2) throw Error('Injected animation capture failure');
        }
      }
      }
      ownership = { sharedGeometries: shared.size, sharedMaps: maps.size,
        actorGeometries: ownedGeometry.size, actorSkeletons: actors.reduce((count, actor) => {
          const skeletons = new Set(); actor.mesh.traverse(n => { if (n.skeleton) skeletons.add(n.skeleton); });
          return count + skeletons.size;
        }, 0), actorMixers: actors.length, listeners: watches.length,
        mixerListeners: actors.reduce((count, actor) => count + Object.values(
          actor.mixer._listeners ?? {}).reduce((n, listeners) => n + listeners.length, 0), 0),
        callbacks, props: actors.filter(actor => actor.mesh.getObjectByName('enemyWeaponMount')).length };
      if(view) {
        const geometry=new Set(),skeletons=new Set(),textures=new Set(),materials=new Set();
        for(const root of [view.arms,view.body,view.weapon].filter(Boolean))root.traverse(node=>{
          if(node.geometry)geometry.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);
          for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){
            if(material.userData.characterOwned||material.userData._tinted)materials.add(material);
            for(const texture of [material.map,material.normalMap])if(texture)textures.add(texture);
          }
        });
        ownership.view={geometries:geometry.size,skeletons:skeletons.size,sharedMaps:textures.size,
          ownedMaterials:materials.size,mixers:0,sourceCallbacks:resources.inspectCharacterResources(actors[0].mesh).callbacks};
      }
    } catch (error) { failure = error.message; }
    finally {
      for(const [node,callback]of viewCallbacks)node.onBeforeRender=callback;
      if(view) fp.disposeFirstPersonRig(view);
      for (const actor of actors) g.disposeEnemyMesh(actor.mesh, actor.mixer);
      for (const [resource, listener] of watches) resource.removeEventListener('dispose', listener);
      afterRetirement = { listeners: watches.filter(([resource, listener]) =>
        resource.hasEventListener('dispose', listener)).length, callbacks,
        props: actors.filter(actor => actor.mesh.parent &&
          actor.mesh.getObjectByName('enemyWeaponMount')).length,
        actors: actors.filter(actor => actor.mesh.parent !== null).length,
        activeBindings: actors.reduce((count, actor) => count + actor.mixer.stats.bindings.inUse, 0),
        resources: costs() };
      camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion);
      camera.fov = saved.fov; camera.updateProjectionMatrix();
      for (const [node, visible] of borrowed) node.visible = visible;
      quality.setGraphicsQuality(saved.tier); quality.applyGraphicsQuality(renderer, 1);
      renderer.info.autoReset = saved.autoReset;
      restored = camera.position.equals(saved.position) && camera.quaternion.equals(saved.quaternion) &&
        borrowed.every(([node, visible]) => node.visible === visible);
    }
    const summarize = values => {
      const sorted = [...values].sort((x,y) => x-y);
      return { median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1], min: sorted[0], max: sorted.at(-1) };
    };
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { failure, restored, tier, actorCount, human: true, packedMaps,
      keeperIntact, sharedDisposals, movingPoseCount: poseSignatures.size, sequence,
      transitions: transitions.map(([clip]) => clip), timings: Object.fromEntries(
        Object.entries(timings).map(([name, values]) => [name, summarize(values)])),
      frameCount: timings.mixerMs.length, warmupFrames: 12, simulationStepSeconds: dt,
      durationMs: performance.now() - wallStart, viewport: [1280, 960], dpr: renderer.getPixelRatio(),
      renderer: gl.getParameter(gl.RENDERER), gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      renderScope:renderedView?'source-eye-down-view-replaces-source-0':'external-third-person-core',
      viewEvidence, resourceSamples, ownership, afterRetirement };
  }, specification);
}

export async function captureAnimationBaseline({ smoke = false, failAt, onOwner, onCleanup, signal, candidate = false, renderedView = candidate } = {}) {
  signal?.throwIfAborted();
  assert.ok(!failAt || failAt === 'render', 'Only bounded render failure injection is supported');
  const baseDirectory = path.join(CACHE, candidate ? 'animation-candidate' : smoke ? 'animation-smoke' : 'animation-baseline');
  const directory = path.join(baseDirectory, `capture-${Date.now()}-${process.pid}`);
  await iterationPath([CACHE], directory);
  await fs.mkdir(directory, { recursive: true });
  const reportPath = candidate ? path.join(baseDirectory,smoke?'07-09-view-smoke.json':'07-09-candidate.json') : smoke ? path.join(baseDirectory, 'report.json') : path.join(ANIMATION_EVIDENCE, '07-baseline.json');
  const identities = await animationIdentities(), start = Date.now();
  const revision = (await promisify(execFile)('git', ['-c', 'safe.directory=' + ROOT,
    'rev-parse', 'HEAD'], { cwd: ROOT, windowsHide: true })).stdout.trim();
  const port = await reviewPort();
  const server = await createServer({ root: ROOT, base: '/', cacheDir: path.join(directory, 'vite-cache'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  let browser;
  const samples = [], cleanup = { browserClosed: false, serverClosed: false };
  try {
    await server.listen(port);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    onOwner?.({ url, reportPath });
    signal?.throwIfAborted();
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    for (let run = 0; run < (smoke ? 1 : 2); run++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
      try {
        await context.addInitScript(() => {
          window.__baselineRaf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = () => 0;
          HTMLCanvasElement.prototype.requestPointerLock = () => {};
          let seed = 67245;
          Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        });
        const page = await context.newPage(), errors = [];
        const abort = () => { void page.close().catch(() => {}); };
        signal?.addEventListener('abort', abort, { once: true });
        context.once('close', () => signal?.removeEventListener('abort', abort));
        page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.waitForFunction(() => !document.getElementById('range-startbtn').disabled,
          null, { polling: 100 });
        await page.locator('#range-startbtn').click();
        for (const tier of smoke ? ['low'] : ['low', 'medium', 'high']) {
          for (const actorCount of smoke ? [1] : [1, 8]) {
            signal?.throwIfAborted();
            let timeout;
            let sample;
            try {
              sample = await Promise.race([
                sampleAnimationPage(page, { tier, actorCount, failAt, candidate, renderedView,
                  captureFrames: !candidate && run === 0 && tier === 'low' && actorCount === 1 }),
                new Promise((_resolve, reject) => {
                  timeout = setTimeout(() => reject(Error('Animation sample exceeded 180 seconds')), 180000);
                }),
              ]);
            } finally { clearTimeout(timeout); }
            assert.equal(sample.restored, true, 'Camera/borrowed visibility must restore even on failure');
            assert.ok(!sample.failure, sample.failure);
            assert.equal(sample.sharedDisposals, 0, 'Retirement must preserve shared geometry/maps');
            assert.equal(sample.keeperIntact, true);
            assert.ok(sample.movingPoseCount > 10, 'Real bones must move');
            for (const timing of Object.values(sample.timings))
              assert.ok(Number.isFinite(timing.median) && Number.isFinite(timing.p95), 'Finite timings');
            assert.equal(sample.afterRetirement.listeners, 0);
            assert.equal(sample.afterRetirement.callbacks, 0);
            assert.equal(sample.afterRetirement.activeBindings, 0);
            for (const resource of sample.resourceSamples.slice(4))
              assert.deepEqual(resource, sample.resourceSamples[3], 'Warmed deterministic clone plateau');
            for (const frame of sample.sequence) {
              const bytes = Buffer.from(frame.image.split(',')[1], 'base64');
              const filename = `run-${run}-${tier}-${actorCount}-${String(frame.frame).padStart(4, '0')}.png`;
              await fs.writeFile(path.join(directory, filename), bytes);
              frame.image = path.relative(ROOT, path.join(directory, filename)).replaceAll('\\', '/');
              frame.sha256 = hash(bytes);
            }
            samples.push({ run: run + 1, browser: browser.version(),
              sourceIdentitySha256: hash(JSON.stringify(identities)), ...sample });
            if(candidate) {
              await fs.writeFile(path.join(directory,`run-${run+1}-${tier}-${actorCount}-metrics.json`),JSON.stringify(samples.at(-1),null,2)+'\n');
              console.log(JSON.stringify({candidateProfile:`${run+1}/${tier}/${actorCount}`,timings:sample.timings,plateau:sample.resourceSamples[3]}));
            }
            console.log(`Animation ${candidate?'candidate':'baseline'} run ${run + 1}: ${tier}/${actorCount} (${sample.frameCount} moving frames)`);
          }
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    assert.deepEqual(await animationIdentities(), identities, 'Source changed during capture');
    signal?.throwIfAborted();
  } finally {
    try { if (browser) { await browser.close(); cleanup.browserClosed = true; } }
    finally { await server.close(); cleanup.serverClosed = true; onCleanup?.(cleanup); }
  }
  const report = { schemaVersion: 1, complete: !smoke, capturedAt: new Date().toISOString(),
    revision, identities, runtimeDependencies: verifyRuntimeDependencies(identities),
    samples, cleanup, durationMs: Date.now() - start,
    device: { hostname: os.hostname(), os: os.type(), release: os.release(), arch: process.arch,
      cpu: os.cpus()[0]?.model, node: process.version, browser: browser.version(),
      rendererClass: samples.every(s => /swiftshader|software/i.test(s.gpu)) ? 'software' : 'physical-or-unidentified' },
    certification: false, humanMotionAcceptance: 'pending',
    limits: 'Controlled actual Training Range loaded scene, retained rig and current transitions; fixed 20 Hz simulation clock, native RAF pacing, 214 measured frames per profile, 12 warmup frames and 8 clone loops. PNG encoding is a separate playback, excluded from timings. Browser timer quantization may report zero for short components. Synchronous GPU completion includes rendering; no input/network/whole-game FPS certification. Full-pixel continuous sequence belongs to run 1 low/1. No phone, integrated GPU, gaming GPU, Pi or 60 FPS qualification.' };
  if(candidate) {
    const baselineBytes=await fs.readFile(path.join(ANIMATION_EVIDENCE,'07-baseline.json'));
    const budget=JSON.parse(await fs.readFile(path.join(ANIMATION_EVIDENCE,'07-budget.json'),'utf8'));
    report.baselineSha256=hash(baselineBytes);
    report.comparison=smoke?{matched:false,budgetPass:false,reason:'Incomplete smoke proof only'}:compareAnimationCandidate(report,budget);
    report.limits+=' Candidate uses current phase-driven masks/handling and one essential local view, replacing source0 visually. All source roots/layout/scales stay fixed; the full view uses source0 eye plus1.65m standing/.85m crouched,75deg FOV and down-look1.3rad with source torso pitch clamped1.1rad. This camera/workload is not comparable to the external3P baseline frame improvement; old absolute frame-limit flags remain explicit. Selection, source correction and view copying/fitting are separately measured. Required moving charging geometry adds1/actor; numeric legacy overruns are never widened.';
    // Outer report metadata only: the archived sampleAnimationPage producer and
    // timing/draw/PNG boundaries above remain byte-identical to the V2 reference.
    const v2Bytes = await fs.readFile(path.join(ANIMATION_EVIDENCE, '07-budget-view-v2.json'));
    const v2 = JSON.parse(v2Bytes);
    report.producerContract = producerContract(report);
    report.v2Lineage = candidateLineage(v2, v2Bytes, report);
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  // Atomic publication only after every sample, identity and cleanup check succeeded.
  const temporary = reportPath + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await fs.rename(temporary, reportPath);
  console.log(JSON.stringify({ report: reportPath, complete: report.complete }));
  return report;
}

const TIMING_COMPONENTS = ['frameIntervalMs', 'mixerMs', 'inertiaMs', 'correctionMs', 'renderMs'];

export function compareAnimationCandidate(report,budget) {
  assert.equal(report.complete,true,'Incomplete candidate');
  assert.equal(report.baselineSha256,budget.baselineSha256,'Wrong baseline identity');
  assert.deepEqual(report.device,budget.device,'Unmatched device/browser');
  assert.equal(report.samples.length,12,'Truncated candidate matrix');
  const seen=new Set(),overruns=[],resourceChanges=[];
  const scopes=new Set(report.samples.map(sample=>sample.renderScope));
  assert.equal(scopes.size,1,'Mixed candidate camera/workload scopes');
  assert.ok([undefined,'external-third-person-core','source-eye-down-view-replaces-source-0'].includes([...scopes][0]),'Unknown candidate camera/workload scope');
  const fullView=report.samples.every(sample=>sample.renderScope==='source-eye-down-view-replaces-source-0');
  for(const sample of report.samples) {
    const key=`${sample.run}/${sample.tier}/${sample.actorCount}`;
    assert.ok(!seen.has(key),'Duplicate candidate profile');seen.add(key);
    assert.ok([1,2].includes(sample.run),'Unknown candidate run');
    const profile=budget.profiles.find(p=>p.tier===sample.tier&&p.actorCount===sample.actorCount);
    assert.ok(profile,'Unknown candidate profile');
    assert.deepEqual(sample.viewport,profile.viewport,'Unmatched viewport');
    assert.equal(sample.dpr,profile.dpr,'Unmatched DPR');assert.equal(sample.gpu,profile.gpu,'Unmatched renderer');
    assert.equal(sample.frameCount,214,'Truncated timed frames');
    assert.equal(sample.warmupFrames,12);assert.equal(sample.simulationStepSeconds,1/20);
    assert.equal(sample.resourceSamples.length,8);assert.equal(sample.sharedDisposals,0);
    for(const entry of sample.resourceSamples.slice(4))assert.deepEqual(entry,sample.resourceSamples[3],'Unstable candidate plateau');
    for(const name of TIMING_COMPONENTS)for(const stat of ['median','p95']) {
      const actual=sample.timings[name]?.[stat],upper=profile.timings[name][`${stat}UpperMs`];
      assert.ok(Number.isFinite(upper)&&upper>=0,'Missing numeric fixed envelope');
      assert.ok(Number.isFinite(actual)&&actual>=0,'Nonfinite candidate timing');
      if(actual>upper+1e-7)overruns.push({run:sample.run,tier:sample.tier,actorCount:sample.actorCount,component:name,stat,actualMs:actual,upperMs:upper});
    }
    for(const name of ['geometries','textures','programs']){
      const actual=sample.resourceSamples[3][name],baseline=profile.warmedPlateau[name];
      if(actual!==baseline)resourceChanges.push({run:sample.run,tier:sample.tier,actorCount:sample.actorCount,resource:name,actual,baseline});
    }
    for(const name of ['listeners','callbacks','props','actors','activeBindings'])assert.equal(sample.afterRetirement[name],0,'Owned retirement failed');
    if(fullView){assert.ok(sample.viewEvidence?.attached,'Detached view');assert.equal(sample.viewEvidence.allocatedBoneTextures,2,'View skeletons never drawn');
      assert.ok(Object.values(sample.viewEvidence.draws).every(count=>count>0),'View draw callbacks missing');assert.equal(sample.sequence.length,3,'View pixels missing');
      assert.equal(sample.viewEvidence.sourceActorCount,sample.actorCount);assert.equal(sample.viewEvidence.proxyEntityCount,1);
      assert.equal(sample.viewEvidence.cameraColocatedXZ,true);assert.equal(sample.viewEvidence.fov,75);
      assert.ok(sample.viewEvidence.selectedVisibleMeshes.every(count=>count>0),'Empty essential view groups');}
  }
  return {matched:!fullView,legacyBudgetPass:!fullView&&overruns.length===0&&resourceChanges.length===0,
    budgetPass:!fullView&&overruns.length===0&&resourceChanges.length===0,
    cameraWorkloadComparable:!fullView,reason:fullView?'Actual source-eye essential view differs from external baseline camera/workload':null,
    absoluteFrameLimitFlags:overruns.filter(entry=>entry.component==='frameIntervalMs'),overruns,resourceChanges,certification:false};
}

export function validateAnimationBaseline(report, identities) {
  assert.equal(report.complete, true, 'Incomplete animation baseline');
  assert.equal(report.schemaVersion, 1, 'Unsupported baseline schema');
  assert.equal(report.certification, false, 'Baseline must not claim device certification');
  assert.deepEqual(report.identities, identities, 'Stale source/export identities');
  assert.deepEqual(report.cleanup, { browserClosed: true, serverClosed: true });
  assert.equal(report.samples.length, 12, 'Truncated baseline profile matrix');
  const expectedIdentity = hash(JSON.stringify(identities));
  const groups = [];
  for (const tier of ['low', 'medium', 'high']) {
    for (const actorCount of [1, 8]) {
      const samples = report.samples.filter(sample => sample.tier === tier && sample.actorCount === actorCount);
      assert.equal(samples.length, 2, 'Exactly two matched repetitions required');
      assert.deepEqual(samples.map(sample => sample.run).sort(), [1, 2]);
      for (const sample of samples) {
        assert.equal(sample.sourceIdentitySha256, expectedIdentity, 'Stale sample identity');
        assert.equal(sample.failure, undefined, 'Failed sample cannot pass');
        assert.ok(sample.human && sample.packedMaps > 0 && sample.keeperIntact && sample.restored);
        assert.equal(sample.sharedDisposals, 0);
        assert.equal(sample.frameCount, 214, 'Truncated moving sample');
        assert.ok(Number.isFinite(sample.durationMs) && sample.durationMs > 0);
        assert.ok(sample.gpu && sample.renderer && sample.browser);
        assert.equal(sample.browser, report.device.browser);
        assert.deepEqual(sample.viewport, [1280, 960]);
        assert.equal(sample.dpr, 1);
        for (const name of TIMING_COMPONENTS) {
          for (const stat of ['median', 'p95', 'min', 'max'])
            assert.ok(Number.isFinite(sample.timings[name]?.[stat]) && sample.timings[name][stat] >= 0,
              'Missing/nonfinite numeric timing bound');
          assert.ok(sample.timings[name].p95 >= sample.timings[name].median);
        }
        assert.equal(sample.resourceSamples.length, 8);
        for (const plateau of sample.resourceSamples.slice(4))
          assert.deepEqual(plateau, sample.resourceSamples[3], 'Non-plateauing deterministic clone loop');
        for (const name of ['listeners', 'callbacks', 'props', 'actors', 'activeBindings'])
          assert.equal(sample.afterRetirement[name], 0, 'Owned resource did not retire: ' + name);
      }
      assert.equal(samples[0].gpu, samples[1].gpu, 'Unmatched renderer');
      assert.deepEqual(samples[0].ownership, samples[1].ownership, 'Unmatched actor ownership');
      assert.deepEqual(samples[0].resourceSamples.at(-1), samples[1].resourceSamples.at(-1), 'Unmatched plateau');
      assert.deepEqual(samples[0].afterRetirement, samples[1].afterRetirement, 'Unmatched retired resources');
      groups.push({ tier, actorCount, samples });
    }
  }
  const media = report.samples.find(sample => sample.sequence.length > 0);
  assert.ok(media && media.sequence.length === media.frameCount, 'Truncated continuous media sequence');
  for (const frame of media.sequence) {
    assert.match(frame.sha256, /^[a-f0-9]{64}$/);
    assert.ok(frame.image.startsWith('.planning/research/.cache/06-art/animation-baseline/'));
  }
  return groups;
}

export async function recordAnimationBudget() {
  const baselinePath = path.join(ANIMATION_EVIDENCE, '07-baseline.json');
  const budgetPath = path.join(ANIMATION_EVIDENCE, '07-budget.json');
  const bytes = await fs.readFile(baselinePath);
  const baseline = JSON.parse(bytes);
  const groups = validateAnimationBaseline(baseline, await animationIdentities());
  const baselineSha256 = hash(bytes);
  // Verify retained full-pixel evidence, not just JSON references.
  for (const sample of baseline.samples) for (const frame of sample.sequence) {
    const filename = await iterationPath([CACHE], path.join(ROOT, frame.image));
    assert.equal(hash(await fs.readFile(filename)), frame.sha256, 'Missing/stale media identity');
  }
  const profiles = groups.map(({ tier, actorCount, samples }) => {
    const timings = {};
    for (const name of TIMING_COMPONENTS) {
      const first = samples[0].timings[name], second = samples[1].timings[name];
      const medianDispersionMs = Math.abs(first.median - second.median);
      const p95DispersionMs = Math.abs(first.p95 - second.p95);
      timings[name] = { baselineMedianMs: [first.median, second.median],
        baselineP95Ms: [first.p95, second.p95], medianDispersionMs, p95DispersionMs,
        medianUpperMs: Math.max(first.median, second.median) + medianDispersionMs,
        p95UpperMs: Math.max(first.p95, second.p95) + p95DispersionMs };
    }
    return { tier, actorCount, viewport: samples[0].viewport, dpr: samples[0].dpr,
      gpu: samples[0].gpu, measuredFramesPerRun: samples.map(sample => sample.frameCount),
      durationMsPerRun: samples.map(sample => sample.durationMs), timings,
      maximumRepeatDispersionMs: Math.max(...Object.values(timings).flatMap(
        timing => [timing.medianDispersionMs, timing.p95DispersionMs])),
      warmedPlateau: samples[0].resourceSamples.at(-1),
      actorOwnership: samples[0].ownership, returnToBaseline: samples[0].afterRetirement };
  });
  const decision = { schemaVersion: 1, baselineSha256,
    baselineCapturedAt: baseline.capturedAt, baselineRevision: baseline.revision,
    identities: baseline.identities, device: baseline.device, profiles, certification: false,
    comparisonPolicy: 'Matched device/browser/renderer/viewport/DPR/tier/count, same paced warmed sample clock and clone loop. Each numeric upper bound is the larger observed repeat value plus the absolute repeat dispersion for that statistic. Zero/short components remain browser-timer-limited observations. Candidate overruns require optimization or explicitly justified matched remeasurement; never silently widen this decision.',
    ownershipPolicy: 'Owned listeners, callbacks, active mixer bindings, props and actors return to measured zero; actor-owned/shared counts and warmed deterministic clone plateaus match each profile. Shared geometry/maps survive retirement. Randomized map rubble is outside exact whole-scene geometry equality.',
    motionPolicy: 'Torso, hand contact, planted turns, camera comfort and all aesthetics still require current continuous moving review and human acceptance. UI-SPEC bob/sway starting bounds are separate from this measured cost decision.',
    limits: baseline.limits };
  const existing = await fs.readFile(budgetPath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing) {
    assert.deepEqual(JSON.parse(existing), decision,
      'Pre-tuning budget is immutable; stale baseline or changed limits require a justified separate decision');
  } else {
    await fs.writeFile(budgetPath + '.tmp', JSON.stringify(decision, null, 2) + '\n');
    await fs.rename(budgetPath + '.tmp', budgetPath);
  }
  console.log(JSON.stringify({ budget: budgetPath, baselineSha256, profiles: profiles.length }));
  return decision;
}

/// ---- Paired same-session capture (plan 07-16; contract 07-09-PAIRED-AMENDMENT-V2.md) ----
// Both arms are byte copies of the served tree in the owned cache, each on its own strict
// loopback listener with the same configuration. sampleAnimationPage above is reused
// unedited: its text is the captureSampler identity both arms report. Rules, registry,
// report shapes and the order of a session live in animation-budget-paired.mjs (runSession);
// this file supplies only the effects: browser, listeners and files. A smoke keeps no timing
// value. A calibration or qualifying session prints, logs and writes no timing value before
// it is closed, except that a qualifying session writes its candidate arm report, after the
// last pair, for the unchanged frozen command to read.
const PAIRED_KINDS = { '--smoke': 'smoke', '--calibration': 'calibration' };
const PAIRED_ARMS = ['reference', 'candidate'];

async function serveArm(directory, cacheDir) {
  const port = await reviewPort();
  const server = await createServer({ root: directory, configFile: false, base: '/', cacheDir, logLevel: 'warn',
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false,
      fs: { strict: true, allow: [directory, cacheDir, path.join(ROOT, 'node_modules')] },
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  try { await server.listen(port); } catch (error) { await server.close(); throw error; }
  return { server, url: `http://127.0.0.1:${server.httpServer.address().port}/` };
}

// The context, init script and page defaults of captureAnimationBaseline, for one arm. Page
// errors and failed responses are collected into the arm's own lists across its pages.
async function openArmPage(browser, errors = [], failedResponses = []) {
  const context = await browser.newContext({ viewport: { ...paired.SESSION_SETTINGS.context.viewport },
    deviceScaleFactor: paired.SESSION_SETTINGS.context.deviceScaleFactor });
  await context.addInitScript(() => {
    window.__baselineRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
    HTMLCanvasElement.prototype.requestPointerLock = () => {};
    let seed = 67245;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && failedResponses.length < 20)
      failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { context, page, errors, failedResponses };
}

async function enterRange(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('range-startbtn').disabled, null, { polling: 100 });
  await page.locator('#range-startbtn').click();
}

async function sampleArm(page, tier, actorCount) {
  let timeout;
  try {
    return await Promise.race([
      sampleAnimationPage(page, { tier, actorCount, failAt: undefined, candidate: true, renderedView: true, captureFrames: false }),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(() => reject(Error('Animation sample exceeded 180 seconds')), 180000);
      }),
    ]);
  } finally { clearTimeout(timeout); }
}

// Step one, for every kind: append the registration to the tracked registry and stop. The
// registry file is then committed alone, before `--run`. The registry rules (one calibration
// per source identity, a passed calibration before any qualifying session, the same tool bytes
// and sampler, at most three qualifying sessions) are refused by registerSession.
export async function registerPairedSession(kind) {
  paired.assertContract();
  paired.assertPins();
  const working = paired.readRegistry(), committed = paired.committedRegistry();
  paired.verifyChain(working);
  assert.deepEqual(paired.uncommittedEvents(working, committed), [], 'Registration refused: the registry holds uncommitted events');
  assert.equal(committed?.events?.length ?? 0, working.events.length, 'Registration refused: the committed registry holds more events');
  const identities = await animationIdentities();
  assert.equal(identities.captureSampler, paired.FROZEN_SAMPLER, 'Sampler is not the frozen capture sampler');
  paired.assertServedTreeClean(identities);
  const commit = (await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: ROOT, windowsHide: true })).stdout.trim();
  const next = paired.registerSession(working, { kind, nonce: paired.newNonce(), commit,
    identity: paired.identityHash(identities), host: await paired.hostFacts(), toolHashes: paired.toolHashes(),
    samplerIdentity: identities.captureSampler });
  paired.writeRegistry(next);
  const event = next.events.at(-1);
  console.log(JSON.stringify({ registered: true, kind, nonce: event.nonce, seq: event.seq, registry: paired.REGISTRY_PATH,
    next: `Commit the registry file alone, then run --animation-paired ${kind === 'qualifying' ? '' : `--${kind} `}--run ${event.nonce}` }));
  return event;
}

// What an arm report needs besides its samples: the frozen files a candidate report cites.
export async function pairedReportInputs() {
  const baselineBytes = await fs.readFile(path.join(ANIMATION_EVIDENCE, '07-baseline.json'));
  const budget = JSON.parse(await fs.readFile(path.join(ANIMATION_EVIDENCE, '07-budget.json'), 'utf8'));
  const v2BudgetBytes = await fs.readFile(path.join(ROOT, paired.FROZEN_BUDGET_PATH)), v2Budget = JSON.parse(v2BudgetBytes);
  return { baselineSha256: hash(baselineBytes), compare: report => compareAnimationCandidate(report, budget), v2Budget, v2BudgetBytes,
    knownReportHashes: paired.existingReportHashes(v2Budget) };
}

// Step two: one capture for one committed registration. A smoke captures one profile pair
// (run 1, Low, one actor) and writes load and structure facts only. A calibration captures the
// reference arm against a second copy of it, a qualifying session the candidate against the
// reference: one warm-up pair, then the 12 profiles in the contract's order, with the context
// and page lifetime, launch flags and sampler arguments of SESSION_SETTINGS in every kind.
export async function runPairedSession(kind, nonce) {
  paired.assertContract();
  let registry = paired.readRegistry();
  paired.verifyChain(registry);
  const registered = paired.assertRunnable({ nonce, working: registry, committed: paired.committedRegistry() });
  assert.equal(registered.kind, kind, `Nonce is registered as a ${registered.kind} session`);
  const identities = await animationIdentities();
  assert.equal(identities.captureSampler, paired.FROZEN_SAMPLER, 'Sampler is not the frozen capture sampler');
  const head = paired.headState(registered.commit);
  paired.runGuard({ registered, ...head, identityNow: paired.identityHash(identities) });
  paired.assertServedTreeClean(identities);
  const full = kind !== 'smoke', inputs = full ? await pairedReportInputs() : null;
  const hostBefore = await paired.hostFacts(), owners = Object.keys(paired.PAIRED_CONTRACT.referenceOwners);
  const servers = {}, opened = new Set(), pageErrors = { reference: [], candidate: [] }, failedResponses = { reference: [], candidate: [] };
  let browser, browserVersion, arms, armIdentity, runtimeDependencies = null, released = false;
  const release = async () => {
    released = true;
    for (const context of opened) await context.close().catch(() => {});
    const browserClosed = browser ? await browser.close().then(() => true, () => false) : false;
    let closedServers = 0;
    for (const served of Object.values(servers)) closedServers += await served.server.close().then(() => 1, () => 0);
    return { browserClosed, serverClosed: closedServers === PAIRED_ARMS.length };
  };
  // Whatever refuses does so here, before the `started` event: such a refusal captures nothing
  // and leaves the registration as it is.
  try {
    browser = await chromium.launch({ headless: paired.SESSION_SETTINGS.launch.headless, args: [...paired.SESSION_SETTINGS.launch.args] });
    browserVersion = browser.version();
    paired.assertRunScope({ registry, registered, toolHashes: paired.toolHashes(), samplerIdentity: identities.captureSampler, browserVersion });
    // Both arms exist, and differ in exactly the five owner files (in none, for a calibration), before the session starts.
    arms = paired.materializeArms(registered, { files: paired.armFiles(identities) });
    armIdentity = Object.fromEntries(PAIRED_ARMS.map(arm => [arm, paired.armIdentities(arms.arms[arm], identities)]));
    if (full) {
      runtimeDependencies = Object.fromEntries(PAIRED_ARMS.map(arm => [arm, verifyRuntimeDependencies(armIdentity[arm])]));
      for (const arm of PAIRED_ARMS) await fs.mkdir(path.join(arms.sessionDirectory, 'frames', arm), { recursive: true });
    }
    for (const arm of PAIRED_ARMS) servers[arm] = await serveArm(arms.arms[arm], path.join(arms.sessionDirectory, 'vite-cache-' + arm));
  } catch (error) {
    await release();
    if (arms) {
      await iterationPath([path.join(ROOT, paired.PAIRED_CACHE)], arms.sessionDirectory);
      await fs.rm(arms.sessionDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
    }
    throw error;
  }
  const sessionRelative = path.relative(ROOT, arms.sessionDirectory).replaceAll('\\', '/');
  const paths = { reference: `${sessionRelative}/arm-reference.json`, candidate: `${sessionRelative}/arm-candidate.json`,
    session: `${sessionRelative}/${full ? 'session' : 'smoke-session'}.json` };
  const pairs = full ? paired.sessionScheme() : [paired.SMOKE_PAIR];
  // pairCapturer holds the context and page lifetime and the capture order; here are its effects.
  const { capturePair } = paired.pairCapturer({ pairs,
    openView: async arm => {
      const view = await openArmPage(browser, pageErrors[arm], failedResponses[arm]);
      opened.add(view.context);
      await enterRange(view.page, servers[arm].url);
      return view;
    },
    sample: (view, _arm, pair) => sampleArm(view.page, pair.tier, pair.actorCount),
    finish: async (sample, arm, pair) => {
      for (const frame of sample.sequence ?? []) {
        const bytes = Buffer.from(frame.image.split(',')[1], 'base64');
        frame.sha256 = hash(bytes);
        // Frame images of the 12 measured profiles are written as they are captured, as `qualify`
        // needs them; they carry no timing. A smoke and the warm-up pair keep none.
        if (full && !pair.warmup) {
          const file = path.join(arms.sessionDirectory, 'frames', arm,
            `run-${pair.run}-${pair.tier}-${pair.actorCount}-${String(frame.frame).padStart(4, '0')}.png`);
          await fs.writeFile(file, bytes);
          frame.image = path.relative(ROOT, file).replaceAll('\\', '/');
        }
      }
      return { run: pair.run, browser: browserVersion, sourceIdentitySha256: hash(JSON.stringify(armIdentity[arm])), ...sample };
    },
    closeView: async view => { await view.context.close().catch(() => {}); opened.delete(view.context); } });
  const endCapture = async ({ interrupted }) => {
    const facts = { cleanup: null, pageErrors, error: null, difference: arms.difference, armDataKept: null, hostAfter: null,
      diagnostics: Object.fromEntries(PAIRED_ARMS.map(arm => [arm, { failedResponses: failedResponses[arm] }])) };
    if (!interrupted) {
      try {
        facts.difference = { ...paired.compareArms(arms.arms, arms.names, owners, { identical: kind === 'calibration' }),
          ownersVerified: arms.difference.ownersVerified };
        assert.deepEqual(await animationIdentities(), identities, 'Source changed during capture');
      } catch (error) { facts.error = error?.message ?? String(error); }
    }
    facts.cleanup = await release();
    if (!full) {
      // The arm data of a smoke is not kept: both trees and both server caches go before the report is written.
      const armData = [arms.arms.reference, arms.arms.candidate, ...PAIRED_ARMS.map(arm => path.join(arms.sessionDirectory, 'vite-cache-' + arm))];
      for (const directory of armData) {
        await iterationPath([arms.sessionDirectory], directory);
        await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
      }
      facts.armDataKept = (await Promise.all(armData.map(directory => fs.access(directory).then(() => true, () => false)))).some(Boolean);
    }
    facts.hostAfter = await paired.hostFacts();
    return facts;
  };
  let result;
  try {
    result = await paired.runSession({ kind, registered, pairs, capturePair, endCapture,
      hashFrameImages: async report => paired.frameImageCheck(report),
      // The tracked registry is the only tracked file a session writes.
      appendEvent: async event => { registry = paired.appendEvent(registry, event); paired.writeRegistry(registry); return registry; },
      // Reports go below the gitignored session directory, each written once and never rewritten.
      write: async (name, bytes) => fs.writeFile(await iterationPath([arms.sessionDirectory], path.join(ROOT, name)), bytes, { flag: 'wx' }),
      log: message => console.log(message),
      // The unchanged frozen command, reached only here, with its output captured.
      runFrozen: async name => paired.runFrozenCommand(name),
      context: { revision: head.headCommit, browserVersion, hostBefore, armIdentities: armIdentity, difference: arms.difference, paths,
        ...(full ? { knownReportHashes: inputs.knownReportHashes, runtimeDependencies, baselineSha256: inputs.baselineSha256,
          compare: inputs.compare, v2Budget: inputs.v2Budget, v2BudgetBytes: inputs.v2BudgetBytes,
          device: { hostname: os.hostname(), os: os.type(), release: os.release(), arch: process.arch, cpu: os.cpus()[0]?.model,
            node: process.version, browser: browserVersion } } : {}) } });
  } finally { if (!released) await release(); }
  if (kind === 'smoke') {
    if (result.report.error) console.error(result.report.error);
    if (result.report.structuralFailure) process.exitCode = 1;
  }
  return result.report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let operation;
  if (args.length === 1 && args[0] === '--capture') operation = captureGameplay;
  else if (args[0] === '--animation-capture' && (args.length === 1 || args.length === 2 && ['--tracer','--combat-probe','--independent-matrix','--view-tracer','--fallback-recovery'].includes(args[1]))) operation = async () => {
    const { captureAnimationReview } = await import('./animation-capture.mjs');
    return captureAnimationReview(animationIdentities,{tracer:args[1] === '--tracer',combatProbe:args[1] === '--combat-probe',independentMatrix:args[1] === '--independent-matrix',viewTracer:args[1] === '--view-tracer',fallbackRecovery:args[1] === '--fallback-recovery'});
  };
  else if (args.length === 1 && args[0] === '--animation-budget') operation = recordAnimationBudget;
  else if(args[0]==='--animation-candidate'&&(args.length===1||args.length===2&&args[1]==='--smoke'))operation=()=>captureAnimationBaseline({candidate:true,smoke:args[1]==='--smoke'});
  else if (args[0] === '--animation-paired') {
    // Exactly one of --smoke, --calibration or no sub-flag (qualifying); then --register or --run <nonce>.
    const kind = PAIRED_KINDS[args[1]] ?? 'qualifying', step = args.slice(kind === 'qualifying' ? 1 : 2);
    if (step.length === 1 && step[0] === '--register') operation = () => registerPairedSession(kind);
    else if (step.length === 2 && step[0] === '--run' && /^[a-f0-9]{32}$/.test(step[1])) operation = () => runPairedSession(kind, step[1]);
    else throw Error('Use --animation-paired [--smoke | --calibration] --register, then --run <nonce>');
  }
  else if (args[0] === '--animation-baseline' && (args.length === 1 ||
    (args.length === 2 && args[1] === '--smoke'))) {
    operation = async () => {
      const controller = new AbortController();
      const abort = () => controller.abort(Error('Animation capture canceled'));
      process.once('SIGINT', abort); process.once('SIGTERM', abort);
      try { return await captureAnimationBaseline({ smoke: args[1] === '--smoke', signal: controller.signal }); }
      finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
    };
  }
  else throw Error('Use --capture, --animation-capture, --animation-baseline [--smoke] or --animation-budget');
  operation().catch(error => { console.error(error); process.exitCode = 1; });
}
