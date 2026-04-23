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

### 8.2 ✅ — Split friendly bot AI into `entities/friendlyBots.js`

`tickFriendlyBot` extracted to `entities/friendlyBots.js`. Receives `enemies` + `killEnemy` as params (no circular import). `enemies.js` now focused on hostile AI only.

---

### 8.3 ✅ — Move `tickEnemyAnimation` to `builders/enemyAnimations.js`

`tickEnemyAnimation` + jump-phase state machine moved to `enemyAnimations.js`. Called by both enemy and friendly bot tickers.

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

### 8.7 ✅ — Unit tests for S&D state machine

21 tests in `src/modes/snd.test.js` covering `startSnd` reset, `endRound` win/loss for all result types and both roles, `matchOver` at 4 wins or round 7, `nextRound` role alternation at round 4.

---

### 8.8 ✅ — Playwright smoke tests: S&D mode

S&D button visible, clicking hides overlay + shows snd-bar, match header initial values (ROUND 1/7, 0–0) verified. 3 test cases in `tests/smoke.spec.js`.

---

## Phase 9 — Entity architecture

### 9.1 ✅ — Shared entity mixin: `src/entities/entityBase.js`

`applyEntityBase(obj)` stamps `isAlive()` and `takeDamage(dmg, onDie)` onto entities at spawn. Applied in `spawnEnemyIntoSlot` and `spawnNewDrone`. Duplicate `hp = Math.max(0, hp-dmg); if (hp<=0) kill()` pattern removed from `shoot.js` (bullets + melee), `friendlyBots.js`, and `enemies.js` (bot-vs-bot). `killDrone` signature simplified (dmg param removed).

---

### 9.2 ✅ — Enemy AI state machine: `src/ai/enemyStates.js`

`PATROL_STATE`, `SPOTTED_STATE`, `ATTACK_STATE` objects with `enter`/`tick`/`exit` hooks. `transitionTo(e, state)` calls exit on current and enter on next. `updateEnemies` shrunk from ~230 lines to ~80 — it now computes ctx per-enemy and calls `e._aiState.tick(e, dt, ctx)`. S&D movement, bot-vs-bot, and player shooting all live in `enemyStates.js`. `alertEnemy` / `semiAlertEnemy` helpers replace bare `e.state = 'attack'` mutations in shoot.js, grenades.js, drone.js.

---

### 9.3 ✅ — TypeScript interfaces for entity shapes

`types/entities.d.ts` declares `EntityBase`, `Enemy`, `Player`, `Drone`, `AiState`, `AiCtx`. JSDoc `@type` annotations wired to spawn sites in `entityBase.js`, `enemies.js`, `player.js`, `drone.js`. `tsconfig.json` updated to include `types/`. No runtime changes — pure editor/IDE type checking.

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