# Feature Research

**Project:** VibeOnDuty
**Domain:** Cross-platform browser multiplayer FPS with omnimovement and illustrated human characters
**Researched:** 2026-10-03
**Confidence:** MEDIUM for external ecosystem findings; product scope comes directly from PROJECT.md

## Scope and Evidence Boundary

This research preserves the user's order: multiplayer → movement → characters → weapons → second editor → maps. Necessary simulation, collision, and input foundations belong inside multiplayer; the complete movement or editor overhaul does not move ahead of it.

Scope markers: **S** = user-selected requirement; **P** = enabling prerequisite inferred from that requirement; **O** = optional research suggestion requiring later selection. Complexity describes implementation from this repository's local-game baseline, not uncertainty about whether the feature was requested. Priority expresses sequence/gates, not permission to discard selected features.

The Call of Duty sources document reference mechanics, principally Black Ops 6 guides from 2024. They are not evidence for a universal FPS standard or the latest 2026 franchise balance. Exact movement controls, numerical tuning, progression rules, and catalog selections remain phase decisions. External findings use the runtime confidence seam: `classify-confidence --provider websearch --verified` returned **MEDIUM**. Implementation recommendations are explicitly inferences to validate in this project.

### Existing Features to Extend

Current source evidence, reviewed on 2026-10-03:

- `src/entities/player.js` already regenerates health after 3 seconds without damage at 8 HP/second and blends ADS. These local values are a baseline, not approved multiplayer balance.
- `src/combat/shoot.js` already implements traveling bullets, weapon recoil/pose feedback, and swept enemy-hit tests. Enemy damage currently uses one target sphere; the training-range headshot branch does not establish body/head damage zones for players or bots. First wall intersection removes the bullet.
- `src/config.js` defines `m4`, `p90`, `awp`, and `pistol`. Multiple rifles and multiple SMGs still require additional distinct entries/content.
- `src/modes/tdm.js` and `src/modes/snd.js` are local/bot rules to migrate, not functioning networked modes. The source and PROJECT.md establish a client-only baseline.
- `src/entities/drone.js` has hostile-drone behavior and local S&D reconnaissance scans. The task is to make reconnaissance useful and authoritative or remove it.
- `tools/README.md` describes reproducible offline retargeting onto one skeleton; the existing pipeline deserves comparison against replacements. Existing map editing remains the compatibility baseline.

## Feature Landscape

### Table Stakes for This Selected Product

