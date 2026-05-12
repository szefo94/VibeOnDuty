import { CELL, PLAYER_H, PLAYER_R } from './config.js';
import { bunkerMapDef, H1 as _bH1, H2 as _bH2 } from './maps/bunker.js';

// 0=floor 1=solid 2=E-W crack 3=N-S crack 4=ramp-N 5=ramp-S 6=ramp-W 7=ramp-E
// Mutable live bindings — updated by setActiveMap() before each game start.
export let MAP_W = bunkerMapDef.width;
export let MAP_H = bunkerMapDef.height;
export let MAP   = bunkerMapDef.tiles;
export let HMAP  = bunkerMapDef.heightmap;
export let H1    = _bH1;
export let H2    = _bH2;
// Multi-floor array: [{base, tiles, heightmap}]. Single element for built-in maps.
export let FLOORS = [{ base: 0, tiles: bunkerMapDef.tiles, heightmap: bunkerMapDef.heightmap }];

export function setActiveMap(def) {
  MAP_W = def.width;
  MAP_H = def.height;
  H1    = def.H1 ?? 0;
  H2    = def.H2 ?? 0;
  if (def.floors) {
    FLOORS = def.floors;
    MAP    = def.floors[0].tiles;
    HMAP   = def.floors[0].heightmap;
  } else {
    FLOORS = [{ base: 0, tiles: def.tiles, heightmap: def.heightmap }];
    MAP    = def.tiles;
    HMAP   = def.heightmap;
  }
}

export const isRamp  = (c) => (c >= 4 && c <= 27) || (c >= 33 && c <= 152);
export const isCrack = (c) => c === 2 || c === 3;

// Revolved ramp fraction — types 0-3: quarter-turn (90°), types 4-7: half-turn (180°)
// 0: pivot NW  1: pivot NE  2: pivot SE  3: pivot SW
// 4: NS-CW  5: NS-CCW  6: EW-CW  7: EW-CCW
function _revolvedFrac(type, tx, tz) {
  const h = Math.PI / 2;
  switch (type) {
    case 0: return Math.atan2(tz, tx)     / h;
    case 1: return Math.atan2(tz, 1-tx)   / h;
    case 2: return Math.atan2(1-tz, 1-tx) / h;
    case 3: return Math.atan2(1-tz, tx)   / h;
    case 4: return 0.5 - 0.5 * Math.cos(tz * Math.PI) * (1 - 2*tx);
    case 5: return 0.5 + 0.5 * Math.cos(tz * Math.PI) * (1 - 2*tx);
    case 6: return 0.5 - 0.5 * Math.cos(tx * Math.PI) * (1 - 2*tz);
    default:return 0.5 + 0.5 * Math.cos(tx * Math.PI) * (1 - 2*tz);
  }
}

// diagType 0-3 = Outer (valley), 4-7 = Peak (pyramid); dir index: 0=NW 1=NE 2=SE 3=SW
function _diagFrac(diagType, tx, tz) {
  switch (diagType) {
    case 0: return Math.max(1 - tz, 1 - tx); // Outer NW: valley at SE
    case 1: return Math.max(1 - tz, tx);     // Outer NE: valley at SW
    case 2: return Math.max(tz, tx);         // Outer SE: valley at NW
    case 3: return Math.max(tz, 1 - tx);     // Outer SW: valley at NE
    case 4: return Math.min(1 - tz, 1 - tx); // Peak NW
    case 5: return Math.min(1 - tz, tx);     // Peak NE
    case 6: return Math.min(tz, tx);         // Peak SE
    default: return Math.min(tz, 1 - tx);   // Peak SW
  }
}

// F½=1.5 m (FLOOR1/2), F1=3 m, F1½=4.5 m ((F1+F2)/2), F2=6 m
const _RAMP_PROFILE = [
  [0,   null], // 4-7:  0 → F1 (H2 from mapDef)
  [3.0, 6.0],  // 8-11: F1 → F2
  [0,   1.5],  // 12-15: 0 → F½
  [1.5, 3.0],  // 16-19: F½ → F1
  [3.0, 4.5],  // 20-23: F1 → F1½
  [4.5, 6.0],  // 24-27: F1½ → F2
];

export function mapCell(mx, mz) {
  if (mx < 0 || mz < 0 || mx >= MAP_W || mz >= MAP_H) return 1;
  const c = MAP[mz][mx];
  if (c === 28) return 1;  // column: solid
  if (c >= 29 && c <= 32) return 0;  // side wall: floor-passable (thin panel)
  return c;
}

// Height levels — ramp geometry uses H2; see groundElevation below.
export function hAt(c, r) {
  if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return 0;
  return HMAP[r][c] || 0;
}

// ── Multi-floor helpers ───────────────────────────────────────────────────────

function _cellFrom(tiles, mx, mz) {
  if (mx < 0 || mz < 0 || mx >= MAP_W || mz >= MAP_H) return 1;
  const c = tiles[mz][mx];
  if (c === 28) return 1;
  if (c >= 29 && c <= 32) return 0;
  return c;
}

function _hFrom(hmap, c, r) {
  if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return 0;
  return hmap[r][c] || 0;
}

