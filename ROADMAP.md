# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, async GLTF init
  loop.js               — game loop, 3rd person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
  modes/
    snd.js              — S&D match state machine, round lifecycle, bomb logic (pure state — no DOM)
  builders/
    weapon.js           — player weapon model
    playerBody.js       — full soldier body
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — enemy pistol GLTF
    weaponFBX.js        — player M4/P90 FBX loader
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    player.js           — player state, movement, dive, lean, reload
    enemies.js          — enemy AI, friendly bot AI, S&D team spawn
    drone.js            — drone runtime (AI, EMP, orbit, S&D recon drones)
    waveSystem.js       — wave state, tickWave, triggerWaveEnd
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
  utils/
    los.js              — hasLOS raycaster utility
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade particles + impact zones
    meleeRange.js       — melee ring flash
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — w2s, drawHUD (canvas)
    radar.js            — drawMinimap (canvas)
    sndHud.js           — S&D match header, bomb timer, plant/defuse bars, result overlay
  *.test.js             — Vitest unit tests
tests/
  smoke.spec.js         — Playwright smoke tests
```

> **Run:** `npm run dev` — Vite dev server. Do NOT open via `file://`.

---

## Phase 1–4 ✅ DONE

npm + Vite, module split from monolithic game.js, Vitest + Playwright tests, ESLint/Prettier/TypeScript tooling.

---

## Phase 5 — Enemy AI, drone, player mechanics ✅ DONE

Velocity + drag movement, stagger on hit, A* path throttle, strafe-orbit drone, EMP pulse, 3rd-person camera, lean, dive, crouch-slide.

---

## Phase 6 — GLTF assets + skeletal animation ✅ PARTIALLY DONE

GLTF enemy + player mesh, AnimationMixer crossfade, M4/P90 FBX weapons, pistol for enemies.

Phase 6.3 — Drone GLTF: wire `src/builders/droneGLTF.js` once `public/models/drone.glb` is available.

---

## Phase 7 — S&D game mode ✅ DONE

- Best-of-7 match (first to 4 round wins); rounds 1–3 player attacks, 4–6 defends
- Two bomb sites (A/B) with 3D ring + pole + point-light markers
- Plant (hold G, 3 s) and defuse (hold G near bomb, 5 s); 40 s fuse
- 60 s round timer; timeout = defender win
- Friendly team of 5 bots spawned with player; enemy team of 5 at opposing side
- Friendly bots A*-pathfind to sites and shoot enemy bots (LOS check)
- Enemy attackers rush assigned site and plant when in range
- Round ends on: bomb exploded, bomb defused, team elimination, timeout, team wipe
- Match score HUD: role label, round number, score, round timer
- `entities/drone.js` extracted from `enemies.js` (no circular deps)

---

## Phase 8 — Refactoring targets (S&D infrastructure)

### 8.1 ✅ — Extract `src/utils/los.js`

`hasLOS` extracted to `src/utils/los.js`. Used by enemies, friendly bots, drone scans.

---

### 8.2 — Split friendly bot AI into `entities/friendlyBots.js` (MEDIUM)

`tickFriendlyBot` + friendly shooting loop is ~80 lines inside `enemies.js`. Moving it to its own file keeps `enemies.js` focused on hostile AI. Requires:
- `tickEnemyAnimation` exported from `enemies.js` or moved to `builders/enemyAnimations.js` first (see 8.3)
- `tickFriendlyBot` receives `enemies` + `killEnemy` as parameters to avoid circular import

**Effort:** medium. 3 files touched, no logic changes.

---

### 8.3 — Move `tickEnemyAnimation` to `builders/enemyAnimations.js` (SMALL)

`tickEnemyAnimation` belongs with crossfade/animation logic, not AI. Unblocks 8.2.

**Effort:** low. Move function, add export, update one import.

---

### 8.4 ✅ — Extract `src/entities/waveSystem.js`

`wave`, `respawnTimer`, `tickWave`, `triggerWaveEnd` extracted. Circular dep avoided by passing `enemies`+`spawnEnemyIntoSlot` as params from loop.js.

---

### 8.5 ✅ — Config audit: S&D constants → `config.js`

`SND_PLANT_TIME/RANGE`, `SND_DEFUSE_TIME/RANGE`, `SND_BOMB_FUSE`, `SND_ROUND_TIMER`, `SND_ROUNDS_PER_HALF`, `SND_TOTAL_ROUNDS`, `SND_WINS_NEEDED` moved to `config.js`.

---

### 8.6 ✅ — HUD module split: `hud/sndHud.js`

All DOM manipulation for S&D extracted to `hud/sndHud.js`. `snd.js` is now a pure state machine — no `document.getElementById` calls.

---

### 8.7 — Unit tests for S&D state machine (MEDIUM)

`snd.js` has no test coverage. Key cases:
- `startSnd` resets all state
- `endRound` assigns win/loss correctly for each result type and both roles
- `matchOver` triggers at 4 wins or round 7
- `nextRound` alternates role at round 4

**Effort:** medium. Add `src/modes/snd.test.js`, mock `scene`/`player`/DOM.

---

### 8.8 — Playwright smoke tests: S&D mode (SMALL)

Button click → overlay hides → snd-bar visible → match header shows correct initial values.

**Effort:** low. 2–3 new test cases in `tests/smoke.spec.js`.

---

## Phase 9 — Entity architecture

