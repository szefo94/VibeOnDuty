import * as THREE from 'three';
import { hudCanvas, hudCtx, camera } from '../scene.js';
import { drawRings } from './rings.js';
import { drawEnemyOverlays } from './enemyBars.js';

const _prj = new THREE.Vector3();

export function w2s(wx, wy, wz) {
  _prj.set(wx, wy, wz).project(camera);
  if (_prj.z > 1) return null;
  return { x: (_prj.x * 0.5 + 0.5) * hudCanvas.width, y: (-0.5 * _prj.y + 0.5) * hudCanvas.height };
}

const _animDebugEl = document.getElementById('anim-debug');
const _animHistory = ['—', '—', '—'];
let _lastAnimName = '';
let _frameMs = 0;

export function setDebugFrameMs(ms) { _frameMs = ms; }

export function setDebugAnimClip(name) {
  if (!_animDebugEl) return;
  if (name !== _lastAnimName) {
    _animHistory.unshift(name);
    _animHistory.length = 3;
    _lastAnimName = name;
  }
  _animDebugEl.innerHTML = _animHistory.map((n, i) =>
    `<span style="opacity:${1 - i * 0.3}">${i === 0 ? '▶' : '·'} ${n}</span>`
  ).join('<br>') + `<br><span style="color:#ff0">⏱ ${_frameMs.toFixed(1)}ms</span>`;
  _animDebugEl.style.display = 'block';
}

export function drawHUD() {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  drawRings();
  drawEnemyOverlays();
}
