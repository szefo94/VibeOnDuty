import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { startMpFixture } from './helpers/mpServer.js';

test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

test('hosting: shared-map URL renders literal text and only editor PNG thumbnails', async ({ browser }) => {
  test.setTimeout(180000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 });
  try {
    const page = await context.newPage();
    const markup = '<img src=x onerror="document.body.dataset.reviewXss=1">';
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
    for (const thumbnail of [
      'x" onerror="document.body.dataset.reviewThumbXss=1',
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="document.body.dataset.reviewThumbXss=1"/>',
      'https://foreign.example/thumbnail.png',
      png,
    ]) {
      const map = { v: 2, w: 1, h: 1, floors: [{ base: 0, t: [0], hm: [0] }],
        name: markup, desc: markup, thumb: thumbnail };
      await page.goto(`${fixture.url}/?map=${encodeURIComponent(Buffer.from(JSON.stringify(map)).toString('base64'))}`);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      const card = page.locator('.map-card[data-map="custom"]');
      await expect(card.locator('.map-name')).toHaveText(markup.toUpperCase());
      await expect(card.locator('.map-sub')).toHaveText(markup);
      await expect(card.locator('.map-name img, .map-sub img')).toHaveCount(0);
      await expect(card.locator('img')).toHaveCount(thumbnail === png ? 1 : 0);
      if (thumbnail === png) {
        await expect(card.locator('img')).toHaveAttribute('src', png);
        await expect.poll(() => card.locator('img').evaluate((image) => image.naturalWidth)).toBe(1);
      }
      expect(await page.evaluate(() => ({ xss: document.body.dataset.reviewXss,
        thumb: document.body.dataset.reviewThumbXss }))).toEqual({ xss: undefined, thumb: undefined });
    }
  } finally { await context.close(); await fixture.stop(); }
});

test('hosting: two production browsers share HTTPS assets and the same WSS room', async ({ browser }) => {
  test.setTimeout(180000);
  const fixture = await startMpFixture({ tls: true, publicAddress: '127.0.0.1' });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({
      viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25,
      // Automation only: this does not prove the manual browser trust procedure.
      ignoreHTTPSErrors: true,
    }));
    const sockets = [[], []];
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    for (const [index, page] of pages.entries()) {
      page.on('websocket', (socket) => sockets[index].push(socket.url()));
      const response = await page.goto(fixture.url);
      expect(response.status()).toBe(200);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await expect.poll(() => page.evaluate(() => window.__mpDebug().sessionId), { timeout: 30000 }).toBeTruthy();
    }
    for (const page of pages) {
      await expect.poll(() => page.evaluate(() => window.__mpDebug().players.length)).toBe(2);
      await expect.poll(() => page.evaluate(() => window.__mpDebug().remoteActorCount)).toBe(1);
      expect(await page.evaluate(() => window.__mpDebug().usingGLTF)).toBe(true);
      expect(new URL(page.url()).origin).toBe(fixture.url);
    }
    const states = await Promise.all(pages.map((page) => page.evaluate(() => window.__mpDebug())));
    expect(states[0].sessionId).not.toBe(states[1].sessionId);
    expect(states[0].roomId).toBe(states[1].roomId);
    for (const urls of sockets) {
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(new URL(url).protocol).toBe('wss:');
        expect(new URL(url).host).toBe(new URL(fixture.url).host);
      }
    }
    const glb = await contexts[0].request.get(fixture.url + '/models/enemy.glb');
    expect(glb.status()).toBe(200);
    expect((await glb.body()).subarray(0, 4).toString()).toBe('glTF');
    const html = await (await contexts[0].request.get(fixture.url)).text();
    const asset = html.match(/src="(\/assets\/[^" ]+)"/)[1];
    expect((await contexts[0].request.get(fixture.url + asset)).status()).toBe(200);
    for (const path of ['/server/tls.js', '/src/main.js', '/.vod-server/tls/pair.json', '/tls/pair.json', '/key.pem', '/package.json']) {
      const forbidden = await contexts[0].request.get(fixture.url + path);
      expect(forbidden.status()).toBe(404);
      expect(await forbidden.text()).not.toContain('PRIVATE KEY');
    }
    expect(fixture.output()).not.toContain('PRIVATE KEY');
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await fixture.stop();
  }
});

test('hosting: HTTPS restart keeps the valid pair bytes and mtime', async ({ browser }) => {
  test.setTimeout(90000);
  const fixture = await startMpFixture({ tls: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, deviceScaleFactor: 0.25 });
  try {
    const path = join(fixture.certificateDir, 'pair.json');
    const bytes = await readFile(path, 'utf8');
    const modified = (await stat(path)).mtimeMs;
    const oldPid = fixture.child.pid;
    await fixture.restart();
    expect(fixture.child.pid).not.toBe(oldPid);
    expect(await readFile(path, 'utf8')).toBe(bytes);
    expect((await stat(path)).mtimeMs).toBe(modified);
    const page = await context.newPage();
    const sockets = [];
    page.on('websocket', (socket) => sockets.push(socket.url()));
    await page.goto(fixture.url);
    await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await page.locator('#mp-join-btn').click();
    await expect.poll(() => page.evaluate(() => window.__mpDebug().sessionId), { timeout: 30000 }).toBeTruthy();
    expect(sockets.some((url) => url.startsWith(fixture.url.replace('https:', 'wss:')))).toBe(true);
  } finally { await context.close(); await fixture.stop(); }
});
