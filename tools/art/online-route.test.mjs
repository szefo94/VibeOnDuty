import test from 'node:test';
import assert from 'node:assert/strict';
import { bunkerData } from '../../src/shared/maps/bunker.js';
import { CELL, PLAYER_R, MOVE_SPEED } from '../../src/config.js';
import * as route from './online-route.mjs';
import { WAYPOINTS, START, ARRIVAL_TOLERANCE_M, LANE_MARGIN_M, STOP_LEAD_M, MAX_STOP_STEP_M, CROUCH_WITHIN_M,
  CROUCH_SPEED_M_S, STALL_TICKS, STALL_PROGRESS_M, MAX_CORRECTIONS, MATCH_SECONDS, TIER_DEADLINE_MS,
  TIER_TEARDOWN_ALLOWANCE_MS, LEG_BOUND_MS, ACTION_BOUND_MS, DEATH_BOUND_MS, routeLegs, laneCells,
  blockedLaneCells, insideBox, outsideLane, chooseKey, alongTrack, shouldCrouch, shouldRelease, classifyLeg,
  legSummary, boundedMs, RELEASE_AT_M, INPUT_LIFE_S, INPUT_LIFE_STEP_M, STANDING_FACTOR, PROGRESS_SEEN_M } from './online-route.mjs';

const map = { tiles: bunkerData.tiles, heightmap: bunkerData.heightmap, width: bunkerData.width, height: bunkerData.height };
const copyWith = (column, row, tile) => ({ ...map,
  tiles: map.tiles.map((line, r) => line.map((value, c) => r === row && c === column ? tile : value)) });
const keys = cells => cells.map(cell => cell.column + ',' + cell.row);
const span = (columns, rows) => rows.flatMap(row => columns.map(column => column + ',' + row));
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
const legs = routeLegs();

test('constants: the route values are the derived ones and agree with the shared map data', () => {
  assert.deepEqual(WAYPOINTS, [[62, 46], [62, 22], [34, 22], [34, 46]]);
  assert.deepEqual(START, [bunkerData.spawnAttacker.x, bunkerData.spawnAttacker.z]);
  assert.deepEqual(START, [66, 46]);
  assert.equal(bunkerData.CELL, CELL);
  assert.ok(Math.abs(ARRIVAL_TOLERANCE_M + LANE_MARGIN_M + PLAYER_R - CELL / 2) < 1e-12);
  assert.equal(LANE_MARGIN_M, 0.4);
  assert.equal(ARRIVAL_TOLERANCE_M, 1.25);
  assert.equal(TIER_DEADLINE_MS + TIER_TEARDOWN_ALLOWANCE_MS, 600000);
  assert.equal(TIER_DEADLINE_MS, 540000);
  assert.ok(MATCH_SECONDS * 1000 >= TIER_DEADLINE_MS);
  assert.equal(MATCH_SECONDS, 600);
  assert.equal(MAX_STOP_STEP_M, STOP_LEAD_M + ARRIVAL_TOLERANCE_M);
  assert.ok(STOP_LEAD_M <= CROUCH_WITHIN_M);
  assert.equal(STOP_LEAD_M, 1.87, 'the median stop step measured by the tracer');
  assert.equal(CROUCH_WITHIN_M, 8);
  assert.ok(Math.abs(CROUCH_SPEED_M_S - MOVE_SPEED * 0.72) < 1e-12);
  assert.equal(STALL_TICKS, 150);
  assert.equal(STALL_PROGRESS_M, 0.5);
  assert.equal(MAX_CORRECTIONS, 12);
  assert.deepEqual([LEG_BOUND_MS, ACTION_BOUND_MS, DEATH_BOUND_MS], [90000, 30000, 60000]);
});

test('the module is pure: only functions, numbers and frozen route data are exported', () => {
  for (const [name, value] of Object.entries(route)) {
    assert.ok(['function', 'number'].includes(typeof value) || Array.isArray(value), name);
    if (Array.isArray(value)) assert.ok(Object.isFrozen(value), name + ' is frozen');
  }
});

test('routeLegs chains the start and the four waypoints', () => {
  assert.deepEqual(legs, [[[66, 46], [62, 46]], [[62, 46], [62, 22]], [[62, 22], [34, 22]], [[34, 22], [34, 46]]]);
});

