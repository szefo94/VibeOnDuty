---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# Codebase Structure

**Analysis Date:** 2026-10-03

## Directory Layout

```text
VibeOnDuty/
├── index.html                # Canvas, menus, HUD and editor markup
├── style.css                 # Shared application styling
├── src/
│   ├── main.js               # Boot and menu/action coordinator
│   ├── loop.js               # Frame simulation and rendering
│   ├── config.js             # Gameplay constants and weapon definitions
│   ├── map.js / tiles.js      # World data/collision and tile codec
│   ├── level.js / scene.js    # World mesh and renderer setup
│   ├── ai/                   # Enemy states and adaptive difficulty
│   ├── builders/             # Models, assets, rigs and animation
│   ├── combat/               # Shooting and damage calculations
│   ├── editor/               # In-browser map editor
│   ├── entities/             # Player, bots, drones, grenades, targets, waves
│   ├── fx/                   # Transient visual effects
│   ├── hud/                  # DOM/canvas HUD and radar
│   ├── maps/                 # Built-in map definitions
│   ├── modes/                # Modes, shop and economy
│   ├── shared/               # Headless movement, protocol, room simulation/world and canonical map data
│   ├── network/              # Same-origin session, remote actors and private feedback
│   ├── replay/               # Killcam and damage summaries
│   └── utils/                # Visibility helper
├── public/                   # Models and browser-served static assets
├── tests/                    # Playwright browser regression suites
├── server/                   # Colyseus authoritative room/schema and built-game HTTP host
│   └── testHelpers/          # Raw SDK hostile client with explicit server-derived Origin
├── types/                    # Reference entity declarations
├── tools/                    # Blender asset pipeline and FBX sources
├── docs/                     # Human documentation and investigation reports
├── .github/workflows/        # Test and Pages deployment automation
└── .planning/codebase/       # Architecture and implementation references
```

## Directory Purposes

**Runtime root (`src/`):**
- Purpose: Coordinate game-wide services and cross-subsystem state.
- Contains: Entry points, input adapters, configuration, scene/world setup and reusable math.
- Key files: `src/main.js`, `src/loop.js`, `src/config.js`, `src/events.js`, `src/map.js`.

**Entities and AI (`src/entities/`, `src/ai/`):**
- Purpose: Own actor state, spawning, behavior, death and per-frame updates.
- Contains: Player singleton; enemy pool/spawn/update split; allied bots; drones; projectiles/grenades; ammo; training targets; wave system.
- Key files: `src/entities/player.js`, `src/entities/enemies.js`, `src/entities/enemySpawning.js`, `src/entities/enemyUpdate.js`, `src/ai/enemyStates.js`.
- Keep bot state transitions in `src/ai/enemyStates.js`; keep pool lifecycle in `src/entities/enemies.js`.

**Builders (`src/builders/`):**
- Purpose: Construct visual objects, load templates and manage skeletal animation/resources.
- Contains: Procedural weapons/bodies/enemies/drones, GLB/FBX loaders, clip composition, mount transforms and disposal helpers.
- Key files: `src/builders/enemyGLTF.js`, `src/builders/enemyAnimations.js`, `src/builders/rifleClips.js`, `src/builders/characterResources.js`, `src/builders/weapon3pTransform.js`.

**Rules (`src/combat/`, `src/modes/`):**
- Purpose: Own damage/shooting and mode-specific match/drill/economy behavior.
- Contains: Stateful shooting and pure damage helpers; nullable mode registry; S&D, TDM, training, shop and money.
- Key files: `src/combat/shoot.js`, `src/combat/damage.js`, `src/modes/modeManager.js`, `src/modes/snd.js`, `src/modes/economy.js`.

**Presentation (`src/hud/`, `src/fx/`, `src/replay/`):**
- Purpose: Display gameplay state and feedback.
- Contains: DOM overlays, canvas drawing, radar, enemy bars, hit markers, particles, tracers, screen shake, killer camera and damage summaries.
- Key files: `src/hud/hud.js`, `src/hud/overlay.js`, `src/hud/radar.js`, `src/fx/particles.js`, `src/replay/killcam.js`.
- The killcam in `src/replay/killcam.js` follows live state; this directory does not implement recorded simulation replay.

