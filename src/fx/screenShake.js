import { renderer } from '../scene.js';

let _t = 0, _intensity = 0;

export function triggerScreenShake(intensity = 1.0) {
  _t = 0.14;
  if (intensity > _intensity) _intensity = intensity;
}

export function tickScreenShake(dt) {
  if (_t <= 0) return;
  _t = Math.max(0, _t - dt);
  const mag = _intensity * (_t / 0.14) * 7;
  renderer.domElement.style.transform =
    `translate(${(Math.random() - 0.5) * mag}px,${(Math.random() - 0.5) * mag}px)`;
  if (_t <= 0) { renderer.domElement.style.transform = ''; _intensity = 0; }
}
