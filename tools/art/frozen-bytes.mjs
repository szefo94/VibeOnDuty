// Preserve, verify and restore byte-exact copies of frozen reference files.
//
// The frozen V2 budget gate hashes working-tree bytes. For some reference files
// those bytes have mixed line endings that no git object and no checkout
// reproduces, so a git operation that rewrites such a file would make the gate
// fail with no way back. This tool keeps the exact bytes as base64 text inside a
// tracked JSON file. The decoder ignores all whitespace, so git converting that
// JSON file's own line endings cannot alter the copies.
//
//   node tools/art/frozen-bytes.mjs preserve
//   node tools/art/frozen-bytes.mjs verify
//   node tools/art/frozen-bytes.mjs restore <path> --from frozen|corrected --confirm
//
// `preserve` and `verify` read the working tree and run read-only git commands.
// `restore` is the only command that writes a source file; it needs --confirm.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT, boundedPath } from './motion-acceptance.mjs';

const PHASE = '.planning/phases/07-movement-matched-and-action-safe-animation/';
export const BUDGET_PATH = PHASE + 'evidence/07-budget-view-v2.json';
export const STORE_PATH = PHASE + 'evidence/07-21-frozen-bytes.json';
const COLUMNS = 76;
const CR = 0x0d;
const LF = 0x0a;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// ── Pure core ────────────────────────────────────────────────────────────────

/**
 * Describe a byte sequence and encode it as base64 text wrapped at 76 columns.
 * `crlf` counts CR LF line ends and `lf` counts LF line ends with no CR before them.
 * @param {Buffer} buffer
 * @returns {{ sha256: string, bytes: number, crlf: number, lf: number, base64: string }}
 */
export function encodeBytes(buffer) {
  assert.ok(Buffer.isBuffer(buffer), 'encodeBytes needs a Buffer');
  let crlf = 0;
  let lf = 0;
  for (let index = 0; index < buffer.length; index++) {
    if (buffer[index] !== LF) continue;
    if (index > 0 && buffer[index - 1] === CR) crlf++;
    else lf++;
  }
  const rows = buffer.toString('base64').match(new RegExp(`.{1,${COLUMNS}}`, 'g')) ?? [];
  return { sha256: sha256(buffer), bytes: buffer.length, crlf, lf, base64: rows.join('\n') };
}

/**
 * Decode a preserved entry. All whitespace in the base64 text is ignored, and the
 * text may be one string or an array of rows. Throws unless the decoded bytes
 * have exactly the recorded SHA-256.
 * @param {{ sha256: string, bytes?: number, base64: string | string[] }} entry
 * @returns {Buffer}
 */
export function decodeBytes(entry) {
  assert.ok(entry && typeof entry === 'object', 'Missing preserved entry');
  const raw = Array.isArray(entry.base64) ? entry.base64.join('\n') : entry.base64;
  assert.equal(typeof raw, 'string', 'Preserved entry has no base64 text');
  const text = raw.replace(/\s+/g, '');
  assert.match(
    text,
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    'Preserved base64 text is malformed'
  );
  const buffer = Buffer.from(text, 'base64');
  assert.match(String(entry.sha256), /^[0-9a-f]{64}$/, 'Preserved entry has no SHA-256');
  assert.equal(sha256(buffer), entry.sha256, 'Preserved bytes do not match their recorded SHA-256');
  if (entry.bytes !== undefined)
    assert.equal(buffer.length, entry.bytes, 'Preserved bytes do not match their recorded length');
  return buffer;
}

/**
 * Remove every carriage return byte and nothing else.
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
export function stripCarriageReturns(buffer) {
  assert.ok(Buffer.isBuffer(buffer), 'stripCarriageReturns needs a Buffer');
  return Buffer.from(Uint8Array.prototype.filter.call(buffer, (byte) => byte !== CR));
}

/**
 * Compare two byte sequences line by line after carriage returns are removed.
 * Returns the lines present in `corrected` and absent from `frozen`, each with
 * its 1-based line number in `corrected`. Throws unless every `frozen` line
 * appears, in order, in `corrected` (so `corrected` is `frozen` plus insertions).
 * @param {Buffer} frozen
 * @param {Buffer} corrected
 * @returns {{ line: number, text: string }[]}
 */
