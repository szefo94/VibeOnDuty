# Architecture Research

**Domain:** Server-authoritative browser FPS, cross-device clients, Raspberry Pi hosting, Blender-assisted content
**Project:** VibeOnDuty
**Researched:** 2026-10-03
**Confidence:** MEDIUM for architecture recommendations; LOW for unmeasured hardware capacity and projectile fairness tuning

## Standard Architecture

### System Overview

Use one headless match simulation per room, a shared movement/combat kernel, and browser presentation adapters. Keep Three.js and the existing browser shell. Extract the first playable multiplayer slice incrementally; a whole-game rewrite is unnecessary. This is a project-specific recommendation informed by the local architecture and room lifecycle documentation. [MEDIUM; local evidence, S1]

```text
Browser: DOM/device input -> input commands -> local prediction
                                    |               |
                                    | WSS           v
                                    |        Three.js/HUD/audio
                                    v               ^
Pi: admission/lobby -> authoritative match room -> snapshots/events
                                    |
               shared simulation: movement, collision, projectiles, rules
                       |                         |
                 compiled map              server result outbox
                                                 |
                                         persistence worker -> SQLite

Authoring: existing maps / editor 2 / Blender -> compiler + validation
                                              |             |
                                        client assets   server map package
```

Keep static frontend deployment on the current prefix-aware host and configure the dedicated WSS endpoint separately. A Pages deployment is not the match server. Treat protocol, simulation rules, and gameplay map hashes as admission requirements; visual assets can evolve without changing authority when collision remains identical. [MEDIUM; recommendation]

### Component Responsibilities

| Component | Owns | Communication |
|-----------|------|---------------|
| Shared simulation | Scalar entity state, fixed-step movement, weapon/projectile rules, collision queries | Explicit state + input + world arguments; no DOM/WebGL imports |
| Match room | Authoritative world, input queues, bots, teams, rules, history, score | Commands in; tick-stamped snapshots and confirmed events out |
| Admission/lobby | Capacity, supported mode/map combinations, ready state, reconnect seats | Creates/configures rooms; does not decide hits |
| Browser network session | Clock estimate, input sequence, acknowledgements, snapshot buffer | Transport adapter; explicit connect/leave/dispose lifecycle |
| Browser prediction | Local command replay and immediate local feedback | Shared kernel; confirmed baseline from room |
| Presentation | Cameras, rigs, mixers, weapon meshes, HUD, effects, quality settings | Reads predicted local/interpolated remote state and confirmed events |
| Bot controller | Server-side perception, navigation, tactical intent | Produces commands for the same movement/weapon rules as humans |
| Map compiler | Authoring validation and derived render/collision/nav/gameplay outputs | Versioned map package; no executable code in uploads |
| Persistence service | Identity, unlocks, saved loadouts, idempotent match rewards | Asynchronous result jobs and validated menu requests |

## Recommended Project Structure

```text
shared/
  protocol/                 # commands, snapshots, versions, validation
  simulation/               # state, fixed tick, movement, combat, rules
  world/                    # map schema, collider data, queries, nav data
  catalogs/                 # authoritative weapon/material/movement config
server/
  rooms/                    # match and lobby lifecycle
  bots/                     # perception and command generation
  persistence/              # repository adapter, result queue, DB worker
  deployment/               # ARM64 service config and measured limits
src/
  net/                      # client transport, clocks, prediction, interpolation
  presentation/             # adapters around existing builders/HUD/effects
  editor2/                  # later authoring UI and document commands
tools/
  maps/                     # package compiler and verification
  retarget.py               # retain/evolve existing offline pipeline
```

This is a destination structure, not a mandate to move every file immediately. First extract computation behind narrow functions and adapt the existing consumers. JavaScript ES modules remain compatible with the current repository; stronger checking for new shared/server boundaries can be introduced independently. [MEDIUM; recommendation]

### Brownfield Integration Boundaries

| Existing area | First extraction | Reason |
|---------------|------------------|--------|
| `entities/player.js`, `loop.js` | Explicit body position/velocity and `stepMovement(state, command, world, dt)` | Camera position currently doubles as simulation position |
| `combat/shoot.js` | Pure projectile records and swept hit queries; effects consume events | Current bullets allocate Three.js objects and hit render `wallMeshes` |
| `map.js`, `tiles.js`, `rampMath.js` | Constructed world/query object from validated map data | Live globals prevent independent rooms and map cache isolation |
| `maps/*`, `level.js` | Separate gameplay data from materials and `buildExtras` | Built-in definitions import rendering; headless server must not import them directly |
| `snd.js`, `tdm.js`, mode manager | Constructed rules objects with start/tick/join/death/end/dispose hooks | Existing nullable singleton mode and cleanup convention cannot own multiple matches |
| Enemy/AI modules | Server entity pool and bot command adapter | Friendly/hostile bots currently share browser state and visual dependencies |
| Input, HUD, builders | Keep browser adapters; use stable network entity IDs | Preserve usable client experience during extraction |

