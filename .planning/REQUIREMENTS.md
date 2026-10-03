# Requirements: VibeOnDuty

**Defined:** 2026-10-03
**Core Value:** Players on different devices can join the same match and enjoy responsive, fair combat with consistent movement and server-validated hits.

## v1 Requirements

This is the selected overhaul scope, delivered incrementally in the user's order: multiplayer, movement, characters/animation, weapons/loadouts, editor, then maps. The first playable multiplayer slice is an early delivery inside this scope, not a replacement for the later commitments. All requirements are pending implementation and verification.

### Authoritative Multiplayer

- [ ] **NET-01**: Two browser clients can join the same dedicated-server match on an existing map, see each other, and complete a playable TDM session.
- [ ] **NET-02**: Players can create or join a lobby and select its game mode, supported map, and 8-, 12-, 16-, or 24-slot capacity within the server's qualified hosting profile.
- [ ] **NET-03**: The server derives player movement from validated input commands and rejects invalid, stale, duplicated, or impossible movement requests.
- [ ] **NET-04**: The server determines firing eligibility, projectile travel, hits, damage, deaths, and score; clients cannot award their own hits or kills.
- [ ] **NET-05**: Local movement remains responsive through prediction/reconciliation while remote players move smoothly through interpolation under the agreed network impairment profile.
- [ ] **NET-06**: Traveling projectiles use a documented bounded latency policy that produces consistent confirmed outcomes for moving targets, cover, death, and respawn without trusting arbitrary client timestamps.
- [ ] **NET-07**: Players can leave, reconnect under the chosen policy, finish, and restart a match without stale actors, projectiles, mode rules, or timers leaking into the next session.

### Multiplayer Modes and Bots

- [ ] **MODE-01**: Players can complete a server-scored Team Deathmatch with team assignment, respawns, and a consistent match winner.
- [ ] **MODE-02**: Players can complete server-scored free-for-all Deathmatch with individual respawns and a consistent winner.
- [ ] **MODE-03**: Players can complete Search & Destroy rounds with bomb planting/defusing, consistent round outcomes, and no respawn within a round.
- [ ] **MODE-04**: Players can pick up, carry, drop, return, and capture flags in an authoritative Capture the Flag match with consistent team score.
- [ ] **MODE-05**: Players can contest and control rotating Hardpoint locations, receiving authoritative team score according to the chosen occupancy rules.
- [ ] **BOT-01**: Lobby creators can enable or disable filling vacant player slots with server-controlled bots, with humans and bots together respecting the selected capacity.
- [ ] **BOT-02**: Bots obey the same movement, firing, team, life, and objective rules as human players in the supported modes.
- [ ] **BOT-03**: Human joins/leaves follow a defined bot replacement policy without exceeding capacity or corrupting teams, round state, or scores.

### Hosting, Cross-Platform Input, and Performance

- [ ] **HOST-01**: An operator can launch the dedicated server on the identified ARM64 Raspberry Pi configuration using documented setup, endpoint configuration, and startup/restart procedures.
- [ ] **HOST-02**: An operator can select a qualified capacity using published sustained 8/12/16/24-slot human/bot benchmark results that record tick time, memory, network load, and hardware conditions.
- [ ] **PLAT-01**: Players on keyboard/mouse PCs, touch phones, and supported gamepad configurations can join and complete the same multiplayer match using usable device-specific controls.
- [ ] **PERF-01**: Players can choose scalable visual settings, with a reproducible browser benchmark targeting sustained 60 FPS on agreed representative phone, integrated-graphics PC, and gaming-PC devices.
- [ ] **PERF-02**: Each major movement, character, weapon, and final-map delivery is checked against the established client/server performance scenarios, with measured limits and regressions recorded.

### Omnimovement and Collision

- [ ] **MOVE-01**: Players can sprint forward, backward, and sideways with consistent client prediction and server validation.
- [ ] **MOVE-02**: Players can transition into and out of directional slides under the agreed speed, stance, cancellation, and action rules.
- [ ] **MOVE-03**: Players can perform directional dives and transition to the agreed prone/supine movement and aiming states without disagreement between clients and server.
- [ ] **MOVE-04**: Players can jump, land, and traverse supported ramps, stairs, uneven terrain, and overlapping floors without entering terrain, falling through it, or snapping to an unrelated floor.
- [ ] **MOVE-05**: Player stance changes and movement respect walls, ceilings, and clearance constraints; the camera cannot expose the opposite side of a wall when the player presses against or leans near it.
- [ ] **MOVE-06**: Keyboard/mouse, touch, and gamepad players can perform the selected movement/action combinations through documented mappings and configurable controls.

