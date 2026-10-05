import { test, expect } from '@playwright/test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';

test.beforeEach(async ({ page }) => {
  if (process.env.VOD_ART_CANDIDATE) {
    const body = await readFile(process.env.VOD_ART_CANDIDATE);
    await page.route('**/models/enemy.glb', (route) =>
      route.fulfill({ body, contentType: 'model/gltf-binary' })
    );
  }
});

test('art domains: real offline and generation-owned online actors preserve protected paint', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  const state = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const { createRemoteActors } = await import(src + 'network/remoteActors.js');
    const { scene } = await import(src + 'scene.js');
    const record = (root) => {
      const rows = [];
      root.traverse((n) => {
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          if (m?.userData.artDomain) rows.push({ domain: m.userData.artDomain,
            uuid: m.uuid, color: m.color?.getHex(), map: m.map?.uuid });
        }
      });
      return rows;
    };
    const actor = g.buildEnemyMesh(0, 0);
    const base = record(actor.mesh);
    g.tintEnemyMesh(actor.mesh, 0x4488ff); const blue = record(actor.mesh);
    g.tintEnemyMesh(actor.mesh, 0xff5555); const red = record(actor.mesh);
    const remote = [];
    const owner = createRemoteActors(scene, { create: (x, z) => {
      const a = g.buildEnemyMesh(x, z); remote.push(a); return a;
    }, tint: g.tintEnemyMesh, dispose: g.disposeEnemyMesh, animate: () => {} });
    const p = { sessionId: 'remote', matchGeneration: 1, lifeGeneration: 1, x: 0, z: 0, team: 'blue' };
    owner.syncRemoteActors({ sessionId: 'local', matchGeneration: 1, players: [p] }, 0);
    const remoteBlue = record(remote[0].mesh);
    owner.syncRemoteActors({ sessionId: 'local', matchGeneration: 1, players: [{ ...p, team: 'red' }] }, 0);
    const remoteRed = record(remote[0].mesh);
    owner.syncRemoteActors({ sessionId: 'local', matchGeneration: 1, players: [{ ...p, lifeGeneration: 2 }] }, 0);
    owner.disposeRemoteActors();
    g.disposeEnemyMesh(actor.mesh, actor.mixer);
    return { base, blue, red, remoteBlue, remoteRed, stats: owner.inspect() };
  });
  expect(state.base.map((m) => m.domain)).toEqual(expect.arrayContaining(['skin', 'ink', 'fabric', 'weapon', 'team-accent']));
  for (let i = 0; i < state.base.length; i++) {
    if (state.base[i].domain === 'team-accent') {
      expect(state.blue[i].color).toBe(0x4488ff); expect(state.red[i].color).toBe(0xff5555);
      expect(state.blue[i].uuid).toBe(state.red[i].uuid);
    } else { expect(state.blue[i]).toEqual(state.base[i]); expect(state.red[i]).toEqual(state.base[i]); }
  }
  for (let i = 0; i < state.remoteBlue.length; i++) {
    if (state.remoteBlue[i].domain === 'team-accent') expect(state.remoteRed[i].color).toBe(0xff5555);
    else expect(state.remoteRed[i]).toEqual(state.remoteBlue[i]);
  }
  expect(state.stats.created).toBe(2); expect(state.stats.disposed).toBe(2);
});

