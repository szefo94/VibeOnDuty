import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultBuildDir, loadRoomSettings, parseArgs, validateAdvertisedAddress } from './cli.js';

export async function runCli(args, options = {}) {
  const child = spawn(process.execPath, [resolve('server/index.js'), ...args], {
    cwd: options.cwd, env: { ...process.env, ...options.env }, windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const timeout = setTimeout(() => child.kill(), 8000);
  try {
    const [code] = await once(child, 'exit');
    return { code, output };
  } finally { clearTimeout(timeout); }
}

describe('operator CLI', () => {
  it('has explicit defaults, direct TLS/IPv6 and reverse proxy address semantics', () => {
    expect(parseArgs([])).toMatchObject({ host: '0.0.0.0', port: 2567, tls: false,
      buildDir: defaultBuildDir, publicUrl: 'http://localhost:2567' });
    expect(parseArgs(['--tls', '--host', '::1', '--port', '8081']).publicUrl).toBe('https://[::1]:8081');
    expect(parseArgs(['--public', 'https://play.example:443', '--port', '8081']).publicUrl).toBe('https://play.example');
    expect(validateAdvertisedAddress('127.0.0.1', { host: '0.0.0.0', port: 4567, tls: true }).publicUrl).toBe('https://127.0.0.1:4567');
    expect(() => parseArgs(['--port', '2', '--port', '3'])).toThrow('Duplicate');
  });
  it('validates only operator rule bounds and fixes results at 15 seconds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vod-cli-'));
    const file = join(root, 'rules.json');
    try {
      expect(await loadRoomSettings()).toEqual({ killLimit: 50, matchSeconds: 600,
        respawnSeconds: 3, friendlyFire: 0.25, resultsSeconds: 15 });
      for (const values of [{ killLimit: 1, matchSeconds: 1, respawnSeconds: 0, friendlyFire: 0 },
        { killLimit: 1000, matchSeconds: 3600, respawnSeconds: 30, friendlyFire: 1 }]) {
        await writeFile(file, JSON.stringify(values));
        expect(await loadRoomSettings(file)).toEqual({ ...values, resultsSeconds: 15 });
      }
      for (const values of [{ killLimit: 1.5 }, { killLimit: 1001 }, { matchSeconds: 0 },
        { respawnSeconds: -1 }, { friendlyFire: 1.1 }, { resultsSeconds: 2 }, [], null]) {
        await writeFile(file, JSON.stringify(values));
        await expect(loadRoomSettings(file)).rejects.toThrow('--rules');
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('help exits successfully without listening', async () => {
    const result = await runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.output).toContain('--public');
    expect(result.output).toContain('advertised');
    expect(result.output).not.toContain('[mp server] ready');
  });
  it.each([
    [['--port', '0'], '--port'], [['--port', '65536'], '--port'],
    [['--port', '2.5'], '--port'], [['--host', 'http://localhost'], '--host'],
    [['--public', '0.0.0.0'], '--public'],
    [['--public', 'http://user:pass@localhost'], '--public'],
    [['--public', 'https://localhost/path'], '--public'],
    [['--public', 'https://localhost/?x=1'], '--public'],
    [['--public', 'https://localhost/#x'], '--public'],
    [['--tls', '--public', 'http://localhost'], '--public'],
    [['--wat'], 'Unknown'], [['--host'], 'Missing'],
    [['--rules', 'absent.json'], '--rules'],
    [['--build-dir', 'absent-build'], 'npm run build:mp'],
  ])('rejects malformed configuration %j', async (args, text) => {
    const result = await runCli(args);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain(text);
  });
});
