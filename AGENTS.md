# VibeOnDuty — repository context

Initial onboarding: 2026-09-09, source commit `dc27c6f` on `main`.
Updated for the animation/model fixes in the working tree on the same date.
Use this as a navigation guide; verify current source before acting on historical
notes or roadmap proposals. Update relevant context when the architecture changes.

## Project and tooling

- Browser FPS: Three.js r160, Vite 8, plain JavaScript ES modules. No application
  framework, backend, or multiplayer transport is implemented in this repo.
- Entry/UI: `index.html`, `style.css`, `src/main.js`. Rendering and DOM access happen
  at module initialization in several modules; importing gameplay code in Node often
  requires mocks. Pure helpers are easier to unit test independently.
- Playable modes: Incursion waves, Adaptive waves, Search & Destroy, Team Deathmatch,
  and Training Range. Four combat maps plus the dedicated range; an in-browser map
  editor supports multi-floor maps, preview/playtest, save slots, and URL sharing.
- Four weapon keys: `m4`, `p90`, `awp`, `pistol`. Balance and most movement/physics
  constants live in `src/config.js`; some tuning still lives beside its consumer.
- Install with `npm ci` using the tracked `package-lock.json`. CI uses Node 20;
  onboarding checks ran with Node 24.14.1 / npm 11.12.1. Serve through Vite, not `file://`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server, normally port 5173 |
| `npm run build` / `npm run preview` | Production output in `dist/` / serve the build |
| `npm run lint` | ESLint 10 on `src/`, with zero warnings allowed |
| `npm run typecheck` | `tsc --noEmit`; `allowJs: true`, **`checkJs: false`** |
| `npm test` / `npm run test:unit` | Vitest, `src/**/*.test.js` |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright, `tests/`; manages Vite on port 5173 |

Prettier settings: two spaces, semicolons, single quotes, ES5 trailing commas,
100-column print width. Follow surrounding style and keep unrelated reformatting out
of changes. `types/entities.d.ts` is an incomplete reference, not an enforced model:
for example, it still declares `isAlive()`, which `applyEntityBase()` no longer adds.

## Runtime map

| Area | Entry points and ownership |
| --- | --- |
| Boot and menus | `main.js`: DOM events, difficulty/map selection, mode entry, weapon switching, asset registration, editor initialization |
| Frame coordination | `loop.js`: capped delta (50 ms), player animation, cameras, enemy/drone/mode ticks, HUD and rendering |
| Player/input | `entities/player.js`: mutable player state, movement, reload; `input.js`, `touch.js`, `gamepad.js`: input state |
| Combat | `combat/shoot.js`: weapons, moving bullets and hit tests, melee; `combat/damage.js`: pure damage formulas; `entities/grenades.js` |
| Enemies | `entities/enemies.js`: shared pool, spawn-slot primitive, kills/death; `enemySpawning.js`: rebuild and team setup; `enemyUpdate.js`: frame update |
| AI | `ai/enemyStates.js`: patrol/spotted/attack state objects; `entities/friendlyBots.js`: allied behavior; `astar.js`, `utils/los.js`: navigation/visibility |
| Modes | `modes/modeManager.js`: nullable active mode; `snd.js`, `tdm.js`, `trainingRange.js`; S&D shop/cash in `buyMenu.js`, `economy.js` |
| Waves/difficulty | `entities/waveSystem.js`; `difficulty.js`: presets/override; `ai/difficultyAdapter.js`: rolling performance adjustment |
| World | `map.js`: live map data/collision; `tiles.js`: tile codec; `rampMath.js`: surface math; `level.js`: mesh construction; `maps/*`: definitions |
| Visuals | `scene.js`, `materials.js`, `lighting.js`; `builders/*`: models/animation; `fx/*`: effects; `hud/*`: DOM/canvas overlays and radar |
| Editor/replay | `editor/mapEditor.js`; `replay/killcam.js`: live camera following killer, not recorded replay; `replay/damageTracker.js`: damage totals |

Boot registers the character GLB, player weapon FBX, and pistol FBX with
`builders/assetManager.js`. `loadAll()` uses `Promise.allSettled`; failures retain
procedural fallbacks. Menu buttons are disabled until loading settles. Afterward,
`main.js` builds GLTF instances if available, initializes the editor, and starts the loop.

Important dependencies and lifecycle constraints:

- State is mainly module singletons and mutable objects/live exports. Mode entry,
  menu return, respawn, round transitions, and editor preview each need appropriate
  cleanup; there is no common mode teardown abstraction.
- `modeManager` uses `null` for wave/free play, otherwise `{ name, tick }`. Adaptive
  difficulty overlays wave play. Mode-aware behavior also checks `getMode()?.name`.