test('art tracer: anatomical face and separate fingers load through the actual game', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  const result = await page.evaluate(async () => {
    const g = await import(new URL('src/builders/enemyGLTF.js', location.href).href);
    const actor = g.buildEnemyMesh(0, 0, 'assault');
    const skins = [];
    actor.mesh.traverse((node) => {
      if (
        node.isSkinnedMesh &&
        (node.userData.anatomicalFace || node.parent?.userData.anatomicalFace)
      ) {
        const p = node.geometry.attributes.position;
        const indices = node.geometry.attributes.skinIndex;
        const weights = node.geometry.attributes.skinWeight;
        const fingers = new Set();
        for (let i = 0; i < p.count; i++)
          for (let j = 0; j < 4; j++) {
            if (weights.getComponent(i, j) > 0.05) {
              const name = node.skeleton.bones[indices.getComponent(i, j)].name;
              if (/^(thumb|index|middle|ring|pinky)_/.test(name))
                fingers.add(name.split('_')[0] + name.slice(-2));
            }
          }
        skins.push({
          vertices: p.count,
          fingers: [...fingers],
          face: node.userData.anatomicalFace || node.parent?.userData.anatomicalFace,
        });
      }
    });
    const resolved = ['idle', 'walk', 'run', 'reload', 'crouch', 'jump_start', 'jump_land'].every(
      (key) => actor.actions[key]
    );
    g.disposeEnemyMesh(actor.mesh, actor.mixer);
    return { loaded: g.usingGLTF, skins, resolved };
  });
  expect(result.loaded).toBe(true);
  expect(
    result.skins.length,
    'anatomical render topology must replace the mannequin'
  ).toBeGreaterThan(0);
  expect(result.skins.reduce((sum, skin) => sum + skin.vertices, 0)).toBeGreaterThan(8000);
  expect([...new Set(result.skins.flatMap((skin) => skin.fingers))]).toHaveLength(10);
  expect(result.skins[0].face).toBe(true);
  expect(result.resolved).toBe(true);
});

test('art tracer: capture the actual game rig face and armed hands', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const T = window.__THREE;
    const actor = g.buildEnemyMesh(0, 0, 'assault');
    actor.mixer.stopAllAction();
    actor.actions.idle.reset().setEffectiveWeight(1).play();
    actor.mixer.update(0.4);
    actor.mesh.updateMatrixWorld(true);
    const reviewScene = new T.Scene();
    reviewScene.background = new T.Color(0x303840);
    reviewScene.add(actor.mesh);
    reviewScene.add(new T.HemisphereLight(0xfff4e5, 0x667080, 2));
    const key = new T.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    reviewScene.add(key);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1280, 960);
    renderer.outputColorSpace = T.SRGBColorSpace;
    const camera = new T.PerspectiveCamera(32, 1280 / 960, 0.01, 20);
    camera.position.set(1.8, 1.5, 3.2);
    camera.lookAt(0, 0.98, 0);
    renderer.render(reviewScene, camera);
    const canvas = renderer.domElement;
    canvas.id = 'art-capture';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99999';
    document.body.append(canvas);
    window.__artCapture = { renderer, reviewScene, camera, actor };
  });
  await page
    .locator('#art-capture')
    .screenshot({ path: '.planning/research/.cache/06-art/tracer-armed.png' });
  await page.evaluate(() => {
    const { renderer, reviewScene, camera } = window.__artCapture;
    camera.position.set(0.5, 1.7, 1.05);
    camera.lookAt(0, 1.64, 0.03);
    renderer.render(reviewScene, camera);
  });
  await page
    .locator('#art-capture')
    .screenshot({ path: '.planning/research/.cache/06-art/tracer-face.png' });
  await page.evaluate(async () => {
    const { renderer, reviewScene, camera } = window.__artCapture;
    camera.position.set(0.85, 1.25, 1.0);
    camera.lookAt(0.12, 1.21, 0.35);
    renderer.render(reviewScene, camera);
  });
  await page
    .locator('#art-capture')
    .screenshot({ path: '.planning/research/.cache/06-art/tracer-hands.png' });
});

test('art tracer: human player and current M4 appear in Training Range third person', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
  await page.keyboard.press('v');
  const state = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const { weapon3p } = await import(src + 'builders/weapon.js');
    const { player } = await import(src + 'entities/player.js');
    const { getMode } = await import(src + 'modes/modeManager.js');
    return {
      mode: getMode()?.name,
      human: !!g.playerMesh.getObjectByName('HumanBody'),
      weapon: player.weapon,
      mount: weapon3p.parent?.name,
    };
  });
  expect(state.mode).toBe('range');
  expect(state.human).toBe(true);
  expect(state.weapon).toBe('m4');
  expect(state.mount).toBe('hand_r');
  await page.screenshot({ path: '.planning/research/.cache/06-art/tracer-game.png' });
});

