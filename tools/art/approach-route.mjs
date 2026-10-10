// Pure approach steering and stall classification for the moving-review collector.
// No imports: this file loads unchanged in Node and, served by Vite, in the page.
// Coordinates follow the game: arrays are [row][column]; a world point maps to column
// floor(x / cell) and row floor(z / cell); a cell centre is ((column + 0.5) * cell, (row + 0.5) * cell).
export const STALL_WINDOW_SIM_SECONDS = 5;
export const STALL_MIN_DISPLACEMENT_M = 0.5;

const LEVEL_EPSILON = 1e-9;
// Fixed expansion order: north, east, south, west (as [dColumn, dRow]).
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// A cell is open only when it is the plain floor tile on the requested level. Solid,
// crack, column, ramp and side-wall tiles are closed on purpose: collision treats cracks
// as barriers and the route must never rely on a cell the player cannot cross.
export function openGrid(map, predicates, level) {
  const { tiles, heightmap, width, height } = map;
  const { TILE_FLOOR } = predicates;
  const grid = [];
  for (let row = 0; row < height; row++) {
    const line = [];
    for (let column = 0; column < width; column++) {
      const tile = tiles[row][column];
      const plain = tile === TILE_FLOOR && !predicates.isCrack?.(tile) && !predicates.isColumn?.(tile)
        && !predicates.isRamp?.(tile) && !predicates.isSideWall?.(tile);
      line.push(plain && Math.abs(heightmap[row][column] - level) < LEVEL_EPSILON);
    }
    grid.push(line);
  }
  return grid;
}

const centreOf = (column, row, cell) => [(column + 0.5) * cell, (row + 0.5) * cell];
const yawToward = (from, to) => Math.atan2(-(to[0] - from.x), -(to[1] - from.z));

// grid: open-cell booleans; cell: cell size in metres; player: { x, z }; hostiles: living
// hostile positions { x, z }; fallback: [x, z] used when no route exists or applies.
export function approachStep({ grid, cell, player, hostiles, fallback }) {
  const rows = grid.length, columns = rows ? grid[0].length : 0;
  const startColumn = Math.floor(player.x / cell), startRow = Math.floor(player.z / cell);
  const open = (column, row) => column >= 0 && row >= 0 && column < columns && row < rows && grid[row][column] === true;
  const base = { waypoint: [fallback[0], fallback[1]], targetCell: null, pathCells: [], yaw: yawToward(player, fallback) };
  if (!open(startColumn, startRow)) return { kind: 'unreachable', ...base };
  if (!hostiles || hostiles.length === 0) return { kind: 'fallback', ...base };

  // Breadth-first search over 4-neighbour open cells; parents give a shortest path.
  const key = (column, row) => row * columns + column;
  const parent = new Map([[key(startColumn, startRow), -1]]);
  const order = [[startColumn, startRow]];
  for (let head = 0; head < order.length; head++) {
    const [column, row] = order[head];
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = column + dc, nr = row + dr;
      if (!open(nc, nr) || parent.has(key(nc, nr))) continue;
      parent.set(key(nc, nr), key(column, row));
      order.push([nc, nr]);
    }
  }

  // Nearest reachable cell to any living hostile; row-major scan with a strict
  // comparison gives the lowest row, then the lowest column, among equal distances.
  const reachable = order.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  let target = null, best = Infinity;
  for (const [column, row] of reachable) {
    const [cx, cz] = centreOf(column, row, cell);
    let nearest = Infinity;
    for (const hostile of hostiles) nearest = Math.min(nearest, (hostile.x - cx) ** 2 + (hostile.z - cz) ** 2);
    if (nearest < best) { best = nearest; target = [column, row]; }
  }

  const pathCells = [];
  for (let at = key(target[0], target[1]); at !== -1; at = parent.get(at)) pathCells.push([at % columns, Math.floor(at / columns)]);
  pathCells.reverse();

  if (pathCells.length === 1) {
    const own = centreOf(startColumn, startRow, cell);
    let near = hostiles[0], nearD = Infinity;
    for (const hostile of hostiles) {
      const d = (hostile.x - player.x) ** 2 + (hostile.z - player.z) ** 2;
      if (d < nearD) { nearD = d; near = hostile; }
    }
    return { kind: 'arrived', waypoint: own, targetCell: target, pathCells, yaw: yawToward(player, [near.x, near.z]) };
  }
  const waypoint = centreOf(pathCells[1][0], pathCells[1][1], cell);
  return { kind: 'route', waypoint, targetCell: target, pathCells, yaw: yawToward(player, waypoint) };
}

// samples: { simSeconds, x, z, walking, alive, approaching } in time order. Returns one of
// 'stalled', 'moving', 'idle', 'undetermined'. Only the last window is judged.
export function classifyStall(samples, options = {}) {
  const windowSimSeconds = options.windowSimSeconds ?? STALL_WINDOW_SIM_SECONDS;
  const minDisplacementM = options.minDisplacementM ?? STALL_MIN_DISPLACEMENT_M;
  const list = Array.isArray(samples) ? samples : [];
  if (list.length < 3) return 'undetermined';
  const last = list.at(-1);
  if (!(last.simSeconds - list[0].simSeconds >= windowSimSeconds)) return 'undetermined';
  const recent = list.filter(sample => sample.simSeconds >= last.simSeconds - windowSimSeconds);
  if (recent.length < 3) return 'undetermined';
  if (!recent.every(sample => sample.alive === true && sample.approaching === true)) return 'undetermined';
  if (!recent.every(sample => sample.walking === true)) return 'idle';
  const displacement = Math.hypot(last.x - recent[0].x, last.z - recent[0].z);
  return displacement < minDisplacementM ? 'stalled' : 'moving';
}
