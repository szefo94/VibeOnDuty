// @ts-check
import { generate } from 'selfsigned';
import { X509Certificate, createPrivateKey, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { validateHostname } from './cli.js';

const run = promisify(execFile);
const day = 86400000;
/** @typedef {{key:string,cert:string,hostname:string}} Pair */
/** @typedef {{sid:string,inherited:boolean,type:string,rights:string}} AclRule */
/** @param {string} path @returns {Promise<AclRule[]>} */
async function readAcl(path) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.toLowerCase() === 'psmodulepath') delete env[name];
  env.PSModulePath = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/Modules');
  env.VOD_ACL_PATH = path;
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; @( (Get-Acl -LiteralPath $env:VOD_ACL_PATH).Access | ForEach-Object { @{sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; inherited=$_.IsInherited; type=$_.AccessControlType.ToString(); rights=$_.FileSystemRights.ToString()} } ) | ConvertTo-Json -Compress"],
  // PowerShell7 module paths are incompatible with 5.1; remove case aliases too.
  { windowsHide: true, timeout: 5000, env });
  const result = JSON.parse(stdout);
  return Array.isArray(result) ? result : [result];
}
/** @returns {Promise<string>} */
async function currentSid() {
  const { stdout } = await run('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 5000 });
  const sid = stdout.match(/S-1-\d+(?:-\d+)+/i)?.[0];
  if (!sid) throw new Error('Cannot identify current Windows account');
  return sid;
}
/** Verify the actual security boundary, not Node's Windows chmod emulation.
 * @param {string} path @param {boolean} directory */
export async function verifyPrivateAccess(path, directory) {
  if (process.platform !== 'win32') {
    if (((await stat(path)).mode & 0o777) !== (directory ? 0o700 : 0o600)) throw new Error('Unsafe POSIX TLS permissions');
    return;
  }
  const sid = await currentSid();
  const allowed = new Set([sid, 'S-1-5-18', 'S-1-5-32-544']);
  const rules = await readAcl(path);
  if (!rules.length || rules.some((rule) => !allowed.has(rule.sid) || rule.inherited || rule.type !== 'Allow') ||
      !rules.some((rule) => rule.sid === sid && rule.rights.includes('FullControl')))
    throw new Error('Unsafe Windows TLS ACL: require only current user, SYSTEM and Administrators');
}
/** @param {string} path @param {boolean} directory */
async function restrictAccess(path, directory) {
  if (process.platform !== 'win32') await chmod(path, directory ? 0o700 : 0o600);
  else {
    const sid = await currentSid();
    const allowed = new Set([sid, 'S-1-5-18', 'S-1-5-32-544']);
    const permissions = directory ? '(OI)(CI)F' : 'F';
    const args = [path, '/inheritance:r', '/grant:r',
      `*${sid}:${permissions}`, `*S-1-5-18:${permissions}`, `*S-1-5-32-544:${permissions}`];
    await run('icacls.exe', args, { windowsHide: true, timeout: 5000 });
    for (const rule of await readAcl(path)) if (!allowed.has(rule.sid))
      await run('icacls.exe', [path, '/remove', `*${rule.sid}`], { windowsHide: true, timeout: 5000 });
  }
  await verifyPrivateAccess(path, directory);
}
/** @param {unknown} value @param {string} hostname @param {number} now */
export function validPair(value, hostname, now) {
  try {
    const pair = /** @type {Pair} */ (value);
    if (pair.hostname !== hostname || typeof pair.key !== 'string' || typeof pair.cert !== 'string') return false;
    const cert = new X509Certificate(pair.cert);
    return cert.validFromDate.getTime() <= now && cert.validToDate.getTime() > now + day &&
      !!(isIP(hostname) ? cert.checkIP(hostname) : cert.checkHost(hostname, { subject: 'never', wildcards: false })) &&
      cert.checkPrivateKey(createPrivateKey(pair.key)) && cert.verify(cert.publicKey);
  } catch { return false; }
}
/** @param {string} hostname @param {number} now @returns {Promise<Pair>} */
async function generatePair(hostname, now) {
  const pems = await generate([{ name: 'commonName', value: hostname }], {
    keySize: 2048, algorithm: 'sha256', notBeforeDate: new Date(now - 60000),
    notAfterDate: new Date(now + 30 * day),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [isIP(hostname) ? { type: 7, ip: hostname } : { type: 2, value: hostname }] },
    ],
  });
  return { key: pems.private, cert: pems.cert, hostname };
}
/** Single atomic manifest publishes cert+key together; lock serializes processes.
 * @param {string} advertisedHostname @param {string} storageDir
 * @param {{now?:()=>number,generate?:typeof generatePair,rename?:typeof rename,lockTimeoutMs?:number}} [seams]
 */
export async function loadOrCreateCertificate(advertisedHostname, storageDir, seams = {}) {
  const hostname = validateHostname(advertisedHostname);
  const root = resolve(storageDir);
  const path = join(root, 'pair.json');
  const lock = join(root, '.lock');
  let locked = false;
  let temp = '';
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    if ((await lstat(root)).isSymbolicLink()) throw new Error('TLS storage must not be a symlink');
    await restrictAccess(root, true);
    const deadline = Date.now() + (seams.lockTimeoutMs ?? 5000);
    while (!locked) {
      try { await mkdir(lock, { mode: 0o700 }); locked = true; }
      catch (error) {
        if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST' || Date.now() >= deadline) throw error;
        await delay(50);
      }
    }
    const now = seams.now?.() ?? Date.now();
    /** @type {Pair | undefined} */
    let pair;
    try {
      if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink()) throw new Error();
      await restrictAccess(path, false);
      pair = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      // An access/ACL failure must not silently become fresh, less-protected storage.
      if (!['ENOENT', undefined].includes(/** @type {NodeJS.ErrnoException} */ (error).code)) throw error;
      if (error instanceof Error && /ACL|permissions/.test(error.message)) throw error;
    }
    if (pair && validPair(pair, hostname, now)) return { ...pair, path, reused: true };
    pair = await (seams.generate ?? generatePair)(hostname, now);
    if (!validPair(pair, hostname, now)) throw new Error('Generated TLS pair failed validation');
    temp = join(root, `pair-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(pair), { mode: 0o600, flag: 'wx' });
    await restrictAccess(temp, false);
    await (seams.rename ?? rename)(temp, path);
    temp = '';
    await verifyPrivateAccess(path, false);
    return { ...pair, path, reused: false };
  } catch (error) {
    // Parser, generator and filesystem errors can contain key material. Only a safe
    // code crosses this boundary, including the cause inspected by external callers.
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    // eslint-disable-next-line preserve-caught-error -- preserving raw cause could disclose private PEM
    throw new Error(`TLS storage/generation failed (${code ?? 'validation or restricted access'}). Check write permissions/ACL on ${root}; remove .lock only after stopping all owning servers.`, { cause: new Error(String(code ?? 'TLS validation failed')) });
  } finally {
    if (temp) await rm(temp, { force: true });
    if (locked) await rm(lock, { recursive: true, force: true });
  }
}
