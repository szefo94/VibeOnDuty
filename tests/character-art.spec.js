import { test, expect } from '@playwright/test';

test('art tracer: anatomical face and separate fingers load through the actual game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 30000 });
  const result = await page.evaluate(async () => {
    const g = await import(new URL('src/builders/enemyGLTF.js', location.href).href);
    const actor = g.buildEnemyMesh(0, 0, 'assault');
    const skins = []; actor.mesh.traverse((node) => {
      if (node.isSkinnedMesh && node.name === 'HumanBody') {
        const p = node.geometry.attributes.position;
        const indices = node.geometry.attributes.skinIndex;
        const weights = node.geometry.attributes.skinWeight;
        const fingers = new Set();
        for (let i = 0; i < p.count; i++) for (let j = 0; j < 4; j++) {
          if (weights.getComponent(i, j) > 0.05) {
            const name = node.skeleton.bones[indices.getComponent(i, j)].name;
            if (/^(thumb|index|middle|ring|pinky)_/.test(name)) fingers.add(name.split('_')[0] + name.slice(-2));
          }
        }
        skins.push({ vertices: p.count, fingers: [...fingers], face: node.userData.anatomicalFace });
      }
    });
    const resolved = ['idle', 'walk', 'run', 'reload', 'crouch', 'jump_start', 'jump_land'].every((key) => actor.actions[key]);
    g.disposeEnemyMesh(actor.mesh, actor.mixer);
    return { loaded: g.usingGLTF, skins, resolved };
  });
  expect(result.loaded).toBe(true);
  expect(result.skins.length, 'anatomical render topology must replace the mannequin').toBeGreaterThan(0);
  expect(result.skins[0].vertices).toBeGreaterThan(8000);
  expect(result.skins[0].fingers).toHaveLength(10);
  expect(result.skins[0].face).toBe(true);
  expect(result.resolved).toBe(true);
});