These are expected for VibeOnDuty's intended experience. Later content requirements need not block the first multiplayer experiment.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| S: Join/create lobbies and choose mode/map/capacity | People need to enter the same playable match | HIGH | M1. Show occupied versus total slots; access topology remains undecided. No account requirement follows automatically. |
| S/P: Server-owned movement, firing, damage, kills, score | Fair outcomes must agree between devices | HIGH | M1. Client submits intent; validate fire cadence/ammo, life state, movement limits, and outcomes. |
| P: Responsive local control and smooth remote actors | Latency must not make ordinary movement unusable | HIGH | M1. Prediction/reconciliation/interpolation are implementation candidates; test impaired networks and projectile handling. |
| S: 8/12/16/24 total match slots | Match size should fit layout and hardware | MEDIUM/HIGH | M1. Humans plus bots share the configured capacity. Do not promise 24 on Pi before benchmarks. |
| S/P: Optional bot fill with correct teams and objectives | Small lobbies should remain playable | HIGH | M1. Bots use authoritative rules, respect S&D death, and pursue CTF/Hardpoint objectives. Define replacement timing. |
| S: TDM and free-for-all Deathmatch | Immediate multiplayer combat validation | MEDIUM | M1. Separate team versus individual scores, safe respawns, score/time limits, and match completion. |
| S: S&D bomb rounds without in-round respawns | The selected mode depends on meaningful single lives | HIGH | M1. Authoritative plant/defuse/elimination/timeout resolution; dead-player view must respect team information. [S2] |
| S: CTF | Carrying and defending objectives creates a different team task | HIGH | M1. Track flag home/carried/dropped/returned states and captures. Own-flag-home rule is a reference candidate. [S4] |
| S: Rotating Hardpoint | Requires moving control rather than static camping | HIGH | M1. Ordered zones, occupancy, contesting, scoring, and rotation timer; map supplies objective metadata. [S3] |
| P: Match lifecycle and understandable HUD | Players need score, time, objectives, death and restart feedback | HIGH | M1. Handle leave/disconnect/full room and transitions without stale actors, timers, or objectives. |
| S/P: Phone, integrated-GPU and gaming-PC play | Cross-device access is core value | HIGH | Begin M1, gate every stage. Input/quality settings and measured 60 FPS target; select actual representative devices. |
| S: Reliable elevation/body collision/camera clearance | Players must not enter terrain or see through walls | HIGH | Minimal correctness M1; complete repair M2. Test ceilings, ramps, multi-floor spaces and wall contact. |
| S: Omnimovement | User-selected gameplay direction | HIGH | M2. Exact sprint/slide/dive/prone behavior is unresolved; synchronize movement state and collision dimensions. [S5] |
| P: Usable keyboard, gamepad and touch mappings | The same moves must remain accessible across devices | MEDIUM/HIGH | M2. Hold/toggle and sensitivity candidates need discussion; touch must allow aim plus movement. [S6] |
| S: Believable humanoid models and smooth animation | Movement and weapon use must look coherent | HIGH | M3. Directional locomotion, actions, transitions and grips; inspect actual in-game silhouettes/poses. |
| S: Fast kills, regenerating health, ADS, headshots and recoil | Defines the selected combat rhythm | HIGH | Server foundation M1, full design M4. Establish damage/regen/ADS/recoil policy; no numerical CoD copy. |
| S: Bullet travel and selected-surface penetration | Firing must obey visible and consistent physical rules | HIGH | Travel authority M1; penetration M4. Material/thickness tags and damage loss need editor/export support. |
| S: Small initial weapon set with several rifles/SMGs | Choice should have distinct useful roles | MEDIUM/HIGH | M4. Recommend two rifles and two SMGs as a discussion starting point, plus selected secondary/other roles. |
| S: Progressive weapon and attachment unlocks | User requested availability that develops through play | HIGH | M4. Server awards progress and validates eligibility. Choose identity/save lifetime; social/accounts are separate decisions. |
| S: Attachments, tuning, scopes, reticles and red/green dots | Players customize handling and sight picture | HIGH | M4. Server computes legal stats; reticle color is a preference, not a power upgrade. Attachment count/types unresolved. |
| S: Live 3D loadout preview | Equipped items should be understandable before spawning | MEDIUM/HIGH | M4. Share weapon assemblies with gameplay; show chosen optics/attachments and other selected loadout elements. |
| S: Equipment and scorestreaks with useful reconnaissance | Rewards and utility must change useful decisions | HIGH | M4. Objective score should contribute; streak catalog and UAV behavior need selection. [S7] |
| P: Editable, reproducible, licensed asset sources | Content must remain modifiable through iteration | MEDIUM | M3 onward. Source URL/author/license/version plus exported artifact; verify component licenses and actual files. |
| S: New modular/extrusion/sculpt/prompt editor | User wants a more flexible map workflow | VERY HIGH | M5. Versioned authoring source and generated rendering/collision/navigation data; preserve old editor migration path. |
| S/P: At least two maps with mode/capacity fit | Modes need playable locations, routes and spawn rules | HIGH | M6. Supported modes/capacities per map must be declared and playtested rather than assumed universal. |

### Differentiators

These are selected differentiators or optional approaches to deliver them, not generic additions to the scope.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| S: Browser omnimovement with comparable device controls | Advanced movement without native installation | HIGH | M2. CoD-like responsiveness requires network and input iteration, not only animation clips. |
| S: Illustrated surfaces, outlines and stylized light on human anatomy | Comic-book look with convincing poses and silhouettes | HIGH | M3. Prototype one character, weapon and environment slice before catalog production. |
| S: Iterative Blender automation and LLM-assisted creation | Source assets can improve alongside actual gameplay review | MEDIUM/HIGH | M3 onward. Keep reproducible source/scripts; validate tooling and review exports in the browser. |
| S: Combined modular, extrusion, terrain and prompt workflow | Reuse assets while drawing new spaces and shaping terrain | VERY HIGH | M5. Prompt results become ordinary editable scene operations, with preview/undo and validation. |
| O: Readable numerical loadout comparisons | Players understand attachment tradeoffs without guessing | MEDIUM | M4 candidate. Show relevant changes in ADS time, recoil, capacity and mobility if selected. |
| O: Capacity-aware map validation report | Quickly identifies unusable spawns/objectives/routes | MEDIUM/HIGH | M5/M6 candidate. Start with structural checks; bots alone do not prove competitive balance. |

