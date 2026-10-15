---
last_mapped_commit: 6ec59feb26327c8f9090cacdfedfd95e5d06bd61
last_mapped_at: 2026-10-03
---
<!-- refreshed: 2026-10-03 -->

# Architecture

**Analysis Date:** 2026-10-03

## System Overview

```text
Browser DOM / input
index.html + style.css -> src/main.js
                              |
          asset boot / mode start / map activation
                              |
                 src/loop.js (requestAnimationFrame)
                   /          |          \
 src/entities + src/ai   src/modes    src/builders + src/hud
                   \          |          /
              src/map.js + src/scene.js
                   |                      |
        live tile/height data     WebGL + canvas + DOM
        src/maps/*.js             index.html
                   |
          editor save/share
          src/editor/mapEditor.js -> localStorage / URL
```

The application is a browser FPS built from JavaScript ES modules. Offline modes retain browser singletons. Online authority uses `server/index.js` (one built-game HTTP/HTTPS/Colyseus link), `server/tdmRoom.js` (replicated state and fixed server tick), `src/shared/tdmSimulation.js` and `world.js` (owned headless state/queries), `combat.js` (M4 eligibility and swept first impacts), `movement.js` (numeric walk/sprint/jump/crouch), `protocol.js` (exact untrusted intent rejection and bounded session queues), and `src/network/onlineSession.js` (intentions, remote rigs and private feedback). `server/cli.js` validates operator configuration; `server/tls.js` manages ignored restricted atomic certificate pairs. `main.js` owns online entry/leave; `loop.js` skips offline simulation online and processes snapshots before life/play gates. Greek Columns gameplay data is canonical under `src/shared/maps/bunker.js`, while visual materials/extras remain under `src/maps/bunker.js`. Bodies replicate stance, aim, vertical velocity, server tick and consumed sequence; unlocked clients send explicit neutral intentions. TDM lifecycle is implemented in the owned rules/simulation layer; prediction and cross-device responsiveness belong to Phase 2. No database or account layer is implemented.

## Component Responsibilities

Online combat now lives in `src/shared/combat.js`: room-owned millisecond weapon
eligibility and seeded heat/spread, second-based travelling projectiles, earliest
terrain/actor sweeps, target-life rechecks and one lethal transition. The room
replicates health as float64 and delivers `hit-confirmed` once only to the shooter.
Unsupported combat messages share the input rate budget and are explicitly
rejected. `src/shared/tdmRules.js` owns immutable operator settings, blue/red smaller-team
assignment, stable guest ordinals, immediate solo start and current-life score. The
simulation resolves current-step impacts before score/time expiry, resets life inventory
on valid unoccupied respawns and preserves teams/settings through the fixed15-second
results rematch. Match/life transitions clear session queues/cursors and private event
deduplication; zero humans suspend matches. Online UI consumes the same replicated
winner/score/deadlines, releases pointer lock on death/results and offers Resume/Leave.

| Component | Responsibility | File |
|-----------|----------------|------|
| Boot/menu coordinator | Register assets, bind DOM controls, activate maps and start modes | `src/main.js` |
| Frame coordinator | Input polling, simulation, animation, temporary camera placement, rendering | `src/loop.js` |
| Scene singleton | WebGL renderer, scene, camera, HUD canvas and resize binding | `src/scene.js` |
| Player | Mutable player state, movement, reload, projectile/effect ticking | `src/entities/player.js` |
| Enemy pool | Spawn slots, enemy deaths, player death and active entity arrays | `src/entities/enemies.js` |
| Enemy orchestration | Team spawn layouts and frame updates | `src/entities/enemySpawning.js`, `src/entities/enemyUpdate.js` |
| AI state machine | Patrol/spotted/attack states and transition hooks | `src/ai/enemyStates.js` |
| Combat | Weapon animation, bullets, collision/hits and melee | `src/combat/shoot.js` |
| Modes | Active mode contract, round/match/drill logic, shop and economy | `src/modes/modeManager.js`, `src/modes/snd.js`, `src/modes/tdm.js`, `src/modes/trainingRange.js` |
| World | Live map bindings, ground/collision queries, tile codec and mesh construction | `src/map.js`, `src/tiles.js`, `src/level.js` |
| Asset/animation layer | Model templates, skeleton clones, clip preparation and transitions | `src/builders/enemyGLTF.js`, `src/builders/enemyAnimations.js` |
| Editor | Map authoring, serialization, save slots, preview and playtest | `src/editor/mapEditor.js` |
| Presentation | DOM overlays, canvas HUD, radar and transient effects | `src/hud/`, `src/fx/` |
| Death feedback | Live killer camera and damage totals | `src/replay/killcam.js`, `src/replay/damageTracker.js` |

