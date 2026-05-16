import { scene } from '../scene.js';
import { CELL } from '../config.js';
import { MAP, MAP_W, MAP_H, isRamp } from '../map.js';
import { alertEnemy } from '../ai/enemyStates.js';
import { tintEnemyMesh } from '../builders/enemyGLTF.js';
import { on } from '../events.js';
import { enemies, spawnEnemyIntoSlot, restoreFriendIndicator } from './enemies.js';

// S&D API injected at runtime via 'snd:configure' event (avoids circular dep).
let _snd = null;
on('snd:configure', api => { _snd = api; });

// ── S&D spawn constants ───────────────────────────────────────────────────
const ATTACKER_SLOTS = [[15,10],[16,10],[17,10],[15,12],[17,12]];
const SND_DEF_OFFSETS = [
  [0,-1],[1,-1],
  [0, 0],[1, 0],[-1,0],
];
const DEFENDER_FRIEND_OFFSETS = [
  [-1,0],[0,-1],[1,0],
  [-1,0],[0,-1],
];
const SND_ROLES = [
  'assault', 'smg',    'assault', 'sniper', 'assault', // friendly team
  'assault', 'smg',    'sniper',  'assault', 'assault', // enemy team
];

// ── TDM spawn constants ───────────────────────────────────────────────────
const TDM_OFFSETS = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];

function openNear(cx, cz) {
  const cc = Math.max(1, Math.min(MAP_W - 2, cx));
  const cr = Math.max(1, Math.min(MAP_H - 2, cz));
  const c = MAP[cr][cc];
  return (c === 0 || isRamp(c)) ? [cc, cr] : [Math.floor(cx), Math.floor(cz)];
}

export function spawnSndEnemies(sitePositions, roleOverrides = null) {
  const playerRole = _snd?.getPlayerRole() ?? 'attack';
  const NUM_FRIENDS = 5;
  enemies.forEach((e, i) => {
    const weaponRole = roleOverrides?.[i] ?? SND_ROLES[i] ?? 'assault';
    if (i < NUM_FRIENDS) {
      if (playerRole === 'attack') {
        spawnEnemyIntoSlot(e, ATTACKER_SLOTS[i % ATTACKER_SLOTS.length], weaponRole);
      } else {
        const siteIdx = i < 3 ? 0 : 1;
        const [sx, sz] = sitePositions[siteIdx];
        const [dc, dr] = DEFENDER_FRIEND_OFFSETS[i];
        const [fc, fr] = openNear(Math.floor(sx / CELL) + dc, Math.floor(sz / CELL) + dr);
        spawnEnemyIntoSlot(e, [fc, fr], weaponRole);
      }
      e.sndTeam = 'friend';
      e.sndSiteTarget = i % 2;
      tintEnemyMesh(e.mesh, 0x00bb44);
      restoreFriendIndicator(e);
    } else {
      const j = i - NUM_FRIENDS;
      if (playerRole === 'attack') {
        const siteIdx = j < 2 ? 0 : 1;
        const [sx, sz] = sitePositions[siteIdx];
        const [dc, dr] = SND_DEF_OFFSETS[j];
        const [fc, fr] = openNear(Math.floor(sx / CELL) + dc, Math.floor(sz / CELL) + dr);
        spawnEnemyIntoSlot(e, [fc, fr], weaponRole);
      } else {
        spawnEnemyIntoSlot(e, ATTACKER_SLOTS[j % ATTACKER_SLOTS.length], weaponRole);
        alertEnemy(e);
      }
      e.sndTeam = 'enemy';
      e.sndSiteAttack = j < 3 ? 0 : 1;
      tintEnemyMesh(e.mesh, 0xcc2200);
      if (e._friendIndicator) { scene.remove(e._friendIndicator); e._friendIndicator = null; }
    }
  });
}

export function spawnTdmEnemies(mapDef) {
  const atkPos = mapDef.spawnAttacker ?? mapDef.spawnPlayer ?? { x: 16 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 };
  const defPos = mapDef.spawnDefender ?? { x: 4 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 };
  const atkCell = [Math.round(atkPos.x / CELL), Math.round(atkPos.z / CELL)];
  const defCell = [Math.round(defPos.x / CELL), Math.round(defPos.z / CELL)];
  enemies.forEach((e, i) => {
    if (i < 5) {
      const [dc, dr] = TDM_OFFSETS[i];
      const [fc, fr] = openNear(atkCell[0] + dc, atkCell[1] + dr);
      spawnEnemyIntoSlot(e, [fc, fr]);
      e.sndTeam = 'friend';
      tintEnemyMesh(e.mesh, 0x00bb44);
      restoreFriendIndicator(e);
    } else {
      const [dc, dr] = TDM_OFFSETS[i - 5];
      const [fc, fr] = openNear(defCell[0] + dc, defCell[1] + dr);
      spawnEnemyIntoSlot(e, [fc, fr]);
      e.sndTeam = 'enemy';
      tintEnemyMesh(e.mesh, 0xcc2200);
      if (e._friendIndicator) { scene.remove(e._friendIndicator); e._friendIndicator = null; }
      alertEnemy(e);
    }
  });
}

export function rebuildAllEnemies(sndSitePositions = null) {
  if (sndSitePositions) {
    spawnSndEnemies(sndSitePositions);
  } else {
    enemies.forEach((e) => spawnEnemyIntoSlot(e));
  }
}
