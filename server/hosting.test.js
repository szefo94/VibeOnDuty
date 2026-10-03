import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import WebSocket from 'ws';
import { allocateMpBuild, buildMpClient, startMpFixture } from '../tests/helpers/mpServer.js';
import { validateBuildDir } from './index.js';
import { defaultCertificateDir } from './cli.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { request } from 'node:https';
import { TdmRoom } from './tdmRoom.js';
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
  it('permits configured proxy Origin over private HTTP and rejects a foreign real join', async () => {
    const proxy = await startMpFixture({ publicAddress: 'https://play.example' });
    try {
      const { Client } = await import('@colyseus/sdk');
      const accepted = await new Client(proxy.url, { headers: { Origin: 'https://play.example' } })
        .joinOrCreate('tdm', { protocolVersion: 1 });
      try {
        await expect.poll(() => accepted.state?.players?.size ?? 0).toBe(1);
        await expect(new Client(proxy.url, { headers: { Origin: 'https://foreign.example' } })
          .joinOrCreate('tdm', { protocolVersion: 1 })).rejects.toThrow();
        expect(accepted.state.players.size).toBe(1);
        expect(proxy.output()).toContain('advertised=https://play.example');
        expect((await fetch(proxy.url)).status).toBe(200);
      } finally { await accepted.leave(); }
    } finally { await proxy.stop(); }
  }, 30000);
  it('bridges validated operator settings into the current room without trusting join options', async () => {
    const room = new TdmRoom();
    room.onCreate({ settings: { killLimit: 5, matchSeconds: 7, respawnSeconds: 1, friendlyFire: 0.5, resultsSeconds: 15 } });
    try {
      expect(room.state.timeRemaining).toBe(7);
      expect(room.simulation.snapshot().timeRemaining).toBe(7);
    } finally { room.clock.clear(); }
    const short = await startMpFixture({ testSettings: { matchSeconds: 7, killLimit: 2 } });
    try {
      const { Client } = await import('@colyseus/sdk');
      const client = new Client(short.url, { headers: { Origin: short.url } });
      const joined = await client.create('tdm', { protocolVersion: 1, settings: { matchSeconds: 9999 } });
      try {
        await expect.poll(() => joined.state?.players?.size ?? 0).toBe(1);
        expect(joined.state.timeRemaining).toBeLessThanOrEqual(7);
      } finally { await joined.leave(); }
    } finally { await short.stop(); }
  }, 30000);
  it('uses a trusted matching certificate for HTTPS assets and reuses the pair across restart', async () => {
    const secure = await startMpFixture({ tls: true });
    try {
      const path = join(secure.certificateDir, 'pair.json');
      const bytes = await readFile(path, 'utf8');
      const pair = JSON.parse(bytes);
      const get = (route) => new Promise((ok, fail) => {
        const req = request(secure.url + route, { ca: pair.cert, timeout: 2000 }, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => ok({ status: res.statusCode, body: Buffer.concat(chunks) }));
        });
        req.on('timeout', () => req.destroy(new Error('HTTPS deadline')));
        req.on('error', fail); req.end();
      });
      expect((await get('/')).status).toBe(200);
      expect((await get('/models/enemy.glb')).body.subarray(0, 4).toString()).toBe('glTF');
      for (const route of ['/.vod-server/tls/pair.json', '/tls/pair.json', '/server/tls.js']) {
        const response = await get(route);
        expect(response.status).toBe(404);
        expect(response.body.toString()).not.toContain('PRIVATE KEY');
      }
      await secure.restart();
      expect(await readFile(path, 'utf8')).toBe(bytes);
      expect((await get('/health')).status).toBe(200);
      expect(secure.output()).not.toContain('PRIVATE KEY');
    } finally { await secure.stop(); }
  }, 30000);
  it('rejects source/secret/non-root-base builds', async () => {
    for (const dir of [resolve('.'), resolve('src'), defaultCertificateDir])
      await expect(validateBuildDir(dir, defaultCertificateDir)).rejects.toThrow('npm run build:mp');
    await expect(validateBuildDir(fixture.buildDir, fixture.buildDir)).rejects.toThrow('TLS storage');
    const owned = await allocateMpBuild();
    try {
      await buildMpClient({ outDir: owned.buildDir });
      await writeFile(join(owned.buildDir, 'only-sibling.txt'), 'independent sibling');
      expect((await fetch(fixture.url + '/only-sibling.txt')).status).toBe(404);
      const html = await readFile(join(owned.buildDir, 'index.html'), 'utf8');
      await writeFile(join(owned.buildDir, 'index.html'), html.replaceAll('/assets/', '/other/assets/'));
      await expect(validateBuildDir(owned.buildDir, defaultCertificateDir)).rejects.toThrow('root-base');
      await writeFile(join(owned.buildDir, 'index.html'), html);
      await writeFile(join(owned.buildDir, 'secret.pem'), 'private material');
      await expect(validateBuildDir(owned.buildDir, defaultCertificateDir)).rejects.toThrow('built game');
      expect((await fetch(fixture.url)).status).toBe(200);
    } finally { await owned.cleanup(); }
  }, 30000);
  it('reports finite occupied-port and unresolved-bind startup errors', async () => {
    for (const [host, port, message] of [['127.0.0.1', fixture.port, 'EADDRINUSE'],
      ['unresolvable.invalid', fixture.port, 'ENOTFOUND']]) {
      const child = spawn(process.execPath, [resolve('server/index.js'), '--host', host,
        '--port', String(port), '--build-dir', fixture.buildDir], { windowsHide: true });
      let output = '';
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.on('data', (data) => { output += data; });
      const timer = setTimeout(() => child.kill(), 4000);
      try {
        const [code] = await once(child, 'exit');
        expect(code).toBe(1);
        expect(output).toContain(message);
        expect(output).toContain(message === 'EADDRINUSE' ? 'Choose another --port' : 'Check --host');
      } finally { clearTimeout(timer); child.kill(); }
    }
  }, 12000);
  it('default build resolves repository dist even when the operator cwd differs', async () => {
    // Operator build intentionally uses dist; every fixture still owns an OS-temp root.
    await buildMpClient();
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((ok) => probe.close(ok));
    const child = spawn(process.execPath, [resolve('server/index.js'), '--host', '127.0.0.1', '--port', String(port)],
      { cwd: fixture.tempRoot, windowsHide: true });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const exited = once(child, 'exit');
    try {
      const deadline = Date.now() + 4000;
      while (!output.includes('[mp server] ready') && Date.now() < deadline)
        await new Promise((ok) => setTimeout(ok, 50));
      expect(output).toContain('[mp server] ready');
      const html = await (await fetch(`http://127.0.0.1:${port}`)).text();
      expect(html).toBe(await readFile(resolve('dist/index.html'), 'utf8'));
      expect((await fetch(`http://127.0.0.1:${port}/models/enemy.glb`)).status).toBe(200);
    } finally { child.kill(); await exited; }
  }, 30000);
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
