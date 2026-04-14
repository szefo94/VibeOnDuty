/**
 * touch.js — unified multi-touch dispatcher
 *
 * A single document-level touchstart/move/end handler routes every touch
 * by ID to the correct role (joystick | look | button).  This guarantees
 * that fire + look, or any other combination, work simultaneously.
 *
 * Exports
 *   touchLook      — { dx, dy } pixel deltas consumed each frame by loop.js
 *   isTouchDevice  — true when running on a touch screen
 *   initTouch      — call once from main.js after DOM ready
 */

import { keys, gameRunning } from './input.js';
import { player, startReload } from './entities/player.js';
import { tryThrowGrenade } from './entities/grenades.js';

export const touchLook    = { dx: 0, dy: 0 };
export const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

const JOY_RADIUS = 62;   // px — max thumb travel
const JOY_FRAC   = 0.45; // left 45 % of screen = joystick zone

// Per-touch role tracking
const touchRoles = new Map(); // identifier → { type:'joy'|'look'|'btn', el? }

let joyTouchId = null, joyBaseX = 0, joyBaseY = 0;
let lookTouchId = null, lookLastX = 0, lookLastY = 0;

export function initTouch() {
  if (!isTouchDevice) return;
  document.getElementById('touch-ui').style.display = 'block';

  const joyZone  = document.getElementById('joy-zone');
  const joyBase  = document.getElementById('joy-base');
  const joyThumb = document.getElementById('joy-thumb');
  const adsBtn   = document.getElementById('tb-ads');

  // ── Joystick helpers ────────────────────────────────────────────────────────
  function startJoy(t) {
    joyTouchId = t.identifier;
    const r = joyZone.getBoundingClientRect();
    joyBaseX = t.clientX - r.left;
    joyBaseY = t.clientY - r.top;
    joyBase.style.opacity = joyThumb.style.opacity = '1';
    joyBase.style.left  = (joyBaseX - JOY_RADIUS) + 'px';
    joyBase.style.top   = (joyBaseY - JOY_RADIUS) + 'px';
    joyThumb.style.left = (joyBaseX - 26) + 'px';
    joyThumb.style.top  = (joyBaseY - 26) + 'px';
  }

  function moveJoy(t) {
    const r  = joyZone.getBoundingClientRect();
    const dx = t.clientX - r.left - joyBaseX;
    const dy = t.clientY - r.top  - joyBaseY;
    const dist  = Math.hypot(dx, dy);
    const clamp = Math.min(dist, JOY_RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    joyThumb.style.left = (joyBaseX + nx * clamp - 26) + 'px';
    joyThumb.style.top  = (joyBaseY + ny * clamp - 26) + 'px';
    const ndx = nx * (clamp / JOY_RADIUS);
    const ndz = ny * (clamp / JOY_RADIUS);
    const T = 0.25;
    keys['KeyW']     = ndz < -T;
    keys['KeyS']     = ndz >  T;
    keys['KeyA']     = ndx < -T;
    keys['KeyD']     = ndx >  T;
    keys['ShiftLeft'] = Math.hypot(ndx, ndz) > 0.82; // full tilt = sprint
  }

  function endJoy() {
    joyTouchId = null;
    joyBase.style.opacity = joyThumb.style.opacity = '0';
    keys['KeyW'] = keys['KeyS'] = keys['KeyA'] = keys['KeyD'] = keys['ShiftLeft'] = false;
  }

  // ── Button helpers ──────────────────────────────────────────────────────────
  function handleBtnDown(el) {
    switch (el.id) {
      case 'tb-fire':   keys['TouchFire'] = true;  break;
      case 'tb-jump':   keys['Space']     = true;  break;
      case 'tb-crouch': keys['ControlLeft'] = true; break;
      case 'tb-dive':   keys['KeyZ']      = true;  break;
      case 'tb-reload': startReload(); break;
      case 'tb-nade':   tryThrowGrenade(); break;
      case 'tb-ads':
        player.aiming = !player.aiming;
        adsBtn.style.background  = player.aiming ? 'rgba(232,200,74,0.35)' : 'rgba(0,0,0,0.45)';
        adsBtn.style.borderColor = player.aiming ? 'rgba(232,200,74,0.7)'  : 'rgba(255,255,255,0.22)';
        break;
    }
  }

  function handleBtnUp(el) {
    switch (el.id) {
      case 'tb-fire':   keys['TouchFire']  = false; break;
      case 'tb-jump':   keys['Space']      = false; break;
      case 'tb-crouch': keys['ControlLeft'] = false; break;
      case 'tb-dive':   keys['KeyZ']       = false; break;
    }
  }

  // ── Document-level dispatcher ───────────────────────────────────────────────
  // One handler for all touches — each touch gets an explicit role by ID.
  // This is the only reliable way to handle fire + look (or any combination)
  // at the same time on mobile.

  document.addEventListener('touchstart', e => {
    // While the overlay is up, let taps reach the start button normally.
    if (!gameRunning) return;
    // preventDefault blocks scroll/zoom AND stops the browser from generating
    // synthetic mousedown/mouseup events (which would double-fire shoot logic).
    e.preventDefault();

    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);

      // ① Button ─────────────────────────────────────────────────────
      if (el?.classList.contains('tb')) {
        touchRoles.set(t.identifier, { type: 'btn', el });
        handleBtnDown(el);
        continue;
      }

      // ② Left zone → joystick ───────────────────────────────────────
      if (t.clientX < window.innerWidth * JOY_FRAC) {
        if (joyTouchId === null) {
          touchRoles.set(t.identifier, { type: 'joy' });
          startJoy(t);
        }
        continue;
      }

      // ③ Right zone → look ──────────────────────────────────────────
      if (lookTouchId === null) {
        lookTouchId = t.identifier;
        lookLastX   = t.clientX;
        lookLastY   = t.clientY;
        touchRoles.set(t.identifier, { type: 'look' });
      }
    }
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (!gameRunning) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const role = touchRoles.get(t.identifier);
      if (!role) continue;
      if (role.type === 'joy') {
        moveJoy(t);
      } else if (role.type === 'look') {
        touchLook.dx += t.clientX - lookLastX;
        touchLook.dy += t.clientY - lookLastY;
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
  }, { passive: false });

  const onEnd = e => {
    if (!gameRunning) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const role = touchRoles.get(t.identifier);
      if (!role) continue;
      if (role.type === 'joy')  endJoy();
      if (role.type === 'look') lookTouchId = null;
      if (role.type === 'btn')  handleBtnUp(role.el);
      touchRoles.delete(t.identifier);
    }
  };
  document.addEventListener('touchend',    onEnd, { passive: false });
  document.addEventListener('touchcancel', onEnd, { passive: false });
}