- `events.js` provides synchronous `on/off/emit` and an `EV` constant catalog. Existing
  callers also use strings. S&D publishes its API with `snd:configure`; AI/enemy modules
  subscribe to avoid circular ESM initialization. Preserve that ordering when editing.
- Change enemy AI states through `transitionTo()` so `state` and `_aiState` agree.
  Friendly and hostile bots share the enemy pool and use `sndTeam` in team modes.
- `updatePlayer()` also ticks bullets, grenades, and several effects, and returns early
  when dead. Simulation uses `gameRunning`; pointer lock is a separate input/UI state.
- `camera.position` is the simulation eye position. `loop.js` temporarily offsets it
  for third person/lean, renders, then restores it; killcam overrides this arrangement.
  Movement and combat rely on that restore. Frame delta is seconds, but many weapon,
  reload, and AI timers use milliseconds; preserve each timer's unit.
- Scene/HUD modules expect IDs in `index.html`; editor and some mode overlays also
  construct DOM themselves. Coordinate UI changes across markup, CSS, and consumers.

## Maps and editor

- Maps use integer tile grids and heightmaps, `CELL = 4`, plus optional `floors`.
  Arrays are `[row][column]`; `worldToCell(x, z)` returns `[column, row]`.
- Activation is `setActiveMap(def)` followed by `buildLevel(def)`. Map exports
  (`MAP`, `HMAP`, dimensions, `FLOORS`, heights) are live bindings. S&D also needs
  `setSndMap(def)` for sites/spawns. New selectable maps need registry and menu entries.
- Use `groundElevation(x, z, refY)` for interpolated ramp/floor surfaces; `hAt(c, r)`
  only reads a cell height. `refY` is world-space eye Y; omitting it selects the highest
  surface on multi-floor maps. Keep visible bodies, collision, and hit-test heights
  consistent. Floor/ramp heights are absolute Y.
- `tiles.js` owns tile-family decoding/encoding (`rampOf`, `rampId`, `rampSurface`,
  `navCell`). Preserve existing integer serialization. Some literal structural IDs and
  editor palette ranges remain, so tile changes still need an editor/rendering audit.
- `astar.js` searches the first-floor raw `MAP` in 2D and blocks only tile `1`;
  navigation changes need collision checks for columns, cracks, and elevation too.
- Editor exports base64 JSON v2 with flattened per-floor arrays, side-wall bits,
  markers, dimensions, name/description, sky preset, and thumbnail. Save slots use
  `localStorage` keys `vod_slot_<index>`. The editor import migrates older data;
  `mapDefFromB64()` used by `main.js` for `?map=` currently accepts v2 only.

Observed code paths to recheck when relevant (not browser-reproduced bug reports):
`returnToMainMenu()` does not reset the active mode; pointer unlock displays the pause
overlay without clearing `gameRunning`; `WALKABLE_CELLS` and the player's visited grid
are initialized against the initial map. Exercise mode switching and differently sized
maps when changing lifecycle/spawning/radar behavior.

## Character animation and weapons

- Start with `builders/enemyGLTF.js` (load/clone, `ALIASES`, clip preparation),
  `builders/enemyAnimations.js` (locomotion weights, overrides, inertia, diagnostics),
  and `loop.js` (player action selection). Enemy action selection lives in the animation
  module and is invoked from `entities/enemyUpdate.js`.
- Characters use `public/models/enemy.glb`, skeleton cloning, and per-character mixers.
  Alias order matters: `idle` prefers rifle `attack`; crouch and the jump chain prefer
  generated `rifle_*` variants, with the original mannequin clips as fallbacks.
- Locomotion simultaneously weights idle/walk/run/left/right strafe. Action overrides
  use transition helpers and bone inertia after mixer update. Additive breathing runs
  separately. Preserve the loco entry/exit and action reset/weight handling.
- GLB track buffers can be shared. Preparation order is: copy values/times arrays,
  strip rest-equivalent position/scale tracks, compose armed movement clips, normalize
  quaternion signs, align jump boundaries. Constant non-rest transforms must survive stripping.
- Current asset fix is **offline retargeting onto one skeleton** with
  `tools/retarget.py`. Read `tools/README.md` for the Blender command and source setup.
  `tools/anim-sources/` contains the 12 recovered Mixamo FBX inputs; additions need a
  `CLIPS` mapping and matching runtime alias. The existing GLB supplies the target rig
  and the mannequin clips that have no separate source here.
- Retarget in world space, process parents first, clear unwanted bone translations,
  and strip horizontal root motion: gameplay owns world movement. Runtime global
  +/-90-degree clip corrections were disproven; the upper-body aim graft was removed.
  Historical `CORR_CLIPS` family classifications were removed. Inertia now has normal,
  fast, and roll-entry/exit settling speeds, without retarget-family corrections.
