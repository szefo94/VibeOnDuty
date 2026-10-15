# Phase 7: Movement-Matched and Action-Safe Animation — Research

**Researched:** 2026-10-05
**Domain:** Three.js character presentation, Blender motion authoring, action lifecycle
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

Verbatim decisions and deferred scope below. [VERIFIED: 07-CONTEXT.md, Implementation Decisions and Deferred Ideas]

<!-- DATA_R7a19e2c_START -->
## Implementation Decisions

### Weapon handling and camera feel
- **D-01:** Controlled, responsive motion: noticeable weapon movement, restrained
  camera bob and steady ADS. Avoid cinematic camera jolts that dominate aiming.
- **D-02:** Show animated arms and hands in first person, plus torso and legs when
  looking down. Hands must perform real weapon handling and maintain credible
  contact; do not deliver only a floating gun or only a third-person pose review.
- **D-03:** Reloads show clear physical magazine removal/insertion and appropriate
  bolt handling. Fit the animation to gameplay reload time rather than changing
  ammo/timing outcomes to accommodate a clip. Specific handling follows each
  supported weapon; do not apply a detachable-magazine sequence indiscriminately.
- **D-04:** ADS responds immediately with a short, smooth raise/lower transition;
  sights settle without bounce.

### Full-body movement
- **D-05:** Quick, planted directional turns/stops, subtle body lean and feet
  matching actual movement speed. Animation must not move the simulated body.
- **D-06:** Normal sprint uses a lowered two-handed gun carry. Prepare a distinct
  one-handed supersprint carry and transitions for the user's two-level sprint
  request. In Phase 5, Shift selects normal sprint and double-tap Shift requests
  supersprint; a preview is not an implemented faster movement state.
- **D-07:** Compact, controlled jumps and landings: secure gun handling, brief
  knee compression on contact, and quick recovery.
- **D-08:** Torso leads small stationary aim turns; larger turns reposition the
  feet. Keep twist within credible anatomy and posture consistent with the
  authoritative aim/body state.

### Action interactions
- **D-09:** Desired sprint/reload rule: normal sprint permits reloading with a
  **15% longer reload time**; supersprint cancels reloading and switches to the
  one-handed carry. This means duration multiplied by 1.15, not 15% slower
  playback interpreted as duration divided by 0.85. Prepare consistent visual
  timing/transitions in Phase 7; Phase 5 implements the new movement-dependent
  gameplay timing/cancellation, with server authority. Do not silently change
  the accepted online M4 timer as an animation-only change.
- **D-10:** Supported melee and grenade throws take priority immediately: leave
  ADS, cancel reload, perform the action and return to weapon-ready. Avoid
  unintended action overlap, delayed queued attacks, duplicate releases or
  ammo awards from a canceled reload. An animation is not authorization for an
  online action that the server does not yet support.
- **D-11:** Controlled directional death collapse: a short animated fall that
  responds to hit direction and settles into a stable pose. Prefer this over a
  new full physics ragdoll system. Use trusted impact direction when available;
  research the minimum authoritative pose signal or a deterministic fallback
  when it is unavailable. Visual settling never delays authoritative death.

### Carried-forward constraints and implementation discretion
- Keep the accepted near-future human proportions, fitted armor, visible face,
  painted comic surfaces, intensive black contours and localized team accents.
- Call of Duty-inspired responsiveness is the movement reference. New movement
  rules are Phase 5 work; current simulation remains the position/root authority.
- Keep weapon/action permissions and timing explicit and consistent across
  player, offline bots and supported online actors. Client cosmetics cannot
  invent health, hits, ammunition, actions or server movement states.
- Choose clip sources, retargeting/blending, mask/IK mechanisms and first-person
  presentation architecture through source-backed research. Select verified
  reusable motion or original authored motion; inherited asset terms remain
  unresolved until evidenced. Phase 6 visual acceptance is not license clearance.
- Damage-reaction intensity was not separately selected. Propose restrained
  cosmetic reactions consistent with steady ADS; preserve gameplay aim/health
  authority and expose the result for visual review.
