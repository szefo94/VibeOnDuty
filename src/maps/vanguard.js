import * as THREE from 'three';
import { mm } from '../materials.js';
import { CELL } from '../config.js';

export const H1 = 0, H2 = 3.0;

const W = 24, H = 24;
const _fill = (v) => Array.from({ length: H }, () => Array(W).fill(v));
const _border = (t) => {
  for (let c = 0; c < W; c++) { t[0][c] = 1; t[H - 1][c] = 1; }
  for (let r = 1; r < H - 1; r++) { t[r][0] = 1; t[r][W - 1] = 1; }
};

// ── GROUND FLOOR (base = 0) ───────────────────────────────────────────────
// Ramp tiles (straight, group 2-3 for two-cell stairwells):
//   13 = gr2 dir1  (0→1.5 m, north edge = 1.5 m)
//   17 = gr3 dir1  (1.5→3 m, north edge = 3.0 m)
//   12 = gr2 dir0  (0→1.5 m, south edge = 1.5 m)
//   16 = gr3 dir0  (1.5→3 m, south edge = 3.0 m)
// NW stairwell: player enters row 4 from south at y=0, exits row 3 north at y=3 m
// SE stairwell: player enters row 19 from north at y=0, exits row 20 south at y=3 m
const t0 = _fill(0);
_border(t0);

// NW stairwell shaft — col 4, rows 2-4
t0[2][3] = 1; t0[2][4] = 1; t0[2][5] = 1;          // north cap (blocks entry from above)
t0[3][3] = 1; t0[3][4] = 17; t0[3][5] = 1;          // ramp upper (1.5→3 m, rises N)
t0[4][3] = 1; t0[4][4] = 13; t0[4][5] = 1;          // ramp lower (0→1.5 m, rises N)

// SE stairwell shaft — col 19, rows 19-21
t0[21][18] = 1; t0[21][19] = 1; t0[21][20] = 1;     // south cap
t0[20][18] = 1; t0[20][19] = 16; t0[20][20] = 1;    // ramp upper (1.5→3 m, rises S)
t0[19][18] = 1; t0[19][19] = 12; t0[19][20] = 1;    // ramp lower (0→1.5 m, rises S)

// Cover — crates and barriers
[
  // Left flank L
  [7, 5], [7, 6], [8, 5],
  // Right flank L (mirror)
  [7, 17], [7, 18], [8, 18],
  // Left mid pillar
  [11, 6], [12, 6],
  // Right mid pillar
  [11, 17], [12, 17],
  // Centre-north crates
  [9, 10], [9, 11], [9, 12],
  // Centre-south crates
  [14, 11], [14, 12], [14, 13],
  // Lower left flank L
  [15, 5], [15, 6], [16, 5],
  // Lower right flank L (mirror)
  [15, 17], [15, 18], [16, 18],
].forEach(([r, c]) => { t0[r][c] = 1; });

const hm0 = _fill(0); // ground floor is flat — no slabs needed

// ── FLOOR 1 (base = 3 m) ─────────────────────────────────────────────────
// Ramp tiles to floor 2:
//   21 = gr4 dir1  (3→4.5 m, north edge = 4.5 m)
//   25 = gr5 dir1  (4.5→6 m, north edge = 6.0 m)
// Centre stairwell: col 11, rows 3-4 — player enters row 4 from south at y=3, exits row 2 at y=6
const t1 = _fill(0);
_border(t1);

const hm1 = _fill(0);
// Perimeter balcony ring (4 cells deep from each wall)
for (let r = 1; r < H - 1; r++) {
  for (let c = 1; c < W - 1; c++) {
    if (r <= 4 || r >= 19 || c <= 4 || c >= 19) hm1[r][c] = 3.0;
  }
}
// N–S bridge across centre void (rows 11-12)
for (let c = 5; c <= 18; c++) { hm1[11][c] = 3.0; hm1[12][c] = 3.0; }

// NW stairwell voids on floor-1 (no slab above the ramp)
hm1[3][4] = 0; hm1[4][4] = 0;
// Side walls to enclose the stairwell shaft
t1[3][3] = 1; t1[3][5] = 1;
t1[4][3] = 1; t1[4][5] = 1;
// Landing at (row 2, col 4) — hm1 already 3.0 from perimeter loop ✓

// SE stairwell voids on floor-1
hm1[19][19] = 0; hm1[20][19] = 0;
t1[19][18] = 1; t1[19][20] = 1;
t1[20][18] = 1; t1[20][20] = 1;
// Landing at (row 21, col 19) — hm1 already 3.0 ✓

