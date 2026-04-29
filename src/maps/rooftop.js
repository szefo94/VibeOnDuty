import * as THREE from 'three';
import { CELL } from '../config.js';
import { mm } from '../materials.js';

export const H1 = 0, H2 = 0;

// 24×24 rooftop — open sightlines, HVAC cover clusters, flat (no ramps/cracks)
const TILES = [
  //col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row  0 north wall
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  1
  [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1], // row  2 sentinel HVAC
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  3
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1], // row  4 HVAC clusters
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1], // row  5
  [1,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,1], // row  6 centre cover pair
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  7
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1], // row  8 corner cover
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  9
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // row 10 lane dividers
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // row 11
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 12
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 13
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1], // row 14 corner cover
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 15
  [1,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,1], // row 16 centre cover pair
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1], // row 17
  [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1], // row 18 HVAC clusters
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 19
  [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1], // row 20 sentinel HVAC
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 21
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 22
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 23 south wall
];

// Flat rooftop — HMAP all zero
const HEIGHTMAP = Array.from({ length: 24 }, () => new Array(24).fill(0));

const rtFloor   = mm(0x7a8a8a, 0.95, 0.01);  // dark grey concrete
const rtWall    = mm(0xc0ccd8, 0.70, 0.35);  // light grey sheet metal
const rtWallD   = mm(0xa8b4c0, 0.75, 0.30);
const rtWallT   = mm(0xd8e4f0, 0.60, 0.45);
const rtTrim    = mm(0x6a7880, 0.85, 0.20);
const rtRubble  = mm(0x888888, 0.97, 0.00);

export const rooftopMapDef = {
  name: 'Rooftop District',
  style: 'rooftop',
  tiles: TILES,
  heightmap: HEIGHTMAP,
  width: 24,
  height: 24,
  H1,
  H2,
  spawnPlayer: { x: 11 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  sites: [
    // NW corner — behind the HVAC cluster at rows 4-5
    { id: 'A', x: 4 * CELL + CELL / 2, z: 3 * CELL + CELL / 2 },
    // SE corner — behind the HVAC cluster at rows 17-18
    { id: 'B', x: 18 * CELL + CELL / 2, z: 19 * CELL + CELL / 2 },
  ],
  spawnAttacker: { x: 21 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  spawnDefender: { x:  2 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 },
  fog: { color: 0xb8d0e8, density: 0.006 },
  skyColor: 0x87b8d8,
  wallHeight: 2.2,   // HVAC unit height — chest-level cover
  showRubble: false,
  materials: {
    floor:    rtFloor,
    wall:     rtWall,
    wallDark: rtWallD,
    wallTop:  rtWallT,
    crack:    rtTrim,
    trim:     rtTrim,
    ramp:     rtTrim,
  },
  buildExtras(scene, torchLights, ambientLight, sunLight) {
    // Boost to outdoor daylight
    ambientLight.color.setHex(0xb8d4e8);
    ambientLight.intensity = 1.2 * Math.PI;
    sunLight.intensity = 3.5 * Math.PI;
    sunLight.position.set(20, 80, 60);  // lower golden-hour angle

    // Rooftop LED work lights (cool blue, slight flicker)
    for (const [tc, tr] of [[5, 5], [18, 5], [5, 18], [18, 18], [11, 11]]) {
      const wl = new THREE.PointLight(0x88aaff, 0.7 * 4 * Math.PI, 16);
      wl.position.set(tc * CELL, 3.2, tr * CELL);
      wl.userData.base = 0.7 * 4 * Math.PI;
      wl.userData.ft = Math.random() * 100;
      scene.add(wl);
      torchLights.push(wl);
    }

    // ── Water tower (landmark near centre-north) ─────────────────────────
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.7, metalness: 0.4 });
    const legMat  = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.8, metalness: 0.6 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.8, 12), tankMat);
    tank.position.set(12 * CELL, 1.4 + 1.8, 4 * CELL);
    tank.castShadow = true;
    scene.add(tank);
    // Tripod legs
    for (const [lx, lz] of [[0.8, 0], [-0.4, 0.7], [-0.4, -0.7]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), legMat);
      leg.position.set(12 * CELL + lx, 0.9, 4 * CELL + lz);
      leg.rotation.z = lx * 0.38;
      scene.add(leg);
    }

    // ── Antenna mast at map centre ──────────────────────────────────────
    const antMat = new THREE.MeshStandardMaterial({ color: 0x606060, roughness: 0.6, metalness: 0.85 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 11, 6), antMat);
    mast.position.set(12 * CELL, 5.5, 12 * CELL);
    mast.castShadow = true;
    scene.add(mast);
    for (const yy of [3, 6, 8.5]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.07), antMat);
      bar.position.set(12 * CELL, yy, 12 * CELL);
      scene.add(bar);
    }

    // ── Neon sign — magenta on the north face ─────────────────────────
    const signMat  = new THREE.MeshBasicMaterial({ color: 0xff0077 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.75, 0.14), signMat);
    sign.position.set(6 * CELL, 3.4, 0.6 * CELL);
    scene.add(sign);
    const signLight = new THREE.PointLight(0xff0077, 0.5 * 4 * Math.PI, 12);
    signLight.position.set(6 * CELL, 3.8, 1.2 * CELL);
    scene.add(signLight);

    // ── Orange billboard on east face ────────────────────────────────
    const billMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const billboard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 5.5), billMat);
    billboard.position.set(22.6 * CELL, 2.6, 12 * CELL);
    scene.add(billboard);
    const billLight = new THREE.PointLight(0xff6600, 0.45 * 4 * Math.PI, 10);
    billLight.position.set(22 * CELL, 2.6, 12 * CELL);
    scene.add(billLight);

    // ── Low parapet railing around map perimeter (visual only) ────────
    const parMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.8, metalness: 0.3 });
    const parH = 0.45, parW = 0.2;
    const mapSize = 24 * CELL;
    // North + south rails
    for (const zz of [0.5, mapSize - 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(mapSize, parH, parW), parMat);
      rail.position.set(mapSize / 2, parH / 2, zz);
      scene.add(rail);
    }
    // East + west rails
    for (const xx of [0.5, mapSize - 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(parW, parH, mapSize), parMat);
      rail.position.set(xx, parH / 2, mapSize / 2);
      scene.add(rail);
    }

    // ── Scatter some AC duct boxes as extra rooftop dressing ─────────
    const ductMat = new THREE.MeshStandardMaterial({ color: 0xaab0b8, roughness: 0.75, metalness: 0.4 });
    const ductPos = [
      [8,  2, 1.8, 0.9, 1.4],
      [15, 2, 2.2, 1.0, 1.2],
      [8, 21, 1.8, 0.9, 1.4],
      [15,21, 2.2, 1.0, 1.2],
      [11, 7, 1.2, 0.6, 0.8],
      [12,16, 1.4, 0.7, 0.9],
    ];
    for (const [dc, dr, dw, dh, dd] of ductPos) {
      const duct = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), ductMat);
      duct.position.set(dc * CELL, dh / 2, dr * CELL);
      duct.castShadow = true;
      scene.add(duct);
    }

    void rtRubble; // referenced to avoid unused-import lint warning
  },
};