- Actual game motion/transition review is required. Static poses and passing
  angle metrics alone cannot establish natural grips or smooth movement.
- Preserve prefix-aware loading and playable fallbacks. Measure animation and
  resource costs on the actual review setup; do not claim phone/iGPU/60 FPS
  qualification from headless SwiftShader or a one-actor static capture.
<!-- DATA_R7a19e2c_END -->

<!-- DATA_d8c0f614_START -->
## Deferred Ideas

- **Phase 5, requested behavior:** implement the two sprint levels and double-tap
  Shift supersprint, normal-sprint reload duration x1.15 and supersprint reload
  cancellation. Carry forward D-06/D-09 and the prepared Phase 7 poses. Choose
  actual speed, duration/stamina, double-tap/release behavior, mixed-stance reload
  timing and touch/gamepad mappings during Phase 5 discussion. Final alignment
  against actual omnimovement completes ANIM-01 there.
- Richer online weapon/equipment mechanics, broader cross-device and Pi
  qualification remain in their assigned later phases. Phase 7 animation must
  not masquerade as implemented or measured versions of those features.
<!-- DATA_d8c0f614_END -->
</user_constraints>

## Summary

Plan a shared presentation contract driven by current gameplay/snapshots, real first-person hands plus down-look body, weapon-specific handling, owned action cancellation, and a bounded editable motion pipeline. Keep Phase 6 → 7 → 5; future movement is preview-only. This is a planning recommendation implementing the copied decisions.

The principal verified gaps are hidden first-person body, separate camera gun geometry, incomplete action cancellation, divergent local/remote selection, and an art exporter that deliberately excludes new animations. Relevant source was opened this session; exact evidence follows. No runtime implementation or full suites were run during research.

## Project Constraints (from AGENTS.md)

Apply the repository directives: use tracked dependencies with npm ci; Vite serving and prefix-aware URLs; existing JavaScript modules and surrounding formatting; preserve synchronous event/ESM initialization order; never import browser singletons into server code; distinguish simulation seconds from millisecond weapon timers; restore simulation camera position after rendering; preserve procedural fallbacks, templates, painted materials and designated team accents. Keep animation root cosmetic, retain retarget/track-isolation preparation, and inspect real moving poses. Run Blender exports before browser suites and browser suites sequentially. Record actual review hardware/costs; software rendering does not certify device FPS. These are repository constraints, not new decisions. [VERIFIED: AGENTS.md, Project and tooling / lifecycle / animation / Phase 6 validation sections]

<phase_requirements>
## Phase Requirements

Descriptions copied verbatim. [VERIFIED: .planning/REQUIREMENTS.md:59-62]

| ID | Description | Research Support |
|---|---|---|
| ANIM-02 | Weapon/action animation supports ADS, firing, reload, melee, equipment use, damage, and death without broken grips, visible snapping, or unintended action overlap in first- and third-person views. | First-person presentation, handling sockets, cancellation and moving review |
| ANIM-03 | Animation stays consistent with authoritative posture and aim while visual blending/root motion does not move gameplay bodies independently of simulation. | Shared normalized presentation inputs, actual velocity, authoritative aim and generation ownership |
| ANIM-04 | A creator can import or retarget approved reusable motion onto the selected rig, regenerate runtime clips, and inspect transitions through the Blender-to-game review workflow. | Original reusable donor actions, explicit motion export and retained-source recovery |
| ANIM-05 | Repeated character spawn, replacement, and disposal retain shared templates and release instance-owned resources within the measured browser budget. | Existing disposal owner extended to view rigs, handling props and callbacks |
</phase_requirements>

## Architectural Responsibility Map

