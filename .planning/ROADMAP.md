# Roadmap: VibeOnDuty

## Overview

Deliver the full selected v1 scope in the user's revised order: the completed multiplayer foundation, human characters, animation, omnimovement/collision, the remaining multiplayer work, weapons/loadouts/progression/equipment, the second editor, and final maps. Phase 1 is a playable two-client authoritative TDM result using existing maps and assets, with a straightforward console startup command. Each phase is an MVP delivery boundary within the full 67-requirement scope; an early playable slice does not remove later commitments.

**Granularity:** fine
**Project mode:** mvp
**Roadmap status:** Accepted on2026-10-03; Phase1 completed on2026-10-04 with7/7 plans,5/5 human UAT checks and all five shared requirements accepted. On2026-10-04 the user prioritized Phase6, then7, then5. Phase6 completed on2026-10-05 with6/6 plans, seven passing stable gates, clean technical verification and2/2 explicit human visual passes. Phase7 discussion is next; Phases5 and2–4 remain pending.

**Execution order:** 1 (complete) → 6 → 7 → 5 → 2 → 3 → 4 → 8 → 9 → 10 → 11 → 12. Phase numbers remain stable identifiers. Follow this order when updating the current phase or choosing a next action; numeric next-phase suggestions from tooling do not override it.

**Animation/movement boundary:** Phase7 owns the rig, clips, action blending and accepted transitions for current gameplay, plus inspectable preparation for future slides/dives/prone. Phase5 owns final ANIM-01 acceptance against actual omnimovement simulation. Any input or prediction foundation needed to deliver Phase5 must be implemented there; Phase2 subsequently extends and qualifies the broader lobby/network/device experience.

Node24 and exact approved Colyseus dependencies are installed; owned fixture/TLS hosting, shared movement, traveling M4 and full TDM lifecycle have production-browser evidence. Current cloned rigs, private feedback/recovery and all six offline destinations pass their checks. Final gates after code-review and UI fixes pass247 unit,19 offline/animation and14 production multiplayer tests, both types/builds and lint. Canonical verification is passed after all five human checks in01-UAT.md; the shared completion gate reports no blockers and current source evidence. Human acceptance covers actual-window trust, pointer lock, full-size gameplay/visual judgment and scope/capacity wording. Small production screenshots retain their historical limits. No Pi/FPS/slot qualification is claimed. Rapier adoption and full movement, art, editor and final-map overhauls retain their selected future position.

## Phases

Integer phases identify the planned work. Decimal phases are reserved for later urgent insertions. Execute in the user-selected order above; the checklist and sections retain their original numeric positions.

- [x] **Phase 1: Two-Client Authoritative TDM** - Two browser players can complete a fair, server-scored TDM match using the current maps and assets. (completed 2026-10-04)
- [ ] **Phase 2: Responsive Cross-Device Lobbies and Deathmatch** - Players on PCs and phones can choose a lobby, complete responsive TDM or free-for-all sessions, and safely start another match.
- [ ] **Phase 3: Bomb, Flag, and Hardpoint Matches** - Players can complete all five selected multiplayer modes with authoritative objectives and consistent outcomes.
- [ ] **Phase 4: Bot-Filled Matches on Measured Pi Hosting** - An operator can host the five modes on identified Raspberry Pi hardware and offer only measured human/bot capacities.
- [ ] **Phase 5: Omnimovement with Reliable Body and Camera Collision** - Players use the selected directional movement on every input device while bodies, aim, and cameras remain consistent with the world and server.
- [x] **Phase 6: Human Characters and Comic-Book Blender Iteration** - Players see an accepted human character and comic-book visual slice that creators can reproduce and improve through Blender. (completed 2026-10-05)
- [ ] **Phase 7: Movement-Matched and Action-Safe Animation** - Human characters move and act smoothly in first- and third-person views while staying aligned with authoritative gameplay.
- [ ] **Phase 8: Distinct Weapons and Authoritative Fast Combat** - Players fight with a small distinct rifle/SMG roster, readable aiming and recoil, fast kills, regeneration, and consistent projectile rules.
- [ ] **Phase 9: Live Loadouts, Attachments, and Durable Unlocks** - Players earn legal weapon options, build and preview loadouts, and retain their choices and progress across sessions.
- [ ] **Phase 10: Useful Equipment, Score Streaks, and Reconnaissance** - Players use expanded equipment and earned streaks with authoritative effects and a useful, bounded reconnaissance decision.
- [ ] **Phase 11: Combined Second Editor with Inspectable Prompt Edits** - Creators build, revise, and playtest editable maps using modular placement, drawing/extrusion, sculpting, and natural-language proposals.
- [ ] **Phase 12: Qualified Adaptations and Two Playable Final Maps** - Players get at least two sourced or original maps with tested modes, capacity variants, and recorded performance on the selected devices and hosting profiles.

