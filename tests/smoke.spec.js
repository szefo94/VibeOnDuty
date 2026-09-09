import { test, expect } from '@playwright/test';

test.describe('VIBE ON DUTY — smoke tests', () => {
  test('page loads and shows the start overlay', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');

    // Title is correct
    await expect(page).toHaveTitle('VIBE ON DUTY');

    // Overlay is visible before the game starts
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();

    // Start button is present
    await expect(page.locator('#startbtn')).toBeVisible();

    // No uncaught JS errors on load
    expect(errors).toHaveLength(0);
  });

  test('clicking DROP IN hides the overlay', async ({ page }) => {
    await page.goto('/');

    // Buttons render immediately but stay disabled until loadAll() resolves, so
    // waiting only for visibility can click a dead button.
    const startBtn = page.locator('#startbtn');
    await expect(startBtn).toBeEnabled({ timeout: 20000 });

    await startBtn.click();

    // Overlay should be hidden after clicking
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeHidden();
  });

  test('HUD elements are present in the DOM', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#hud')).toBeAttached();
    await expect(page.locator('#mm')).toBeAttached();       // minimap canvas
    await expect(page.locator('#hp-num')).toBeAttached();   // health display
    await expect(page.locator('#ammo-cur')).toBeAttached(); // ammo display
  });

  test('ammo and HP show correct initial values', async ({ page }) => {
    await page.goto('/');

    // HUD is initialised on page load before the game loop starts — read before
    // clicking DROP IN so enemies haven't had a chance to deal damage yet.
    await expect(page.locator('#ammo-cur')).toHaveText('30');
    await expect(page.locator('#ammo-rsv')).toHaveText('90');
    await expect(page.locator('#hp-num')).toHaveText('100');
  });
});

test.describe('VIBE ON DUTY — S&D mode smoke tests', () => {
  test('S&D button is present on overlay', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#snd-startbtn')).toBeVisible();
  });

  test('clicking S&D MODE hides overlay and shows snd-bar', async ({ page }) => {
    const errors = [];
    // Pointer-lock is unavailable in headless Playwright — filter that expected browser error.
    page.on('pageerror', e => {
      if (!e.message.includes('pointer lock')) errors.push(e.message);
    });

    await page.goto('/');
    await expect(page.locator('#snd-startbtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#snd-startbtn').click();

    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#snd-bar')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('S&D match header shows correct initial values', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#snd-startbtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#snd-startbtn').click();

    await expect(page.locator('#snd-round-num')).toHaveText('ROUND 1/7');
    await expect(page.locator('#snd-player-score')).toHaveText('0');
    await expect(page.locator('#snd-enemy-score')).toHaveText('0');
  });
});

test.describe('build version stamp', () => {
  test('shows the commit on the overlay, in the console and on window', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.goto('/');

    // Visible on the start overlay, so you can tell what a deployed build is running
    // without opening devtools.
    const stamp = page.locator('#build-stamp');
    await expect(stamp).toBeVisible();
    await expect(stamp).toHaveText(/^[\w.\/-]+@[0-9a-f]{7}(\+dirty)?$/);

    // Logged on boot, and readable programmatically.
    expect(logs.find(l => l.includes('[BUILD]'))).toBeTruthy();
    const build = await page.evaluate(() => window.__build);
    expect(build.sha).toMatch(/^[0-9a-f]{7}(\+dirty)?$/);
    expect(build.branch).toBeTruthy();
  });
});
