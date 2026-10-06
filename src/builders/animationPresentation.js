import manifest from '../../tools/art/motion-manifest.json';

export const PRESENTATION_LIMITS = Object.freeze({ speed: 18, teleport: 4,
  twist: 0.7, footTurn: 0.42, pitch: 1.1, blend: 0.16, death: 0.65 });
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
export function createPresentationHistory() {
  return { previous: null, velocityX: 0, velocityZ: 0, phase: 0,
    feetYaw: null, visualTime: 0, deathAt: null, deathVariant: null,
    jumpAt: null, jumpKind: '', turnAt: null, turnFrom: 0, turnTo: 0,
    transitionAt: null, transitionKind: '', reset: true };
}

// Adapters pass observation only. No callbacks, DOM, scene or gameplay writes.
export function normalizePresentation(raw, history) {
  const position = raw.position ?? {};
  const identity = `${raw.identity ?? 'actor'}/${raw.generation ?? 0}`;
  const time = finite(raw.sampleTimeSeconds);
  const x = finite(position.x), y = finite(position.y), z = finite(position.z);
  const old = history.previous;
  const elapsed = old ? time - old.time : 0;
  const distance = old ? Math.hypot(x - old.x, z - old.z) : 0;
  const reset = !old || identity !== old.identity || elapsed < 0 || elapsed > 1 ||
    distance > PRESENTATION_LIMITS.teleport || ![position.x, position.y, position.z,
      raw.sampleTimeSeconds].every(Number.isFinite);
  if (reset) Object.assign(history, createPresentationHistory());
  else if (elapsed > 0) {
    const scale = distance > elapsed * PRESENTATION_LIMITS.speed
      ? elapsed * PRESENTATION_LIMITS.speed / distance : 1;
    history.velocityX = (x - old.x) / elapsed * scale;
    history.velocityZ = (z - old.z) / elapsed * scale;
  }
  history.reset = reset;
  history.previous = { x, y, z, time, identity, onGround: raw.onGround !== false };
  const bodyYaw = angle(finite(raw.bodyYaw));
  const vx = history.velocityX, vz = history.velocityZ;
  const total = Math.max(0, finite(raw.action?.total ?? raw.action?.duration));
  const remaining = clamp(finite(raw.action?.remaining,
    total - finite(raw.action?.elapsed)), 0, total);
  const kind = ['reload', 'throw', 'melee', 'roll', 'dance', 'fire'].includes(raw.action?.kind)
    ? raw.action.kind : 'ready';
  return Object.freeze({ identity, x, y, z, sampleTimeSeconds: time, reset,
    bodyYaw, aimYaw: angle(finite(raw.aimYaw, bodyYaw)),
    pitch: clamp(finite(raw.pitch), -PRESENTATION_LIMITS.pitch, PRESENTATION_LIMITS.pitch),
    forward: -vx * Math.sin(bodyYaw) - vz * Math.cos(bodyYaw),
    right: vx * Math.cos(bodyYaw) - vz * Math.sin(bodyYaw), speed: Math.hypot(vx, vz),
    alive: raw.alive !== false, crouching: raw.crouching === true,
    onGround: raw.onGround !== false, previousOnGround: reset ? raw.onGround !== false : old.onGround,
    verticalVelocity: finite(raw.verticalVelocity), sprinting: raw.sprinting === true,
    aiming: raw.aiming === true, reducedMotion: raw.reducedMotion === true,
    weapon: ['m4', 'p90', 'awp', 'pistol'].includes(raw.weapon) ? raw.weapon : 'm4',
    action: Object.freeze({ kind, total, remaining, elapsed: total - remaining,
      phase: total > 0 ? 1 - remaining / total : 0, variant: raw.action?.variant }),
    shot: raw.trustedShot === true, damage: raw.trustedDamage === true,
    impact: raw.trustedImpact && [raw.trustedImpact.x, raw.trustedImpact.z].every(Number.isFinite)
      ? { x: raw.trustedImpact.x, z: raw.trustedImpact.z } : null });
}

