# Stack Research

**Project:** VibeOnDuty
**Domain:** Browser FPS; authoritative multiplayer on ARM64 Raspberry Pi; later movement, art, progression, and map authoring
**Researched:** 2026-10-03
**Confidence:** MEDIUM — official documentation and published metadata corroborate capabilities; integration and hardware capacity are unbenchmarked.

## Recommended Stack

Keep Three.js and Vite. Add a Node 24 server with Colyseus 0.18 over secure WebSockets,
a shared headless simulation, and Rapier WASM for collision queries. Use SQLite through
Node's built-in driver in a dedicated persistence worker when progression arrives.
This recommendation is a project-specific inference from the sources below, not a
claim that a library supplies finished FPS gameplay or guarantees 24-player hosting.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Three.js | Keep locked **0.160.1 / r160** initially | Browser rendering, characters, weapons, HUD previews | Existing working renderer/rig pipeline; multiplayer does not require a renderer rewrite. Reassess upgrades in the art/performance phase. [S1] |
| Vite | Keep locked **8.0.8** | Client development/build | Preserve prefix-aware static deployment; add a configurable public multiplayer endpoint. Existing tooling is sufficient. [S1] |
| Node.js | **24.21.0 LTS**, Linux ARM64 | Dedicated server, persistence worker, CI | Official ARM64 binary exists; Node 20 used by current CI is EOL and Colyseus 0.18 requires Node >=22. Pin one runtime across CI and server. [S2] |
| TypeScript | Existing **6.0.2** | New protocol, shared simulation, server | Add strict checking for new packages; preserve current browser JavaScript. Compile server with `tsc`; avoid making decorator support depend on Node's syntax stripping. [S1, S3] |
| `@colyseus/core` | **0.18.18** | Authoritative match rooms, lifecycle, inputs | Current 0.18 APIs include fixed-step simulation and rewind. Import the focused packages rather than automatically adopting every database/admin/Redis integration. [S3, S4] |
| `@colyseus/sdk` | **0.18.4** | Browser connection and prediction | Current browser SDK name; offers reconciliation and remote interpolation. Use this rather than examples importing the archived `colyseus.js` package. [S3, S5] |
| `@colyseus/schema` | **5.0.35** | Binary delta state and input schemas | Compatible with core's `^5.0.8` peer range; use schema builders to avoid introducing decorator tooling. [S3, S4] |
| `@colyseus/ws-transport` | **0.18.4** | WSS networking | Official default transport; simpler first deployment and broad device reach. Its reliable TCP behavior needs latency/loss testing. [S3, S6] |
| `@dimforge/rapier3d-compat` | **0.21.0**, identical client/server pin | Headless collision, capsule movement, scene queries | WASM avoids a separate native ARM physics build and provides ray/shape casts plus a kinematic controller. Game movement rules remain shared application code. [S3, S7] |

Version numbers above were checked against the local lockfile or official npm metadata
on this date; they are candidate pins, not a tested combined installation. Do not
combine 0.16/0.17 examples with 0.18 server APIs or schema-major versions. **MEDIUM.**

### Database and Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SQLite via `node:sqlite` | Node **24.21.0**; bundled SQLite **3.53.4** in tagged source | Accounts/guest identity, loadouts, XP, unlocks, match-result ledger | One-host persistence without an additional native npm module. Driver is **release candidate**, not stable; isolate it behind an adapter. [S8] |
| Raspberry Pi OS Lite | **64-bit Trixie** baseline; verify exact image | ARM64 host | Headless OS; verify actual hardware, storage and native dependencies before deployment. Pi 5 is offered with both 4 GB and 16 GB; user's hardware remains unconfirmed. [S9] |
| Caddy | **2.11.7**, ARM64 release | HTTPS/WSS reverse proxy | Official ARM64 assets and WebSocket proxy support; test connection lifetime and graceful restart. Keep public game URLs separate from static asset base paths. [S10] |
| systemd | OS-provided version, record in deployment manifest | Restart, logs, startup | Small operational footprint for one Pi; containers are optional rather than a multiplayer prerequisite. |
| Existing GitHub Pages | Current workflow | Static client/assets | Can continue serving browser builds; run the dedicated server elsewhere and configure its WSS address. Never publish server secrets via Vite variables. [S1] |

