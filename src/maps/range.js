import * as THREE from 'three';
import { mm } from '../materials.js';
import { CELL } from '../config.js';

// 14 tiles wide × 20 tiles deep — 56 m × 80 m flat shooting hall
const W = 14, H = 20;

const _t = [];
for (let r = 0; r < H; r++) {
  const row = [];
  for (let c = 0; c < W; c++)
    row.push(r === 0 || r === H - 1 || c === 0 || c === W - 1 ? 1 : 0);
  _t.push(row);
}
const _hm = Array.from({ length: H }, () => Array(W).fill(0));

export const rangeMapDef = {
  name:    'TRAINING RANGE',
  style:   'range',
  tiles:   _t,
  heightmap: _hm,
  width:   W,
  height:  H,
  H1: 0, H2: 0,
  wallHeight: 4,
  spawnPlayer:   { x: W / 2 * CELL, z: 2.5 * CELL },
  spawnAttacker: { x: W / 2 * CELL, z: 2.5 * CELL },
  spawnDefender: { x: W / 2 * CELL, z: 2.5 * CELL },
  sites: [],
  fog:      { color: 0x0d0d18, density: 0.004 },
  skyColor: 0x0d0d18,
  showRubble: false,
  materials: {
    floor:    mm(0x292936, 0.93, 0.01),
    wall:     mm(0x36364a, 0.88, 0.02),
    wallDark: mm(0x1c1c28, 0.92, 0.01),
    wallTop:  mm(0x36364a, 0.82, 0.02),
    crack:    mm(0x3d3d52, 0.90, 0.01),
    trim:     mm(0x42425a, 0.72, 0.05),
    ramp:     { color: 0x36364a, roughness: 0.9, metalness: 0.01 },
  },
  buildExtras(scene, _torchLights, ambientLight, sunLight) {
    ambientLight.intensity = 2.0;
    sunLight.intensity     = 0;

    // Overhead strip lights every 2 tiles
    for (let z = 2; z < H - 1; z += 2) {
      const pt = new THREE.PointLight(0xd0d8ff, 2.5, 26);
      pt.position.set(W / 2 * CELL, 3.6, z * CELL + CELL / 2);
      scene.add(pt);
    }

    // Distance marker lines painted on the floor (green → yellow → red)
    const spawnZ = 2.5 * CELL;
    const markers = [
      [5,  0x00dd77], [10, 0x00dd77],
      [20, 0xffcc00], [30, 0xffcc00],
      [40, 0xff5500], [55, 0xff5500],
    ];
    for (const [dist, col] of markers) {
      const ln = new THREE.Mesh(
        new THREE.BoxGeometry((W - 2) * CELL, 0.02, 0.07),
        new THREE.MeshBasicMaterial({ color: col })
      );
      ln.position.set(W / 2 * CELL, 0.02, spawnZ + dist);
      scene.add(ln);
    }
  },
};
