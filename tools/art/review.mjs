import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createPortProbe } from 'node:net';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT, CACHE, hash, iterationPath } from './pipeline.mjs';

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

// Vite 8 treats port 0 as its default 5173. Ask the OS for a free loopback port
// explicitly so concurrent Playwright/dev/review owners keep separate listeners.
async function reviewPort() {
  return new Promise((resolve, reject) => {
    const probe = createPortProbe(); probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const ANIMATION_EVIDENCE = path.join(ROOT,
  '.planning/phases/07-movement-matched-and-action-safe-animation/evidence');

async function animationIdentities() {
  const names = ['index.html', 'style.css', 'public/models/enemy.glb',
    'public/textures/comic-slice.png', 'tools/art/provenance.json',
    'tools/art/sources/soldier.blend', 'tools/art/character-params.json', 'tools/art/build_soldier.py'];
  async function collect(directory) {
    for (const entry of await fs.readdir(path.join(ROOT, directory), { withFileTypes: true })) {
      const name = directory + '/' + entry.name;
      if (entry.isDirectory()) await collect(name);
      else if (entry.name.endsWith('.js')) names.push(name);
    }
  }
  await collect('src');
  const identities = {};
  for (const name of names.sort()) identities[name] = hash(await fs.readFile(path.join(ROOT, name)));
  identities.captureSampler = hash(sampleAnimationPage.toString());
  return identities;
}

// Controlled moving playback in the loaded current game. Hold only this browser's
// offline game RAF; use the retained native RAF for paced, continuous rendered samples.
// This measures animation + actual scene rendering, not input/network/gameplay FPS.
async function sampleAnimationPage(page, specification) {
  return page.evaluate(async ({ tier, actorCount, captureFrames, failAt }) => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const a = await import(src + 'builders/enemyAnimations.js');
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
    let sharedDisposals = 0, callbacks = 0, restored = false;
    const watches = [], sequence = [], poseSignatures = new Set(), resourceSamples = [];
    const timings = { frameIntervalMs: [], mixerMs: [], inertiaMs: [], correctionMs: [], renderMs: [] };
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
    const render = () => { renderer.info.reset(); ink.renderComicScene(renderer, scene, camera);
      renderer.getContext().finish(); };
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
            node.skeleton.boneTexture?.image?.data.length > 0; });
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
      for (const [clip, seconds] of transitions) {
        for (let step = 0; step < Math.ceil(seconds / dt); step++) {
          callbacks++;
          await new Promise(resolve => window.__baselineRaf(() => { callbacks--; resolve(); }));
          const begin = performance.now();
          let start = begin;
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
          start = performance.now(); render();
          if (!mediaPass) timings.renderMs.push(performance.now() - start);
          const end = performance.now();
          if (!mediaPass) timings.frameIntervalMs.push(end - previous);
          const bone = actors[0].mesh.getObjectByName('calf_l') || actors[0]._bones.at(-1);
          poseSignatures.add(bone.quaternion.toArray().map(n => n.toFixed(4)).join(','));
          if (mediaPass) sequence.push({ frame, clip, simulationTime: frame * dt,
            image: renderer.domElement.toDataURL('image/png') });
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
    } catch (error) { failure = error.message; }
    finally {
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
      resourceSamples, ownership, afterRetirement };
  }, specification);
}

export async function captureAnimationBaseline({ smoke = false, failAt, onOwner, onCleanup, signal } = {}) {
  signal?.throwIfAborted();
  assert.ok(!failAt || failAt === 'render', 'Only bounded render failure injection is supported');
  const baseDirectory = path.join(CACHE, smoke ? 'animation-smoke' : 'animation-baseline');
  const directory = path.join(baseDirectory, `capture-${Date.now()}-${process.pid}`);
  await iterationPath([CACHE], directory);
  await fs.mkdir(directory, { recursive: true });
  const reportPath = smoke ? path.join(baseDirectory, 'report.json') : path.join(ANIMATION_EVIDENCE, '07-baseline.json');
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
                sampleAnimationPage(page, { tier, actorCount, failAt,
                  captureFrames: run === 0 && tier === 'low' && actorCount === 1 }),
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
            console.log(`Animation baseline run ${run + 1}: ${tier}/${actorCount} (${sample.frameCount} moving frames)`);
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
    revision, identities, samples, cleanup, durationMs: Date.now() - start,
    device: { hostname: os.hostname(), os: os.type(), release: os.release(), arch: process.arch,
      cpu: os.cpus()[0]?.model, node: process.version, browser: browser.version(),
      rendererClass: samples.every(s => /swiftshader|software/i.test(s.gpu)) ? 'software' : 'physical-or-unidentified' },
    certification: false, humanMotionAcceptance: 'pending',
    limits: 'Controlled actual Training Range loaded scene, retained rig and current transitions; fixed 20 Hz simulation clock, native RAF pacing, 214 measured frames per profile, 12 warmup frames and 8 clone loops. PNG encoding is a separate playback, excluded from timings. Browser timer quantization may report zero for short components. Synchronous GPU completion includes rendering; no input/network/whole-game FPS certification. Full-pixel continuous sequence belongs to run 1 low/1. No phone, integrated GPU, gaming GPU, Pi or 60 FPS qualification.' };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  // Atomic publication only after every sample, identity and cleanup check succeeded.
  const temporary = reportPath + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await fs.rename(temporary, reportPath);
  console.log(JSON.stringify({ report: reportPath, complete: report.complete }));
  return report;
}

const TIMING_COMPONENTS = ['frameIntervalMs', 'mixerMs', 'inertiaMs', 'correctionMs', 'renderMs'];

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let operation;
  if (args.length === 1 && args[0] === '--capture') operation = captureGameplay;
  else if (args.length === 1 && args[0] === '--animation-budget') operation = recordAnimationBudget;
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
  else throw Error('Use --capture, --animation-baseline [--smoke] or --animation-budget');
  operation().catch(error => { console.error(error); process.exitCode = 1; });
}