test('laneCells returns exactly the one-cell lanes of the real map', () => {
  const cells = legs.map(([from, to]) => keys(laneCells(map, from, to, ARRIVAL_TOLERANCE_M, PLAYER_R)).sort());
  assert.deepEqual(cells[0], span([15, 16], [11]).sort());
  assert.deepEqual(cells[1], span([15], range(5, 11)).sort());
  assert.deepEqual(cells[2], span(range(8, 15), [5]).sort());
  assert.deepEqual(cells[3], span([8], range(5, 11)).sort());
});

test('blockedLaneCells is empty on the real map: every lane cell is tile 0 at height 0', () => {
  assert.deepEqual(blockedLaneCells(map, legs), []);
  for (const [from, to] of legs)
    for (const { column, row } of laneCells(map, from, to, ARRIVAL_TOLERANCE_M, PLAYER_R)) {
      assert.equal(bunkerData.tiles[row][column], 0);
      assert.equal(bunkerData.heightmap[row][column], 0);
    }
});

test('control: a tolerance of 1.7 reaches the solid cell column 14 row 11', () => {
  const blocked = blockedLaneCells(map, legs, 1.7);
  assert.ok(blocked.length > 0);
  assert.ok(keys(blocked).includes('14,11'));
  assert.equal(blocked.find(cell => cell.column === 14 && cell.row === 11).tile, 1);
});

test('control: a solid column 16 row 7 is outside the lane at 1.25 and inside it at 1.7', () => {
  const altered = copyWith(16, 7, 1);
  assert.deepEqual(blockedLaneCells(altered, legs), []);
  const blocked = blockedLaneCells(altered, legs, 1.7);
  assert.ok(blocked.length > 0);
  assert.ok(keys(blocked).includes('16,7'));
});

test('control: a solid column 15 row 8 blocks the lane at tolerance 1.25', () => {
  const blocked = blockedLaneCells(copyWith(15, 8, 1), legs);
  assert.ok(blocked.length > 0);
  assert.deepEqual([...new Set(keys(blocked))], ['15,8']);
});

test('control: a raised lane cell is blocked even when its tile is floor', () => {
  const raised = { ...map, heightmap: map.heightmap.map((line, r) => line.map((value, c) => r === 5 && c === 11 ? 0.7 : value)) };
  assert.deepEqual(keys(blockedLaneCells(raised, legs)), ['11,5']);
});

test('control: a waypoint moved to (60.5,46) names column 14', () => {
  const blocked = blockedLaneCells(map, routeLegs(START, [[60.5, 46], ...WAYPOINTS.slice(1)]));
  assert.ok(blocked.length > 0);
  assert.ok(blocked.some(cell => cell.column === 14));
});

test('insideBox is a per-axis box of the arrival tolerance', () => {
  assert.equal(insideBox({ x: 62 + 1.25, z: 22 - 1.25 }, [62, 22]), true);
  assert.equal(insideBox({ x: 62 + 1.26, z: 22 }, [62, 22]), false);
  assert.equal(insideBox({ x: 62, z: 22 - 1.26 }, [62, 22]), false);
  assert.equal(insideBox({ x: 35.76, z: 21.90 }, [34, 22]), false, 'the recorded failure position');
  assert.equal(insideBox({ x: 34, z: 22 }, [34, 22]), true);
});

test('outsideLane judges the body centre against the rectangle between the two arrival boxes', () => {
  assert.equal(outsideLane({ x: 66, z: 46 }, [66, 46], [62, 46]), false);
  assert.equal(outsideLane({ x: 60.74, z: 46 }, [66, 46], [62, 46]), true, 'past the far side of the box');
  assert.equal(outsideLane({ x: 62, z: 47.3 }, [66, 46], [62, 46]), true, 'sideways out of the lane');
  assert.equal(outsideLane({ x: 35.76, z: 21.9 }, [34, 22], [34, 46]), true, 'the recorded position is outside leg 4');
  assert.equal(outsideLane({ x: 35.25, z: 30 }, [34, 22], [34, 46]), false);
  // A centre inside the rectangle keeps the whole body inside the checked lane cells.
  assert.ok(62 - ARRIVAL_TOLERANCE_M - PLAYER_R >= 15 * CELL + LANE_MARGIN_M - 1e-12);
});