**Maps and editor (`src/maps/`, `src/editor/`):**
- Purpose: Define shipped maps and author custom maps in-browser.
- Contains: Bunker, rooftop, concept, vanguard and training range definitions; editor state/serialization/preview code.
- Key files: `src/maps/bunker.js`, `src/maps/vanguard.js`, `src/maps/range.js`, `src/editor/mapEditor.js`.

**Assets and authoring (`public/`, `tools/`):**
- Purpose: Serve runtime models and retain reproducible animation inputs/tooling.
- Contains: GLB/FBX assets and Blender retarget pipeline.
- Key files: `public/models/enemy.glb`, `tools/retarget.py`, `tools/README.md`, `tools/anim-sources/`.
- Runtime loading must be verified in `src/builders/weaponFBX.js` and `src/builders/enemyWeapon.js`; an asset's presence alone does not establish use.

## Key File Locations

**Online movement and input boundary (01-03):**
- `src/shared/movement.js`: Numeric movement with stance clearance, jump/gravity and radius-aware terrain.
- `src/shared/protocol.js`: Exact versioned intentions, acknowledged-tick and receipt age, sequence/generation gates, bounded session queues and token rate.
- `server/tdmRoom.js`: Framework session ownership, one consumption per fixed tick, replicated body flags/ticks and rejection/disconnect signals.
- `server/cli.js`, `server/index.js`: Validated operator configuration, root-base build confinement, same-listener HTTP/HTTPS and Origin-gated transport.
- `server/tls.js`: Atomic ignored operational cert/key storage, identity/date/key checks, serialized reuse and verified Windows ACL/POSIX permissions.
- `server/testHelpers/hostileClient.js`: Existing pinned SDK plus existing Node WebSocket transport for raw malformed inputs; Origin derives from the ephemeral server URL.
- `tests/multiplayer.spec.js`: Real controls and snapshots through built production assets; observers never mutate trusted state.

**Entry Points:**
- `index.html`: Loads `src/main.js` as an ES module and provides UI IDs.
- `src/main.js`: Registers assets and coordinates mode/menu entry.
- `src/loop.js`: Exposes `startLoop()` and the frame callback.
- `src/editor/mapEditor.js`: Exposes editor initialization/open/preview and URL decoder.
- `tools/retarget.py`: Blender-driven offline model regeneration.

**Configuration:**
- `package.json`, `package-lock.json`: Scripts and dependency graph.
- `vite.config.js`: Public base and build identity injection.
- `eslint.config.js`: JavaScript lint rules.
- `tsconfig.json`: JS-aware TypeScript no-emit setup.
- `vitest.config.js`, `playwright.config.js`: Unit and browser runners.
- `playwright.multiplayer.config.js`, `tsconfig.multiplayer.json`: Separate production-server browser discovery and strict checked multiplayer boundaries.
- `src/config.js`: Gameplay constants and weapon balance.
- `src/difficulty.js`: Difficulty presets and override.
- `AGENTS.md`: Project guidance and navigation context.
- `.github/workflows/test.yml`, `.github/workflows/deploy.yml`: Validation and Pages assembly.

**Core Logic:**
- `src/map.js`, `src/tiles.js`, `src/rampMath.js`: Tile/floor/ramp semantics.
- `src/astar.js`, `src/utils/los.js`: Navigation and visibility.
- `src/entities/player.js`: Movement, reload and shared player state.
- `src/combat/shoot.js`: Projectile/hit processing.
- `src/ai/enemyStates.js`: Enemy decision states.
- `src/builders/enemyGLTF.js`, `src/builders/enemyAnimations.js`: Asset preparation and animation runtime.

**Testing:**
- `src/math.test.js`, `src/astar.test.js`, `src/map.test.js`, `src/tiles.test.js`: Co-located pure helper tests.
- `src/entities/groundSync.test.js`: Surface consistency across gameplay consumers.
- `src/combat/damage.test.js`, `src/modes/snd.test.js`: Rules tests.
- `src/builders/enemyAnimations.test.js`, `src/builders/rifleClips.test.js`, `src/builders/weapon3pTransform.test.js`: Animation and mount helpers.
- `tests/smoke.spec.js`, `tests/assets.spec.js`, `tests/animation-regressions.spec.js`: Browser flows, real assets and animation/resource regressions.
- `tests/multiplayer.spec.js`: First real two-context movement/M4 tracer, intentionally RED until plan 01-02.
- `tests/helpers/mpServer.js`: Root-base client builds, owned dedicated-server fixture, bounded readiness, scoped temp cleanup and concurrent isolation checks. `server/`, `src/shared/`, and `src/network/` are checked/discovered future implementation paths, not shipped gameplay here.
- `docs/TESTING.md`: Manual editor checklist.

