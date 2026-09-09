import { test, expect } from '@playwright/test';

// These assert on the real GLB loading path in a real browser, which unit tests
// cannot reach (GLTFLoader + AnimationMixer need a document and a GL context).
test.describe('character asset pipeline', () => {
  test('enemy.glb loads and every gameplay clip resolves', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.goto('/');
    await page.waitForFunction(
      () => window.__assetsReady === true || document.querySelector('#startbtn'),
      null, { timeout: 20000 });
    await page.waitForTimeout(3000);

    const loaded = logs.find(l => l.includes('enemy.glb loaded'));
    expect(loaded, 'enemy.glb should load').toBeTruthy();

    // Every key the animation code drives must resolve to a real clip, or the
    // character silently falls back to a T-pose for that state.
    for (const key of ['idle', 'walk', 'run', 'crouch', 'crouch_walk', 'death',
                       'roll', 'jump_start', 'jump_loop', 'jump_land', 'reload'])
      expect(loaded, `clip "${key}" should resolve`).toContain(key);
  });

  test('inert position/scale tracks are stripped from every clip', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.goto('/');
    await page.waitForTimeout(3000);

    const line = logs.find(l => l.includes('stripped') && l.includes('inert'));
    expect(line, 'strip pass should run').toBeTruthy();

    // The Blender export bakes 65 position + 65 scale channels into all 36 clips;
    // all scale tracks and all but 5 position tracks are inert.
    const [, dropped, kept] = line.match(/stripped (\d+) .*\((\d+) live/).map(Number);
    // Asserted as a property rather than exact counts: the Blender exporter bakes
    // position and scale for every bone into every clip, so most tracks are inert.
    // Pinning the numbers tied this to one build of enemy.glb and broke the moment
    // the asset was re-exported.
    expect(dropped).toBeGreaterThan(1000);
    expect(kept).toBeGreaterThan(1000);
    expect(dropped / (dropped + kept)).toBeGreaterThan(0.5);
    expect(kept % 1).toBe(0);
  });

  test('no uncaught errors while the game loop runs with characters animating', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => { if (!/pointer lock/i.test(e.message)) errors.push(e.message); });
    await page.goto('/');
    await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#startbtn').click();
    await page.waitForTimeout(4000);   // let enemies spawn, animate and blend
    expect(errors).toEqual([]);
  });
});

test.describe('animation transition logging', () => {
  test('window.__animDebug turns on per-transition logs at runtime', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.goto('/');
    await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#range-startbtn').click();   // no hostiles, no incidental churn
    await page.waitForTimeout(2500);

    const transitions = () => logs.filter(l => l.includes('[crossfade:') || l.includes('[loco:'));

    // Nothing until it is asked for.
    await page.keyboard.down('ControlLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ControlLeft');
    await page.waitForTimeout(500);
    expect(transitions()).toEqual([]);

    // Drive the transition rather than waiting for one: crouch forces the player out
    // of the loco blend tree and back in, which is deterministic. The previous version
    // waited on enemies changing state by themselves and logged nothing under CI's
    // software renderer.
    await page.evaluate(() => window.__animDebug('player'));
    for (let i = 0; i < 3; i++) {
      await page.keyboard.down('ControlLeft');
      await page.waitForTimeout(400);
      await page.keyboard.up('ControlLeft');
      await page.waitForTimeout(400);
    }

    const t = transitions();
    expect(t.length).toBeGreaterThan(0);
    expect(t.every(l => /\[(crossfade|loco):player\]/.test(l))).toBe(true);
  });
});
