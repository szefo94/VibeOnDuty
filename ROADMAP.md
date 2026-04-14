# VIBE ON DUTY — Development Roadmap

## Current State

```
fps3d.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: fps3d.html
.prettierrc             — Prettier config
eslint.config.js        — ESLint 9 flat config
tsconfig.json           — TypeScript (allowJs, noEmit, checkJs: false)
src/
  main.js               — entry: DOM listeners, start button, startLoop()
  loop.js               — game loop, 3rd person camera (tpTransition), lean offset
  config.js             — all game constants
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  builders/
    weapon.js           — player weapon model
    playerBody.js       — full soldier body (plate carrier, helmet, rifle)
    enemy.js            — ground soldier model (procedural)
    drone.js            — drone model (procedural)
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    player.js           — player state, movement, dive, lean, reload, updatePlayer
    enemies.js          — enemy + drone AI, wave management, EMP, strafe orbit
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade particles + impact zones
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — w2s, drawHUD (canvas)
    radar.js            — drawMinimap (canvas)
  *.test.js             — Vitest unit tests (map, math, astar, damage)
tests/
  smoke.spec.js         — Playwright smoke tests
```

> **Run:** `npm run dev` — Vite dev server. Do NOT open via `file://`.

### Migration notes
- Three.js upgraded CDN r128 → npm r160. Light intensities scaled: `× Math.PI` (directional/ambient), `× 4π` (point).
- `renderer.outputColorSpace = THREE.SRGBColorSpace` replaces deprecated `outputEncoding`.

---

## Phase 1 — npm + localhost ✅ DONE

- Vite dev server (`npm run dev`), `vite.config.js` with `fps3d.html` entry
- `npm install three` — CDN removed
- `vitest` and `@playwright/test` installed

---

## Phase 2 — Module split ✅ DONE

Drained monolithic `game.js` into `src/` modules across 8 batches. `game.js` deleted.
`fps3d.html` entry changed to `src/main.js`.

| Batch | Files |
|-------|-------|
| 1 — Scene | `scene.js`, `materials.js`, `lighting.js` |
| 2 — Builders | `level.js`, `builders/weapon.js`, `builders/playerBody.js`, `builders/enemy.js`, `builders/drone.js` |
| 3 — FX | `fx/tracers.js`, `fx/impacts.js`, `fx/particles.js` |
| 4 — Input | `input.js` |
| 5 — Entities | `entities/ammoDrops.js`, `entities/enemies.js`, `entities/grenades.js`, `entities/player.js` |
| 6 — Combat | `combat/shoot.js`, `hud/hitmarker.js` |
| 7 — HUD | `hud/overlay.js`, `hud/hud.js`, `hud/radar.js` |
| 8 — Loop + entry | `loop.js`, `main.js` |

> Drone state merged into `enemies.js` (not a separate file) due to wave-state coupling.
> Circular deps (player↔shoot, player↔grenades, enemies↔shoot) are safe — all cross-module refs are inside function bodies, never at init time.

---

## Phase 3 — Testing ✅ DONE

### Unit tests (Vitest) — `npm test`

| File | Coverage |
|------|---------|
| `src/map.test.js` | `groundElevation` ramp interpolation, `canMoveTo` wall blocking |
| `src/math.test.js` | `normA` wrapping, `slerp` convergence |
| `src/astar.test.js` | path finding, wall blocking, empty path at destination |
| `src/combat/damage.test.js` | falloff at 0/50/100%, entity vs player formulas |

33 tests, all passing.

### Smoke tests (Playwright) — `npm run test:e2e`

4 tests: page loads, DROP IN hides overlay, HUD elements present, initial ammo/HP values correct.

---

## Phase 4 — Quality of life ✅ DONE

| Tool | Config | Script |
|------|--------|--------|
| Prettier | `.prettierrc` (semi, singleQuote, printWidth 100) | `npx prettier --write "src/**/*.js"` |
| ESLint 9 | `eslint.config.js` (flat config, `globals` browser) | `npm run lint` |
| TypeScript | `tsconfig.json` (allowJs, noEmit, checkJs: false) | `npm run typecheck` |
| Vite build | entry `fps3d.html` | `npm run build` → `dist/` |

---

## Phase 5 — Enemy AI, drone, player mechanics ✅ PARTIALLY DONE

### 5.3 — Enemy movement ✅ DONE

| Change | Notes |
|--------|-------|
| Velocity + drag | Accel `12×` toward path node, drag `10×`; replaces direct position delta |
| Stagger on hit | `velX/Z = 4` knockback + `stunTimer = 0.28 s` set in `shoot.js` on bullet hit |
| Faster aim rotation | `ENEMY_ROT_SPD × 2.5` in attack state, normal in spotted/patrol |
| Path throttle | A* recalcs max once per 600–800 ms OR when player moves to a new cell |

### 5.4 — Drone upgrade ✅ DONE

