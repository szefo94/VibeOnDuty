import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { allocateMpBuild, buildMpClient } from '../tests/helpers/mpServer.js';

let owned;
beforeAll(async () => {
  owned = await allocateMpBuild();
  await buildMpClient({ outDir: owned.buildDir });
}, 30000);
afterAll(async () => { await owned?.cleanup(); });

describe('testing TLS certificate lifecycle', () => {
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