### Anti-Features and Explicit Deferrals

| Feature | Why Requested/Tempting | Why Problematic Here | Alternative |
|---------|-----------------------|----------------------|-------------|
| Armor plates in initial combat | Longer firefights and another resource | Explicitly deferred by user; changes selected fast-kill loop | Future longer modes only. |
| Whole franchise mechanic/catalog replication | Familiar CoD reference | Adds unselected perks, modes, swimming, parachutes and economies | Adopt the selected experience and discuss exact movement; keep extras optional. |
| Full art/editor rewrite before multiplayer | Existing limitations invite cleanup | Breaks the selected sequence and postpones core-value validation | Fix only prerequisites early; complete overhauls at M2/M3/M5. |
| Client-reported kills, unlocks or unrestricted tuning | Simplifies an early prototype | Conflicts with server authority and fair combat | Server derives damage, scores and eligibility from validated intent. |
| Bots added on top of 24 players | Makes the room appear fuller | Violates capacity meaning and changes CPU/combat density | Humans plus bots count toward one selected slot cap. |
| Always-on exact-location UAV information | Makes drones appear useful immediately | Removes counterplay and can expose hidden positions to every client | Time-limited team-scoped scans; reveal timing/counterplay as design candidates. |
| Giant launch weapon/attachment catalog | More apparent content | Multiplies models, grips, recoil, balance and unlock combinations | Few distinct rifles/SMGs first, expand after validating tradeoffs. |
| Unreviewed prompt-generated geometry/code | One-click authoring appeal | Can produce unwalkable, oversized or non-reproducible maps | Bounded structured edits to licensed assets; compile and playtest. |
| Reusing proprietary map/character rips | Familiar layouts and art | No verified reuse/modification permission or editable provenance | Original layouts or assets with explicit appropriate terms. |
| Mandatory generic social, monetization or account suite | Common platform feature templates | Not selected product scope | Resolve only the identity/storage needed by chosen progression. |
| Full Blender-like DCC inside the browser editor | Maximum flexibility | Expands M5 into an open-ended modeling application | Focused modular placement, footprint extrusion and bounded terrain tools. |

## Reference Mechanics and Design Decisions

### Multiplayer Modes

The BO6 official mode guide confirms TDM, FFA and no-respawn S&D; the S&D guide states one life per round. Hardpoint uses predictable rotating locations and prevents scoring while both teams occupy the point. These mechanics support the selected modes without adopting BO6's limits/timers. [S1–S3]

CTF is also a user requirement although it is not listed among BO6's launch core modes. The official Cold War reference describes taking the enemy flag home while defending your own; own flag at base is needed to capture. Choose dropped-flag return rules, overtime and carrier restrictions explicitly. [S4]

**Recommendation (inference):** validate TDM first inside M1, then FFA, S&D and the objective modes on the same actor/lifecycle/authority foundation. M1 is not complete until all five selected modes and optional bot fill have acceptance coverage. Existing maps can receive only essential mode markers now; new editor-produced maps remain M6.

### Movement and Motion Integration

BO6 reference: sprint, slide and dive in horizontal directions, with rotating supine prone; Tactical Sprint is forward-only. Sliding/diving start from sprint, with tap/hold crouch as default controls. The guide also describes slide cancellation and configurable movement assistance. These are candidate behaviors for phase discussion, not adopted mappings. [S5, S6]

**Recommendation (inference):** define stance, allowed transitions, directional velocities, action interruption and shoot/ADS permissions before acquiring every clip. Derive replicated animation state from simulation, and keep animation root motion from driving a second position. The current game blocks full ADS during slide/dive; whether to change that belongs to M2/M4. Create a browser training loop for transitions and touch/controller ergonomics.

