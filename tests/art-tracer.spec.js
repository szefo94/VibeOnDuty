import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The Blender pipeline (tools/art/pipeline.mjs build) runs these cases against a candidate
// model before publishing it: VOD_ART_CANDIDATE routes the game's model request to the file.
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
    .screenshot({ path: '.cache/art/tracer-armed.png' });
  await page.evaluate(() => {
    const { renderer, reviewScene, camera } = window.__artCapture;
    camera.position.set(0.5, 1.7, 1.05);
    camera.lookAt(0, 1.64, 0.03);
    renderer.render(reviewScene, camera);
  });
  await page
    .locator('#art-capture')
    .screenshot({ path: '.cache/art/tracer-face.png' });
  await page.evaluate(async () => {
    const { renderer, reviewScene, camera } = window.__artCapture;
    camera.position.set(0.85, 1.25, 1.0);
    camera.lookAt(0.12, 1.21, 0.35);
    renderer.render(reviewScene, camera);
  });
  await page
    .locator('#art-capture')
    .screenshot({ path: '.cache/art/tracer-hands.png' });
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
  await page.screenshot({ path: '.cache/art/tracer-game.png' });
});

