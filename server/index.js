// @ts-check
// @ts-expect-error Express runtime is pinned; this repository has no vendor declaration package.
import express from 'express';
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TdmRoom } from './tdmRoom.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {{host?: string, port?: number, buildDir?: string}} [options] */
export async function startServer(options = {}) {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 2567;
  if (!host || /[\s/\\]/.test(host)) throw new Error('--host must be a bind hostname or IP');
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
    throw new Error('--port must be 0..65535');
  const buildDir = await realpath(resolve(options.buildDir ?? join(repoRoot, 'dist')));
  const html = await readFile(join(buildDir, 'index.html'), 'utf8');
  if (!/(?:src|href)="\/assets\//.test(html) || html.includes('/VibeOnDuty/')) {
    throw new Error('--build-dir must contain a root-base production build (npm run build:mp)');
  }
  if (!(await stat(join(buildDir, 'assets'))).isDirectory())
    throw new Error('Missing built assets');
  const app = express();
  app.disable('x-powered-by');
  app.get(
    '/health',
    (/** @type {unknown} */ _req, /** @type {{json:(value:object)=>void}} */ res) =>
      res.json({ ready: true })
  );
  app.use(express.static(buildDir, { dotfiles: 'deny', fallthrough: false }));
  const http = createServer(app);
  const server = new Server({
    transport: new WebSocketTransport({ server: http, maxPayload: 2048 }),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define('tdm', TdmRoom);
  await server.listen(port, host);
  await matchMaker.createRoom('tdm', {});
  return { http, buildDir, server, close: () => server.gracefullyShutdown(false) };
}

/** @param {string[]} args */
function parseArgs(args) {
  const options = { host: '127.0.0.1', port: 2567, buildDir: join(repoRoot, 'dist') };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i],
      value = args[i + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === '--host') options.host = value;
    else if (flag === '--port' && /^\d+$/.test(value)) options.port = Number(value);
    else if (flag === '--build-dir') options.buildDir = value;
    else throw new Error(`Unknown or invalid option ${flag}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await startServer(parseArgs(process.argv.slice(2)));
    console.log(`[mp server] ready ${JSON.stringify(server.http.address())}`);
    for (const signal of ['SIGTERM', 'SIGINT'])
      process.once(signal, () => {
        void server.close();
      });
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
