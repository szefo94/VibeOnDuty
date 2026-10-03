// @ts-check
// @ts-expect-error Express runtime is pinned; this repository has no vendor declaration package.
import express from 'express';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { loadOrCreateCertificate } from './tls.js';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TdmRoom } from './tdmRoom.js';
import { defaultBuildDir, defaultCertificateDir, help, isWildcard, loadRoomSettings,
  parseArgs, repoRoot, urlHost, validateAdvertisedAddress, validateHostname } from './cli.js';

/** @param {string} parent @param {string} child */
function inside(parent, child) {
  const rel = relative(parent, child);
  return !rel || (!rel.startsWith('..') && !isAbsolute(rel));
}
/** @param {string} selected @param {string} certificateDir */
export async function validateBuildDir(selected, certificateDir) {
  try {
    const root = await realpath(resolve(selected));
    const source = await realpath(repoRoot);
    const secret = await realpath(certificateDir).catch(() => resolve(certificateDir));
    if (root === source || inside(secret, root) || inside(root, secret) ||
        ['src', 'server', '.git', '.planning', '.vod-server'].some((dir) => inside(join(source, dir), root))) throw new Error();
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)]
      .map((match) => match[1]).filter((path) => /\/assets\//.test(path));
    if (!assets.length || assets.some((path) => !path.startsWith('/assets/')) ||
        !(await stat(join(root, 'assets'))).isDirectory()) throw new Error();
    for (const asset of assets) if (!(await stat(join(root, asset.slice(1)))).isFile()) throw new Error();
    for (const dir of ['src', 'server', '.git', '.vod-server', 'tls'])
      if (await stat(join(root, dir)).then(() => true, () => false)) throw new Error();
    /** @param {string} directory */
    async function checkContents(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if ((await lstat(path)).isSymbolicLink() || /\.(pem|key|pfx|p12)$/i.test(entry.name)) throw new Error();
        if (entry.isDirectory()) await checkContents(path);
      }
    }
    await checkContents(root);
    return root;
  } catch {
    throw new Error('--build-dir must contain only root-base built game/assets, outside source and TLS storage. Build the multiplayer client with npm run build:mp');
  }
}

/** @typedef {{host?:string,port?:number,buildDir?:string,tls?:boolean,publicAddress?:string,certificateDir?:string,rulesFile?:string}} ServerOptions */
/** @param {ServerOptions} [options] */
export async function startServer(options = {}) {
  const host = validateHostname(options.host ?? '0.0.0.0');
  const port = options.port ?? 2567;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('--port must be an integer 1..65535');
  const advertised = validateAdvertisedAddress(options.publicAddress, { host, port, tls: options.tls });
  const certificateDir = resolve(options.certificateDir ?? process.env.VOD_TLS_DIR ?? defaultCertificateDir);
  const settings = await loadRoomSettings(options.rulesFile);
  // Reproducible server-owned combat for fixtures; clients cannot select seeds.
  const combatSeed = process.env.VOD_COMBAT_SEED === undefined ? undefined : Number(process.env.VOD_COMBAT_SEED);
  if (combatSeed !== undefined && (!Number.isSafeInteger(combatSeed) || combatSeed < 0 || combatSeed > 4294967295))
    throw new Error('VOD_COMBAT_SEED must be an integer 0..4294967295');
  const buildDir = await validateBuildDir(options.buildDir ?? defaultBuildDir, certificateDir);
  const localHost = isWildcard(host) ? 'localhost' : host;
  const listenUrl = `${options.tls ? 'https' : 'http'}://${urlHost(localHost)}:${port}`;
  const origins = new Set([new URL(listenUrl).origin, advertised.publicUrl]);
  const app = express();
  app.disable('x-powered-by');
  app.get(
    '/health',
    (/** @type {unknown} */ _req, /** @type {{json:(value:object)=>void}} */ res) =>
      res.json({ ready: true })
  );
  app.use(express.static(buildDir, { dotfiles: 'deny', fallthrough: false, redirect: false }));
  app.use((/** @type {unknown} */ _err, /** @type {unknown} */ _req,
    /** @type {{status:(n:number)=>{send:(s:string)=>void}}} */ res,
    /** @type {unknown} */ _next) => { res.status(404).send('Not found'); });
  const pair = options.tls ? await loadOrCreateCertificate(advertised.advertisedHostname, certificateDir) : undefined;
  const http = pair ? createHttpsServer({ key: pair.key, cert: pair.cert }, app) : createServer(app);
  const server = new Server({
    transport: new WebSocketTransport({ server: http, maxPayload: 2048,
      beforeUpgrade: (context) => origins.has(context.headers.get('origin') ?? '')
        ? undefined : new Response('Origin not allowed', { status: 403 }),
    }),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define('tdm', TdmRoom, { settings, combatSeed });
  /** @type {(error:Error)=>void} */
  let onError = () => {};
  const failure = new Promise((_, reject) => { onError = reject; http.once('error', onError); });
  try {
    await Promise.race([server.listen(port, host), failure]);
    await matchMaker.createRoom('tdm', {});
  } catch (error) {
    await server.gracefullyShutdown(false).catch(() => {});
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    throw new Error(`Cannot listen on ${host}:${port} (${code ?? 'startup failed'}). ${
      code === 'EADDRINUSE' ? 'Choose another --port or stop its owning server.' :
      code === 'EACCES' ? 'Choose an unprivileged port and check bind permissions.' :
      'Check --host resolves to an available local interface.'}`, { cause: error });
  } finally {
    http.off('error', onError);
  }
  return { http, buildDir, server, settings, certificateDir, listenUrl,
    ...advertised, close: () => server.gracefullyShutdown(false) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(help);
    else {
      const server = await startServer(options);
      console.log(`[mp server] ready bind=${options.host}:${options.port}; advertised=${server.publicUrl}`);
      console.log('[mp server] Advertised address does not establish public reachability.');
      for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void server.close(); });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Server startup failed; check --help');
    process.exitCode = 1;
  }
}