### Combat and Loadouts

The official weapon guide distinguishes firepower, accuracy, handling and mobility, supports attachment unlocks through weapon use, and lists optic/muzzle/barrel/grip/magazine categories. Its scorestreak description includes objective contributions. VibeOnDuty requires meaningful tradeoffs; that differs from BO6's documented preference for mostly beneficial attachments. [S7]

The Road to Launch notes discuss headshot effectiveness, consistent time-to-kill and penetration tuning. Treat fast kills, headshot skill reward and recoil as one balancing problem. [S8]

**Recommendation (inference):** define visible body/head hit zones matching stance; a server validates shots against those zones. Calculate baseline body/head shots-to-kill and time-to-kill at representative distances, including travel and penetration. Keep health delay/rate, ADS transitions, recoil recovery and sprint-to-fire data-driven. Start penetration with a small material allowlist and bounded thickness, not arbitrary wall destruction. Progression persistence should be the smallest policy that satisfies the chosen unlock/save experience.

### Characters, Art and Creation Assets

Recommend a single accepted human rig with retained editable source, named action clips and repeatable export. Compare candidates against current retargeting and evaluate both first-person grips and remote silhouettes. Illustrated textures, tonal bands and outlines should be reviewed in gameplay lighting, not approved from a Blender render alone.

Blender's Shader to RGB is an Eevee-specific stylization tool; arbitrary Blender shading graphs are not a portable browser look. Use baked illustrated textures plus runtime stylization with adjustable cost. Its glTF documentation describes actions/NLA exports and supported skeletal animation. [S9, S10]

| Candidate (optional, not yet adopted) | Verified Provenance/Terms | Editable Source and Limits | Suggested Evaluation |
|--------------------------------------|---------------------------|----------------------------|----------------------|
| Quaternius Universal Base Characters, August 2025 | Creator page explicitly CC0; regular/superhero/teen humanoids | FBX/glTF; rigged `.blend` files in Source version, not guaranteed free tier; average 13k triangles | First humanoid rig candidate: regular proportions, clothing/material adaptation, animation compatibility and phone budget. [S11] |
| MakeHuman-generated human base | Official FAQ licenses exports CC0 | Parametric editable base; separately downloaded community clothing/hair may have different licenses | Alternative when realistic proportion control is more valuable than ready-made game topology. [S12] |
| Mixamo motion inputs | Adobe FAQ permits royalty-free personal/commercial game use | Existing repository has FBX inputs; this does not establish open-source raw redistribution rights | Motion source candidate; record clip origin and verify source publishing rights separately. [S13] |
| Kenney Modular Buildings | Creator page and support explicitly identify CC0 | Modular geometry; downloaded formats/editable contents still need inspection; not a complete FPS map | Graybox/kit candidate with restyling; inspect collision and scales. [S14, S15] |

No complete open-source FPS map with verified editable sources and component licenses was qualified by this survey. That is a research gap, not a claim that none exist. Recommend original two-map layouts from verified kits unless the map phase finds a complete suitable source project. Open engine/source code does not automatically license bundled maps or textures.

### Second Editor and Maps

Blender documents extrusion as creating connected geometry and offers many sculpting brushes; these are useful workflow references, not a requirement to implement every Blender tool in a browser. [S16, S17]

**Recommendation (inference):** one versioned scene format stores modular references/transforms, extruded footprints, terrain edits and mode markers. Generate rendering, collider, walkable navigation and penetration metadata from that source. Start with placement/selection/undo/save/playtest, then bounded extrusion and terrain, then prompt assistance operating on the same editable commands. Preserve v2 editor data through an explicit adapter where supported; a GLB alone is not a complete playable map format.

M6 produces two maps and declares each supported mode/capacity combination. Evaluate cover, spawn safety, flanks, flag runs, site approach/defuse exposure, Hardpoint rotations, elevation/camera clearance and frame/network cost. The user did not require every map to support every size and mode; decide the combination matrix before layout approval.

## Feature Dependencies