## Phase Details

### Phase 1: Two-Client Authoritative TDM

**Goal:** As a browser player, I want to complete a fair server-scored TDM match with another player using the current maps and assets, so that both players share authoritative outcomes.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** NET-01, NET-03, NET-04, MODE-01, HOST-03
**Success Criteria** (what must be TRUE):

1. Two real browser clients join the same dedicated-server match on an existing map, see each other, move, fire, die, and respawn.
2. Both clients view the same team assignment, confirmed damage, kills, score, and match winner through a complete TDM session.
3. Invalid, stale, duplicated, and impossible movement commands do not change the authoritative player state.
4. Modified client messages cannot grant firing eligibility, create trusted hit outcomes, award damage or kills, or overwrite server score.
5. An operator starts the server with `npm run mp-server -- --port <port> --host <bind-address> --tls --public <advertised-address>`; port/binding/TLS/advertised-address configuration takes effect, certificate setup is documented, and invalid configuration produces actionable errors.

**Plans:** 7/7 complete; automated verification and human acceptance passed2026-10-04
**UI hint:** yes

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Approve exact packages and create the production-server verification harness (Wave 1).

**Wave 2** *(complete)*
- [x] 01-02-PLAN.md — Prove two-browser movement and confirmed M4 hit, canonical map and online entry (Wave 2).

**Wave 3** *(complete)*
- [x] 01-03-PLAN.md — Deliver minimum movement and reject hostile/replayed input commands (Wave 3).
- [x] 01-06-PLAN.md — Launch one CLI-configured HTTP/TLS game link with protected certificate reuse (Wave 3).

**Wave 4** *(complete)*
- [x] 01-04-PLAN.md — Enforce firing/reload, swept impacts and server combat outcomes (Wave 4).

**Wave 5** *(complete)*
- [x] 01-05-PLAN.md — Finish teams, death/respawn, results and same-settings rematch (Wave 5).

**Wave 6** *(complete)*
- [x] 01-07-PLAN.md — Current-rig, feedback, recovery, offline and security checks pass (Wave6); human trust/gesture/visual/probe acceptance passed in01-UAT.md.

**Research/discussion focus:** Validate the proposed runtime/transport/physics combination, shared headless simulation boundaries, fixed-step input contract, and minimum authoritative collision/projectile behavior. Define CLI defaults, `--help`, port/bind validation, TLS certificate configuration, and the client-facing hostname/URL semantics of `--public`, including direct TLS and proxy hosting. Keep existing art and maps; extract only the collision/map/lifecycle foundations needed for this playable slice.

### Phase 2: Responsive Cross-Device Lobbies and Deathmatch

**Goal:** Players on PCs and phones can choose a lobby, complete responsive TDM or free-for-all sessions, and safely start another match.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** NET-02, NET-05, NET-06, NET-07, MODE-02, PLAT-01, PERF-01
**Success Criteria** (what must be TRUE):

