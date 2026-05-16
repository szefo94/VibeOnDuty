export const CELL = 4,
  WALL_H = 3,
  PLAYER_H = 1.65,
  PLAYER_H_CROUCH = 0.85,
  PLAYER_R = 0.35;   // half-width of player body used for wall collision
export const MOVE_SPEED = 6,
  SPRINT_MULT = 1.65,
  MOUSE_SENS = 0.0018;
export const MAX_HP = 100,
  MAX_AMMO = 30,
  RESERVE_AMMO = 90,
  RELOAD_MS = 1800,
  SHOOT_CD = 88;
export const ENEMY_HP = 100,
  ENEMY_SPEED = 2.4,
  ENEMY_ROT_SPD = 2.6;
export const ENEMY_SIGHT = 22,
  ENEMY_SHOOT_RANGE = 14,
  ENEMY_SHOOT_CD = 1200;
export const ENEMY_DAMAGE = 10,
  BULLET_DAMAGE = 28;
export const REACT_MIN = 400,
  REACT_MAX = 950;
export const AIM_THRESH = 0.055;
export const TRACER_LIFE = 0.09;
export const HP_SEGS = 4;
export const GRAVITY = 18,
  JUMP_FORCE = 7.5;
export const HEAD_BOB_PITCH = 0.022;
export const SLIDE_SPEED = 10,
  SLIDE_DUR = 0.55,
  SLIDE_CANCEL_JUMP = true;
export const ENERGY_PER_DMG = 0.4;
export const MAX_ENERGY = 100,
  GRENADE_ENERGY_COST = 100;
export const GRENADE_RADIUS = 9.0,
  GRENADE_PEAK_DMG = 150;
export const PUNCH_RANGE = 1.8,
  PUNCH_DAMAGE = 55;

// ── Weapon definitions ─────────────────────────────────────────────────────
export const WEAPONS = {
  m4:     { name: 'M4A1', maxAmmo: 30, reserve: 90,  damage: 28, fireRate: 88,   reload: 1800, sprayMax: 0.055, sprayGrow: 0.08,  adsZoom: 50, price: 2900 },
  p90:    { name: 'P90',  maxAmmo: 50, reserve: 150, damage: 20, fireRate: 55,   reload: 2000, sprayMax: 0.090, sprayGrow: 0.12,  adsZoom: 52, price: 2350 },
  awp:    { name: 'AWP',  maxAmmo: 5,  reserve: 20,  damage: 95, fireRate: 1100, reload: 2500, sprayMax: 0.005, sprayGrow: 0.003, adsZoom: 20, price: 4750 },
  pistol: { name: 'M9',   maxAmmo: 12, reserve: 36,  damage: 38, fireRate: 280,  reload: 1200, sprayMax: 0.040, sprayGrow: 0.05,  adsZoom: 55, price:    0 },
};
export const DEFAULT_WEAPON = 'm4';

// ── Difficulty presets ─────────────────────────────────────────────────────
// Each tier controls every parameter that makes enemies harder:
//   reactMin/Max  — ms before enemy fires after spotting player
//   shootCd       — ms between shots
//   damage        — hp per hit (random +0..5 added on top in enemyStates)
//   speedMult     — multiplier on ENEMY_SPEED
//   aimThresh     — max angle error (rad) allowed before shooting; smaller = better aim
//   hp            — enemy health points
//   sight         — detection range in world units
//   strafeChance  — 0‒1 probability of strafing each movement phase
export const DIFFICULTY_PRESETS = {
  recruit: {
    label: 'RECRUIT',
    desc: 'slow reaction · bad aim · low damage',
    reactMin: 900, reactMax: 1800,
    shootCd: 2200,
    damage: 6,
    speedMult: 0.60,
    aimThresh: 0.18,
    hp: 70,
    sight: 16,
    strafeChance: 0.0,
  },
  regular: {
    label: 'REGULAR',
    desc: 'standard threat · reacts under 1 s',
    reactMin: 400, reactMax: 950,
    shootCd: 1200,
    damage: 10,
    speedMult: 1.0,
    aimThresh: 0.055,
    hp: 100,
    sight: 22,
    strafeChance: 0.25,
  },
  veteran: {
    label: 'VETERAN',
    desc: 'fast reaction · strafes · tight aim',
    reactMin: 150, reactMax: 380,
    shootCd: 700,
    damage: 16,
    speedMult: 1.25,
    aimThresh: 0.028,
    hp: 130,
    sight: 26,
    strafeChance: 0.60,
  },
  elite: {
    label: 'ELITE',
    desc: 'near-instant · constant movement · lethal',
    reactMin: 60, reactMax: 150,
    shootCd: 420,
    damage: 22,
    speedMult: 1.50,
    aimThresh: 0.012,
    hp: 160,
    sight: 30,
    strafeChance: 1.0,
  },
};

// ── S&D constants ──────────────────────────────────────────────────────────
export const SND_PLANT_RANGE  = 2.5;
export const SND_DEFUSE_RANGE = 2.2;
export const SND_PLANT_TIME   = 3.0;
export const SND_DEFUSE_TIME  = 5.0;
export const SND_BOMB_FUSE    = 40.0;
export const SND_ROUND_TIMER  = 60.0;
export const SND_ROUNDS_PER_HALF = 3;
export const SND_TOTAL_ROUNDS    = 7;
export const SND_WINS_NEEDED     = 4;

// ── Player movement physics ────────────────────────────────────────────────
export const DIVE_SPEED    = 12;
export const DIVE_LAUNCH_Y = 2.8;
export const DIVE_DUR      = 0.55;
export const ROLL_ANIM_DUR = 1.467;
export const LEAN_ANGLE    = 0.28;
export const LEAN_SHIFT    = 0.38;
export const LEAN_SPEED    = 3.5;

// ── Jump animation timings (shared by loop.js and enemyAnimations.js) ──────
export const JUMP_START_DUR = 0.32;
export const JUMP_LAND_DUR  = 0.38;

// ── Bullet physics ─────────────────────────────────────────────────────────
export const BULLET_SPEED    = 65;
export const BULLET_GRAV     = 6;
export const BULLET_MAX_LIFE = 1.1;
export const BULLET_TRAIL    = 2.8;
export const DEATH_DUR       = 0.65;

// ── Drone AI ───────────────────────────────────────────────────────────────
export const DRONE_ACCEL      = 4;
export const DRONE_STRAFE     = 2.8;
export const DRONE_DRAG       = 3;
export const DRONE_MAX_SPEED  = 5;
export const DRONE_ORBIT_DIST = 8;
export const RECON_FLY_H      = 4.2;
export const RECON_SPEED      = 4.0;
export const RECON_SCAN_R     = 13;
export const RECON_SCAN_CD    = 2.5;
