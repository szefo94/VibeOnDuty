import { test, expect } from '@playwright/test';

test('resources: a failed owner callback still retires every real clone resource once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const r = await import(src + 'builders/characterResources.js');
    const { scene } = await import(src + 'scene.js');
    const actor = g.buildEnemyMesh(2, 2); scene.add(actor.mesh);
    let later = 0, failures = 0;
    r.registerCharacterDisposer(actor.mesh, () => { throw Error('retired owner failed'); });
    r.registerCharacterDisposer(actor.mesh, () => { ++later; });
    for (let i = 0; i < 2; i++) {
      try { r.disposeCharacter(actor.mesh, actor.mixer); } catch { ++failures; }
    }
    const next = g.buildEnemyMesh(3, 2);
    const usable = !!next.mesh.getObjectByName('HumanBody');
    r.disposeCharacter(next.mesh, next.mixer);
    return { later, failures, attached: !!actor.mesh.parent, active: actor.mixer.stats.bindings.inUse, usable };
  });
  expect(result).toEqual({ later: 1, failures: 1, attached: false, active: 0, usable: true });
});
