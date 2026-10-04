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
    nickname: t.string(),
    joinOrdinal: t.number(),
    respawnAtMs: t.float64(),
    kills: t.number(),
    deaths: t.number(),
    x: t.number(),
    y: t.number(),
    z: t.number(),
    yaw: t.number(),
    pitch: t.number(),
    health: t.float64(),
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
export const SettingsState = schema(
  {
    killLimit: t.number(),
    matchSeconds: t.float64(),
    respawnSeconds: t.float64(),
    friendlyFire: t.float64(),
    resultsSeconds: t.number(),
  },
  'SettingsState'
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
    settings: SettingsState,
    scoreBlue: t.number(),
    scoreRed: t.number(),
    winner: t.string(),
    nowMs: t.float64(),
    startedAtMs: t.float64(),
    endsAtMs: t.float64(),
    resultsEndsAtMs: t.float64(),
    resultsRemaining: t.float64(),
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
    settings: new SettingsState({
      killLimit: 50,
      matchSeconds: 600,
      respawnSeconds: 3,
      friendlyFire: 0.25,
      resultsSeconds: 15,
    }),
    scoreBlue: 0,
    scoreRed: 0,
    winner: '',
    nowMs: 0,
    startedAtMs: 0,
    endsAtMs: 0,
    resultsEndsAtMs: 0,
    resultsRemaining: 0,
  });
  simulation = createSimulation(bunkerData);
  /** @type {Map<string,ReturnType<typeof createInputGate>>} */
  inputGates = new Map();
  /** @type {Map<string,string>} */
  inputGenerations = new Map();
  deliveredMatchGeneration = 0;
  lastDeliveredEventId = 0;
  /** @type {import('../src/shared/combat.js').Hit[]} */
  pendingCombatEvents = [];
  // Keep this numeric contract self-contained: browser state type imports must
  // not pull the filesystem CLI into the legacy browser-only type graph.
  /** @param {{settings?:{killLimit:number,matchSeconds:number,respawnSeconds:number,friendlyFire:number,resultsSeconds:number},combatSeed?:number}} [options] */
  onCreate(options = {}) {
    if (options.settings) {
      const { friendlyFire, ...settings } = options.settings;
      this.simulation = createSimulation(
        bunkerData,
        { ...settings, friendlyDamage: friendlyFire },
        { randomSeed: options.combatSeed }
      );
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
    this.onMessage('switch-team', (client, command) => {
      const gate = this.inputGates.get(client.sessionId);
      const body = this.state.players.get(client.sessionId);
      if (!gate || !body) return;
      const budget = gate.receive(null, this.inputContext(body, gate.lastSeq), performance.now());
      if (!budget.ok && budget.reason === 'rate_limit') {
        client.send('teamRejected', { reason: 'rate_limit' });
        if (budget.disconnect) client.leave(4008);
        return;
      }
      const reason = this.simulation.requestTeamSwitch(client.sessionId, command);
      if (reason) client.send('teamRejected', { reason });
      else this.syncState();
    });
    this.onMessage('*', (client) => {
      const gate = this.inputGates.get(client.sessionId);
      const body = this.state.players.get(client.sessionId);
      if (!gate || !body) return;
      // Unsupported messages share the same bounded receipt budget. Their
      // payload never reaches simulation or appears in a log/reply.
      const result = gate.receive(null, this.inputContext(body, gate.lastSeq), performance.now());
      client.send('inputRejected', {
        reason: !result.ok && result.reason === 'rate_limit' ? 'rate_limit' : 'unknown_message',
      });
      if (result.disconnect) {
        gate.clear();
        this.simulation.clearInput(client.sessionId);
        client.leave(4008);
      }
    });
    this.setFixedTimestep((ctx) => {
      this.consumeInputs(performance.now());
      this.simulation.stepSimulation(ctx.dt);
      this.syncState();
      this.deliverCombatEvents();
    }, 30);
  }
  deliverCombatEvents() {
    if (this.deliveredMatchGeneration !== this.state.matchGeneration) {
      this.deliveredMatchGeneration = this.state.matchGeneration;
      this.lastDeliveredEventId = 0;
      this.pendingCombatEvents = [];
    }
    for (const event of this.simulation.events) {
      if (
        event.matchGeneration !== this.state.matchGeneration ||
        event.eventId <= this.lastDeliveredEventId
      )
        continue;
      this.lastDeliveredEventId = event.eventId;
      // Stage until the patch boundary, not just until local syncState().
      // Recheck generations there because another simulation tick may retire them.
      this.pendingCombatEvents.push(event);
      if (this.pendingCombatEvents.length > 128) this.pendingCombatEvents.shift();
    }
  }
  onBeforePatch() {
    const pending = this.pendingCombatEvents;
    this.pendingCombatEvents = [];
    for (const event of pending) {
      const shooter = this.state.players.get(event.shooterSessionId);
      const target = this.state.players.get(event.targetSessionId);
      if (
        event.matchGeneration !== this.state.matchGeneration ||
        !shooter ||
        !target ||
        shooter.lifeGeneration !== event.lifeGeneration ||
        target.lifeGeneration !== event.targetLifeGeneration
      )
        continue;
      this.clients
        .find((c) => c.sessionId === event.shooterSessionId)
        ?.send('hit-confirmed', event, { afterNextPatch: true });
    }
  }
  /** @param {import('@colyseus/core').Client} client @param {unknown} [options] */
  onJoin(client, options) {
    this.simulation.addPlayer(client.sessionId, options);
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
      if (!body || !body.alive || this.state.phase !== 'active') {
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
    if (this.state.matchGeneration !== s.matchGeneration) {
      for (const gate of this.inputGates.values()) gate.resetSequence();
      this.inputGenerations.clear();
      this.lastDeliveredEventId = 0;
      this.pendingCombatEvents = [];
    }
    for (const p of s.players) {
      let replicated = this.state.players.get(p.sessionId);
      if (!replicated) {
        replicated = new PlayerState();
        this.state.players.set(p.sessionId, replicated);
      } else if (replicated.lifeGeneration !== p.lifeGeneration) {
        this.inputGates.get(p.sessionId)?.resetSequence();
        this.inputGenerations.delete(p.sessionId);
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
    this.state.scoreBlue = s.scoreBlue;
    this.state.scoreRed = s.scoreRed;
    this.state.nowMs = s.nowMs;
    this.state.startedAtMs = s.startedAtMs;
    this.state.endsAtMs = s.endsAtMs;
    this.state.winner = s.winner;
    this.state.resultsEndsAtMs = s.resultsEndsAtMs;
    this.state.resultsRemaining = s.resultsRemaining;
    Object.assign(this.state.settings, s.settings);
  }
}
