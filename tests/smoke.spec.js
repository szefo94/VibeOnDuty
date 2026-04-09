import { test, expect } from '@playwright/test';

test.describe('VIBE ON DUTY — smoke tests', () => {
  test('page loads and shows the start overlay', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/fps3d.html');

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
    await page.goto('/fps3d.html');

    // Wait for the start button to be ready
    const startBtn = page.locator('#startbtn');
    await expect(startBtn).toBeVisible();

    await startBtn.click();

    // Overlay should be hidden after clicking
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeHidden();
  });

  test('HUD elements are present in the DOM', async ({ page }) => {
    await page.goto('/fps3d.html');

    await expect(page.locator('#hud')).toBeAttached();
    await expect(page.locator('#mm')).toBeAttached();       // minimap canvas
    await expect(page.locator('#hp-num')).toBeAttached();   // health display
    await expect(page.locator('#ammo-cur')).toBeAttached(); // ammo display
  });

  test('ammo and HP show correct initial values', async ({ page }) => {
    await page.goto('/fps3d.html');

    // These are set by updateHUD() on game start — check after clicking DROP IN
    await page.locator('#startbtn').click();

    await expect(page.locator('#ammo-cur')).toHaveText('30');
    await expect(page.locator('#ammo-rsv')).toHaveText('90');
    await expect(page.locator('#hp-num')).toHaveText('100');
  });
});
