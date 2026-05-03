import * as THREE from 'three';
import { scene } from '../scene.js';
import { CELL } from '../config.js';

export const rangeTargets = [];

const DOWN_Y  = -1.9;
const UP_Y    =  0;
const POP_DUR  = 0.13;
const DROP_DUR = 0.10;

// Range map is 14 tiles wide; interior runs from 1.5 tiles to 12.5 tiles
const H_MIN    = CELL * 1.5;           // ≈ 6 m
const H_MAX    = 14 * CELL - CELL * 1.5; // ≈ 50 m
const H_CENTER = (H_MIN + H_MAX) / 2;  // 28 m — map centre
const H_HALF   = (H_MAX - H_MIN) / 2;  // 22 m
const MOVE_H_FREQ = 0.18;  // Hz — one full crossing every ~5.5 s
const MOVE_V_AMP  = 0.55;  // vertical bob height (m)
const MOVE_V_FREQ = 0.65;  // Hz

let _moveH = false, _moveV = false;
export function setTargetMoveMode({ h, v }) {
  if (!h && _moveH) for (const t of rangeTargets) t.group.position.x = t.x;
  if (!v && _moveV) for (const t of rangeTargets) if (t.state === 'up') t.group.position.y = 0;
  _moveH = !!h;
  _moveV = !!v;
}

// Materials (cloned per target so each can flash independently)
const _mkBodyHostile  = () => new THREE.MeshStandardMaterial({ color: 0xaa2200, roughness: 0.55, metalness: 0.1 });
const _mkHeadHostile  = () => new THREE.MeshStandardMaterial({ color: 0xff1100, roughness: 0.4,  metalness: 0.1, emissive: 0xff1100, emissiveIntensity: 0.3 });
const _mkBodyHostage  = () => new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.55, metalness: 0.1 });
const _mkHeadHostage  = () => new THREE.MeshStandardMaterial({ color: 0x00dd44, roughness: 0.4,  metalness: 0.1, emissive: 0x00dd44, emissiveIntensity: 0.3 });
const _mkActive       = () => new THREE.MeshStandardMaterial({ color: 0xff1100, roughness: 0.55, metalness: 0.1, emissive: 0xff1100, emissiveIntensity: 0.7 });
const _mkFlash        = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5,  emissive: 0xffffff, emissiveIntensity: 2.0 });
const _mkFlashPenalty = () => new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.5,  emissive: 0xff2200, emissiveIntensity: 2.5 });

export function spawnRangeTargets(defs) {
  rangeTargets.length = 0;
  for (const def of defs) {
    const group    = new THREE.Group();
    const hostile  = def.type !== 'hostage';
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.22), hostile ? _mkBodyHostile() : _mkBodyHostage());
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),   hostile ? _mkHeadHostile() : _mkHeadHostage());
    bodyMesh.position.set(0, 0.85, 0);
    headMesh.position.set(0, 1.58, 0);
    bodyMesh.castShadow = headMesh.castShadow = true;
    group.add(bodyMesh, headMesh);
    group.position.set(def.x, DOWN_Y, def.z);
    scene.add(group);

    const t = {
      id:      def.id,
      x:       def.x,
      z:       def.z,
      zone:     def.zone,
      type:     def.type ?? 'hostile',
      state:    'down',  // 'down' | 'popping' | 'up' | 'dropping'
      popT:     0,
      flashT:   0,
      moveT:    def.id * 1.1,  // phase offset per target so they don't sync
      active:   false,
      disabled: false,
      group,
      bodyMesh,
      headMesh,
      _baseMat: { body: bodyMesh.material, head: headMesh.material },
      onHit:   null,    // (target, isHead) → set by range mode
    };
    rangeTargets.push(t);
  }
}

export function clearRangeTargets() {
  for (const t of rangeTargets) scene.remove(t.group);
  rangeTargets.length = 0;
}

export function popUpTarget(t) {
  if (t.state === 'up' || t.state === 'popping') return;
  t.state = 'popping';
  t.popT  = 0;
}

export function dropTarget(t) {
  if (t.state === 'down' || t.state === 'dropping') return;
  t.state  = 'dropping';
  t.popT   = 0;
  t.active = false;
  t.group.position.x = t.x;
  t.group.position.z = t.z;
  _restoreMats(t);
}

export function setTargetActive(t, on) {
  t.active = on;
  if (!on) _restoreMats(t);
  else {
    const a = _mkActive();
    t.bodyMesh.material = a;
    t.headMesh.material = a;
  }
}

export function registerHit(t, isHead) {
  if (t.state !== 'up') return false;
  t.flashT = 0.28;
  const f = t.type === 'hostage' ? _mkFlashPenalty() : _mkFlash();
  t.bodyMesh.material = f;
  t.headMesh.material = f;
  if (t.onHit) t.onHit(t, isHead);
  return true;
}

export function tickDummies(dt) {
  for (const t of rangeTargets) {
    // Hit flash decay
    if (t.flashT > 0) {
      t.flashT -= dt;
      if (t.flashT <= 0) { t.flashT = 0; _restoreMats(t); }
    }
    // Pop / drop animation
    if (t.state === 'popping') {
      t.popT = Math.min(1, t.popT + dt / POP_DUR);
      t.group.position.y = DOWN_Y + (UP_Y - DOWN_Y) * _easeOut(t.popT);
      if (t.popT >= 1) { t.group.position.y = UP_Y; t.state = 'up'; }
    } else if (t.state === 'dropping') {
      t.popT = Math.min(1, t.popT + dt / DROP_DUR);
      t.group.position.y = UP_Y + (DOWN_Y - UP_Y) * _easeIn(t.popT);
      if (t.popT >= 1) { t.group.position.y = DOWN_Y; t.state = 'down'; }
    }

    // Movement while up
    if (t.state === 'up' && (_moveH || _moveV)) {
      t.moveT += dt;
      if (_moveH) t.group.position.x = H_CENTER + Math.sin(t.moveT * MOVE_H_FREQ * Math.PI * 2) * H_HALF;
      if (_moveV) t.group.position.y = UP_Y + (Math.sin(t.moveT * MOVE_V_FREQ * Math.PI * 2) * 0.5 + 0.5) * MOVE_V_AMP;
    }
  }
}

function _restoreMats(t) {
  if (t.active) return; // active overrides base
  t.bodyMesh.material = t._baseMat.body;
  t.headMesh.material = t._baseMat.head;
}

const _easeOut = (t) => 1 - (1 - t) * (1 - t);
const _easeIn  = (t) => t * t;