1. Players create or join a lobby, choose an available mode and supported existing map, and request 8, 12, 16, or 24 total slots; the active hosting profile permits only qualified capacities.
2. Keyboard/mouse, touch-phone, and supported gamepad players complete the same match; free-for-all has individual respawns and a server-scored winner.
3. Under the agreed latency, jitter, and loss scenarios, local input stays responsive, corrections remain within agreed limits, and remote motion is smooth enough to aim at.
4. Moving-target, cover, death, and respawn trials produce consistent confirmed projectile outcomes under a documented bounded latency policy; arbitrary client timestamps cannot change the result.
5. Players leave, reconnect according to the chosen policy, finish, and restart without stale match state; they can select visual quality using published sustained benchmarks targeting 60 FPS on named phone, integrated-graphics PC, and gaming-PC devices.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Build on the accepted character, animation and movement work. Set network impairment and device baselines; compare bounded travelling-projectile policies and extend any prediction/input foundation delivered by Phase5. Decide input ergonomics, reconnect policy, endpoint topology, tick/snapshot rates, and initial capacity gating. Phase4 qualifies Raspberry Pi profiles; this phase does not imply that every requested capacity is supported on that hardware.

### Phase 3: Bomb, Flag, and Hardpoint Matches

**Goal:** Players can complete all five selected multiplayer modes with authoritative objectives and consistent outcomes.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** MODE-03, MODE-04, MODE-05
**Success Criteria** (what must be TRUE):

1. Search & Destroy players plant and defuse the bomb, view the same round outcome, and remain dead until the next round after elimination.
2. Capture the Flag players pick up, carry, drop, return, and capture flags, with consistent ownership and team score across clients.
3. Hardpoint players contest and control rotating locations, with the chosen occupancy rules producing the same authoritative team score and winner on every client.
4. Players switch among TDM, Deathmatch, Search & Destroy, Capture the Flag, and Hardpoint through supported lobby/map combinations without objective or round state leaking between matches.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Discuss mode timers, win/tie rules, occupancy, objective/drop behavior, and join/reconnect rules during rounds. Add only essential markers/spawns and existing-map fixes needed to play these modes; final map production remains Phase 12.

### Phase 4: Bot-Filled Matches on Measured Pi Hosting

**Goal:** An operator can host the five modes on identified Raspberry Pi hardware and offer only measured human/bot capacities.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** BOT-01, BOT-02, BOT-03, HOST-01, HOST-02
**Success Criteria** (what must be TRUE):

1. A lobby creator uses the lobby interface to toggle vacant-slot bot filling, and humans plus server-controlled bots never exceed the chosen capacity.
2. Bots traverse, fight, respect teams and life states, and pursue the selected objectives in all five modes under the same authoritative rules as humans.
3. Human joins and leaves follow the chosen bot replacement policy without broken teams, illegal S&D respawns, corrupted objectives, or changed scores.
4. An operator launches, configures endpoints, restarts, and reconnects clients to the server on the identified ARM64 Raspberry Pi configuration using reproducible instructions.
5. Published sustained 8/12/16/24-slot trials record human/bot mix, tick time, memory, network load, and hardware/cooling conditions; the operator and lobby enforce the resulting qualified profiles, including rejected or unmeasured capacities.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Confirm the actual Pi model, 4 GB/16 GB alternatives, ARM64 OS, cooling, storage, network access, and bot workloads. Benchmark measured limits with the already accepted character/animation/movement costs rather than infer 24-player capacity from RAM. This completes the remaining multiplayer delivery group before weapons and loadouts.

### Phase 5: Omnimovement with Reliable Body and Camera Collision

**Goal:** Players use the selected directional movement on every input device while bodies, aim, and cameras remain consistent with the world and server.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, MOVE-06, ANIM-01
**Success Criteria** (what must be TRUE):

1. Players sprint forward, backward, and sideways and enter/cancel directional slides under agreed speed, stance, and action rules, with prediction and server validation agreeing.
2. Players dive in the selected directions and transition into the agreed prone/supine movement and aiming states; other clients observe the same posture.
3. Players jump, land, and traverse supported ramps, stairs, uneven terrain, and overlapping floors without entering terrain, falling through it, or snapping to another floor.
4. Stance changes respect wall, ceiling, and body clearance; pressing or leaning near walls cannot reveal the opposite side through the camera.
5. Keyboard/mouse, touch, and gamepad players perform the selected simultaneous movement/actions using documented, configurable controls in the settings menu.
6. The Phase7 clips follow actual simulated idle, directional locomotion, sprint, slide, dive, prone, jump and landing with accepted transitions; visual motion does not displace the authoritative body.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Define the exact Call of Duty-inspired move/action transitions, collider rotation/resizing, clearance rules, and cross-device mappings. Implement any minimum input/prediction foundation required by these criteria instead of assuming unfinished Phase2 functionality exists. Integrate the Phase7 motion with actual server states and close ANIM-01 here. Run available Phase1 regressions and explicitly selected movement/device/network trials; broader Phase2/Pi qualification remains pending.

