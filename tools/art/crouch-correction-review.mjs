import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT, hash, iterationPath } from './pipeline.mjs';
import { MOTION_CACHE } from './motion-pipeline.mjs';
import { identities } from './crouch-correction.mjs';

export async function reviewCorrection(directory) {
  await iterationPath([MOTION_CACHE], directory);
  assert.ok(path.basename(directory).startsWith('crouch-correction-'));
  const report = JSON.parse(await fs.readFile(path.join(directory, 'candidate-report.json'), 'utf8'));
  const before = await identities();
  assert.deepEqual(before, report.acceptedBefore);
  for (const file of [report.output, report.accepted]) await iterationPath([directory], file);
  const mediaDirectory = await fs.mkdtemp(path.join(directory, 'review-'));
  const probe = portProbe(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  assert.notEqual(port, 5173, 'Leave user server untouched');
  const server = await createServer({ root: ROOT, base: '/', cacheDir: path.join(directory, 'vite-cache'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  let browser;
  const media = [], start = Date.now();
  try {
    await server.listen(port);
    browser = await chromium.launch({ headless: true, timeout: 45000, args: ['--use-gl=swiftshader'] });
    for (const [label, file] of [['accepted-broken', report.accepted], ['candidate-unpublished', report.output]]) {
      const bytes = await fs.readFile(file), errors = [];
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1,
        recordVideo: { dir: path.join(mediaDirectory, 'media'), size: { width: 1280, height: 960 } } });
      let page, video;
      try {
        await context.addInitScript(() => {
          // The normal game boots/loads assets, but owns no animation frame in this
          // isolated fixture. Only our labeled review clone uses the native RAF.
          HTMLCanvasElement.prototype.requestPointerLock = () => {};
          localStorage.setItem('vod_graphics_quality_v1', 'medium');
          let seed = 67245; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        });
        page = await context.newPage(); video = page.video(); page.setDefaultTimeout(45000);
        page.on('pageerror', (error) => errors.push(error.message));
        let requests = 0;
        await page.route('**/models/enemy.glb', async (route) => {
          const method = route.request().method(); assert.ok(['GET', 'HEAD'].includes(method));
          if (method === 'GET') requests++;
          await route.fulfill({ status: 200, contentType: 'model/gltf-binary',
            headers: { 'content-length': String(bytes.length) }, body: method === 'HEAD' ? '' : bytes });
        });
        await page.goto(`http://127.0.0.1:${port}/`, { timeout: 45000 });
        try { await page.waitForFunction(() => !document.getElementById('range-startbtn').disabled); }
        catch (error) {
          const diagnostic = { label, errors, requests, body: await page.locator('body').innerText() };
          await fs.writeFile(path.join(mediaDirectory, label + '-setup-failure.json'), JSON.stringify(diagnostic, null, 2));
          await page.screenshot({ path: path.join(mediaDirectory, label + '-setup-failure.png') }); throw error;
        }
        await page.locator('#range-startbtn').click();
        await page.evaluate(() => {
          window.__crouchNativeRaf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = () => 0;
        });
        const rows = await page.evaluate(async ({ label }) => {
          const src = new URL('src/', location.href).href;
          const gltf = await import(src + 'builders/enemyGLTF.js');
          const { tickPresentation, inspectPresentationLayers } = await import(src + 'builders/enemyAnimations.js');
          const { disposeCharacter } = await import(src + 'builders/characterResources.js');
          const { scene, camera, renderer } = await import(src + 'scene.js');
          const { renderComicScene } = await import(src + 'comicOutline.js');
          const { playerBody } = await import(src + 'builders/playerBody.js');
          const { wpn } = await import(src + 'builders/weapon.js');
          const { player } = await import(src + 'entities/player.js');
          const input = await import(src + 'input.js'); input.setGameRunning(false);
          const T = window.__THREE, keeper = gltf.playerMesh;
          if (!gltf.usingGLTF || !keeper) throw Error('Real candidate loader failed');
          const keeperPose = keeper.getObjectByName('thigh_l').quaternion.toArray();
          const rootBefore = keeper.position.toArray(), playerBefore = [player.hp, player.ammo, player.kills];
          const cameraPos = camera.position.clone(), cameraQ = camera.quaternion.clone(), fov = camera.fov;
          const visible = keeper.visible, bodyVisible = playerBody.visible;
          const liveViews = [gltf.playerFirstPersonRig?.arms, gltf.playerFirstPersonRig?.body,
            gltf.playerFirstPersonRig?.weapon, wpn].filter(Boolean);
          const viewVisibility = liveViews.map((node) => node.visible);
          const labelNode = document.createElement('div'); labelNode.textContent = `${label} — isolated fixed-heading crouch / Not published / human review pending`;
          labelNode.style.cssText = 'position:fixed;top:5px;left:5px;padding:8px;background:#111;color:white;z-index:100000;font:18px sans-serif;';
          document.body.append(labelNode);
          const shared = new Set(); keeper.traverse((n) => { if (n.geometry) shared.add(n.geometry); for (const m of Array.isArray(n.material) ? n.material : [n.material]) for (const texture of [m?.map, m?.normalMap]) if (texture) shared.add(texture); });
          let sharedDisposals = 0; const listener = () => sharedDisposals++;
          for (const resource of shared) resource.addEventListener('dispose', listener);
          const rows = []; let actor;
          try {
            keeper.visible = false; playerBody.visible = false;
            liveViews.forEach((node) => { node.visible = false; });
            renderer.setPixelRatio(1); renderer.setSize(1280, 960); camera.fov = 40; camera.updateProjectionMatrix();
            for (const direction of ['forward', 'back', 'left', 'right']) {
              labelNode.textContent = `${label} / ${direction} — isolated fixed-heading crouch / Not published / human review pending`;
              actor = gltf.createReviewCharacter('m4'); actor.mesh.position.copy(keeper.position); actor.mesh.rotation.y = Math.PI;
              scene.add(actor.mesh); const anchor = actor.mesh.position.clone();
              camera.position.copy(anchor).add(new T.Vector3(2.4, 1.45, -2.6)); camera.lookAt(anchor.x, anchor.y + .72, anchor.z);
              const vectors = { forward: [0, -4.32], back: [0, 4.32], left: [-4.32, 0], right: [4.32, 0] };
              const velocity = vectors[direction], samples = [], images = []; let t = 0, previous, frame = 0, phaseTotal = 0, oldPhase = 0;
              const started = performance.now();
              await new Promise((resolve, reject) => {
                const step = (now) => {
                  try {
                    if (performance.now() - started > 30000) throw Error('Owned direction capture deadline');
                    const dt = previous === undefined ? 0 : Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now; t += dt;
                    const pose = tickPresentation(actor, { identity: 'isolated-crouch-candidate', generation: direction,
                      position: { x: anchor.x + velocity[0] * t, y: anchor.y + 1.65, z: anchor.z + velocity[1] * t },
                      bodyYaw: 0, aimYaw: 0, sampleTimeSeconds: t, crouching: true, onGround: true,
                      alive: true, reducedMotion: true, weapon: 'm4' }, dt);
                    if (frame > 0) phaseTotal += (pose.phase - oldPhase + 1) % 1; oldPhase = pose.phase;
                    actor.mesh.updateMatrixWorld(true); renderComicScene(renderer, scene, camera);
                    const row = { frame, time: t, phase: pose.phase, gait: pose.gait, root: actor.mesh.position.toArray(),
                      layers: inspectPresentationLayers(actor), thigh: actor.mesh.getObjectByName('thigh_l').quaternion.toArray(),
                      footLeft: actor.mesh.getObjectByName('foot_l').getWorldPosition(new T.Vector3()).toArray(),
                      footRight: actor.mesh.getObjectByName('foot_r').getWorldPosition(new T.Vector3()).toArray() };
                    samples.push(row);
                    if ([10, 24, 38].includes(frame)) images.push({ frame, phase: pose.phase, image: renderer.domElement.toDataURL('image/png') });
                    frame++;
                    if (frame >= 48 && phaseTotal >= 2) resolve(); else window.__crouchNativeRaf(step);
                  } catch (error) { reject(error); }
                }; window.__crouchNativeRaf(step);
              });
              const maps = []; actor.mesh.traverse((n) => { for (const m of Array.isArray(n.material) ? n.material : [n.material]) for (const texture of [m?.map, m?.normalMap]) if (texture) maps.push([texture.image?.width, texture.image?.height]); });
              rows.push({ direction, samples, images, cycles: phaseTotal, maps, fixedBodyYaw: 0, modelYaw: Math.PI,
                interpretation: 'Current runtime masked presentation on isolated loaded source clone; review-only displacement observations. No live gameplay/outcome control or physical-gun claim.' });
              disposeCharacter(actor.mesh, actor.mixer); disposeCharacter(actor.mesh, actor.mixer); actor = null;
            }
            if (sharedDisposals !== 0 || JSON.stringify(keeperPose) !== JSON.stringify(keeper.getObjectByName('thigh_l').quaternion.toArray()) || JSON.stringify(rootBefore) !== JSON.stringify(keeper.position.toArray()) || JSON.stringify(playerBefore) !== JSON.stringify([player.hp, player.ammo, player.kills])) throw Error('Keeper/root/outcome/shared-resource mutation');
            const next = gltf.createReviewCharacter('m4'); if (!next.mesh.getObjectByName('foot_l')) throw Error('Subsequent clone failed'); disposeCharacter(next.mesh, next.mixer);
          } finally {
            if (actor) disposeCharacter(actor.mesh, actor.mixer);
            for (const resource of shared) resource.removeEventListener('dispose', listener);
            labelNode.remove(); keeper.visible = visible; playerBody.visible = bodyVisible;
            liveViews.forEach((node, index) => { node.visible = viewVisibility[index]; });
            camera.position.copy(cameraPos); camera.quaternion.copy(cameraQ); camera.fov = fov; camera.updateProjectionMatrix();
          }
          return { rows, keeperPreserved: true, sharedDisposals, packedMapsDecoded: rows.every((r) => r.maps.length > 0 && r.maps.every(([w, h]) => w > 0 && h > 0)) };
        }, { label });
        assert.equal(requests, 1); assert.deepEqual(errors, []); assert.ok(rows.packedMapsDecoded);
        for (const row of rows.rows) {
          assert.ok(row.cycles >= 2 && row.samples.length >= 48);
          assert.ok(row.samples.slice(1).every((s) => s.gait.length === 1 && s.gait[0].key === 'crouch_' + row.direction));
          assert.ok(row.samples.every((s) => JSON.stringify(s.root) === JSON.stringify(row.samples[0].root)));
          for (const capture of row.images) {
            const file = `${label}-${row.direction}-${capture.frame}.png`, data = Buffer.from(capture.image.split(',')[1], 'base64');
            await fs.writeFile(path.join(mediaDirectory, file), data); delete capture.image;
            Object.assign(capture, { file, hash: hash(data) });
          }
        }
        media.push({ label, modelHash: hash(bytes), routedRequests: requests, errors, ...rows });
      } finally { await context.close(); }
      const videoPath = path.join(mediaDirectory, label + '.webm'); await video.saveAs(videoPath);
      media.at(-1).video = { file: videoPath, hash: hash(await fs.readFile(videoPath)), bytes: (await fs.stat(videoPath)).size };
    }
  } finally { await browser?.close(); await server.close(); }
  assert.deepEqual(await identities(), before, 'Accepted inputs changed during visual proof');
  const result = { complete: true, candidateOnly: true, published: false, humanAcceptance: 'pending',
    representativeDeviceFps: 'unqualified', viewport: [1280, 960], dpr: 1, tier: 'medium',
    port, ownedListenerClosed: true, durationMs: Date.now() - start, mediaDirectory, media, acceptedBefore: before, acceptedAfter: await identities() };
  await fs.writeFile(path.join(mediaDirectory, 'visual-report.json'), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(mediaDirectory, 'index.html'), '<!doctype html><meta charset="utf-8"><title>CR-02 isolated candidate</title><h1>CR-02 candidate — Not published; human review pending</h1>' + media.map((r) => `<h2>${r.label}</h2><video controls width="960" src="${r.label}.webm"></video>` + r.rows.map((row) => `<h3>${row.direction}</h3>` + row.images.map((i) => `<img width="640" src="${i.file}">`).join('')).join('')).join(''));
  console.log(JSON.stringify({ complete: true, directory, mediaDirectory, port, videos: media.map((r) => r.video.file) }));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Pass one owned crouch-correction directory');
  reviewCorrection(path.resolve(process.argv[2])).catch((error) => { console.error(error); process.exitCode = 1; });
}
