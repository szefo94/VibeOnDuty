import * as THREE from 'three';
import { scene } from '../scene.js';
import { CELL } from '../config.js';

export const rangeTargets = [];

const DOWN_Y  = -1.9;
const UP_Y    =  0;
const POP_DUR  = 0.13;
const DROP_DUR = 0.10;

// Range map is 14 tiles wide; interior runs from 1.5 tiles to 12.5 tiles
const H_MIN    = CELL * 1.5;
const H_MAX    = 14 * CELL - CELL * 1.5;
const H_CENTER = (H_MIN + H_MAX) / 2;
const H_HALF   = (H_MAX - H_MIN) / 2;

// Sine speeds: Hz per speed index (slow / medium / fast)
const H_SINE_FREQS = [0.04, 0.10, 0.22];

// Spring configs per speed index
const H_SPRING = [
  { k: 1.2, damp: 3.5, maxV:  4, intMin: 3.5, intMax: 6.0 }, // slow
  { k: 3.0, damp: 4.0, maxV:  8, intMin: 1.5, intMax: 3.0 }, // medium
  { k: 6.5, damp: 3.0, maxV: 16, intMin: 0.4, intMax: 1.5 }, // fast
];

const MOVE_V_AMP  = 0.55;
const MOVE_V_FREQ = 0.65;

let _moveH = false, _moveV = false;
let _moveHMode  = 'sine';  // 'sine' | 'spring'
let _moveHSpeed = 0;       // 0=slow 1=medium 2=fast

export function setTargetMoveMode({ h, v, hMode = 'sine', hSpeed = 0 }) {
  const modeChange = h && hMode !== _moveHMode;
  if ((!h && _moveH) || modeChange) {
    for (const t of rangeTargets) {
      t.group.position.x = modeChange ? t.group.position.x : t.x;
      t.springX  = t.group.position.x;
      t.springVX = 0;
      t.springT  = t.id * 0.5;
    }
  }
  if (!v && _moveV) for (const t of rangeTargets) if (t.state === 'up') t.group.position.y = 0;
  _moveH = !!h; _moveV = !!v; _moveHMode = hMode; _moveHSpeed = hSpeed;
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
      moveT:      def.id * 1.1,
      springX:    def.x,
      springVX:   0,
      springGoalX: def.x,
      springT:    def.id * 0.5,
      active:     false,
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
      if (_moveH) {
        if (_moveHMode === 'spring') {
          const cfg = H_SPRING[_moveHSpeed] ?? H_SPRING[0];
          t.springT -= dt;
          if (t.springT <= 0) {
            t.springGoalX = H_CENTER + (Math.random() * 2 - 1) * H_HALF * 0.85;
            t.springT = cfg.intMin + Math.random() * (cfg.intMax - cfg.intMin);
          }
          t.springVX += (t.springGoalX - t.springX) * cfg.k * dt;
          t.springVX *= 1 - cfg.damp * dt;
          t.springVX = Math.max(-cfg.maxV, Math.min(cfg.maxV, t.springVX));
          t.springX = Math.max(H_MIN, Math.min(H_MAX, t.springX + t.springVX * dt));
          t.group.position.x = t.springX;
        } else {
          t.group.position.x = H_CENTER + Math.sin(t.moveT * H_SINE_FREQS[_moveHSpeed] * Math.PI * 2) * H_HALF;
        }
      }
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