### Human Models, Comic-Book Art, and Blender Workflow

- [ ] **ART-01**: Players see accepted humanlike character proportions, silhouettes, and weapon grips in the running game, with editable sources and asset-specific provenance retained.
- [ ] **ART-02**: Players see the chosen comic-book look through illustrated textures, stylized lighting, and scalable outlines on a representative character/weapon/environment slice.
- [ ] **ART-03**: A creator can iterate a model/material through the verified Blender automation workflow, export it reproducibly, and review the result in-game before accepting it.
- [ ] **ART-04**: A creator can use LLM-assisted Blender operations through a documented available integration or script workflow, with inspectable changes and a recoverable prior source version.

### Animation

- [ ] **ANIM-01**: Characters transition smoothly among idle, directional locomotion, sprint, slide, dive, prone, jump, and landing states while following actual simulated movement.
- [ ] **ANIM-02**: Weapon/action animation supports ADS, firing, reload, melee, equipment use, damage, and death without broken grips, visible snapping, or unintended action overlap in first- and third-person views.
- [ ] **ANIM-03**: Animation stays consistent with authoritative posture and aim while visual blending/root motion does not move gameplay bodies independently of simulation.
- [ ] **ANIM-04**: A creator can import or retarget approved reusable motion onto the selected rig, regenerate runtime clips, and inspect transitions through the Blender-to-game review workflow.
- [ ] **ANIM-05**: Repeated character spawn, replacement, and disposal retain shared templates and release instance-owned resources within the measured browser budget.

### Weapons and Combat Tuning

- [ ] **GUN-01**: Players experience the selected fast-kill combat and health regeneration under documented, server-owned damage and regeneration rules.
- [ ] **GUN-02**: Players can choose from an initial roster including multiple distinct rifles and multiple distinct SMGs, with agreed supporting weapon categories.
- [ ] **GUN-03**: Players can aim down sights using the equipped weapon/optic, with consistent aim, accuracy, and permitted action states.
- [ ] **GUN-04**: Headshots use authoritative head/body hit regions with documented damage differences that remain correct across movement postures.
- [ ] **GUN-05**: Recoil and weapon handling follow reproducible server-compatible rules with visible differences between the selected weapons.
- [ ] **GUN-06**: Shots have the agreed bullet travel behavior and consistent swept collision against moving players and map geometry.
- [ ] **GUN-07**: Shots penetrate explicitly supported materials using bounded, server-owned rules for thickness, energy/damage loss, and subsequent hits.
- [ ] **GUN-08**: Players can equip legal attachments and tuning choices that produce documented weapon-stat/handling tradeoffs validated by the server.
- [ ] **GUN-09**: Players can select supported scopes, reticles, and red/green dot sights whose aiming presentation matches the equipped loadout.

### Loadouts and Progression

- [ ] **LOAD-01**: Players can assemble and save a legal loadout containing their selected weapon, attachments, optic, and supported equipment.
- [ ] **LOAD-02**: Players can inspect a live 3D preview of the assembled gun and supported loadout elements while changing selections.
- [ ] **LOAD-03**: The preview, saved loadout, and spawned equipment agree on parts and effective stats; the server rejects locked or incompatible selections.
- [ ] **PROG-01**: Players begin with a small usable weapon selection and earn additional weapon and attachment unlocks according to documented progression rules.
- [ ] **PROG-02**: Earned progression and saved loadouts survive reconnects and server restarts under the selected identity and persistence policy.
- [ ] **PROG-03**: Match result awards are server-owned and applied once, including retry/restart scenarios; browser-modified saves cannot grant unlocks.

### Equipment, Score Streaks, and Drones

- [ ] **EQP-01**: Players can select and use an agreed expanded equipment set with authoritative inventory, effects, and action timing.
- [ ] **STREAK-01**: Players earn and activate the agreed score streaks through server-owned scoring, eligibility, and lifecycle rules.
- [ ] **UAV-01**: Players receive useful, bounded UAV-style reconnaissance with agreed team visibility and counterplay, or the existing ineffective drone system is removed following an explicit gameplay review.