## Naming Conventions

**Files:**
- Use camelCase JavaScript module names for multiword functionality: `src/entities/enemySpawning.js`, `src/builders/characterResources.js`.
- Use short lower-case subsystem names where established: `src/modes/snd.js`, `src/combat/shoot.js`.
- Co-locate unit tests as `*.test.js`: `src/tiles.test.js`.
- Place browser suites in `tests/` as `*.spec.js`: `tests/animation-regressions.spec.js`.
- Use uppercase human documentation names: `docs/ANIMATION-REVIEW.md`, `.planning/codebase/ARCHITECTURE.md`.
- Use `*.d.ts` for reference declarations: `types/entities.d.ts`.

**Directories:**
- Use lower-case domain folders such as `src/builders/`, `src/modes/`, `src/entities/`.
- Keep root build/test configuration beside `package.json`; there is no separate config directory.

## Where to Add New Code

**New Feature:**
- Primary code: Choose the owning domain in `src/entities/`, `src/combat/`, `src/modes/`, `src/hud/` or `src/fx/`.
- Wiring: Add startup/action bindings in `src/main.js` and frame ticks in `src/loop.js` only when coordination is required.
- Tests: Co-locate computational tests beside the module; add user-visible/asset checks under `tests/`.
- UI: Coordinate `index.html`, `style.css` and the consuming HUD/mode module.

**New Component/Module:**
- Actors: State/lifecycle under `src/entities/`; visual construction under `src/builders/`; AI states under `src/ai/`.
- Modes: Add implementation under `src/modes/`, register the `{ name, tick }` contract through `src/modes/modeManager.js`, and add menu bindings in `src/main.js`.
- Maps: Add `src/maps/<name>.js`, register it in `src/main.js`, and add menu markup in `index.html`. Coordinate S&D spawns/sites.
- Tile families: Extend `src/tiles.js` and audit `src/map.js`, `src/level.js` and `src/editor/mapEditor.js` together.
- Character clips: Add FBX input under `tools/anim-sources/`, map it in `tools/retarget.py`, and match runtime aliases in `src/builders/enemyGLTF.js`.
- Asset ownership: Extend disposal behavior through `src/builders/characterResources.js`.

**Utilities:**
- Shared math: `src/math.js` or a focused peer module such as `src/rampMath.js`.
- Domain-specific helpers: Keep damage in `src/combat/damage.js` and weapon transforms in `src/builders/weapon3pTransform.js`.
- Visibility helpers: `src/utils/los.js`; do not introduce browser imports into otherwise pure helpers.

## Special Directories

**`public/`:**
- Purpose: Static assets copied/served by Vite.
- Generated: Mixed; `public/models/enemy.glb` is produced by the retarget pipeline.
- Committed: Yes; preserve base-aware runtime URLs.

**`tools/anim-sources/`:**
- Purpose: FBX source inputs used by `tools/retarget.py`.
- Generated: No; source assets.
- Committed: Yes.

**`docs/`:**
- Purpose: Human guides and audit/investigation reports.
- Generated: No configured generation pipeline in `package.json`; Markdown and HTML files are separate artifacts.
- Committed: Yes.

**`types/`:**
- Purpose: Entity declaration reference at `types/entities.d.ts`.
- Generated: No.
- Committed: Yes; compare against actual runtime source before relying on declarations.

**`.planning/codebase/`:**
- Purpose: GSD mapping references, including this document.
- Generated: Yes, by mapping agents.
- Committed: Managed by the orchestrator; no existing tracked planning files are detected during this scan.

**`node_modules/`, `dist/`, `test-results/`:**
- Purpose: Installed dependencies, production bundle and Playwright output.
- Generated: Yes.
- Committed: No; excluded by `.gitignore`.

---

*Structure analysis: 2026-10-03*