## Pattern Overview

**Overall:** Module-singleton game simulation with procedural orchestration and selective event decoupling.

**Key Characteristics:**
- Read and mutate shared exported state rather than constructing an application container: `src/entities/player.js`, `src/entities/enemies.js`, `src/map.js`.
- The main loop explicitly invokes subsystem ticks; an active mode contributes a `tick(dt, keys)` function through `src/modes/modeManager.js`.
- Synchronous events connect deaths, economy and S&D API configuration through `src/events.js`.
- Visual construction is separated from many entity ticks, but simulation still directly calls HUD/effects and uses the camera: `src/entities/player.js`, `src/ai/enemyStates.js`.

## Layers

**Browser coordination:**
- Purpose: Translate menus and device controls into gameplay actions.
- Location: `src/main.js`, `src/input.js`, `src/touch.js`, `src/gamepad.js`.
- Contains: DOM listeners, selected map, pointer-lock state and mode entry functions.
- Depends on: Entities, modes, world activation, builders and HUD.
- Used by: `index.html` and `src/loop.js`.

**Simulation and rules:**
- Purpose: Maintain combat, movement, bots and mode outcomes.
- Location: `src/entities/`, `src/combat/`, `src/ai/`, `src/modes/`.
- Contains: Mutable objects, state-machine objects, projectile routines and timers.
- Depends on: `src/config.js`, world helpers, scene camera, presentation and events.
- Used by: `src/main.js` and `src/loop.js`.

**World and reusable math:**
- Purpose: Decode tiles, query surfaces/collision and calculate navigation/damage.
- Location: `src/map.js`, `src/tiles.js`, `src/rampMath.js`, `src/math.js`, `src/astar.js`, `src/combat/damage.js`.
- Contains: Live map data and mostly computational helpers.
- Depends on: Configuration and map definitions; `src/astar.js` consumes first-floor raw map data.
- Used by: Player, bots, combat, editor and level construction.

**Rendering and assets:**
- Purpose: Create/dispose models and display world/game state.
- Location: `src/scene.js`, `src/level.js`, `src/builders/`, `src/hud/`, `src/fx/`.
- Contains: Three.js objects, loaders, mixers, DOM and canvas drawing.
- Depends on: Browser APIs, Three.js and gameplay/world state.
- Used by: Boot, entity updates and frame rendering.

## Data Flow

### Primary Request Path

This is a frame-driven client; the primary path is boot followed by frame simulation.

1. `index.html:402` loads `src/main.js`; imports initialize scene/HUD/input singletons.
2. `src/main.js:388` awaits the registered asset loaders. `src/builders/assetManager.js` uses `Promise.allSettled` and maps failures to false.
3. `src/main.js` rebuilds GLTF-backed characters when available, initializes the editor and calls `startLoop()`.
4. `src/loop.js:75` computes seconds elapsed with a 50 ms cap and polls controls.
5. While `gameRunning`, `src/loop.js` ticks player, enemies, drones, waves, adaptive difficulty and the active mode.
6. `src/loop.js` updates mixers, temporarily moves the camera for third person/lean, renders WebGL, restores the simulation eye position unless killcam is active, draws HUD and schedules another frame.

### Map and Mode Start

