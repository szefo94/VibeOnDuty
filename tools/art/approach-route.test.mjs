import test from 'node:test';
import assert from 'node:assert/strict';
import { bunkerData } from '../../src/shared/maps/bunker.js';
import { TILE_FLOOR, isCrack, isColumn, isRamp, isSideWall } from '../../src/tiles.js';
import * as route from './approach-route.mjs';
import { openGrid, approachStep, classifyStall, STALL_WINDOW_SIM_SECONDS, STALL_MIN_DISPLACEMENT_M } from './approach-route.mjs';

const CELL = bunkerData.CELL;
const predicates = { TILE_FLOOR, isCrack, isColumn, isRamp, isSideWall };
const cellOf = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
const centre = (column, row) => [(column + 0.5) * CELL, (row + 0.5) * CELL];
const map = { tiles: bunkerData.tiles, heightmap: bunkerData.heightmap, width: bunkerData.width, height: bunkerData.height };
const PLAYER = { x: 36, z: 31.93 }, HOSTILE = { x: 35.97, z: 50 };
const pathKeys = result => result.pathCells.map(([c, r]) => c + ',' + r);

// Small synthetic grids: 0 is open, anything else closed.
const gridOf = rows => rows.map(row => row.map(v => v === 0));
const syntheticStep = (rows, player, hostiles, fallback = [2, 2]) =>
  approachStep({ grid: gridOf(rows), cell: CELL, player, hostiles, fallback });

test('fixture precondition: the recorded geometry matches the real bunker cells', () => {
  const t = bunkerData.tiles;
  assert.equal(t[8][9], 1, 'cell column 9, row 8 is the solid tile');
  const [hc, hr] = cellOf(HOSTILE.x, HOSTILE.z);
  assert.deepEqual([hc, hr], [8, 12]);
  assert.equal(t[hr][hc], TILE_FLOOR, 'the hostile stands on plain floor');
  assert.ok(isCrack(t[12][9]), 'its east neighbour, column 9 row 12, is a crack tile');
});

test('openGrid opens only plain floor on the requested level', () => {
  const tiles = [[0, 1, 2, 3], [28, 29, 4, 0]];
  const heightmap = [[0, 0, 0, 0], [0, 0, 0, 1.4]];
  const grid = openGrid({ tiles, heightmap, width: 4, height: 2 }, predicates, 0);
  assert.deepEqual(grid, [[true, false, false, false], [false, false, false, false]]);
  assert.equal(grid.length, 2);
  assert.equal(grid[0].length, 4);
});

test('openGrid on bunker closes solid, crack and the raised ring and opens the lower court', () => {
  const grid = openGrid(map, predicates, 0);
  assert.equal(grid.length, bunkerData.height);
  assert.equal(grid[0].length, bunkerData.width);
  assert.equal(grid[8][9], false, 'solid');
  assert.equal(grid[12][9], false, 'crack');
  assert.equal(grid[12][8], true, 'plain floor, level 0');
  assert.equal(grid[2][2], false, 'raised floor 1.4 is another level');
  assert.equal(grid[7][9], true);
});

test('pin geometry: the route leaves the corner at column 9 row 8 and reaches engagement range', () => {
  const grid = openGrid(map, predicates, 0);
  const result = approachStep({ grid, cell: CELL, player: PLAYER, hostiles: [HOSTILE], fallback: [34, 46] });
  assert.equal(result.kind, 'route');
  const [wc, wr] = cellOf(result.waypoint[0], result.waypoint[1]);
  assert.equal(grid[wr][wc], true, 'the waypoint cell is open');
  assert.ok(result.pathCells.length >= 2);
  for (const [c, r] of result.pathCells) assert.equal(grid[r][c], true, `path cell ${c},${r} is open`);
  assert.ok(!pathKeys(result).includes('9,8'), 'the path avoids column 9 row 8');
  const [lc, lr] = result.pathCells.at(-1);
  const [lx, lz] = centre(lc, lr);
  assert.ok(Math.hypot(lx - HOSTILE.x, lz - HOSTILE.z) <= 14, 'last path cell is within 14 m of the hostile');
  assert.deepEqual(result.targetCell, [lc, lr]);
  // The first move goes west, never into the closed cell to the south.
  assert.deepEqual(result.waypoint, centre(8, 7));
  const dx = result.waypoint[0] - PLAYER.x, dz = result.waypoint[1] - PLAYER.z;
  assert.equal(result.yaw, Math.atan2(-dx, -dz));
});

