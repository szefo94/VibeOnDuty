import * as THREE from 'three';
import { wallMeshes } from '../level.js';

const _r  = new THREE.Raycaster();
const _v  = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function hasLOS(ax, ay, az, bx, by, bz) {
  _v.set(ax, ay, az);
  _v2.set(bx - ax, by - ay, bz - az);
  const d = _v2.length();
  _v2.normalize();
  _r.set(_v, _v2);
  _r.far = d - 0.14;
  return _r.intersectObjects(wallMeshes, false).length === 0;
}