test('art soldier: fitted painted equipment survives actual gameplay pose sampling', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const T = window.__THREE;
    const actor = g.buildEnemyMesh(0, 0, 'assault');
    const names = ['ChestPlate', 'BackPlate', 'RaisedFabricCollar', 'OpenHelmet',
      'ShoulderPlate_l', 'ForearmGuard_r', 'ShinPanel_l', 'BootToe_r', 'HelmetRim'];
    const domains = new Set(), maps = new Set();
    actor.mesh.traverse((n) => {
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
        if (m?.userData.artDomain) domains.add(m.userData.artDomain);
        if (m?.map) maps.add(m.map.uuid);
      }
    });
    const scene = new T.Scene();
    scene.background = new T.Color(0x303840);
    scene.add(actor.mesh, new T.HemisphereLight(0xfff4e5, 0x667080, 2));
    const key = new T.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5); scene.add(key);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1280, 960); renderer.outputColorSpace = T.SRGBColorSpace;
    const camera = new T.PerspectiveCamera(32, 1280 / 960, 0.01, 30);
    renderer.domElement.id = 'soldier-capture';
    renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:99999';
    document.body.append(renderer.domElement);
    window.__soldierReview = { actor, scene, renderer, camera };
    return { equipment: names.map((name) => !!actor.mesh.getObjectByName(name)),
      domains: [...domains], maps: maps.size };
  });
  expect(result.equipment.every(Boolean)).toBe(true);
  expect(result.domains).toEqual(expect.arrayContaining(['skin', 'fabric', 'armor', 'team-accent', 'ink']));
  expect(result.maps).toBeGreaterThanOrEqual(4);
  for (const pose of ['idle', 'walk', 'run', 'walk_back', 'strafe_l', 'strafe_r', 'crouch',
    'crouch_walk', 'jump_start', 'jump_loop', 'jump_land', 'reload', 'nade', 'punch_cross', 'death']) {
    const state = await page.evaluate((pose) => {
      const { actor, scene, renderer, camera } = window.__soldierReview;
      const action = actor.actions[pose];
      if (!action) return { missing: pose };
      actor.mixer.stopAllAction(); action.reset().setEffectiveWeight(1).play();
      actor.mixer.update(action.getClip().duration * 0.4); actor.mesh.updateMatrixWorld(true);
      let finite = true;
      const T = window.__THREE, v = new T.Vector3();
      actor.mesh.traverse((n) => {
        if (!n.isSkinnedMesh) return;
        for (let i = 0; i < n.geometry.attributes.position.count; i += 37) {
          v.fromBufferAttribute(n.geometry.attributes.position, i); n.applyBoneTransform(i, v);
          if (![v.x, v.y, v.z].every(Number.isFinite)) finite = false;
        }
      });
      camera.position.set(1.8, 1.5, 3.2); camera.lookAt(0, 0.98, 0);
      renderer.render(scene, camera);
      return { finite, mount: actor.mesh.getObjectByName('enemyWeaponMount').parent.name };
    }, pose);
    expect(state.missing).toBeUndefined();
    expect(state.finite).toBe(true);
    expect(state.mount).toBe('hand_r');
    await page.locator('#soldier-capture').screenshot({ path: `.planning/research/.cache/06-art/soldier-${pose}.png` });
  }
  for (const view of ['face', 'hands', 'front', 'shadow', 'distant']) {
    await page.evaluate((view) => {
      const { actor, scene, renderer, camera } = window.__soldierReview;
      actor.mixer.stopAllAction(); actor.actions.idle.reset().setEffectiveWeight(1).play();
      actor.mixer.update(0.4);
      if (view === 'face') { camera.position.set(0.5, 1.7, 1.05); camera.lookAt(0, 1.64, 0.03); }
      else if (view === 'hands') { camera.position.set(0.85, 1.25, 1); camera.lookAt(0.12, 1.21, 0.35); }
      else { camera.position.set(view === 'distant' ? 0 : 0.2, 1.5, view === 'distant' ? 12 : 3.5); camera.lookAt(0, 1, 0); }
      scene.children.filter((n) => n.isLight).forEach((n) => { n.intensity = view === 'shadow' ? 0.6 : 2; });
      renderer.render(scene, camera);
    }, view);
    await page.locator('#soldier-capture').screenshot({ path: `.planning/research/.cache/06-art/soldier-${view}.png` });
  }
});

