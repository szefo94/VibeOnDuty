// @ts-check
import { PLAYER_H, PLAYER_H_CROUCH, MOVE_SPEED, SPRINT_MULT, GRAVITY, JUMP_FORCE } from '../config.js';

// Exact existing player.js crouched walk expression; no online balance change.
export const CROUCH_SPEED = MOVE_SPEED * 0.72;
/** @typedef {{x:number,y:number,z:number,alive:boolean,yaw:number,pitch:number,crouching:boolean,onGround:boolean,verticalVelocity:number,moving:boolean,aiming:boolean,sprinting:boolean,airVelX:number,airVelZ:number,jumpHeld:boolean}} MovementBody */
/** @typedef {{moveX:number,moveZ:number,yaw:number,pitch:number,sprint:boolean,jump:boolean,crouch:boolean,aiming:boolean}} Intent */
/** @typedef {{groundElevation:(x:number,z:number,refY:number)=>number,canOccupy:(body:{x:number,y:number,z:number},height?:number,allowStep?:boolean)=>boolean}} MovementWorld */
/** The body stores simulation eye Y. Floor queries receive a standing-equivalent
 * eye reference so changing stance never changes the selected floor.
 * @param {MovementBody} body @param {Intent|null} intent @param {MovementWorld} world @param {number} dtSeconds */
export function stepMovement(body, intent, world, dtSeconds) {
  if (!body.alive || !Number.isFinite(dtSeconds) || dtSeconds <= 0 || dtSeconds > 0.1) return;
  const oldX = body.x, oldZ = body.z;
  let height = body.crouching ? PLAYER_H_CROUCH : PLAYER_H;
  const feet = body.y - height;
  if (intent) {
    body.yaw = intent.yaw;
    body.pitch = intent.pitch;
  }
  const wantCrouch = !!intent?.crouch;
  if (wantCrouch !== body.crouching) {
    const nextHeight = wantCrouch ? PLAYER_H_CROUCH : PLAYER_H;
    const next = { x: body.x, y: feet + nextHeight, z: body.z };
    if (world.canOccupy(next, nextHeight, false)) {
      body.crouching = wantCrouch;
      height = nextHeight;
      body.y = next.y;
    }
  }
  body.aiming = !!intent?.aiming;
  body.sprinting = !!intent?.sprint && !body.crouching;
  const len = Math.max(1, Math.hypot(intent?.moveX ?? 0, intent?.moveZ ?? 0));
  const speed = body.crouching ? CROUCH_SPEED : body.sprinting ? MOVE_SPEED * SPRINT_MULT : MOVE_SPEED;
  if (body.onGround) {
    body.airVelX = (((intent?.moveX ?? 0) * Math.cos(body.yaw) - (intent?.moveZ ?? 0) * Math.sin(body.yaw)) / len) * speed;
    body.airVelZ = ((-(intent?.moveX ?? 0) * Math.sin(body.yaw) - (intent?.moveZ ?? 0) * Math.cos(body.yaw)) / len) * speed;
  }
  const dx = body.airVelX * dtSeconds, dz = body.airVelZ * dtSeconds;
  // Bounded probes prevent a step crossing a narrow crack between endpoints.
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < count; i++) {
    for (const axis of /** @type {const} */ (['x', 'z'])) {
      const next = { x: body.x + (axis === 'x' ? dx / count : 0), y: body.y, z: body.z + (axis === 'z' ? dz / count : 0) };
      if (world.canOccupy(next, height, body.onGround)) {
        body.x = next.x;
        body.z = next.z;
        const ground = world.groundElevation(body.x, body.z, body.y - height + PLAYER_H);
        if (body.onGround && ground >= body.y - height - 0.4) body.y = ground + height;
      }
    }
  }
  const ground = world.groundElevation(body.x, body.z, body.y - height + PLAYER_H);
  if (body.onGround && body.y - height - ground > 0.4) {
    body.onGround = false;
    body.verticalVelocity = 0;
  }
  if (intent?.jump && !body.jumpHeld && body.onGround) {
    body.verticalVelocity = JUMP_FORCE;
    body.onGround = false;
  }
  body.jumpHeld = !!intent?.jump;
  if (!body.onGround) {
    body.verticalVelocity -= GRAVITY * dtSeconds;
    const dy = body.verticalVelocity * dtSeconds;
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.1));
    for (let i = 0; i < steps; i++) {
      const floor = world.groundElevation(body.x, body.z, body.y - height + PLAYER_H);
      const next = { x: body.x, y: body.y + dy / steps, z: body.z };
      if (dy <= 0 && next.y <= floor + height) {
        body.y = floor + height;
        body.verticalVelocity = 0;
        body.onGround = true;
        break;
      }
      if (!world.canOccupy(next, height, false)) {
        body.verticalVelocity = 0;
        break;
      }
      body.y = next.y;
    }
    body.airVelX *= 1 - dtSeconds * 0.4;
    body.airVelZ *= 1 - dtSeconds * 0.4;
  }
  body.moving = Math.hypot(body.x - oldX, body.z - oldZ) > 1e-6;
}