Database work belongs to the later identity/progression phase. The first multiplayer
slice needs stable match/session identifiers and trusted results, but can keep match
state in memory. Do not introduce Redis, PostgreSQL, or an account platform solely to
host one initial match. Infrastructure selection is a **MEDIUM-confidence inference**.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | **4.6.5** | Validate lobby settings, external map manifests, account/loadout requests | At untrusted boundaries. Avoid expensive generic validation inside every physics substep; validate and bound incoming commands before simulation. Compatible with core's `^4.1.12` optional peer. [S3] |
| `@gltf-transform/cli` | **4.5.1** | Inspect and optimize exported GLB/texture assets | Offline art/map pipeline; preserve the source and visually check skeleton/animation output after optimization. [S3, S11] |
| `meshoptimizer` | **1.3.0**, optional | Mesh compression decoder | Add only when compressed assets use it; r160 loader supports **EXT_meshopt_compression**, while newer tooling may emit **KHR_meshopt_compression**. Check the emitted extension before use. [S3, S12] |
| Three.js GLTFLoader/KTX2Loader | Same **r160** distribution | GLB loading and compressed textures | Register KTX2 support when adding Basis textures; serve decoder/WASM files under the existing asset prefix. Do not mix addon revisions. [S12] |
| Colyseus load-test tooling | Select matching **0.18** release during phase planning | Real protocol clients under load | Exercise input, shots, joins, reconnects and mode rules; connection-only load is inadequate. [S13] |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing Vitest **4.1.3** and Playwright **1.59.1** | Simulation/protocol and browser regression | Extend with two-browser authority/reconnect cases and shared input replay. Headless rendering does not establish phone FPS or visual quality. [S1] |
| Existing ESLint **10.2.0** and TypeScript | Code quality | Include new server/shared code; existing `checkJs:false` is not adequate validation of an authoritative simulation. [S1] |
| Node `perf_hooks`, process metrics, protocol counters | Server profiling | Record tick duration, event-loop delay, heap/RSS, bytes/player, bot/pathfinding time and reconciliation drift. [S2, S4] |
| Browser performance/GPU tools plus representative devices | Frame-budget profiling | Measure main-thread, GPU, animation, texture memory and asset load budgets separately from server ticks. |
| Blender **4.5.14 LTS** + embedded Python | Offline model/map automation | Conservative baseline for the existing retarget tool; **5.2.2 LTS** is also current, but validate the script/exporter before switching. No Blender MCP connection is assumed. [S14] |

## Multiplayer and Simulation Contract

Create `shared/`, `server/`, and client adapters before attempting to import gameplay
singletons into Node. Shared code contains input schemas, movement/weapon rules,
simulation state, map collision data, projectile stepping, and damage formulas.
Renderer, DOM, cameras, animation mixers, sounds and particles stay client-side. Bots
run on the server and issue the same bounded command shape as humans. **MEDIUM inference.**

Use Colyseus 0.18 `defineInput()` and `setFixedTimestep()`, then SDK `Predict` for
local prediction/reconciliation and remote interpolation. Use a single shared step
implementation and the advertised timestep. The older `setSimulationInterval()` is
now the variable-step `setTimestep()` alias; it is unsuitable as the prediction
contract. Start by evaluating **60 Hz simulation / 20 Hz snapshots**, then compare
30 Hz input with 60 Hz physics substeps. These are trial settings, not capacity claims.
[S4, S5]

Rapier's JS/WASM build documents cross-platform determinism with identical build,
initial values, insertion order and steps; arbitrary JavaScript math and different
collision worlds can still diverge. Keep prediction state explicit. Colyseus's
`predict.sim` recipe does **not** automatically restore engine-internal non-scalar
state, so begin with a kinematic controller and scalar position/velocity/posture;
test adoption/replay carefully before predicting a world of interacting rigid bodies.
[S7, S15]

Rapier's controller handles translations, slopes and stairs, not rotational movement.
It is a collision foundation, not finished omnimovement. Later prone/dive transitions
need explicit collider resizing/orientation and clearance checks. In the multiplayer
phase, implement the minimum shared collision needed to prevent invalid authoritative
movement; keep the full movement redesign later. [S7]

For bullets, advance server-owned ballistic records and query the **swept segment**
between positions. Do not instantiate a dynamic rigid body for every bullet by
default. Use simplified body/head hit volumes derived from authoritative posture;
server rendering or full animated skeletons are unnecessary. Penetration requires
game-owned surface IDs, entry/exit thickness, energy/damage loss, and bounded repeat
queries; Rapier provides queries rather than penetration balance. [S7, S15]

Colyseus provides bounded rewind history and projectile prediction recipes. Choose a
documented policy for projectile spawn time, historical target tests and maximum
compensation; blindly applying a hitscan rewind to an entire moving bullet lifetime
can produce unfair results. Predicted tracers/impact feedback may be immediate,
but damage, ammunition, kills and rewards commit only from server decisions. The
specific fairness policy requires phase research and latency playtests. [S15, S16]

