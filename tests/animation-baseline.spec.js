import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { captureAnimationBaseline, validateAnimationBaseline } from '../tools/art/review.mjs';

const readOptionalReport = filename => readFile(filename, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

test('budget rejects stale, incomplete, nonfinite and truncated moving evidence', async () => {
  const baseline = JSON.parse(await readFile(
    '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-baseline.json', 'utf8'));
  expect(validateAnimationBaseline(baseline, baseline.identities)).toHaveLength(6);
  expect(() => validateAnimationBaseline(baseline,
    { ...baseline.identities, 'src/main.js': '0'.repeat(64) })).toThrow('Stale source/export identities');
  const incomplete = structuredClone(baseline); incomplete.complete = false;
  expect(() => validateAnimationBaseline(incomplete, baseline.identities)).toThrow('Incomplete');
  const nonfinite = structuredClone(baseline); nonfinite.samples[0].timings.mixerMs.p95 = Infinity;
  expect(() => validateAnimationBaseline(nonfinite, baseline.identities)).toThrow('nonfinite');
  const truncated = structuredClone(baseline); truncated.samples.pop();
  expect(() => validateAnimationBaseline(truncated, baseline.identities)).toThrow('Truncated');
  const media = structuredClone(baseline); media.samples[0].sequence.pop();
  expect(() => validateAnimationBaseline(media, baseline.identities)).toThrow('Truncated');
});

test('baseline CLI records actual moving assets with renderer and cleanup evidence', async () => {
  test.setTimeout(240000);
  const result = await promisify(execFile)(process.execPath,
    ['tools/art/review.mjs', '--animation-baseline', '--smoke'],
    { timeout: 220000, windowsHide: true }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr })
  );
  expect(result.code, result.stderr || 'moving baseline CLI must complete successfully').toBe(0);
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1));
  const report = JSON.parse(await readFile(output.report, 'utf8'));
  expect(report.samples).toHaveLength(1);
  const sample = report.samples[0];
  expect(sample.human).toBe(true);
  expect(sample.packedMaps).toBeGreaterThan(0);
  expect(sample.transitions).toContain('reload');
  expect(sample.transitions).toContain('run');
  expect(sample.movingPoseCount).toBeGreaterThan(10);
  expect(sample.sequence.length).toBeGreaterThan(40);
  expect(sample.gpu).toBeTruthy();
  expect(sample.restored).toBe(true);
  expect(sample.keeperIntact).toBe(true);
  expect(sample.afterRetirement.activeBindings).toBe(0);
  expect(report.identities['public/models/enemy.glb']).toMatch(/^[a-f0-9]{64}$/);
  expect(report.cleanup).toEqual({ browserClosed: true, serverClosed: true });
  expect(report.certification).toBe(false);
});

test('canceled capture cannot publish fresh evidence', async () => {
  const controller = new AbortController();
  const original = await readOptionalReport('.planning/research/.cache/06-art/animation-smoke/report.json');
  let owner, cleanup;
  await expect(captureAnimationBaseline({ smoke: true, signal: controller.signal,
    onOwner: value => { owner = value; controller.abort(Error('cancel test')); },
    onCleanup: value => { cleanup = value; } })).rejects.toThrow('cancel test');
  expect(cleanup.serverClosed).toBe(true);
  await expect(fetch(owner.url)).rejects.toThrow();
  expect(await readOptionalReport(owner.reportPath)).toBe(original);
});

test('failed capture restores borrowed state and releases only its own listener', async () => {
  test.setTimeout(120000);
  const unrelated = createServer((_request, response) => response.end('still owned elsewhere'));
  unrelated.listen(0, '127.0.0.1');
  await once(unrelated, 'listening');
  let owner, cleanup;
  const original = await readOptionalReport('.planning/research/.cache/06-art/animation-smoke/report.json');
  try {
    await expect(captureAnimationBaseline({ smoke: true, failAt: 'render',
      onOwner: value => { owner = value; }, onCleanup: value => { cleanup = value; } }))
      .rejects.toThrow('Injected animation capture failure');
    expect(cleanup).toEqual({ browserClosed: true, serverClosed: true });
    await expect(fetch(owner.url)).rejects.toThrow();
    expect(await (await fetch(`http://127.0.0.1:${unrelated.address().port}/`)).text())
      .toBe('still owned elsewhere');
    expect(await readOptionalReport(owner.reportPath)).toBe(original);
  } finally { await new Promise(resolve => unrelated.close(resolve)); }
});
