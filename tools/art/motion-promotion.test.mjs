import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runtimeDependencyBytes, verifyRuntimeDependencies } from './runtime-dependencies.mjs';
import { ACCEPTANCE_PATH, LOCK_PATH, ACCEPTANCE_SHA256, TUPLE_PATHS, ORIGINAL_TUPLE,
  CORRECTED_TUPLE, PROOF_PATH, acceptanceRecordBytes, verifyMotionTuple, boundedPath,
  assertNoMotionTransaction, exactCorrectionException, CORRECTION_DEPENDENTS,
  REVIEWED_SOURCE_EXCEPTIONS } from './motion-acceptance.mjs';
import { transactPromotion, recoverInterruptedPromotion } from './promote-motion.mjs';
import { BUDGET_PATH, STORE_PATH, addedLines, decodeBytes, stripCarriageReturns } from './frozen-bytes.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = { glbBytes: 'public/models/enemy.glb', donorBytes: 'tools/art/sources/motion.blend',
  manifestBytes: 'tools/art/motion-manifest.json', provenanceBytes: 'tools/art/provenance.json' };
const bytes = { ...runtimeDependencyBytes(), glbBytes: readFileSync(paths.glbBytes),
  donorBytes: readFileSync(paths.donorBytes) };
const identities = Object.fromEntries(Object.entries(paths).map(([key, file]) => [file, hash(bytes[key])]));
if (bytes.acceptanceBytes) identities[ACCEPTANCE_PATH] = hash(bytes.acceptanceBytes);

for (const key of ['glbBytes', 'donorBytes']) test('actual ' + key + ' corruption cannot self-qualify', () => {
  const changed = Buffer.from(bytes[key]); changed[changed.length - 17] ^= 1;
  assert.throws(() => verifyRuntimeDependencies({ ...identities, [paths[key]]: hash(changed) },
    { ...bytes, [key]: changed }), /registered|tuple|accepted/);
});

