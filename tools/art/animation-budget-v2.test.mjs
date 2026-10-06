import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = path.resolve('tools/art/animation-budget-v2.mjs');
const reference = path.resolve('.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-view-reference-v2.json');

test('freeze creates an immutable numeric source-eye contract from the qualified twelve profiles', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vod-budget-v2-'));
  try {
    const budget = path.join(directory, 'budget.json');
    const result = spawnSync(process.execPath, [cli, 'freeze', '--reference', reference, '--budget', budget], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const frozen = JSON.parse(await readFile(budget, 'utf8'));
    assert.equal(frozen.contractVersion, 'source-eye-view-v2');
    assert.equal(frozen.profiles.length, 6);
    const report = JSON.parse(await readFile(reference, 'utf8'));
    const values = report.samples.filter(s => s.tier === 'low' && s.actorCount === 1).map(s => s.timings.correctionMs.median);
    assert.equal(frozen.profiles[0].timings.correctionMs.medianUpperMs, Math.max(...values) + Math.abs(values[0] - values[1]));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