```text
Networked match → shared/headless rules + server collision + validated intent
Responsive play → predicted movement + reconciliation + remote interpolation
8/12/16/24 + bot fill → room capacity + server AI budget + suitable existing layout
S&D/CTF/Hardpoint → authoritative lifecycle + mode state + objective map markers
Omnimovement → replicated movement state + reliable body/camera clearance
Smooth human animation → movement semantics + accepted rig + licensed clips/export
Headshots/penetration → authoritative shot simulation + hit zones + material metadata
Attachments/loadout preview → weapon definitions + assembly sockets + server legality
Progressive unlocks → authoritative award events + chosen identity/save policy
Useful UAV/streaks → team-scoped visibility + server score + activation/lifetime rules
New editor → versioned editable source + compile to render/collision/navigation
Two new maps → editor workflow + content provenance + mode/capacity playtests
```

The full final weapon/art systems need not precede initial multiplayer: use existing assets and behavior behind stable simulation/content contracts. Conversely, authoring prompts should not determine authoritative collisions directly without compilation and validation.

## MVP Definition and Milestone Gates

### First Validation Slice Inside M1

- [ ] Two real clients join the same TDM, see remote movement, fire and receive consistent server-owned damage/death/score.
- [ ] Run one match to completion and restart/leave cleanly on an existing map; selected phone and PC controls work.
- [ ] Validate latency/loss behavior, basic movement rejection and shot cadence/ammo limits.
- [ ] Measure one Raspberry Pi target and record configuration/load; do not infer 24 slots from RAM size alone.

This slice validates the core value; it is not a reduction of the selected full scope.

### Selected Delivery Gates

| Gate | User-Selected Result | Evidence Needed Before Advancement |
|------|----------------------|------------------------------------|
| M1: Multiplayer | Server/lobbies, five modes, selectable 8/12/16/24, optional bots | Shared outcomes; complete mode transitions; bots obey objectives; benchmark supported slot/device configurations. |
| M2: Movement | Agreed omnimovement and elevation/body/camera repair | Keyboard/touch/controller transition tests; network reconciliation under moves; terrain/wall/ceiling visual checks. |
| M3: Characters | Human models, comic rendering and smooth movement-matched animation | Source/license manifest; reproducible Blender export; in-game directional/action/grip review; measured animation/render cost. |
| M4: Weapons | Fast combat, travel/penetration, small roster, unlocks, attachments/optics, live preview, equipment/streaks | Authoritative combat/stat validation; balance trials; preview matches equipped build; progression save semantics; useful UAV decision. |
| M5: Editor | Modular placement, extrusion, sculpting and prompt assistance | Undo/save/reopen/playtest; consistent compiled collisions/navigation; bounded editable prompt output; old-map compatibility policy. |
| M6: Maps | At least two playable maps through the workflow | Declared mode/size matrix; multiplayer/bot objective playtests; provenance and editable sources; target-device performance. |

### Future Consideration

Armor plates are explicitly future scope. Additional weapon catalogs, elaborate progression economies, advanced editor tools and optional recommendations may follow validation. Do not silently move selected M4/M5/M6 requirements into an unspecified future version.

## Feature Prioritization Matrix

| Feature Group | User Value | Implementation Cost | Priority |
|---------------|------------|---------------------|----------|
| Shared authoritative match and responsive network play | HIGH | HIGH | P1 / M1 first |
| Five modes, capacity selection, bot fill and match lifecycle | HIGH | HIGH | P1 / M1 completion |
| Correct collision and agreed omnimovement | HIGH | HIGH | P1 / M2 |
| Human animation and illustrated rendering | HIGH | HIGH | P1 / M3 |
| Combat/roster/attachments/progression/loadout/equipment | HIGH | HIGH | P1 / M4 |
| Combined editor and two supported maps | HIGH | VERY HIGH | P1 / M5–M6 |
| Optional numerical comparisons/validator reports | MEDIUM | MEDIUM/HIGH | P2 / discuss within corresponding phase |
| Armor plates | Unmeasured for this fast-combat scope | MEDIUM/HIGH | P3 / explicitly future |

## Open Decisions for Phase Discussion

