import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { inspect } from 'node:util';
import { allocateMpBuild, buildMpClient } from '../tests/helpers/mpServer.js';
import { loadOrCreateCertificate, validPair, verifyPrivateAccess } from './tls.js';

let owned;
beforeAll(async () => {
  owned = await allocateMpBuild();
  await buildMpClient({ outDir: owned.buildDir });
}, 30000);
afterAll(async () => { await owned?.cleanup(); });

describe('testing TLS certificate lifecycle', () => {
  it.each(['localhost', '127.0.0.1', '::1'])('generates matching DNS/IP SAN and private key for %s', async (host) => {
    const dir = join(owned.tempRoot, host.replaceAll(':', '_'));
    const pair = await loadOrCreateCertificate(host, dir);
    const cert = new X509Certificate(pair.cert);
    expect(cert.checkPrivateKey(createPrivateKey(pair.key))).toBe(true);
    expect(host === 'localhost' ? cert.checkHost(host, { subject: 'never' }) : cert.checkIP(host)).toBe(host);
    expect(cert.validToDate.getTime() - Date.now()).toBeGreaterThan(29 * 86400000);
    expect(validPair(pair, host, Date.now())).toBe(true);
    await verifyPrivateAccess(dir, true);
    await verifyPrivateAccess(pair.path, false);
    if (process.platform === 'win32') {
      const acl = execFileSync('icacls.exe', [pair.path], { encoding: 'utf8', windowsHide: true });
      expect(acl).not.toContain('(I)');
      expect(acl.match(/\(F\)/g)).toHaveLength(3);
    } else expect((await stat(pair.path)).mode & 0o777).toBe(0o600);
  }, 15000);
  it('reuses valid certificate bytes and mtime; regenerates near-expiry with a controlled clock', async () => {
    const dir = join(owned.tempRoot, 'reuse');
    const original = await loadOrCreateCertificate('localhost', dir);
    const bytes = await readFile(original.path, 'utf8');
    const mtime = (await stat(original.path)).mtimeMs;
    expect((await loadOrCreateCertificate('localhost', dir)).reused).toBe(true);
    expect(await readFile(original.path, 'utf8')).toBe(bytes);
    expect((await stat(original.path)).mtimeMs).toBe(mtime);
    const future = new X509Certificate(original.cert).validToDate.getTime() - 12 * 3600000;
    const replaced = await loadOrCreateCertificate('localhost', dir, { now: () => future });
    expect(replaced.reused).toBe(false);
    expect(replaced.cert).not.toBe(original.cert);
    expect(validPair(replaced, 'localhost', future)).toBe(true);
  }, 15000);
  it('replaces corruption, changed host and mismatched key, preserving one complete active manifest', async () => {
    const dir = join(owned.tempRoot, 'replace');
    let pair = await loadOrCreateCertificate('localhost', dir);
    await writeFile(pair.path, 'corrupt');
    pair = await loadOrCreateCertificate('localhost', dir);
    expect(pair.reused).toBe(false);
    const changed = await loadOrCreateCertificate('127.0.0.1', dir);
    expect(validPair(changed, '127.0.0.1', Date.now())).toBe(true);
    expect(changed.reused).toBe(false);
    await writeFile(changed.path, JSON.stringify({ ...changed, key: pair.key }));
    const repaired = await loadOrCreateCertificate('127.0.0.1', dir);
    expect(repaired.reused).toBe(false);
    expect(validPair(repaired, '127.0.0.1', Date.now())).toBe(true);
  }, 20000);
  it('failed publication preserves the old pair and errors expose no PEM', async () => {
    const dir = join(owned.tempRoot, 'atomic');
    const original = await loadOrCreateCertificate('localhost', dir);
    const bytes = await readFile(original.path, 'utf8');
    const failingRename = async () => { throw Object.assign(new Error('PRIVATE KEY must never escape'), { code: 'EACCES' }); };
    let failure;
    try { await loadOrCreateCertificate('127.0.0.1', dir, { rename: failingRename }); }
    catch (error) { failure = error; }
    expect(failure.message).toContain('TLS storage/generation failed');
    expect(failure.message).not.toContain('PRIVATE KEY');
    expect(inspect(failure)).not.toContain('PRIVATE KEY');
    expect(await readFile(original.path, 'utf8')).toBe(bytes);
    expect((await loadOrCreateCertificate('localhost', dir)).reused).toBe(true);
    const blocked = join(owned.tempRoot, 'not-directory');
    await writeFile(blocked, 'existing file');
    await expect(loadOrCreateCertificate('localhost', blocked)).rejects.toThrow('Check write permissions/ACL');
  }, 15000);
  it('serializes concurrent writers and rejects broad Windows ACLs', async () => {
    const dir = join(owned.tempRoot, 'serialized');
    const pairs = await Promise.all([loadOrCreateCertificate('localhost', dir), loadOrCreateCertificate('localhost', dir)]);
    expect(pairs[0].cert).toBe(pairs[1].cert);
    expect(pairs.filter((pair) => pair.reused)).toHaveLength(1);
    if (process.platform === 'win32') {
      execFileSync('icacls.exe', [pairs[0].path, '/grant', '*S-1-1-0:R'], { windowsHide: true });
      await expect(verifyPrivateAccess(pairs[0].path, false)).rejects.toThrow('Unsafe Windows TLS ACL');
      await loadOrCreateCertificate('localhost', dir);
      await verifyPrivateAccess(pairs[0].path, false);
    }
    expect(execFileSync('git', ['check-ignore', '.vod-server/tls/pair.json'], { encoding: 'utf8' })).toContain('.vod-server/tls');
  }, 15000);
  it('TLS startup creates a private active certificate pair', async () => {
    const dir = join(owned.tempRoot, 'startup-tls');
    const child = spawn(process.execPath, [resolve('server/index.js'), '--tls', '--host', '127.0.0.1',
      '--port', '25679', '--build-dir', owned.buildDir], {
      env: { ...process.env, VOD_TLS_DIR: dir }, windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const exited = once(child, 'exit');
    try {
      const deadline = Date.now() + 5000;
      while (!output.includes('[mp server] ready') && child.exitCode === null && Date.now() < deadline)
        await new Promise((ok) => setTimeout(ok, 50));
      expect(output).toContain('[mp server] ready');
      expect(await access(join(dir, 'pair.json')).then(() => true, () => false)).toBe(true);
      expect(output).not.toContain('PRIVATE KEY');
    } finally { child.kill(); await exited; }
  }, 10000);
});