test('pin geometry: following the path cell by cell never enters a closed cell', () => {
  const grid = openGrid(map, predicates, 0);
  let position = { ...PLAYER };
  for (let i = 0; i < 40; i++) {
    const result = approachStep({ grid, cell: CELL, player: position, hostiles: [HOSTILE], fallback: [34, 46] });
    if (result.kind === 'arrived') break;
    assert.equal(result.kind, 'route');
    position = { x: result.waypoint[0], z: result.waypoint[1] };
    const [c, r] = cellOf(position.x, position.z);
    assert.equal(grid[r][c], true);
  }
  const [c, r] = cellOf(position.x, position.z);
  assert.deepEqual([c, r], [8, 12]);
});

test('arrived: the player stands in the target cell', () => {
  const result = syntheticStep([[0, 0, 0], [0, 0, 0], [0, 0, 0]], { x: 10, z: 2 }, [{ x: 10.5, z: 3 }]);
  assert.equal(result.kind, 'arrived');
  assert.deepEqual(result.targetCell, [2, 0]);
});

test('hostile inside a fully enclosed region gives the nearest reachable open cell, not unreachable', () => {
  const rows = [
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 0, 1],
    [0, 0, 0, 1, 1, 1],
  ];
  const hostile = { x: 4.5 * CELL, z: 1.5 * CELL };
  const result = syntheticStep(rows, { x: 0.5 * CELL, z: 1.5 * CELL }, [hostile]);
  assert.equal(result.kind, 'route');
  assert.deepEqual(result.targetCell, [2, 1]);
  assert.deepEqual(result.pathCells.at(-1), [2, 1]);
});

test('no living hostile gives the fallback waypoint', () => {
  const result = syntheticStep([[0, 0], [0, 0]], { x: 2, z: 2 }, [], [6, 7]);
  assert.equal(result.kind, 'fallback');
  assert.deepEqual(result.waypoint, [6, 7]);
});

test('closed own cell gives unreachable with the fallback waypoint', () => {
  const result = syntheticStep([[0, 1], [0, 0]], { x: 1.5 * CELL, z: 0.5 * CELL }, [{ x: 2, z: 2 }], [5, 6]);
  assert.equal(result.kind, 'unreachable');
  assert.deepEqual(result.waypoint, [5, 6]);
});

test('player outside the grid gives unreachable', () => {
  const result = syntheticStep([[0, 0], [0, 0]], { x: -3, z: 2 }, [{ x: 2, z: 2 }], [5, 6]);
  assert.equal(result.kind, 'unreachable');
  assert.deepEqual(result.waypoint, [5, 6]);
});

test('tie order: the lowest row, then the lowest column, wins among equally near cells', () => {
  // Hostile at the exact centre of a closed cell: the four neighbours are equally near.
  const rows = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ];
  const hostile = { x: 1.5 * CELL, z: 1.5 * CELL };
  const result = syntheticStep(rows, { x: 0.5 * CELL, z: 0.5 * CELL }, [hostile]);
  assert.deepEqual(result.targetCell, [1, 0], 'north neighbour: lowest row');
  const sameRow = syntheticStep([[0, 1, 0], [0, 0, 0]], { x: 1.5 * CELL, z: 1.5 * CELL },
    [{ x: 1.5 * CELL, z: 0.5 * CELL }]);
  assert.deepEqual(sameRow.targetCell, [0, 0], 'same row: the lowest column beats the later cells');
});

