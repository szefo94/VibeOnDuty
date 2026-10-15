# Pitfalls Research

**Domain:** Browser multiplayer FPS; authoritative ARM64 server; assisted humanoid and map production
**Researched:** 2026-10-03
**Confidence:** MEDIUM — primary documentation checked; gameplay, hardware and device capacity not benchmarked

## Evidence and Scope

Repository findings below come from `AGENTS.md`, `.planning/PROJECT.md` and the source-backed `.planning/codebase/CONCERNS.md`; they are static findings, not newly reproduced bugs. There is currently no implemented authoritative backend or progression service. Recommendations are proposed safeguards for the accepted scope, not implemented capabilities.

The GSD research-plan seam selected `websearch`; `classify-confidence --provider websearch --verified` returned MEDIUM. Official documentation and upstream implementation are linked below; MEDIUM applies to the documented patterns and proposed adaptations. Exact 24-slot capacity, universal 60 FPS, asset suitability and unspecified hardware remain unverified. Named stages preserve the user's multiplayer-first sequence; they are not assigned roadmap numbers.

## Critical Pitfalls

### Pitfall 1: Replication mistaken for server authority

**What goes wrong:** Clients report positions, hit victims, damage, score, purchases or unlocks and the server merely forwards them. A modified browser can then determine combat outcomes.
**Why it happens:** Reusing today's client-only gameplay appears faster than extracting rules from modules that initialize DOM and rendering.
**How to avoid:** Send bounded input/fire intentions with sequence numbers. Server owns movement, legal action transitions, ammo, fire cadence, damage, teams and match results. Validate finite numbers, payload sizes, input rates and legal enum values; use authenticated identity and room membership. Never accept a client-supplied hit as proof. Derive shot origins and weapon properties from accepted state. Treat prediction as provisional feedback. [Valve authority and prediction overview](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking?language=uk).
**Warning signs:** Protocol messages contain authoritative `damage`, `xp`, arbitrary teleport coordinates or requested victims; server tests require `document` or WebGL mocks.
**Phase to address:** Multiplayer foundation, before the first public lobby.
**Confidence:** MEDIUM; extraction boundary is a repository-specific recommendation.

### Pitfall 2: Applying one-time hitscan rewind to traveling bullets

