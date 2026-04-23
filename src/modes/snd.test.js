import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('three', () => ({
  RingGeometry: class { rotateX() {} },
  Mesh: class {
    constructor() {
      this.material = { opacity: 1, emissiveIntensity: 1 };
      this.position = { set: vi.fn() };
    }
  },
  MeshBasicMaterial: class {},
  MeshStandardMaterial: class { constructor() { this.emissiveIntensity = 1; } },
  CylinderGeometry: class {},
  BoxGeometry: class {},
  PointLight: class {
    constructor() { this.position = { set: vi.fn() }; this.intensity = 1; }
  },
  DoubleSide: 2,
}));

vi.mock('../scene.js', () => ({
  scene:  { add: vi.fn(), remove: vi.fn() },
  camera: { position: { set: vi.fn(), x: 0, z: 0 } },
}));

vi.mock('../entities/player.js', () => ({
  player: { dead: false, hp: 100, ammo: 30, reserve: 90, reloading: false, energy: 0 },
}));

vi.mock('../hud/overlay.js', () => ({
  showMsg:   vi.fn(),
  updateHUD: vi.fn(),
}));

vi.mock('../hud/sndHud.js', () => ({
  setSndHudVisible:   vi.fn(),
  updateMatchHUD:     vi.fn(),
  updateRoundTimerHUD: vi.fn(),
  updateBombTimerHUD: vi.fn(),
  showBombBarWrap:    vi.fn(),
  hideBombBarWrap:    vi.fn(),
  updatePlantBar:     vi.fn(),
  hidePlantBar:       vi.fn(),
  updateDefuseBar:    vi.fn(),
  hideDefuseBar:      vi.fn(),
  showPlantHint:      vi.fn(),
  hidePlantHint:      vi.fn(),
  showSndResult:      vi.fn(),
  hideSndResult:      vi.fn(),
}));

vi.mock('../input.js', () => ({ setGameRunning: vi.fn() }));
vi.mock('../events.js', () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }));

import * as snd from './snd.js';
const { startSnd, nextRound, onAllEnemyTeamDead, onAllFriendsDead, tickSnd,
        getMatchState, getPlayerRole, isSndActive, isMatchOver } = snd;

beforeEach(() => {
  globalThis.document = { exitPointerLock: vi.fn() };
  startSnd();
});

// ── startSnd ──────────────────────────────────────────────────────────────

describe('startSnd', () => {
  it('resets match to round 1', () => {
    expect(getMatchState().matchRound).toBe(1);
  });

  it('resets scores to 0–0', () => {
    const { playerScore, enemyScore } = getMatchState();
    expect(playerScore).toBe(0);
    expect(enemyScore).toBe(0);
  });

  it('sets player role to attack', () => {
    expect(getPlayerRole()).toBe('attack');
  });

  it('sets sndState to live', () => {
    expect(snd.sndState).toBe('live');
  });

  it('clears matchOver flag', () => {
    expect(isMatchOver()).toBe(false);
  });

  it('resets scores even if called mid-match', () => {
    onAllEnemyTeamDead(); // +1 player win
    startSnd();           // restart
    const { playerScore, enemyScore } = getMatchState();
    expect(playerScore).toBe(0);
    expect(enemyScore).toBe(0);
  });
});

// ── isSndActive ───────────────────────────────────────────────────────────

describe('isSndActive', () => {
  it('is true after startSnd (live state)', () => {
    expect(isSndActive()).toBe(true);
  });

  it('is false after a round ends (over state)', () => {
    onAllEnemyTeamDead();
    expect(isSndActive()).toBe(false);
  });
});

// ── endRound win/loss logic ───────────────────────────────────────────────

describe('endRound — team_eliminated (always player win)', () => {
  it('increments playerScore', () => {
    onAllEnemyTeamDead();
    expect(getMatchState().playerScore).toBe(1);
    expect(getMatchState().enemyScore).toBe(0);
  });
});

