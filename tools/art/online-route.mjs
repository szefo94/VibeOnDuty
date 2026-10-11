// Pure route helper for the online leg of the moving-review collector (tools/art/moving-online.mjs).
// No browser, no network, no file access: it imports only shared map data and constants, so it
// loads unchanged in plain Node. This file is the only place where a number of the online route lives.
// Coordinates follow the game: arrays are [row][column]; a world point maps to column floor(x / CELL)
// and row floor(z / CELL). Yaw 0 looks north (z decreasing); the collector fixes yaw at 0 before the
// route, so every leg is axis-aligned and is driven by exactly one of W, S, A, D.
import { bunkerData } from '../../src/shared/maps/bunker.js';
import { CELL, PLAYER_R, MOVE_SPEED } from '../../src/config.js';
import { TILE_FLOOR } from '../../src/tiles.js';
import { CROUCH_SPEED } from '../../src/shared/movement.js';

const freeze = value => { if (Array.isArray(value)) value.forEach(freeze); return Object.freeze(value); };
const EPSILON = 1e-9;

// Player `a` (first to join) spawns at the attacker spawn; the collector reads the real start from
// the snapshot and counts a start outside the first lane as a sample outside the lane.
export const START = freeze([bunkerData.spawnAttacker.x, bunkerData.spawnAttacker.z]);
// Each waypoint is the centre of a cell shared by the two one-cell lanes that meet there.
export const WAYPOINTS = freeze([[62, 46], [62, 22], [34, 22], [34, 46]]);

// A body anywhere in the arrival box, radius included, stays LANE_MARGIN_M inside its cell on both
// axes, so it is inside the next leg's lane whatever the stopping error of the previous leg was.
export const LANE_MARGIN_M = 0.4;
export const ARRIVAL_TOLERANCE_M = CELL / 2 - PLAYER_R - LANE_MARGIN_M; // 1.25, per axis (a box, not a circle)
// Median stop step measured by the tracer (control `tracer-high`, both legs 1.872 m): the distance a
// crouched body still travels after the sample on which the release was decided. The initial value
// was 1.5 (debug session 07-19: about 1.2 to 1.5 m).
export const STOP_LEAD_M = 1.87;
// A stop that travels further than this after release has passed the far side of the arrival box.
export const MAX_STOP_STEP_M = STOP_LEAD_M + ARRIVAL_TOLERANCE_M;
export const CROUCH_SPEED_M_S = CROUCH_SPEED; // src/shared/movement.js: MOVE_SPEED * 0.72 = 4.32
// The server applies an accepted input for at most 0.5 s (src/shared/tdmSimulation.js, `inputAge <= 0.5`).
// At capture frame rate most inputs are rejected as stale, so a body moves in steps of at most one
// input life: that is the largest stop after a release and the largest distance between two fresh
// samples while crouched.
export const INPUT_LIFE_S = 0.5;
export const INPUT_LIFE_STEP_M = CROUCH_SPEED_M_S * INPUT_LIFE_S; // 2.16
// At capture frame rate an input is accepted about every second frame, so a crouched body still
// travels about two frame times after the sample on which its release was decided, and never more
// than one input life. Measured in the control runs tracer-high-2, run-01 and run-02 (crouched first
// stops): 1.30 to 1.73 m at 5.2 to 6.6 frames per second, 1.58 to 2.16 m at 4.1 to 5.3.
export const ACCEPT_PERIOD_FRAMES = 2;
export const STOP_STEP_MIN_M = 1.3; // smallest measured crouched stop step; used while no frame rate is known
// Largest measured distance of a release sample inside its threshold in those runs (28 first stops).
export const SAMPLE_STEP_M = 0.95;
export const RELEASE_MARGIN_M = 0.3;
// The longest step from rest: the key takes effect up to one sample step before the release is
// decided, then the body stops within one input life.
export const MAX_STEP_FROM_REST_M = SAMPLE_STEP_M + INPUT_LIFE_STEP_M; // 3.11
// A body at rest closer than this to the centre, but outside the box, could pass the far side of the
// box with one step toward it. It steps back first and approaches again.
export const BACK_OFF_WITHIN_M = MAX_STEP_FROM_REST_M - ARRIVAL_TOLERANCE_M; // 1.86
// Crouch is requested this far out so that it is in effect before the release threshold: run-01 and
// run-02 still found a standing body at 3.1 to 3.5 m when crouch was requested at 8 m.
export const CROUCH_WITHIN_M = 12;
export const STANDING_FACTOR = MOVE_SPEED / CROUCH_SPEED_M_S; // a body not yet crouched travels this much further
export const PROGRESS_SEEN_M = 0.05; // a held key counts as effective once the body moved this far or reports moving
export const FRAME_RATE_WINDOW_MS = 3000;
export const FRAME_RATE_MIN_MS = 1000;
export const MAX_STOP_LAG_MS = MAX_STOP_STEP_M / CROUCH_SPEED_M_S * 1000;
// Same rule as the offline approach (plan 07-23): 5 simulation seconds at 30 Hz with a key held.
export const STALL_TICKS = 150;
export const STALL_PROGRESS_M = 0.5;
export const MAX_CORRECTIONS = 12; // key presses per leg
export const POLL_MS = 100;
export const RETRY_MS = 1500; // an unobserved fire click or R press is offered again this often
export const HEALTH_IDLE_MS = 5000; // the fire hold is released and re-aimed when health stood still this long
export const FRESH_LIFE_BOUND_MS = 20000;

