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

### Active

- [ ] Build netcode, multiplayer lobbies, and a dedicated server before the later movement and content overhaul.
- [ ] Make the server authoritative over match rules, player movement, firing, hit recognition, damage, kills, and score; research prediction, reconciliation, interpolation, and latency handling for responsive browser play.
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
- The current application is client-only. There is no implemented multiplayer transport, dedicated backend, account system, or persistent server-side progression.
- Runtime state is mostly mutable module singletons. Rendering/DOM initialization makes many gameplay modules unsuitable for direct headless-server imports.
- Existing maps use integer grids, heightmaps, and optional floors. Navigation and several cached arrays have first-map or first-floor assumptions that matter for future collision and map work.
- Current animation work already uses a shared target skeleton, offline Blender retargeting, and per-character mixers. A replacement should be evaluated against actual visual results and resource ownership rather than automatically discarding this work.
- Historical roadmap/documentation proposals are reference material, not accepted active requirements. Current user decisions govern this project.

### User-Selected Delivery Order

1. Multiplayer, netcode, server, and server hit recognition.
2. Omnimovement and reliable elevation/collision/camera behavior.
3. Human character models and animation overhaul.
4. Weapons, attachments, tuning, loadouts, progression, equipment, and score streaks.
5. The second editor and the new map-creation pipeline.
6. Maps produced or adapted through that pipeline, at the end of the content sequence.

Necessary foundations may be added inside earlier phases when they enable a playable multiplayer result; this does not move the full movement or map-editor overhaul ahead of multiplayer.

### Open Decisions for Research and Phase Discussion

- Exact server hardware model, operating system, storage, cooling, connectivity, and whether initial access is LAN, Internet, or both.
- Server tick/snapshot rates, transport, shared simulation boundaries, projectile lag handling, and measured player/bot budgets.
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
- **Scope order:** Multiplayer precedes the full movement, character, weapon, editor, and map overhauls.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser delivery with phones, integrated graphics, and gaming PCs | User wants cross-platform access and 60 FPS | Pending implementation and device measurements |
| Call of Duty-inspired omnimovement | User-selected combat and movement reference | Pending detailed movement definition |
| Borderlands-inspired comic-book art | User-selected look: drawings over humanlike 3D models | Pending visual prototype and Blender iterations |
| Dedicated server with server hit recognition | User wants multiplayer and server-owned combat outcomes | Pending network architecture research |
| Adjustable 8/12/16/24-slot matches and optional bots | User wants sizes suited to different maps | Pending server/bot capacity measurements |
| TDM, S&D, DM, CTF, and Hardpoint | Explicit multiplayer mode selection | Pending multiplayer implementation |
| Fast kills, health regen, ADS, headshots, recoil, bullet travel, and penetration | Explicit combat selection | Pending balancing and authoritative combat implementation |
| Progressive weapon/attachment availability | Explicit loadout/progression choice | Pending identity, persistence, and unlock design |
| Combined modular, extrusion, sculpting, and prompt-assisted editor | User wants a new flexible map workflow alongside the existing editor | Pending authoring format and tooling research |
| Multiplayer-first delivery order | Explicit user priority | Accepted scope order; phase breakdown pending |
| Armor plates deferred | User reserves them for future longer modes | Deferred |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition, move verified requirements to Validated, move invalidated requirements to Out of Scope with reasons, add newly discovered requirements to Active, log decisions, and update the product description when needed.

After each milestone, review every section, check the Core Value, reconsider deferred items, and update the current technical and player context.

---
*Last updated: 2026-10-03 after project-scope dialogue; workflow preferences, research, formal requirements, and roadmap are pending.*