Local evidence: `.planning/codebase/ARCHITECTURE.md`, `src/entities/player.js`, `src/combat/shoot.js`, `src/map.js`, `src/maps/bunker.js`, `src/level.js`, and `tools/README.md` were read. Existing multiplayer, account, and persistence infrastructure was not found in the mapped runtime. [MEDIUM]

## Architectural Patterns

### Pattern 1: Fixed simulation tick, independent render and snapshot rates

Run the authoritative simulation at a fixed step and send state at a separately chosen patch rate. Colyseus rooms provide lifecycle and timestep facilities; defaults are not a performance target. Start benchmarking 60 Hz simulation with 20–30 Hz snapshots against a 30 Hz alternative, then select by responsiveness and Pi headroom. These rates are trial configurations, not verified capacity. [MEDIUM for pattern, LOW for rates; S1, S2]

Keep simulation state in serializable scalars, with one time unit at the boundary and tick-based gameplay deadlines. Bound queued commands and catch-up work; never let a delayed browser packet grant unlimited movement steps. When no fresh command arrives, apply a defined idle/held-input timeout and stop one-shot actions. Mobile app switches and pointer unlock do not pause an online match. [MEDIUM; recommendation]

### Pattern 2: Prediction with explicit replay state

Commands carry sequence, intended tick, movement axes, aim and action edges. The room validates finite values, ownership, timing and action eligibility; clients never submit accepted positions, damage or kills. A snapshot identifies server tick and last processed input. Restore the authoritative local baseline, discard acknowledged commands, replay the remaining commands through the shared kernel, and smooth only presentation error. [MEDIUM; S2, S3]

Remote actors render from a delayed snapshot buffer with bounded extrapolation and explicit teleport/respawn resets. Use one interpolation policy for human and bot combat actors initially so their presentation/hit timing can be explained consistently. Predicted muzzle flash and tracers may appear immediately; damage, score and decisive hit feedback follow server confirmation. [MEDIUM; S3, recommendation]

```javascript
// Boundary sketch: the movement helper returns state and semantic events.
const predicted = stepMovement(localState, input, collisionWorld, fixedDt);
// Reconciliation reuses the same helper from a confirmed baseline.
for (const cmd of pendingAfter(snapshot.lastProcessedInput)) {
  localState = stepMovement(localState, cmd, collisionWorld, fixedDt).state;
}
```

Rapier's deterministic WASM simulation still requires identical initial conditions, entity creation order and deterministic external calculations. Its guarantee does not make existing `Math.random()`/platform-dependent initialization reproducible. More importantly, a network reconciler restoring scalar positions does not restore a physics engine's internal state. Prefer kinematic scalar character state with Rapier collision queries initially; dynamic physics prediction requires explicit engine snapshot/restore and replay design. [MEDIUM; S4, S5]

### Pattern 3: Authoritative travelling projectiles with a bounded history policy

Current bullets travel and are swept against world geometry and enemies. Preserve that model on the server. Valve documents historical player compensation and explicitly distinguishes normal hitscan compensation from visible projectile difficulties. Colyseus 0.18 rewind views provide useful history primitives, but do not by themselves specify a physically consistent travelling-bullet policy. [MEDIUM; local evidence, S6, S7, S8]

Recommended prototype: validate the fire command and reconstruct an allowed launch time/origin from authoritative shooter history; cap backdating using measured clock/latency bounds. Traverse each catch-up segment against actor poses and dynamic obstruction states at that segment's time, then continue the surviving projectile in the live world. Static colliders use the admitted map hash. If history is unavailable, use a documented fallback rather than extrapolating indefinitely. [MEDIUM design inference; LOW fairness/performance until measured]

Do not freeze every target at the initial fire-time pose for the bullet's full lifetime. Do not subtract remote interpolation delay from a physical launch timestamp merely because hitscan rewind does so. Physical projectile leading and any extra view-time compensation are separate design choices; compare them under latency before committing to fairness rules. No architecture source establishes the final policy for this game. [MEDIUM design inference]

