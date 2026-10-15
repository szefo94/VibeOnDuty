# Project Research Summary

**Project:** VibeOnDuty
**Domain:** Cross-device browser multiplayer FPS; authoritative ARM64 server; comic-book human characters and assisted map authoring
**Researched:** 2026-10-03
**Confidence:** MEDIUM overall; LOW for unmeasured capacity and projectile fairness tuning

## Executive Summary

VibeOnDuty is an existing Three.js browser FPS evolving into a dedicated-server multiplayer game for phones, integrated-graphics PCs and gaming PCs. The recommended approach is incremental extraction of a shared, headless movement/combat kernel, with an authoritative match room and browser presentation adapters. Keep the existing renderer, assets and maps for the first multiplayer slice. The server must derive movement, firing, hits, damage, kills and score from bounded player intentions; replicated client outcomes would not satisfy the core value. Colyseus room, prediction and history APIs are useful foundations, but neither those APIs nor physics determinism supply a finished FPS or settle travelling-projectile latency fairness.

Preserve the user's order: multiplayer and five modes; omnimovement and collision/camera repair; believable human characters with comic-book rendering and animation; weapons, attachments, progression, live loadouts, equipment and streaks; the second combined editor; then at least two maps produced or adapted through it. Multiplayer needs minimum shared collision, objective markers and lifecycle repair first, without moving the full movement/editor overhaul forward. Recommend Node 24, Colyseus 0.18 over WSS, identical client/server Rapier WASM builds, and explicit protocol/content versions. These are researched candidates, not an installed or jointly validated stack.

The largest risks are mismatched projectile timelines, divergent collision/prediction, singleton lifecycle leakage, and unmeasured CPU/GPU budgets. Prototype bounded projectile-history policies and test impaired networks before expanding combat. Benchmark 8/12/16/24 total human-plus-bot slots on identified Raspberry Pi hardware, and measure sustained frame times on named devices across all three client classes. A Pi 5 with 4 GB and an unspecified 16 GB configuration remain alternatives to validate; additional RAM does not establish tick capacity. The 60 FPS goal remains a target. Keep editable sources and asset-specific terms, review exported art in-game, and compile maps into consistent visual/collision/navigation/objective artifacts. No complete reusable FPS map source was qualified by this research; adaptation remains an explicit research task.

## Key Findings

### Recommended Stack

See [STACK.md](STACK.md) for exact source references, alternatives and compatibility caveats. Official release/registry metadata supports the proposed versions and declared engine/peer ranges; it does not prove clean installation, combined gameplay integration or ARM capacity.

**Core technologies:**

| Technology | Recommendation | Purpose and constraint |
|---|---|---|
| Three.js / Vite | Retain locked 0.160.1 / 8.0.8 initially | Preserve working rendering and prefix-aware static deployment; dedicated server uses a separately configured endpoint. |
| Node.js / TypeScript | Candidate Node 24.21.0 LTS ARM64; existing TS 6.0.2 for new boundaries | Pin CI/server runtime; current Node 20 CI is below Colyseus 0.18's Node >=22 requirement and reported EOL. Strictly check new protocol/shared/server code. |
| Colyseus | Core 0.18.18, SDK 0.18.4, schema 5.0.35, WS transport 0.18.4 | Room lifecycle, fixed-step inputs, deltas, prediction and history; game rules, timestamp validation and fairness remain application-owned. |
| Rapier WASM | Identical 0.21.0 compat build on client/server | Shared collision queries and kinematic controller; prone/dive rotation, collider changes and replay restoration need explicit implementation. |
| SQLite | Later DB-owning worker, candidate `node:sqlite` | Keep synchronous disk work out of ticks; driver release-candidate status and deployed SQLite/WAL-fix version need validation. |
| Blender / glTF | Candidate Blender 4.5.14 LTS, versioned Python, GLB plus gameplay JSON | Reproducible offline export; installed tooling/script compatibility and runtime appearance remain unverified. |
| Existing Vitest / Playwright | Extend meaningful simulation and multi-browser checks | Validate authority, replay and lifecycle; real-device performance and pose quality require separate measurements/review. |

