// @ts-check
import { Room } from '@colyseus/core';
import { schema, t, MapSchema } from '@colyseus/schema';
import { bunkerMapDef } from '../src/maps/bunker.js';
import { createSimulation } from '../src/shared/tdmSimulation.js';

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
    reloadRemaining: t.number(),
    lastSeq: t.number(),
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
    scoreAlpha: 0,
    scoreBravo: 0,
    timeRemaining: 600,
  });
  simulation = createSimulation(bunkerMapDef);
  onCreate() {
    this.maxClients = 2;
    this.patchRate = 50;
    this.autoDispose = false;
    this.onMessage('input', (client, command) => {
      this.simulation.queueInput(client.sessionId, command);
    });
    this.onMessage('*', () => {});
    this.setFixedTimestep((ctx) => {
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
    this.syncState();
  }
  /** @param {import('@colyseus/core').Client} client */
  onLeave(client) {
    this.simulation.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.syncState();
  }
  syncState() {
    const s = this.simulation.snapshot();
    for (const p of s.players) {
      let replicated = this.state.players.get(p.sessionId);
      if (!replicated) {
        replicated = new PlayerState();
        this.state.players.set(p.sessionId, replicated);
      }
      const { shootRemaining: _shoot, ...fields } = p;
      Object.assign(replicated, fields);
    }
    this.state.phase = s.phase;
    this.state.matchGeneration = s.matchGeneration;
    this.state.timeRemaining = s.timeRemaining;
    this.state.scoreAlpha = s.score.alpha;
    this.state.scoreBravo = s.score.bravo;
  }
}