### Second Map Editor

- [ ] **EDIT-01**: Creators can open a second editor and place, transform, duplicate, and group modular environment pieces in a 3D scene.
- [ ] **EDIT-02**: Creators can draw footprints and extrude editable rooms, walls, or structures with consistent scale and gameplay collision.
- [ ] **EDIT-03**: Creators can sculpt terrain and traverse the compiled surfaces using the actual game movement and collision rules.
- [ ] **EDIT-04**: Creators can undo/redo edits, save/reopen editable sources, and playtest the compiled map without losing authoring state.
- [ ] **EDIT-05**: Creators can author spawns, teams, objectives, and declared mode/capacity support using a versioned format that compiles matching visuals, collision, materials, and navigation data.
- [ ] **EDIT-06**: Existing editor maps have a documented coexistence/import path while the second editor is introduced, preserving supported existing serialization.
- [ ] **AIEDIT-01**: Creators can request map changes in natural language and inspect an editable proposal before applying it through the editor's ordinary undoable commands.
- [ ] **AIEDIT-02**: Generated/imported content is bounded and validated before compilation; malicious metadata or prompt output cannot execute arbitrary code or bypass authoritative map validation.

### Imported Sources and Final Maps

- [ ] **IMPORT-01**: Creators have a researched shortlist of popular reusable FPS map sources, recording editable files, provenance, modification/redistribution terms, and suitability for this game's modes.
- [ ] **IMPORT-02**: A qualified source map can be imported/adapted through the new workflow with preserved attribution and editable output; unavailable or unsuitable candidates and any required original-map fallback are documented for review.
- [ ] **MAP-01**: Players can play at least two maps produced or adapted through the new editor/Blender workflow, with coherent locations and layouts for their advertised modes.
- [ ] **MAP-02**: The delivered map set provides declared, tested layouts/variants appropriate to 8-, 12-, 16-, and 24-slot play without assuming every map fits every size or mode.
- [ ] **MAP-03**: Each advertised map/mode/capacity combination passes multiplayer/bot objective, spawn safety, movement/camera/collision, and client/server performance checks, with editable source and provenance delivered.

## v2 Requirements

### Longer Modes

- **ARMOR-01**: Players can use armor plates in future longer game modes once their rules and scope are selected.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Armor plates in this release | User explicitly deferred them to future longer game modes. |
| Monetization, battle passes, or a social platform | Not requested; progression needs only the identity/persistence policy selected for unlocks. |
| Replacing browser delivery with a required native client | Browser delivery across the three selected device classes is a constraint. |
| Wholesale reproduction of another game's proprietary content | References guide gameplay/art; imported content requires its own clear reuse terms. |

## Acceptance Criteria

- Each requirement is verified in its assigned phase through meaningful simulation/network/browser checks, in-game visual review, device measurements, or source/export inspection as appropriate.
- Multiplayer verification uses multiple clients and impaired-network scenarios; a single local smoke test does not establish fairness, latency quality, or capacity.
- Device, network, bot mix, map complexity, and Pi conditions are named before performance acceptance; settings and measured limits accompany each supported profile.
- Visual and animation changes require in-game review. Numerical pose checks alone do not establish the accepted visual target.
- Unmeasured targets or unresolved identity/input/content choices remain explicit phase-discussion items, not fabricated completed evidence.

## Definition of Done

- All v1 requirements map to exactly one roadmap phase and have recorded verification evidence before being marked complete.
- Relevant lint/type/unit/browser checks pass for the changed systems; authoritative rules and cross-session behavior have targeted regression coverage.
- Editable art/map sources, provenance, reproducible exports, deployment guidance, and measured performance profiles are delivered alongside runtime assets.
- The accepted delivery sequence is maintained, with maps last and only necessary shared simulation/collision foundations inside early multiplayer phases.

## Traceability

The roadmapper will assign every v1 requirement to exactly one phase and populate coverage totals here. No implementation requirement is complete yet.

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements defined: 2026-10-03 from the user's project dialogue and source-backed enabling dependencies.*
*Last updated: 2026-10-03 before roadmap traceability assignment.*
