// @ts-check
import { CELL, PLAYER_H, PLAYER_R, WALL_H } from '../config.js';
import { isColumn, isCrack, isRamp, rampOf, rampSurface } from '../tiles.js';

/** @typedef {{x:number,y:number,z:number}} Point */
/** @typedef {{base:number,tiles:number[][],heightmap:number[][],wallHeight?:number}} Floor */
/** @typedef {{width:number,height:number,tiles:number[][],heightmap:number[][],H2:number,wallHeight?:number,style?:string,floors?:Floor[],spawnAttacker:{x:number,z:number},spawnDefender:{x:number,z:number}}} MapData */
/** @typedef {{lo:Point,hi:Point,body:boolean}} Box */
/** @typedef {{x:number,z:number,base:number,top:number,radius:number}} Column */
/** @typedef {[Point,Point,Point]} Triangle */
const EPS = 1e-9;
export const MAX_STEP = 0.8;

/** Earliest closed segment / axis-aligned box contact. @param {Point} start @param {Point} end @param {Point} lo @param {Point} hi */
export function segmentBox(start, end, lo, hi) {
  let near = 0,
    far = 1;
  for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
    const d = end[axis] - start[axis];
    if (Math.abs(d) < EPS) {
      if (start[axis] < lo[axis] || start[axis] > hi[axis]) return null;
    } else {
      const a = (lo[axis] - start[axis]) / d,
        b = (hi[axis] - start[axis]) / d;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}
/** @param {Point} a @param {Point} b */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** @param {Point} a @param {Point} b */
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
/** @param {Point} a @param {Point} b */
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
/** Double-sided segment/triangle intersection. @param {Point} start @param {Point} end @param {Triangle} tri */
function segmentTriangle(start, end, [a, b, c]) {
  const d = sub(end, start),
    ab = sub(b, a),
    ac = sub(c, a),
    h = cross(d, ac),
    det = dot(ab, h);
  if (Math.abs(det) < EPS) return null;
  const s = sub(start, a),
    u = dot(s, h) / det;
  if (u < -EPS || u > 1 + EPS) return null;
  const q = cross(s, ab),
    v = dot(d, q) / det;
  if (v < -EPS || u + v > 1 + EPS) return null;
  const t = dot(ac, q) / det;
  return t >= -EPS && t <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
}
/** @param {Point} start @param {Point} end @param {Column} col */
function segmentColumn(start, end, col) {
  const dx = end.x - start.x,
    dz = end.z - start.z,
    ox = start.x - col.x,
    oz = start.z - col.z;
  let near = 0,
    far = 1;
  const a = dx * dx + dz * dz,
    b = 2 * (ox * dx + oz * dz),
    c = ox * ox + oz * oz - col.radius ** 2;
  if (a < EPS) {
    if (c > 0) return null;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    near = Math.max(near, (-b - Math.sqrt(disc)) / (2 * a));
    far = Math.min(far, (-b + Math.sqrt(disc)) / (2 * a));
  }
  const dy = end.y - start.y;
  if (Math.abs(dy) < EPS) {
    if (start.y < col.base || start.y > col.top) return null;
  } else {
    const aY = (col.base - start.y) / dy,
      bY = (col.top - start.y) / dy;
    near = Math.max(near, Math.min(aY, bY));
    far = Math.min(far, Math.max(aY, bY));
  }
  return near <= far ? near : null;
}
/** @param {Point} body @param {Box} box */
function overlapsBox(body, box) {
  if (body.y - PLAYER_H >= box.hi.y - EPS || body.y <= box.lo.y + EPS) return false;
  const dx = body.x - Math.max(box.lo.x, Math.min(body.x, box.hi.x));
  const dz = body.z - Math.max(box.lo.z, Math.min(body.z, box.hi.z));
  return dx * dx + dz * dz < PLAYER_R ** 2 - EPS;
}
/** Horizontal bodies collide only when their vertical spans overlap. @param {Point} a @param {Point} b */
export function bodiesOverlap(a, b) {
  return (
    Math.abs(a.y - b.y) < PLAYER_H - EPS && Math.hypot(a.x - b.x, a.z - b.z) < 2 * PLAYER_R - EPS
  );
}

/** Own the gameplay data and queries; no renderer, singleton, or browser imports. @param {MapData} data */
export function createWorld(data) {
  const map = structuredClone({
    width: data.width,
    height: data.height,
    H2: data.H2,
    wallHeight: data.wallHeight,
    style: data.style,
    tiles: data.tiles,
    heightmap: data.heightmap,
    floors: data.floors,
    spawnAttacker: data.spawnAttacker,
    spawnDefender: data.spawnDefender,
  });
  const floors = map.floors ?? [
    { base: 0, tiles: map.tiles, heightmap: map.heightmap, wallHeight: map.wallHeight },
  ];
  /** @type {Box[]} */ const boxes = [];
  /** @type {Column[]} */ const columns = [];
  /** @type {Triangle[]} */ const triangles = [];
  /** @param {number} x @param {number} z */
  const worldToCell = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
  /** @param {Floor} fl @param {number} x @param {number} z */
  function surface(fl, x, z) {
    const [c, r] = worldToCell(x, z);
    return (
      rampSurface(fl.tiles[r]?.[c] ?? 1, x / CELL - c, z / CELL - r, map.H2) ??
      fl.heightmap[r]?.[c] ??
      0
    );
  }
  /** @param {number} x @param {number} z @param {number} [refY] */
  function groundElevation(x, z, refY = Infinity) {
    if (floors.length === 1) return surface(floors[0], x, z);
    const ceiling = refY === Infinity ? Infinity : refY - PLAYER_H + MAX_STEP;
    let best = -Infinity;
    for (const fl of floors) {
      const s = surface(fl, x, z);
      if (s <= ceiling) best = Math.max(best, s);
    }
    return best === -Infinity ? 0 : best;
  }
  /** @param {Point} lo @param {Point} hi @param {boolean} [body] */
  const box = (lo, hi, body = true) => boxes.push({ lo, hi, body });
  /** @param {Point} a @param {Point} b @param {Point} c @param {Point} d */
  function quad(a, b, c, d) {
    triangles.push([a, c, b], [b, c, d]);
  }
  for (const fl of floors) {
    const base = fl.base,
      wh = fl.wallHeight ?? map.wallHeight ?? WALL_H;
    for (let r = 0; r < map.height; r++)
      for (let c = 0; c < map.width; c++) {
        const tile = fl.tiles[r][c],
          x = (c + 0.5) * CELL,
          z = (r + 0.5) * CELL;
        const pillar =
          isColumn(tile) ||
          (tile === 1 &&
            map.style !== 'rooftop' &&
            [
              [c, r - 1],
              [c, r + 1],
              [c - 1, r],
              [c + 1, r],
            ].every(([cx, rz]) => fl.tiles[rz]?.[cx] === 0));
        if (pillar) {
          columns.push({ x, z, base, top: base + wh + 0.8, radius: 0.62 });
          // Visible column foot and capital also stop projectiles.
          box(
            { x: x - 0.75, y: base, z: z - 0.75 },
            { x: x + 0.75, y: base + 0.22, z: z + 0.75 },
            false
          );
          box(
            { x: x - 0.7, y: base + wh + 0.625, z: z - 0.7 },
            { x: x + 0.7, y: base + wh + 0.975, z: z + 0.7 },
            false
          );
        } else if (tile === 1) {
          box(
            { x: c * CELL, y: base, z: r * CELL },
            { x: (c + 1) * CELL, y: base + wh, z: (r + 1) * CELL }
          );
        } else if (isCrack(tile)) {
          const rx = tile === 3 ? 0.175 : 2,
            rz = tile === 2 ? 0.175 : 2;
          box(
            { x: x - rx, y: base, z: z - rz },
            { x: x + rx, y: base + PLAYER_H - 0.28, z: z + rz }
          );
          box(
            { x: x - rx, y: base + PLAYER_H + 0.28, z: z - rz },
            { x: x + rx, y: base + PLAYER_H + 0.83, z: z + rz }
          );
        } else if (isRamp(tile)) {
          const descriptor = rampOf(tile);
          const n = descriptor?.family === 'corner' || descriptor?.family === 'revolved' ? 8 : 1;
          // Match level.js tessellation. Straight boxes have 0.10m normal thickness.
          const slopeX =
            (rampSurface(tile, 1, 0, map.H2) ?? 0) - (rampSurface(tile, 0, 0, map.H2) ?? 0);
          const slopeZ =
            (rampSurface(tile, 0, 1, map.H2) ?? 0) - (rampSurface(tile, 0, 0, map.H2) ?? 0);
          const normal = { x: -slopeX / CELL, y: 1, z: -slopeZ / CELL },
            norm = Math.hypot(normal.x, normal.y, normal.z);
          /** @param {number} u @param {number} v @param {boolean} bottom */
          const vertex = (u, v, bottom) => {
            let p = {
              x: (c + u) * CELL,
              y: rampSurface(tile, u, v, map.H2) ?? 0,
              z: (r + v) * CELL,
            };
            if (descriptor?.family === 'straight') {
              const offset = (bottom ? -0.05 : 0.05) / norm;
              p = { x: p.x + normal.x * offset, y: p.y + offset, z: p.z + normal.z * offset };
            } else if (bottom) p.y -= 0.1;
            return p;
          };
          for (let iz = 0; iz < n; iz++)
            for (let ix = 0; ix < n; ix++) {
              const u = ix / n,
                v = iz / n,
                u1 = (ix + 1) / n,
                v1 = (iz + 1) / n;
              quad(
                vertex(u, v, false),
                vertex(u1, v, false),
                vertex(u, v1, false),
                vertex(u1, v1, false)
              );
              quad(
                vertex(u, v, true),
                vertex(u1, v, true),
                vertex(u, v1, true),
                vertex(u1, v1, true)
              );
              if (descriptor?.family === 'straight') {
                for (const [au, av, bu, bv] of [
                  [u, v, u1, v],
                  [u, v1, u1, v1],
                  [u, v, u, v1],
                  [u1, v, u1, v1],
                ])
                  quad(
                    vertex(au, av, false),
                    vertex(bu, bv, false),
                    vertex(au, av, true),
                    vertex(bu, bv, true)
                  );
              }
            }
        }
        if (tile === 0 && fl.heightmap[r][c] > 0) {
          const h = fl.heightmap[r][c];
          box(
            { x: c * CELL, y: h - 0.3, z: r * CELL },
            { x: (c + 1) * CELL, y: h, z: (r + 1) * CELL }
          );
        }
      }
  }
  /** @param {Point} body */
  function canOccupy(body) {
    if (![body.x, body.y, body.z].every(Number.isFinite)) return false;
    if (
      body.x < PLAYER_R - EPS ||
      body.z < PLAYER_R - EPS ||
      body.x > map.width * CELL - PLAYER_R + EPS ||
      body.z > map.height * CELL - PLAYER_R + EPS
    )
      return false;
    if (groundElevation(body.x, body.z, body.y) - (body.y - PLAYER_H) > MAX_STEP + EPS)
      return false;
    // A supporting slab may be up to MAX_STEP higher; evaluate collision at the
    // selected eye height, just as movement places the body after taking a step.
    const stood = {
      ...body,
      y: Math.max(body.y, groundElevation(body.x, body.z, body.y) + PLAYER_H),
    };
    if (boxes.some((b) => b.body && overlapsBox(stood, b))) return false;
    return columns.every(
      (col) =>
        stood.y - PLAYER_H >= col.top - EPS ||
        stood.y <= col.base + EPS ||
        Math.hypot(stood.x - col.x, stood.z - col.z) >= col.radius + PLAYER_R - EPS
    );
  }
  /** @param {Point} start @param {Point} end @returns {number|null} */
  function sweepObstruction(start, end) {
    /** @type {number|null} */ let best = null;
    /** @param {number|null} t */
    const take = (t) => {
      if (t !== null && (best === null || t < best)) best = t;
    };
    for (const b of boxes) take(segmentBox(start, end, b.lo, b.hi));
    for (const col of columns) take(segmentColumn(start, end, col));
    for (const tri of triangles) take(segmentTriangle(start, end, tri));
    if (start.y <= 0) take(0);
    else if (end.y <= 0) take(start.y / (start.y - end.y));
    return best;
  }
  /** @param {string} team @param {Point[]} occupied */
  function chooseSpawn(team, occupied) {
    const primary = team === 'alpha' ? map.spawnAttacker : map.spawnDefender;
    const candidates = [{ ...primary, y: groundElevation(primary.x, primary.z) + PLAYER_H }];
    for (const fl of floors)
      for (let r = 0; r < map.height; r++)
        for (let c = 0; c < map.width; c++) {
          if (fl.tiles[r][c] !== 0 && !isRamp(fl.tiles[r][c])) continue;
          const x = (c + 0.5) * CELL,
            z = (r + 0.5) * CELL;
          candidates.push({ x, z, y: surface(fl, x, z) + PLAYER_H });
        }
    return (
      candidates.find((p) => canOccupy(p) && occupied.every((b) => !bodiesOverlap(p, b))) ?? null
    );
  }
  return { worldToCell, groundElevation, canOccupy, sweepObstruction, chooseSpawn };
}
