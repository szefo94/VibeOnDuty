import { camera } from '../scene.js';
import * as THREE from 'three';

const _v = new THREE.Vector3();

export function spawnDamageNumber(wx, wy, wz, amount, isPlayerDmg = false) {
  _v.set(wx, wy, wz).project(camera);
  if (_v.z > 1) return; // behind camera

  const cx = ((_v.x + 1) / 2) * window.innerWidth;
  const cy = ((-_v.y + 1) / 2) * window.innerHeight;

  const div = document.createElement('div');
  div.className = isPlayerDmg ? 'dmg-num dmg-num-p' : 'dmg-num';
  div.textContent = `-${amount}`;
  const jitter = (Math.random() - 0.5) * 36;
  div.style.left = `${cx + jitter}px`;
  div.style.top  = `${cy}px`;
  document.body.appendChild(div);

  let t = 0;
  const DURATION = 0.85;
  function step() {
    t += 0.016;
    div.style.transform = `translateX(-50%) translateY(${-t * 56}px)`;
    div.style.opacity   = Math.max(0, 1 - t / DURATION).toFixed(2);
    if (t < DURATION) requestAnimationFrame(step);
    else div.remove();
  }
  requestAnimationFrame(step);
}