export function addedLines(frozen, corrected) {
  // latin1 keeps one character per byte, so the comparison is byte exact.
  const before = stripCarriageReturns(frozen).toString('latin1').split('\n');
  const after = stripCarriageReturns(corrected).toString('latin1').split('\n');
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--;
    afterEnd--;
  }
  const added = [];
  let next = start;
  for (let index = start; index < afterEnd; index++) {
    if (next < beforeEnd && before[next] === after[index]) next++;
    else added.push({ line: index + 1, text: Buffer.from(after[index], 'latin1').toString('utf8') });
  }
  assert.equal(
    next,
    beforeEnd,
    `Frozen line ${next + 1} is missing, changed or out of order in the corrected bytes`
  );
  return added;
}

/**
 * Give every line end the CR LF form without doubling an existing carriage return.
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
export function allCrlfLineEnds(buffer) {
  const out = [];
  for (let index = 0; index < buffer.length; index++) {
    if (buffer[index] === LF && (index === 0 || buffer[index - 1] !== CR)) out.push(CR);
    out.push(buffer[index]);
  }
  return Buffer.from(out);
}

// ── Working tree and store ───────────────────────────────────────────────────

const toStored = (entry) => ({ ...entry, base64: entry.base64.split('\n') });

function headBlob(root, name) {
  try {
    // Read only: prints the committed object without any line-ending conversion.
    return execFileSync('git', ['cat-file', 'blob', `HEAD:${name}`], {
      cwd: root,
      maxBuffer: 2 ** 30,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function readIdentities(root) {
  const bytes = readFileSync(boundedPath(root, BUDGET_PATH));
  const identities = JSON.parse(bytes.toString('utf8')).referenceIdentities;
  assert.ok(identities && typeof identities === 'object', 'Frozen budget has no referenceIdentities');
  return { identities, budgetSha256: sha256(bytes) };
}

/**
 * Classify every frozen reference identity by what reproduces its frozen hash.
 * Read only. `bytes` holds the working-tree bytes of the working-copy-only group.
 */
export function surveyReferenceIdentities(root = ROOT) {
  const { identities, budgetSha256 } = readIdentities(root);
  const groups = { blob: [], allCrlf: [], workingCopyOnly: [], alreadyDifferent: [], notAFile: [] };
  const bytes = {};
  for (const [name, frozen] of Object.entries(identities)) {
    const file = boundedPath(root, name);
    if (!existsSync(file) || !statSync(file).isFile()) {
      groups.notAFile.push(name);
      continue;
    }
    const disk = readFileSync(file);
    if (sha256(disk) !== frozen) {
      groups.alreadyDifferent.push(name);
      continue;
    }
    const blob = headBlob(root, name);
    if (blob && sha256(blob) === frozen) groups.blob.push(name);
    else if (blob && sha256(allCrlfLineEnds(blob)) === frozen) groups.allCrlf.push(name);
    else {
      groups.workingCopyOnly.push(name);
      bytes[name] = disk;
    }
  }
  return { identities, budgetSha256, groups, bytes };
}