test('chooseKey: the larger error outside the box wins and maps to one key at yaw 0', () => {
  assert.equal(chooseKey({ x: 62, z: 46 }, 0, [62, 22]), 'KeyW', 'north, z decreasing');
  assert.equal(chooseKey({ x: 34, z: 22 }, 0, [34, 46]), 'KeyS', 'south');
  assert.equal(chooseKey({ x: 66, z: 46 }, 0, [62, 46]), 'KeyA', 'west, x decreasing');
  assert.equal(chooseKey({ x: 34, z: 22 }, 0, [62, 22]), 'KeyD', 'east');
  assert.equal(chooseKey({ x: 63.2, z: 22.9 }, 0, [62, 22]), null, 'inside the box');
  assert.equal(chooseKey({ x: 63.2, z: 46 }, 0, [62, 22]), 'KeyW', 'x is inside the box, z is not');
  assert.equal(chooseKey({ x: 64, z: 25 }, 0, [62, 22]), 'KeyW', 'both outside, z larger');
  assert.equal(chooseKey({ x: 65.5, z: 25 }, 0, [62, 22]), 'KeyA', 'both outside, x larger');
  assert.equal(chooseKey({ x: 63.4, z: 22.9 }, 0, [62, 22]), 'KeyA', 'only x is outside although z is... smaller');
});

test('chooseKey projects through the current yaw like the previous controller', () => {
  // The previous walk: forward = -dx sin(yaw) - dz cos(yaw); right = dx cos(yaw) - dz sin(yaw).
  const previous = (p, yaw, [x, z]) => {
    const dx = x - p.x, dz = z - p.z;
    const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw), right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return Math.abs(forward) > Math.abs(right) ? forward > 0 ? 'KeyW' : 'KeyS' : right > 0 ? 'KeyD' : 'KeyA';
  };
  const quarter = Math.PI / 2;
  assert.equal(chooseKey({ x: 62, z: 46 }, quarter, [62, 22]), 'KeyD', 'north with yaw pi/2 is to the right');
  assert.equal(chooseKey({ x: 66, z: 46 }, quarter, [62, 46]), 'KeyW', 'west with yaw pi/2 is forward');
  assert.equal(chooseKey({ x: 34, z: 22 }, quarter, [34, 46]), 'KeyA');
  assert.equal(chooseKey({ x: 34, z: 22 }, quarter, [62, 22]), 'KeyS');
  for (const yaw of [0, quarter, Math.PI, -quarter])
    for (const [from, to] of legs)
      assert.equal(chooseKey({ x: from[0], z: from[1] }, yaw, to), previous({ x: from[0], z: from[1] }, yaw, to));
});

test('alongTrack measures signed progress from the start of a leg toward its waypoint', () => {
  assert.equal(alongTrack({ x: 62, z: 40 }, [62, 46], [62, 22]), 6);
  assert.equal(alongTrack({ x: 63, z: 47 }, [62, 46], [62, 22]), -1);
  assert.equal(alongTrack({ x: 40, z: 23 }, [62, 22], [34, 22]), 22);
});

test('shouldCrouch is true within the crouch distance along the driven axis', () => {
  assert.equal(shouldCrouch({ x: 62, z: 22 + CROUCH_WITHIN_M }, [62, 22], 'KeyW'), true);
  assert.equal(shouldCrouch({ x: 62, z: 22 + CROUCH_WITHIN_M + 0.01 }, [62, 22], 'KeyW'), false);
  assert.equal(shouldCrouch({ x: 63.2, z: 22 + 3 }, [62, 22], 'KeyW'), true, 'sideways offset does not count');
  assert.equal(shouldCrouch({ x: 66, z: 46 }, [62, 46], 'KeyA'), true, 'leg 1 is 4 m long');
  assert.equal(shouldCrouch({ x: 44, z: 22 }, [34, 22], 'KeyA'), false);
});

