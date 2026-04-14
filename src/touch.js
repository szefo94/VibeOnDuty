/**
 * touch.js — virtual joystick + look swipe + action buttons
 *
 * Layout
 *   Left 45 % of screen  → joystick zone (movement)
 *   Right 55 % of screen → look swipe zone (camera)
 *   Buttons overlaid on look zone (stopPropagation so they don't start a look swipe)
 *
 * Exports
 *   touchLook   — { dx, dy } accumulated pixel deltas, consumed + reset by loop.js each frame
 *   isTouchDevice — whether current device has touch input
 *   initTouch   — call once from main.js after DOM ready
 */

import { keys } from './input.js';
import { player, startReload } from './entities/player.js';
import { tryThrowGrenade } from './entities/grenades.js';

export const touchLook = { dx: 0, dy: 0 };
export const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

const JOY_RADIUS = 62; // px — how far the thumb can travel

let joyId   = null;
let joyBaseX = 0, joyBaseY = 0;

let lookId    = null;
let lookLastX = 0, lookLastY = 0;

export function initTouch() {
  if (!isTouchDevice) return;
  document.getElementById('touch-ui').style.display = 'block';

  const joyZone  = document.getElementById('joy-zone');
  const lookZone = document.getElementById('look-zone');
  const joyBase  = document.getElementById('joy-base');
  const joyThumb = document.getElementById('joy-thumb');

  // ── Joystick ────────────────────────────────────────────────────────────────
  joyZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (joyId !== null) return; // one finger only
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const r = joyZone.getBoundingClientRect();
    joyBaseX = t.clientX - r.left;
    joyBaseY = t.clientY - r.top;
    joyBase.style.opacity  = '1';
    joyThumb.style.opacity = '1';
    joyBase.style.left  = (joyBaseX - JOY_RADIUS) + 'px';
    joyBase.style.top   = (joyBaseY - JOY_RADIUS) + 'px';
    joyThumb.style.left = (joyBaseX - 26) + 'px';
    joyThumb.style.top  = (joyBaseY - 26) + 'px';
  }, { passive: false });

  joyZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const r  = joyZone.getBoundingClientRect();
      const dx = t.clientX - r.left - joyBaseX;
      const dy = t.clientY - r.top  - joyBaseY;
      const dist  = Math.hypot(dx, dy);
      const clamp = Math.min(dist, JOY_RADIUS);
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;
      joyThumb.style.left = (joyBaseX + nx * clamp - 26) + 'px';
      joyThumb.style.top  = (joyBaseY + ny * clamp - 26) + 'px';

      const ndx = nx * (clamp / JOY_RADIUS); // -1..1 normalised
      const ndz = ny * (clamp / JOY_RADIUS);
      const T = 0.25; // dead-zone threshold
      keys['KeyW']    = ndz < -T;
      keys['KeyS']    = ndz >  T;
      keys['KeyA']    = ndx < -T;
      keys['KeyD']    = ndx >  T;
      keys['ShiftLeft'] = Math.hypot(ndx, ndz) > 0.82; // full tilt = sprint
    }
  }, { passive: false });

  const joyEnd = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      joyBase.style.opacity  = '0';
      joyThumb.style.opacity = '0';
      keys['KeyW'] = keys['KeyS'] = keys['KeyA'] = keys['KeyD'] = keys['ShiftLeft'] = false;
    }
  };
  joyZone.addEventListener('touchend',    joyEnd, { passive: false });
  joyZone.addEventListener('touchcancel', joyEnd, { passive: false });

  // ── Look swipe ──────────────────────────────────────────────────────────────
  lookZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (lookId !== null) continue;
      lookId    = t.identifier;
      lookLastX = t.clientX;
      lookLastY = t.clientY;
    }
  }, { passive: false });

  lookZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      touchLook.dx += t.clientX - lookLastX;
      touchLook.dy += t.clientY - lookLastY;
      lookLastX = t.clientX;
      lookLastY = t.clientY;
    }
  }, { passive: false });

  const lookEnd = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookZone.addEventListener('touchend',    lookEnd, { passive: false });
  lookZone.addEventListener('touchcancel', lookEnd, { passive: false });

  // ── Action buttons ──────────────────────────────────────────────────────────
  // stopPropagation prevents button touches from triggering the look swipe
  function btn(id, down, up) {
    const el = document.getElementById(id);
    if (!el) return;
    const stop = e => { e.stopPropagation(); e.preventDefault(); };
    el.addEventListener('touchstart', e => { stop(e); down?.(); }, { passive: false });
    el.addEventListener('touchend',    e => { stop(e); up?.();   }, { passive: false });
    el.addEventListener('touchcancel', e => { stop(e); up?.();   }, { passive: false });
  }

  // FIRE — held
  btn('tb-fire',
    () => { keys['TouchFire'] = true;  },
    () => { keys['TouchFire'] = false; }
  );
  // JUMP — Space
  btn('tb-jump',
    () => { keys['Space'] = true;  },
    () => { keys['Space'] = false; }
  );
  // CROUCH — hold ControlLeft
  btn('tb-crouch',
    () => { keys['ControlLeft'] = true;  },
    () => { keys['ControlLeft'] = false; }
  );
  // ADS — hold (mirrors RMB)
  btn('tb-ads',
    () => { player.aiming = true;  },
    () => { player.aiming = false; }
  );
  // RELOAD
  btn('tb-reload', () => startReload());
  // GRENADE
  btn('tb-nade',   () => tryThrowGrenade());
  // DIVE
  btn('tb-dive',
    () => { keys['KeyZ'] = true;  },
    () => { keys['KeyZ'] = false; }
  );
}