### Phase 6: Human Characters and Comic-Book Blender Iteration

**Goal:** As a browser player and creator, I want to see an accepted human character and comic-book visual slice that I can reproduce and improve through Blender, so that gameplay has the chosen appearance and creators can iterate it recoverably.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** ART-01, ART-02, ART-03, ART-04
**Success Criteria** (what must be TRUE):

1. Players inspect accepted humanlike proportions, silhouettes, and weapon grips in the running game; editable model sources and asset-specific provenance accompany the accepted character.
2. A representative character, weapon, and existing-environment slice shows the chosen illustrated textures, stylized lighting, and scalable outlines at the agreed visual quality settings.
3. A creator changes a model or material using the verified Blender automation path, exports it reproducibly, and compares the result in-game before acceptance.
4. A creator performs an LLM-assisted Blender change through an available documented integration or script workflow, inspects the change, and restores the prior editable source version.

**Plans:** 6/6 complete; canonical verification passed and both human visual checks accepted on 2026-10-05
- [x] 06-01-PLAN.md
- [x] 06-02-PLAN.md
- [x] 06-03-PLAN.md
- [x] 06-04-PLAN.md
- [x] 06-05-PLAN.md
- [x] 06-06-PLAN.md

**UI hint:** yes

**Research/discussion focus:** Confirm installed Blender/tooling, reusable human rigs and asset terms, exporter compatibility, and browser material/outline costs. Choose art from repeated in-game review using current movement; do not assume a Blender connector or discard the working rig pipeline without comparison. Preserve Phase1 multiplayer and offline regressions. Record the actual visual-review device and measured art costs; broader cross-device/Pi qualification is still assigned to Phases2 and4.

### Phase 7: Movement-Matched and Action-Safe Animation

**Goal:** Human characters move and act smoothly in first- and third-person views while staying aligned with authoritative gameplay.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** ANIM-02, ANIM-03, ANIM-04, ANIM-05
**Success Criteria** (what must be TRUE):

1. Characters visibly follow current simulated idle, directional locomotion, sprint, crouch, jump and landing without unacceptable snapping. Future slide/dive/prone clips and transition candidates are inspectable in a preview; their final match against implemented omnimovement is accepted under ANIM-01 in Phase5.
2. ADS, firing, reload, melee, equipment, damage, and death action animations retain accepted grips and avoid unintended overlap in first- and third-person views.
3. Remote posture and aim match the server state; visual blending and root motion never shift the gameplay body independently of simulation.
4. A creator imports or retargets approved reusable motion onto the selected rig, regenerates runtime clips, and reviews the resulting transitions through the Blender-to-game workflow.
5. Repeated spawn, character replacement, and disposal keep shared templates usable and release instance resources within the measured browser budget.

