// @ts-check
import NodeWebSocket from 'ws';

// Node24's native WebSocket cannot attach Origin. The pinned SDK captures its
// transport constructor at import: select the existing Node ws implementation
// for this test helper, then restore the process global immediately.
const nativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = /** @type {typeof nativeWebSocket} */ (
  /** @type {unknown} */ (NodeWebSocket)
);
const { Client } = await import('@colyseus/sdk');
globalThis.WebSocket = nativeWebSocket;

/** @typedef {InstanceType<typeof import('../tdmRoom.js').MatchState>} State */
/** @param {()=>boolean} predicate @param {number} [timeoutMs] */
export async function waitFor(predicate, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < until)
    await new Promise((resolve) => setTimeout(resolve, 10));
}

/** Real SDK, actual transport identity, no server mutation/test endpoint.
 * @param {string} serverUrl @param {{roomId?:string,create?:boolean}} [options] */
export async function createHostileClient(serverUrl, options = {}) {
  const origin = new URL(serverUrl).origin;
  const client = new Client(serverUrl, { headers: { Origin: origin } });
  /** @type {import('@colyseus/sdk').Room<State>} */
  const room = options.roomId
    ? await client.joinById(options.roomId, { protocolVersion: 1 })
    : options.create
      ? await client.create('tdm', { protocolVersion: 1 })
      : await client.joinOrCreate('tdm', { protocolVersion: 1 });
  /** @type {string[]} */ const rejections = [];
  let closedCode = 0,
    seq = 0;
  room.onMessage('inputRejected', (/** @type {{reason:string}} */ message) =>
    rejections.push(message.reason)
  );
  room.onMessage('hit', () => {});
  room.onLeave((code) => {
    closedCode = code;
  });
  await waitFor(() => !!room.state?.players?.get(room.sessionId));
  if (!room.state?.players?.get(room.sessionId)) {
    await room.leave();
    throw new Error('Hostile SDK fixture did not receive its authoritative body');
  }
  /** @param {Partial<import('../../src/shared/tdmSimulation.js').Command>} [changes] */
  function command(changes = {}) {
    const me = room.state.players.get(room.sessionId);
    return {
      protocolVersion: 1,
      seq: ++seq,
      ackTick: room.state.currentTick,
      matchGeneration: room.state.matchGeneration,
      lifeGeneration: me?.lifeGeneration ?? 0,
      moveX: 0,
      moveZ: 0,
      yaw: 0,
      pitch: 0,
      fire: false,
      reload: false,
      sprint: false,
      jump: false,
      crouch: false,
      aiming: false,
      neutral: false,
      ...changes,
    };
  }
  return {
    sessionId: room.sessionId,
    roomId: room.roomId,
    origin,
    command,
    rejections,
    get closedCode() {
      return closedCode;
    },
    snapshot: () => structuredClone(room.state.toJSON()),
    /** @param {unknown} raw */ send: (raw) => room.send('input', raw),
    close: () => (closedCode ? Promise.resolve() : room.leave().then(() => {})),
  };
}