Treat bots as participant slots, not network clients. Enforce a separate total-actor
cap of 8/12/16/24 in addition to Colyseus `maxClients`; replace a bot when a human
takes its seat. Budget pathfinding/decisions independently of movement updates and
bound projectile/entity counts. **MEDIUM inference from room limits and project scope.** [S4]

## Persistence Contract

Use one DB-owning worker with prepared statements, migrations, bounded queues, WAL,
transactions and retry-safe result IDs. Store server-generated XP/unlock awards;
never accept a client claim that it earned a weapon. Keep disk work out of the match
tick, and mark results durable only after commit. Guest recovery/login rules remain
open product decisions. This is a **MEDIUM-confidence design recommendation**. [S8, S17]

Node 24.21.0's tagged source bundles SQLite 3.53.4. Verify the **deployed binary**
with `SELECT sqlite_version()` rather than assuming the OS SQLite version applies.
SQLite's official WAL-reset correction is in 3.51.3+ and backports 3.44.6/3.50.7;
reject an unpatched embedded build. Use an online backup or coordinated checkpoint,
not a live copy of only the main database while WAL writes continue. [S8, S17]

## Blender, Art and Map Interchange

Keep editable `.blend` sources plus scripts and a provenance manifest. Run versioned
`bpy` scripts through `blender --background --factory-startup --python ...`; feed
validated structured parameters to tools. LLM assistance can draft scripts/layouts,
but executable changes and exported poses still require inspection. Choose any LLM
provider/backend during the editor phase; no SDK or MCP dependency is established
by this research. [S14]

Use **GLB/glTF 2.0 for visuals** and a **versioned JSON manifest for gameplay**:
collision proxies, material/penetration IDs, spawn sites, objectives, bounds and
navigation links. Blender custom properties can export through glTF `extras`, but
validate them into the runtime manifest. Neither GLB nor `.blend` by itself supplies
network-safe game rules. Maintain the existing tile serialization while adapting
current maps; new art maps can use the later manifest adapter. **MEDIUM inference.** [S12, S14]

For comic-book rendering, begin with painted textures, toon lighting and a scalable
outline option in Three.js. Expensive fullscreen/duplicate-geometry effects require
device profiling. Preserve root-motion stripping and one-skeleton rig consistency;
keep Blender node effects that GLB cannot reproduce as baked textures or explicit
runtime materials. [S1, S12, S18]

Blender's GPL governs the tool; it does not make created artwork GPL. Record asset
reuse/modification/redistribution terms separately from engine/editor source licenses.
Mixamo's FAQ permits royalty-free project use; that does **not** make its animations
open source or establish raw-asset redistribution rights. Audit each imported map,
rig, texture and motion pack before putting its editable source in the repo. [S19]

## Installation

Illustrative commands for the **future** root/client and `server` npm workspace;
create workspace manifests first. Nothing was installed during this research.