**Plans:** 33/38 plans executed, 22 tasks across 9 waves; independent plan verification passed on 2026-10-05
- [x] 07-27-PLAN.md — live play on composed clips with inherited motion-captured legs under the authored weapon pose; inertia fix; composed-pose guards (Wave A)
- [x] 07-28-PLAN.md — first-person look-down body view fix (Wave A)
- [x] 07-34-PLAN.md — first-person contact regression: crouch and jump pelvis held over the root; contact guard for four weapons (Wave A, runs before the rest of 07-29)
- [x] 07-29-PLAN.md — browser check, focused specs, fast gates (Wave A; resumes after 07-34)
- [ ] 07-33-PLAN.md — independent opus/high review, then the blocking owner live check (Wave A, runs after 07-29)
- [x] 07-35-PLAN.md — crouch torso lean (owner item L-01): one constant in the weapon handler, weapon level, first person unchanged (Wave A)
- [x] 07-36-PLAN.md — browser proof, focused set, fast gates, non-binding owner preview of the lean (Wave A)
- [x] 07-38-PLAN.md — first-person own-body view in crouch: browser measurement through the real loop, lean kept out of the body view, eye clearance (Wave A, before 07-37)
- [ ] 07-37-PLAN.md — second delta opus/high review, then the binding owner check with the open items named (Wave A)
- [ ] 07-30-PLAN.md — identity inventory and stable gates at the new identity (Wave B, after owner approval)
- [ ] 07-31-PLAN.md — paired calibration, sessions and plan 09 record at the new identity (Wave B)
- [ ] 07-32-PLAN.md — strict capture at the new identity, documentation, re-derived requirement status (Wave B)
- [x] 07-26-PLAN.md — collector online route robust at capture frame rate; control runs and independent review before the one new strict capture of 07-19
- [x] 07-25-PLAN.md
- [x] 07-24-PLAN.md
- [x] 07-23-PLAN.md
- [x] 07-20-PLAN.md
- [x] 07-21-PLAN.md
- [x] 07-22-PLAN.md
- [x] 07-11-PLAN.md
- [x] 07-12-PLAN.md
- [x] 07-13-PLAN.md
- [x] 07-14-PLAN.md
- [x] 07-15-PLAN.md
- [x] 07-16-PLAN.md
- [x] 07-17-PLAN.md
- [x] 07-18-PLAN.md
- [x] 07-19-PLAN.md

**Wave 1**
- [x] 07-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md
- [x] 07-04-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-05-PLAN.md

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 07-06-PLAN.md

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 07-07-PLAN.md

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 07-08-PLAN.md

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 07-09-PLAN.md

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 07-10-PLAN.md

**UI hint:** yes

**Research/discussion focus:** Select compatible licensed motion, transition/action permissions, authoritative pose signals, and resource ownership. Use current supported gameplay for acceptance; agree provisional omnimovement pose/transition interfaces without inventing server states or counting previews as ANIM-01 completion. Phase5 implements those states and performs final movement/animation integration. Evaluate actual in-game poses and export reproducibility; future weapons/equipment must preserve this animation acceptance. Re-run available multiplayer/offline regressions and measure animation cost on the selected review device.

### Phase 8: Distinct Weapons and Authoritative Fast Combat

**Goal:** Players fight with a small distinct rifle/SMG roster, readable aiming and recoil, fast kills, regeneration, and consistent projectile rules.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** GUN-01, GUN-02, GUN-03, GUN-04, GUN-05, GUN-06, GUN-07
**Success Criteria** (what must be TRUE):

1. Players select multiple distinct rifles and multiple distinct SMGs plus the agreed supporting categories, with visibly different handling under the documented fast-kill and server-owned health-regeneration rules.
2. Players aim down the equipped sights, and aim, accuracy, recoil, and permitted action states follow reproducible server-compatible rules.
3. Head and body hits apply the documented server-owned damage differences correctly through the supported movement postures.
4. Traveling shots collide consistently with moving players and map geometry using the agreed swept-collision and latency rules.
5. Shots penetrate only selected materials within the documented thickness, energy/damage-loss, and subsequent-hit limits; all clients observe the confirmed result.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Choose roster, damage/regen/recoil values, hit regions, ADS permissions, travel behavior, and penetration materials. Refine the multiplayer projectile policy using combat trials; recheck accepted grips/action animation and device/server scenarios.

### Phase 9: Live Loadouts, Attachments, and Durable Unlocks

**Goal:** Players earn legal weapon options, build and preview loadouts, and retain their choices and progress across sessions.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** GUN-08, GUN-09, LOAD-01, LOAD-02, LOAD-03, PROG-01, PROG-02, PROG-03
**Success Criteria** (what must be TRUE):

