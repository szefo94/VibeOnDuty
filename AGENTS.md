# VibeOnDuty — repository guide

Browser FPS: Three.js r160, Vite 8, plain JavaScript ES modules, Node 24. Offline modes plus
an online Team Deathmatch on a Colyseus dedicated server. This guide describes the code as it
is; verify against source before acting on it, and update it when the architecture changes.
Older planning, research and review records are in `docs/legacy/` (historical, not current
instructions; see its README).

## Commands

Install with `npm ci` (tracked `package-lock.json`). Serve through Vite, not `file://`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server, http://localhost:5173/VibeOnDuty/ |
| `npm run build` / `npm run preview` | production build in `dist/` / serve it |
| `npm run lint` | ESLint on `src/`, `server/`, `tests/helpers/`, zero warnings |
| `npm run typecheck` / `npm run typecheck:mp` | `tsc --noEmit` (`checkJs: false`) / strict checked online boundaries |
| `npm test` | Vitest unit tests, `src/**/*.test.js` |
| `npm run test:e2e` | Playwright, `tests/` (smoke and art tracer); starts Vite on port 5173 |
| `npm run build:mp` / `npm run mp-server` | root-base build / same-origin dedicated HTTP or testing HTTPS game server |

Playwright reuses a server already listening on 5173 with the default `/VibeOnDuty/` base;
stop your own dev server first. Specs that `import('/src/...')` in the page need a root base:
`PUBLIC_BASE=/` (in Git Bash also `MSYS_NO_PATHCONV=1`). Playwright needs Chromium
(`npx playwright install chromium`). Wait for start buttons to be enabled, not just visible.

Prettier: two spaces, semicolons, single quotes, ES5 trailing commas, 100 columns. Follow the
surrounding style. `types/entities.d.ts` is an incomplete reference, not an enforced model.

## Runtime map

| Area | Entry points |
| --- | --- |
| Boot and menus | `main.js`: DOM events, map/difficulty selection, mode entry, weapon switching, asset registration, editor init |
| Frame loop | `loop.js`: capped delta (50 ms), player animation, cameras, enemy/mode ticks, HUD, rendering |
| Player and input | `entities/player.js` (movement, reload), `input.js`, `touch.js`, `gamepad.js` |
| Combat | `combat/shoot.js` (weapons, bullets, hit tests, melee), `combat/damage.js`, `entities/grenades.js` |
| Enemies and AI | `entities/enemies.js`, `enemySpawning.js`, `enemyUpdate.js`; `ai/enemyStates.js`, `entities/friendlyBots.js`, `astar.js`, `utils/los.js` |
| Modes | `modes/modeManager.js`; `snd.js`, `tdm.js`, `trainingRange.js`; S&D shop in `buyMenu.js`, `economy.js` |
| Waves and difficulty | `entities/waveSystem.js`, `difficulty.js`, `ai/difficultyAdapter.js` |
| World | `map.js` (live map data, collision), `tiles.js`, `rampMath.js`, `level.js`, `maps/*` |
| Visuals | `scene.js`, `materials.js`, `lighting.js`, `graphicsQuality.js`, `comicOutline.js`, `builders/*`, `fx/*`, `hud/*` |
| Editor | `editor/mapEditor.js` |
| Online | `server/*` (room, CLI, TLS), `shared/*` (simulation, combat, movement, protocol, rules), `network/*` (session, remote actors, online UI) |

Modes: Incursion waves, Adaptive waves, Search & Destroy, Team Deathmatch, Training Range;
four combat maps plus the range; an in-browser map editor (multi-floor, preview/playtest,
save slots, URL sharing). Weapons: `m4`, `p90`, `awp`, `pistol`. Balance and movement
constants live mostly in `src/config.js`.

Boot registers the character GLB and weapon FBX files with `builders/assetManager.js`;
`loadAll()` uses `Promise.allSettled` and failures keep procedural fallbacks. Menu buttons
stay disabled until loading settles.

## Lifecycle rules that bite

- State is mostly module singletons and mutable live exports. Mode entry, menu return,
  respawn, round changes and editor preview each need their own cleanup; there is no common
  teardown. `modeManager` uses `null` for wave/free play, otherwise `{ name, tick }`.
- `events.js` is synchronous `on/off/emit` with an `EV` catalog. S&D publishes its API with
  `snd:configure`; AI modules subscribe to avoid circular ESM initialization.
- Change enemy AI state through `transitionTo()`. Friendly and hostile bots share the enemy
  pool and use `sndTeam` in team modes.
- `updatePlayer()` also ticks bullets, grenades and effects and returns early when dead.
  Simulation uses `gameRunning`; pointer lock is separate.
- `camera.position` is the simulation eye. `loop.js` offsets it for third person and lean,
  renders, then restores it; killcam overrides this. Frame delta is seconds, but many weapon,
  reload and AI timers are milliseconds; keep each timer's unit.
- Scene and HUD modules expect IDs in `index.html`; coordinate markup, CSS and consumers.
- Pause menu: the offline `mousedown` handler requests no pointer lock for presses inside
  `#pause-menu`, `#mp-error-banner` or `#kc-skip`; Resume re-captures in its own handler.
- `stopTrainingRange()` and `stopKillcam()` run on menu return and online entry.

## Maps and editor

