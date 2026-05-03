import * as THREE from 'three';
import { scene } from '../scene.js';

export const rangeTargets = [];

const DOWN_Y  = -1.9;
const UP_Y    =  0;
const POP_DUR  = 0.13;
const DROP_DUR = 0.10;

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
      zone:    def.zone,
      type:    def.type ?? 'hostile',
      state:   'down',  // 'down' | 'popping' | 'up' | 'dropping'
      popT:    0,
      flashT:  0,
      active:  false,
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
  }
}

function _restoreMats(t) {
  if (t.active) return; // active overrides base
  t.bodyMesh.material = t._baseMat.body;
  t.headMesh.material = t._baseMat.head;
}

const _easeOut = (t) => 1 - (1 - t) * (1 - t);
const _easeIn  = (t) => t * t;