**What goes wrong:** A tracer implies real travel while damage occurs instantly, or a projectile is advanced through old geometry but checked against current targets. Fast kills, headshots and wall penetration expose inconsistent results.
**Why it happens:** Established raycast-rewind examples are copied without accounting for a projectile's lifetime and several collision times.
**How to avoid:** Specify projectile launch time, simulation time, target-history policy, allowed compensation interval and cover fairness before weapon expansion. Recommend authoritative swept projectile segments, predicted cosmetic launch, and a bounded catch-up experiment that checks historical target state at each catch-up step. Preserve head/body volumes and stance history. Include walls throughout the path and cap penetration count, distance and thickness; use server material metadata. Never teleport a delayed bullet forward without testing its skipped path. This is a proposed policy requiring a spike, not an established capability. [Unity networked physics](https://docs-multiplayer.unity3d.com/netcode/1.8.1/advanced-topics/physics/).
**Warning signs:** Hits depend on render FPS; fast bullets cross thin walls; shots after death receive duplicate damage; penetration uses visible material names as permission.
**Phase to address:** Initial server hit recognition; refine during weapons and penetration work.
**Confidence:** MEDIUM for timeline risk; LOW for the best catch-up settings until comparative tests.

### Pitfall 3: Unbounded rewind and untrusted client timestamps

**What goes wrong:** Forged or delayed commands inspect arbitrarily old targets; reconnects replay shots; compensation history crosses respawn or map boundaries.
**Why it happens:** Client clock values are treated as authoritative timestamps and latency averages substitute for a validation policy.
**How to avoid:** Map input sequences into server tick time; bound command age, clock offset, future allowance, replay count and interpolation allowance. Keep generation IDs for match, spawn and entity lifetimes. Record enough authoritative collision state to represent crouch/prone transitions. Reject history crossing teleports or lifetime boundaries. Valve's upstream code clamps compensation and checks requested command time against latency-derived time; its constants are examples, not VibeOnDuty defaults. [Valve lag-compensation implementation](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/player_lagcompensation.cpp).
**Warning signs:** Client can change timestamp and hit an older pose; late commands damage a respawned player; history grows for an entire match.
**Phase to address:** Multiplayer command protocol and hit-validation tests.
**Confidence:** MEDIUM.

### Pitfall 4: Advertising 24 slots from RAM size or a short localhost demo

**What goes wrong:** Server ticks miss deadlines under shooting, bot replanning, serialization or heat. More RAM does not automatically increase simulation throughput; a 60 FPS browser proves no server tick capacity.
**Why it happens:** Slot count is a configuration field while true capacity depends on CPU, cooling, network, map complexity and workload.
**How to avoid:** Confirm exact Pi model, ARM64 OS, runtime, power, cooling and storage. Measure warmed-up runs at 8/12/16/24 occupied slots with human-only and mixed/all-bot loads, representative maps, simultaneous fire and reconnect bursts. Track p95/p99 tick duration, event-loop delay, catch-up debt, bytes/client, memory and thermal throttling. At 60 Hz a tick has 16.67 ms; at 30 Hz it has 33.33 ms, with headroom still needed. These are arithmetic budgets, not recommended final rates. Limit bot replanning/LOS work and schedule it across ticks; record CPU cost separately from slot count. [Pi cooling guidance](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-003608-WP-2-Cooling%20a%20Raspberry%20Pi%20device.pdf).
**Warning signs:** Increasing bot count causes hitching while memory remains low; performance deteriorates after warm-up; queued snapshots age continually.
**Phase to address:** Multiplayer capacity and deployment gate; repeat after movement/combat/map changes.
**Confidence:** MEDIUM for risks; LOW for any particular slot/tick capacity before measurement.

### Pitfall 5: Separate browser and server movement, collision and camera truths

**What goes wrong:** Prediction repeatedly snaps on ramps; diving enters walls; camera lean sees through cover; animated head positions disagree with authoritative hits.
**Why it happens:** Eye/camera transforms double as simulation state, frame delta drives rules, and map rendering, navigation and collision each decode geometry differently.
**How to avoid:** Extract a DOM-free fixed-step movement kernel and canonical collision/map data during multiplayer. Keep simulation body and aim origin independent of render bob, recoil, lean and third-person camera offsets. Share integration order, units, slope/step settings and stance-clearance rules. Replay acknowledged inputs for reconciliation; smooth render corrections without moving the authoritative collider. Sweep body movement, test overhead clearance before standing, and constrain camera displacement against geometry. Full omnimovement remains the next major stage; shared collision foundations are necessary inside multiplayer. [Unity prediction/timeline guidance](https://docs-multiplayer.unity3d.com/netcode/1.11.0/learn/dealing-with-latency/).
**Warning signs:** Server and client have separately maintained movement constants; camera placement changes bullet origins; lower floors use highest-surface hit heights.
**Phase to address:** Multiplayer foundations, then omnimovement and collision overhaul.
**Confidence:** MEDIUM; current camera/floor risks are source-inspected concerns.

### Pitfall 6: Session and timer state surviving death, mode change or reconnect

**What goes wrong:** A projectile freezes when its owner dies; a delayed melee callback hits in a new match; the previous mode continues ticking; reconnect creates duplicate players or objective owners.
**Why it happens:** Current world updates live partly inside living-player updates; menu/mode setup uses mutable singletons and some actions use uncancelled wall-clock callbacks.
**How to avoid:** Put world/projectile/objective simulation under an explicit match lifecycle independent of living clients. Use simulation-time actions and entity/match generations. Define enter/exit, death, respawn, disconnect and reconnect transitions with one cleanup contract. Online pause releases input and shows a menu while the server match continues; local pause has separate semantics. Objective interactions, round timers and victory are server-owned across all five modes.
**Warning signs:** S&D spectators stop grenade updates; menu return leaves active mode state; repeated joins attach additional listeners or retain fire input.
**Phase to address:** Multiplayer rules and lifecycle before expanding modes.
**Confidence:** MEDIUM; existing risks are recorded in [CONCERNS.md](../codebase/CONCERNS.md), not browser-reproduced here.

### Pitfall 7: Treating map imports and generated output as trusted runtime code

**What goes wrong:** Shared-map metadata injects HTML; malformed dimensions exhaust resources; imported maps disagree across client/server; prompts or external assets trigger script execution.
**Why it happens:** Base64 is mistaken for validation and a visually valid Blender/editor result is treated as a complete playable map.
**How to avoid:** Create one bounded versioned decoder for editor, URL and server inputs. Validate bytes, dimensions, floor counts, array lengths, finite heights, tile/shape IDs, strings, markers and thumbnail types before allocation. Use `textContent` for metadata. Map/prompt output must be declarative data with approved operations, not executable JavaScript/Python. Keep authoring data and baked collision/nav/occlusion artifacts linked by a content hash/version; server approves the match map. Validate spawn/objective reachability and floor transitions before publication.
**Warning signs:** URL and editor loaders accept different versions; collision is recreated manually after sculpting; clients choose arbitrary maps after joining; thumbnails allow unrestricted schemes.
**Phase to address:** Minimal shared map boundary in multiplayer; expanded artifact pipeline in editor and maps stages.
**Confidence:** MEDIUM; import injection and missing limits are static repository findings.

## Moderate Pitfalls

### Animation looks correct in Blender but violates gameplay or resource ownership

**What goes wrong:** Root motion fights predicted movement; incompatible rigs twist grips; disposing a character destroys shared geometry; repeated respawns leak textures or skeleton resources.
**Prevention:** Retain the shared target skeleton and established retarget pipeline until a replacement visibly outperforms them. Bake parent-first transforms, remove horizontal root motion, version hand mounts and action timing, clone mutable track buffers and preserve constant non-rest transforms. Define template versus instance ownership; dispose owned geometry/materials/skeleton resources and mixer bindings only. Validate real exported assets in first/third person and transitions, including prone/dive/headshot poses. [Three.js disposal guide](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).
**Warning signs:** A dying bot changes another bot's appearance; feet slide at known speed; memory climbs on each round; a metrics-only pose check passes despite bad grips.
**Phase to address / confidence:** Character overhaul; resource ownership first checked in multiplayer bot spawning. MEDIUM.

### Blender/LLM automation cannot reproduce accepted assets

**What goes wrong:** Scripts depend on selection, UI state, version-specific nodes or hidden inputs; a failed export silently leaves yesterday's GLB; comic materials render differently in game.
**Prevention:** Pin the actual installed Blender/exporter versions; check in scripts, input provenance, seeds, paths, settings and expected clip names. Run explicit background jobs with correct argument order, `--python-exit-code` and logged output; assert fresh artifact hashes and skeleton/animation/material budgets. Bake/export supported representations and implement the comic look in the runtime shader where needed. Generated changes remain reviewable proposals. Do not assume a Blender MCP integration exists. [Blender command-line arguments](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html), [glTF exporter](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html).
**Warning signs:** Builds work only with Blender already open; exported files omit clips; source files cannot reconstruct the released asset.
**Phase to address / confidence:** Character pipeline before scaling production; reuse during editor/map pipeline. MEDIUM; chosen automation mechanism unresolved.

### Unlocks, attachments and match rewards are browser-owned

**What goes wrong:** Editing local storage unlocks guns; reconnect applies XP twice; a forged attachment ID grants unsupported damage or fire rate.
**Prevention:** Decide identity/recovery before persistent unlocks. Server validates loadouts against owned content and a versioned attachment compatibility/stat schema. Commit rewards using stable match/event IDs and idempotent persistence; retain browser state only as a cache. Separate authoritative match completion from menu presentation. Define when live changes become effective and acknowledge them; keep preview rendering separate from gameplay equipment state. [PlayFab server-only data](https://learn.microsoft.com/en-us/gaming/playfab/player-progression/player-data/), [transactional statistics](https://developer.microsoft.com/en-us/games/articles/2025/03/new-playfab-statistics-general-availability/). These are design references, not a PlayFab adoption recommendation.
**Warning signs:** XP comes directly from a client message; server accepts any attachment; restart or duplicate completion changes rewards.
**Phase to address / confidence:** Weapons/loadouts/progression, with identity hooks reserved in multiplayer. MEDIUM.

### A popular or open-source game map is assumed reusable artwork

**What goes wrong:** An engine's code license is used as permission to redistribute maps, textures, models or trademarks; a converted binary has no editable source or provenance.
**Prevention:** Record separate licenses and attribution for map layout/source, textures, models, motion, sounds and tooling. Obtain explicit redistribution/modification terms before adaptation. Blender's own software license does not determine imported artwork rights. Do not select assets merely because download is free; an engine-source repository is insufficient evidence for data rights. [Blender licensing explanation](https://www.blender.org/about/license/), [ioquake3 patch-data terms](https://ioquake3.org/extras/patch-data/).
**Warning signs:** Only the engine LICENSE is recorded; original source/author is unknown; permission covers personal gameplay but not redistribution.
**Phase to address / confidence:** Asset selection in characters and editor/maps; exact catalog rights remain asset-specific. MEDIUM.

## Minor Pitfalls

### Touch controls fail when several actions overlap

**What goes wrong:** Moving, aiming, firing and sliding share one pointer; browser gestures cancel the action and held inputs remain stuck.
**Prevention:** Track pointer IDs per control, pointer capture and cancellation; set appropriate `touch-action` on gameplay controls, clear state on blur/visibility/lifecycle changes, and expose adjustable size/sensitivity. Test concurrent movement+aim+fire+stance on actual phones. [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
**Warning signs / phase / confidence:** Mobile smoke tests only tap menus; sticky firing after navigation. Multiplayer input foundation, then omnimovement. MEDIUM.

### Live camera feedback is presented as a recorded killcam

**What goes wrong:** Current killer-follow footage cannot explain the accepted shot and differs from the attacker's delayed/interpolated view.
**Prevention:** Label existing behavior as live spectator feedback. A future recorded killcam needs bounded historical state, event ordering and a declared reconstruction viewpoint; do not use it as independent hit proof. [Valve networking overview](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking?language=uk).
**Warning signs / phase / confidence:** Players dispute misses based on post-death live positions. Multiplayer death/spectator UX. MEDIUM.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Import complete browser gameplay into server with DOM mocks | Quick prototype | Server depends on rendering and lifecycle side effects | Throwaway spike only; extract pure rules for release |
| Duplicate client/server movement | Fast parallel implementation | Persistent reconciliation and geometry drift | Never for accepted shared gameplay |
| Keep grid collision temporarily | Reuse known maps | Limits sculpted surfaces and multi-floor navigation | Multiplayer vertical slice, with one canonical codec |
| Rebuild every bot path every tick | Easy behavior logic | CPU bursts scale with bots and map complexity | Debug experiment only; schedule bounded replanning |
| Client-only unlocks | Demonstrate menu flow | Tampering and migration debt | Explicit disposable prototype data only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Static Pages client + Pi server | Treat static deployment as backend hosting | Separate server service, secure endpoint, allowed origins, reconnect policy; confirm LAN/Internet access |
| WebSocket snapshots | Keep appending stale updates on slow clients | Monitor buffered bytes/age; coalesce unsent replaceable state; bound queues and disconnect persistently unhealthy peers |
| ARM64 deployment | Assume development binaries and storage behavior transfer | Verify runtime/native dependencies, service restart, atomic writes and backup/restore on target hardware |
| Blender export | Assume all shader nodes and procedural modifiers survive GLB | Inspect evaluated export, bake required representations, compare browser material and animation output |
| Map bake | Upgrade visual mesh without collision/nav version | Publish one manifest containing render, collision, nav and mode-marker artifact versions |

WebSocket queue/backpressure behavior is documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) and [bufferedAmount](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/bufferedAmount). Integration recommendations: MEDIUM; access topology remains unresolved.

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Uncapped phone device pixel ratio | GPU time spikes despite few entities | Cap render resolution/pixel budget; provide scalable outlines/shadows/effects | Device-specific; DPR 3 requires 9x pixels relative to DPR 1 |
| Full-resolution outlines plus many skinned players | GPU/animation costs increase with visible crowd | Profile passes separately; animation distance/update budgets, LOD, modest textures/material counts | Measure 8/12/16/24 visible actors; no known safe threshold |
| Every bullet tests every target and wall | Fire bursts stall server/client | Swept tests with spatial candidate filtering, projectile pooling and bounded lifetime | Depends on fire rate, projectiles and map complexity |
| Full-grid minimap redraw and per-bot path allocation | CPU stalls, garbage-collection spikes | Cache static radar layers; reuse workspaces and stagger navigation | Larger maps and bot-filled matches; currently unmeasured |
| Cold benchmark treated as sustained result | Frame/tick times worsen over minutes | Warm-up and thermal soak; report p95/p99 and reproducible scenario | Hardware-specific, particularly Pi and phones |

The pixel-ratio relationship comes from [Three.js responsive design](https://threejs.org/manual/pages/responsive.html); actor/projectile budgets are proposals requiring profiling. MEDIUM for mechanisms, LOW for capacity thresholds. Client 60 FPS means a 16.67 ms frame target and must be tested independently of server tick rate.

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Broadcasting hidden opponents to every player | Client modifications can expose hidden positions/UAV information | Define visibility and relevance policy; server owns streak duration, teams and recon disclosures |
| Accepting fire commands without cadence/ammo checks | Impossible DPS, forged reloads and ammo | Server weapon state machine and rate/burst limits |
| Unbounded map/projectile/input payloads | Memory and CPU denial of service | Validate before allocations; bound import, queue, geometry, command and projectile work |
| Running generated scripts during map import | Arbitrary operations in browser or authoring machine | Declarative generator output, approved operations and isolated reviewed build tooling |

Confidence: MEDIUM; these are design threat scenarios, not claims of demonstrated exploitation.

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Unconfirmed hits use final hit/death feedback | Apparent kills reverse after correction | Predict muzzle/recoil/tracer; distinguish confirmed damage and kills |
| Omnimovement combined with unrestricted camera bob | Mobile discomfort and unreadable aim | Tunable visual motion with stable aim/collision state |
| Every map supports every capacity/mode without review | Spawn traps, empty traversal and objective imbalance | Publish tested capacity/mode combinations and bot routes |
| Loadout preview spawns a second uncapped render loop | Menus overheat phones | Shared rendering budget and explicit preview teardown |

Confidence: MEDIUM recommendations; exact movement and presentation tuning need user/device trials.

## "Looks Done But Isn't" Checklist

- [ ] **Multiplayer:** Two localhost tabs are insufficient; test latency/jitter/disconnect, forged inputs and reconnect lifetimes.
- [ ] **Hit recognition:** Test crossing targets, historical stances, thin walls, lower floors, owner death and delayed projectiles.
- [ ] **Capacity:** Publish hardware, cooling, runtime, map, human/bot ratio and warmed-up p95/p99 tick/frame results.
- [ ] **Modes:** Exercise death, reconnect, tie/victory and round transitions for TDM/S&D/DM/CTF/Hardpoint.
- [ ] **Humanoids:** Review exported gameplay poses and repeated spawn/disposal; tests alone do not establish visual correctness.
- [ ] **Progression:** Repeat/replay reward completion and crash recovery; verify server rejects locked/incompatible loadouts.
- [ ] **Editor/maps:** Reject adversarial metadata and oversized imports; check collider/nav parity and two maps' capacity/mode fitness.
- [ ] **Mobile:** Perform simultaneous touch actions and sustained play on named baseline phones and integrated PCs.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Client-authoritative gameplay | HIGH | Extract shared rules, replace protocol with intents, invalidate untrusted persistent results |
| Divergent collision/map artifacts | HIGH | Freeze schema, rebuild canonical collider/nav data, invalidate caches and revalidate maps |
| Projectile timeline inconsistency | HIGH | Capture command/history traces, compare explicit compensation policies, migrate weapon semantics |
| Resource leaks or shared disposal | MEDIUM | Audit ownership, isolate templates, instrument repeated lifecycle transitions |
| Nonreproducible export | MEDIUM | Preserve last accepted sources, pin exporter and replace UI-dependent automation |
| Server exceeds measured capacity | MEDIUM | Apply validated capacity/tick presets, budget AI/projectiles, rebenchmark before raising limits |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Authority, timestamps and projectile timelines | Multiplayer foundation and hit recognition | Multi-client network tests, forged/replayed commands, shot-history traces |
| Pi tick/bot/transport budgets | Multiplayer deployment | Warmed-up 8/12/16/24 matrix with bot mixes and backpressure |
| Lifecycle and all five mode rules | Multiplayer modes | Full server transitions including disconnect and spectator periods |
| Collision prediction and camera clearance | Minimal shared simulation in multiplayer; full movement next | Replay parity, multi-floor sweeps, clearance/stance/camera tests |
| Retargeting/root motion/resources | Character pipeline | Real-rig browser review and repeated respawn ownership checks |
| Unlock/loadout/reward authority | Weapons and progression | Locked attachment rejection, idempotent rewards, recovery tests |
| Import/provenance/artifact consistency | Editor pipeline, then maps | Hostile imports, source manifests, render/collision/nav comparison |
| Mobile rendering/input budget | Every playable stage | Named-device sustained scenario; 60 FPS remains a target until measured |

## Sources and Remaining Research

Primary sources are linked beside the supported claims. Valve implementation is a cross-check, not a mandate to reuse its engine constants. Blender 4.0 CLI and 5.0 exporter references illustrate established capabilities; use the installed release's API when implementing. Some latest Blender pages could not be fetched, so no newest-version compatibility claim is made. Three.js current manuals describe general resource/performance principles; the repository's r160 integration still needs version-specific checks.

Unresolved phase research: exact Pi configuration and Internet exposure; transport/tick/snapshot rates; projectile catch-up versus defender fairness; shared collider implementation; baseline devices; authoritative progression identity; licensed asset/map catalog; installed Blender automation; prompt backend and map bake formats. No asset or hardware capacity is approved by this document.

---
*Pitfalls research for VibeOnDuty — 2026-10-03; MEDIUM evidence confidence, unmeasured capacities explicitly unresolved.*
