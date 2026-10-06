// @ts-check
import { PLAYER_H, PLAYER_H_CROUCH } from '../config.js';
import { tickPresentation } from '../builders/enemyAnimations.js';
import { createPresentationHistory, normalizePresentation } from '../builders/animationPresentation.js';
/** @typedef {InstanceType<typeof import('../../server/tdmRoom.js').PlayerState>} RemotePlayer */
/** @typedef {ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh> & {currentClip:string|null,lifeGeneration:number,team:string,previousTick?:number,previousHealth?:number,velocityX?:number,velocityZ?:number,movementHistory?:any,presentationInput?:any,presentation?:any,_bones?:any[],_bonesInit?:boolean}} Actor */
/** @typedef {{create:(x:number,z:number)=>ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh>,dispose:(mesh:any,mixer:any)=>void,animate:(actor:Actor,p:RemotePlayer,dt:number)=>void,tint:(mesh:any,color:number)=>void}} Builders */
/** Explicit owner; injected builders keep resource tests independent of browser singletons.
 * @param {{add:(mesh:any)=>void}} scene @param {Builders} builders */
export function createRemoteActors(scene, builders) {
  /** @type {Map<string,Actor>} */ const actors = new Map();
  let generation = '',
    created = 0,
    disposed = 0;
  /** @param {Actor} actor */
  function retire(actor) {
    // Invalidate references before disposal can synchronously call another owner.
    actor.presentation = actor.presentationInput = undefined;
    actor.movementHistory = undefined;
    builders.dispose(actor.mesh, actor.mixer);
    disposed++;
  }
  /** @param {{sessionId:string,matchGeneration:number,currentTick?:number,players:Iterable<RemotePlayer>}} snapshot
   * @param {number} dt */
  function syncRemoteActors(snapshot, dt) {
    const next = `${snapshot.sessionId}/${snapshot.matchGeneration}`;
    if (generation !== next) {
      disposeRemoteActors();
      generation = next;
    }
    const active = new Set();
    for (const p of snapshot.players) {
      if (p.sessionId === snapshot.sessionId) continue;
      active.add(p.sessionId);
      let actor = actors.get(p.sessionId);
      if (actor && actor.lifeGeneration !== p.lifeGeneration) {
        retire(actor);
        actors.delete(p.sessionId);
        actor = undefined;
      }
      if (!actor) {
        actor = {
          ...builders.create(p.x, p.z),
          currentClip: 'idle',
          lifeGeneration: p.lifeGeneration,
          team: '',
        };
        scene.add(actor.mesh);
        actors.set(p.sessionId, actor);
        created++;
      }
      if (actor.team !== p.team) {
        builders.tint(actor.mesh, p.team === 'blue' ? 0x4488ff : 0xff5555);
        actor.team = p.team;
      }
      const tick = snapshot.currentTick ?? 0;
      const fresh = actor.previousTick === undefined || tick > actor.previousTick;
      const damage = fresh && actor.previousHealth !== undefined && p.health < actor.previousHealth;
      actor.presentationInput = createSnapshotPresentation(p, p.sessionId,
        `${generation}/${p.lifeGeneration}`, tick, damage);
      actor.movementHistory ??= createPresentationHistory();
      const n = normalizePresentation(actor.presentationInput, actor.movementHistory);
      actor.velocityX = actor.movementHistory.velocityX;
      actor.velocityZ = actor.movementHistory.velocityZ;
      // Reset health cursors along with discontinuous position/time history.
      if (n.reset) actor.presentationInput.trustedDamage = false;
      if (fresh || n.reset) { actor.previousHealth = p.health; actor.previousTick = tick; }
      builders.animate(actor, p, dt);
    }
    for (const [id, actor] of actors)
      if (!active.has(id)) {
        retire(actor);
        actors.delete(id);
      }
  }
  function disposeRemoteActors() {
    for (const actor of actors.values()) retire(actor);
    actors.clear();
    generation = '';
  }
  function inspect() {
    return {
      created,
      disposed,
      actors: Array.from(actors, ([sessionId, actor]) => {
        let skinned = false;
        actor.mesh.traverse((/** @type {any} */ node) => {
          if (node.isSkinnedMesh) skinned = true;
        });
        return {
          sessionId,
          lifeGeneration: actor.lifeGeneration,
          team: actor.team,
          skinned,
          armed: !!actor.mesh.getObjectByName('enemyWeaponMount'),
          clip: actor.currentClip,
          root: { x: actor.mesh.position.x, y: actor.mesh.position.y, z: actor.mesh.position.z,
            yaw: actor.mesh.rotation.y },
          pose: actor.presentation ? { speed: actor.presentation.speed, phase: actor.presentation.action.phase,
            generation: actor.presentation.generation, sampleTimeSeconds: actor.presentation.sampleTimeSeconds,
            gait: actor.presentation.gait, moving: actor.presentation.moving,
            jump: actor.presentation.jump, crouching: actor.presentation.crouching,
            aiming: actor.presentation.aiming, bodyYaw: actor.presentation.bodyYaw,
            upper: actor.presentation.upper, feetYaw: actor.presentation.feetYaw,
            pitch: actor.presentation.pitch, deathVariant: actor.presentation.deathVariant,
            deathDirectionSource: actor.presentation.deathDirectionSource, settled: actor.presentation.settled } : null,
        };
      }),
    };
  }
  return {
    syncRemoteActors,
    disposeRemoteActors,
    inspect,
    get size() {
      return actors.size;
    },
  };
}

/** Select only existing authoritative fields; unsupported/forged cosmetic claims are ignored.
 * @param {RemotePlayer} p @param {string} identity @param {string} generation
 * @param {number} tick @param {boolean} damage */
export function createSnapshotPresentation(p, identity, generation, tick, damage = false) {
  return { identity, generation, sampleTimeSeconds: tick / 30,
    position: { x: p.x, y: p.y, z: p.z }, bodyYaw: p.yaw, aimYaw: p.yaw, pitch: p.pitch,
    alive: p.alive, crouching: p.crouching, onGround: p.onGround,
    verticalVelocity: p.verticalVelocity, sprinting: p.sprinting, aiming: p.aiming,
    weapon: 'm4', action: p.alive && p.reloadRemaining > 0
      ? { kind: 'reload', total: 1.8, remaining: p.reloadRemaining } : { kind: 'ready' },
    trustedShot: false, trustedDamage: damage, trustedImpact: null };
}
/** Presentation only: authority owns position and eligibility.
 * @param {Actor} actor @param {RemotePlayer} p @param {number} dt */
export function animateRemoteActor(actor, p, dt) {
  actor.mesh.position.set(p.x, p.y - (p.crouching ? PLAYER_H_CROUCH : PLAYER_H), p.z);
  actor.mesh.rotation.y = p.yaw + actor.facingOffset;
  const raw = actor.presentationInput ?? createSnapshotPresentation(p, p.sessionId,
    String(p.lifeGeneration), 0);
  tickPresentation(actor, { ...raw, reducedMotion: typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true }, dt);
}