1. Players equip legal attachments and tuning with documented handling/stat tradeoffs, and choose supported scopes, reticles, and red/green dot sights whose aiming presentation matches the equipped parts.
2. Players assemble and save a weapon/attachment/optic/equipment loadout while a live 3D preview updates the gun and supported loadout elements.
3. Preview parts and effective stats match the saved and spawned equipment; the server rejects incompatible or locked selections.
4. Players start with a small usable selection, earn weapon and attachment unlocks under documented rules, and retain progression and loadouts through reconnects and server restarts using the chosen identity/persistence policy.
5. Match awards are server-owned and applied once through retries and restarts; changing browser saves cannot create unlocks.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Decide minimal player identity/recovery, save lifetime, unlock/reward rules, catalog legality, and durable storage. Validate the proposed storage choice rather than add an account/social suite. Recheck preview cost, equipped appearance, and client/server scenarios.

### Phase 10: Useful Equipment, Score Streaks, and Reconnaissance

**Goal:** Players use expanded equipment and earned streaks with authoritative effects and a useful, bounded reconnaissance decision.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** EQP-01, STREAK-01, UAV-01
**Success Criteria** (what must be TRUE):

1. Players select and use the agreed expanded equipment set with server-owned inventory, effects, and action timing, reflected in saved loadouts and equipped presentation.
2. Players earn and activate the chosen score streaks only when authoritative score, eligibility, and match/life rules permit them; effects end correctly on the defined lifecycle transitions.
3. An explicit gameplay review results in useful UAV-style reconnaissance with agreed team visibility, duration, bounds, and counterplay, or removal of the ineffective existing drone system.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Select equipment/streak catalog, scoring and reset rules, reconnaissance/counterplay, and the UAV-or-removal outcome. Recheck action animation, objective modes, network load, and device/server scenarios.

### Phase 11: Combined Second Editor with Inspectable Prompt Edits

**Goal:** Creators build, revise, and playtest editable maps using modular placement, drawing/extrusion, sculpting, and natural-language proposals.
**Mode:** mvp
**Depends on:** Phase 10
**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, AIEDIT-01, AIEDIT-02
**Success Criteria** (what must be TRUE):

1. Creators open the second 3D editor and place, transform, duplicate, and group modular environment pieces.
2. Creators draw and extrude editable structures, sculpt terrain, and traverse the compiled result with actual game movement and matching gameplay collision.
3. Creators undo/redo, save/reopen editable sources, and return from map playtests without losing authoring state.
4. Creators author spawns, teams, objectives, and mode/capacity support; versioned compilation produces matching visual, collision, material, and navigation data, with a documented coexistence/import path preserving supported existing-map serialization.
5. Creators inspect an editable natural-language proposal before applying ordinary undoable commands; bounded validation rejects invalid generated/imported content and prevents arbitrary code execution or bypass of authoritative map validation.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Choose authoring/bake schema, modular/extrusion/sculpt limits, navigation and import formats, professional map workflow, prompt backend/provider, and old-editor migration policy. Prompt assistance needs its own AI contract and evaluations; no project-wide model rewrite or assumed SDK/connector is required.

### Phase 12: Qualified Adaptations and Two Playable Final Maps

**Goal:** Players get at least two sourced or original maps with tested modes, capacity variants, and recorded performance on the selected devices and hosting profiles.
**Mode:** mvp
**Depends on:** Phase 11
**Requirements:** IMPORT-01, IMPORT-02, MAP-01, MAP-02, MAP-03, PERF-02
**Success Criteria** (what must be TRUE):

1. Creators can review a researched shortlist of popular reusable FPS map sources with inspected editable files, provenance, modification/redistribution terms, and mode suitability.
2. A qualified source can be adapted through the new workflow with attribution and editable output; unsuitable/unavailable candidates and any required original-map fallback are documented for explicit review.
3. Players complete matches on at least two maps produced or adapted through the new editor/Blender workflow, with coherent locations and layouts for their advertised modes.
4. The map set supplies declared, tested layouts or variants for 8-, 12-, 16-, and 24-slot play; each map advertises only its supported mode/size combinations, and hosting profiles still gate usable capacity.
5. Every advertised combination passes human/bot objectives, spawn safety, movement/camera/collision, and client/server scenarios; final evidence also records earlier movement, character, and weapon delivery checks, measured limits/regressions, editable sources, and provenance.

**Plans:** TBD
**UI hint:** yes

