import * as THREE from 'three';
import { CELL } from '../config.js';
import { mm } from '../materials.js';

export const H1 = 0, H2 = 0;

// 24×24 open temple arena — two colonnades of isolated pillars, open nave
const TILES = [
  //col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row  0 N wall
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  1
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  2
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1], // row  3 corner columns
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  4
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  5
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  6
  [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,1], // row  7 N colonnade
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  8
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  9
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 10
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 11 open nave
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 12
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 13
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 14
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 15
  [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,1], // row 16 S colonnade
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 17
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 18
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 19
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1], // row 20 corner columns
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 21
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 22
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 23 S wall
];

const HEIGHTMAP = Array.from({ length: 24 }, () => new Array(24).fill(0));

const gcFloor  = mm(0xf0ece2, 0.55, 0.02);  // warm cream marble
const gcWall   = mm(0xf5f1e8, 0.45, 0.04);  // white marble column
const gcWallD  = mm(0xe8e4da, 0.55, 0.03);  // slightly shadowed marble
const gcWallT  = mm(0xdedad0, 0.50, 0.06);  // marble capital/base
const gcTrim   = mm(0xc8a840, 0.60, 0.30);  // gold trim

export const bunkerMapDef = {
  name: 'Greek Columns',
  tiles: TILES,
  heightmap: HEIGHTMAP,
  width: 24,
  height: 24,
  H1,
  H2,
  spawnPlayer:   { x: 11 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  spawnAttacker: { x: 21 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  spawnDefender: { x:  2 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  sites: [
    { id: 'A', x: 11 * CELL + CELL / 2, z:  3 * CELL + CELL / 2 },
    { id: 'B', x: 11 * CELL + CELL / 2, z: 20 * CELL + CELL / 2 },
  ],
  fog: { color: 0xe8dfc8, density: 0.008 },
  skyColor: 0x96b8d8,
  wallHeight: 4.5,
  showRubble: false,
  materials: {
    floor:    gcFloor,
    wall:     gcWall,
    wallDark: gcWallD,
    wallTop:  gcWallT,
    crack:    gcTrim,
    trim:     gcTrim,
    ramp:     gcWall,
  },
  buildExtras(scene, torchLights, ambientLight, sunLight) {
    ambientLight.color.setHex(0xffe8d0);
    ambientLight.intensity = 1.0 * Math.PI;
    sunLight.color.setHex(0xfff0d0);
    sunLight.intensity = 3.2 * Math.PI;
    sunLight.position.set(30, 80, 40);

    // Warm torch-brazier point lights between colonnades
    for (const [tc, tr] of [[11, 7], [11, 16], [5, 11], [17, 11]]) {
      const tl = new THREE.PointLight(0xff9944, 1.2 * 4 * Math.PI, 18);
      tl.position.set(tc * CELL, 2.5, tr * CELL);
      tl.userData.base = 1.2 * 4 * Math.PI;
      tl.userData.ft = Math.random() * 100;
      scene.add(tl);
      torchLights.push(tl);
    }

    void gcTrim;
  },
};