Process collision candidates by earliest time of impact across walls and actors; wall-first tests must not override an actor struck before a later wall. Penetration uses authored material ID, thickness/exit point, remaining energy and bounded successive traversals. Store shooter/target spawn generations and event IDs so late confirmation cannot hit a new life or award a duplicate kill. Decide late lethal-hit/trade eligibility explicitly; do not silently rewrite committed rounds. [MEDIUM; recommendation]

Required focused validation: crossing targets, cover entry, floor changes, multiple penetrations, simultaneous deaths, respawn boundaries, malformed/future timestamps, packet bursts and 0/50/100/200 ms simulated RTT. History memory and per-shot catch-up cost belong in the Pi benchmark. [MEDIUM; recommendation]

### Pattern 4: Shared collision authority; cameras and animation follow bodies

Establish basic swept body collision, ground/ceiling checks and a shared collider package during multiplayer. This prerequisite does not move the full omnimovement overhaul earlier. Later add a gameplay state machine for directional sprint, slide, dive and prone, with authoritative transition times and posture collider rules. Cameras derive from body state and perform their own clearance sweep. [MEDIUM; recommendation]

Rapier provides move-and-slide, slopes, autostep and ground snap, but its character controller supports translations rather than rotational movement. Prone turning, diving body rotation, resizing under ceilings and standing clearance need explicit game-specific tests and sweeps. Prefer capsule/box queries over render-mesh collision; visual bones never become the authoritative movement controller. [MEDIUM; S4]

### Pattern 5: Compile content from editable source into a runtime contract

Keep an editable source document and compile versioned outputs: visual assets/instances, simplified colliders with material semantics, terrain, navigation, spawns, bounds and objectives. Admit a map by authoritative gameplay hash and supported mode/capacity metadata. Publish immutable packages so all clients and the room agree on geometry throughout a match. [MEDIUM; recommendation]

Initially adapt existing tile/floor serialization through a compiler rather than replacing the editor. Preserve integer tile IDs and migrate formats explicitly. Fix first-floor navigation and import-time map caches where required for chosen multiplayer maps; do not allow different room dimensions to share mutable caches. [MEDIUM; local evidence]

Editor 2's placement, drawing/extrusion, sculpting and prompt assistance should all emit document operations against this same schema. Run geometry/nav compilation in a browser worker or offline build worker, outside the gameplay frame and room tick. Generated proposals must pass the same budgets, topology and gameplay validation as manual edits; compile their accepted data rather than execute generated scripts in a match. [MEDIUM; recommendation]

## Data Flow

1. **Join:** client supplies session and versions; lobby validates requested 8/12/16/24 capacity, map/mode fit and bot-fill policy; room returns authoritative configuration and full baseline.
2. **Play:** device adapters produce commands; client predicts; room validates/steps movement, weapons, projectiles, bots and mode; snapshots reconcile local state and populate remote buffers.
3. **Rules:** TDM/DM share combat and respawn services; S&D adds round deaths/bomb state; CTF owns flag carrier/drop/return state; Hardpoint owns rotation, occupancy and scoring. Clients display these results.
4. **Bot fill:** bots occupy gameplay slots, not network connections. `maxClients` alone is not the human-plus-bot capacity rule. Human admission replaces a bot at a defined safe boundary; reconnect seats remain distinct from vacant slots.
5. **Match result:** server finalizes a unique result ID; persistence worker commits rewards once; menu reads unlocks/loadouts; room validates effective equipment and stats before spawning.
6. **Authoring:** source edits -> compiler -> validation -> playtest package -> reviewed publication -> version/hash selected by the room.

All flows above are architectural recommendations [MEDIUM]. Colyseus admission/reconnection/disposal hooks support the lifecycle; policy for team slots, replacement and rounds remains game-owned. [S1]

## Later Content Boundaries

### Characters, motion and comic-book materials

Keep the existing offline single-skeleton retargeting baseline while evaluating replacements. Use a canonical deform rig, rest pose, units, bone/socket names, in-place clips, clip semantic manifest and reproducible Blender export. Rigify can supply authoring controls, but the runtime contract should use baked deformation bones. Blender glTF export behavior changed with action slots in 4.4; pin the tool version and inspect actual exported clips instead of copying old NLA assumptions. [MEDIUM; local evidence, S9, S10]

