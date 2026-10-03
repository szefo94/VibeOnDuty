// @ts-check
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { lstat, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const viteEntry = join(repoRoot, 'node_modules/vite/bin/vite.js');

/** @typedef {import('node:child_process').ChildProcess} Child */
/** @typedef {{tempRoot: string, buildDir: string, cleanup: () => Promise<void>}} Build */
/**
 * @typedef {object} FixtureOptions
 * @property {number} [port] Ephemeral port by default; no reused listener.
 * @property {string} [host]
 * @property {boolean} [tls]
 * @property {string} [publicAddress]
 * @property {string} [certDir] Optional server-owned TLS storage environment.
 * @property {Record<string, number>} [testSettings] Passed as an operator --rules file.
 * @property {NodeJS.ProcessEnv} [env]
 * @property {number} [readyTimeoutMs]
 */

/** @param {Child} child @returns {Promise<void>} */
async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  if (!(await Promise.race([exited.then(() => true), delay(3000, false, { ref: false })]))) {
    child.kill('SIGKILL');
    if (!(await Promise.race([exited.then(() => true), delay(3000, false, { ref: false })]))) {
      throw new Error(`Owned child ${child.pid} did not exit; retaining its build directory`);
    }
  }
}

/**
 * Spawn only the current Node executable; never a shell or global Vite binary.
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 */
function runNode(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: repoRoot, env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  /** @type {Error | undefined} */
  let error;
  /** @param {Buffer} chunk */
  const capture = (chunk) => { output = (output + chunk.toString()).slice(-16000); };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  child.on('error', (cause) => { error = cause; });
  return { child, output: () => output, error: () => error };
}

/**
 * Production build. Only operator --build-only defaults to repository dist.
 * @param {{outDir?: string}} [options]
 * @returns {Promise<string>}
 */
export async function buildMpClient({ outDir = join(repoRoot, 'dist') } = {}) {
  const destination = resolve(outDir);
  assert.notEqual(destination, repoRoot, 'Build output cannot be the repository root');
  const processRun = runNode([viteEntry, 'build', '--outDir', destination], { PUBLIC_BASE: '/' });
  const exited = once(processRun.child, 'exit');
  try {
    const result = await Promise.race([
      exited.then(([code]) => ({ code })),
      delay(45000, { code: null }, { ref: false }),
    ]);
    if (processRun.error() || result.code !== 0) {
      throw new Error(`MP client build failed (${result.code}): ${processRun.error() ?? ''}\n${processRun.output()}`);
    }
    const html = await readFile(join(destination, 'index.html'), 'utf8');
    assert(!html.includes('/VibeOnDuty/'), 'Fixture build retained the static-hosting base');
    assert.match(html, /(?:src|href)="\/assets\//, 'Root-base built asset references are missing');
    return destination;
  } finally {
    await stopChild(processRun.child);
  }
}

/** Allocate and retain ownership of one temporary build. @returns {Promise<Build>} */
export async function allocateMpBuild() {
  const tempRoot = await realpath(await mkdtemp(join(tmpdir(), 'vod-mp-')));
  const buildDir = join(tempRoot, 'build');
  let cleaned = false;
  return {
    tempRoot, buildDir,
    async cleanup() {
      if (cleaned) return;
      const info = await lstat(tempRoot);
      assert(!info.isSymbolicLink(), 'Refusing cleanup of a replaced temp root');
      const actual = await realpath(tempRoot);
      assert.equal(actual, tempRoot, 'Owned temp root changed identity');
      const parent = await realpath(tmpdir());
      const rootRelative = relative(parent, actual);
      assert(rootRelative.startsWith('vod-mp-') && !rootRelative.includes(sep), 'Cleanup root is not a direct owned OS-temp child');
      const buildRelative = relative(actual, resolve(buildDir));
      assert(buildRelative && !buildRelative.startsWith('..') && !isAbsolute(buildRelative), 'Build directory escaped this fixture');
      await rm(actual, { recursive: true, force: true });
      cleaned = true;
    },
  };
}

/** @param {string} host @returns {Promise<number>} */
async function freePort(host) {
  const socket = createServer();
  socket.listen(0, host);
  await once(socket, 'listening');
  const address = socket.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  await new Promise((ok, fail) => socket.close((error) => error ? fail(error) : ok(undefined)));
  return port;
}

/** @param {string} url @returns {Promise<boolean>} */
async function isHealthy(url) {
  if (url.startsWith('https:')) {
    // Test only: the operator-generated certificate is deliberately self-signed.
    return new Promise((ok) => {
      const req = request(`${url}/health`, { rejectUnauthorized: false, timeout: 1000 }, (res) => {
        res.resume();
        ok(res.statusCode === 200);
      });
      req.on('timeout', () => { req.destroy(); ok(false); });
      req.on('error', () => ok(false));
      req.end();
    });
  }
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
    await res.body?.cancel();
    return res.ok;
  } catch { return false; }
}

