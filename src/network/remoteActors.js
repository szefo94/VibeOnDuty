// @ts-check
/** @typedef {InstanceType<typeof import('../../server/tdmRoom.js').PlayerState>} RemotePlayer */
/** @typedef {ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh> & {currentClip:string|null,lifeGeneration:number,team:string}} Actor */
/** @typedef {{create:(x:number,z:number)=>ReturnType<typeof import('../builders/enemyGLTF.js').buildEnemyMesh>,dispose:(mesh:any,mixer:any)=>void,animate:(actor:Actor,p:RemotePlayer,dt:number)=>void,tint:(mesh:any,color:number)=>void}} Builders */
/** Explicit owner; injected builders keep resource tests independent of browser singletons.
 * @param {{add:(mesh:any)=>void}} scene @param {Builders} builders */
export function createRemoteActors(scene, builders) {
  /** @type {Map<string,Actor>} */ const actors = new Map();
  /** @param {{sessionId:string,matchGeneration:number,players:Iterable<RemotePlayer>}} snapshot
   * @param {number} dt */
  function syncRemoteActors(snapshot, dt) {
    const active = new Set();
    for (const p of snapshot.players) {
      if (p.sessionId === snapshot.sessionId) continue;
      active.add(p.sessionId);
      let actor = actors.get(p.sessionId);
      if (!actor) {
        actor = { ...builders.create(p.x, p.z), currentClip: 'idle', lifeGeneration:p.lifeGeneration, team:'' };
        scene.add(actor.mesh);
        actors.set(p.sessionId, actor);
      }
      builders.animate(actor, p, dt);
    }
    for (const [id, actor] of actors) if (!active.has(id)) {
      builders.dispose(actor.mesh, actor.mixer);
      actors.delete(id);
    }
  }
  function disposeRemoteActors() {
    for (const actor of actors.values()) builders.dispose(actor.mesh, actor.mixer);
    actors.clear();
  }
  return { syncRemoteActors, disposeRemoteActors, get size() { return actors.size; } };
}