Network semantic movement/action state, start tick, direction and equipped IDs; clients produce locomotion blends and first/third-person presentation. Do not transmit every bone. Server hit shapes follow authoritative stance/action state independently of visual blend fidelity. Use proper skeleton cloning and per-character mixers with shared-resource ownership. [MEDIUM; S11, S12, recommendation]

Comic-book texture palettes, cel lighting and outlines are client quality features; they do not affect penetration or hit authority. Three.js toon material exposes a gradient map, but outlines and illustrated textures need their own art/performance choices. Verify real poses, weapon grips, transitions and phone render budgets in-game. [MEDIUM; S13, recommendation]

Blender supports background Python execution and explicit Python failure exit codes. No Blender executable was found on PATH, under the inspected standard Program Files locations, or in the searched user tree; a portable installation elsewhere remains possible. No Blender connector was exposed. Confirm the automation path during the character phase; no art edits were run for this research. [MEDIUM; local inspection, S14]

### Weapons, loadouts and progression

Weapon/attachment/material catalogs are shared data with server ownership. Clients request IDs/tuning; the server verifies unlocks, combinations and bounded settings and computes effective stats. The 3D loadout preview consumes visual descriptors for the same IDs. Progression identity is persistent and distinct from a transient room/session ID. [MEDIUM; recommendation]

Use a small repository adapter and SQLite worker on one host initially. Commit server-earned match rewards transactionally with a uniqueness key; do not write every movement tick or let client localStorage grant unlocks. WAL permits readers alongside one writer and requires same-host storage. Check actual embedded SQLite version against the documented WAL-reset fix (3.51.3 or specified backport); choose backup and durability policy in the persistence phase. [MEDIUM; S15, S16]

### Professional map workflow and the final two maps

Use concept/mode/capacity brief -> metric blockout -> repeated movement/combat playtests -> modular kit -> art pass -> collision/nav/performance regression -> release package. Epic's blockout workflow prioritizes playable scale, layout and sightline testing; Lyra demonstrates retaining parametric authoring sources while baking reusable meshes. Apply the process to this browser compiler, not Unreal-specific runtime features. [MEDIUM; S17, S18]

Freeze movement metrics before polishing maps: body dimensions, prone clearance, slide/dive travel, step/slope limits, jump envelope and bullet/penetration behavior. Record supported modes and capacities per map or validated layout variant; a capacity setting does not make one layout appropriate for every mode. Playtest spawn safety, objective travel times, flank routes, vertical traversal, bot reachability and combat density at each advertised size. [MEDIUM; recommendation]

Produce/adapt at least two maps after editor 2. Retain editable sources, provenance and explicit reuse/modification terms. Sample-project documentation supplies workflow evidence, not a blanket license to port its content. Final map selection and quantitative layout metrics remain phase decisions. [MEDIUM; project scope, recommendation]

## Scaling Considerations

| Scale | Architecture adjustment and gate |
|-------|----------------------------------|
| First playable room, 8 total slots | One Node process; measure human and bot mixes, tick p95/p99, corrections, history cost and outgoing bytes |
| 12/16/24 slots | Enable each size only after representative map/fire-rate/bot-path workloads pass on actual cooled Pi hardware |
| Multiple rooms on one Pi | Bound room admission; isolate expensive bot/path jobs; add process separation only after profiling confirms benefit |
| Multiple hosts later | Shared discovery/identity/persistence service as needed; retain one authoritative owner per match |

Total slots mean humans plus bots. RAM size alone does not establish capacity: 4 GB versus 16 GB hardware is unresolved, and CPU, cooling, storage and uplink also matter. Bots add AI/pathfinding cost without replacing collision/combat cost. Choose tick budgets with headroom below the step duration; record actual tail latency instead of average FPS. [LOW capacity; MEDIUM measurement recommendation]

## Anti-Patterns

| Mistake | Consequence | Use instead |
|---------|-------------|-------------|
| Import browser singletons into the server with fake DOM | Hidden rendering dependencies and shared room state | Constructed DOM-free simulation/world objects |
| Accept client transforms or hit reports as outcomes | Speed, fire-rate, equipment and damage authority leaks | Bounded input intents and server decisions |
| Rewind once and raycast the complete bullet path | Treats moving bullets and moving targets as a static hitscan test | Per-time traversal with an explicit compensation policy |
| Restore only position while replaying stateful physics | Correction drift and unreproducible engine state | Scalar kinematic replay or complete engine restoration |
| Collision uses render meshes while movement uses tile globals | Body, bullets, bots and client/server disagree | One compiled collider/material contract |
| Animation release callbacks decide gameplay | Quality/clip differences change firing and grenade timing | Simulation-owned deadlines; visuals follow semantic events |
| Prompt-generated art becomes the map directly | Missing collision, navigation, objectives and budgets | Shared validated source schema and compiler |