// Plan 07-21. These controls read tracked files only and never compare a hash with a
// file whose line endings a checkout may convert, so they hold on Windows and LF checkouts
// and do not need the gitignored candidate cache below.
{
  const SOURCE = 'src/main.js';
  const FROZEN_MAIN = 'c762044675702688313ce81c7812153bdb30bc95951aa1995e69337414a882d3';
  const correctedBinding = { revision: '07-CR02-directional-crouch' };
  const originalBinding = { revision: 'original107' };
  const entry = REVIEWED_SOURCE_EXCEPTIONS[SOURCE];
  const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  const frozenBytes = decodeBytes(store.frozen[SOURCE]);
  const correctedBytes = decodeBytes(store.corrected[SOURCE]);
  const reference = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')).referenceIdentities;

  test('reviewed source exception: registry holds one exact pair for src/main.js', () => {
    assert.deepEqual(Object.keys(REVIEWED_SOURCE_EXCEPTIONS), [SOURCE]);
    assert.ok(Object.isFrozen(REVIEWED_SOURCE_EXCEPTIONS) && Object.isFrozen(entry));
    assert.deepEqual(Object.keys(entry).sort(), ['corrected', 'guardLines', 'hashBasis', 'original', 'review']);
    assert.equal(entry.original, FROZEN_MAIN);
    assert.equal(entry.original, reference[SOURCE], 'original is the frozen reference identity');
    assert.match(entry.corrected, /^[0-9a-f]{64}$/);
    assert.notEqual(entry.corrected, entry.original);
    assert.ok(['pinned-lf', 'working-bytes'].includes(entry.hashBasis));
    assert.ok(Number.isInteger(entry.guardLines) && entry.guardLines > 0);
    assert.equal(entry.review,
      '.planning/phases/07-movement-matched-and-action-safe-animation/07-21-SOURCE-EXCEPTION-REVIEW.md');
  });

  test('reviewed source exception: rule accepts only the exact pair under the corrected binding', () => {
    const { original, corrected } = entry;
    assert.equal(exactCorrectionException(SOURCE, original, corrected, correctedBinding), true);
    // Any other current hash, including the unchanged one and a one-character neighbour.
    const near = corrected.slice(0, -1) + (corrected.endsWith('0') ? '1' : '0');
    for (const current of ['b'.repeat(64), near, original, '', undefined, null])
      assert.equal(exactCorrectionException(SOURCE, original, current, correctedBinding), false);
    // Any other reference hash.
    for (const other of ['a'.repeat(64), corrected, undefined])
      assert.equal(exactCorrectionException(SOURCE, other, corrected, correctedBinding), false);
    // The original binding, and any binding that is not the corrected one.
    for (const binding of [originalBinding, { revision: undefined }, {}])
      assert.equal(exactCorrectionException(SOURCE, original, corrected, binding), false);
    // Swapped arguments.
    assert.equal(exactCorrectionException(SOURCE, corrected, original, correctedBinding), false);
    // Every other frozen reference identity, and near-miss spellings, given the same hashes.
    const others = Object.keys(reference).filter(name => name !== SOURCE);
    assert.ok(others.includes('src/loop.js') && others.includes('src/input.js') && others.includes('index.html'));
    for (const name of [...others, 'src/Main.js', './src/main.js', 'src\\main.js', 'main.js', 'src/main.js '])
      assert.equal(exactCorrectionException(name, original, corrected, correctedBinding), false, name);
  });

  test('reviewed source exception: no other name gains an exception', () => {
    // The names that can ever be excepted are the registered ones and nothing else.
    const registered = [...Object.keys(CORRECTED_TUPLE), ...Object.keys(CORRECTION_DEPENDENTS), SOURCE].sort();
    assert.deepEqual(registered, ['public/models/enemy.glb', 'src/builders/enemyGLTF.test.js', SOURCE,
      'tools/art/motion-manifest.json', 'tools/art/sources/motion.blend'].sort());
    const pairs = { ...Object.fromEntries(Object.keys(CORRECTED_TUPLE).map(name =>
      [name, [ORIGINAL_TUPLE[name], CORRECTED_TUPLE[name]]])),
    ...Object.fromEntries(Object.entries(CORRECTION_DEPENDENTS).map(([name, pin]) => [name, [pin.original, pin.corrected]])),
    [SOURCE]: [entry.original, entry.corrected] };
    for (const name of Object.keys(reference)) {
      const allowed = Object.hasOwn(pairs, name);
      for (const [from, to] of Object.values(pairs))
        assert.equal(exactCorrectionException(name, from, to, correctedBinding),
          allowed && pairs[name][0] === from && pairs[name][1] === to, name);
    }
  });

  test('reviewed source exception: registry hashes are the preserved bytes', () => {
    assert.equal(entry.corrected, hash(correctedBytes));
    assert.equal(entry.original, hash(frozenBytes));
  });

  test('reviewed source exception: preserved corrected bytes are the reviewed content', () => {
    assert.ok(stripCarriageReturns(correctedBytes).equals(stripCarriageReturns(readFileSync(SOURCE))));
  });

  test('reviewed source exception: frozen bytes plus the guard lines are the corrected bytes', () => {
    const added = addedLines(frozenBytes, correctedBytes);
    assert.equal(added.length, entry.guardLines);
    // Every added line sits inside the one document mousedown handler.
    const lines = stripCarriageReturns(correctedBytes).toString('latin1').split('\n');
    const open = lines.indexOf("document.addEventListener('mousedown', (e) => {");
    assert.ok(open !== -1 && lines.indexOf(lines[open], open + 1) === -1);
    const close = lines.indexOf('});', open);
    for (const line of added) assert.ok(line.line - 1 > open && line.line - 1 < close, line.text);
    const record = JSON.parse(readFileSync(
      '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-21-source-change.json', 'utf8'));
    assert.equal(record.addedLines.length, entry.guardLines);
    assert.deepEqual(record.addedLines, added);
    assert.equal(record.mainJsSha256After, entry.corrected);
    assert.equal(record.hashBasis, entry.hashBasis);
  });

  test('reviewed source exception: pinned-lf content is the registered hash on every checkout',
    { skip: entry.hashBasis === 'pinned-lf' ? false : 'hash basis is ' + entry.hashBasis }, () => {
      assert.equal(correctedBytes.indexOf(0x0d), -1, 'corrected copy contains a carriage return');
      // Safe on every checkout: the path is pinned to LF by the exact-path attribute below.
      assert.equal(hash(readFileSync(SOURCE)), entry.corrected);
      const attributes = readFileSync('.gitattributes', 'utf8').split(/\r?\n/);
      assert.equal(attributes.filter(line => line === SOURCE + ' text eol=lf').length, 1);
    });
}

