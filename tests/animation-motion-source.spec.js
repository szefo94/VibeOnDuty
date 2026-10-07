import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { parseGLB, encodeGLB } from '../tools/art/inspect-character.mjs';

let server, url;
test.beforeAll(async () => {
  const probe = portProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    base: '/VibeOnDuty/', server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/VibeOnDuty/`;
});
test.afterAll(async () => { await server?.close(); });
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.motionTrace?.dispose?.());
});

async function enter(page) {
  await page.goto(url);
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const input = await import(src + 'input.js');
    const g = await import(src + 'builders/enemyGLTF.js');
    const world = await import(src + 'scene.js');
    world.renderer.domElement.dataset.motionTrace = 'true';
    const { player } = await import(src + 'entities/player.js');
    input.setGameRunning(false);
    (await import(src + 'loop.js')).setThirdPerson(true);
    // Raw authored source motion has its own clone/mixer. The live player's
    // normal ready contact correction must continue owning the live player.
    const actor = g.usingGLTF ? g.createReviewCharacter('m4') : null;
    let raf, previous, disposed = false;
    if (actor) {
      actor.mesh.position.copy(g.playerMesh.position);
      actor.mesh.quaternion.copy(g.playerMesh.quaternion);
      world.scene.add(actor.mesh);
      const tick = now => {
        if (disposed) return;
        actor.mixer.update(previous === undefined ? 0 : Math.min(.05, (now-previous)/1000));
        window.motionTrace?.captureDue?.();
        previous = now; raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    const { disposeCharacter } = await import(src + 'builders/characterResources.js');
    window.motionTrace = { g, world, player, src, actor, dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf);
      if (actor) disposeCharacter(actor.mesh, actor.mixer);
    } };
  });
}

async function frame(page, key, phase) {
  await page.evaluate(async key => {
    const trace = window.motionTrace;
    if (trace.currentKey === key) return;
    trace.currentKey = key;
    const action = trace.actor?.actions[key];
    if (!action) return;
    trace.captureDue = null;
    trace.actor.mixer.stopAllAction();
    // Short planted turns would finish between contended browser IPC calls.
    // Observe them on the real render clock at 0.1x; walk/reload remain 1x.
    trace.actor.mixer.timeScale = action.getClip().duration <= .5 ? .1 : 1;
    action.setLoop(window.__THREE.LoopOnce, 1); action.clampWhenFinished = true;
    const { g, world, player, src, actor } = window.motionTrace;
    const { playerBody } = await import(src + 'builders/playerBody.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const T = window.__THREE, root = actor?.mesh, mixer = actor?.mixer;
    action.reset().setEffectiveWeight(1).play();
    mixer.update(0); root.updateMatrixWorld(true);
    trace.entrySupport = root.getObjectByName('hand_l').getWorldPosition(new T.Vector3()).toArray();
    trace.samples = {};
    const phases = key === 'walk' ? [.05,.25,.5,.75,.95] : key === 'reload' ? [0,.22,.4,.56,.76,.9,1] : key === 'turn_left' ? [0,.25,.5,.75,1] : [.2];
    // Capture thresholds inside the native RAF, before slow screenshot/IPC work
    // can advance the source action to its endpoint. Never seek the mixer.
    trace.captureDue = () => {
      for (const samplePhase of phases) {
        if (trace.samples[samplePhase] || action.time < action.getClip().duration * samplePhase - 1e-5) continue;
    root.visible = true;
    playerBody.visible = false;
    root.updateMatrixWorld(true);
    const position = root.position.clone();
    const viewOffset = new T.Vector3(2.2,1.4,2.7).applyQuaternion(root.quaternion);
    const eye = world.camera.position.clone(), eyeQ = world.camera.quaternion.clone();
    const liveVisible = g.playerMesh.visible;
    let image;
    try {
      world.camera.position.copy(position).add(viewOffset);
      world.camera.lookAt(position.x, position.y+.95, position.z);
      g.playerMesh.visible = false;
      renderComicScene(world.renderer, world.scene, world.camera);
      image = world.renderer.domElement.toDataURL('image/png');
    } finally {
      world.camera.position.copy(eye);
      world.camera.quaternion.copy(eyeQ);
      g.playerMesh.visible = liveVisible;
    }
    const maps = [];
    root.traverse(n => { for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      for (const texture of [m?.map, m?.normalMap]) if (texture)
        maps.push([texture.image?.width, texture.image?.height]);
    } });
    trace.samples[samplePhase] = { playbackOwner: 'independent-loaded-source-clone', authored: action.getClip().name.startsWith('vod7_'), name: action.getClip().name,
      phase: action.time/action.getClip().duration,
      thigh: root.getObjectByName('thigh_l').quaternion.toArray(),
      foot: root.getObjectByName('foot_l').quaternion.toArray(),
      support: root.getObjectByName('hand_l').getWorldPosition(new T.Vector3()).toArray(),
      entrySupport: window.motionTrace.entrySupport,
      root: [...root.position.toArray(), ...root.quaternion.toArray()],
      simulation: [...world.camera.position.toArray(), player.hp, player.ammo, player.reserve], maps, image };
      }
    };
    trace.captureDue();
  }, key);
  await page.waitForFunction(phase => !window.motionTrace.actor || !!window.motionTrace.samples?.[phase], phase);
  return page.evaluate(phase => window.motionTrace.samples?.[phase] ?? { authored: false, name: null }, phase);
}

test('original source: normal prefix-aware game renders authored walk and physical reload over real frames', async ({page}, testInfo) => {
  test.setTimeout(120000);
  await enter(page);
  const walks = [], reloads = [];
  for (const phase of [.05,.25,.5,.75,.95]) {
    const sample = await frame(page, 'walk', phase);
    walks.push(sample);
    const image = testInfo.outputPath(`walk-${phase}.png`);
    await writeFile(image,Buffer.from(sample.image.split(',')[1],'base64'));
    await testInfo.attach(`walk-${phase}`, {path:image, contentType:'image/png'});
  }
  for (const phase of [0,.22,.4,.56,.76,.9,1]) {
    const sample = await frame(page, 'reload', phase);
    reloads.push(sample);
    const image = testInfo.outputPath(`reload-${phase}.png`);
    await writeFile(image,Buffer.from(sample.image.split(',')[1],'base64'));
    await testInfo.attach(`reload-${phase}`, {path:image, contentType:'image/png'});
  }
  for (const sample of [...walks,...reloads]) {
    expect(sample.playbackOwner).toBe('independent-loaded-source-clone');
    expect(sample.authored).toBe(true);
    expect(sample.root).toEqual(walks[0].root);
    expect(sample.simulation).toEqual(walks[0].simulation);
    expect(sample.maps.length).toBeGreaterThan(1);
    expect(sample.maps.every(([w,h]) => w>0 && h>0)).toBe(true);
  }
  expect(walks.every(s=>s.name==='vod7_walk_forward')).toBe(true);
  expect(reloads.every(s=>s.name==='vod7_m4_reload')).toBe(true);
  expect(new Set(walks.map(s=>JSON.stringify(s.thigh))).size).toBeGreaterThan(3);
  const distance = (a,b) => Math.hypot(...a.map((n,i)=>n-b[i]));
  expect(Math.max(...reloads.map(s=>distance(s.support,reloads[0].support)))).toBeGreaterThan(.1);
  expect(distance(reloads[0].entrySupport,reloads.at(-1).support)).toBeLessThan(.002);
  await writeFile(testInfo.outputPath('frames.json'),JSON.stringify({
    playback:'independent loaded source clone; walk/reload1x; simulation frozen; live correction unchanged; temporary camera restored in finally',
    walks:walks.map(({image,...sample})=>sample), reloads:reloads.map(({image,...sample})=>sample)
  },null,2));
});

test('original source: stationary turn moves planted feet without moving the simulation root', async ({page}) => {
  test.setTimeout(120000);
  await enter(page);
  const frames = [];
  for (const phase of [0,.25,.5,.75,1]) frames.push(await frame(page,'turn_left',phase));
  expect(frames.every(s=>s.name==='vod7_turn_left')).toBe(true);
  expect(new Set(frames.map(s=>JSON.stringify(s.foot))).size).toBeGreaterThan(2);
  for (const s of frames) {
    expect(s.root).toEqual(frames[0].root);
    expect(s.simulation).toEqual(frames[0].simulation);
  }
});

test('original source: missing GLB still enables normal Training Range fallback play', async ({page}) => {
  await page.route('**/models/enemy.glb', r=>r.fulfill({status:404,body:''}));
  await enter(page);
  const result = await page.evaluate(async () => {
    const {g,src,player} = window.motionTrace;
    const {getMode} = await import(src+'modes/modeManager.js');
    return {loaded:g.usingGLTF, rig:!!g.playerMesh, mode:getMode()?.name, alive:!player.dead};
  });
  expect(result).toEqual({loaded:false,rig:false,mode:'range',alive:true});
});

test('original source: missing authored aliases keep old motion playable and cannot count as authored success', async ({page}) => {
  const asset = parseGLB(await readFile('public/models/enemy.glb'));
  asset.json.animations = asset.json.animations.filter(a=>!a.name.startsWith('vod7_'));
  const body = encodeGLB(asset.json, asset.binary);
  await page.route('**/models/enemy.glb', r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:r.request().method()==='HEAD'?undefined:body}));
  await enter(page);
  const sample = await frame(page,'walk',.25);
  expect(sample.authored).toBe(false);
  expect(sample.name).toBe('walk');
  expect(await page.evaluate(()=>!!window.motionTrace.g.playerActions.walk_forward)).toBe(false);
  expect(await page.evaluate(()=>!!window.motionTrace.g.playerActions.supersprint)).toBe(false);
});
