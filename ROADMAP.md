# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, asset-gated init
  loop.js               — game loop, 3rd-person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
  modes/
    modeManager.js      — setMode/getMode/isAnyModeActive (zero-dep registry)
    snd.js              — S&D match state machine, round lifecycle, bomb logic (pure state)
  ai/
    enemyStates.js      — PATROL/SPOTTED/ATTACK state objects + transitionTo, alertEnemy
  builders/
    weapon.js           — player weapon model
    playerBody.js       — full soldier body
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — enemy pistol GLTF
    weaponFBX.js        — player M4/P90 FBX loader
    assetManager.js     — register/loadAll parallel asset registry
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    entityBase.js       — applyEntityBase mixin (isAlive, takeDamage)
    player.js           — player state, movement, dive, lean, reload
    enemies.js          — enemy AI loop, S&D team spawn, kill/death events
    friendlyBots.js     — allied bot AI (A*, LOS, bot-vs-bot shooting)
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
    hud.js              — w2s, setDebugAnimClip, drawHUD dispatcher (35 lines)
    rings.js            — drawRings: ammo/energy/reload rings + spray cone; healthColor helper
    enemyBars.js        — drawEnemyOverlays: drone bar, impact zones, enemy HP bars
    radar.js            — drawMinimap (canvas)
    sndHud.js           — S&D match header, bomb timer, plant/defuse bars, result overlay
  *.test.js             — Vitest unit tests (54 tests across 5 files)
tests/
  smoke.spec.js         — Playwright smoke tests
types/
  entities.d.ts         — EntityBase, Enemy, Player, Drone, AiState, AiCtx interfaces
```

> **Run:** `npm run dev` — Vite dev server. Do NOT open via `file://`.

---

## Phases 1–4 ✅ DONE

npm + Vite, module split from monolithic game.js, Vitest + Playwright tests, ESLint/Prettier/TypeScript tooling.

---

## Phase 5 ✅ DONE — Enemy AI, drone, player mechanics

Velocity + drag movement, stagger on hit, A* path throttle, strafe-orbit drone, EMP pulse, 3rd-person camera, lean, dive, crouch-slide.

---

## Phase 6 ✅ PARTIALLY DONE — GLTF assets + skeletal animation

GLTF enemy + player mesh, AnimationMixer crossfade, M4/P90 FBX weapons, pistol for enemies.

Phase 6.3 — Drone GLTF: wire `src/builders/droneGLTF.js` once `public/models/drone.glb` is available.

---

## Phase 7 ✅ DONE — S&D game mode

Best-of-7 match (first to 4 wins), two bomb sites (A/B), plant/defuse mechanics, 60 s round timer, friendly + enemy 5-bot teams, full round-end conditions, match score HUD.

---

## Phase 8 ✅ DONE — S&D infrastructure refactor

`los.js` extracted, `friendlyBots.js` split out, `tickEnemyAnimation` moved to `enemyAnimations.js`, `waveSystem.js` extracted, S&D constants centralised in `config.js`, `sndHud.js` split for pure-DOM S&D updates, 21 unit tests for S&D state machine, Playwright smoke tests for S&D button and match header.

---

## Phase 9 ✅ DONE — Entity architecture

`entityBase.js` mixin (`isAlive`, `takeDamage`), enemy AI state machine in `ai/enemyStates.js` (PATROL/SPOTTED/ATTACK with enter/tick/exit hooks, `alertEnemy`/`semiAlertEnemy`), TypeScript interfaces in `types/entities.d.ts`.

---

## Phase 10 ✅ DONE — Event bus decoupling

`events.js` 4-line pub/sub. `enemies.js` emits `round:enemyTeamWiped`, `round:friendTeamWiped`, `wave:end` instead of direct cross-module calls. `snd.js` and `waveSystem.js` register listeners at module init.

---

## Phase 11 ✅ DONE — Asset manager

`assetManager.js` with `register`/`loadAll` (`Promise.allSettled`). Start buttons gated (disabled + "LOADING…") until all assets resolve — eliminates race condition. `isSndActive()` scatter-check removed from `main.js`.

---

## Phase 12 — Code quality pass ✅ DONE

### 12.1 ✅ — Drone motion constants → module scope