1. Menu handlers select a definition from the registry in `src/main.js:69`.
2. `src/main.js:106` activates collision data with `setActiveMap(def)`, then builds visuals with `buildLevel(def)`.
3. S&D additionally calls `setSndMap(def)`; `src/modes/snd.js:132` installs its mode and emits `snd:configure` before team spawning.
4. `src/entities/enemySpawning.js` fills the shared pool and sets `sndTeam`; `src/entities/enemyUpdate.js` routes friendly bots separately.
5. Structured mode ticks run through `getMode()?.tick(dt, keys)` in `src/loop.js`. Waves use the null-mode convention in `src/modes/modeManager.js`.

### Character Asset Path

1. `src/builders/enemyGLTF.js:276` probes and loads `public/models/enemy.glb` using `import.meta.env.BASE_URL`.
2. Copy track buffers, strip rest-equivalent tracks, compose rifle movement clips, normalize quaternion signs and align jump boundaries before publishing the template in `src/builders/enemyGLTF.js`.
3. Clone skeletons and create a mixer/action table per character through `buildEnemyMesh()` or `buildPlayerMesh()`.
4. `src/builders/enemyAnimations.js` manages weighted locomotion, action overrides and post-mixer inertia. `src/loop.js` selects player actions.
5. `src/builders/characterResources.js` disposes owned resources while retaining registered template geometry.

### Editor Save and Share

1. `src/editor/mapEditor.js` stores editable floors, markers and palette state independently.
2. Save slots serialize encoded maps into `vod_slot_<index>` localStorage keys; export/share uses base64 JSON.
3. Preview/playtest builds a map definition, activates it and constructs the level using `src/map.js` and `src/level.js`.
4. `src/main.js:84` decodes a URL map through `mapDefFromB64()`; this public decoder accepts v2 floor data.

**State Management:**
- Player, enemies, input, scene and maps use mutable singletons/live bindings in `src/entities/player.js`, `src/entities/enemies.js`, `src/input.js`, `src/scene.js`, `src/map.js`.
- Mode-specific state stays in module scope in `src/modes/snd.js`, `src/modes/tdm.js` and `src/modes/trainingRange.js`.
- There is no unified teardown contract in `src/modes/modeManager.js`; callers coordinate resets explicitly in `src/main.js`.

## Key Abstractions

**Mode:**
- Purpose: Supply structured game rules to the loop.
- Examples: `src/modes/modeManager.js`, `src/modes/snd.js`, `src/modes/tdm.js`.
- Pattern: Nullable `{ name, tick }`; adaptive difficulty overlays wave play through `src/ai/difficultyAdapter.js`.

**Enemy state:**
- Purpose: Encapsulate AI behavior and transition hooks.
- Examples: `src/ai/enemyStates.js`, `src/entities/enemyUpdate.js`.
- Pattern: State objects expose `name`, `tick` and optional `enter/exit`; use `transitionTo()` to keep `state` and `_aiState` consistent.

**Map definition:**
- Purpose: Couple collision data, metadata, spawns and visual customization.
- Examples: `src/maps/bunker.js`, `src/maps/range.js`, `src/editor/mapEditor.js`.
- Pattern: Width/height plus tile and height arrays, optional floors/sites/spawns/materials and `buildExtras`.

**Entity damage mixin:**
- Purpose: Attach shared health reduction/death-callback behavior.
- Examples: `src/entities/entityBase.js`.
- Pattern: `applyEntityBase(obj)` attaches `takeDamage(dmg, onDie)`; verify runtime fields against the incomplete declarations in `types/entities.d.ts`.

## Entry Points

**Browser boot:**
- Location: `index.html`, `src/main.js`.
- Triggers: Browser loads the page through Vite or static hosting.
- Responsibilities: Import initialization, UI binding, assets and frame startup.

**Frame loop:**
- Location: `src/loop.js`.
- Triggers: `startLoop()` and `requestAnimationFrame`.
- Responsibilities: Coordinate simulation and rendering.

