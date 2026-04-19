import * as THREE from 'three';
import { scene } from '../scene.js';
import { groundElevation } from '../map.js';
import { PUNCH_RANGE } from '../config.js';

const _geo = new THREE.RingGeometry(PUNCH_RANGE - 0.18, PUNCH_RANGE, 40);
_geo.rotateX(-Math.PI / 2);
const _mat = new THREE.MeshBasicMaterial({
  color: 0xff3322,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const ring = new THREE.Mesh(_geo, _mat);
ring.renderOrder = 1;
scene.add(ring);

let _fadeTimer = 0;
const FADE_IN = 0.08;
const FADE_OUT = 0.35;
const PEAK_OPACITY = 0.45;

export function flashMeleeRing(x, z) {
  ring.position.set(x, groundElevation(x, z) + 0.02, z);
  _fadeTimer = FADE_IN + FADE_OUT;
}

export function tickMeleeRing(dt, x, z) {
  if (_fadeTimer <= 0) { _mat.opacity = 0; return; }
  _fadeTimer -= dt;
  ring.position.set(x, groundElevation(x, z) + 0.02, z);
  if (_fadeTimer > FADE_OUT) {
    _mat.opacity = PEAK_OPACITY * (1 - (_fadeTimer - FADE_OUT) / FADE_IN);
  } else {
    _mat.opacity = PEAK_OPACITY * (_fadeTimer / FADE_OUT);
  }
}
