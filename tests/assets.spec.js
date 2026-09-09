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
    // 36 clips x 195 channels = 7020 tracks; 2340 scale + 2316 constant position are inert.
    expect(dropped).toBe(4656);
    expect(kept).toBe(2364);                                  // 2340 rotation + 24 live position
    expect(dropped / (dropped + kept)).toBeGreaterThan(0.65); // ~2/3 of tracks were dead
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

test.describe('upper-body aim layer', () => {
  test('crouch keeps the arms in the aim pose, not the crouch clip pose', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#range-startbtn').click();   // no hostiles
    await page.waitForTimeout(2500);
    await page.keyboard.press('KeyV');               // third person
    await page.waitForTimeout(800);

    const read = () => page.evaluate(() => {
      const o = {};
      for (const n of ['upperarm_l', 'upperarm_r', 'thigh_l'])
        o[n] = window.__debugBone(n);
      return o;
    });

    const standing = await read();
    await page.keyboard.down('ControlLeft');
    await page.waitForTimeout(1500);
    const crouched = await read();
    await page.keyboard.up('ControlLeft');

    const ang = (a, b) => {
      const d = Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]);
      return Math.acos(Math.min(1, d)) * 2 * 180 / Math.PI;
    };
    // Legs must actually crouch...
    expect(ang(standing.thigh_l, crouched.thigh_l)).toBeGreaterThan(20);
    // ...while the shoulders stay on the aim pose. Without the layer these sat
    // ~167 deg apart, which is the "arms revolving from the shoulders" report.
    expect(ang(standing.upperarm_l, crouched.upperarm_l)).toBeLessThan(15);
    expect(ang(standing.upperarm_r, crouched.upperarm_r)).toBeLessThan(15);
  });
});