// The operator default match length; server/cli.js allows 1 to 3600.
export const MATCH_SECONDS = 600;
// Their sum is the per-tier share of `onlineUnions` in COLLECTION_LIFETIME_PROJECTION
// (tools/art/animation-capture.mjs, not edited): 600000 ms.
export const TIER_DEADLINE_MS = 540000;
export const TIER_TEARDOWN_ALLOWANCE_MS = 60000;
export const LEG_BOUND_MS = 90000;
export const ACTION_BOUND_MS = 30000;
export const DEATH_BOUND_MS = 60000;

export function routeLegs(start = START, waypoints = WAYPOINTS) {
  return waypoints.map((to, index) => [index === 0 ? start : waypoints[index - 1], to]);
}

// Every cell touched by the rectangle swept between the two arrival boxes grown by the body radius.
export function laneCells(map, from, to, tolerance = ARRIVAL_TOLERANCE_M, radius = PLAYER_R) {
  const reach = tolerance + radius;
  const cellOf = value => Math.floor(value / CELL);
  const firstColumn = cellOf(Math.min(from[0], to[0]) - reach + EPSILON), lastColumn = cellOf(Math.max(from[0], to[0]) + reach - EPSILON);
  const firstRow = cellOf(Math.min(from[1], to[1]) - reach + EPSILON), lastRow = cellOf(Math.max(from[1], to[1]) + reach - EPSILON);
  const cells = [];
  for (let row = firstRow; row <= lastRow; row++)
    for (let column = firstColumn; column <= lastColumn; column++) cells.push({ column, row });
  return cells;
}

// Lane cells that are not plain floor at height 0 (a cell outside the map counts as blocked).
export function blockedLaneCells(map, legs, tolerance = ARRIVAL_TOLERANCE_M, radius = PLAYER_R) {
  const blocked = [];
  legs.forEach(([from, to], leg) => {
    for (const { column, row } of laneCells(map, from, to, tolerance, radius)) {
      const tile = map.tiles[row]?.[column], height = map.heightmap[row]?.[column];
      if (tile !== TILE_FLOOR || height !== 0) blocked.push({ leg, column, row, tile: tile ?? null, height: height ?? null });
    }
  });
  return blocked;
}

export function insideBox(position, waypoint, tolerance = ARRIVAL_TOLERANCE_M) {
  return Math.abs(position.x - waypoint[0]) <= tolerance + EPSILON && Math.abs(position.z - waypoint[1]) <= tolerance + EPSILON;
}

// True when the body centre has left the rectangle between the arrival boxes of a leg. A centre
// inside that rectangle keeps the whole body inside the cells that laneCells returns.
export function outsideLane(position, from, to, tolerance = ARRIVAL_TOLERANCE_M) {
  const out = (value, a, b) => value < Math.min(a, b) - tolerance - EPSILON || value > Math.max(a, b) + tolerance + EPSILON;
  return out(position.x, from[0], to[0]) || out(position.z, from[1], to[1]);
}

// The axis whose error is outside the box and larger wins; the world direction is projected through
// the current yaw exactly as the previous controller did. Null inside the box.
export function chooseKey(position, yaw, waypoint, tolerance = ARRIVAL_TOLERANCE_M) {
  let dx = waypoint[0] - position.x, dz = waypoint[1] - position.z;
  const xOut = Math.abs(dx) > tolerance + EPSILON, zOut = Math.abs(dz) > tolerance + EPSILON;
  if (!xOut && !zOut) return null;
  if (xOut && (!zOut || Math.abs(dx) > Math.abs(dz))) dz = 0; else dx = 0;
  const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.abs(forward) > Math.abs(right) ? forward > 0 ? 'KeyW' : 'KeyS' : right > 0 ? 'KeyD' : 'KeyA';
}

// Remaining distance to the waypoint centre along the world direction that `key` drives at `yaw`.
// Negative once the centre has been passed.
function remaining(position, waypoint, key, yaw) {
  const sign = key === 'KeyW' || key === 'KeyD' ? 1 : -1;
  const direction = key === 'KeyW' || key === 'KeyS' ? [-Math.sin(yaw), -Math.cos(yaw)] : [Math.cos(yaw), -Math.sin(yaw)];
  return sign * ((waypoint[0] - position.x) * direction[0] + (waypoint[1] - position.z) * direction[1]);
}

// Signed progress of a position along the straight track of a leg, from its start.
export function alongTrack(position, from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (!(length > 0)) return 0;
  return ((position.x - from[0]) * (to[0] - from[0]) + (position.z - from[1]) * (to[1] - from[1])) / length;
}

export function shouldCrouch(position, waypoint, key, yaw = 0) {
  return remaining(position, waypoint, key, yaw) <= CROUCH_WITHIN_M + EPSILON;
}

