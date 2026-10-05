import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

test('baseline CLI records actual moving assets with renderer and cleanup evidence', async () => {
  test.setTimeout(240000);
  const result = await promisify(execFile)(process.execPath,
    ['tools/art/review.mjs', '--animation-baseline', '--smoke'],
    { timeout: 220000, windowsHide: true }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error) => ({ code: error.code, stdout: error.stdout })
  );
  expect(result.code, 'moving baseline CLI must complete successfully').toBe(0);
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
  expect(report.identities['public/models/enemy.glb']).toMatch(/^[a-f0-9]{64}$/);
  expect(report.cleanup).toEqual({ browserClosed: true, serverClosed: true });
  expect(report.certification).toBe(false);
});
