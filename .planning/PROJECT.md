# VibeOnDuty

## What This Is

VibeOnDuty is a browser FPS being developed into a cross-platform multiplayer game with Call of Duty-inspired omnimovement and fast combat. Its visual direction is comic-book rendering over believable human characters: illustrated textures, outlines, and stylized lighting inspired by Borderlands. It should run on phones, integrated-graphics PCs, and gaming PCs, with dedicated server hosting on Raspberry Pi hardware.

## Core Value

Players on different devices can join the same match and enjoy responsive, fair combat with consistent movement and server-validated hits.

## Requirements

### Validated

These capabilities are inferred from the existing implementation and the 2026-10-03 codebase map; they are not a fresh runtime or user-value verification.

- Existing browser game built with Three.js and Vite, using JavaScript ES modules.
- Existing local Incursion, Adaptive waves, Search & Destroy, Team Deathmatch, and Training Range modes with bots.
- Existing player movement, weapon combat, grenades, economy/shop, HUD, and live killer-camera feedback.
- Existing character rig loading, offline animation retargeting, runtime animation blending, and procedural asset fallbacks.
- Existing grid-based, multi-floor map editor with preview/playtest, local save slots, and URL sharing.
- Existing unit and browser regression suites and test-gated static deployment.

The following capabilities passed automated verification and human UAT on
2026-10-04, within the two-human Phase 1 keyboard/mouse M4 slice:

- ✓ NET-01: Two browser players complete dedicated-server TDM using current map and character assets — Phase 1.
- ✓ NET-03: The server validates movement intents and rejects invalid, stale, duplicated or impossible requests — Phase 1.
- ✓ NET-04: The server owns firing, projectile travel, hit recognition, damage, death and score — Phase 1.
- ✓ MODE-01: Shared team assignment, respawns, match results and automatic same-settings rematch — Phase 1.
- ✓ HOST-03: Console server startup with port, bind host, advertised address and self-signed testing TLS, plus documented help and errors — Phase 1.

### Active

- [ ] Extend the accepted dedicated-server slice with multiplayer lobbies and responsive netcode before the later movement and content overhaul.
- [ ] Add prediction, reconciliation, interpolation and bounded latency handling while preserving accepted server authority over match rules, movement and combat.
- [ ] Support adjustable 8-, 12-, 16-, and 24-player match capacities with maps appropriate to each size and an optional lobby setting to fill empty slots with bots.
- [ ] Provide multiplayer Team Deathmatch, Search & Destroy with bomb planting and no respawns during a round, free-for-all Deathmatch, Capture the Flag, and rotating King of the Hill/Hardpoint.
- [ ] Support Raspberry Pi server hosting, initially considering a Pi 5 with 4 GB RAM or a Raspberry Pi configuration with 16 GB RAM; establish measured capacity rather than assuming all configurations sustain 24 slots.
- [ ] After multiplayer, implement Call of Duty-inspired omnimovement; define its exact sprint, slide, dive, prone, and directional-transition behavior during movement-phase discussion.
- [ ] Repair elevation, jumping, body collision, and camera clearance so players cannot enter terrain, jump through it, or see through walls when pressed against them.
- [ ] Revamp character animation, potentially replacing the existing pipeline, and upgrade models to more believable human anatomy while retaining the comic-book art direction.
- [ ] Develop models, animation, materials, and environments iteratively using Blender automation and LLM-assisted creation, with repeated in-game visual review.
- [ ] Research reusable character rigs and motion assets and produce smooth transitions, consistent weapon grips, and movement-matched animation.
- [ ] Deliver fast kills, regenerating health, aiming down sights, headshots, recoil, bullet travel, and penetration through selected surfaces.
- [ ] Offer a small initial selection of weapons, including multiple rifles and SMGs, followed by progressive weapon and attachment unlocks.
- [ ] Add weapon tuning, attachments, scopes, selectable reticles, and red/green dot sights with meaningful gameplay tradeoffs.
- [ ] Build a loadout menu with a live 3D preview of the equipped gun, attachments, and other loadout elements.
- [ ] Add score streaks and more equipment; either repurpose drones into useful UAV-style reconnaissance or remove the ineffective existing implementation.
- [ ] Build a second map editor combining modular placement, drawing/extrusion, terrain sculpting, and prompt-assisted generation.
- [ ] Research professional map-creation workflows and reusable open-source maps with editable sources and explicit reuse terms; adapt suitable maps to the game's movement and modes.
- [ ] Produce at least two playable maps through the new workflow, with layouts and locations fitting their supported modes and capacities.
- [ ] Target 60 FPS browser play across phones, integrated-graphics PCs, and gaming PCs using scalable quality settings and representative device measurements.