// The smallest crouched stop step expected at a frame rate: two frame times, at most one input life.
export function expectedStopStep(framesPerSecond) {
  if (!(framesPerSecond > 0)) return STOP_STEP_MIN_M;
  return Math.min(INPUT_LIFE_STEP_M, ACCEPT_PERIOD_FRAMES / framesPerSecond * CROUCH_SPEED_M_S);
}

// Keys are released on the first sample whose remaining distance along the driven axis to the
// waypoint centre is at most this: a release exactly at the threshold with the smallest expected stop
// step rests RELEASE_MARGIN_M inside the near side of the box.
export function releaseAt(framesPerSecond) {
  return ARRIVAL_TOLERANCE_M + expectedStopStep(framesPerSecond) - RELEASE_MARGIN_M;
}

// `crouching` is the authoritative stance of the sample; a body that is not crouched yet is
// released earlier by the speed ratio. `framesPerSecond` is the recent measured frame rate or null.
export function shouldRelease(position, waypoint, key, yaw = 0, crouching = true, framesPerSecond = null) {
  return remaining(position, waypoint, key, yaw) <= releaseAt(framesPerSecond) * (crouching ? 1 : STANDING_FACTOR) + EPSILON;
}

// `key` is the key toward the waypoint. True for a body outside the box whose step toward the
// waypoint could pass the far side of the box.
export function shouldBackOff(position, waypoint, key, yaw = 0) {
  const distance = remaining(position, waypoint, key, yaw);
  return distance > ARRIVAL_TOLERANCE_M + EPSILON && distance < BACK_OFF_WITHIN_M;
}

export function oppositeKey(key) {
  return { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' }[key] ?? null;
}

// Frame rate over the last FRAME_RATE_WINDOW_MS of samples { wallMs, frames }; null while the
// samples span less than FRAME_RATE_MIN_MS.
export function recentFramesPerSecond(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const last = list.at(-1);
  if (!last) return null;
  let first = last;
  for (let index = list.length - 1; index >= 0 && last.wallMs - list[index].wallMs <= FRAME_RATE_WINDOW_MS; index--) first = list[index];
  const span = last.wallMs - first.wallMs;
  return span >= FRAME_RATE_MIN_MS ? (last.frames - first.frames) / (span / 1000) : null;
}

// samples: { tick, along, held } in time order. 'stalled' when the trailing run of samples with a
// key held spans at least STALL_TICKS ticks and progressed less than STALL_PROGRESS_M inside the last
// STALL_TICKS ticks; otherwise 'moving'. Never 'stalled' while no key is held.
export function classifyLeg(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const last = list.at(-1);
  if (!last || !last.held) return 'moving';
  let first = list.length - 1;
  while (first > 0 && list[first - 1].held) first--;
  if (last.tick - list[first].tick < STALL_TICKS) return 'moving';
  let low = Infinity, high = -Infinity;
  for (let index = first; index < list.length; index++) {
    if (list[index].tick < last.tick - STALL_TICKS) continue;
    low = Math.min(low, list[index].along); high = Math.max(high, list[index].along);
  }
  return high - low < STALL_PROGRESS_M ? 'stalled' : 'moving';
}

// samples: { tick, wallMs, frames, along, held, lastInputRejection, outside, remaining?, locked? } in time order.
// staleInputSamples is a sampled lower bound: window.__mpDebug() exposes only the latest rejection
// reason, so rejections between two polls, or overwritten by another reason, are not counted.
export function legSummary(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const first = list[0], last = list.at(-1);
  const wallMs = first ? last.wallMs - first.wallMs : 0;
  let corrections = 0;
  const stopStepsM = [], stops = [];
  for (let index = 0; index < list.length; index++) {
    const held = list[index].held, before = index > 0 ? list[index - 1].held : null;
    if (held && held !== before) corrections++;
    if (!held && before) {
      let end = index;
      while (end + 1 < list.length && !list[end + 1].held) end++;
      stopStepsM.push(Math.abs(list[end].along - list[index - 1].along));
      // Where the release was decided and where the body came to rest, as remaining distance to the centre.
      stops.push({ releasedAtM: list[index - 1].remaining ?? null, restAtM: list[end].remaining ?? null });
    }
  }
  return {
    samples: list.length,
    ticks: first ? last.tick - first.tick : 0,
    wallMs,
    framesPerSecond: wallMs > 0 ? (last.frames - first.frames) / (wallMs / 1000) : null,
    staleInputSamples: list.filter(sample => sample.lastInputRejection === 'stale_input').length,
    corrections,
    stopStepsM,
    stops,
    unlockedSamples: list.filter(sample => sample.locked === false).length,
    largestStopStepM: stopStepsM.length ? Math.max(...stopStepsM) : 0,
    outsideLaneSamples: list.filter(sample => sample.outside === true).length,
  };
}

// The smaller of a step's own bound and the time left to the tier deadline; never negative.
export function boundedMs(tierStartedAt, now, bound) {
  return Math.max(0, Math.min(bound, TIER_DEADLINE_MS - (now - tierStartedAt)));
}
