import { CELL } from './config.js';
import { bunkerMapDef, H1 as _bH1, H2 as _bH2 } from './maps/bunker.js';

// 0=floor 1=solid 2=E-W crack 3=N-S crack 4=ramp-N 5=ramp-S 6=ramp-W 7=ramp-E
// Mutable live bindings — updated by setActiveMap() before each game start.
export let MAP_W = bunkerMapDef.width;
export let MAP_H = bunkerMapDef.height;
export let MAP   = bunkerMapDef.tiles;
export let HMAP  = bunkerMapDef.heightmap;
export let H1    = _bH1;
export let H2    = _bH2;

export function setActiveMap(def) {
  MAP_W = def.width;
  MAP_H = def.height;
  MAP   = def.tiles;
  HMAP  = def.heightmap;
  H1    = def.H1 ?? 0;
  H2    = def.H2 ?? 0;
}

export const isRamp  = (c) => c >= 4 && c <= 7;
export const isCrack = (c) => c === 2 || c === 3;

export function mapCell(mx, mz) {
  if (mx < 0 || mz < 0 || mx >= MAP_W || mz >= MAP_H) return 1;
  return MAP[mz][mx];
}

// Height levels — ramp geometry uses H2; see groundElevation below.
export function hAt(c, r) {
  if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return 0;
  return HMAP[r][c] || 0;
}

// groundElevation: surface Y — ramps linear within cell, flat cells bilinear from HMAP
export function groundElevation(wx, wz) {
  const cx = wx / CELL, cz = wz / CELL;
  const c0 = Math.floor(cx), r0 = Math.floor(cz);
  const tx = cx - c0, tz = cz - r0;
  const cell = mapCell(c0, r0);
  if (cell === 4) return H2 * tz;
  if (cell === 5) return H2 * (1 - tz);
  if (cell === 6) return H2 * tx;
  if (cell === 7) return H2 * (1 - tx);
  const h   = hAt(c0, r0);
  const h10 = mapCell(c0 + 1, r0) === 1 ? h : hAt(c0 + 1, r0);
  const h01 = mapCell(c0, r0 + 1) === 1 ? h : hAt(c0, r0 + 1);
  const h11 = mapCell(c0 + 1, r0 + 1) === 1 ? h : hAt(c0 + 1, r0 + 1);
  return h * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export const MAX_STEP = 0.8;

export function canMoveTo(nx, nz, currentGroundY, airborne = false) {
  const mc = Math.floor(nx / CELL), mr = Math.floor(nz / CELL);
  const c = mapCell(mc, mr);
  if (c === 1) return false;
  if (airborne || isRamp(c)) return true;
  const cellH = hAt(mc, mr);
  return cellH - currentGroundY <= MAX_STEP;
}
