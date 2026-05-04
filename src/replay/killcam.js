import { camera } from '../scene.js';

let _active = false;
let _target  = null;
let _timer   = 0;
let _onDone  = null;

const DURATION   = 2.8;
const KC_BACK    = 2.8;
const KC_HEIGHT  = 1.4;

export function startKillcam(killer, onDone) {
  if (_active) return;
  _active = true;
  _target = killer;
  _timer  = DURATION;
  _onDone = onDone;
  _showUI();
}

export function tickKillcam(dt) {
  if (!_active) return;
  _timer -= dt;
  if (_target && !_target.dead) {
    const tx  = _target.x;
    const tz  = _target.z;
    const ty  = _target.mesh?.position.y ?? 0;
    const yaw = _target.facingY ?? 0;
    camera.position.set(
      tx + Math.sin(yaw) * KC_BACK,
      ty + KC_HEIGHT,
      tz + Math.cos(yaw) * KC_BACK,
    );
    camera.lookAt(tx, ty + 0.9, tz);
  }
  if (_timer <= 0) _finish();
}

export function isKillcamActive() { return _active; }

export function stopKillcam() {
  if (!_active) return;
  _finish();
}

function _finish() {
  _active = false;
  _hideUI();
  const cb = _onDone;
  _onDone = null;
  if (cb) cb();
}

function _showUI() {
  let el = document.getElementById('killcam-wrap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'killcam-wrap';
    el.innerHTML = '<span id="kc-label">KILLCAM</span><button id="kc-skip">[K] SKIP</button>';
    document.body.appendChild(el);
    document.getElementById('kc-skip')?.addEventListener('click', stopKillcam);
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyK' && _active) stopKillcam(); });
  }
  el.style.display = 'flex';
}

function _hideUI() {
  const el = document.getElementById('killcam-wrap');
  if (el) el.style.display = 'none';
}