```bash
# Client/shared runtime
npm install --save-exact @colyseus/sdk@0.18.4 @colyseus/schema@5.0.35 @dimforge/rapier3d-compat@0.21.0

# Dedicated server workspace (Node 24.21.0)
npm install -w server --save-exact @colyseus/core@0.18.18 @colyseus/ws-transport@0.18.4 @colyseus/schema@5.0.35 @dimforge/rapier3d-compat@0.21.0 zod@4.6.5

# Later offline asset pipeline, when compressed content is introduced
npm install -D --save-exact @gltf-transform/cli@4.5.1
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Colyseus 0.18 WSS | Raw `ws` with a custom binary protocol | Only if profiling/requirements justify owning room lifecycle, matchmaking, input buffers, snapshots, prediction and recovery. [S20] |
| Colyseus WSS | Colyseus HTTP/3/WebTransport | Reconsider after real packet-loss tests show TCP stalls matter. MDN now reports Baseline March 2026, but the Colyseus implementation/unreliable features remain experimental; verify ARM backend and target browsers. [S6, S21] |
| Colyseus match rooms | Socket.IO | Useful for event-driven lobby/chat services; it provides message delivery mechanisms, while authoritative FPS simulation still needs application work. Default delivery is at-most-once; reconnection alone is not state recovery. [S22] |
| Shared TypeScript + Rapier WASM | Rust/native Rapier server | Consider after a measured CPU bottleneck outweighs separate build, cross-runtime protocol and shared-gameplay maintenance costs. |
| SQLite via `node:sqlite` worker | `better-sqlite3` **13.0.3** worker | Prefer if rejecting the built-in driver's release-candidate status; verify the exact ARM64/OS install. Upstream reported a Linux ARM64 GLIBC_2.38 requirement in 13.0.2; do not assume every prebuilt binary works on Bookworm. [S3, S23] |
| One-host SQLite | PostgreSQL | When accounts/results span several independent servers or concurrent-write requirements justify operating a database service; not required for 24 match participants. |
| Retain Three.js | Babylon.js/Godot engine migration | Evaluate only if later tooling or renderer requirements justify porting existing gameplay, assets and UI. Multiplayer is not evidence that a rewrite is needed. |
| Native service under systemd | Docker Compose | Use when repeatable host provisioning becomes valuable; pin ARM64 images and test storage/cooling/networking. It does not multiply single-match CPU capacity. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Client-owned positions/hits/unlocks as truth | Invalid movement, forged damage and rewards defeat the core requirement | Bounded inputs, authoritative simulation and committed results |
| Peer-to-peer host authority as the initial server model | Conflicts with dedicated server ownership and adds host lifecycle concerns | Dedicated Colyseus room |
| Unreliable schema fields on WebSocket | Colyseus warns these stop updating after initial state; WS lacks a real datagram channel | Reliable fields/messages until an explicitly tested datagram transport [S21] |
| Node 20 for new production server | EOL and below new server dependency engines | Pinned Node 24 LTS [S2, S3] |
| A second copy of movement/ballistics rules | Prediction continuously corrects when client/server diverge | Shared headless step and versioned content |
| A Blender or GPU process on the Pi match server | Asset generation/rendering is separate from authoritative simulation | Offline workstation authoring and lightweight collision data |

## Stack Patterns by Variant and Capacity Gates

**If hosting one LAN match:** one server process, WSS or an explicitly tested local
development WS path, memory match state, and no Redis. **If Internet hosting:** add
HTTPS/WSS, authentication/admission limits, domain/port reachability and measured
uplink; CGNAT/ISP constraints may require a relay/VPS endpoint. Hosting method is open.

| Target | Required Measurement Before Claiming Support |
|--------|---------------------------------------------|
| 8, then 12, then 16, then 24 total slots | Same collision-heavy map; movement, simultaneous automatic fire, grenades, objective logic and reconnect bursts; repeat at each size |
| Optional bot fill | Human-only, mixed and mostly-bot runs; measure AI/pathfinding CPU separately; bots still consume physics and snapshot/render budgets |
| Pi 5 4 GB vs unconfirmed 16 GB configuration | Record model/CPU, 64-bit OS, cooling, throttle state, storage and network; additional RAM is not evidence of higher single-match tick capacity |
| 60 FPS clients | Representative phones/iGPU/gaming PCs; frame distribution, GPU time, animation/mixer cost, decoder memory and network processing with all visible actors |

Suggested acceptance starting point: no sustained tick backlog; substantial CPU
headroom within the chosen 16.67/33.33 ms step; bounded queues/RSS; documented frame
time and latency distributions. Establish numeric p95/p99 limits during phase planning.
Report achievable profiles instead of guaranteeing 24 slots or universal 60 FPS.
Increase processes for separate matches only after one-room capacity is measured. [S9, S13]

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Core 0.18.18 | Node >=22; schema ^5.0.8; WS transport ^0.18.4 | Proposed pins satisfy declared ranges; clean install and integration test still required. [S3] |
| SDK 0.18.4 | Core 0.18.x | Upgrade server/client together; freeze protocol/content versions in the join handshake. [S3] |
| Rapier 0.21.0 | Same WASM build client/server | Await initialization; preserve timestep and creation order. [S7] |
| r160 GLTFLoader | EXT_meshopt_compression, KHR_texture_basisu | Do not assume new exporter extensions or material effects load in the older renderer. [S12] |
| Node 24.21.0 | SQLite 3.53.4 in tagged source | Driver is release candidate; verify actual deployment's embedded SQLite and backup/restore. [S8] |
| Blender 4.5.14 | Existing Python retarget/export scripts, pending validation | Do not claim script compatibility or visual correctness without regeneration and in-game review. [S14] |

## Sources

All retrieved 2026-10-03. **MEDIUM** is the confidence returned by the GSD
`classify-confidence --provider websearch --verified` seam. Research-plan requested
Context7 for library questions; no Context7 MCP/CLI was available, so official web
sources and published metadata were used and the five question digests were cached.
Recommendations are explicitly inferred; capacity and combined integration remain unverified.

- **S1:** Local `package-lock.json`, `.planning/codebase/STACK.md`, `AGENTS.md`, `src/scene.js`, `tools/README.md` — existing versions and constraints.
- **S2:** [Node release status](https://nodejs.org/en/about/previous-releases), [24.21.0 ARM64 download directory](https://nodejs.org/download/release/latest-v24.x/) — LTS/EOL and binaries.
- **S3:** Official npm registry package metadata: [core](https://registry.npmjs.org/@colyseus%2Fcore), [SDK](https://registry.npmjs.org/@colyseus%2Fsdk), [schema](https://registry.npmjs.org/@colyseus%2Fschema), [WS transport](https://registry.npmjs.org/@colyseus%2Fws-transport), [Rapier](https://registry.npmjs.org/@dimforge%2Frapier3d-compat), [Zod](https://registry.npmjs.org/zod), [glTF Transform](https://registry.npmjs.org/@gltf-transform%2Fcli), [meshoptimizer](https://registry.npmjs.org/meshoptimizer), [better-sqlite3](https://registry.npmjs.org/better-sqlite3) — exact published versions, dates, engines and peer ranges.
- **S4:** [Colyseus rooms](https://docs.colyseus.io/room), [server fixed-step input](https://docs.colyseus.io/netcode/server-input) — lifecycle, limits and timing APIs.
- **S5:** [Colyseus client prediction](https://docs.colyseus.io/netcode/client-prediction), [version migration](https://docs.colyseus.io/migrating) — prediction and 0.18 API changes.
- **S6:** [Colyseus default WS transport](https://docs.colyseus.io/server/transport/ws), [MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) — transport and buffering limits.
- **S7:** Rapier [determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), [controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/) — shared physics and limitations.
- **S8:** [Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [24.21.0 bundled SQLite header](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/sqlite/sqlite3.h) — release-candidate status, synchronous APIs, SQLite 3.53.4.
- **S9:** [Raspberry Pi 5 official specification](https://www.raspberrypi.com/products/raspberry-pi-5/) — RAM options, CPU, OS and active cooling.
- **S10:** [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [2.11.7 release](https://github.com/caddyserver/caddy/releases/tag/v2.11.7) — WSS proxy and ARM64 release assets.
- **S11:** [glTF Transform CLI](https://gltf-transform.dev/cli) — offline inspection/optimization and texture compression.
- **S12:** [Three r160 GLTFLoader source](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/loaders/GLTFLoader.js), [current loader reference](https://threejs.org/docs/pages/GLTFLoader.html) — version-specific extension/decoder support.
- **S13:** [Colyseus load testing](https://docs.colyseus.io/tools/loadtest) — load client tooling, not proof of game capacity.
- **S14:** [Blender LTS](https://www.blender.org/download/lts/), [4.5 release directory](https://download.blender.org/release/Blender4.5/), [command-line manual](https://docs.blender.org/manual/en/4.5/advanced/command_line/index.html), [4.5 glTF export manual](https://docs.blender.org/manual/sv/4.5/addons/import_export/scene_gltf2.html) — version and offline/export capabilities; English exporter page failed retrieval, indexed same-version Swedish page corroborated extras.
- **S15:** [Colyseus netcode recipes](https://docs.colyseus.io/netcode/recipes), [determinism contract](https://docs.colyseus.io/netcode/determinism) — swept projectiles and physics-adoption limitations.
- **S16:** [Colyseus lag compensation](https://docs.colyseus.io/netcode/lag-compensation) — bounded history and rendered-time rewind.
- **S17:** [SQLite WAL](https://sqlite.org/wal.html), [SQLite release history](https://sqlite.org/changes.html) — single writer, checkpointing and WAL-reset fix.
- **S18:** [Three MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html) — available toon material foundation.
- **S19:** [Blender licensing](https://www.blender.org/about/license/), [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) — tool/asset license distinction.
- **S20:** [ws official repository](https://github.com/websockets/ws) — raw transport alternative.
- **S21:** [Colyseus WebTransport](https://docs.colyseus.io/server/transport/webtransport), [MDN WebTransport](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API) — experimental library transport versus current browser baseline.
- **S22:** [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) — ordering and at-most-once default delivery.
- **S23:** [better-sqlite3 official project](https://github.com/WiseLibs/better-sqlite3), [ARM64/glibc report #1509](https://github.com/WiseLibs/better-sqlite3/issues/1509) — alternative driver and platform test requirement.

---
*Stack research for VibeOnDuty multiplayer-first milestone; 2026-10-03.*
