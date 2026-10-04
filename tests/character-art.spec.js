import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  if (process.env.VOD_ART_CANDIDATE) {
    const body = await readFile(process.env.VOD_ART_CANDIDATE);
    await page.route('**/models/enemy.glb', (route) =>
      route.fulfill({ body, contentType: 'model/gltf-binary' })
    );
  }
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