Use WSS initially. Consider WebTransport only after transport-loss profiling warrants it and target-browser/ARM support is verified; library experimental status differs from browser API availability. Evaluate 60 Hz simulation / 20 Hz snapshots against lower-rate alternatives as experiments, not commitments. Rapier determinism depends on identical worlds, order and steps; scalar reconciliation does not automatically restore engine internals.

### Expected Features

See [FEATURES.md](FEATURES.md). Product commitments come from PROJECT.md; external references inform choices without adopting franchise balance or expanding scope.

**Must have (selected product scope):**

- Lobbies, dedicated authority, responsive predicted control and smooth remote actors; TDM, no-in-round-respawn S&D, free-for-all DM, CTF and rotating Hardpoint.
- Selectable 8/12/16/24 total slots with optional bot fill. Bots share team, life, objective and combat rules, occupy slots, and have a defined replacement policy.
- Cross-device input/quality settings and measured 60 FPS target; correct elevation, body collision and camera clearance, followed by agreed omnimovement.
- Humanlike anatomy, smooth directional/action animation, consistent weapon grips and illustrated textures/outlines/stylized lighting, iterated through Blender and in-game review.
- Fast kills, regeneration, ADS, headshots, recoil, bullet travel and selected-surface penetration; multiple rifles/SMGs, progressive weapon/attachment unlocks, tuning, optics/reticles/red-green dots, live 3D loadouts, equipment and score streaks.
- A second editor combining modular placement, drawing/extrusion, sculpting and prompt assistance; at least two playable maps with declared mode/capacity fit and licensed editable sources, including research into adapting suitable popular/reusable map sources.

**Should have (selected differentiators and optional approaches):**

- Accessible browser omnimovement and coherent comic-book human characters are selected differentiators.
- Reproducible Blender/LLM-assisted creation and one editable command model across editor tools support the selected workflow.
- Numerical attachment comparisons and automatic capacity-aware map reports are optional recommendations for discussion, not accepted requirements.

**Defer (v2+):** Armor plates are explicitly deferred. Larger catalogs and advanced editor features can follow validation. Accounts/social/monetization suites, recorded killcams and whole-franchise mechanic replication are not selected scope. Do not silently defer requested progression, editor capabilities or maps; choose only the identity/persistence policy needed by the selected unlock experience. Existing local regeneration, ADS and travelling bullets are migration baselines, not approved multiplayer balance.

### Architecture Approach

See [ARCHITECTURE.md](ARCHITECTURE.md). Separate authoritative simulation body state from camera, rig and effects. Construct a world and rules instance per match; browser modules with DOM/WebGL initialization and mutable map/entity globals cannot be imported as a production server kernel. Extract narrow functions and keep the existing UI/builders behind adapters.

**Major components:**

1. **Shared simulation and catalogs:** Fixed-step movement, weapons, swept projectiles, damage, posture hit volumes and canonical map collision; explicit state/input/world arguments.
2. **Match room, lobby and bots:** Validated commands, teams, objectives, input/history bounds, slot admission, reconnect/respawn/disposal, authoritative score and bot intent through the same rules.
3. **Browser session/presentation:** Command sequencing, clock estimate, acknowledged-input replay, remote interpolation, predicted cosmetic feedback, rigs/HUD/cameras and quality settings. Confirm damage/kills from the server.
4. **Content compiler and editor:** Versioned editable source produces immutable visual/collider/material/navigation/spawn/objective packages; admit gameplay hashes and preserve existing tile serialization through adapters.
5. **Later persistence worker:** Chosen identity, unlock/loadout validation and transactional, idempotent server result awards; disk work remains outside match ticks.