**Research/discussion focus:** Qualify actual reusable source/component terms and import files; no complete reusable source map is currently qualified. Choose two settings and the mode/capacity matrix, iterate blockouts before art, and benchmark final sustained loads against the established 60 FPS device target and Pi envelopes.

## Recurring Acceptance Gates

- Before multiplayer acceptance, name the impaired-network scenarios, numeric correction/tick limits, target devices, frame-time limits, bot mixes, and hardware conditions. Do not report unrun tests as evidence.
- Phase 2 establishes scalable visual settings and reproducible sustained browser scenarios targeting 60 FPS across phones, integrated-graphics PCs, and gaming PCs. Phase 4 publishes measured ARM64 Pi hosting profiles for 8/12/16/24 total human-plus-bot slots; unqualified sizes remain unavailable on that profile.
- Re-run available client/server scenarios at each movement, character/animation and weapon/loadout/equipment delivery. Before Phases2 and4 run, record explicitly chosen review devices and local measurements without claiming the later qualification exists. Once those phases establish full scenarios, use them for subsequent regressions. Phase12 owns final closure of the cross-delivery performance requirement and qualification of every advertised final-map combination.
- Assess art/animation through running-game visual review, not numerical pose checks alone. Keep editable sources, reproducible exports, asset-specific provenance, safe shared resource ownership, existing serialization compatibility, and prefix-aware asset URLs throughout.

## Open Decisions

| Decision | Resolve in |
|----------|------------|
| Installed compatible server/shared stack, tick/snapshot rates, prediction replay, projectile history/timestamp/obstruction/death policy | Phases 1-2 |
| Named phone/iGPU/gaming-PC baselines, network impairment, numeric frame/tick acceptance, LAN/Internet endpoint topology | Phases 2 and 4 |
| Exact Pi model, 4 GB or 16 GB configuration, ARM64 OS, cooling/storage/connectivity, sustained player/bot capacity | Phase 4 |
| Sprint/slide/dive/prone/supine rules, collider clearance, shoot/ADS permissions, simultaneous touch/gamepad bindings | Phase 5 |
| Actual Blender automation path, human rig/source licenses, motion compatibility, accepted poses and art budget | Phases 6-7 |
| Weapon/balance/penetration catalogs, minimal identity/recovery/save lifetime, durable unlock awards, equipment/streak/UAV choices | Phases 8-10 |
| Second-editor document/compiler/import/navigation formats, prompt provider/backend, safe editable operations and old-editor path | Phase 11 |
| Qualified reusable complete map sources, component terms, original fallback if necessary, two settings and supported mode/size matrix | Phase 12 |

Armor plates remain future longer-mode scope. Monetization and generic authentication/social suites are outside this release.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Two-Client Authoritative TDM | 7/7 | Complete    | 2026-10-04 |
| 2. Responsive Cross-Device Lobbies and Deathmatch | 0/TBD | Not started | - |
| 3. Bomb, Flag, and Hardpoint Matches | 0/TBD | Not started | - |
| 4. Bot-Filled Matches on Measured Pi Hosting | 0/TBD | Not started | - |
| 5. Omnimovement with Reliable Body and Camera Collision | 0/TBD | Not started | - |
| 6. Human Characters and Comic-Book Blender Iteration | 6/6 | Complete    | 2026-10-05 |
| 7. Movement-Matched and Action-Safe Animation | 33/38 | In Progress|  |
| 8. Distinct Weapons and Authoritative Fast Combat | 0/TBD | Not started | - |
| 9. Live Loadouts, Attachments, and Durable Unlocks | 0/TBD | Not started | - |
| 10. Useful Equipment, Score Streaks, and Reconnaissance | 0/TBD | Not started | - |
| 11. Combined Second Editor with Inspectable Prompt Edits | 0/TBD | Not started | - |
| 12. Qualified Adaptations and Two Playable Final Maps | 0/TBD | Not started | - |

**Coverage:**67/67 v1 requirements assigned exactly once; no orphaned or duplicate assignments. Traceability lives in REQUIREMENTS.md. Phase1's five requirements are complete after automated verification and human acceptance;62 requirements and later plans remain pending.

---
*Created: 2026-10-03. Accepted with Phase 1 console-server startup on 2026-10-03.*