test('art slice: shared illustrated M4 and scoped Greek Columns slots load in the game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { wpn, weapon3p } = await import(src + 'builders/weapon.js');
    const { buildEnemyWeapon3p } = await import(src + 'builders/enemyWeapon.js');
    const { bunkerMapDef } = await import(src + 'maps/bunker.js');
    const { matWall } = await import(src + 'materials.js');
    const guns = [wpn.children.find((n) => n.isGroup && n.visible),
      weapon3p.children.find((n) => n.visible), buildEnemyWeapon3p('assault')];
    const maps = [], domains = [];
    guns.forEach((gun) => gun.traverse((node) => {
      if (!node.isMesh) return;
      maps.push(node.material.map);
      domains.push(node.material.userData.artDomain);
    }));
    await new Promise((resolve, reject) => {
      let retries = 0;
      const poll = () => {
        if (maps.every((map) => map?.image?.width === 1024)) resolve();
        else if (++retries > 100) reject(new Error('Atlas not loaded'));
        else setTimeout(poll, 30);
      };
      poll();
    });
    return {
      domains, shared: maps.every((map) => map.source === maps[0].source),
      image: maps[0].image.src, colorSpace: maps[0].colorSpace,
      stone: Object.values(bunkerMapDef.materials).map((m) => ({ domain: m.userData.artDomain,
        ready: m.map?.image?.width === 1024, region: m.userData.atlasRegion })),
      scoped: bunkerMapDef.materials.wall !== matWall && !matWall.userData.artDomain,
    };
  });
  expect(result.domains.every((domain) => domain === 'weapon')).toBe(true);
  expect(result.shared).toBe(true);
  expect(result.image).toContain('/textures/comic-slice.png');
  expect(result.colorSpace).toBe('srgb');
  expect(result.stone.every((m) => m.ready && m.domain === 'stone')).toBe(true);
  expect(result.scoped).toBe(true);
  await page.keyboard.press('v');
  await page.screenshot({ path: '.planning/research/.cache/06-art/slice-range.png' });
});

test('art slice: missing paint preserves usable shaded materials and weapon geometry', async ({ page }) => {
  await page.route('**/textures/comic-slice.png', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  const state = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { makeIllustratedMaterial } = await import(src + 'artMaterials.js');
    const { buildEnemyWeapon3p } = await import(src + 'builders/enemyWeapon.js');
    const { bunkerMapDef } = await import(src + 'maps/bunker.js');
    const material = makeIllustratedMaterial('metal');
    return { map: material.map, type: material.type, color: material.color.getHex(),
      failed: material.userData.paintState, meshes: buildEnemyWeapon3p('assault').children.length,
      stones: Object.values(bunkerMapDef.materials).every((m) => m.map === null && m.color.getHex() > 0) };
  });
  expect(state.map).toBeNull();
  expect(state.type).toBe('MeshStandardMaterial');
  expect(state.color).toBeGreaterThan(0);
  expect(state.failed).toBe('failed');
  expect(state.meshes).toBe(4);
  expect(state.stones).toBe(true);
});

