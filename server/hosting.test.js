import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startMpFixture } from '../tests/helpers/mpServer.js';
import { createHostileClient } from './testHelpers/hostileClient.js';

let fixture;
beforeAll(async () => { fixture = await startMpFixture(); }, 30000);
afterAll(async () => { await fixture?.stop(); }, 15000);

function rejectedSocket(url, origin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url.replace('http', 'ws') + '/unknown/room', {
      headers: origin ? { Origin: origin } : {},
    });
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('WS rejection timed out')); }, 2000);
    socket.on('unexpected-response', (_req, res) => {
      clearTimeout(timer); res.resume(); socket.terminate(); resolve(res.statusCode);
    });
    socket.on('open', () => { clearTimeout(timer); socket.close(); resolve(101); });
    socket.on('error', () => {});
  });
}

describe('built-game host boundary', () => {
  it('rejects absent and foreign WebSocket origins at handshake', async () => {
    expect(await rejectedSocket(fixture.url)).toBe(403);
    expect(await rejectedSocket(fixture.url, 'https://foreign.example')).toBe(403);
  });
  it('serves real index, referenced assets and GLB from the selected output only', async () => {
    const html = await (await fetch(fixture.url)).text();
    expect(html).toBe(await readFile(join(fixture.buildDir, 'index.html'), 'utf8'));
    const asset = html.match(/src="(\/assets\/[^" ]+)"/)[1];
    expect((await fetch(fixture.url + asset)).status).toBe(200);
    const glb = await fetch(fixture.url + '/models/enemy.glb');
    expect(Buffer.from(await glb.arrayBuffer()).subarray(0, 4).toString()).toBe('glTF');
    expect(await (await fetch(fixture.url + '/health')).json()).toEqual({ ready: true });
    const client = await createHostileClient(fixture.url);
    await client.close();
  });
  it.each(['/server/index.js', '/src/main.js', '/package.json', '/.git/config',
    '/.vod-server/tls/pair.json', '/tls/key.pem', '/../server/index.js'])('hides %s', async (path) => {
    const res = await fetch(fixture.url + path);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('PRIVATE KEY');
  });
});