// Centre stairwell: floor-1 → floor-2
t1[2][10] = 1; t1[2][11] = 1; t1[2][12] = 1;         // north cap
t1[3][10] = 1; t1[3][11] = 25; t1[3][12] = 1;        // ramp upper (4.5→6 m, rises N)
t1[4][10] = 1; t1[4][11] = 21; t1[4][12] = 1;        // ramp lower (3→4.5 m, rises N)
hm1[3][11] = 0; hm1[4][11] = 0;                       // voids above ramp
// Landing at (row 2, col 11) — hm1 already 3.0 from perimeter loop ✓

// ── FLOOR 2 (base = 6 m) ─────────────────────────────────────────────────
const t2 = _fill(0);
_border(t2);

const hm2 = _fill(0);

// Top room: rows 2-5, cols 7-16 (accessed from centre stairwell at col 11 row 2)
for (let c = 7; c <= 16; c++) t2[2][c] = 1; // north wall
for (let c = 7; c <= 16; c++) t2[5][c] = 1; // south wall (with windows punched below)
t2[3][7] = 1; t2[4][7] = 1;                 // west wall
t2[3][16] = 1; t2[4][16] = 1;               // east wall

// Floor slab inside room
for (let r = 3; r <= 4; r++) for (let c = 8; c <= 15; c++) hm2[r][c] = 6.0;

// Landing from stairwell — break north wall at col 11 and give it floor
t2[2][11] = 0;
hm2[2][10] = 6.0; hm2[2][11] = 6.0; hm2[2][12] = 6.0;

// South window openings in room wall (viewing down to ground floor)
t2[5][10] = 0; t2[5][11] = 0; t2[5][12] = 0;
hm2[5][10] = 6.0; hm2[5][11] = 6.0; hm2[5][12] = 6.0;

// ── Materials ─────────────────────────────────────────────────────────────
const vgFloor   = mm(0x3a3a42, 0.96, 0.02);
const vgWall    = mm(0x5a5a66, 0.88, 0.03);
const vgWallD   = mm(0x2e2e38, 0.92, 0.02);
const vgWallT   = mm(0x6e6e7a, 0.80, 0.08);
const vgTrim    = mm(0x888890, 0.70, 0.12);
const vgRamp    = mm(0x4a4a54, 0.90, 0.03);

export const vanguardMapDef = {
  name: 'Vanguard Complex',
  floors: [
    { base: 0, tiles: t0, heightmap: hm0, wallHeight: 3.0 },
    { base: 3, tiles: t1, heightmap: hm1, wallHeight: 3.0 },
    { base: 6, tiles: t2, heightmap: hm2, wallHeight: 3.0 },
  ],
  width: W,
  height: H,
  H1,
  H2,
  spawnPlayer:   { x: 11 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  spawnAttacker: { x:  2 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  spawnDefender: { x: 21 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  sites: [
    { id: 'A', x:  7 * CELL + CELL / 2, z:  7 * CELL + CELL / 2 },
    { id: 'B', x: 16 * CELL + CELL / 2, z: 16 * CELL + CELL / 2 },
  ],
  fog:       { color: 0x28282e, density: 0.018 },
  skyColor:  0x1a1a22,
  wallHeight: 3.0,
  showRubble: false,
  materials: {
    floor:    vgFloor,
    wall:     vgWall,
    wallDark: vgWallD,
    wallTop:  vgWallT,
    crack:    vgTrim,
    trim:     vgTrim,
    ramp:     vgRamp,
  },
  buildExtras(scene, torchLights, ambientLight, sunLight) {
    ambientLight.color.setHex(0x8090b0);
    ambientLight.intensity = 0.6 * Math.PI;
    sunLight.intensity = 0;

    // Overhead lights on each floor
    const pts = [
      // Ground floor
      [11, 0.5, 6], [11, 0.5, 11], [11, 0.5, 17],
      [6,  0.5, 11], [17, 0.5, 11],
      // Second floor
      [2,  3.5, 2], [21, 3.5, 2], [2, 3.5, 21], [21, 3.5, 21],
      [11, 3.5, 11], [11, 3.5, 5], [11, 3.5, 18],
      // Third floor
      [11, 6.5, 4],
    ];
    for (const [tc, ty, tr] of pts) {
      const pl = new THREE.PointLight(0xa0b4d8, 1.6 * 4 * Math.PI, 14);
      pl.position.set(tc * CELL, ty + 2.4, tr * CELL);
      pl.userData.base = 1.6 * 4 * Math.PI;
      pl.userData.ft   = Math.random() * 100;
      scene.add(pl);
      torchLights.push(pl);
    }
  },
};
