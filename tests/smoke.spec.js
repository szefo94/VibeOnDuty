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

    // Wait for the start button to be ready
    const startBtn = page.locator('#startbtn');
    await expect(startBtn).toBeVisible();

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
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await page.locator('#snd-startbtn').click();

    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#snd-bar')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('S&D match header shows correct initial values', async ({ page }) => {
    await page.goto('/');
    await page.locator('#snd-startbtn').click();

    await expect(page.locator('#snd-round-num')).toHaveText('ROUND 1/7');
    await expect(page.locator('#snd-player-score')).toHaveText('0');
    await expect(page.locator('#snd-enemy-score')).toHaveText('0');
  });
});
