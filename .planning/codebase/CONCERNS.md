---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# Codebase Concerns

**Analysis Date:** 2026-10-03

Evidence scope: source inspection only. No gameplay, browser reproduction, dependency audit, benchmark, or test run is performed for this map. Findings below distinguish observed implementation from predicted runtime impact. `AGENTS.md` is navigation context; findings are checked against implementation.

## Tech Debt

**Mode lifecycle has no common teardown:**
- Issue: `returnToMainMenu()` resets selected player fields and enemies but leaves the mode singleton intact; Incursion and Adaptive entry do not call `setMode(null)`.
- Files: `src/main.js`, `src/modes/modeManager.js`, `src/loop.js`, `src/editor/mapEditor.js`.
- Impact: Static risk of structured-mode ticks and mode-aware combat behavior persisting into wave play or editor playtest.
- Fix approach: Introduce explicit mode exit and wave entry operations; reset mode, transient simulation objects, overlays, and input together. Exercise transitions from every structured mode into wave play.

**JavaScript type contracts are not enforced:**
- Issue: `checkJs` is false and strict checking is disabled; `EntityBase` declares `isAlive()` but `applyEntityBase()` only adds `takeDamage()`.
- Files: `tsconfig.json`, `types/entities.d.ts`, `src/entities/entityBase.js`, `src/entities/player.js`.
- Impact: A passing typecheck cannot establish that gameplay objects match declaration files; player initialization also casts through `any`.
- Fix approach: Align declarations with runtime first, then enable checking incrementally for pure modules and entity contracts.

**Editor mixes serialization, drawing, input, storage, and gameplay:**
- Issue: A 1263-line module owns map decoding, canvas tools, palette IDs, save slots, previews, and DOM events.
- Files: `src/editor/mapEditor.js`, `src/tiles.js`.
- Impact: Serialization changes require edits inside browser-dependent code; legacy import and URL import implement distinct compatibility paths.
- Fix approach: Extract a pure validated map codec, preserve integer tile serialization, and route editor and URL imports through it. Keep UI tool ownership separate from map conversion.

## Known Bugs

No browser-reproduced bugs are established in this audit. The following are concrete source inconsistencies with predicted symptoms.

**Map-derived arrays and minimap scale are initialized once (static defect):**
- Symptoms: Spawn candidates use the initial map, exploration persists across maps, and minimap scale remains tied to initial width. A taller map can access `visited[r]` outside its allocated rows and throw; extra columns cannot be represented by the original typed-array width.
- Files: `src/entities/enemies.js` (`WALKABLE_CELLS`), `src/entities/player.js` (`visited`), `src/hud/radar.js` (`MC`), `src/map.js` (`setActiveMap`).
- Trigger: Activate a map with different walls or dimensions; explore rows beyond the initial map height or render its minimap. No browser reproduction performed.
- Workaround: No complete workaround in source. Rebuild candidates, resize/clear exploration, and derive radar dimensions during map activation.

**Pause overlay does not pause simulation (static behavior mismatch):**
- Symptoms: Pointer unlock shows the pause menu while `gameRunning` remains true; enemy, drone, wave, and mode ticks continue.
- Files: `src/main.js`, `src/input.js`, `src/loop.js`, `src/entities/player.js`.
- Trigger: Unlock pointer during a running game while alive. No browser reproduction performed.
- Workaround: Return to the main menu stops simulation. Add an explicit paused simulation state and clear held inputs on pause/blur; distinguish buy-menu unlock from pause.

**Combat hit heights omit floor reference (static risk):**
- Symptoms: Bullet enemy hit positions call `groundElevation(e.x, e.z)` with its default highest-surface selection, which can diverge from a bot on a lower floor.
- Files: `src/combat/shoot.js`, `src/map.js`, `src/entities/enemyUpdate.js`.
- Trigger: Shoot a bot below overlapping upper-floor geometry in a custom map. No browser reproduction performed.
- Workaround: Supply the entity's appropriate eye-height reference or shared entity ground value to hit tests; extend real multi-floor combat regression coverage.

## Security Considerations