`DRONE_ACCEL`, `DRONE_STRAFE`, `DRONE_DRAG`, `DRONE_MAX_SPEED`, `DRONE_ORBIT_DIST` moved from inside `updateDrone()` (reallocated every frame) to module-level constants in `entities/drone.js`.

---

### 12.2 ✅ — Fix grenade → drone damage regression

`grenades.js` was calling `killDrone(activeDrone, dmg)` with the old two-param signature after Phase 9.1 removed the `dmg` param from `killDrone`. Drone was killed instantly regardless of blast distance. Fixed: `activeDrone.takeDamage(dmg, killDrone)` — mirrors the pattern in `shoot.js`.

---

### 12.3 ✅ — A* path failure diagnostic

Iteration cap changed from magic `600` to `MAP_W * MAP_H` (covers full map). Dev-mode `console.warn` emitted when loop exhausts without reaching goal — surfaces unreachable-target bugs during development.

---

### 12.4 ✅ — Enemy AI invalid-state guard

`updateEnemies` previously fell back silently to the old state when `STATE_MAP[e.state]` returned undefined. Now: fallback to `PATROL_STATE`, update `e.state` to match, and emit a dev-mode warning. Prevents stale state objects after erroneous external mutations.

---

## Phase 13 ✅ DONE — Remove dead `ehm` hitbox array + break circular dep

`ehm` (enemy hit-mesh array) was built by `rebuildEHM()` but never read — bullet hit detection uses distance checks, not raycasting. Dead code in `shoot.js`, called from `enemies.js`, `drone.js`, `waveSystem.js`, and `main.js`.

### 13.1 ✅ — Delete `ehm` / `rebuildEHM`, remove all call sites

`export let ehm` and `export function rebuildEHM()` removed from `shoot.js`. All six call sites removed (enemies.js ×3, drone.js ×2, waveSystem.js ×1, main.js ×1). Unused `dronePool` import removed from `shoot.js`. **Circular dep eliminated**: `enemies.js` no longer imports from `shoot.js`; dep is now strictly `shoot.js → enemies.js`.

---

## Phase 14 ✅ DONE — HUD module split

`hud/hud.js` was 344 lines with `drawHUD` handling player rings, spray cone, drone bar, impact zones, and enemy HP bars in one function — with duplicated color-interpolation logic.

### 14.1 ✅ — Extract `hud/rings.js`

Player rings (ammo, energy, reload) and spray cone moved to `hud/rings.js`. Shared `healthColor(pct, gMax)` helper centralises the red→green gradient logic used by ammo ring and enemy bars.

### 14.2 ✅ — Extract `hud/enemyBars.js`

Drone HP bar, grenade impact zones, and enemy HP bars (w2s projection, rounded-rect, per-segment gradient, gloss, state dot) moved to `hud/enemyBars.js`. Uses `healthColor` from `rings.js`. `hud.js` is now 35 lines — `drawHUD()` just clears and dispatches to `drawRings()` + `drawEnemyOverlays()`.

---

## Phase 15 ✅ DONE — Game mode abstraction

`loop.js`, `enemies.js`, `drone.js`, and `waveSystem.js` all imported `isSndActive` or `tickSnd` directly from `snd.js`, scattering S&D coupling into core systems.

### 15.1 ✅ — `src/modes/modeManager.js` — central mode registry

`setMode(mode)` / `getMode()` / `isAnyModeActive()` in a zero-dep module. `startSnd()` calls `setMode({ name: 'snd', tick: tickSnd })` to register itself. `loop.js` calls `getMode()?.tick(dt, keys)` instead of the hardcoded `tickSnd()` call — `snd.js` import removed from `loop.js`. `waveSystem.js`, `enemies.js`, `drone.js` replace `isSndActive()` (from `snd.js`) with `isAnyModeActive()` (from `modeManager.js`) — `snd.js` import removed from all three. `enemyStates.js` still imports S&D specifics (bomb positions, plant/defuse ranges) — appropriate since it contains mode-specific AI behaviour.

---

## Phase 16 — Drone GLTF (stretch)

Wire `src/builders/droneGLTF.js` once `public/models/drone.glb` is available. Register as `'drone-glb'` in `assetManager`. Falls back to procedural if missing.
