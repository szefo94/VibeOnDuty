import * as THREE from 'three';
import { CELL } from '../config.js';
import { bunkerData } from '../shared/maps/bunker.js';
export { H1, H2 } from '../shared/maps/bunker.js';
import { mm, matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp } from '../materials.js';
import { illustratedClone } from '../artMaterials.js';


void mm;

export const bunkerMapDef = {
  ...bunkerData,
  name: 'Greek Columns',
  sites: [
    { id: 'A', x: 8 * CELL + CELL / 2, z:  7 * CELL + CELL / 2 },
    { id: 'B', x: 8 * CELL + CELL / 2, z: 17 * CELL + CELL / 2 },
  ],
  fog: { color: 0xc8b89a, density: 0.016 },
  skyColor: 0x7ca8c8,
  showRubble: true,
  materials: {
    floor:    illustratedClone(matFloor, 'stoneFloor'),
    wall:     illustratedClone(matWall, 'stoneWall', { contour: true }),
    wallDark: illustratedClone(matWallD, 'stoneWall', { contour: true }),
    wallTop:  illustratedClone(matWallT, 'stoneWall', { contour: true }),
    crack:    illustratedClone(matCrack, 'stoneWall'),
    trim:     illustratedClone(matTrim, 'stoneWall', { contour: true }),
    ramp:     illustratedClone(matRamp, 'stoneFloor'),
  },
  buildExtras(scene, torchLights) {
    [
      [3,4],[11,3],[20,4],[5,11],
      [18,11],[3,19],[11,20],[20,20],[11,12],
    ].forEach(([tc, tr]) => {
      const tl = new THREE.PointLight(0xff8822, 1.8 * 4 * Math.PI, 12);
      tl.position.set(tc * CELL, 2.2, tr * CELL);
      tl.userData.base = 1.8 * 4 * Math.PI;
      tl.userData.ft = Math.random() * 100;
      scene.add(tl);
      torchLights.push(tl);
    });
  },
};