## Suggested Build Order and Research Flags

1. **Multiplayer foundations and playable TDM slice:** shared state/protocol, basic collision package, room lifecycle, prediction/reconciliation, server bullets and two-browser play. Keep current art/maps where viable.
2. **Multiplayer completeness:** lobby, reconnect, capacities, bot fill, S&D/DM/CTF/Hardpoint rules, projectile-latency prototype and Pi load validation. Do not certify 24 slots before measurement.
3. **Movement overhaul:** extend shared state/collision with directional sprint, slide, dive/prone and camera clearance; re-run latency and map traversal cases.
4. **Character/animation overhaul:** canonical rig, Blender pipeline, motion library, first/third-person blends and comic-book rendering with visual/device checks.
5. **Combat/content expansion:** attachments/tuning/loadouts, identity/progression, equipment and streaks through the established authority/persistence boundaries.
6. **Editor 2 and compiler:** modular/extrusion/sculpt/prompt operations, migration, consistent outputs and publish validation.
7. **At least two final maps:** blockout/playtests first, then modular art and supported mode/capacity qualification.

These are dependency groups for roadmap synthesis, not fixed phase numbers. They preserve the user's delivery order. Deeper research is essential for projectile fairness/history, omnimovement collider transitions, Pi capacity, character visual workflow and editor compilation. Standard room lifecycle and transactional persistence patterns need version/tool verification and focused implementation planning. [MEDIUM]

## Sources

Confidence provenance: `gsd-tools query classify-confidence --provider websearch --verified` returned **MEDIUM**; without verification it returned **LOW**. Six research-plan digests were cached with the verified-provider tier. Documentation was checked on 2026-10-03; rolling docs do not establish a package API without a pinned-version check. Local evidence and design inferences are identified above.

- **S1:** [Colyseus rooms and lifecycle](https://docs.colyseus.io/room), including separate patch/timestep controls and admission/disposal hooks. MEDIUM.
- **S2:** [Colyseus server input and fixed timestep](https://docs.colyseus.io/netcode/server-input). MEDIUM; current docs include 0.18-era APIs.
- **S3:** [Valve Source multiplayer networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking). MEDIUM; established model, not current browser-library API guidance.
- **S4:** [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/). MEDIUM; JavaScript guide identifies version 0.21.
- **S5:** [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) and [Colyseus physics prediction recipes](https://docs.colyseus.io/netcode/recipes). MEDIUM.
- **S6:** [Valve weapon authoring](https://developer.valvesoftware.com/wiki/Authoring_a_weapon_entity). MEDIUM; specifically discusses hitscan versus visible projectiles.
- **S7:** [Colyseus lag compensation](https://docs.colyseus.io/netcode/lag-compensation). MEDIUM; explicitly available in 0.18+.
- **S8:** [Colyseus determinism contract](https://docs.colyseus.io/netcode/determinism). MEDIUM.
- **S9:** [Blender 4.5 glTF export](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html). MEDIUM; fetched directly after browser fetch failure.
- **S10:** [Blender Rigify basics](https://docs.blender.org/manual/en/latest/addons/rigging/rigify/basics.html). MEDIUM; indexed 4.4 manual, preserve metarig source.
- **S11:** [Three.js SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html). MEDIUM; confirm r160-compatible API when implementing.
- **S12:** [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html). MEDIUM.
- **S13:** [Three.js MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html). MEDIUM.
- **S14:** [Blender command-line arguments](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html). MEDIUM; fetched directly.
- **S15:** [SQLite WAL](https://sqlite.org/wal.html). MEDIUM; includes 2026 WAL-reset fix information.
- **S16:** [SQLite transactions](https://sqlite.org/lang_transaction.html). MEDIUM.
- **S17:** [Epic project setup and level blockout](https://dev.epicgames.com/documentation/en-us/unreal-engine/designer-01-project-setup-and-level-blockout-in-unreal-engine). MEDIUM.
- **S18:** [Epic Lyra geometry tools](https://dev.epicgames.com/documentation/en-us/unreal-engine/lyra-geometry-tools-in-unreal-engine). MEDIUM; authoring/baking workflow reference.

---
*Architecture research for VibeOnDuty; researched 2026-10-03. No gameplay, dependencies or assets changed.*