test('determinism: the same input returns the same path and neighbours expand north, east, south, west', () => {
  const rows = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const input = { x: 0.5 * CELL, z: 0.5 * CELL };
  const hostile = { x: 2.5 * CELL, z: 2.5 * CELL };
  const a = syntheticStep(rows, input, [hostile]);
  const b = syntheticStep(rows, input, [hostile]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.pathCells, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 'east before south at every fork');
});

test('hostile reordering does not change the path', () => {
  const grid = openGrid(map, predicates, 0);
  const hostiles = [HOSTILE, { x: 82, z: 14 }, { x: 14, z: 82 }];
  const first = approachStep({ grid, cell: CELL, player: PLAYER, hostiles, fallback: [34, 46] });
  const second = approachStep({ grid, cell: CELL, player: PLAYER, hostiles: [...hostiles].reverse(), fallback: [34, 46] });
  assert.deepEqual(second, first);
});

test('the step reports the path without mutating its inputs', () => {
  const grid = openGrid(map, predicates, 0);
  const before = JSON.stringify(grid);
  const hostiles = [HOSTILE];
  approachStep({ grid, cell: CELL, player: PLAYER, hostiles, fallback: [34, 46] });
  assert.equal(JSON.stringify(grid), before);
  assert.deepEqual(hostiles, [HOSTILE]);
});

const sampleRun = (count, step, extra = {}) => Array.from({ length: count }, (_, i) => ({
  simSeconds: i * 0.5, x: 36 + step * i, z: 30, walking: true, alive: true, approaching: true, ...extra }));

test('classifyStall: constants keep the planned defaults', () => {
  assert.equal(STALL_WINDOW_SIM_SECONDS, 5);
  assert.equal(STALL_MIN_DISPLACEMENT_M, 0.5);
});

test('classifyStall: stalled when alive, approaching and walking yet displaced under 0.5 m', () => {
  assert.equal(classifyStall(sampleRun(14, 0.001)), 'stalled');
});

test('classifyStall: moving when displaced at least 0.5 m', () => {
  assert.equal(classifyStall(sampleRun(14, 0.2)), 'moving');
});

test('classifyStall: idle when not walking in the window', () => {
  assert.equal(classifyStall(sampleRun(14, 0, { walking: false })), 'idle');
});

test('classifyStall: undetermined when the samples span less than the window or are fewer than three', () => {
  assert.equal(classifyStall(sampleRun(6, 0)), 'undetermined');
  assert.equal(classifyStall(sampleRun(2, 0)), 'undetermined');
  assert.equal(classifyStall([]), 'undetermined');
});

test('classifyStall: a dead or not approaching sample in the window is never stalled', () => {
  const dead = sampleRun(14, 0); dead[10].alive = false;
  assert.notEqual(classifyStall(dead), 'stalled');
  const other = sampleRun(14, 0); other[10].approaching = false;
  assert.notEqual(classifyStall(other), 'stalled');
});

test('classifyStall: only the last window counts, so earlier movement does not hide a stall', () => {
  const samples = [...sampleRun(10, 0.5), ...sampleRun(14, 0).map(s => ({ ...s, simSeconds: s.simSeconds + 5, x: 41 }))];
  assert.equal(classifyStall(samples), 'stalled');
});

test('classifyStall honours explicit options', () => {
  const samples = sampleRun(30, 0.05); // 1.45 m over 14.5 s, about 0.5 m per 5 s window
  const strict = classifyStall(samples, { windowSimSeconds: 5, minDisplacementM: 2 });
  assert.equal(strict, 'stalled');
});

test('the route module is dependency free', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./approach-route.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.deepEqual(Object.keys(route).sort(),
    ['STALL_MIN_DISPLACEMENT_M', 'STALL_WINDOW_SIM_SECONDS', 'approachStep', 'classifyStall', 'openGrid']);
});