Projectile experiments should validate launch time against authoritative history, sweep every catch-up segment against the corresponding historical state, then continue live simulation. Cap history/backdating and identify match/spawn generations. Compare cover/trade fairness; do not freeze targets at firing time for an entire bullet lifetime or apply hitscan view-time rewind blindly. Bots need independent AI/pathfinding budgets. Network semantic motion/action state and equipment IDs, rather than animated bones.

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for additional safeguards and warning signs. Source-inspected repository concerns are not newly reproduced browser bugs.

1. **Replication mistaken for authority or trusted timestamps:** Validate finite bounded intentions, membership, sequence/age, cadence/ammo and action eligibility; derive outcomes and reject replay across lifetimes.
2. **Inconsistent travelling-projectile timelines:** Specify bounded launch/catch-up/history policy, earliest time-of-impact ordering and confirmed outcomes; test moving targets, cover, floors, simultaneous deaths and respawns under latency/loss.
3. **Capacity inferred from RAM or localhost:** Thermal-soak identified Pi and client devices; measure tick/frame p95/p99, queue age, bytes, memory and bot/history costs at each slot size. Repeat after major content changes.
4. **Separate movement/collision truths and leaked lifecycle state:** Use shared collision data and fixed-step rules, simulation-time deadlines and explicit teardown. Projectiles/objectives continue independently of the living local player; cameras obey clearance without changing authoritative aim/body state.
5. **Untrusted or nonreproducible content and progression:** Bound imports and declarative prompt operations; link compiled artifacts by hash; retain editable sources/licenses. Keep root motion out of gameplay movement, preserve resource ownership, review real poses, and validate loadouts/rewards on the server.

## Implications for Roadmap

The six groups below preserve the selected delivery sequence. They are dependency/gate recommendations, **not six fixed roadmap phases**. Workflow preferences and phase granularity are pending; the roadmapper may split groups while preserving order and complete scope.

### Delivery Group 1: Authoritative Multiplayer, Modes and Measured Hosting

**Rationale:** First validate the core value using current assets/maps; establish contracts later systems will extend.
**Delivers:** Shared headless simulation, minimum canonical collision, WSS/lobbies, prediction/reconciliation/interpolation, server hit recognition, explicit match lifecycle, all five selected modes, optional bot fill and 8/12/16/24 slot configuration. Add only essential existing-map objective markers and cache/navigation fixes needed for the chosen matches.
**Addresses:** Multiplayer table stakes, server travel/combat baseline, cross-device input and initial Pi/client measurement.
**Avoids:** Client outcome authority, unchecked timestamps, projectile-history mismatch, stale mode/timer state and RAM-based capacity claims.
**Gate:** Begin with two real clients completing/restarting TDM; then FFA, S&D, CTF and Hardpoint on the same foundation. This first slice does not reduce the full five-mode commitment. Publish measured hardware/slot/bot/network profiles and unresolved capacity limits; never promise every selectable size on every Pi before testing.

### Delivery Group 2: Omnimovement and Collision/Camera Reliability

**Rationale:** Extend proven replicated body state before choosing the full animation/content catalog.
**Delivers:** Discussed sprint/slide/dive/prone/directional transitions, action/ADS permissions, input mappings and complete elevation/body/camera repair.
**Addresses:** Omnimovement and terrain/wall/ceiling correctness across keyboard, touch and gamepad.
**Avoids:** Duplicated rules, posture collider gaps, animation-driven position and camera peeking.
**Gate:** Replay parity and impaired-network movement tests, multi-floor/ceiling/stance sweeps, simultaneous mobile actions and visual clearance review. Freeze useful movement metrics for later map design.

### Delivery Group 3: Human Characters, Animation and Comic-Book Art

