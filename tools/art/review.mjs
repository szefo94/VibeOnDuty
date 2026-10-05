import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createPortProbe } from 'node:net';
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--capture')) throw Error('Use --capture for actual gameplay review');
  captureGameplay().catch((error) => { console.error(error); process.exitCode = 1; });
}
