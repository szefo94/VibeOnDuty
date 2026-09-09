/**
 * tiles.js — the single owner of the map tile ID space.
 *
 * Tile IDs are packed integers: a cell's kind, and for ramps its family, shape and
 * height band, are all encoded in one number. That packing used to be decoded by
 * hand-written range checks in map.js, level.js and mapEditor.js, so adding a shape
 * meant claiming another ID block and editing range tests in three files. Everything
 * that reads the packing now lives here.
 *
 * The on-disk format is unchanged — maps stay plain int arrays, which keeps them
 * diffable, compact and easy to generate procedurally. What changed is that nothing
 * outside this file is allowed to know how the integers are laid out.
 *
 *   0        floor
 *   1        solid wall
 *   2 / 3    crack, E-W / N-S (thin blocking slab on the cell midline)
 *   4-27     straight ramp   — 6 height bands x 4 directions   (dir is the fast axis)
 *   28       column          — circular collision, not a full cell
 *   29-32    side wall       — thin panel, walkable
 *   33-80    diagonal ramp   — 8 shapes x 6 height bands       (band is the fast axis)
 *   81-128   revolved ramp   — 8 shapes x 6 height bands
 *   129-152  corner ramp     — 4 shapes x 6 height bands
 *
 * Note the straight-ramp block packs direction as the fast axis while every other
 * family packs the height band. That asymmetry is preserved here for compatibility
 * with existing maps, and is exactly the kind of detail that should only exist once.
 */

import { bilinearFrac, revolvedFrac, diagFrac, RAMP_PROFILE } from './rampMath.js';

export const TILE_FLOOR    = 0;
export const TILE_SOLID    = 1;
export const TILE_CRACK_EW = 2;
export const TILE_CRACK_NS = 3;
export const TILE_COLUMN   = 28;

// [firstId, count, shapes, bandIsFastAxis]
const RAMP_FAMILIES = [
  { name: 'straight', first: 4,   shapes: 4, bandFast: false },
  { name: 'diagonal', first: 33,  shapes: 8, bandFast: true  },
  { name: 'revolved', first: 81,  shapes: 8, bandFast: true  },
  { name: 'corner',   first: 129, shapes: 4, bandFast: true  },
];
const BANDS = RAMP_PROFILE.length; // 6

for (const f of RAMP_FAMILIES) f.last = f.first + f.shapes * BANDS - 1;

const SIDE_WALL_FIRST = 29, SIDE_WALL_LAST = 32;

/** Ramp descriptor, or null. { family, shape, band } */
export function rampOf(id) {
  for (const f of RAMP_FAMILIES) {
    if (id < f.first || id > f.last) continue;
    const n = id - f.first;
    return f.bandFast
      ? { family: f.name, shape: Math.floor(n / BANDS), band: n % BANDS }
      : { family: f.name, shape: n % f.shapes,          band: Math.floor(n / f.shapes) };
  }
  return null;
}

export const isRamp     = (id) => rampOf(id) !== null;
export const isCrack    = (id) => id === TILE_CRACK_EW || id === TILE_CRACK_NS;
export const isColumn   = (id) => id === TILE_COLUMN;
export const isSideWall = (id) => id >= SIDE_WALL_FIRST && id <= SIDE_WALL_LAST;

/** Encode back to an id — used by the editor palette and by tests. */
export function rampId(family, shape, band) {
  const f = RAMP_FAMILIES.find((x) => x.name === family);
  if (!f) return TILE_FLOOR;
  return f.first + (f.bandFast ? shape * BANDS + band : band * f.shapes + shape);
}

/**
 * What this cell means for navigation and collision:
 * columns read as solid (their real shape is a circle handled separately), side
 * walls read as floor (thin panel you walk past), everything else is itself.
 */
export function navCell(id) {
  if (isColumn(id))   return TILE_SOLID;
  if (isSideWall(id)) return TILE_FLOOR;
  return id;
}

/** Low and high Y for a ramp's height band. `h2` is the map's upper level. */
export function rampHeights(ramp, h2) {
  const [loY, hiRaw] = RAMP_PROFILE[ramp.band] ?? [0, null];
  return [loY, hiRaw ?? h2];
}

/** Fraction 0..1 of the way from loY to hiY at local cell coords (tx, tz). */
export function rampFrac(ramp, tx, tz) {
  switch (ramp.family) {
    case 'straight': {
      const d = ramp.shape;
      return d === 0 ? tz : d === 1 ? (1 - tz) : d === 2 ? tx : (1 - tx);
    }
    case 'diagonal': return diagFrac(ramp.shape, tx, tz);
    case 'revolved': return revolvedFrac(ramp.shape, tx, tz);
    case 'corner':   return bilinearFrac(ramp.shape, tx, tz);
    default:         return 0;
  }
}

/** Surface height of a ramp cell at local coords, or null if not a ramp. */
export function rampSurface(id, tx, tz, h2) {
  const ramp = rampOf(id);
  if (!ramp) return null;
  const [loY, hiY] = rampHeights(ramp, h2);
  return loY + (hiY - loY) * rampFrac(ramp, tx, tz);
}
