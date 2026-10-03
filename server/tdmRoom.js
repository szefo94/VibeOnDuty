// @ts-check
import { Room } from '@colyseus/core';
import { schema, t, MapSchema } from '@colyseus/schema';
import { bunkerData } from '../src/shared/maps/bunker.js';
import { createSimulation } from '../src/shared/tdmSimulation.js';
import { createInputGate, MAX_SEQ } from '../src/shared/protocol.js';

export const PlayerState = schema(
  {
    sessionId: t.string(),
    team: t.string(),
    x: t.number(),
    y: t.number(),
    z: t.number(),
    yaw: t.number(),
    pitch: t.number(),
    health: t.number(),
    alive: t.boolean(),
    lifeGeneration: t.number(),
    ammo: t.number(),
    reserve: t.number(),
    moving: t.boolean(),
    crouching: t.boolean(),
    onGround: t.boolean(),
    verticalVelocity: t.number(),
    aiming: t.boolean(),
    sprinting: t.boolean(),
    reloadRemaining: t.number(),
    lastSeq: t.number(),
    lastConsumedSeq: t.number(),
  },
  'PlayerState'
);
export const MatchState = schema(
  {
    players: t.map(PlayerState),
    protocolVersion: t.number(),
    mapId: t.string(),
    phase: t.string(),
    matchGeneration: t.number(),
    currentTick: t.number(),
    scoreAlpha: t.number(),
    scoreBravo: t.number(),
    timeRemaining: t.number(),
  },
  'MatchState'
);

/** @extends {Room<{state: InstanceType<typeof MatchState>}>} */
export class TdmRoom extends Room {
  state = new MatchState({
    players: new MapSchema(),
    protocolVersion: 1,
    mapId: 'bunker',
    phase: 'waiting',
    matchGeneration: 1,
    currentTick: 0,
    scoreAlpha: 0,
    scoreBravo: 0,
    timeRemaining: 600,
  });
  simulation = createSimulation(bunkerData);
  /** @type {Map<string,ReturnType<typeof createInputGate>>} */
  inputGates = new Map();
  /** @type {Map<string,string>} */
  inputGenerations = new Map();
  // Keep this numeric contract self-contained: browser state type imports must
  // not pull the filesystem CLI into the legacy browser-only type graph.
  /** @param {{settings?:{killLimit:number,matchSeconds:number,respawnSeconds:number,friendlyFire:number,resultsSeconds:number}}} [options] */
  onCreate(options = {}) {
    if (options.settings) {
      const { friendlyFire, ...settings } = options.settings;
      this.simulation = createSimulation(bunkerData, { ...settings, friendlyDamage: friendlyFire });
      this.state.timeRemaining = settings.matchSeconds;
    }
    this.maxClients = 2;
    this.patchRate = 50;
    this.autoDispose = false;
    this.onMessage('input', (client, command) => {
      const gate = this.inputGates.get(client.sessionId);
      const body = this.state.players.get(client.sessionId);
      if (!gate || !body) return;
      if (gate.lastSeq === MAX_SEQ) {
        client.send('inputRejected', { reason: 'duplicate_seq' });
        gate.clear();
        this.simulation.clearInput(client.sessionId);
        client.leave(4002);
        return;
      }
      const result = gate.receive(
        command,
        this.inputContext(body, gate.lastSeq),
        performance.now()
      );
      if (!result.ok) {
        client.send('inputRejected', { reason: result.reason });
        if (result.disconnect) {
          gate.clear();
          this.simulation.clearInput(client.sessionId);
          client.leave(4008);
        }
      }
    });
    this.onMessage('*', () => {});
    this.setFixedTimestep((ctx) => {
      this.consumeInputs(performance.now());
      this.simulation.stepSimulation(ctx.dt);
      this.syncState();
      for (const event of this.simulation.events) {
        this.clients.find((c) => c.sessionId === event.shooterSessionId)?.send('hit', event);
      }
    }, 30);
  }
  /** @param {import('@colyseus/core').Client} client */
  onJoin(client) {
    this.simulation.addPlayer(client.sessionId);
    this.inputGates.set(client.sessionId, createInputGate());
    this.syncState();
  }
  /** @param {import('@colyseus/core').Client} client */
  onLeave(client) {
    this.inputGates.delete(client.sessionId);
    this.inputGenerations.delete(client.sessionId);
    this.simulation.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.syncState();
  }
  /** @param {InstanceType<typeof PlayerState>} body @param {number} lastSeq */
  inputContext(body, lastSeq) {
    return {
      currentTick: this.state.currentTick,
      lastSeq,
      matchGeneration: this.state.matchGeneration,
      lifeGeneration: body.lifeGeneration,
    };
  }
  /** @param {number} nowMs */
  consumeInputs(nowMs) {
    for (const [id, gate] of this.inputGates) {
      const body = this.state.players.get(id);
      if (!body || !body.alive || this.state.phase !== 'playing') {
        gate.clear();
        this.simulation.clearInput(id);
        continue;
      }
      const generation = `${this.state.matchGeneration}/${body.lifeGeneration}`;
      if (this.inputGenerations.has(id) && this.inputGenerations.get(id) !== generation)
        this.simulation.clearInput(id);
      this.inputGenerations.set(id, generation);
      const result = gate.consume(this.inputContext(body, gate.lastSeq), nowMs);
      const client = this.clients.find((c) => c.sessionId === id);
      for (const reason of result.rejections) client?.send('inputRejected', { reason });
      if (result.rejections.length && !result.command) this.simulation.clearInput(id);
      if (result.command) this.simulation.queueInput(id, result.command);
    }
  }
  syncState() {
    const s = this.simulation.snapshot();
    for (const p of s.players) {
      let replicated = this.state.players.get(p.sessionId);
      if (!replicated) {
        replicated = new PlayerState();
        this.state.players.set(p.sessionId, replicated);
      }
      const { shootRemaining: _shoot, airVelX: _ax, airVelZ: _az, jumpHeld: _jump, ...fields } = p;
      Object.assign(replicated, fields);
    }
    this.state.phase = s.phase;
    this.state.matchGeneration = s.matchGeneration;
    this.state.currentTick = s.currentTick;
    this.state.timeRemaining = s.timeRemaining;
    this.state.scoreAlpha = s.score.alpha;
    this.state.scoreBravo = s.score.bravo;
  }
}
