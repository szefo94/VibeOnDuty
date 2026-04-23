import type * as THREE from 'three';

// ── Base ──────────────────────────────────────────────────────────────────

export interface EntityBase {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  mesh: THREE.Object3D;
  /** Stamped by applyEntityBase */
  isAlive(): boolean;
  /** Stamped by applyEntityBase */
  takeDamage(dmg: number, onDie: (self: this) => void): void;
}

// ── AI state object (src/ai/enemyStates.js) ───────────────────────────────

export interface AiState {
  name: 'patrol' | 'spotted' | 'attack';
  enter?(e: Enemy, ctx?: AiCtx): void;
  tick(e: Enemy, dt: number, ctx: AiCtx): boolean;
  exit?(e: Enemy, ctx?: AiCtx): void;
}

export interface AiCtx {
  ts: number;
  dt: number;
  eGround: number;
  canSee: boolean;
  distP: number;
  pdx: number;
  pdz: number;
  desiredY: number;
  enemies: Enemy[];
  killEnemy(e: Enemy): void;
  triggerDeath(): void;
}

// ── Enemy ─────────────────────────────────────────────────────────────────

export interface Enemy extends EntityBase {
  // AI
  state: 'patrol' | 'spotted' | 'attack';
  _aiState: AiState;
  alertTimer: number;
  reactDelay: number;
  shootCd: number;
  botShootCd?: number;
  // Pathfinding
  path: [number, number][];
  pathTick: number;
  pathGoal: [number, number] | null;
  // Patrol
  patrol: [number, number][];
  patrolWp: number;
  wpWait: number;
  // Physics
  velX: number;
  velY: number;
  velZ: number;
  stunTimer: number;
  onGround: boolean;
  jumpCd: number;
  jumpPhase: string;
  jumpPhaseTimer: number;
  // Visuals
  facingY: number;
  facingOffset?: number;
  bobT: number;
  hpDrain: number;
  crouching: boolean;
  crouchTimer: number;
  muzzleFlashT: number;
  muzzleFlash: THREE.Object3D;
  radarAge: number;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  currentClip: string;
  // S&D
  sndTeam?: 'friend' | 'enemy';
  sndSiteTarget?: number;
  sndSiteAttack?: number;
  _friendIndicator?: THREE.Object3D | null;
}

// ── Player ────────────────────────────────────────────────────────────────

export interface Player extends EntityBase {
  yaw: number;
  pitch: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  energy: number;
  kills: number;
  lean: number;
  leanV: number;
  slowTimer: number;
  velY: number;
  onGround: boolean;
  crouching: boolean;
  crouchSliding: boolean;
  diving: boolean;
}

// ── Drone ─────────────────────────────────────────────────────────────────

export interface Drone extends EntityBase {
  y: number;
  velX: number;
  velZ: number;
  floatT: number;
  strafeDir: number;
  strafeDirTimer: number;
  empCd: number;
  /** Stamped by applyEntityBase */
  isAlive(): boolean;
  /** Stamped by applyEntityBase */
  takeDamage(dmg: number, onDie: (self: Drone) => void): void;
}