**Rationale:** Stable movement semantics determine clips, blend transitions, posture and hit-shape alignment.
**Delivers:** Accepted human rig/source, licensed motion, reproducible Blender export, directional/action animation, grips and illustrated browser materials with scalable outlines/lighting.
**Addresses:** Human anatomy, smooth movement-matched animation, Blender/LLM iteration and the chosen art direction.
**Avoids:** Discarding working retargeting without comparison, root-motion conflicts, wrong hand basis, shared-resource disposal and Blender-only appearance approval.
**Gate:** One representative character/weapon/environment slice reviewed in-game before scaling production; repeated spawn/disposal and sustained three-device-class budgets. Confirm the actual Blender installation/automation path first.

### Delivery Group 4: Combat, Weapons, Progression and Live Loadouts

**Rationale:** Extend authoritative combat and accepted sockets/rigs with data-driven equipment and persistence.
**Delivers:** Full fast-combat balance, head/body zones, travel/selected penetration, small distinct multi-rifle/SMG roster, attachments/tuning/optics/reticles, progressive unlocks, live 3D previews, additional equipment and score streaks; make drone reconnaissance useful or remove it.
**Addresses:** All selected weapon/progression/loadout requirements; identity/save lifetime remains a discussion decision.
**Avoids:** Browser-owned unlocks, duplicate rewards, illegal stats, decorative attachment tradeoffs, unbounded penetration and uncapped preview rendering.
**Gate:** Authoritative cadence/loadout/unlock rejection, repeated/crash-recovered result commits, preview/equipped parity, combat trials and useful team-scoped reconnaissance. Refine projectile fairness rather than assume foundation APIs solved it.

### Delivery Group 5: Second Combined Editor and Map Pipeline

**Rationale:** Use stable movement/combat/material requirements to design one editable source contract and reproducible bake.
**Delivers:** Modular placement, footprint drawing/extrusion, terrain sculpting and prompt-assisted edits with undo/save/reopen/playtest; validated render/collision/nav/objective outputs and explicit old-editor adapter policy.
**Addresses:** The complete selected second-editor workflow, without attempting a browser-wide Blender replacement.
**Avoids:** Executable imported/generated content, divergent bakes, oversized geometry and irreversible opaque prompt output.
**Gate:** Start placement/document operations, add bounded extrusion/sculpting, then prompt proposals using the same commands. Backend/provider choice is unresolved; no LLM SDK or Blender MCP is implied. Test hostile imports, artifact consistency and source-to-package reproduction.

### Delivery Group 6: At Least Two Playable Maps and Qualified Adaptations

**Rationale:** Final maps should exercise the actual editor, movement and mode contracts.
**Delivers:** At least two produced/adapted maps, editable sources and provenance, declared supported mode/capacity combinations, and researched adaptation of suitable reusable popular-map sources.
**Addresses:** Professional blockout-to-art workflow, source reuse research and final playable content.
**Avoids:** Mistaking engine code licenses for map/texture rights, polishing before playtests, universal mode/size assumptions and unreachable bot objectives.
**Gate:** Verify candidate source/component terms and files; test spawn safety, objective travel, flanks, vertical movement, bot routes and network/render cost at advertised sizes. No complete source map is currently qualified. Original layouts from verified kits are a fallback if suitable adaptations cannot be established; this does not waive the requested research into reusable sources.

### Phase Ordering Rationale

- Put shared simulation/collision, protocol and minimal map authority inside multiplayer; keep full movement, character, weapon, editor and map overhauls in the selected order.
- Use explicit per-match worlds/lifecycle and stable content IDs to avoid rewriting authority when adding movement, rigs or attachments.
- Let movement determine animation and layout metrics; let combat materials determine penetration metadata; let the editor compiler generate the final maps.
- Treat performance, network impairment, source provenance and lifecycle verification as recurring gates, not a final polishing phase.

### Research Flags

**Needs deeper phase research:**

- **Multiplayer:** Clean-install/API spike, scalar Rapier replay, projectile-policy comparisons, transport/tick/snapshot envelope, Pi model/access topology and bot capacity.
- **Movement:** Exact move/action rules, rotating/resizing collider clearance and touch/controller ergonomics.
- **Characters:** Actual Blender tooling/exporter, accepted rig/license/source tier, clip compatibility and browser art budget.
- **Weapons/progression:** Balance and penetration policy, attachment legality, identity/recovery/save lifetime and durable storage implementation.
- **Editor/maps:** Editable scene/bake schema, prompt backend, navigation/import formats, qualified complete reusable sources and two-map mode/capacity matrix.