test('art slice: TDM builds painted Greek Columns structural walls and floors without world changes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  await expect(page.locator('#tdm-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('.map-card[data-map="bunker"]').click();
  await page.locator('#tdm-startbtn').click();
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { scene, camera, renderer } = await import(src + 'scene.js');
    const { bunkerMapDef } = await import(src + 'maps/bunker.js');
    const { bunkerData } = await import(src + 'shared/maps/bunker.js');
    const { getMode } = await import(src + 'modes/modeManager.js');
    const surfaces = [], structures = [];
    scene.traverse((n) => {
      if (!n.isMesh) return;
      const stone = (Array.isArray(n.material) ? n.material : [n.material]).filter((m) => m?.userData.artDomain === 'stone');
      if (!stone.length) return;
      surfaces.push(...stone.map((m) => m.map?.image?.width === 1024));
      if (n.geometry.type === 'BoxGeometry') structures.push(n.geometry.parameters.width);
    });
    camera.position.set(34, 3.2, 36); camera.lookAt(46, 2, 40); renderer.render(scene, camera);
    return { mode: getMode()?.name, surfaces, structures,
      world: bunkerMapDef.tiles === bunkerData.tiles && bunkerMapDef.heightmap === bunkerData.heightmap &&
        bunkerMapDef.spawnPlayer === bunkerData.spawnPlayer && bunkerMapDef.spawnAttacker === bunkerData.spawnAttacker &&
        bunkerMapDef.spawnDefender === bunkerData.spawnDefender };
  });
  expect(result.mode).toBe('tdm');
  expect(result.surfaces.length).toBeGreaterThan(100);
  expect(result.surfaces.every(Boolean)).toBe(true);
  expect(result.structures.length).toBeGreaterThan(0);
  expect(result.world).toBe(true);
  await page.locator('canvas').first().screenshot({ path: '.planning/research/.cache/06-art/slice-greek-columns.png' });
});

test('art slice: base-prefixed production build resolves the painted assets', async ({ page }) => {
  test.setTimeout(90000);
  const directory = await mkdtemp(path.join(tmpdir(), 'vod-art-prefix-'));
  const vite = path.resolve('node_modules/vite/bin/vite.js');
  const env = { ...process.env, PUBLIC_BASE: '/art-prefix/' };
  let server;
  try {
    await promisify(execFile)(process.execPath, [vite, 'build', '--outDir', directory], { env, windowsHide: true });
    const port = await new Promise((resolve) => {
      const probe = createServer();
      probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
    });
    server = spawn(process.execPath, [vite, 'preview', '--outDir', directory,
      '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, windowsHide: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Owned prefix preview did not start')), 15000);
      server.once('error', reject);
      server.stdout.on('data', (data) => { if (data.toString().includes('Local:')) { clearTimeout(timer); resolve(); } });
      server.once('exit', (code) => { if (code) { clearTimeout(timer); reject(new Error('Preview exited')); } });
    });
    const base = `http://127.0.0.1:${port}/art-prefix/`;
    const failed = [];
    page.on('requestfailed', (request) => { if (request.method() === 'GET' && (request.url().includes('/models/') || request.url().includes('/textures/'))) failed.push(request.url() + ' ' + request.failure()?.errorText); });
    await page.goto(base);
    await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
    expect(await page.evaluate(() => !!window.__bodyRef()?.getObjectByName('HumanBody'))).toBe(true);
    await page.locator('#range-startbtn').click();
    await page.keyboard.press('v');
    await page.waitForFunction(() => {
      const maps = [];
      window.__bodyRef()?.traverse((n) => {
        for (const m of Array.isArray(n.material) ? n.material : [n.material])
          if (m?.userData.artDomain === 'weapon') maps.push(m.map);
      });
      return maps.length > 0 && maps.every((map) => map?.image?.src.includes('/art-prefix/textures/comic-slice.png'));
    });
    expect(failed).toEqual([]);
    expect((await page.request.get(base + 'textures/comic-slice.png')).ok()).toBe(true);
    await page.screenshot({ path: '.planning/research/.cache/06-art/slice-prefix-production.png' });
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill(); await exited;
    }
    const relative = path.relative(tmpdir(), directory);
    if (relative.startsWith('vod-art-prefix-') && !relative.includes(path.sep))
      await rm(directory, { recursive: true, force: true });
  }
});
