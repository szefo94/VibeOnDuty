import { test, expect } from '@playwright/test';
import { startMpFixture } from './helpers/mpServer.js';

// Selected by the offline configuration. The existing smoke/animation suites still
// run against Vite; this lifecycle slice needs a genuine production room to leave.
test('offline modes and editor remain usable after each real online retirement', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  try {
    const page = await context.newPage();
    const errors = [];
    const admission = [];
    page.on('response', (response) => {
      if (response.url().includes('/matchmake/'))
        admission.push({ url: response.url(), status: response.status() });
    });
    page.on('pageerror', (error) => {
      if (!/pointer lock|WrongDocumentError/i.test(error.message)) errors.push(error.message);
    });
    await page.goto(fixture.url);
    for (const [button, mode, hud] of [
      ['startbtn', null, '#hud'],
      ['adaptive-startbtn', null, '#hud'],
      ['snd-startbtn', 'snd', '#snd-bar'],
      ['tdm-startbtn', 'tdm', '#tdm-bar'],
      ['range-startbtn', 'range', '#range-hud'],
      ['editor-startbtn', null, '#editor-overlay'],
    ]) {
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await expect(page.locator('#range-hud')).toHaveCount(0);
      await page.locator('#mp-join-btn').click();
      try {
        await expect.poll(() => page.evaluate(() => window.__mpDebug().sessionId)).toBeTruthy();
      } catch (error) {
        await test.info().attach('online-entry-diagnostic', {
          body: JSON.stringify({ button, admission, errors, state: await page.evaluate(() => ({
            debug: window.__mpDebug(),
            menu: document.getElementById('overlay')?.innerText,
            error: document.getElementById('mp-error-message')?.textContent,
            joiningDisabled: document.getElementById('mp-join-btn')?.disabled,
          })) }, null, 2),
          contentType: 'application/json',
        });
        throw error;
      }
      await page.evaluate(() => document.exitPointerLock());
      await page.locator('#mp-match-leave').click();
      await expect(page.locator('#overlay')).toBeVisible();
      await expect(page.locator('#range-hud')).toHaveCount(0);
      expect(await page.evaluate(() => window.__mpDebug())).toMatchObject({
        sessionId: null,
        remoteActorCount: 0,
        inputHandlerCount: 0,
        presentation: { mode: null },
      });
      await expect(page.locator(`#${button}`)).toBeEnabled();
      await page.locator(`#${button}`).click();
      await expect(page.locator(hud)).toBeVisible();
      await expect(page.locator('#overlay')).toBeHidden();
      expect(await page.evaluate(() => window.__mpDebug().presentation.mode)).toBe(mode);
      await page.screenshot({ path: test.info().outputPath(`offline-${button}.png`) });
      if (button === 'editor-startbtn') await page.locator('#ed-back').click();
      else await page.evaluate(() => document.getElementById('pause-mainmenu-btn').click());
      await expect(page.locator('#overlay')).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    try {
      await context.close();
    } finally {
      await fixture.stop();
    }
  }
});