export function samplePresentation(n, history, deltaSeconds = 0) {
  const dt = clamp(finite(deltaSeconds), 0, 0.1);
  history.visualTime += dt;
  const now = history.visualTime;
  if (history.feetYaw === null || n.reset) history.feetYaw = n.bodyYaw;
  if (!n.alive && history.deathAt === null) {
    history.deathAt = now;
    const impact = n.impact;
    if (impact && Math.hypot(impact.x, impact.z) > 0.001) {
      const f = -impact.x * Math.sin(n.bodyYaw) - impact.z * Math.cos(n.bodyYaw);
      const r = impact.x * Math.cos(n.bodyYaw) - impact.z * Math.sin(n.bodyYaw);
      history.deathVariant = Math.abs(f) >= Math.abs(r) ? (f >= 0 ? 'front' : 'back')
        : r >= 0 ? 'right' : 'left';
    } else history.deathVariant = ['front', 'right', 'back', 'left'][
      Math.floor((angle(n.bodyYaw) + Math.PI) / (Math.PI / 2)) % 4];
  }
  if (n.alive) { history.deathAt = null; history.deathVariant = null; }
  if (n.previousOnGround !== n.onGround) {
    history.jumpAt = now; history.jumpKind = n.onGround ? 'land' : 'start';
  }
  const jumpTotal = history.jumpKind === 'start' ? 0.32 : 0.38;
  const jumpElapsed = history.jumpAt === null ? Infinity : now - history.jumpAt;
  const jump = jumpElapsed < jumpTotal ? history.jumpKind : n.onGround ? '' : 'loop';
  const moving = n.speed > 0.05 && n.alive;
  const family = n.crouching ? 'crouch' : n.sprinting || n.speed > 6.5 ? 'run' : 'walk';
  const cycle = manifest.actions.find(a => a.id === `${family}_forward`);
  const cycleMeters = cycle.cycleDisplacement;
  const cadence = moving ? clamp(n.speed / cycleMeters, 0, 4.5) : 0;
  if (moving) history.phase = (history.phase + dt * cadence) % 1;
  let turn = '';
  if (moving) { history.feetYaw = n.bodyYaw; history.turnAt = null; }
  else if (n.alive && n.onGround) {
    const twist = angle(n.aimYaw - history.feetYaw);
    if (history.turnAt === null && Math.abs(twist) > PRESENTATION_LIMITS.footTurn) {
      history.turnAt = now; history.turnFrom = history.feetYaw; history.turnTo = n.bodyYaw;
    }
    if (history.turnAt !== null) {
      const spec = manifest.actions.find(a => a.id === 'turn_right');
      const phase = clamp((now - history.turnAt) / spec.durationSeconds, 0, 1);
      const progress = clamp((phase - spec.markers.plant) /
        (spec.markers.recontact - spec.markers.plant), 0, 1);
      const delta = angle(history.turnTo - history.turnFrom);
      turn = delta >= 0 ? 'turn_right' : 'turn_left';
      history.feetYaw = angle(history.turnFrom + delta * progress);
      if (phase >= 1) { history.feetYaw = history.turnTo; history.turnAt = null; turn = ''; }
    }
  }
  const norm = Math.abs(n.forward) + Math.abs(n.right) || 1;
  const gait = moving ? [
    { key: `${family}_${n.forward >= 0 ? 'forward' : 'back'}`, weight: Math.abs(n.forward) / norm },
    { key: `${family}_${n.right >= 0 ? 'right' : 'left'}`, weight: Math.abs(n.right) / norm },
  ].filter(a => a.weight > 0.001) : [{ key: n.crouching ? 'crouch_idle' : `${n.weapon}_ready`, weight: 1 }];
  const deathElapsed = history.deathAt === null ? 0 : now - history.deathAt;
  const upper = n.action.kind !== 'ready' ? n.action.kind : n.shot ? 'fire'
    : n.aiming ? 'ads' : n.sprinting && moving ? 'sprint' : 'ready';
  return Object.freeze({ ...n, moving, gait, cadence, cycleMeters, phase: history.phase,
    contacts: { left: cycle.markers.leftContact, right: cycle.markers.rightContact },
    feetYaw: history.feetYaw,
    torsoYaw: clamp(angle(n.aimYaw - history.feetYaw), -PRESENTATION_LIMITS.twist, PRESENTATION_LIMITS.twist),
    turn, turnPhase: history.turnAt === null ? 0 : clamp((now - history.turnAt) / 0.4, 0, 1),
    jump, jumpPhase: clamp(jumpElapsed / jumpTotal, 0, 1), jumpTotal,
    upper, deathVariant: history.deathVariant, deathDirectionSource: n.impact ? 'trusted-impact' : 'body-heading-fallback',
    deathPhase: clamp(deathElapsed / PRESENTATION_LIMITS.death, 0, 1),
    settled: !n.alive && deathElapsed >= PRESENTATION_LIMITS.death });
}
