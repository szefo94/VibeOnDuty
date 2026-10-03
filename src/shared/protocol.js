// @ts-check
/** @typedef {{protocolVersion:number,seq:number,ackTick:number,matchGeneration:number,lifeGeneration:number,moveX:number,moveZ:number,yaw:number,pitch:number,fire:boolean,reload:boolean,sprint:boolean,jump:boolean,crouch:boolean,aiming:boolean,neutral:boolean}} Command */
/** @typedef {{currentTick:number,lastSeq:number,matchGeneration:number,lifeGeneration:number,payloadBytes?:number}} InputContext */
/** @typedef {'invalid_shape'|'invalid_number'|'invalid_action'|'wrong_generation'|'stale_input'|'future_tick'|'duplicate_seq'|'queue_limit'|'rate_limit'} RejectReason */
/** @typedef {{ok:true,command:Command}|{ok:false,reason:RejectReason}} Validation */
export const MAX_SEQ = 2147483647;
export const MAX_INPUT_BYTES = 1024;
export const MAX_PENDING_INPUTS = 8;
export const MAX_INPUT_AGE_MS = 500;
export const MAX_ACK_AGE_TICKS = 15;
const actions = /** @type {const} */ ([
  'fire',
  'reload',
  'sprint',
  'jump',
  'crouch',
  'aiming',
  'neutral',
]);
const fields = [
  'protocolVersion',
  'seq',
  'ackTick',
  'matchGeneration',
  'lifeGeneration',
  'moveX',
  'moveZ',
  'yaw',
  'pitch',
  ...actions,
];
const encoder = new TextEncoder();

/** Serialized application payload budget, before validation/coercion.
 * @param {unknown} raw */
export function inputPayloadBytes(raw) {
  try {
    return encoder.encode(JSON.stringify(raw)).length;
  } catch {
    return Infinity;
  }
}
/** Exact, rejection-only validation: never sanitize hostile numbers or identity.
 * @param {unknown} raw @param {InputContext} context @returns {Validation} */
export function validateInput(raw, context) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, reason: 'invalid_shape' };
  if ((context.payloadBytes ?? inputPayloadBytes(raw)) > MAX_INPUT_BYTES)
    return { ok: false, reason: 'invalid_shape' };
  const keys = Object.keys(raw);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key)))
    return { ok: false, reason: 'invalid_shape' };
  const c = /** @type {Command} */ (raw);
  if (c.protocolVersion !== 1) return { ok: false, reason: 'invalid_shape' };
  if (
    !Number.isSafeInteger(c.seq) ||
    c.seq < 0 ||
    c.seq > MAX_SEQ ||
    !Number.isSafeInteger(c.ackTick) ||
    c.ackTick < 0 ||
    ![c.moveX, c.moveZ, c.yaw, c.pitch].every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    Math.abs(c.moveX) > 1 ||
    Math.abs(c.moveZ) > 1 ||
    Math.abs(c.yaw) > Math.PI ||
    Math.abs(c.pitch) > 1.38
  )
    return { ok: false, reason: 'invalid_number' };
  if (
    actions.some((key) => typeof c[key] !== 'boolean') ||
    (c.neutral &&
      (c.moveX !== 0 || c.moveZ !== 0 || actions.some((key) => key !== 'neutral' && c[key])))
  )
    return { ok: false, reason: 'invalid_action' };
  if (c.matchGeneration !== context.matchGeneration || c.lifeGeneration !== context.lifeGeneration)
    return { ok: false, reason: 'wrong_generation' };
  if (c.ackTick > context.currentTick) return { ok: false, reason: 'future_tick' };
  if (context.currentTick - c.ackTick > MAX_ACK_AGE_TICKS)
    return { ok: false, reason: 'stale_input' };
  if (c.seq <= context.lastSeq) return { ok: false, reason: 'duplicate_seq' };
  return { ok: true, command: { ...c } };
}

/** A session-owned bounded queue. Server monotonic receipt time and fixed ticks
 * are the only clocks. Tokens refill at60/s, capacity120 provides the permitted
 * burst. Three consecutive one-second windows exhausting that budget disconnect.
 */
export function createInputGate() {
  /** @type {Array<{command:Command,receivedAt:number}>} */ let pending = [];
  let lastSeq = -1,
    tokens = 120,
    refillAt = -1,
    lastExceededWindow = -Infinity,
    exceededWindows = 0;
  /** @param {unknown} raw @param {InputContext} context @param {number} nowMs */
  function receive(raw, context, nowMs) {
    if (refillAt < 0) refillAt = nowMs;
    tokens = Math.min(120, tokens + Math.max(0, nowMs - refillAt) * 0.06);
    refillAt = nowMs;
    if (tokens < 1) {
      const window = Math.floor(nowMs / 1000);
      if (window !== lastExceededWindow) {
        exceededWindows = window === lastExceededWindow + 1 ? exceededWindows + 1 : 1;
        lastExceededWindow = window;
      }
      return {
        ok: false,
        reason: /** @type {RejectReason} */ ('rate_limit'),
        disconnect: exceededWindows >= 3,
      };
    }
    tokens--;
    const validation = validateInput(raw, { ...context, lastSeq });
    if (!validation.ok) return { ...validation, disconnect: false };
    if (validation.command.neutral) pending = [];
    if (pending.length >= MAX_PENDING_INPUTS)
      return { ok: false, reason: /** @type {RejectReason} */ ('queue_limit'), disconnect: false };
    lastSeq = validation.command.seq;
    pending.push({ command: validation.command, receivedAt: nowMs });
    return { ok: true, disconnect: false };
  }
  /** @param {InputContext} context @param {number} nowMs */
  function consume(context, nowMs) {
    /** @type {Command|null} */ let command = null;
    let fire = false,
      reload = false,
      jump = false;
    /** @type {RejectReason[]} */ const rejections = [];
    for (const entry of pending) {
      const checked = validateInput(entry.command, { ...context, lastSeq: -1 });
      if (checked.ok === false) rejections.push(checked.reason);
      else if (nowMs - entry.receivedAt > MAX_INPUT_AGE_MS) rejections.push('stale_input');
      else {
        fire = checked.command.fire || fire;
        reload = checked.command.reload || reload;
        jump = checked.command.jump || jump;
        command = { ...checked.command, fire, reload, jump };
      }
    }
    pending = [];
    return { command, rejections };
  }
  return {
    receive,
    consume,
    clear: () => {
      pending = [];
    },
    get pendingCount() {
      return pending.length;
    },
    get lastSeq() {
      return lastSeq;
    },
  };
}