test('release threshold: derived from the input life so that the stop rests inside the box on both sides', () => {
  assert.equal(INPUT_LIFE_S, 0.5);
  assert.ok(Math.abs(INPUT_LIFE_STEP_M - CROUCH_SPEED_M_S * INPUT_LIFE_S) < 1e-12);
  assert.ok(Math.abs(INPUT_LIFE_STEP_M - 2.16) < 1e-12);
  // Far side: a sample one full step past the threshold, then a full-life stop.
  assert.ok(RELEASE_AT_M - 2 * INPUT_LIFE_STEP_M >= -ARRIVAL_TOLERANCE_M - 1e-12);
  // Near side: a release exactly at the threshold with the measured stop step.
  assert.ok(RELEASE_AT_M - STOP_LEAD_M <= ARRIVAL_TOLERANCE_M);
  assert.ok(STOP_LEAD_M <= INPUT_LIFE_STEP_M, 'the measured stop step fits in one input life');
  assert.ok(Math.abs(RELEASE_AT_M - 3.07) < 1e-12);
  // Crouch is in effect before the threshold even after one standing input life.
  assert.ok(Math.abs(STANDING_FACTOR - MOVE_SPEED / CROUCH_SPEED_M_S) < 1e-12);
  assert.ok(CROUCH_WITHIN_M >= RELEASE_AT_M + MOVE_SPEED * INPUT_LIFE_S);
  assert.ok(CROUCH_WITHIN_M >= RELEASE_AT_M * STANDING_FACTOR);
  // A standing full-life stop (3 m) is still below the control's stop-step limit.
  assert.ok(MOVE_SPEED * INPUT_LIFE_S <= MAX_STOP_STEP_M);
  assert.ok(PROGRESS_SEEN_M > 0 && PROGRESS_SEEN_M < STALL_PROGRESS_M);
  // A single step from rest anywhere between the box and the threshold rests inside the box.
  for (const rest of [ARRIVAL_TOLERANCE_M + 0.01, 2, RELEASE_AT_M])
    for (const step of [STOP_LEAD_M, INPUT_LIFE_STEP_M])
      assert.ok(Math.abs(rest - step) <= ARRIVAL_TOLERANCE_M, `${rest} - ${step}`);
});

test('shouldRelease is true at the release threshold, false just beyond it and true once the centre is passed', () => {
  assert.equal(shouldRelease({ x: 62, z: 22 + RELEASE_AT_M }, [62, 22], 'KeyW'), true);
  assert.equal(shouldRelease({ x: 62, z: 22 + RELEASE_AT_M + 0.01 }, [62, 22], 'KeyW'), false);
  assert.equal(shouldRelease({ x: 62, z: 22 + STOP_LEAD_M }, [62, 22], 'KeyW'), true);
  assert.equal(shouldRelease({ x: 62, z: 22 - 0.4 }, [62, 22], 'KeyW'), true, 'centre passed');
  assert.equal(shouldRelease({ x: 34, z: 46 - RELEASE_AT_M - 0.01 }, [34, 46], 'KeyS'), false);
  assert.equal(shouldRelease({ x: 34, z: 46 - RELEASE_AT_M }, [34, 46], 'KeyS'), true);
  assert.equal(shouldRelease({ x: 34 + RELEASE_AT_M + 0.5, z: 22 }, [34, 22], 'KeyA'), false);
  assert.equal(shouldRelease({ x: 34 - 0.1, z: 22 }, [34, 22], 'KeyA'), true);
  assert.equal(shouldRelease({ x: 62 - RELEASE_AT_M, z: 22 }, [62, 22], 'KeyD'), true);
  // With yaw pi/2 KeyW drives west.
  assert.equal(shouldRelease({ x: 62 + RELEASE_AT_M + 1, z: 46 }, [62, 46], 'KeyW', Math.PI / 2), false);
  assert.equal(shouldRelease({ x: 62 + RELEASE_AT_M, z: 46 }, [62, 46], 'KeyW', Math.PI / 2), true);
  // A body that is not crouched yet is released earlier by the speed ratio.
  assert.equal(shouldRelease({ x: 62, z: 22 + RELEASE_AT_M + 0.5 }, [62, 22], 'KeyW', 0, false), true);
  assert.equal(shouldRelease({ x: 62, z: 22 + RELEASE_AT_M * STANDING_FACTOR + 0.01 }, [62, 22], 'KeyW', 0, false), false);
  assert.equal(shouldRelease({ x: 62, z: 22 + RELEASE_AT_M + 0.5 }, [62, 22], 'KeyW', 0, true), false);
});