**Editor:**
- Location: `src/editor/mapEditor.js`.
- Triggers: Editor button in `src/main.js`; preview/playtest controls.
- Responsibilities: Author maps, persist slots and share definitions.

**Offline retargeting:**
- Location: `tools/retarget.py`, `tools/README.md`.
- Triggers: Blender background invocation.
- Responsibilities: Retarget FBX clips onto the GLB skeleton and strip gameplay-conflicting root movement.

## Architectural Constraints

- **Threading:** Browser main-thread simulation and rendering in `src/loop.js`; no worker layer is detected.
- **Global state:** Treat `src/scene.js`, `src/map.js`, `src/input.js`, `src/entities/player.js` and `src/entities/enemies.js` as shared process state.
- **Circular imports:** `src/entities/player.js` imports `src/combat/shoot.js`, which imports player state. Keep top-level access ordering safe. S&D avoids direct reverse imports by publishing its API through `src/events.js`.
- **Camera contract:** `camera.position` represents the simulation eye outside rendering; preserve restoration in `src/loop.js` and coordinate killcam overrides.
- **Time units:** Frame delta is seconds in `src/loop.js`; reload/shoot/AI fields also use milliseconds in `src/entities/player.js` and `src/ai/enemyStates.js`. Preserve each field's unit.
- **Map axes:** Arrays are row/column; `worldToCell()` returns column/row in `src/map.js`. Use `groundElevation(x, z, refY)` for floor/ramp-aware surfaces.
- **Navigation:** `src/astar.js` works on first-floor 2D raw tiles and blocks tile 1; physical collision in `src/map.js` has richer semantics.
- **Browser imports:** `src/scene.js` constructs WebGL/DOM state at import time; pure Node tests should target computational modules or supply mocks.
- **Asset ownership:** Register template geometry before cloning and dispose instance resources through `src/builders/characterResources.js`.
- **Project skills:** No repository-local `.codex/skills/` or `.agents/skills/` directories are detected; `AGENTS.md` supplies project-specific lifecycle and animation guidance.

## Anti-Patterns

### Partial mode lifecycle reset

**What happens:** `returnToMainMenu()` in `src/main.js:224` disables simulation and clears selected entities but does not clear the active mode.
**Why it's wrong:** Other logic still reads the mode singleton from `src/modes/modeManager.js`, so mode switches can retain stale rules.
**Do this instead:** Explicitly coordinate mode and subsystem teardown through `src/modes/modeManager.js` when changing lifecycle paths, and exercise cross-mode transitions.

### Import-time caches for mutable maps

**What happens:** `WALKABLE_CELLS` in `src/entities/enemies.js` and `visited` in `src/entities/player.js` initialize against the starting map.
**Why it's wrong:** `setActiveMap()` changes dimensions/data in `src/map.js` without rebuilding those caches.
**Do this instead:** Recompute map-dependent state at activation alongside `setActiveMap()` and `buildLevel()` in `src/main.js`; verify differently sized editor maps.

## Error Handling

**Strategy:** Local defensive guards and recoverable visual fallbacks; no central exception boundary in `src/main.js`.

**Patterns:**
- Asset loaders return false after failed probes/loads; `src/builders/assetManager.js` settles all loaders so procedural models remain usable.
- `src/editor/mapEditor.js` catches invalid imports and slot parse failures locally; the external decoder can throw and is caught in `src/main.js`.
- Unknown enemy states warn in development and fall back to patrol in `src/entities/enemyUpdate.js`.
- Event handlers run synchronously without exception isolation in `src/events.js`; an exception interrupts the emitting call.

## Cross-Cutting Concerns

**Logging:** Console asset/animation diagnostics in `src/builders/enemyGLTF.js`, `src/builders/enemyAnimations.js`; build identity in `src/version.js`.
**Validation:** Local guards in `src/main.js`, tile helpers in `src/tiles.js`, decoder checks in `src/editor/mapEditor.js`; no shared schema validator is detected.
**Authentication:** Not applicable to the client-only architecture in `src/main.js` and `package.json`.

---

*Architecture analysis: 2026-10-03*
