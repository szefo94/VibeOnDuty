// @ts-check
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultBuildDir = resolve(repoRoot, 'dist');
export const defaultCertificateDir = resolve(repoRoot, '.vod-server/tls');
export const help = `Usage: npm run mp-server -- [options]
  --port <1..65535>       Listener port (default 2567)
  --host <hostname/IP>    Bind address (default 0.0.0.0)
  --tls                   Generate/reuse a self-signed testing certificate
  --public <host/IP/URL>   Advertised player link; never a reachability claim
  --rules <JSON-file>      Operator killLimit/matchSeconds/respawnSeconds/friendlyFire
  --build-dir <directory> Root-base built output (default repository dist)
  --help                  Show help without listening
Build the multiplayer client with npm run build:mp.
Bind selects an interface; advertised selects the printed link and allowed Origin.
Wildcard binds advertise localhost by default. Browsers use their own page origin.
Explicit HTTPS public URL without --tls describes a TLS-terminating reverse proxy.
Direct --tls requires HTTPS. TLS storage: .vod-server/tls (VOD_TLS_DIR override).
`;
/** @param {string} value */
export function validateHostname(value) {
  if (isIP(value)) return value;
  if (!value || value.length > 253 || /^[\d.]+$/.test(value) ||
      !value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
    throw new Error('Use a hostname or IPv4/IPv6 address without scheme/path/whitespace');
  return value.toLowerCase();
}
/** @param {string} host */
export function urlHost(host) { return isIP(host) === 6 ? `[${host}]` : host; }
/** @param {string} host */
export function isWildcard(host) { return host === '0.0.0.0' || host === '::'; }
/** @param {string | undefined} value @param {{host:string,port:number,tls?:boolean}} options */
export function validateAdvertisedAddress(value, options) {
  const host = isWildcard(options.host) ? 'localhost' : options.host;
  const scheme = options.tls ? 'https' : 'http';
  try {
    let url;
    if (!value) url = new URL(`${scheme}://${urlHost(host)}:${options.port}`);
    else if (/^https?:\/\//i.test(value)) {
      if (/[\s\\?#]/.test(value) || !/^https?:\/\/[^/]+\/?$/i.test(value)) throw new Error();
      url = new URL(value);
      if (options.tls && url.protocol !== 'https:') throw new Error();
    } else {
      const bare = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
      url = new URL(`${scheme}://${urlHost(validateHostname(bare))}:${options.port}`);
    }
    const hostname = validateHostname(url.hostname.replace(/^\[|\]$/g, ''));
    if (isWildcard(hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return { publicUrl: url.origin, advertisedHostname: hostname };
  } catch {
    throw new Error('--public must be a non-wildcard hostname/IP or root http(s) URL; direct --tls requires https');
  }
}
/** @param {string[]} argv */
export function parseArgs(argv) {
  /** @type {{host:string,port:number,tls:boolean,help:boolean,buildDir:string,publicAddress?:string,rulesFile?:string}} */
  const options = { host: '0.0.0.0', port: 2567, tls: false, help: false, buildDir: defaultBuildDir };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (seen.has(flag)) throw new Error(`Duplicate option ${flag}; use each flag once`);
    seen.add(flag);
    if (flag === '--help') options.help = true;
    else if (flag === '--tls') options.tls = true;
    else {
      if (!['--host', '--port', '--build-dir', '--public', '--rules'].includes(flag)) throw new Error(`Unknown option ${flag}; use --help`);
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}; use --help`);
      if (flag === '--host') {
        try { options.host = validateHostname(value); }
        catch { throw new Error('--host must be a bind hostname or IPv4/IPv6 address'); }
      } else if (flag === '--port') {
        if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('--port must be an integer 1..65535');
        options.port = Number(value);
      } else if (flag === '--build-dir') options.buildDir = resolve(value);
      else if (flag === '--public') options.publicAddress = value;
      else options.rulesFile = resolve(value);
    }
  }
  return { ...options, ...validateAdvertisedAddress(options.publicAddress, options) };
}
/** @typedef {{killLimit:number,matchSeconds:number,respawnSeconds:number,friendlyFire:number,resultsSeconds:number}} RoomSettings */
/** @param {string | undefined} path @returns {Promise<RoomSettings>} */
export async function loadRoomSettings(path) {
  const defaults = { killLimit: 50, matchSeconds: 600, respawnSeconds: 3, friendlyFire: 0.25, resultsSeconds: 15 };
  if (!path) return defaults;
  try {
    const values = JSON.parse(await readFile(path, 'utf8'));
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error();
    const bounds = { killLimit: [1, 1000], matchSeconds: [1, 3600], respawnSeconds: [0, 30], friendlyFire: [0, 1] };
    for (const [key, value] of Object.entries(values)) {
      const range = bounds[/** @type {keyof typeof bounds} */ (key)];
      if (!range || typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1] || (key === 'killLimit' && !Number.isInteger(value))) throw new Error();
    }
    return { ...defaults, ...values };
  } catch {
    throw new Error('--rules must be readable JSON with killLimit integer 1..1000, matchSeconds 1..3600, respawnSeconds 0..30, friendlyFire 0..1; resultsSeconds is fixed at 15');
  }
}
