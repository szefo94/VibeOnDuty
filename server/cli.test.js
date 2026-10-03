import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

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