Recommended ownership:

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Health, ammo, supported action eligibility and reload deadline | Existing simulation / authoritative server | Client presentation | Presentation reads outcomes and cannot authorize mechanics |
| Locomotion, torso/feet turning, pitch and death settling | Browser presentation | Server-owned pose inputs | Bones follow simulation; visual offsets never move colliders |
| First-person arms, handling props and down-look body | Browser presentation | Editable asset workflow | Shared action phase, separate view-specific rendering |
| Motion provenance, import/retarget, export and recovery | Offline Blender/tooling | Browser review | Inspect editable sources and resulting game transitions |
| Template/instance lifetime and review measurements | Browser resource owner | Offline evidence | Dispose owned resources while live siblings remain usable |

## Standard Stack and Environment Availability

Keep existing versions; no new package installation is recommended. Opened lock entries quote **"version": "0.160.1"**, **"version": "8.0.8"**, **"version": "4.1.3"**, **"version": "1.59.1"** respectively. [VERIFIED: package-lock.json:3351-3355,3526-3531,3619-3624,745-750]

| Tool | Installed / selected | Availability evidence |
|---|---|---|
| Three.js | 0.160.1 (r160) | Installed metadata and source opened; registry release 2024-01-22 |
| Vite | 8.0.8 | Installed metadata; registry release 2026-04-09 |
| Vitest | 4.1.3 | Installed metadata; registry release 2026-04-07 |
| Playwright | 1.59.1 | Installed metadata; registry release 2026-04-01; Chromium executable exists |
| Node / npm | 24.19.0 / 11.17.0 | Executed version commands |
| Blender / bundled glTF exporter | 4.5.13 LTS / 4.5.51 | Executed pinned Blender version and RNA probes |

Registry publish dates were fetched from the authoritative registry for the installed versions; these are retained pins, not latest-version recommendations. [VERIFIED: registry.npmjs.org package metadata and executed environment probes]
Blender provenance quotes **"actualVersion": "4.5.13 LTS"**, **"buildHash": "daeeeca98fb0"**. Runtime creation is owned by **await fs.mkdir(runtime, { recursive: true });** and **const exe = path.join(runtime, 'blender-4.5.13-windows-x64/blender.exe');**. [VERIFIED: tools/art/provenance.json:3-8; tools/art/pipeline.mjs:135-138]
No missing execution runtime was found in the bounded probes. External paid/source-library access was not exercised; use original authored donor motion if unavailable. No package legitimacy gate is needed unless the planner introduces an external install.

## Confirmed Gaps and Architecture Patterns

1. **Real first person is new work.** Existing gun ownership quotes **camera.add(wpn);**; body visibility quotes **const bodyVisible = tpTransition > 0.05;** and **playerMesh.visible = bodyVisible;**. [VERIFIED: src/builders/weapon.js:15-19; src/loop.js:266-278] Recommend a view-specific arm/hand rig using the accepted human skin/materials, synchronized with a world-root body for torso/legs when looking down. Keep complete skeletal hierarchy when cloning; do not scale head/arm bones to hide surfaces. Separate view geometry/render selection from shared template geometry, and explicitly prevent duplicate arms/guns, head clipping, ink mismatch and shadow leaks. A second mixer is acceptable only with one shared action-phase owner and measured cost.

2. **Weapon handling needs articulated parts.** M4/P90/AWP/pistol groups are assembled from unnamed box/cylinder meshes; the existing P90 loader defaults to **path = import.meta.env.BASE_URL + 'models/FBX/P90.fbx'** and replaces only the first-person P90 children. [VERIFIED: src/builders/weapon.js:34-76,95-123,147-150; src/builders/weaponFBX.js:25-57] Add original named receiver/grip/support/magazine/bolt or slide parts and per-weapon handling metadata. Preserve the accepted silhouettes/materials; do not present moving the whole gun as a physical reload. P90 top-feed, M4 magazine/charging action, AWP bolt and pistol slide require different handling. Specific phase markers and contact tolerances are implementation/review choices, not verified mechanics.