const candidateRoot = '.planning/research/.cache/07-motion/crouch-correction-oaINDh';
// The sealed candidate packet and retained originals live in the gitignored research
// cache, so a fresh clone has neither. Skip visibly instead of failing at import.
if (!existsSync(candidateRoot + '/candidate.glb')) {
  test('sealed CR02 candidate and transaction controls', { skip: 'requires ' + candidateRoot }, () => {});
} else {
  const corrected = { provenanceBytes: bytes.provenanceBytes,
    glbBytes: readFileSync(candidateRoot + '/candidate.glb'),
    donorBytes: readFileSync(candidateRoot + '/motion.blend'),
    manifestBytes: readFileSync(candidateRoot + '/candidate.manifest.json'),
    acceptanceBytes: acceptanceRecordBytes() };
  const original = { provenanceBytes: bytes.provenanceBytes,
    glbBytes: readFileSync(candidateRoot + '/accepted107.glb'),
    donorBytes: bytes.donorBytes, manifestBytes: bytes.manifestBytes };
  // After publication the tests retain the actual original donor/manifest backups.
  if (hash(original.donorBytes) !== ORIGINAL_TUPLE[TUPLE_PATHS.donorBytes]) {
    const dirs = (await fs.readdir('.planning/research/.cache/07-motion')).filter(n => n.startsWith('promotion-'));
    let found = false;
    for (const dir of dirs) {
      try {
        const donor = readFileSync('.planning/research/.cache/07-motion/' + dir + '/donorBytes.backup');
        const manifest = readFileSync('.planning/research/.cache/07-motion/' + dir + '/manifestBytes.backup');
        if (hash(donor) === ORIGINAL_TUPLE[TUPLE_PATHS.donorBytes] && hash(manifest) === ORIGINAL_TUPLE[TUPLE_PATHS.manifestBytes]) {
          original.donorBytes = donor; original.manifestBytes = manifest; found = true; break;
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    assert.ok(found, 'Retained original tuple required for historical controls');
  }
  const ids = b => Object.fromEntries([...Object.entries(TUPLE_PATHS).map(([key, file]) => [file, hash(b[key])]),
    ['tools/art/provenance.json', hash(b.provenanceBytes)], ...(b.acceptanceBytes ? [[ACCEPTANCE_PATH, hash(b.acceptanceBytes)]] : [])]);
  const prepared = { inputs: corrected, proofBytes: readFileSync(PROOF_PATH) };

  test('exact corrected tuple and code-pinned record pass; original requires actual original buffers', () => {
    assert.equal(hash(acceptanceRecordBytes()), ACCEPTANCE_SHA256);
    assert.equal(verifyRuntimeDependencies(ids(corrected), corrected).motion.revision, '07-CR02-directional-crouch');
    assert.equal(verifyRuntimeDependencies(ids(original), original, { historicalOriginal: true }).motion.revision, 'original107');
    assert.throws(() => verifyRuntimeDependencies(ids(corrected), { ...corrected, acceptanceBytes: undefined }), /Missing pinned/);
    const forged = Buffer.from(acceptanceRecordBytes()); forged[19] ^= 1;
    assert.throws(() => verifyRuntimeDependencies({ ...ids(corrected), [ACCEPTANCE_PATH]: hash(forged) },
      { ...corrected, acceptanceBytes: forged }), /registry bytes/);
    assert.throws(() => verifyRuntimeDependencies(ids(original), { ...original, acceptanceBytes: acceptanceRecordBytes() }), /historical/);
  });
  for (const key of Object.keys(TUPLE_PATHS)) test('mixed tuple rejects ' + key, () => {
    const mixed = { ...corrected, [key]: original[key] };
    assert.throws(() => verifyRuntimeDependencies(ids(mixed), mixed), /mixed motion tuple/);
  });
  test('manifest metadata, skin and unrelated motion mutations never get a V2 tuple exception', () => {
    const binding = verifyMotionTuple(ids(corrected), corrected);
    for (const file of Object.keys(CORRECTED_TUPLE)) {
      assert.equal(exactCorrectionException(file, ORIGINAL_TUPLE[file], CORRECTED_TUPLE[file], binding), true);
      assert.equal(exactCorrectionException(file, ORIGINAL_TUPLE[file], 'b'.repeat(64), binding), false);
    }
    assert.equal(exactCorrectionException('src/artMaterials.js', 'a', 'b', binding), false);
    for (const [file, pin] of Object.entries(CORRECTION_DEPENDENTS)) {
      assert.equal(hash(readFileSync(file)), pin.corrected, 'Pinned dependent matches the checked-in file');
      assert.equal(exactCorrectionException(file, pin.original, pin.corrected, binding), true);
      assert.equal(exactCorrectionException(file, pin.original, 'b'.repeat(64), binding), false);
      assert.equal(exactCorrectionException(file, 'a'.repeat(64), pin.corrected, binding), false);
      assert.equal(exactCorrectionException(file, pin.original, pin.corrected, verifyMotionTuple(ids(original), original, { historicalOriginal: true })), false);
    }
    const manifest = JSON.parse(corrected.manifestBytes); manifest.actions[0].cycleDisplacement += .1;
    const b = { ...corrected, manifestBytes: Buffer.from(JSON.stringify(manifest)) };
    assert.throws(() => verifyRuntimeDependencies(ids(b), b), /registered|accepted/);
  });
  async function fixtureRoot() {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'vod-cr02-transaction-'));
    for (const [key, file] of Object.entries(paths)) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), original[key]);
    }
    for (const file of Object.keys(JSON.parse(prepared.proofBytes).acceptedBefore)) {
      if (Object.hasOwn(ORIGINAL_TUPLE, file) || file === 'tools/art/provenance.json') continue;
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), readFileSync(file));
    }
    return root;
  }
  for (const step of ['locked', 'donorBytes', 'manifestBytes', 'glbBytes', 'acceptanceBytes'])
    test('reader blocks and owned rollback restores exact originals after failure at ' + step, async () => {
      const root = await fixtureRoot();
      try {
        await assert.rejects(transactPromotion(root, prepared, async current => {
          assert.throws(() => assertNoMotionTransaction(root), /Active\/incomplete/);
          if (current === step) throw Error('injected ' + step);
        }), /injected/);
        assertNoMotionTransaction(root);
        for (const [key, file] of Object.entries(TUPLE_PATHS)) assert.equal(hash(await fs.readFile(path.join(root, file))), ORIGINAL_TUPLE[file]);
        await assert.rejects(fs.access(path.join(root, ACCEPTANCE_PATH)));
      } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
  test('successful transaction accepts record last and second invocation is idempotent', async () => {
    const root = await fixtureRoot();
    try {
      const first = await transactPromotion(root, prepared);
      assert.equal(first.binding.revision, '07-CR02-directional-crouch');
      assert.equal((await transactPromotion(root, prepared)).idempotent, true);
      assert.equal(hash(await fs.readFile(path.join(root, ACCEPTANCE_PATH))), ACCEPTANCE_SHA256);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('ordinary generic motion, art build and provenance writers cannot bypass frozen publication', async () => {
    const { publishLatest } = await import('./motion-pipeline.mjs');
    const { refreshProvenance } = await import('./pipeline.mjs');
    await assert.rejects(publishLatest(), /generic writers excluded/);
    await assert.rejects(refreshProvenance(), /generic writers excluded/);
    for (const command of ['build', 'build-slice']) {
      const result = spawnSync(process.execPath, ['tools/art/pipeline.mjs', command], { encoding: 'utf8' });
      assert.equal(result.status, 1); assert.match(result.stderr, /generic writers excluded/);
    }
  });
  function crashAt(root, step) {
    const source = `import {readFileSync} from 'node:fs';import {transactPromotion} from ${JSON.stringify(new URL('./promote-motion.mjs', import.meta.url).href)};
      await transactPromotion(${JSON.stringify(root)}, {proofBytes:readFileSync(${JSON.stringify(path.resolve(PROOF_PATH))}), inputs:{
      glbBytes:readFileSync(${JSON.stringify(path.resolve(candidateRoot + '/candidate.glb'))}),
      donorBytes:readFileSync(${JSON.stringify(path.resolve(candidateRoot + '/motion.blend'))}),
      manifestBytes:readFileSync(${JSON.stringify(path.resolve(candidateRoot + '/candidate.manifest.json'))})}},
      step=>{if(step===${JSON.stringify(step)})process.exit(73)});`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
    assert.equal(child.status, 73, child.stderr);
    assert.throws(() => assertNoMotionTransaction(root), /Active\/incomplete/);
  }
  const assertOriginal = async root => {
    for (const file of Object.values(TUPLE_PATHS)) assert.equal(hash(await fs.readFile(path.join(root, file))), ORIGINAL_TUPLE[file]);
    await assert.rejects(fs.access(path.join(root, ACCEPTANCE_PATH)));
  };
  test('abrupt owned process interruption stays blocked until explicit dead-owner rollback', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'manifestBytes');
      await assert.rejects(transactPromotion(root, prepared), /Active\/incomplete/);
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'rolled-back'); assertNoMotionTransaction(root);
      await assertOriginal(root);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('interruption before backups exist recovers without restore and leaves originals', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'locked');
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'untouched'); assertNoMotionTransaction(root);
      await assertOriginal(root);
      assert.equal((await transactPromotion(root, prepared)).binding.revision, '07-CR02-directional-crouch');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('interruption after the acceptance record finalises the valid promotion instead of reverting', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'acceptanceBytes');
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'finalised'); assertNoMotionTransaction(root);
      for (const file of Object.values(TUPLE_PATHS)) assert.equal(hash(await fs.readFile(path.join(root, file))), CORRECTED_TUPLE[file]);
      assert.equal(hash(await fs.readFile(path.join(root, ACCEPTANCE_PATH))), ACCEPTANCE_SHA256);
      assert.equal((await transactPromotion(root, prepared)).idempotent, true);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('rollback stays retryable when an earlier rollback left its own stage file', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'manifestBytes');
      const { id } = JSON.parse(await fs.readFile(path.join(root, LOCK_PATH), 'utf8'));
      const leftover = path.join(root, TUPLE_PATHS.glbBytes + '.rollback-' + id);
      await fs.writeFile(leftover, 'partial');
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'rolled-back'); assertNoMotionTransaction(root);
      await assertOriginal(root); await assert.rejects(fs.access(leftover));
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  const noStages = async root => {
    for (const file of [...Object.values(TUPLE_PATHS), ACCEPTANCE_PATH]) for (const name of await fs.readdir(path.dirname(path.join(root, file))))
      assert.doesNotMatch(name, /\.(cr02|rollback)-/);
  };
  test('interruption with the corrected tuple but no acceptance record rolls back and leaves no stages', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'glbBytes');
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'rolled-back'); assertNoMotionTransaction(root);
      await assertOriginal(root); await noStages(root);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('changed protected provenance stops recovery before any restore and keeps the lock', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'acceptanceBytes');
      const provenance = path.join(root, paths.provenanceBytes), good = await fs.readFile(provenance);
      await fs.appendFile(provenance, ' ');
      await assert.rejects(recoverInterruptedPromotion(root), /Changed protected provenance/);
      assert.throws(() => assertNoMotionTransaction(root), /Active\/incomplete/);
      for (const file of Object.values(TUPLE_PATHS)) assert.equal(hash(await fs.readFile(path.join(root, file))), CORRECTED_TUPLE[file]);
      assert.equal(hash(await fs.readFile(path.join(root, ACCEPTANCE_PATH))), ACCEPTANCE_SHA256);
      await fs.writeFile(provenance, good);
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'finalised');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('finalising recovery rejects a changed protected input and keeps the lock', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'acceptanceBytes');
      const file = Object.keys(JSON.parse(prepared.proofBytes).acceptedBefore)
        .find(name => !Object.hasOwn(ORIGINAL_TUPLE, name) && name !== 'tools/art/provenance.json');
      await fs.appendFile(path.join(root, file), ' ');
      await assert.rejects(recoverInterruptedPromotion(root), /Protected input changed/);
      assert.throws(() => assertNoMotionTransaction(root), /Active\/incomplete/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('a missing tuple file still recovers from hash-checked backups and reports a rollback', async () => {
    const root = await fixtureRoot();
    try {
      crashAt(root, 'manifestBytes');
      await fs.unlink(path.join(root, TUPLE_PATHS.glbBytes));
      assert.equal((await recoverInterruptedPromotion(root)).outcome, 'rolled-back'); assertNoMotionTransaction(root);
      await assertOriginal(root); await noStages(root);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('forged lock directory or id cannot direct recovery outside its own transaction paths', async () => {
    const root = await fixtureRoot();
    try {
      const forged = { id: '12345678-1234-1234-1234-123456789012', ownerPid: 2 ** 22 - 3, proofSha256: hash(prepared.proofBytes) };
      for (const directory of ['../outside', 'tools/art', '.planning/research/.cache/07-motion/promotion-x/../..']) {
        await fs.writeFile(path.join(root, LOCK_PATH), JSON.stringify({ ...forged, directory }));
        await assert.rejects(recoverInterruptedPromotion(root));
      }
      await fs.writeFile(path.join(root, LOCK_PATH), JSON.stringify({ ...forged, id: '../../x', directory: 'unused' }));
      await assert.rejects(recoverInterruptedPromotion(root));
      assert.throws(() => assertNoMotionTransaction(root), /Active\/incomplete/);
      await assertOriginal(root);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('live lock owners and linked paths cannot be recovered or used', async () => {
    const root = await fixtureRoot();
    try {
      await fs.writeFile(path.join(root, LOCK_PATH), JSON.stringify({ id: '12345678-1234-1234-1234-123456789012',
        ownerPid: process.pid, proofSha256: hash(prepared.proofBytes), directory: 'unused' }));
      await assert.rejects(recoverInterruptedPromotion(root), /still alive/);
      assert.throws(() => boundedPath(root, '../escape'), /escapes/);
      await fs.symlink(path.join(root, 'public'), path.join(root, 'alias'), 'junction');
      assert.throws(() => boundedPath(root, 'alias/models/enemy.glb'), /Linked/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
}