- Integer tile grids and heightmaps, `CELL = 4`, optional `floors`. Arrays are
  `[row][column]`; `worldToCell(x, z)` returns `[column, row]`.
- Activate with `setActiveMap(def)` then `buildLevel(def)`; S&D also needs `setSndMap(def)`.
  New selectable maps need a registry and a menu entry.
- `groundElevation(x, z, refY)` for surfaces (`refY` is world eye Y); `hAt(c, r)` reads a cell
  height only. Keep visible bodies, collision and hit-test heights consistent.
- `tiles.js` owns tile decoding/encoding; some literal IDs remain in the editor and renderer.
- `astar.js` searches the first-floor `MAP` in 2D and blocks only tile `1`; it ignores crack
  tiles that collision blocks.
- Editor exports base64 JSON v2; save slots are `localStorage` keys `vod_slot_<index>`;
  `?map=` accepts v2 only.

## Online play

`shared/movement.js` steps eye and body; crouched walk speed is `6 * 0.72 = 4.32 m/s`.
`shared/combat.js` runs the M4 on the server: 88 ms cadence, 1800 ms reload, 65 m/s
gravity-affected bullets with a 1.1 s lifetime, earliest-contact-wins sweeps, head damage 4x,
friendly damage 0.25. `shared/protocol.js` accepts only exact intentions and rejects stale
ones (`MAX_ACK_AGE_TICKS = 15`); a client below about 5 fps loses most input to this.
`shared/tdmRules.js` owns teams, scores and waiting/active/results (defaults 50 kills,
600 s, 3 s respawn; results 15 s; rematch keeps settings). Server code must not import
browser singletons. `network/remoteActors.js` owns remote rigs per connection, match and life
generation. Setup, TLS and reverse proxy: `docs/MULTIPLAYER.md`.

## Characters and animation

- Characters use `public/models/enemy.glb` (inherited 65-joint skeleton), skeleton cloning
  and one mixer per character. The GLB holds 107 clip occurrences: 48 inherited
  (mannequin and Mixamo, retargeted onto one rig) and 59 authored `vod7_` actions.
- The `vod7_` actions are procedural hinge poses, not motion capture. Live play therefore uses
  composed `live_` clips built at load (`buildLiveClips` / `findLiveClip` in
  `builders/enemyGLTF.js`): inherited motion-captured legs and pelvis height under the
  authored weapon pose. Crouch and jump clips keep the pelvis over the root; standing idle
  legs are one still frame. `findMotionClip` still returns the authored clips by name.
- `builders/animationPresentation.js` normalizes observations into a pose;
  `builders/enemyAnimations.js` drives masked lower/upper layers, bone inertia (restored
  before each mixer update so constant tracks are reached) and a crouched foot turn that keeps
  the crouched legs. `builders/weaponHandling.js` owns weapon parts, hand reach and a 12°
  crouched torso lean (`CROUCH_TORSO_LEAN_RAD`; it fades out when aiming up).
- `builders/firstPersonRig.js` owns the first-person arms and body views. The body view never
  carries the lean, and draws only hips and legs while the torso is not clearly below the eye
  (`BODY_VIEW_TORSO_BELOW_EYE`), so a crouched player never sees their own torso.
- `builders/characterResources.js` disposes instance geometry, owned materials and mixers;
  register template geometry with `preserveTemplateGeometry()` before cloning.
- Player and enemy hand mounts share `weapon3pTransform.js`. Keep the initial
  `playerBody.add(weapon3p)` before async loading.
- Debug: `F3` (in Training Range it opens the animation review panel), `V` third person,
  `window.__animDebug('player')`, `window.__build`, `window.__debug3p()`. Look at poses and
  transitions in the running game; passing tests do not establish visual quality.
- Not built yet: prone, slide, dive-to-prone and a gameplay supersprint (preview poses only).
  Known motion limits are listed in `docs/legacy/phases/07-animation/07-PHASE5-HANDOFF.md`.
- Art rebuild pipelines (Blender and retarget): `tools/README.md`. The redistribution terms of
  the inherited rig, motion and weapon FBX files are unresolved (`tools/art/provenance.json`).

## Tests and deployment

- Unit tests (Vitest) cover math and projectiles, pathfinding, maps and ramps, the tile codec,
  grenades, S&D, mounts, online rules and protocol, and the animation/first-person builders on
  the real GLB.
- Browser tests are deliberately few: `tests/smoke.spec.js` and `tests/art-tracer.spec.js`
  (the Blender pipeline also runs the latter before publishing a model). The game itself is
  the reference for motion and visuals.
- `.github/workflows/test.yml` runs lint, both typechecks, both builds, unit tests and the
  Playwright tests; `deploy.yml` waits for it and publishes `main` at `/VibeOnDuty/` and
  `develop` at `/VibeOnDuty/next/` on GitHub Pages. `vite.config.js` reads `PUBLIC_BASE`;
  asset URLs use `import.meta.env.BASE_URL`. Build stamps come from git metadata
  (`window.__build`).

## Docs

`docs/README.md` (features and controls; some counts lag source), `docs/MULTIPLAYER.md`,
`docs/TESTING.md` (the editor's manual checklist), `docs/ROADMAP.md` (completed work mixed
with proposals and an idea backlog). HTML files in `docs/` are separate, hand-written pages.
