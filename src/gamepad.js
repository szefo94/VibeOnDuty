/**
 * gamepad.js — Standard Gamepad API integration.
 * Call tickGamepad(dt) each frame from loop.js.
 *
 * Mapping (Standard Gamepad — Xbox / PS layout):
 *   Left stick       → move (WASD + sprint at full tilt)
 *   Right stick      → look (feeds touchLook, same path as touch controls)
 *   A / Cross        → jump
 *   B / Circle       → crouch
 *   X / Square       → reload
 *   Y / Triangle     → dive
 *   LB               → lean left
 *   RB               → lean right
 *   LT               → ADS (hold)
 *   RT               → shoot
 *   d-pad up         → grenade
 */

import { keys } from './input.js';
import { touchLook } from './touch.js';
import { player } from './entities/player.js';
import { tryThrowGrenade } from './entities/grenades.js';

const DEADZONE   = 0.14;
const LOOK_SENS  = 4.2;   // virtual px per normalised axis unit per 60fps frame

function _dead(v) { return Math.abs(v) < DEADZONE ? 0 : v; }

let _nadeCooldown = false;

export function tickGamepad(dt) {
  const pads = navigator.getGamepads?.();
  if (!pads) return;
  const gp = Array.from(pads).find(p => p?.connected);
  if (!gp) return;

  const lx = _dead(gp.axes[0] ?? 0);
  const ly = _dead(gp.axes[1] ?? 0);
  const rx = _dead(gp.axes[2] ?? 0);
  const ry = _dead(gp.axes[3] ?? 0);
  const b  = gp.buttons;

  const stickMag = Math.hypot(lx, ly);
  const gpActive = stickMag > 0 || Math.abs(rx) > 0 || Math.abs(ry) > 0
    || Array.from(b).some(btn => btn.pressed);

  if (!gpActive) return; // keyboard/mouse in use — don't interfere

  // ── Movement (left stick) ──────────────────────────────────────────────
  if (stickMag > 0) {
    keys['KeyW']     = ly < -DEADZONE;
    keys['KeyS']     = ly >  DEADZONE;
    keys['KeyA']     = lx < -DEADZONE;
    keys['KeyD']     = lx >  DEADZONE;
    keys['ShiftLeft'] = stickMag > 0.82;
  }

  // ── Look (right stick → touchLook, consumed by loop.js) ───────────────
  touchLook.dx += rx * LOOK_SENS * (dt * 60);
  touchLook.dy += ry * LOOK_SENS * (dt * 60);

  // ── Buttons ───────────────────────────────────────────────────────────
  keys['Space']        = b[0]?.pressed ?? false; // A / Cross  → jump
  keys['ControlLeft']  = b[1]?.pressed ?? false; // B / Circle → crouch
  keys['KeyR']         = b[2]?.pressed ?? false; // X / Square → reload
  keys['KeyZ']         = b[3]?.pressed ?? false; // Y / Tri    → dive
  keys['KeyQ']         = b[4]?.pressed ?? false; // LB         → lean left
  keys['KeyE']         = b[5]?.pressed ?? false; // RB         → lean right
  player.aiming        = b[6]?.pressed ?? false; // LT         → ADS
  keys['TouchFire']    = b[7]?.pressed ?? false; // RT         → shoot

  // Grenade — d-pad up (button 12) with single-shot guard
  if (b[12]?.pressed && !_nadeCooldown) {
    tryThrowGrenade();
    _nadeCooldown = true;
  } else if (!b[12]?.pressed) {
    _nadeCooldown = false;
  }
}
