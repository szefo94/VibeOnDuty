// @ts-check
import { PLAYER_H, PLAYER_H_CROUCH, JUMP_START_DUR, JUMP_LAND_DUR } from '../config.js';
import { enterLocoMode, exitLocoMode, setLocoWeights, crossfade, tickInertia, fitActionDuration } from '../builders/enemyAnimations.js';
/** @typedef {InstanceType<typeof import('../../server/tdmRoom.js').PlayerState>} RemotePlayer */
/** @typedef {ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh> & {currentClip:string|null,lifeGeneration:number,team:string,previousX?:number,previousZ?:number,previousTick?:number,velocityX?:number,velocityZ?:number,onGround?:boolean,jumpPhase?:string,jumpTimer?:number,_bones?:any[],_bonesInit?:boolean}} Actor */
/** @typedef {{create:(x:number,z:number)=>ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh>,dispose:(mesh:any,mixer:any)=>void,animate:(actor:Actor,p:RemotePlayer,dt:number)=>void,tint:(mesh:any,color:number)=>void}} Builders */
/** Explicit owner; injected builders keep resource tests independent of browser singletons.
 * @param {{add:(mesh:any)=>void}} scene @param {Builders} builders */
export function createRemoteActors(scene, builders) {
  /** @type {Map<string,Actor>} */ const actors = new Map();
  let generation = '', created = 0, disposed = 0;
  /** @param {Actor} actor */
  function retire(actor) { builders.dispose(actor.mesh, actor.mixer); disposed++; }
  /** @param {{sessionId:string,matchGeneration:number,currentTick?:number,players:Iterable<RemotePlayer>}} snapshot
   * @param {number} dt */
  function syncRemoteActors(snapshot, dt) {
    const next = `${snapshot.sessionId}/${snapshot.matchGeneration}`;
    if (generation !== next) { disposeRemoteActors(); generation = next; }
    const active = new Set();
    for (const p of snapshot.players) {
      if (p.sessionId === snapshot.sessionId) continue;
      active.add(p.sessionId);
      let actor = actors.get(p.sessionId);
      if (actor && actor.lifeGeneration !== p.lifeGeneration) {
        retire(actor); actors.delete(p.sessionId); actor = undefined;
      }
      if (!actor) {
        actor = { ...builders.create(p.x, p.z), currentClip: 'idle', lifeGeneration:p.lifeGeneration, team:'' };
        scene.add(actor.mesh);
        actors.set(p.sessionId, actor);
        created++;
      }
      if (actor.team !== p.team) {
        builders.tint(actor.mesh, p.team === 'blue' ? 0x4488ff : 0xff5555);
        actor.team = p.team;
      }
      const tick = snapshot.currentTick ?? 0;
      if (tick !== actor.previousTick) {
        const seconds = actor.previousTick === undefined ? 0 : (tick - actor.previousTick) / 30;
        actor.velocityX = seconds > 0 ? (p.x - (actor.previousX ?? p.x)) / seconds : 0;
        actor.velocityZ = seconds > 0 ? (p.z - (actor.previousZ ?? p.z)) / seconds : 0;
        actor.previousX = p.x; actor.previousZ = p.z; actor.previousTick = tick;
      }
      builders.animate(actor, p, dt);
    }
    for (const [id, actor] of actors) if (!active.has(id)) {
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
    return { created, disposed, actors: Array.from(actors, ([sessionId, actor]) => {
      let skinned = false;
      actor.mesh.traverse((/** @type {any} */ node) => { if (node.isSkinnedMesh) skinned = true; });
      return { sessionId, lifeGeneration: actor.lifeGeneration, team: actor.team, skinned,
        armed: !!actor.mesh.getObjectByName('enemyWeaponMount'), clip:actor.currentClip };
    }) };
  }
  return { syncRemoteActors, disposeRemoteActors, inspect, get size() { return actors.size; } };
}

/** Presentation only: authority owns positions and eligibility.
 * @param {Actor} actor @param {RemotePlayer} p @param {number} dt */
export function animateRemoteActor(actor, p, dt) {
  actor.mesh.position.set(p.x, p.y - (p.crouching ? PLAYER_H_CROUCH : PLAYER_H), p.z);
  actor.mesh.rotation.y = p.yaw + actor.facingOffset;
  if (!actor._bonesInit) {
    actor._bonesInit = true; actor._bones = [];
    actor.mesh.traverse((/** @type {any} */ node) => {
      if (node.isSkinnedMesh) for (const bone of node.skeleton.bones)
        if (!actor._bones?.includes(bone)) actor._bones?.push(bone);
    });
  }
  if (actor.onGround !== undefined && actor.onGround !== p.onGround) {
    actor.jumpPhase = p.onGround ? 'land' : 'start';
    actor.jumpTimer = p.onGround ? JUMP_LAND_DUR : JUMP_START_DUR;
  }
  actor.onGround = p.onGround;
  actor.jumpTimer = Math.max(0, (actor.jumpTimer ?? 0) - dt);
  if (!actor.jumpTimer) actor.jumpPhase = p.onGround ? '' : 'loop';
  const actions = /** @type {Record<string,any>} */ (actor.actions);
  const clip = !p.alive ? 'death' : p.reloadRemaining > 0 ? 'reload'
    : p.crouching ? (p.moving ? 'crouch_walk' : 'crouch')
    : !p.onGround ? (actor.jumpPhase === 'start' ? 'jump_start' : 'jump_loop')
    : actor.jumpPhase === 'land' ? 'jump_land' : null;
  if (clip && actions[clip]) {
    exitLocoMode(actor);
    const changed = actor.currentClip !== clip;
    crossfade(actor, clip, clip === 'death' ? 0 : 0.2);
    if (clip === 'reload') {
      fitActionDuration(actions.reload, 1.8);
      if (changed) actions.reload.time = actions.reload.getClip().duration * Math.max(0,1-p.reloadRemaining/1.8);
    } else if (clip === 'jump_start' || clip === 'jump_land')
      fitActionDuration(actions[clip], clip === 'jump_start' ? JUMP_START_DUR : JUMP_LAND_DUR);
  } else {
    enterLocoMode(actor);
    const vx = actor.velocityX ?? 0, vz = actor.velocityZ ?? 0;
    const speed = Math.hypot(vx,vz);
    const lateral = p.moving && speed > 0.05 ? (vx * Math.cos(p.yaw) - vz * Math.sin(p.yaw))/speed : 0;
    setLocoWeights(actor.actions, p.moving ? Math.min(1, speed / 9.9) : 0, lateral);
  }
  if (actions._breathing) {
    actions._breathing.setEffectiveWeight(!p.alive ? 0 : p.aiming ? 0.4 : p.sprinting ? 1.1 : 0.75);
    if (p.alive) actions._breathing.play();
  }
  actor.mixer?.update(dt);
  tickInertia(actor, dt);
}