### 9.1 — Shared entity mixin: `src/entities/entityBase.js` (SMALL)

**Problem:** `takeDamage` logic is duplicated across shoot.js (bullets), enemies.js (friendly bot shots), and drone.js (EMP + bullet hits). Each site manually clamps HP and calls the right kill function.

**Solution:** A plain-object factory — not a class — that stamps common methods onto any entity object:
```js
// entityBase.js
export function applyEntityBase(obj) {
  obj.isAlive = () => !obj.dead;
  obj.takeDamage = (dmg, onDie) => {
    if (obj.dead) return;
    obj.hp = Math.max(0, obj.hp - dmg);
    if (obj.hp <= 0) onDie(obj);
  };
}
```
Call at spawn time: `applyEntityBase(enemy)`. Keeps `spawnEnemyIntoSlot`'s `Object.assign` pattern intact — methods are just extra properties.

**Why not a class hierarchy?** Enemies are slot-reused via `Object.assign(e, {...})` across rounds. Subclassing would break the slot-reuse pattern without a full respawn-factory rewrite. Player, enemy, and drone also diverge significantly in state shape (lean/pitch/yaw vs path/state/sndTeam). The mixin gets the benefit (shared takeDamage, isAlive) at near-zero cost.

**Effort:** low. One new file (~15 lines), apply in `enemies.js` + `drone.js`, simplify call sites in `shoot.js`.

---

### 9.2 — Enemy AI state machine: `src/ai/enemyStates.js` (MEDIUM)

**Problem:** Enemy AI in `updateEnemies` is a large `if/else if` chain on `e.state`. Adding a new state (e.g. `suppressed`, `flanking`) means modifying a 200-line function.

**Solution:** State objects with `enter`, `tick`, and `exit` hooks:
```js
const PATROL_STATE = {
  enter(e) { e.alertTimer = 0; },
  tick(e, dt, ctx) { /* patrol waypoints */ },
  exit(e) {},
};
```
`transitionTo(e, ATTACK_STATE)` calls `exit` on current, `enter` on next. AI logic becomes composable and individually testable. S&D-specific states (`rush_site`, `plant_bomb`, `defuse_bomb`) slot in without touching generic patrol/attack logic.

**Effort:** medium–high. Isolated to `enemies.js` and new `src/ai/` folder. No other files need changing.

---

### 9.3 — TypeScript interfaces for entity shapes (SMALL, prerequisite for 9.4+)

**Problem:** Enemy, player, and drone objects are untyped plain objects. Nothing prevents typos like `e.snfTeam` or missing properties when adding new entity state.

**Solution:** Add `.d.ts` declaration files (no TS compilation needed — just JSDoc + `// @ts-check`):
```ts
// types/entities.d.ts
interface EntityBase { hp: number; dead: boolean; x: number; z: number; mesh: THREE.Object3D; }
interface Enemy extends EntityBase { state: 'patrol'|'spotted'|'attack'; sndTeam?: 'friend'|'enemy'; ... }
interface Player extends EntityBase { ammo: number; reserve: number; yaw: number; pitch: number; ... }
```
Catches shape bugs in editors without a TS build step.

**Effort:** low. No runtime changes, pure type annotations.

---

## Phase 10 — Decoupling: event bus

### 10.1 — `src/events.js` — lightweight event emitter (MEDIUM)

**Problem:** Modules call each other directly in ways that create tight coupling and circular import risks:
- `shoot.js` imports `killEnemy` from `enemies.js`
- `enemies.js` imports `onAllEnemyTeamDead`, `onAllFriendsDead` from `snd.js`
- `drone.js` imports `isSndActive` from `snd.js` and `enemies` from `enemies.js`

Adding a new game mode (e.g. deathmatch) means threading imports through all these files.

**Solution:** A tiny pub/sub emitter:
```js
// events.js
const _bus = {};
export const on  = (ev, fn) => (_bus[ev] ??= []).push(fn);
export const off = (ev, fn) => _bus[ev] = (_bus[ev] || []).filter(f => f !== fn);
export const emit = (ev, data) => (_bus[ev] || []).forEach(f => f(data));
```
`shoot.js` emits `emit('entity:hit', { entity: e, dmg })`.  
`enemies.js` listens with `on('entity:hit', ...)`.  
`snd.js` listens with `on('enemy:died', ...)` for round-end checks.

**Benefit:** adding a deathmatch or TDM mode means registering new listeners, not editing existing files.

**Effort:** medium. New file is tiny; refactoring call sites is the work (~8 call sites to convert).

---

## Phase 11 — Asset management

### 11.1 — `src/builders/assetManager.js` (MEDIUM)

**Problem:** GLTF, FBX loaders are separate `async` functions called independently in `main.js` via `Promise.all`. The GLTF-loaded race condition (S&D started before GLTF finishes) is handled by a special `isSndActive()` check scattered across `main.js`. Adding a new asset means touching `main.js` loading logic.

**Solution:** Centralized `AssetManager` with a registry:
```js
assetManager.register('enemy-glb',  () => tryLoadEnemyGLTF());
assetManager.register('player-p90', () => tryLoadP90ForHand());
await assetManager.loadAll();
// all assets guaranteed present before game starts
```
Race condition eliminated: game only starts after all assets resolve. Fallbacks registered per-asset, not scattered across callers.

**Effort:** medium. Isolated to `main.js` + `builders/`. No gameplay logic changes.
it