**Untrusted shared-map strings enter HTML:**
- Risk: URL map payload metadata is decoded and interpolated into `innerHTML`; map name, description, and thumbnail are not escaped. Static DOM injection risk, with possible same-origin script execution through crafted markup or attributes; exploit not executed.
- Files: `src/main.js` (custom map card), `src/editor/mapEditor.js` (`mapDefFromB64`).
- Current mitigation: Parsing is wrapped in a catch; this handles malformed input, not valid malicious metadata.
- Recommendations: Build card elements with `textContent`; set image properties after validating allowed thumbnail schemes and image format. Add adversarial metadata tests.

**Map dimensions and arrays lack decoder bounds:**
- Risk: URL and editor import dimensions drive allocations without finite integer limits; invalid floor arrays, empty floors, or oversized dimensions can throw or consume excessive browser resources.
- Files: `src/editor/mapEditor.js` (`_decode`, `mapDefFromB64`), `src/map.js`, `src/level.js`.
- Current mitigation: Editor resize controls clamp normal interactive sizes to 8–48; URL parsing has a catch. Neither validates serialized input size or structure before allocation.
- Recommendations: Validate payload length, dimensions, floor count, array lengths, tile IDs, numeric heights, markers, and string lengths before changing editor or runtime state.

## Performance Bottlenecks

**Pathfinding scans all open nodes:**
- Problem: Every expansion scans `open.values()` to find the minimum score and allocates node objects; worst-case search work grows much faster than cell count.
- Files: `src/astar.js`, `src/ai/enemyStates.js`, `src/entities/friendlyBots.js`.
- Cause: Linear open-set selection, repeated per-bot replanning, and path reconstruction with `unshift`; hostile replans use roughly 600–800 ms timers and allies use 800 ms.
- Improvement path: Profile with representative maps and bot counts, then use a priority queue, indexed cost arrays, reverse path construction, and staggered replan budgets. No measured frame-time bottleneck is claimed.

**Projectile collision and minimap work grow with world size:**
- Problem: Each live bullet raycasts against wall meshes and scans enemies; minimap redraw traverses the whole grid twice per frame.
- Files: `src/combat/shoot.js`, `src/hud/radar.js`, `src/loop.js`.
- Cause: No spatial candidate filtering in these loops; bullet vectors are cloned/allocated inside frame updates.
- Improvement path: Profile before optimizing; reuse scratch vectors, index nearby targets/walls, and cache static minimap geometry while drawing dynamic entities separately.

## Fragile Areas

**Simulation work is coupled to living-player updates:**
- Files: `src/entities/player.js`, `src/loop.js`, `src/combat/shoot.js`, `src/entities/grenades.js`.
- Why fragile: `updatePlayer()` returns immediately when dead, skipping bullet, grenade, particle, impact, and ammo-drop ticks while the loop can continue enemy and mode simulation.
- Safe modification: Move world simulation ticks into frame coordination with explicit lifecycle rules; verify projectiles in flight at death and respawn, including S&D spectator periods.
- Test coverage: `tests/animation-regressions.spec.js` covers grenade throw cancellation on death, but does not establish continued simulation of already released projectiles.

**Melee uses uncancelled wall-clock callbacks:**
- Files: `src/main.js`, `src/combat/shoot.js`.
- Why fragile: KeyF schedules damage at 350 ms and clears punching at 700 ms without a `gameRunning` entry guard or stored timer handles. Mode exit cannot cancel these callbacks.
- Safe modification: Use simulation-time action progression, recheck session/alive state at impact, and cancel pending melee on death/menu return.
- Test coverage: `tests/animation-regressions.spec.js` tests grenade and animation timing, not melee across pause/death/menu transitions.

**Animation ownership and shared GPU resources require explicit boundaries:**
- Files: `src/builders/enemyGLTF.js`, `src/builders/enemyAnimations.js`, `src/builders/rifleClips.js`, `src/builders/characterResources.js`, `tools/retarget.py`.
- Why fragile: Skeleton clones share template geometry and clip data; disposing shared geometry or mutating shared track arrays affects live characters.
- Safe modification: Preserve template geometry before cloning, copy track buffers before preparation, and dispose instances through `disposeCharacter()`. Preserve offline single-skeleton retargeting and action weight/inertia rules.
- Test coverage: `src/builders/enemyAnimations.test.js`, `src/builders/rifleClips.test.js`, and `tests/animation-regressions.spec.js` cover transitions, poses, and instance cleanup. Passing checks do not establish visual quality for every action.

