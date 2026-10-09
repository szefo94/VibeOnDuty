import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { ROOT, LOCK_PATH, ACCEPTANCE_PATH, ACCEPTANCE_SHA256, PROOF_PATH, PROOF_SHA256,
  TUPLE_PATHS, ORIGINAL_TUPLE, CORRECTED_TUPLE, acceptanceRecordBytes, boundedPath,
  assertNoMotionTransaction, verifyMotionTuple } from './motion-acceptance.mjs';
import { PROTECTED_PROVENANCE_SHA256 } from './runtime-dependencies.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const CACHE = '.planning/research/.cache/07-motion';
const CANDIDATE = CACHE + '/crouch-correction-oaINDh';
async function checkProvenance(root) {
  assert.equal(hash(await fs.readFile(boundedPath(root, 'tools/art/provenance.json'))),
    PROTECTED_PROVENANCE_SHA256, 'Changed protected provenance');
}
async function readState(root) {
  const bytes = {};
  for (const [key, file] of Object.entries(TUPLE_PATHS)) bytes[key] = await fs.readFile(boundedPath(root, file));
  const record = boundedPath(root, ACCEPTANCE_PATH);
  try { bytes.acceptanceBytes = await fs.readFile(record); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await checkProvenance(root);
  return bytes;
}
function binding(bytes) {
  const identities = Object.fromEntries(Object.entries(TUPLE_PATHS).map(([key, file]) => [file, hash(bytes[key])]));
  if (bytes.acceptanceBytes) identities[ACCEPTANCE_PATH] = hash(bytes.acceptanceBytes);
  return verifyMotionTuple(identities, bytes);
}
async function sealedCandidate() {
  const proofBytes = await fs.readFile(boundedPath(ROOT, PROOF_PATH));
  assert.equal(hash(proofBytes), PROOF_SHA256, 'Changed independently sealed candidate proof');
  const r = JSON.parse(proofBytes), directory = boundedPath(ROOT, CANDIDATE);
  assert.equal(path.resolve(r.directory), directory);
  assert.equal(r.complete, true); assert.equal(r.published, false);
  const inputs = {};
  for (const [key, file] of Object.entries({ donorBytes: 'motion.blend',
    manifestBytes: 'candidate.manifest.json', glbBytes: 'candidate.glb' })) {
    inputs[key] = await fs.readFile(boundedPath(directory, file));
    assert.equal(hash(inputs[key]), CORRECTED_TUPLE[TUPLE_PATHS[key]], 'Changed sealed candidate input');
  }
  assert.equal(hash(await fs.readFile(boundedPath(directory, 'independent.glb'))),
    CORRECTED_TUPLE[TUPLE_PATHS.glbBytes], 'Changed independent reopen');
  const old = await fs.readFile(boundedPath(directory, 'accepted107.glb'));
  assert.equal(hash(old), ORIGINAL_TUPLE[TUPLE_PATHS.glbBytes]);
  const canonical = JSON.parse(await fs.readFile(boundedPath(ROOT, TUPLE_PATHS.manifestBytes)));
  const candidate = JSON.parse(inputs.manifestBytes);
  assert.deepEqual({ ...candidate, sourceHash: canonical.sourceHash }, canonical, 'Manifest metadata changed');
  const visualPath = boundedPath(directory, path.relative(directory, r.visual.report));
  const visualBytes = await fs.readFile(visualPath);
  assert.equal(hash(visualBytes), r.visual.reportHash, 'Changed sealed visual report');
  const visual = JSON.parse(visualBytes);
  assert.equal(visual.complete, true); assert.equal(visual.ownedListenerClosed, true);
  for (const media of visual.media) {
    const video = boundedPath(directory, path.relative(directory, media.video.file));
    assert.equal(hash(await fs.readFile(video)), media.video.hash, 'Changed sealed video');
    for (const row of media.rows) for (const image of row.images)
      assert.equal(hash(await fs.readFile(boundedPath(path.dirname(visualPath), image.file))),
        image.hash, 'Changed sealed PNG');
  }
  const { validateCorrection } = await import('./crouch-correction.mjs');
  const semantic = await validateCorrection(inputs.glbBytes, old);
  for (const [file, expected] of Object.entries(r.acceptedBefore))
    if (!Object.hasOwn(ORIGINAL_TUPLE, file))
      assert.equal(hash(await fs.readFile(boundedPath(ROOT, file))), expected, 'Changed protected input');
  return { inputs, proofBytes, protectedInputs: Object.fromEntries(Object.entries(r.acceptedBefore)
    .filter(([file]) => !Object.hasOwn(ORIGINAL_TUPLE, file))), semantic };
}
async function checkProtected(root, protectedInputs) {
  for (const [file, expected] of Object.entries(protectedInputs))
    assert.equal(hash(await fs.readFile(boundedPath(root, file))), expected, 'Protected input changed during transaction');
}
function transactionDirectory(root, transaction) {
  assert.match(transaction.directory, /^\.planning\/research\/\.cache\/07-motion\/promotion-[A-Za-z0-9-]+$/);
  return boundedPath(root, transaction.directory);
}
const unlinkIfPresent = file => fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
async function rollbackLocked(root, transaction) {
  const directory = transactionDirectory(root, transaction);
  // Persist that a restore began, so a retried recovery still reports a rollback.
  await fs.writeFile(boundedPath(directory, 'rollback-started-' + transaction.id), '');
  for (const [key, file] of Object.entries(TUPLE_PATHS)) {
    const backup = await fs.readFile(boundedPath(directory, key + '.backup'));
    assert.equal(hash(backup), ORIGINAL_TUPLE[file], 'Changed rollback backup');
    const destination = boundedPath(root, file), stage = boundedPath(root, file + '.rollback-' + transaction.id);
    // A stage left by an earlier failed rollback of this same transaction is ours;
    // replace it so rollback stays retryable (e.g. after a Windows sharing violation).
    await unlinkIfPresent(stage);
    await fs.writeFile(stage, backup, { flag: 'wx' }); await fs.rename(stage, destination);
  }
  const record = boundedPath(root, ACCEPTANCE_PATH);
  try {
    assert.equal(hash(await fs.readFile(record)), ACCEPTANCE_SHA256, 'Foreign acceptance record; leave transaction blocked');
    await fs.unlink(record);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(binding(await readState(root)).revision, 'original107');
}
// The only input values accepted by this engine are the reviewed sealed packet
// and exact registered buffers. The callback is an in-process fault control used
// by regression tests; the CLI has no override/injection switches.
export async function transactPromotion(root, prepared, onStep = async () => {}) {
  assert.equal(hash(prepared.proofBytes), PROOF_SHA256, 'Unsealed transaction input');
  const protectedInputs = Object.fromEntries(Object.entries(JSON.parse(prepared.proofBytes).acceptedBefore)
    .filter(([file]) => !Object.hasOwn(ORIGINAL_TUPLE, file)));
  for (const [key, file] of Object.entries(TUPLE_PATHS))
    assert.equal(hash(prepared.inputs[key]), CORRECTED_TUPLE[file], 'Unregistered transaction tuple');
  assert.equal(hash(acceptanceRecordBytes()), ACCEPTANCE_SHA256);
  assertNoMotionTransaction(root);
  await checkProtected(root, protectedInputs);
  const state = await readState(root);
  if (binding(state).revision === '07-CR02-directional-crouch') return { idempotent: true, binding: binding(state) };
  const cache = boundedPath(root, CACHE); await fs.mkdir(cache, { recursive: true });
  const directory = await fs.mkdtemp(path.join(cache, 'promotion-'));
  boundedPath(root, path.relative(root, directory));
  const transaction = { schemaVersion: 1, id: randomUUID(), ownerPid: process.pid,
    directory: path.relative(root, directory).replaceAll('\\', '/'), proofSha256: PROOF_SHA256 };
  const lock = boundedPath(root, LOCK_PATH);
  const handle = await fs.open(lock, 'wx');
  let backupReady = false, committed = false;
  const stages = [];
  try {
    await handle.writeFile(JSON.stringify(transaction)); await handle.sync();
    await onStep('locked');
    // Re-evaluate preflight under the exclusive lock, before any publication write.
    const current = await readState(root);
    assert.equal(binding(current).revision, 'original107', 'Preflight tuple changed');
    await checkProtected(root, protectedInputs);
    for (const [key, file] of Object.entries(TUPLE_PATHS)) {
      const backup = boundedPath(directory, key + '.backup');
      await fs.writeFile(backup, current[key], { flag: 'wx' });
      const stage = boundedPath(root, file + '.cr02-' + transaction.id);
      await fs.writeFile(stage, prepared.inputs[key], { flag: 'wx' }); stages.push(stage);
      assert.equal(hash(await fs.readFile(stage)), CORRECTED_TUPLE[file]);
    }
    backupReady = true;
    await checkProtected(root, protectedInputs);
    // Validate actual old values again after staging; generic writers are excluded.
    assert.equal(binding(await readState(root)).revision, 'original107');
    for (const key of ['donorBytes', 'manifestBytes', 'glbBytes']) {
      const file = TUPLE_PATHS[key];
      await fs.rename(boundedPath(root, file + '.cr02-' + transaction.id), boundedPath(root, file));
      await onStep(key);
    }
    const corrected = await readState(root);
    for (const [key, file] of Object.entries(TUPLE_PATHS)) assert.equal(hash(corrected[key]), CORRECTED_TUPLE[file]);
    await checkProtected(root, protectedInputs);
    const recordStage = boundedPath(root, ACCEPTANCE_PATH + '.cr02-' + transaction.id); stages.push(recordStage);
    await fs.writeFile(recordStage, acceptanceRecordBytes(), { flag: 'wx' });
    await fs.rename(recordStage, boundedPath(root, ACCEPTANCE_PATH)); await onStep('acceptanceBytes');
    const final = binding(await readState(root));
    await fs.writeFile(boundedPath(directory, 'complete.json'), JSON.stringify({ ...transaction, binding: final }, null, 2));
    committed = true;
    return { directory, binding: final, idempotent: false };
  } catch (error) {
    if (backupReady) await rollbackLocked(root, transaction);
    else assert.equal(binding(await readState(root)).revision, 'original107');
    await fs.writeFile(boundedPath(directory, 'rolled-back.json'), JSON.stringify({ ...transaction, error: error.message }));
    // Successful rollback is the only failure route allowed to release the guard.
    committed = true;
    throw error;
  } finally {
    await handle.close();
    for (const stage of stages) await fs.unlink(stage).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (committed) await fs.unlink(lock);
  }
}
export async function recoverInterruptedPromotion(root = ROOT) {
  const lock = boundedPath(root, LOCK_PATH);
  const transaction = JSON.parse(await fs.readFile(lock, 'utf8'));
  assert.equal(transaction.proofSha256, PROOF_SHA256);
  assert.match(transaction.id, /^[a-f0-9-]{36}$/);
  assert.ok(Number.isInteger(transaction.ownerPid) && transaction.ownerPid > 0, 'Missing transaction owner');
  let alive = true;
  try { process.kill(transaction.ownerPid, 0); }
  catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
  assert.equal(alive, false, 'Transaction owner is still alive; do not stop or roll back another job');
  // Recovery is an explicit operator operation. Never infer that a live owner died
  // from a timestamp or delete a lock on ordinary invocation.
  const directory = transactionDirectory(root, transaction);
  // Protected drift is never a mixed tuple: stop before any restore or release.
  await checkProvenance(root);
  // Only an exactly verified complete tuple skips the restore. A mixed, unregistered
  // or missing tuple file is unverified and takes the hash-checked backup rollback.
  let revision = null;
  try { revision = binding(await readState(root)).revision; }
  catch (error) { if (error.code !== 'ERR_ASSERTION' && error.code !== 'ENOENT') throw error; }
  const rollbackStarted = await fs.access(boundedPath(directory, 'rollback-started-' + transaction.id))
    .then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; });
  // original107: interrupted before any publication rename (backups may be absent
  // or partial), or an earlier rollback already restored it. Corrected with the
  // pinned record: interrupted after the final commit step, so finalise instead of
  // reverting a valid promotion.
  const outcome = revision === '07-CR02-directional-crouch' ? 'finalised'
    : revision === 'original107' && !rollbackStarted ? 'untouched' : 'rolled-back';
  if (outcome === 'finalised') {
    // Same protected-input check the transaction makes before writing the record.
    const proofBytes = await fs.readFile(boundedPath(ROOT, PROOF_PATH));
    assert.equal(hash(proofBytes), PROOF_SHA256, 'Changed independently sealed candidate proof');
    await checkProtected(root, Object.fromEntries(Object.entries(JSON.parse(proofBytes).acceptedBefore)
      .filter(([file]) => !Object.hasOwn(ORIGINAL_TUPLE, file))));
  } else if (revision !== 'original107') await rollbackLocked(root, transaction);
  for (const file of [...Object.values(TUPLE_PATHS), ACCEPTANCE_PATH])
    for (const kind of ['.cr02-', '.rollback-']) await unlinkIfPresent(boundedPath(root, file + kind + transaction.id));
  const final = binding(await readState(root));
  assert.equal(final.revision, outcome === 'finalised' ? '07-CR02-directional-crouch' : 'original107');
  // Own uniquely named report with reviewed fields only; never another run's record.
  await fs.writeFile(boundedPath(directory, 'recovery-' + transaction.id + '.json'), JSON.stringify({
    schemaVersion: 1, id: transaction.id, ownerPid: transaction.ownerPid, directory: transaction.directory,
    proofSha256: PROOF_SHA256, binding: final, recovery: outcome }, null, 2));
  await fs.unlink(lock);
  return { recovered: true, outcome, directory: transaction.directory };
}
export async function promoteMotion() {
  assertNoMotionTransaction();
  const prepared = await sealedCandidate();
  const result = await transactPromotion(ROOT, prepared);
  const { verifyRuntimeDependencies } = await import('./runtime-dependencies.mjs');
  const { animationIdentities } = await import('./review.mjs');
  result.runtimeDependencies = verifyRuntimeDependencies(await animationIdentities());
  console.log(JSON.stringify(result, null, 2)); return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (process.argv.length !== 3 || !['promote', 'rollback-interrupted'].includes(command)) throw Error('Expected promote or rollback-interrupted');
  // Recovery may finalise a completed promotion instead of reverting; always say which.
  (command === 'promote' ? promoteMotion()
    : recoverInterruptedPromotion().then(result => console.log(JSON.stringify(result, null, 2)))).catch(error => {
    console.error(error); process.exitCode = 1;
  });
}
