import { CELL } from './config.js';

// 0=floor 1=solid 2=E-W crack 3=N-S crack 4=ramp-N 5=ramp-S 6=ramp-W 7=ramp-E
//
// "The Ring" — two-story arena
//
// Upper level (H2=1.4): perimeter ring walkway — north/south strips + east/west corridors.
// Ground level (0): interior arena with a central fortified room.
// Inner ring wall seals the upper level; ramps punch through at 8 points (2 per side).
// Crack openings in the inner wall and room walls allow cross-level shooting.
// Corner towers (solid wall pillars) on north and south catwalks give elevated cover.
// Four alcove nooks at ground level (cols 6-7 and 16-17, rows 6-7 and 15-16).
// Central room: H1 raised floor, crack exits E/W at rows 10+12, sealed south at row 13.

export const MAP_W = 24,
  MAP_H = 24;
export const MAP = [
  // row  0 — north outer wall
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // row  1 — north ring, open
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // row  2 — north ring with corner towers (cols 5-6, 17-18)
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1],
  // row  3 — same
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1],
  // row  4 — north inner wall: solid | crack | ramp ramp | crack | solid×4 | crack | ramp ramp | crack | solid
  [1,0,0,0,1,1,2,5,5,2,1,1,1,1,2,5,5,2,1,1,0,0,0,1],
  // row  5 — ring sides + interior ground; inner wall at col 4 / 19
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  // row  6 — crack in ring wall; alcove walls start (cols 6-7, 16-17)
  [1,0,0,0,3,0,1,1,0,0,0,0,0,0,0,0,1,1,0,3,0,0,0,1],
  // row  7 — west ramp-7, east ramp-6; alcove rear wall (cols 6, 17)
  [1,0,0,0,7,0,1,0,0,0,0,0,0,0,0,0,0,1,0,6,0,0,0,1],
  // row  8 — west ramp-7, east ramp-6; central room north wall (cols 9-10, 13-14)
  [1,0,0,0,7,0,0,0,0,1,1,0,0,1,1,0,0,0,0,6,0,0,0,1],
  // row  9 — inner wall solid; central room side walls (cols 9, 14)
  [1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
  // row 10 — crack in ring walls; central room crack ports E/W (cols 9, 14)
  [1,0,0,0,3,0,0,0,0,2,0,0,0,0,2,0,0,0,0,3,0,0,0,1],
  // row 11 — inner wall solid; central room solid E/W
  [1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
  // row 12 — crack in ring walls; central room crack ports E/W
  [1,0,0,0,3,0,0,0,0,2,0,0,0,0,2,0,0,0,0,3,0,0,0,1],
  // row 13 — inner wall solid; central room south wall (solid + crack exits in middle)
  [1,0,0,0,1,0,0,0,0,1,1,2,2,1,1,0,0,0,0,1,0,0,0,1],
  // row 14 — west ramp-7, east ramp-6; open ground
  [1,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,1],
  // row 15 — west ramp-7, east ramp-6; alcove rear wall (cols 6, 17)
  [1,0,0,0,7,0,1,0,0,0,0,0,0,0,0,0,0,1,0,6,0,0,0,1],
  // row 16 — crack in ring walls; alcove walls (cols 6-7, 16-17)
  [1,0,0,0,3,0,1,1,0,0,0,0,0,0,0,0,1,1,0,3,0,0,0,1],
  // row 17 — inner wall solid; open interior
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  // row 18 — inner wall solid
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  // row 19 — south inner wall: solid | crack | ramp ramp | crack | solid×4 | crack | ramp ramp | crack | solid
  [1,0,0,0,1,1,2,4,4,2,1,1,1,1,2,4,4,2,1,1,0,0,0,1],
  // row 20 — south ring, open
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // row 21 — south ring with corner towers
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1],
  // row 22 — same
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1],
  // row 23 — south outer wall
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

export const isRamp = (c) => c >= 4 && c <= 7;
export const isCrack = (c) => c === 2 || c === 3;

export function mapCell(mx, mz) {
  if (mx < 0 || mz < 0 || mx >= MAP_W || mz >= MAP_H) return 1;
  return MAP[mz][mx];
}

// Height levels
export const H1 = 0.7,   // slightly raised floor (central room)
             H2 = 1.4;   // upper ring catwalk elevation

export const HMAP = [
  // row  0
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // row  1 — north ring = H2 across full width
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  // row  2
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  // row  3
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  // row  4 — inner wall row; ring at cols 1-3 and 20-22
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  // rows 5-8 — ring sides at cols 1-3 and 20-22; interior at 0
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  // rows 9-12 — ring sides + central room floor at H1 (cols 10-13)
  [0,H2,H2,H2,0,0,0,0,0,0,H1,H1,H1,H1,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,H1,H1,H1,H1,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,H1,H1,H1,H1,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,H1,H1,H1,H1,0,0,0,0,0,0,H2,H2,H2,0],
  // rows 13-18 — ring sides, no raised interior
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  // row 19 — inner wall row
  [0,H2,H2,H2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,H2,H2,H2,0],
  // rows 20-22 — south ring = H2 across full width
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  [0,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,H2,0],
  // row 23
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export function hAt(c, r) {
  if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return 0;
  return HMAP[r][c] || 0;
}

// groundElevation: surface Y — ramps linear within cell, flat cells use HMAP
export function groundElevation(wx, wz) {
  const cx = wx / CELL,
    cz = wz / CELL;
  const c0 = Math.floor(cx),
    r0 = Math.floor(cz);
  const tx = cx - c0,
    tz = cz - r0;
  const cell = mapCell(c0, r0);
  if (cell === 4) return H2 * tz;
  if (cell === 5) return H2 * (1 - tz);
  if (cell === 6) return H2 * tx;
  if (cell === 7) return H2 * (1 - tx);
  const h = hAt(c0, r0);
  const h10 = mapCell(c0 + 1, r0) === 1 ? h : hAt(c0 + 1, r0);
  const h01 = mapCell(c0, r0 + 1) === 1 ? h : hAt(c0, r0 + 1);
  const h11 = mapCell(c0 + 1, r0 + 1) === 1 ? h : hAt(c0 + 1, r0 + 1);
  return h * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export const MAX_STEP = 0.8;

export function canMoveTo(nx, nz, currentGroundY, airborne = false) {
  const mc = Math.floor(nx / CELL),
    mr = Math.floor(nz / CELL);
  const c = mapCell(mc, mr);
  if (c === 1) return false;
  if (airborne || isRamp(c)) return true;
  const cellH = hAt(mc, mr);
  return cellH - currentGroundY <= MAX_STEP;
}