### Out of Scope

- Armor plates in the initial combat scope: explicitly deferred by the user to future longer game modes.
- Implementing roadmap phases during project initialization: this workflow establishes the requirements and phase order first.

## Context

### Current Codebase

- Repository: `https://github.com/szefo94/VibeOnDuty.git`, local worktree `C:/Programowanie/VibeOnDuty`.
- Baseline code commit: `748d8199047ad3344e6356a82371757d90413145`; codebase map committed as `f600648`.
- Evidence-backed navigation: `AGENTS.md` and `.planning/codebase/{STACK,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,INTEGRATIONS,CONCERNS}.md`.
- Phase 1 adds a self-hosted Colyseus dedicated server and same-origin browser multiplayer entry, shared headless simulation, schema replication and authoritative M4 TDM. The acceptance slice admits two humans; it does not qualify 8/12/16/24-slot capacity. Accounts and persistent server-side progression remain unimplemented.
- Runtime state is mostly mutable module singletons. Rendering/DOM initialization makes many gameplay modules unsuitable for direct headless-server imports.
- Existing maps use integer grids, heightmaps, and optional floors. Navigation and several cached arrays have first-map or first-floor assumptions that matter for future collision and map work.
- Current animation work already uses a shared target skeleton, offline Blender retargeting, and per-character mixers. A replacement should be evaluated against actual visual results and resource ownership rather than automatically discarding this work.
- Historical roadmap/documentation proposals are reference material, not accepted active requirements. Current user decisions govern this project.

### Workflow Defaults

Project initialization uses reversible proposed defaults while no alternative preferences have been supplied: autonomous routine steps, fine-grained phases, independent work in parallel, tracked planning documents, research/plan checking/verification enabled, full instructions, and the current session model. These preferences can be revised with `$gsd-settings`. The 12-phase roadmap is accepted; Phase1 is complete and the user's revised next step is Phase6 discussion. Automatic advancement is disabled.

### User-Selected Delivery Order

1. Completed two-client dedicated-server and authoritative TDM foundation (Phase1).
2. Human models and comic-book Blender iterations (Phase6).
3. Character/action animation and future movement-clip preparation (Phase7).
4. Omnimovement, elevation/body/camera collision and final animation integration (Phase5).
5. Remaining lobbies/netcode/device work, objective modes, bots and measured Pi hosting (Phases2–4).
6. Weapons, attachments, loadouts, progression, equipment and score streaks (Phases8–10).
7. The second editor followed by final sourced/original maps (Phases11–12).

This order was explicitly revised by the user on2026-10-04 to prioritize6 → 7 → 5. Phase numbers stay stable, and postponed work remains pending. Phase7 can accept animation for current gameplay and inspect future clips; Phase5 closes ANIM-01 against actual omnimovement. Minimum input/prediction foundations needed for Phase5 belong there, while broader Phase2 qualification remains pending.

### Open Decisions for Research and Phase Discussion

- Exact server hardware model, operating system, storage, cooling, connectivity, and whether initial access is LAN, Internet, or both.
- Phase 1 uses a 30 Hz server simulation, 20 Hz schema patches and same-origin WebSockets. Phase 2 must set prediction/interpolation and bounded projectile latency policies; measured player/bot budgets remain open.
- Representative phone and PC baselines and performance acceptance scenarios; 60 FPS is a target, not a verified universal guarantee.
- Exact omnimovement behavior and input mappings across mouse/keyboard, touch, and gamepad.
- Player identity and progression persistence: login method, guest support, recovery, unlock rules, and save lifetime.
- Initial weapon roster, damage/regen/recoil values, material penetration rules, equipment, and streak catalog.
- Blender automation mechanism available in this environment, asset provenance, compatible rigs, and animation licensing.
- New editor architecture, prompt-assistance backend, map import formats, and the two initial map settings/mode assignments.