3. **Cancel actions at gameplay entry.** Throw entry currently writes **player.throwingNade = true;** and **pendingThrow = true;** without clearing reload/aim; melee entry writes **player.punching = true;** and schedules damage with **}, 350);**. Reload completion awards **player.ammo += take;**. [VERIFIED: src/entities/grenades.js:21-29; src/main.js:232-243; src/entities/player.js:289-300] Recommend one explicit cancellation path for supported offline melee/throw: clear ADS/reload eligibility and owned timers/phase props immediately; cancel pending release on death/menu/respawn/replacement. Suppress re-entry from held ADS during an exclusive action. Canceled reload must never award ammunition; cancellation must invalidate stale damage/release callbacks, not only hide the gun. Existing throw release remains simulation-ticked, once-only; keep its ownership. [VERIFIED: src/entities/grenades.js:31-37,57-65]

4. **Unify presentation inputs, not game authority.** Local selection quotes **const sprint = keys['ShiftLeft'] || keys['ShiftRight'];** and **const speedN = sprint ? 1.0 : 0.45;**; remote selection instead computes snapshot velocity and directly rotates **actor.mesh.rotation.y = p.yaw + actor.facingOffset;**. [VERIFIED: src/loop.js:146-195; src/network/remoteActors.js:59-67,113-174] Build pure normalized presentation inputs from actual displacement/stance/aim/action window for local, bots and remote. Project velocity into actor-local forward/right axes; do not derive cadence from key-down while blocked. Use measured/authored cycle speed, bounded playback scaling and synchronized foot phase; reset velocity history on spawn/teleport/generation changes. Torso aim offset should lead a bounded visual feet heading, with authored turn/stop contact phases. Apply pitch in the actor's rest-aware frame after base mixing; never write simulated yaw/position from pose correction.

5. **Online support is bounded.** Exact accepted intent list quotes **'fire', 'reload', 'sprint', 'jump', 'crouch', 'aiming', 'neutral'**. Snapshot posture includes **yaw**, **pitch**, **alive**, **lifeGeneration**, **moving**, **crouching**, **onGround**, **verticalVelocity**, **aiming**, **sprinting**, **reloadRemaining**. [VERIFIED: src/shared/protocol.js:11-19; server/tdmRoom.js:17-35] Current local online adapter quotes **reloadTotal: 1800**; remote fitting quotes **fitActionDuration(actions.reload, 1.8);**. [VERIFIED: src/network/onlineSession.js:440-455; src/network/remoteActors.js:152-156] Retain the accepted online timer. Supersprint, double Shift, new slide/dive/prone authority and x1.15 gameplay reload timing belong to Phase 5; preview interfaces must not send unsupported intentions. Remote firing and directional death need a trusted visual cue or explicit fallback, not invented network states.

6. **Directional death has an available server seam.** Projectile death calls **sim.onDeath(target, b);** before event staging; event data includes **impact**, **killed**, actor/match/life identities. [VERIFIED: src/shared/combat.js:168-210] Recommend a minimal server-owned cosmetic death direction/variant retained for the current life and cleared on respawn/rematch, derived from trusted projectile travel at lethal impact. All observers need the same cue; shooter-private confirmation alone is insufficient. If unavailable, choose a documented deterministic stable fallback from existing authoritative actor orientation. Do not infer historical impact from a killer's later position. Death eligibility/score changes immediately; the collapse only settles visually.

7. **Resource lifetime already has an owner.** Disposal quotes **mixer?.stopAllAction();**, **mixer?.uncacheRoot(root);**, and **for (const skeleton of skeletons) skeleton.dispose();**; template registration quotes **sharedGeometry.add(node.geometry)**. [VERIFIED: src/builders/characterResources.js:23-49] Extend that owner to view rigs, masks/IK caches, props, event listeners and pending action callbacks. Test disposal twice, sibling survival and later cloning. Do not dispose shared packed maps or templates, and do not reparent a singleton weapon into a retiring clone without detaching/owning it.

## Motion Authoring, Export and License Boundary

**Implementable recommendation:** author reusable original keyed donor actions from neutral/rest poses in a retained editable Blender source, then append/import onto the accepted target rig. Demonstrate at least one reusable donor import/retarget and its actual transitions. Keep an inspected deterministic script, per-action metadata, source hashes and editable-source recovery. Do not merely rename inherited actions as original motion.

