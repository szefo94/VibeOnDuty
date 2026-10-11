// Unit tests of the pure verdict `judge` of the collector control (stop criterion version 2).
// No browser, no network, no gitignored file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, CONTROL_LABEL, CRITERION_VERSION } from './moving-online-control.mjs';
import { WAYPOINTS, MATCH_SECONDS, ARRIVAL_TOLERANCE_M } from './online-route.mjs';

const HASHES = { movingOnlineSha256: 'a'.repeat(64), onlineRouteSha256: 'b'.repeat(64) };
const goodLeg = waypoint => ({ waypoint, outsideLaneSamples: 0, largestStopStepM: 1.9,
  stops: [{ releasedAtM: 2.3, restAtM: 0.4 }] });
const record = (mutate = () => {}) => {
  const legs = WAYPOINTS.map(goodLeg);
  mutate(legs);
  return { label: 'run-x', controlLabel: CONTROL_LABEL, status: 'finished', diagnostic: false,
    criterionVersion: CRITERION_VERSION, ...HASHES,
    tiers: [{ tier: 'high', complete: true, error: null,
      timing: { wallMs: 100000, timeRemainingAtEnd: 500, matchSeconds: MATCH_SECONDS }, legs }] };
};
const verdict = mutate => judge(record(mutate), ['high'], HASHES);

test('the criterion version is 2', () => assert.equal(CRITERION_VERSION, 2));
test('a baseline record passes', () => assert.deepEqual(verdict(), { pass: true, reasons: [] }));
test('a last stop resting 0.38 m past the centre passes', () => {
  assert.equal(verdict(legs => { legs[3].stops = [{ releasedAtM: 2.94, restAtM: -0.38 }]; }).pass, true);
});
test('an earlier stop 2.26 m short and a last stop 0.90 m past passes', () => {
  assert.equal(verdict(legs => { legs[3].stops = [{ releasedAtM: 3, restAtM: 2.26 }, { releasedAtM: 2.3, restAtM: -0.9 }]; }).pass, true);
});
test('a stop at rest 1.96 m past the centre fails and names the leg', () => {
  const result = verdict(legs => { legs[3].stops = [{ releasedAtM: 1.35, restAtM: -1.96 }]; });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some(reason => reason.includes('(34,46)')), result.reasons.join('; '));
});
test('a last stop resting 1.30 m short fails', () => {
  assert.ok(ARRIVAL_TOLERANCE_M < 1.3);
  assert.equal(verdict(legs => { legs[1].stops = [{ releasedAtM: 3, restAtM: 1.3 }]; }).pass, false);
});
test('6 samples outside the lane fail', () => {
  assert.equal(verdict(legs => { legs[0].outsideLaneSamples = 6; }).pass, false);
});
test('a leg with no recorded stop fails', () => {
  assert.equal(verdict(legs => { legs[2].stops = []; }).pass, false);
});
test('a stop step of 3.31 m alone does not fail', () => {
  assert.equal(verdict(legs => { legs[3].largestStopStepM = 3.31; }).pass, true);
});
test('a record without criterionVersion 2 fails and names the superseded criterion', () => {
  const old = record();
  delete old.criterionVersion;
  const result = judge(old, ['high'], HASHES);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some(reason => /superseded/.test(reason)), result.reasons.join('; '));
});