## Constraints

- **Platform:** Remain browser-delivered and cross-platform, including phones and integrated graphics PCs.
- **Performance:** Target 60 FPS with scalable client quality and measured budgets for rendering, animation, map complexity, and networking.
- **Server:** Support ARM64 Raspberry Pi deployment; benchmark CPU, memory, network, and bot costs before claiming match capacity.
- **Gameplay:** Call of Duty-inspired omnimovement, fast kills, regenerating health, and server hit validation define the gameplay direction.
- **Art:** Comic-book/cel-shaded rendering with humanlike proportions; visual iterations must be assessed in the running game.
- **Creation:** Use Blender and LLM-assisted workflows iteratively for art and environment work; confirm tooling rather than assuming a Blender MCP connection exists.
- **Content:** Imported maps, models, animations, and textures need clear reuse/modification terms and recorded provenance.
- **Compatibility:** Preserve prefix-aware asset URLs, safe shared resource ownership, and tile serialization when existing systems are used during migration.
- **Scope order:** After completed Phase1, follow6 → 7 → 5 → 2 → 3 → 4 → 8 → 9 → 10 → 11 → 12. Keep all postponed requirements and revalidate animation when omnimovement is integrated.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser delivery with phones, integrated graphics, and gaming PCs | User wants cross-platform access and 60 FPS | Pending implementation and device measurements |
| Call of Duty-inspired omnimovement | User-selected combat and movement reference | Pending detailed movement definition |
| Borderlands-inspired comic-book art | User-selected look: drawings over humanlike 3D models | Pending visual prototype and Blender iterations |
| Dedicated server with server hit recognition | User wants multiplayer and server-owned combat outcomes | Validated for two-human M4 TDM in Phase 1; later responsiveness/capacity work remains |
| Same-origin operator game link with CLI-configured testing TLS | One deployed server is the selected entry point; bind and advertised addresses have separate purposes | Phase 1 automated and human acceptance passed; self-signed trust remains a testing exception |
| Server-owned simulation and recipient-private hit feedback | Client intents must not award trusted outcomes; only the shooter receives detailed confirmation | Validated in Phase 1; 30 Hz simulation and 20 Hz patches are slice defaults |
| Fresh-membership Retry | Retiring session-owned inputs, rigs and effects prevents stale lifecycle state | Validated in Phase 1; reconnect continuity and prediction remain Phase 2 |
| Adjustable 8/12/16/24-slot matches and optional bots | User wants sizes suited to different maps | Pending server/bot capacity measurements |
| TDM, S&D, DM, CTF, and Hardpoint | Explicit multiplayer mode selection | TDM slice validated in Phase 1; other multiplayer modes remain assigned to Phases 2–3 |
| Fast kills, health regen, ADS, headshots, recoil, bullet travel, and penetration | Explicit combat selection | Pending balancing and authoritative combat implementation |
| Progressive weapon/attachment availability | Explicit loadout/progression choice | Pending identity, persistence, and unlock design |
| Combined modular, extrusion, sculpting, and prompt-assisted editor | User wants a new flexible map workflow alongside the existing editor | Pending authoring format and tooling research |
| Models → animation → omnimovement after the multiplayer foundation | User explicitly changed the next priorities on2026-10-04 | Phase6 → Phase7 → Phase5 next; Phases2–4 remain pending afterward; final ANIM-01 acceptance is in Phase5 |
| Armor plates deferred | User reserves them for future longer modes | Deferred |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition, move verified requirements to Validated, move invalidated requirements to Out of Scope with reasons, add newly discovered requirements to Active, log decisions, and update the product description when needed.

After each milestone, review every section, check the Core Value, reconsider deferred items, and update the current technical and player context.

---
*Last updated: 2026-10-04 after the user prioritized Phase6, then7, then5 following accepted Phase1.*
