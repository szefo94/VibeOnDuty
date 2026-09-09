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
    await page.locator('#startbtn').click();
    await page.waitForTimeout(4000);   // let enemies spawn, animate and blend
    expect(errors).toEqual([]);
  });
});

test.describe('experimental retarget-space fix', () => {
  test('fits a per-bone delta with a low residual and applies cleanly', async ({ page }) => {
    const logs = [], errors = [];
    page.on('console', m => logs.push(m.text()));
    page.on('pageerror', e => { if (!/pointer lock/i.test(e.message)) errors.push(e.message); });

    await page.addInitScript(() => localStorage.setItem('animSpaceFix', '1'));
    await page.goto('/');
    await page.waitForTimeout(3500);

    const residuals = logs.filter(l => l.includes('space delta'));
    expect(residuals.length, 'both source pairs should be fitted').toBe(2);

    // A constant per-bone rotation should reproduce the paired clip closely; a large
    // residual would mean the two clips are not the same animation and the delta is junk.
    for (const line of residuals) {
      const deg = Number(line.match(/residual ([\d.]+) deg/)[1]);
      expect(deg, line).toBeLessThan(12);
    }

    expect(logs.find(l => l.includes('anim space fix applied to'))).toContain('10 clips');
    expect(errors).toEqual([]);
  });
});

test.describe('animation transition logging', () => {
  test('window.__animDebug turns on per-transition logs at runtime', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.goto('/');
    await page.locator('#startbtn').click();

    // Nothing should be logged until it is asked for.
    await page.waitForTimeout(1500);
    expect(logs.filter(l => l.includes('[crossfade:') || l.includes('[loco:'))).toEqual([]);

    await page.evaluate(() => window.__animDebug(true));
    await page.waitForTimeout(4000);

    // Enemies constantly change state, so transitions must appear once enabled.
    const t = logs.filter(l => l.includes('[crossfade:') || l.includes('[loco:'));
    expect(t.length).toBeGreaterThan(0);
    expect(t.every(l => /\[(crossfade|loco):(player|enemy)\]/.test(l))).toBe(true);
  });
});