The existing retarget implements world-space rest delta and parents-first processing, clears unwanted translations and horizontal travel. Preserve this formulation when importing a genuinely different rig; verify forward/up/unit/rest conventions before baking. [VERIFIED: tools/retarget.py:79-149] Baking grips/foot contacts offline is the first implementation route; introduce bounded runtime correction only if moving review shows it necessary.

**Publication gap:** current source export explicitly quotes **export_animations=False**; its Node wrapper calls **await preserveCompatibility(raw, path.join(CACHE, 'baseline.glb'), output);**, and that merge starts with **const j = structuredClone(base.json)**. [VERIFIED: tools/art/build_soldier.py:56-59; tools/art/pipeline.mjs:212-224; tools/art/inspect-character.mjs:364-437] Add a separate bounded motion export/append path: protect accepted mesh/material/image/skin semantics and inverse binds, preserve untouched inherited action occurrences, deliberately allow only manifest-listed original additions/replacements. Existing exact-motion checks must stay meaningful; globally disabling them would conceal corruption. Reopen the saved editable candidate, independently regenerate it, compare semantic domains, inspect in-game, then atomically publish.

Pinned Blender RNA probe returned export modes **ACTIONS, ACTIVE_ACTIONS, BROADCAST, NLA_TRACKS, SCENE**, action slots present on Action RNA, and exporter version **4.5.51**. [VERIFIED: executed Blender 4.5.13 RNA probe] The 4.5 manual explains active/stashed actions and slots; do not assume old action enumeration exports every new clip. [CITED: https://docs.blender.org/manual/fr/4.5/addons/import_export/scene_gltf2.html] Validate resulting clip names, target bones, sampling, finite transforms, loop seams and release/contact phases in the candidate GLB.

Asset evidence remains separate:
- Quaternius Universal Animation Library pages explicitly identify CC0, humanoid retargeting and a source .blend edition. Exact free-archive contents, source-edition access and required clip compatibility were not inspected; these are qualified candidates, not installed/approved binary inputs. [CITED: https://quaternius.com/packs/universalanimationlibrary.html] [CITED: https://quaternius.com/packs/universalanimationlibrary2.html]
- Adobe FAQ permits royalty-free game use; it does not establish provenance/redistribution rights for these existing repository raw sources. [CITED: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html]
- The ledger explicitly quotes **"disposition": "unresolved"** for inherited compatible rig/mannequin motion, Mixamo motion and weapon FBX. [VERIFIED: tools/art/provenance.json:109-138] Newly authored motion does not clear the combined inherited rig or weapon assets.
- Blender's own output policy supports original authored work; it does not grant third-party input rights. [CITED: https://www.blender.org/about/license/?es_p=4059497]
- Canonical Phase 6 UAT records **reported: "pass all tests and proceed"** and two human passes; older pending-aesthetic strings in historical art ledgers must not override that acceptance. [VERIFIED: .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-UAT.md:15-27] Phase 7 still requires its own moving aesthetics review.

## Don't Hand-Roll / Common Pitfalls / Code Example

Use Three's existing mixer/action APIs, full-hierarchy SkeletonUtils clone and the current disposal owner. Do not add a physics ragdoll, global quaternion corrections, a new animation framework, or client-authorized mechanics. Track-filtered masks must include only intended bones and maintain a contributing base pose. Existing aliases can refer to one AnimationAction, so deduplicate by action identity. [VERIFIED: src/builders/enemyAnimations.js:174-187,268-315; src/builders/enemyGLTF.js:37-61]

Source pattern, quoted verbatim:
<!-- DATA_b572e10f_START -->
```js
export function fitActionDuration(action, seconds) {
  if (action && seconds > 0) action.setEffectiveTimeScale(action.getClip().duration / seconds);
}
```
<!-- DATA_b572e10f_END -->
[VERIFIED: src/builders/enemyAnimations.js:218-221]
Fit normalized visual phase to the simulation window; animator completion events never award ammo or cause grenade damage. If an action resumes visually, restore its current simulation phase rather than frame zero. [VERIFIED: src/loop.js:205-214]

Pinned Three implementation confirms stop/reset/fade semantics and clone rebinding; installed source was also opened. Do not assume playing an action re-enables a completed fade. [CITED: https://raw.githubusercontent.com/mrdoob/three.js/r160/src/animation/AnimationAction.js] [CITED: https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/utils/SkeletonUtils.js]

## Runtime State Inventory

This is a presentation refactor with candidate asset publication, not a datastore rename. Bounded inventory: editor/local preferences remain untouched; no database migration proposed. External service configuration, OS registrations and secrets were not audited because no rename/deployment change is proposed; require explicit audit if scope changes. Browser instances, callbacks, mixers and templates must retire through their owners. Generated GLB/build/review artifacts must be regenerated from retained source; stale cached exports are not proof of new motion. [VERIFIED: inspected lifecycle and export code cited above] No absence of external runtime state is claimed.

## Validation Architecture

Nyquist and security are enabled in inspected config. Existing test infrastructure: Vitest 4.1.3 and Playwright 1.59.1; browser suites share their output location and run sequentially. [VERIFIED: .planning/config.json, workflow; package-lock.json version quotes above; playwright.config.js and playwright.multiplayer.config.js]

Commands below use existing project CLIs; new test cases/files are **Wave 0 work**, not claims of existing coverage. Pure-helper checks target a sub-30-second task feedback loop; execution must measure actual duration. Browser/export gates are longer and must not be advertised as sub-30-second checks.

| Requirement | Meaningful checks and negative cases | Automated command / gap |
|---|---|---|
| ANIM-02 | Cancellation before/at/after reload deadline; held ADS suppression; exactly one throw release; stale melee callback after death/menu; each weapon's contact/parts; 1P hands and down-look body | Extend unit/action helpers and animation browser cases. Existing baseline: `npx vitest run src/builders/enemyAnimations.test.js`; `npm run test:e2e -- tests/animation-regressions.spec.js --workers=1` |
| ANIM-03 | Local/bot/remote same normalized inputs; blocked movement has stationary cadence; backward/diagonal movement; pitch extremes and turn threshold; identical simulation roots before/after pose/render; forged unsupported intents; generation resets | Extend `src/network/remoteActors.test.js`; `npx vitest run src/network/remoteActors.test.js src/shared/protocol.test.js`; `npm run test:mp -- --grep "movement:|authority:"` |
| ANIM-04 | Fresh pinned Blender reopen; original donor append/retarget; missing/duplicate action, slot, malformed target, NaN, wrong rig, root travel and unchanged-motion exporter negative controls; independent regeneration and editable recovery | Existing checks: `node tools/art/inspect-character.mjs --self-test`; `node tools/art/pipeline.mjs self-test`; `node tools/art/verify-export.mjs --repeat`. Add motion-aware candidate/export self-test and reopen command before implementation; existing Phase 6 repeat alone cannot validate new motion |
| ANIM-05 | Repeated view/weapon/actor replacement, double disposal, live sibling rendering and new clone after retirement; owned listener/timer count returns to baseline; warmed geometry/texture/program plateau | `npm run test:e2e -- tests/animation-regressions.spec.js tests/character-art.spec.js --grep "resources:|repeated character removal" --workers=1`; `npm run test:mp -- --grep "resources:"` |

Existing regression source actually tests throw-marker cancellation, action duration and shared-geometry survival. Existing art-resource test warms then compares geometry/texture/program counts with a live keeper. Existing online resource test deliberately avoids exact total-geometry equality because map rebuild randomizes rubble. Preserve that distinction. [VERIFIED: tests/animation-regressions.spec.js:101-196; tests/character-art.spec.js:513-555; tests/multiplayer.spec.js:692-726]

**Wave 0:** add pure presentation/action policy tests, camera/view ownership tests, trusted cosmetic signal tests if added, and motion-export rejection fixtures. Make the exporter interface/commands concrete in the plan before execution. Extend real-game tests through normal asset loading; Node animation texture mocks cannot validate visible first-person paint/contact.

**Sampling:** per task, focused helper tests and relevant exporter self-test; per wave, affected real browser/export checks; phase gate, lint, root/MP type checks, build, all unit tests, then offline browser and production multiplayer suites sequentially. Run `node tools/art/pipeline.mjs iterate --demo` and `node tools/art/verify-export.mjs --iteration` after accepted art/recovery changes. These are future execution gates, not research-run results.

**Human and cost review:** play actual moving transitions in 1P/3P at all quality tiers: ADS raise/settle, all supported reloads, two-handed sprint, landing/turning, melee/throw interruption, damage/death and future-pose preview. Capture full pixels/recordings with source/export identities. Measure warmed mixer/IK/frame cost and allocation trends with multiple actual actors on the review setup. Numeric tolerances, actor count and performance budget need a measured baseline; no universal FPS claim. Agent pose metrics cannot record human acceptance. [VERIFIED: AGENTS.md, Phase 6 review constraints; copied D-01–D-11]

## Security Domain

Use **ASVS 5.0** numbering, not the older generic template: V2 Validation and Business Logic; V5 File Handling for local asset/path boundaries; V6 Authentication/V7 Session Management only insofar as existing membership/life ownership; V8 Authorization for server-controlled mechanics; no new cryptography design. [CITED: https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md] [CITED: https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x17-V8-Authorization.md] [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.xml]
Plan negative tests for spoofed cosmetic directions/actions, stale life/match cues, unlimited cue growth, escaped candidate paths and autoexecuted Blender source. Keep pose cues server-owned/read-only, bounded and generation-scoped; trusted authoring uses factory startup and disabled autoexec. [VERIFIED: tools/art/pipeline.mjs:198-210; src/shared/protocol.js:43-80]

## Assumptions Log and Open Questions

| Item | Status / planning response |
|---|---|
| Runtime contact correction or full-body-only 1P will meet D-02 | [ASSUMED] Until actual moving camera/hand review; use the hybrid view recommendation and compare visibly |
| Numerical anatomical/contact/turn/latency tolerances and browser budget | [ASSUMED] Set from a measured current baseline and acceptance captures; do not invent locked thresholds |
| Quaternius free/source edition contains needed qualified clips | [ASSUMED] Archive/access not inspected; original reusable keyed donor is the implementable fallback |
| Original donor quality is sufficient without mocap | [ASSUMED] Implementation must review gait/contact/transition quality and iterate; provenance alone does not establish aesthetics |
| Inherited rig/motion/weapon terms | Explicitly unresolved ledger; retain honest combined-asset boundary, no invented clearance |
| Death and remote firing cue shape | Plan the smallest server-owned presentation-only signal or deterministic fallback; existing schema does not provide the proposed new cue |
| Phase 5 sprint timing during mixed stance, stamina and input mapping | Deferred user scope; Phase 7 exposes inspectable phase/pose interfaces only |

## Sources and Metadata

Primary sources are the opened repository definitions above, installed Three source, executed Blender 4.5.13 RNA, authoritative registry metadata and linked official author/tool/security pages. Documentation fetch fallback used official web results because Context7 MCP/CLI were unavailable. Several full Blender page fetches returned tool errors; versioned official search excerpts plus executable RNA were used, not claims that pages lacked features. Research-plan questions and digests were cached through the GSD seam. Confidence seam returned **MEDIUM** for cross-checked websearch; retain MEDIUM for external guidance. Code findings are tool-confirmed source observations; proposed architecture and aesthetics still need implementation evidence.

Standard stack: MEDIUM (installed pins cross-checked). Architecture: MEDIUM (current source and locked choices; recommended implementation unbuilt). Pitfalls: MEDIUM (actual lifecycle/export gaps and pinned API evidence). Valid until source/tool changes; recheck external asset access/terms at acquisition. No source changes, asset downloads, full suites or commits were performed for this report.