test('classifyLeg: stalled only when a key was held for the stall window without progress', () => {
  const run = (count, step, held = 'KeyW', tickStep = 10) =>
    Array.from({ length: count }, (_, i) => ({ tick: 1000 + i * tickStep, along: i * step, held }));
  assert.equal(classifyLeg(run(16, 0)), 'stalled', '150 ticks, no progress');
  assert.equal(classifyLeg(run(16, 0.02)), 'stalled', '0.3 m in 150 ticks');
  assert.equal(classifyLeg(run(15, 0)), 'moving', '140 ticks is shorter than the window');
  assert.equal(classifyLeg(run(16, 0.2)), 'moving', '3 m in 150 ticks');
  assert.equal(classifyLeg(run(40, 0, null)), 'moving', 'never stalled while no key is held');
  assert.equal(classifyLeg([]), 'moving');
  // A release inside the window restarts it: only the trailing held run is judged.
  const interrupted = run(20, 0);
  interrupted[12].held = null;
  assert.equal(classifyLeg(interrupted), 'moving');
  // Progress earlier in the leg does not hide a later stall.
  const late = [...run(10, 0.5), ...run(16, 0).map(s => ({ ...s, tick: s.tick + 100, along: 4.5 }))];
  assert.equal(classifyLeg(late), 'stalled');
  // The last sample decides: not stalled once the key is up.
  assert.equal(classifyLeg([...run(16, 0), { tick: 1160, along: 0, held: null }]), 'moving');
});

test('legSummary reports ticks, wall time, frame rate, sampled rejections, corrections, stop steps and lane exits', () => {
  const s = (tick, wallMs, frames, along, held, lastInputRejection = null, outside = false) =>
    ({ tick, wallMs, frames, along, held, lastInputRejection, outside, remaining: 12 - along, locked: tick !== 200 });
  const samples = [
    s(100, 0, 10, 0, null),
    s(110, 400, 12, 0.5, 'KeyW'),
    s(140, 1400, 16, 5, 'KeyW', 'stale_input'),
    s(170, 2400, 20, 10, 'KeyW', 'stale_input'),
    s(180, 2800, 22, 11.2, null, 'stale_input'),
    s(190, 3200, 24, 11.4, null),
    s(200, 3600, 26, 11.4, null, 'duplicate_seq'),
    s(210, 4000, 28, 11.6, 'KeyW'),
    s(220, 4400, 30, 11.9, null, null, true),
    s(230, 5000, 30, 11.9, null),
  ];
  const summary = legSummary(samples);
  assert.equal(summary.ticks, 130);
  assert.equal(summary.wallMs, 5000);
  assert.equal(summary.framesPerSecond, 4);
  assert.equal(summary.staleInputSamples, 3);
  assert.equal(summary.corrections, 2);
  assert.ok(Math.abs(summary.largestStopStepM - 1.4) < 1e-9);
  assert.deepEqual(summary.stopStepsM.map(v => +v.toFixed(3)), [1.4, 0.3]);
  assert.equal(summary.outsideLaneSamples, 1);
  assert.equal(summary.samples, 10);
  assert.equal(summary.unlockedSamples, 1);
  assert.deepEqual(summary.stops.map(stop => [+stop.releasedAtM.toFixed(3), +stop.restAtM.toFixed(3)]), [[2, 0.6], [0.4, 0.1]]);
  const empty = legSummary([]);
  assert.deepEqual([empty.ticks, empty.wallMs, empty.framesPerSecond, empty.staleInputSamples, empty.corrections,
    empty.largestStopStepM, empty.outsideLaneSamples], [0, 0, null, 0, 0, 0, 0]);
});

test('boundedMs cuts every bound to the time left to the tier deadline', () => {
  assert.equal(boundedMs(1000, 1000, 15000), 15000);
  assert.equal(boundedMs(1000, 1000 + TIER_DEADLINE_MS - 4000, 15000), 4000);
  assert.equal(boundedMs(1000, 1000 + TIER_DEADLINE_MS + 5, 15000), 0);
  assert.equal(boundedMs(0, 0, LEG_BOUND_MS), LEG_BOUND_MS);
  assert.ok(boundedMs(0, 0, Infinity) === TIER_DEADLINE_MS);
});