**Standard patterns that can skip redundant research when isolated:** Bounded schemas, per-room lifecycle, data-driven mode state machines, asynchronous transactional result jobs, undoable document commands and GLB resource ownership. Existing Vitest/Playwright/Vite and prefix-aware deployment also have established local patterns. Their ordinary implementation is documented; these do not exempt the surrounding groups from the integration research above. Assign actual `$gsd-plan-phase --research-phase <N>` flags only after roadmap numbering exists.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | MEDIUM | Official release/registry/API sources support versions and capabilities; no clean combined install, replay spike or target deployment was run. |
| Features | HIGH for selected scope; MEDIUM for reference adaptations | PROJECT.md records user commitments; official historical franchise references and creator terms inform candidates, not adopted numerical rules or asset suitability. |
| Architecture | MEDIUM | Source-backed brownfield boundaries and established patterns; proposed projectile catch-up fairness and rates remain LOW until experiments. |
| Pitfalls | MEDIUM | Documented failure mechanisms and static repository concerns; exploitability, visual results and capacity were not newly reproduced. |

**Overall confidence:** MEDIUM. Original reports used the GSD `websearch --verified` confidence seam; primary evidence is useful but integrated feasibility remains untested. No unavailable Context7 evidence is implied.

### Gaps to Address

- **Hardware and acceptance envelope:** Confirm Pi model/RAM/ARM64 OS/cooling/storage/access topology, named phones/iGPU/gaming PCs, latency conditions and numeric tick/frame p95/p99 limits. Measure sustained workloads before claiming support.
- **Netcode and projectiles:** Validate proposed packages together; decide history size, timestamp bounds, dynamic obstruction history, late trades and backdated projectile fairness from traces/playtests.
- **Movement:** Select exact transitions, colliders, shoot/ADS permissions and cross-device bindings; validate current-map lower floors and camera clearance.
- **Art tooling and assets:** Locate/install the actual Blender baseline, validate scripts/export, source tiers and redistribution terms, then review actual browser poses/materials and resource costs.
- **Progression:** Choose minimal identity/recovery and save lifetime; decide catalogs, reward durability and SQLite driver/version/backup policy without adding a generic account suite.
- **Editor/maps:** Select prompt backend and authoring/bake/import formats; inspect actual licensed map/kit files and component terms. Choose two settings and each map's mode/size support matrix. Complete-source map reuse is unresolved.
- **Roadmap granularity:** Await workflow preferences; the ordered groups above must not become an arbitrary final phase count.

## Sources

