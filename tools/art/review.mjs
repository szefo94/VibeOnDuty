import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT, CACHE, hash, iterationPath } from './pipeline.mjs';

// This owns a loopback-only Vite server and separate browser contexts. It never connects
// to multiplayer or adds a production debug/mutation API. Only the model GET is routed.
export async function reviewIteration(directory, candidates) {
  await iterationPath([CACHE], directory);
  for (const filename of Object.values(candidates)) await iterationPath([directory], filename);
  const server = await createServer({ root: ROOT, base: '/',
    cacheDir: path.join(directory, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false, hmr: false } });
  let browser;
  const frames = {};
  try {
    await server.listen(0);
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
          playerBody.visible = true; g.playerMesh.visible = true;
          playerBody.position.set(camera.position.x, camera.position.y - PLAYER_H, camera.position.z);
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