| Change | Notes |
|--------|-------|
| Strafe orbit | Tangential velocity ⊥ to player direction; reverses every 3–7 s |
| Physics fix | `velX/Z` in units/s applied as `× dt`; drag `3×`; speed cap `5 u/s`; edge zeroes velocity |
| EMP pulse | At HP < 30%: `player.slowTimer = 2 s` (40% move speed), eye flashes orange, 5 s cooldown |
| Burst fire | Implemented but **commented out** in `updateDrone` (3 bullets / 150 ms / 2 s cooldown) |

### 5.5 — Player body (3rd person) ✅ DONE

`src/builders/playerBody.js` rebuilt from 4 primitives to a full soldier:
boots, lower legs, knee pads, thighs, belt, plate carrier (front plate, back plate, side panels),
pauldrons, upper arms, elbow pads, forearms, gloved hands, neck, balaclava head,
composite helmet (brim + dome + cheek straps), visor, assault rifle at hip.

### 5.6 — 3rd person camera ✅ DONE

| Feature | Key | Notes |
|---------|-----|-------|
| Toggle 1st ↔ 3rd person | `V` | `tpTransition` lerp at speed 4.5 (~0.5 s); weapon/body visibility crossfade |
| Shoulder swap | `B` | `tpSideSmooth` lerp at speed 6; only active in 3rd person |
| Camera orientation | — | Player quaternion preserved — no `lookAt`, aiming works normally |
| Over-the-shoulder offset | — | `TP_BACK = 2.6`, `TP_SIDE = 0.85`, `TP_HEIGHT = 0.12` in `loop.js` |

### 5.7 — Player movement ✅ DONE

| Feature | Key | Notes |
|---------|-----|-------|
| Lean | `Q` / `E` | ±0.28 rad roll + ±0.38 unit side shift; lerp speed 3.5; suppressed during slide/dive |
| Dive | `Z` | Forward launch 12 u/s + upward kick 2.8; camera pitches 0.55 rad; lands into boosted slide |
| Crouch-landing slide | hold `CTRL` on landing | Converts air momentum into slide if speed > 60% of walk speed |

---

## Phase 6 — GLTF assets + skeletal animation ✅ PARTIALLY DONE

### 6.1 — Asset pipeline ✅ DONE

`src/builders/enemyGLTF.js` — tries `public/models/enemy.glb` via `GLTFLoader` on startup.
`main.js` wraps `startLoop()` in an async IIFE: `await tryLoadEnemyGLTF(); startLoop();`
Falls back silently to procedural enemies if no file is found.

**Free CC0 sources for `public/models/enemy.glb`:**
- [Quaternius](https://quaternius.com) — low-poly stylised soldiers, robots (CC0)
- [Kenney.nl](https://kenney.nl/assets) — blocky sci-fi soldiers, drones (CC0)
- [Mixamo](https://www.mixamo.com) — auto-rig + walk/run/shoot/death animations (free with Adobe account, export GLB via Blender)

**Expected animation clip names** (any alias accepted):

| State | Accepted names |
|-------|---------------|
| idle | `Idle`, `idle`, `T-Pose` |
| walk | `Walk`, `walk`, `Walking` |
| run | `Run`, `run`, `Running` |
| attack | `Shoot`, `shoot`, `Attack`, `attack` |

### 6.2 — AnimationMixer ✅ DONE

`src/builders/enemyAnimations.js` — replaces manual `animateEnemyLegs` with proper `AnimationClip` + `AnimationMixer`.

| Change | Notes |
|--------|-------|
| Named mesh children | `legL/R`, `thighL/R`, `kneeL/R`, `armSwingL/R` — targeted by `NumberKeyframeTrack` |
| Shared clips | `idle / walk / run / attack` built once as sine-wave `AnimationClip`s, reused across all 10 enemy mixers |
| Per-enemy mixer | `buildEnemyMixer(mesh)` — all actions pre-started at weight 0; idle starts at weight 1; random time offset so enemies don't step in sync |
| Crossfade | `crossfade(e, clipName, dur=0.22)` — calls Three.js `crossFadeTo(action, dur, warp=true)` for smooth stride-synced transitions |
| State → clip | `patrol/spotted` → `idle`/`walk`; `attack` → `run`/`attack` depending on movement |

### 6.3 — Drone GLTF (PLANNED)

Wire `src/builders/droneGLTF.js` once a drone GLB with rotor animation is available.

---

## Next up

Phase 6.3 — Drone GLTF (when `public/models/drone.glb` is available).

Drop `public/models/enemy.glb` to activate GLTF enemies automatically — no code changes needed.

Codebase health:
- Fully modular ES modules under `src/`
- 33 Vitest unit tests + 4 Playwright smoke tests passing
- ESLint 9 flat config, zero warnings/errors
- Prettier formatted
- TypeScript `allowJs` type checking clean
- Production build via `vite build`