Detailed claim-level citations and the complete source inventories remain in [STACK.md](STACK.md), [FEATURES.md](FEATURES.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [PITFALLS.md](PITFALLS.md). Sources below aggregate the decision-critical evidence already reviewed by those researchers; no additional browsing or runtime validation was performed for synthesis.

### Primary (HIGH confidence for documented facts; integration remains MEDIUM/LOW)

- Local [PROJECT.md](../PROJECT.md), [codebase architecture](../codebase/ARCHITECTURE.md), [concerns](../codebase/CONCERNS.md), package-lock.json, AGENTS.md and tools/README.md: selected scope, locked baseline and brownfield boundaries.
- [Node release status](https://nodejs.org/en/about/previous-releases), [ARM64 release directory](https://nodejs.org/download/release/latest-v24.x/), official registry metadata for [Colyseus core](https://registry.npmjs.org/@colyseus%2Fcore), [SDK](https://registry.npmjs.org/@colyseus%2Fsdk), [schema](https://registry.npmjs.org/@colyseus%2Fschema), [WS transport](https://registry.npmjs.org/@colyseus%2Fws-transport) and [Rapier](https://registry.npmjs.org/@dimforge%2Frapier3d-compat): researched release/engine/peer metadata, not combined-stack proof.
- Colyseus [rooms](https://docs.colyseus.io/room), [fixed-step inputs](https://docs.colyseus.io/netcode/server-input), [prediction](https://docs.colyseus.io/netcode/client-prediction), [recipes](https://docs.colyseus.io/netcode/recipes), [lag compensation](https://docs.colyseus.io/netcode/lag-compensation), [load tests](https://docs.colyseus.io/tools/loadtest): lifecycle/netcode primitives and their limitations.
- Rapier [determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), [character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/): collision/replay foundations and translation-only controller constraints.
- [Pi 5 specification](https://www.raspberrypi.com/products/raspberry-pi-5/), [cooling guidance](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-003608-WP-2-Cooling%20a%20Raspberry%20Pi%20device.pdf): hardware facts and sustained-load considerations, not slot benchmarks.
- [Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [SQLite WAL](https://sqlite.org/wal.html), [SQLite changes](https://sqlite.org/changes.html): worker/persistence caveats, single writer and patched-version requirement.
- [Three r160 loader](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/loaders/GLTFLoader.js), [resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [responsive rendering](https://threejs.org/manual/pages/responsive.html): version-specific loading, ownership and pixel budgets.
- [Blender LTS](https://www.blender.org/download/lts/), [4.5 command line](https://docs.blender.org/manual/en/4.5/advanced/command_line/index.html), [4.5 glTF export](https://docs.blender.org/manual/ja/4.5/addons/import_export/scene_gltf2.html), [licensing](https://www.blender.org/about/license/): offline tooling/export and artwork-license distinction; installed compatibility still needs validation.
- Official historical CoD guides for [S&D](https://www.callofduty.com/guides/blackops6/modes/call-of-duty-guides-black-ops-6-multiplayer-mode-guide-search-and-destroy), [Hardpoint](https://www.callofduty.com/guides/blackops6/modes/call-of-duty-guides-black-ops-6-multiplayer-mode-guide-hardpoint), [movement](https://www.callofduty.com/guides/blackops6/training/call-of-duty-guides-black-ops-6-multiplayer-training-movement), [loadouts](https://www.callofduty.com/guides/blackops6/pre-game/call-of-duty-guides-black-ops-6-multiplayer-pre-game-weapons-and-loadouts) and [CTF announcement](https://www.callofduty.com/es/blog/2021/06/Everything-You-Need-to-Know-About-Season-Four-Call-of-Duty-Black-Ops-Cold-War-and-Warzone-Arriving-June-17): reference mechanics, not current universal standards or adopted balance.
- Creator terms for [Quaternius human bases](https://quaternius.com/packs/universalbasecharacters.html), [MakeHuman exports](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html), [Kenney modules](https://kenney.nl/assets/modular-buildings), [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html): candidate assets and distinct source/redistribution constraints.

### Secondary (MEDIUM confidence for project adaptation)

- [Valve network overview](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking?language=uk) and [upstream compensation implementation](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/player_lagcompensation.cpp): established authority/history cross-check, not a mandate for engine constants or projectile policy.
- [Unity networked physics](https://docs-multiplayer.unity3d.com/netcode/1.8.1/advanced-topics/physics/): timeline cautions; adapting them to this shared WASM/browser architecture is an inference.
- [ioquake3 map-data terms](https://ioquake3.org/extras/patch-data/): evidence that open engine code does not establish permission for bundled map artwork.

### Tertiary (LOW confidence; needs validation)

- Proposed tick/snapshot presets, projectile-history catch-up/fairness, chosen assets' runtime suitability and specific device/Pi slot budgets are research hypotheses. No benchmark or complete qualified source-map candidate supports a production guarantee.

---
*Research completed: 2026-10-03*
*Ready for requirements and roadmap: yes; workflow preferences, detailed phase decisions and measured support profiles remain pending.*
