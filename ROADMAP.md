# VIBE ON DUTY — Development Roadmap

## Current State

```
fps3d.html / index.html — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, async GLTF init
  loop.js               — game loop, 3rd person camera, lean offset, drone tick
  config.js             — all game constants
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  modes/
    snd.js              — S&D match state machine, round lifecycle, HUD, bomb logic
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
    enemies.js          — enemy AI, friendly bot AI, wave management, spawn
    drone.js            — drone runtime (AI, EMP, orbit, kill)
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
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

## Phase 8 — Refactoring targets

### 8.1 — Extract `src/utils/los.js` (SMALL — ~15 lines)

`hasLOS` is currently a private function in `enemies.js`. Extracting it to `src/utils/los.js` would let `friendlyBots`, future turret/camera AI, or grenade line-of-sight checks reuse it without duplication.

**Effort:** low. One new file, update import in `enemies.js`.

---

### 8.2 — Split friendly bot AI into `entities/friendlyBots.js` (MEDIUM)

`tickFriendlyBot` + friendly shooting loop is ~70 lines inside `enemies.js`. Moving it to its own file keeps `enemies.js` focused on hostile AI. Requires:
- `hasLOS` extracted first (Phase 8.1) to avoid circular dep
- `tickEnemyAnimation` either exported from `enemies.js` or moved to `builders/enemyAnimations.js`
- `tickFriendlyBot` receives `enemies` + `killEnemy` as parameters (breaks circular import)

**Effort:** medium. 3 files touched, no logic changes.

---

### 8.3 — Move `tickEnemyAnimation` to `builders/enemyAnimations.js` (SMALL)

`tickEnemyAnimation` belongs with crossfade/animation logic, not AI. Unblocks Phase 8.2.

**Effort:** low. Move function, add export, update one import.

---

### 8.4 — Extract `src/entities/waveSystem.js` (SMALL)

`wave`, `respawnTimer`, `tickWave` are ~20 lines that live in `enemies.js` but are conceptually separate (game-mode logic, not AI). Extracting cleans the boundary between "how enemies move" and "when waves spawn".

**Effort:** low. One new file, update imports in `loop.js` and `enemies.js`.

---

### 8.5 — Config audit: move S&D constants out of `snd.js` into `config.js` (TINY)

`PLANT_TIME`, `DEFUSE_TIME`, `BOMB_FUSE`, `ROUND_TIMER`, `WINS_NEEDED` etc. are hardcoded in `snd.js`. Moving them to `config.js` makes tuning easier and consistent with the rest of the game constants.

**Effort:** trivial. No structural change.

---

### 8.6 — HUD module split: `hud/sndHud.js` (SMALL)

`hud.js` draws the general game HUD. All `updateMatchHUD`, `updateBombTimerHUD`, `showSndResult` etc. functions are currently in `snd.js`, mixing game-logic with DOM manipulation. Extracting them to `hud/sndHud.js` keeps `snd.js` as pure state machine with no DOM knowledge.

**Effort:** low. New file, thin import in `snd.js`.

---

### 8.7 — Unit tests for S&D state machine (MEDIUM)

`snd.js` has no test coverage. Key cases to cover:
- `startSnd` resets all state
- `endRound` correctly assigns win/loss for each result type and both roles
- `matchOver` triggers at 4 wins or round 7
- `nextRound` alternates role at round 4

**Effort:** medium. Add `src/modes/snd.test.js`, mock `scene`/`player`/DOM.

---

### 8.8 — Playwright smoke tests: S&D mode (SMALL)

Add E2E tests for S&D start flow: button click → overlay hides → snd-bar visible → match header shows correct initial values.

**Effort:** low. 2–3 new test cases in `tests/smoke.spec.js`.