function _floorSurface(fl, c0, r0, tx, tz) {
  const { tiles, heightmap } = fl;
  const cell = _cellFrom(tiles, c0, r0);
  if (cell >= 129 && cell <= 152) {
    const type = Math.floor((cell - 129) / 6);
    const grp  = (cell - 129) % 6;
    const [loY, hiYRaw] = _RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    const f = [tx*(1-tz), (1-tx)*(1-tz), tx*tz, (1-tx)*tz][type];
    return loY + (hiY - loY) * f;
  }
  if (cell >= 81 && cell <= 128) {
    const type = Math.floor((cell - 81) / 6);
    const grp  = (cell - 81) % 6;
    const [loY, hiYRaw] = _RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    return loY + (hiY - loY) * _revolvedFrac(type, tx, tz);
  }
  if (cell >= 33 && cell <= 80) {
    const diagType = Math.floor((cell - 33) / 6);
    const grp = (cell - 33) % 6;
    const [loY, hiYRaw] = _RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    return loY + (hiY - loY) * _diagFrac(diagType, tx, tz);
  }
  if (cell >= 4 && cell <= 27) {
    const dir = (cell - 4) % 4;
    const grp = Math.floor((cell - 4) / 4);
    const [loY, hiYRaw] = _RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    const frac = dir === 0 ? tz : dir === 1 ? (1 - tz) : dir === 2 ? tx : (1 - tx);
    return loY + (hiY - loY) * frac;
  }
  // Flat floor cells return their exact height — bilinear interpolation between
  // cells at different heights would make slab edges behave like ramps.
  return _hFrom(heightmap, c0, r0);
}

// groundElevation: surface Y — ramps interpolate linearly, flat cells return exact height.
// refY: camera eye Y (camera.position.y) used to pick the right floor in multi-floor maps.
// When Infinity (default, legacy callers) the highest surface is returned.
export function groundElevation(wx, wz, refY = Infinity) {
  const cx = wx / CELL, cz = wz / CELL;
  const c0 = Math.floor(cx), r0 = Math.floor(cz);
  const tx = cx - c0, tz = cz - r0;

  if (FLOORS.length === 1) {
    // Fast path — single-floor maps (all built-in levels).
    return _floorSurface(FLOORS[0], c0, r0, tx, tz);
  }

  // Multi-floor: return the highest surface the player can actually stand on.
  // maxSurface = feet level + MAX_STEP headroom.
  const maxSurface = refY === Infinity ? Infinity : refY - PLAYER_H + MAX_STEP;
  let best = -Infinity;
  for (const fl of FLOORS) {
    const s = _floorSurface(fl, c0, r0, tx, tz);
    if (s <= maxSurface) best = Math.max(best, s);
  }
  return best === -Infinity ? 0 : best;
}

export const MAX_STEP = 0.8;

// Wall height per floor storey (equals FLOOR1 = 3 m so walls align cleanly with slabs).
const _FLOOR_WALL_H = 3.0;

// Column base radius (CylinderGeometry bottom) + player body radius
const _COL_BLOCK_R2 = (0.62 + PLAYER_R) ** 2;

// Crack thin-wall collision: 0.35 m thick slab centred on the cell midline.
// Tile 2 (E-W): blocks Z-axis passage. Tile 3 (N-S): blocks X-axis passage.
const _CRACK_HALF_T = 0.35 / 2;
function _crackBlocks(c, mc, mr, nx, nz) {
  if (c === 2) return Math.abs(nz - (mr + 0.5) * CELL) < _CRACK_HALF_T + PLAYER_R;
  if (c === 3) return Math.abs(nx - (mc + 0.5) * CELL) < _CRACK_HALF_T + PLAYER_R;
  return false;
}

export function canMoveTo(nx, nz, currentGroundY, airborne = false) {
  const mc = Math.floor(nx / CELL), mr = Math.floor(nz / CELL);

  // Column (tile 28): circular collision instead of full-cell AABB.
  // mapCell/cellFrom return 1 for tile 28, so we must handle it before the wall check.
  if (FLOORS.some(fl => fl.tiles[mr]?.[mc] === 28)) {
    const cx = (mc + 0.5) * CELL, cz = (mr + 0.5) * CELL;
    return (nx - cx) ** 2 + (nz - cz) ** 2 >= _COL_BLOCK_R2;
  }

  if (FLOORS.length === 1) {
    // Fast path: single-floor (existing behaviour).
    const c = mapCell(mc, mr);
    if (c === 1) return false;
    if (isCrack(c) && _crackBlocks(c, mc, mr, nx, nz)) return false;
    if (airborne || isRamp(c)) return true;
    const cellH = hAt(mc, mr);
    return cellH - currentGroundY <= MAX_STEP;
  }

  // Multi-floor: check every floor layer for wall / ramp / step.
  let hasRamp = false;

  for (const fl of FLOORS) {
    const c = _cellFrom(fl.tiles, mc, mr);
    if (isRamp(c)) { hasRamp = true; continue; }
    if (isCrack(c)) {
      if (_crackBlocks(c, mc, mr, nx, nz)) return false;
      continue;
    }
    if (c !== 1) continue;
    // Wall: blocked when the player body [feet, feet+PLAYER_H] overlaps [base, base+wallH].
    const wallBase = fl.base;
    const wallTop  = wallBase + _FLOOR_WALL_H;
    if (currentGroundY < wallTop && currentGroundY + PLAYER_H > wallBase) return false;
  }

  if (airborne || hasRamp) return true;

  // Height-step check: find the highest accessible slab at (mc, mr).
  let cellH = 0;
  for (const fl of FLOORS) {
    const h = _hFrom(fl.heightmap, mc, mr);
    if (h <= currentGroundY + MAX_STEP) cellH = Math.max(cellH, h);
  }
  return cellH - currentGroundY <= MAX_STEP;
}