- M1: join/access topology, bot replacement and skill policies, spectators, permitted reconnect timing, supported device/Pi configurations and latency acceptance envelope.
- M2: exact move set, cancel/landing restrictions, prone rotation and shoot/ADS permissions, touch mappings and movement assists; no movement numbers adopted from CoD.
- M3: accepted rig/source tier, verified clip sources and redistribution rights, actual Blender automation availability, browser art target and per-character cost.
- M4: initial distinct weapons, damage/regen/recoil/travel/penetration values, attachment/tuning limits, progression identity/save lifetime and equipment/streak selection.
- M5/M6: prompt backend/tool availability, scene format and import support, concrete licensed map candidates, two settings and supported mode/capacity matrix.

## Sources

All sources accessed 2026-10-03; external findings **MEDIUM**, classified by `websearch --verified`. Publication dates identify reference era. Some Blender English pages failed direct fetching; indexed official 4.5 documentation/available translations supplied the documented workflow findings. Validate against the installed Blender version in its phase. Local-code facts are limited to the reviewed paths listed above.

- **S1:** [BO6 Multiplayer: How to Play](https://www.callofduty.com/guides/blackops6/training/call-of-duty-guides-black-ops-6-multiplayer-how-to-play), 2024 reference.
- **S2:** [BO6 Search & Destroy](https://www.callofduty.com/guides/blackops6/modes/call-of-duty-guides-black-ops-6-multiplayer-mode-guide-search-and-destroy), 2024-10-23.
- **S3:** [BO6 Hardpoint](https://www.callofduty.com/guides/blackops6/modes/call-of-duty-guides-black-ops-6-multiplayer-mode-guide-hardpoint), 2024-10-23.
- **S4:** [Cold War Season Four announcement: CTF](https://www.callofduty.com/es/blog/2021/06/Everything-You-Need-to-Know-About-Season-Four-Call-of-Duty-Black-Ops-Cold-War-and-Warzone-Arriving-June-17), 2021-06; historical rule reference.
- **S5:** [BO6 Movement Guide](https://www.callofduty.com/guides/blackops6/training/call-of-duty-guides-black-ops-6-multiplayer-training-movement), 2024-10-23; cross-checked with [NEXT global systems reveal](https://www.callofduty.com/blog/2024/08/call-of-duty-next-black-ops-6-reveal-global-systems-key-innovations-announcement), 2024-08.
- **S6:** [BO6 Controls and Settings](https://www.callofduty.com/guides/blackops6/training/call-of-duty-guides-black-ops-6-multiplayer-training-controls), 2024 reference.
- **S7:** [BO6 Weapons and Loadouts](https://www.callofduty.com/guides/blackops6/pre-game/call-of-duty-guides-black-ops-6-multiplayer-pre-game-weapons-and-loadouts), 2024-08-27.
- **S8:** [BO6 Multiplayer: Road to Launch](https://www.callofduty.com/blog/2024/09/call-of-duty-black-ops-6-mp-road-to-launch), 2024-09; balancing reference.
- **S9:** [Blender Shader to RGB](https://docs.blender.org/manual/id/4.0/render/shader_nodes/converter/shader_to_rgb.html), versioned official reference for Eevee constraint.
- **S10:** [Blender 4.5 glTF export](https://docs.blender.org/manual/ja/4.5/addons/import_export/scene_gltf2.html), official versioned indexed documentation.
- **S11:** [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), 2025-08; CC0/source-tier evidence.
- **S12:** [MakeHuman export licensing FAQ](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html), official current accessible terms explanation.
- **S13:** [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html), last updated 2021-09-14; current accessible game-use permission, not a raw redistribution determination.
- **S14:** [Kenney Modular Buildings](https://kenney.nl/assets/modular-buildings), creator asset page; CC0.
- **S15:** [Kenney support/license explanation](https://kenney.nl/support), corroborates commercial use and CC0.
- **S16:** [Blender 4.5 Extrude Faces](https://docs.blender.org/manual/id/4.5/modeling/meshes/editing/face/extrude_faces.html), official versioned documentation.
- **S17:** [Blender 4.5 Sculpting](https://docs.blender.org/manual/en/4.5/sculpt_paint/sculpting/index.html), updated 2025-07-26.

---
*Feature research for VibeOnDuty; recommendations need the stated phase decisions and acceptance measurements.*
