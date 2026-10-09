import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addedLines, allCrlfLineEnds, decodeBytes, encodeBytes, stripCarriageReturns, writeDecoded,
} from './frozen-bytes.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Synthetic stand-in for a frozen file: CR LF and bare LF line ends mixed, non-ASCII bytes,
// a lone carriage return inside a line and no final newline.
const mixed = Buffer.from(
  "import a from './a.js';\r\nconst note = 'zażółć — \u{1F57A}';\nfunction f(e) {\r\n  if (e.button === 0) {\n" +
    '    lock();\r\n    return;\n  }\r\n  odd\rcarriage();\n}\r\nexport default f;',
  'utf8'
);

test('frozen bytes: encodeBytes reports hash, length and both kinds of line end, wrapped at 76 columns', () => {
  const entry = encodeBytes(mixed);
  assert.equal(entry.sha256, sha256(mixed));
  assert.equal(entry.bytes, mixed.length);
  assert.equal(entry.crlf, 5);
  assert.equal(entry.lf, 4);
  const rows = entry.base64.split('\n');
  assert.ok(rows.length > 2);
  assert.ok(rows.slice(0, -1).every((row) => row.length === 76));
  assert.ok(rows.at(-1).length >= 1 && rows.at(-1).length <= 76);
  assert.equal(rows.join(''), mixed.toString('base64'));
  assert.deepEqual(encodeBytes(Buffer.alloc(0)), { sha256: sha256(Buffer.alloc(0)), bytes: 0, crlf: 0, lf: 0, base64: '' });
});

test('frozen bytes: a mixed-ending buffer survives base64 text whose own line ends became CRLF', () => {
  const entry = encodeBytes(mixed);
  const converted = { ...entry, base64: entry.base64.replaceAll('\n', '\r\n') };
  assert.notEqual(converted.base64, entry.base64);
  assert.ok(decodeBytes(converted).equals(mixed));
  // Rows as a JSON array, re-indented and padded, decode to the same bytes.
  const rows = { ...entry, base64: entry.base64.split('\n').map((row) => `  ${row}\t\r`) };
  assert.ok(decodeBytes(rows).equals(mixed));
  assert.ok(decodeBytes(JSON.parse(JSON.stringify(rows, null, 2).replaceAll('\n', '\r\n'))).equals(mixed));
  assert.ok(decodeBytes(entry).equals(mixed));
});

test('frozen bytes: decodeBytes refuses changed, truncated or malformed copies', () => {
  const entry = encodeBytes(mixed);
  const swapped = entry.base64[0] === 'A' ? 'B' : 'A';
  assert.throws(() => decodeBytes({ ...entry, base64: swapped + entry.base64.slice(1) }), /recorded SHA-256/);
  assert.throws(() => decodeBytes({ ...entry, base64: entry.base64.slice(4) }), /recorded SHA-256/);
  assert.throws(() => decodeBytes({ ...entry, base64: entry.base64.slice(1) }), /malformed/);
  assert.throws(() => decodeBytes({ ...entry, base64: entry.base64 + '!' }), /malformed/);
  assert.throws(() => decodeBytes({ ...entry, sha256: sha256(Buffer.from('other')) }), /recorded SHA-256/);
  assert.throws(() => decodeBytes({ ...entry, bytes: entry.bytes + 1 }), /recorded length/);
  assert.throws(() => decodeBytes({ sha256: entry.sha256 }), /no base64 text/);
  assert.throws(() => decodeBytes(null), /Missing preserved entry/);
});

test('frozen bytes: stripCarriageReturns removes every carriage return and nothing else', () => {
  const stripped = stripCarriageReturns(mixed);
  assert.ok(Buffer.isBuffer(stripped));
  assert.equal(stripped.includes(0x0d), false);
  assert.equal(stripped.length, mixed.length - 6);
  assert.equal(stripped.toString('utf8'), mixed.toString('utf8').replaceAll('\r', ''));
  assert.ok(mixed.includes(0x0d), 'the input buffer is not modified');
});

const guard = ['    if (e.target.closest(MENU)) {', '      return;', '    }'];
const withGuard = (eol) => {
  const text = mixed.toString('utf8');
  const at = text.indexOf('    lock();');
  return Buffer.from(text.slice(0, at) + guard.map((line) => line + eol).join('') + text.slice(at), 'utf8');
};

test('frozen bytes: addedLines returns only the inserted lines, whatever the line endings', () => {
  const expected = guard.map((text, index) => ({ line: 5 + index, text }));
  // Working-bytes form: untouched lines keep their endings, new lines take CR LF.
  assert.deepEqual(addedLines(mixed, withGuard('\r\n')), expected);
  // Pinned-LF form: every line end of the corrected file is LF.
  assert.deepEqual(addedLines(mixed, stripCarriageReturns(withGuard('\n'))), expected);
  assert.deepEqual(addedLines(mixed, mixed), []);
  assert.deepEqual(addedLines(mixed, allCrlfLineEnds(mixed)), []);
  assert.deepEqual(addedLines(Buffer.from('a\nb\n'), Buffer.from('a\nb\nc\n')), [{ line: 3, text: 'c' }]);
  assert.deepEqual(addedLines(Buffer.from('x\n}\n'), Buffer.from('x\n}\n}\n')).length, 1);
});

test('frozen bytes: addedLines throws when a frozen line is removed, changed or reordered', () => {
  const text = mixed.toString('utf8');
  assert.throws(() => addedLines(mixed, Buffer.from(text.replace('    return;\n', ''), 'utf8')), /missing, changed or out of order/);
  assert.throws(() => addedLines(mixed, Buffer.from(text.replace('e.button === 0', 'e.button === 1'), 'utf8')), /missing, changed or out of order/);
  assert.throws(() => addedLines(Buffer.from('a\nb\nc\n'), Buffer.from('a\nc\nb\n')), /missing, changed or out of order/);
  assert.throws(() => addedLines(withGuard('\n'), mixed), /missing, changed or out of order/);
  // A changed line next to a real insertion is still refused.
  const changed = withGuard('\n').toString('utf8').replace('lock();', 'lock(1);');
  assert.throws(() => addedLines(mixed, Buffer.from(changed, 'utf8')), /missing, changed or out of order/);
});

test('frozen bytes: allCrlfLineEnds converts bare LF without doubling an existing CR', () => {
  assert.equal(allCrlfLineEnds(Buffer.from('a\nb\r\nc\n')).toString('latin1'), 'a\r\nb\r\nc\r\n');
  assert.equal(allCrlfLineEnds(Buffer.from('\nx')).toString('latin1'), '\r\nx');
  const entry = encodeBytes(allCrlfLineEnds(mixed));
  assert.equal(entry.lf, 0);
  assert.equal(entry.crlf, 9);
});

test('frozen bytes: writeDecoded writes the exact bytes inside its root and refuses an escaping path', () => {
  // A throwaway directory outside the repository; no project file is touched.
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'vod-frozen-bytes-'));
  try {
    const entry = encodeBytes(mixed);
    assert.equal(writeDecoded(root, 'restored.js', entry), entry.sha256);
    assert.ok(readFileSync(path.join(root, 'restored.js')).equals(mixed));
    assert.throws(() => writeDecoded(root, '../escaped.js', entry), /escapes owned root/);
    assert.throws(() => writeDecoded(root, 'restored.js', { ...entry, sha256: sha256(Buffer.from('x')) }), /recorded SHA-256/);
    assert.ok(readFileSync(path.join(root, 'restored.js')).equals(mixed), 'a refused copy writes nothing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