describe('endRound — friend_team_wiped (always enemy win)', () => {
  it('increments enemyScore', () => {
    onAllFriendsDead();
    expect(getMatchState().playerScore).toBe(0);
    expect(getMatchState().enemyScore).toBe(1);
  });
});

describe('endRound — timeout', () => {
  it('gives enemy win when attacking (timeout = defender wins)', () => {
    // playerRole='attack' after startSnd
    tickSnd(70, {}); // roundTimer=60, advancing 70s triggers timeout
    expect(getMatchState().enemyScore).toBe(1);
    expect(getMatchState().playerScore).toBe(0);
  });

  it('gives player win when defending', () => {
    // advance to round 4 (defend role)
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead(); nextRound(); // round 4 — defend
    expect(getPlayerRole()).toBe('defend');
    tickSnd(70, {});
    expect(getMatchState().playerScore).toBe(4); // 3 from above + 1 timeout win
  });
});

// ── matchOver ─────────────────────────────────────────────────────────────

describe('matchOver', () => {
  it('triggers when playerScore reaches SND_WINS_NEEDED (4)', () => {
    // Win 4 rounds in a row
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead();            // 4th win — matchOver
    expect(isMatchOver()).toBe(true);
  });

  it('triggers when enemyScore reaches SND_WINS_NEEDED (4)', () => {
    onAllFriendsDead(); nextRound();
    onAllFriendsDead(); nextRound();
    onAllFriendsDead(); nextRound();
    onAllFriendsDead();
    expect(isMatchOver()).toBe(true);
  });

  it('triggers when matchRound reaches SND_TOTAL_ROUNDS (7) regardless of score', () => {
    // Alternate wins so neither reaches 4 by round 6, then end round 7
    onAllEnemyTeamDead(); nextRound(); // 1-0, rd2
    onAllFriendsDead();   nextRound(); // 1-1, rd3
    onAllEnemyTeamDead(); nextRound(); // 2-1, rd4
    onAllFriendsDead();   nextRound(); // 2-2, rd5
    onAllEnemyTeamDead(); nextRound(); // 3-2, rd6
    onAllFriendsDead();   nextRound(); // 3-3, rd7
    onAllEnemyTeamDead();              // 4-3, rd7 ends — matchOver
    expect(getMatchState().matchRound).toBe(7);
    expect(isMatchOver()).toBe(true);
  });

  it('is false after 3 wins', () => {
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead(); nextRound();
    onAllEnemyTeamDead();
    expect(isMatchOver()).toBe(false);
  });
});

// ── nextRound role alternation ────────────────────────────────────────────

describe('nextRound', () => {
  it('keeps attack role for rounds 1–3', () => {
    expect(getPlayerRole()).toBe('attack'); // round 1
    onAllEnemyTeamDead(); nextRound();      // round 2
    expect(getPlayerRole()).toBe('attack');
    onAllEnemyTeamDead(); nextRound();      // round 3
    expect(getPlayerRole()).toBe('attack');
  });

  it('switches to defend at round 4', () => {
    onAllEnemyTeamDead(); nextRound(); // rd2
    onAllEnemyTeamDead(); nextRound(); // rd3
    onAllEnemyTeamDead(); nextRound(); // rd4
    expect(getPlayerRole()).toBe('defend');
  });

  it('stays defend through rounds 4–7', () => {
    onAllEnemyTeamDead(); nextRound(); // rd2
    onAllEnemyTeamDead(); nextRound(); // rd3
    onAllEnemyTeamDead(); nextRound(); // rd4 — defend
    onAllEnemyTeamDead(); nextRound(); // rd5
    expect(getPlayerRole()).toBe('defend');
    onAllEnemyTeamDead(); nextRound(); // rd6
    expect(getPlayerRole()).toBe('defend');
  });

  it('increments matchRound', () => {
    onAllEnemyTeamDead(); nextRound();
    expect(getMatchState().matchRound).toBe(2);
  });

  it('resets sndState to live', () => {
    onAllEnemyTeamDead(); // sets state to 'over'
    nextRound();
    expect(snd.sndState).toBe('live');
  });
});