- `builders/rifleClips.js` composes rifle-ready crouch/jump variants once at load: original
  pelvis/legs plus the rifle torso pose, with chest orientation maintained in character-root
  space. It does not edit the GLB or apply a per-frame corrective arm graft. Dedicated
  rifle movement mocap could still improve natural motion beyond these composed poses.
- Player and enemy hand mounts share `weapon3pTransform.js`: `(PI/2, 0, 0)` maps
  weapon -Z forward / +Y up to the retargeted hand +Y forward / +Z up. Inspect actual
  GLB poses when changing the basis. The enemy pistol FBX has a separate canonical
  model wrapper so its centering/axis conversion survives mounting.
  Preserve the initial `playerBody.add(weapon3p)` before async loading so the GLTF build
  can reparent it to the hand. FBX files existing on disk do not imply runtime use:
  current player FBX loading defaults to P90; other weapons have procedural geometry.
- `builders/characterResources.js` disposes instance geometry, owned/tinted materials,
  skeleton bone textures, mixer bindings, and debug helpers. Register template geometry
  with `preserveTemplateGeometry()` before cloning; shared assets must remain alive.
- One-shots fit gameplay durations using action time scales. Grenade throw state now
  advances in simulation time and releases once at 45% of the 0.9-second throw window;
  death/menu return cancel a pending release. Third-person guns hide for throw/melee/dance.
- Debug with `F3`, third person (`V`), `window.__animDebug('player')`,
  `window.__animDebug(true)` / `false`, and `window.__build`. Inspect actual poses and
  transitions visually for asset changes; angle metrics and passing smoke tests alone
  do not establish visual correctness.
  Weapon/rig inspection also has `window.__debug3p()`, `window.__debugBone(name)`,
  `window.__bodyRef()`, `window.__handRef()`, and `window.__tuneWeapon3p({...})`.

## Validation and deployment

After animation fixes: lint, typecheck, build, **86 unit tests in 10 files**, and **17
Playwright tests in 3 files** passed. Build reports a JS chunk above 500 kB. Headless
browser runs log pointer-lock `WrongDocumentError`; existing tests account for pointer
lock limitations. This baseline does not validate full gameplay or visual pose quality.

Unit coverage includes math/projectile segments, pathfinding, maps/ramps, tile codec,
ground-height consistency, grenade damage, S&D state, and weapon mount transforms.
Browser coverage includes menus/HUD, S&D start, version stamp, real GLB loading and
track stripping, animation transitions, real-rig weapon alignment, death weights, GPU
cleanup, and grenade/action timing (`tests/animation-regressions.spec.js`). Wait for start buttons to be
**enabled**, not merely visible. Playwright needs Chromium installed
(`npx playwright install chromium` if absent); CI installs it with system dependencies.
Use checks appropriate to the change; `docs/TESTING.md` is specifically the editor's
manual checklist, not a general testing guide.

`.github/workflows/test.yml` runs lint, types, unit tests, and Playwright and is reusable
by `deploy.yml`. Deployment waits for that job, then assembles `main` at `/VibeOnDuty/`
and, if the branch exists, `develop` at `/VibeOnDuty/next/` in one Pages artifact.
Both branch pushes trigger this assembly. `vite.config.js` accepts `PUBLIC_BASE`;
asset URLs use `import.meta.env.BASE_URL`. Keep them prefix-aware. Build stamps come
from Vite-injected git/environment metadata and appear on the menu, console, and
`window.__build`; `BUILD_BRANCH` overrides the branch label.

## Documentation status

- `docs/ANIMATION-REVIEW.md`: original browser-backed audit plus the working-tree fix
  status, regression coverage, reproduction scripts, and before/after pose captures.
- `docs/README.md`: feature/control overview; some counts, team sizes, and file
  descriptions lag source.
- `docs/ROADMAP.md`: completed work mixed with proposals and an 80-item idea backlog.
  Audio, networking, richer grenades, and progression are proposals, not implemented
  infrastructure. Shop/economy and a live killcam already exist. Sections 79/80 predate
  test-gated deployment, staging configuration, and the shared tile codec.
- `docs/REFACTOR.md`: historical audit with completed/deferred items and some conflicting
  status text. Check code before treating an item as outstanding.
- `docs/ANIMATION-SPACES.md`: investigation history. Read **Resolved: the clips were
  retargeted onto one skeleton** and `tools/README.md` before older sections. Old
  `animSpaceFix` toggles, aim-layer instructions, and asset counts are superseded.
- HTML documents in `docs/` are separate files; no docs generation script is configured
  in `package.json`. Do not assume Markdown changes regenerate them.
