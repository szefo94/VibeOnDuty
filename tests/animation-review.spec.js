import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

let server, url;
test.beforeAll(async () => {
  server = await createServer({ root: 'C:/Programowanie/VibeOnDuty', base: '/',
    server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
async function range(page) {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
  await page.keyboard.press('F3');
}
async function live(page) {
  return page.evaluate(async () => {
    const { player } = await import('/src/entities/player.js');
    const { camera } = await import('/src/scene.js');
    return { weapon: player.weapon, ammo: player.ammo, hp: player.hp,
      position: camera.position.toArray(), reload: player.reloadTimer };
  });
}
test('tracer: isolated real M4 playback pauses, scrubs, resets and closes without outcomes', async ({ page }) => {
  await range(page);
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Animation review', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  const before = await live(page);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__animationReviewDebug().phase)).toBe(0);
  await page.getByLabel('Transition', { exact: true }).selectOption('reload');
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play transition', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__animationReviewDebug().phase)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause transition', exact: true }).click();
  await page.getByLabel('Animation phase', { exact: true }).fill('40');
  const debug = await page.evaluate(() => window.__animationReviewDebug());
  expect(debug.phase).toBe(.4); expect(debug.actorCount).toBe(1); expect(debug.viewCount).toBe(1);
  expect(debug.actor.joints).toBe(65); expect(debug.actor.contacts.leftError).toBeLessThan(.025);
  expect(await live(page)).toEqual(before);
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  expect(await page.evaluate(() => window.__animationReviewDebug().phase)).toBe(0);
  await page.getByRole('button', { name: 'Close review', exact: true }).click();
  expect(await page.evaluate(() => window.__animationReviewDebug().actorCount)).toBe(0);
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeFocused();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
});