function readStore(root) {
  const file = boundedPath(root, STORE_PATH);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function writeStore(root, store) {
  writeFileSync(boundedPath(root, STORE_PATH), JSON.stringify(store, null, 2) + '\n');
}

/**
 * Write the decoded bytes of a preserved entry to `relative` under `root`.
 * Refuses escaping or linked paths and returns the SHA-256 read back from disk.
 */
export function writeDecoded(root, relative, entry) {
  const buffer = decodeBytes(entry);
  const file = boundedPath(root, relative);
  writeFileSync(file, buffer);
  const written = sha256(readFileSync(file));
  assert.equal(written, entry.sha256, 'Bytes read back differ from the preserved entry');
  return written;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function preserve(root) {
  const { identities, budgetSha256, groups, bytes } = surveyReferenceIdentities(root);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const store = readStore(root) ?? {
    schemaVersion: 1,
    purpose:
      'Byte-exact copies of frozen V2 reference files whose on-disk bytes no git object reproduces.',
    encoding:
      'base64 rows of 76 columns; whitespace is ignored on decode; sha256 covers the decoded bytes',
    reference: { path: BUDGET_PATH, sha256: budgetSha256 },
    preservedAtCommit: head,
    frozen: {},
    corrected: {},
  };
  let added = 0;
  for (const name of groups.workingCopyOnly) {
    // An existing copy is never replaced or dropped: it may be the only holder of the bytes.
    if (store.frozen[name]) {
      assert.equal(sha256(decodeBytes(store.frozen[name])), identities[name], `Stored copy differs: ${name}`);
      continue;
    }
    const entry = encodeBytes(bytes[name]);
    assert.equal(entry.sha256, identities[name], `Working bytes differ from the frozen hash: ${name}`);
    store.frozen[name] = toStored(entry);
    added++;
    console.log(`preserved frozen ${name} sha256=${entry.sha256} bytes=${entry.bytes} crlf=${entry.crlf} lf=${entry.lf}`);
  }
  writeStore(root, store);
  const count = Object.keys(store.frozen).length;
  console.log(
    `survey: blob=${groups.blob.length} allCrlf=${groups.allCrlf.length} ` +
      `workingCopyOnly=${groups.workingCopyOnly.length} alreadyDifferent=${groups.alreadyDifferent.length} ` +
      `notAFile=${groups.notAFile.length}`
  );
  console.log(`preserve: ${added} added, ${count} frozen entries stored in ${STORE_PATH}`);
  return true;
}

function verify(root) {
  const store = readStore(root);
  assert.ok(store, `No preserved bytes at ${STORE_PATH}; run preserve first`);
  const { identities } = readIdentities(root);
  let failed = 0;
  let verified = 0;
  const check = (kind, name, entry, expected, relation) => {
    try {
      const again = encodeBytes(decodeBytes(entry));
      assert.equal(again.crlf, entry.crlf, 'recorded CRLF count differs from the decoded bytes');
      assert.equal(again.lf, entry.lf, 'recorded LF count differs from the decoded bytes');
      assert.equal(entry.sha256, expected, relation);
      verified++;
      console.log(`verified ${kind} ${name} sha256=${entry.sha256} bytes=${again.bytes} crlf=${again.crlf} lf=${again.lf}`);
    } catch (error) {
      failed++;
      console.log(`MISMATCH ${kind} ${name}: ${String(error.message).split('\n')[0]}`);
    }
  };
  for (const [name, entry] of Object.entries(store.frozen ?? {}))
    check('frozen', name, entry, identities[name], 'differs from the frozen reference hash');
  for (const [name, entry] of Object.entries(store.corrected ?? {})) {
    const file = boundedPath(root, name);
    const disk = existsSync(file) ? sha256(readFileSync(file)) : null;
    check('corrected', name, entry, disk, 'differs from the file in this working copy');
  }
  if (!Object.keys(store.frozen ?? {}).length) {
    failed++;
    console.log('MISMATCH store: no frozen entry is stored');
  }
  console.log(`verify: ${verified} verified, ${failed} mismatched`);
  return failed === 0;
}

function restore(root, args) {
  const fromAt = args.indexOf('--from');
  const from = fromAt === -1 ? undefined : args[fromAt + 1];
  const valueAt = fromAt === -1 ? -1 : fromAt + 1;
  const name = (args.find((arg, index) => !arg.startsWith('--') && index !== valueAt) ?? '').replaceAll('\\', '/');
  assert.ok(name, 'restore needs a path');
  assert.ok(['frozen', 'corrected'].includes(from), 'restore needs --from frozen|corrected');
  const store = readStore(root);
  assert.ok(store, `No preserved bytes at ${STORE_PATH}`);
  const entry = store[from]?.[name];
  assert.ok(entry && Object.hasOwn(store[from], name), `No ${from} entry is stored for ${name}`);
  if (!args.includes('--confirm')) {
    console.log(`restore would overwrite ${name} with its ${from} copy sha256=${entry.sha256}; add --confirm to write`);
    return false;
  }
  const written = writeDecoded(root, name, entry);
  console.log(`restored ${from} ${name} sha256=${written}`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  try {
    const ok =
      command === 'preserve' ? preserve(ROOT)
      : command === 'verify' ? verify(ROOT)
      : command === 'restore' ? restore(ROOT, args)
      : assert.fail('Usage: frozen-bytes.mjs preserve | verify | restore <path> --from frozen|corrected --confirm');
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.error(String(error.message).split('\n')[0]);
    process.exitCode = 1;
  }
}
