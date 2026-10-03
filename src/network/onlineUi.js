// @ts-check
/** @typedef {import('../shared/combat.js').Hit} Hit */
/** @typedef {{textContent:string|null,hidden:boolean}} Element */
/** @typedef {{sessionId:string,matchGeneration:number,lifeGeneration:number,players:{sessionId:string,lifeGeneration:number}[]}} Session */
/** @typedef {{tick:(dt:number)=>boolean,remove:()=>void}} NumberEffect */
/** @param {Record<string,Element|null>} elements
 * @param {{marker:()=>void,number:(x:number,y:number,z:number,damage:number)=>NumberEffect|undefined,tickMarker:(dt:number)=>void,clearMarker:()=>void}} feedback */
export function createOnlineUi(elements, feedback) {
  let lastEventId = 0;
  /** @param {Hit} event @param {Session} session */
  function presentConfirmedHit(event, session) {
    const target = session.players.find(p => p.sessionId === event.targetSessionId);
    if (event.shooterSessionId !== session.sessionId || event.matchGeneration !== session.matchGeneration || event.lifeGeneration !== session.lifeGeneration || !target || event.targetLifeGeneration !== target.lifeGeneration || event.eventId <= lastEventId) return false;
    lastEventId = event.eventId;
    feedback.marker();
    feedback.number(event.impact.x,event.impact.y,event.impact.z,event.damage);
    return true;
  }
  return {presentConfirmedHit};
}