## Scaling Limits

**Navigation supports one 2D floor:**
- Current capacity: Four-neighbor navigation over `MAP`; iteration cap is `MAP_W * MAP_H`. Interactive editor dimensions are capped at 48 per axis.
- Limit: A* blocks only raw tile 1 and has no floor/elevation dimension; columns, crack collision, step limits, and upper floors differ from movement semantics. Its key `x * 100 + z` also collides when imported row coordinates reach 100.
- Files: `src/astar.js`, `src/map.js`, `src/tiles.js`, `src/editor/mapEditor.js`.
- Scaling path: Validate imported dimensions immediately; use dimension-derived unique keys and a navigation graph consistent with collision and accessible floor transitions.

**Editor persistence is local and synchronous:**
- Current capacity: Five localStorage save slots; no measured quota capacity is established.
- Limit: `_saveToSlot()` writes synchronously without catching storage denial/quota errors; slots are browser/origin-local.
- Files: `src/editor/mapEditor.js`.
- Scaling path: Catch storage exceptions and give actionable UI feedback; use downloadable exports as backup and IndexedDB if data volume warrants it.

## Dependencies at Risk

**Three.js model integration is version-sensitive:**
- Risk: Runtime uses `three` with range `^0.160.0` and several loader/skeleton integrations; no vulnerability or unsupported-version claim is established by this source audit.
- Files: `package.json`, `package-lock.json`, `src/builders/enemyGLTF.js`, `src/builders/weaponFBX.js`, `src/builders/enemyWeapon.js`.
- Impact: Renderer/loader changes can alter asset transforms, animation behavior, and resource disposal.
- Migration plan: Treat renderer updates as explicit migrations; run shipped-asset and real-rig browser regressions and visually inspect poses before accepting an upgrade.

## Missing Critical Features

**Shared mode/map session reset contract:**
- Problem: Cleanup and setup are spread across menu handlers, mode modules, and editor preview; there is no central operation ensuring a clean session.
- Files: `src/main.js`, `src/modes/modeManager.js`, `src/editor/mapEditor.js`, `src/loop.js`.
- Blocks: Reliable repeated switching among maps, structured modes, wave modes, and editor playtests without residual state.

**Validated reusable map import:**
- Problem: URL imports only accept v2 while editor import has a legacy migration path; validation is not a shared pure boundary.
- Files: `src/editor/mapEditor.js`, `src/main.js`.
- Blocks: Consistent handling of exported older maps and safe automated decoder testing without browser dependencies.

## Test Coverage Gaps

**Mode transitions and pause lifecycle:**
- What's not tested: Structured mode → menu → wave/adaptive/editor transitions, paused enemy progression, stale held input, melee callbacks after exit, and transient projectile reset.
- Files: `src/main.js`, `src/input.js`, `src/loop.js`, `tests/smoke.spec.js`, `tests/animation-regressions.spec.js`.
- Risk: Single-mode smoke tests pass while cross-session state remains wrong.
- Priority: High.

**Custom map decoding and different map dimensions:**
- What's not tested: Malformed URL payloads, metadata escaping, oversized grids, empty floors, stale spawn candidates, minimap resizing, and overlapping-floor combat.
- Files: `src/editor/mapEditor.js`, `src/entities/enemies.js`, `src/hud/radar.js`, `src/combat/shoot.js`, `src/map.test.js`, `src/entities/groundSync.test.js`.
- Risk: Editor-produced/custom maps expose crashes or collision/hitbox differences absent from built-in-map checks.
- Priority: High.

**Navigation collision parity and full mode behavior:**
- What's not tested: A* routes through columns/cracks/elevation and across floors; full TDM/training/adaptive gameplay progression and touch/gamepad state transitions.
- Files: `src/astar.test.js`, `src/modes/tdm.js`, `src/modes/trainingRange.js`, `src/ai/difficultyAdapter.js`, `src/touch.js`, `src/gamepad.js`, `tests/smoke.spec.js`.
- Risk: Math and S&D state unit tests do not validate all mode interactions or alternate input paths.
- Priority: Medium.

---

*Concerns audit: 2026-10-03*