/**
 * Dedicated server with an independent production build and bounded readiness.
 * TLS/rules remain server-owned options, never browser mutation endpoints.
 * @param {FixtureOptions} [options]
 */
export async function startMpFixture(options = {}) {
  const owned = await allocateMpBuild();
  /** @type {Child | undefined} */
  let child;
  try {
    await buildMpClient({ outDir: owned.buildDir });
    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? await freePort(host);
    const urlHost = host.includes(':') ? `[${host}]` : host;
    const url = `${options.tls ? 'https' : 'http'}://${urlHost}:${port}`;
    const args = [join(repoRoot, 'server/index.js'), '--host', host, '--port', String(port), '--build-dir', owned.buildDir];
    if (options.tls) args.push('--tls');
    if (options.publicAddress) args.push('--public', options.publicAddress);
    if (options.testSettings) {
      const rulesFile = join(owned.tempRoot, 'rules.json');
      await writeFile(rulesFile, JSON.stringify(options.testSettings));
      args.push('--rules', rulesFile);
    }
    const env = { ...options.env };
    const certificateDir = resolve(options.certDir ?? join(owned.tempRoot, 'tls'));
    if (options.tls || options.certDir) env.VOD_TLS_DIR = certificateDir;
    let server = runNode(args, env);
    /** @param {ReturnType<typeof runNode>} run */
    async function waitReady(run) {
      child = run.child;
      const deadline = Date.now() + (options.readyTimeoutMs ?? 10000);
      while (Date.now() < deadline) {
        if (run.error() || run.child.exitCode !== null || run.child.signalCode !== null) {
          throw new Error(`MP server exited before /health readiness (${run.child.exitCode}): ${run.error() ?? ''}\n${run.output()}`);
        }
        if (await isHealthy(url)) {
          console.log(`[mp fixture] ready ${url}; pid=${run.child.pid}; buildDir=${owned.buildDir}`);
          return;
        }
        await delay(100);
      }
      throw new Error(`MP server /health readiness exceeded ${options.readyTimeoutMs ?? 10000}ms\n${run.output()}`);
    }
    await waitReady(server);
    return {
      tempRoot: owned.tempRoot, buildDir: owned.buildDir, certificateDir,
      url, port, get child() { return server.child; }, output: () => server.output(),
      async restart() {
        await stopChild(server.child);
        server = runNode(args, env);
        try { await waitReady(server); }
        catch (error) { await stopChild(server.child); throw error; }
      },
      async stop() {
        await stopChild(server.child);
        await owned.cleanup();
      },
    };
  } catch (error) {
    if (child) await stopChild(child);
    await owned.cleanup();
    console.log(`[mp fixture] startup failed; owned pid=${child?.pid ?? 'none'} stopped and temp root removed: ${owned.tempRoot}`);
    throw error;
  }
}

/** Hash every dist file to detect any concurrent-fixture mutation. @param {string} directory */
async function fingerprint(directory) {
  const hash = createHash('sha256');
  /** @param {string} path */
  async function visit(path) {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return;
      throw error;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(path, entry.name);
      hash.update(relative(directory, full));
      if (entry.isDirectory()) await visit(full);
      else hash.update(await readFile(full));
    }
  }
  await visit(directory);
  return hash.digest('hex');
}

/** Real concurrent builds; no server required, including during --list. */
export async function verifyFixtureIsolation() {
  const before = await fingerprint(join(repoRoot, 'dist'));
  /** @type {Build[]} */
  const builds = [];
  try {
    builds.push(await allocateMpBuild());
    builds.push(await allocateMpBuild());
    assert.notEqual(builds[0].tempRoot, builds[1].tempRoot);
    // allSettled prevents teardown racing a still-running sibling build on failure.
    const results = await Promise.allSettled(builds.map((build) => buildMpClient({ outDir: build.buildDir })));
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
    assert.equal(await fingerprint(join(repoRoot, 'dist')), before, 'Fixtures changed repository dist');
    await builds[0].cleanup();
    assert((await readFile(join(builds[1].buildDir, 'index.html'), 'utf8')).includes('/assets/'));
    console.log(`[mp isolation] PASS distinct roots: ${builds.map((build) => build.tempRoot).join(' | ')}; repository dist unchanged; sibling survives scoped cleanup`);
  } finally {
    await Promise.all(builds.map((build) => build.cleanup()));
    for (const build of builds) {
      await assert.rejects(lstat(build.tempRoot), { code: 'ENOENT' });
    }
    console.log('[mp isolation] PASS both owned temporary roots removed');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--build-only')) console.log(`[mp build] ${await buildMpClient()}`);
    else if (process.argv.includes('--check-isolation')) await verifyFixtureIsolation();
    else throw new Error('Use --build-only or --check-isolation');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
