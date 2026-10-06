---
phase: 07-movement-matched-and-action-safe-animation
plan: "05"
subsystem: animation
tags: [actual-displacement, authoritative-posture, masked-actions, planted-turns, stable-death]
requires:
  - phase: 07-03
    provides: Original directional clips, copied prepared buffers and stride/contact metadata
  - phase: 07-04
    provides: Simulation-owned exclusive action clock and generation retirement
provides:
  - Pure finite normalized movement/action presentation with identity and discontinuity resets
  - Shared local, offline-bot and authoritative snapshot rig driver
  - Copied upper/lower masks with contributing locomotion, contact turns and controlled death
  - Actual loaded-rig, action-lifecycle and production multiplayer regression evidence
affects: [07-06, 07-07, 07-08, 07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Displacement-derived cadence, Read-only simulation phase, Identity-deduplicated copied masks, Parent-space rest-aware correction]
key-files:
  created: [src/builders/animationPresentation.js, src/builders/animationPresentation.test.js, tests/animation-presentation.spec.js]
  modified: [src/builders/enemyAnimations.js, src/builders/enemyAnimations.test.js, src/loop.js, src/entities/enemyUpdate.js, src/entities/friendlyBots.js, src/network/remoteActors.js, src/network/remoteActors.test.js, src/network/onlineSession.js, tests/animation-regressions.spec.js]
key-decisions:
  - "Use actual displacement and simulation/snapshot phase for all actor families; pose never changes roots, eyes, aim or outcomes."
  - "Keep unsupported remote firing quiet and collapse forward in the existing authoritative body heading when trusted impact direction is absent."
  - "Copied action masks preserve source aliases and buffers; inspect actual contributing tracks rather than inactive source-action rates."
requirements-completed: [ANIM-02, ANIM-03]
coverage:
  - id: D1
    description: Current movement, posture, action clocks and stable death preserve gameplay authority
    requirement: ANIM-03
    verification:
      - {kind: unit, ref: "src/builders/animationPresentation.test.js", status: pass}
      - {kind: unit, ref: "src/network/remoteActors.test.js", status: pass}
      - {kind: e2e, ref: "tests/animation-presentation.spec.js", status: pass}
      - {kind: e2e, ref: "npm run test:mp -- --grep movement:|authority:", status: pass}
    human_judgment: false
  - id: D2
    description: Current masked action tracks retain locomotion and observe supported gameplay windows
    requirement: ANIM-02
    verification:
      - {kind: unit, ref: "src/builders/enemyAnimations.test.js", status: pass}
      - {kind: e2e, ref: "tests/action-lifecycle.spec.js", status: pass}
      - {kind: e2e, ref: "tests/animation-regressions.spec.js", status: pass}
    human_judgment: false
  - id: D3
    description: Natural contact, full transition quality and first-person handling after subsequent integration
    verification: []
    human_judgment: true
    rationale: Secure grips remain mandatory in07-06/07-07 and WINDOWS34; moving human acceptance and the additional07-09 two-client matrix remain pending.
actuals:
  tokens: 19079
  tasks: 3
  commits: 6
plan_head_before: a4fa86931d0c2a1210748fb308adf8ca8887e505
plan_head_after: e2ebd54c6857d467578e8f41f1dfc862a10c6359
duration: approximately 42min including initialization and fixture diagnosis; first RED at06:14:07Z
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 5: Shared Actual-Motion Presentation Summary

**Local bodies, offline bots and online snapshots share displacement-matched directional feet, copied action masks, bounded torso correction and a stable 0.65-second death presentation.**

## Performance

- Three tasks, twelve deliverable files. Initialization began approximately06:06Z; first RED committed at2026-10-06T06:14:07Z; closeout approximately06:48Z. Wall time includes fixture diagnosis and contended software-renderer browser work.
- Actual tokens are ceiling(76,313 realized Git diff characters/4). Six measured production/TDD commits exclude summary/state metadata. Main-checkout sequential execution used the coordinator's temporary protected-branch override, root pin and process-local safe.directory; no branch/worktree/reset/stash, package install or unrelated process mutation occurred.
- Short actual-rig observation at2026-10-06T06:45:34.329Z: twelve direct driver steps, one actor, Windows HeadlessChrome147.0.7727.15,800x600,DPR1, reported WebKit WebGL/SwiftShader launch policy. Median0.100ms,p950.200ms are timer-limited correctness observations. This is **not** the matched warmed baseline instrument, whole-game FPS or device certification. The canonical twelve-profile baseline and budget were not changed or rerun.
- Retained short observation: `.planning/research/.cache/07-05-driver-observation.json`. Later matched budget/resource qualification belongs to07-09/07-10.

## Accomplishments

- `normalizePresentation`, `samplePresentation` and `createPresentationHistory` have no scene, DOM or executable gameplay markers. They bound finite inputs, project actual displacement into body-local forward/right axes and reset first samples, identities/generations, teleports, time/tick regression, long discontinuities and invalid observations. Repeated current snapshots preserve measured velocity without replaying health cues.
- Directional walk/run/crouch and backward/diagonal weights share manifest cycle displacement2.4/3.1/1.65m and left/right contact phases0/0.5. Travelling cadence is zero when blocked, bounded at4.5cycles/s otherwise. Stop/reversal transitions use authored0.4s contact phases. Normal sprint retains two-handed upper carry; no supersprint/slide/dive/prone gameplay or15%-longer reload rule was added.
- Stationary feet hold heading while torso leads small turns. Foot-turn entry0.42rad precedes the authored0.7rad twist limit; the0.4s turn plants atphase0.25 and reaches recontact0.85. Pitch is bounded to1.1rad, with a0.55 spine share. These are implementation bounds for later moving review, **not human-accepted anatomical/contact tolerances**. Jump start/landing read0.32/0.38s simulation windows. Default pose settling uses the160ms policy with current action phase taking priority.
- Lower locomotion and upper reload/fire/ADS/sprint use copied, disjoint tracks, deduplicated by source AnimationAction identity. Immutable source aliases and shared track buffers remain intact. Order is restore previous correction → mixer → parent-space/rest-aware pelvis/spine correction → inertia. Neither this order nor masks write simulated roots, colliders, camera eyes or aim.
- Offline local throw/melee read the07-04 owner's callback-free generation/phase; reload converts milliseconds to seconds, roll keeps its existing seconds, and actual offline shot timestamp supplies fire phase. Bots measure actual simulation displacement, role, muzzle/stun/health observations and posture. They invent no ammunition/reload clock. Friendly and hostile presentation now samples current placement/heading.
- Online local and remote adapters whitelist existing server fields, usecurrentTick/30 and connection/match/life identity, and keep M4 reload exactly1.8s. They ignore forged action/weapon/shot/direction fields. Health loss is a once-only current-tick cosmetic observation. Remote firing stays weapon-ready without a trusted shot cue; private shooter confirmation is never victim direction. Presentation continues through unlock, death and results.
- Death immediately cancels source and copied-mask bindings plus breathing/flinch, completes over0.65s and holds. Four trusted impact directions are supported in isolated real-rig fixtures; actual available bot/remote deaths use a forward collapse in the existing body heading, identified as`body-heading-fallback`. Replacement clears old bones, masks, history and settled phase. Reduced-motion suppresses breathing/flinch, without changing required action or eligibility clocks.

## Task Commits

1. Task07-05-01 RED: `e95739d` — planted actual-motion regression.
2. Task07-05-01 GREEN: `0418681` — local displacement/phase driver and copied masks.
3. Task07-05-02 RED: `ec84473` — teleport velocity regression.
4. Task07-05-02 GREEN: `100a218` — authoritative snapshot posture/reload adapters.
5. Task07-05-03 RED: `e896e88` — masked locomotion competing with death.
6. Task07-05-03 GREEN: `e2ebd54` — bot current motion, cache retirement, stable death and played-track regressions.

## Checks Run

- Final focused unit command covering presentation, masks, lifecycle, remote actors and exact protocol: **55/55 passed in5files,351ms**. This includes existing tests; it is not55 newly added cases.
- Local tracer: **18/18 units and2/2 real-browser cases passed before expansion**; after task1 commit, feedback rerun passed18units299ms and2browser11.1s. Blocked real terrain, loaded directional bones, current reload phase and unchanged root/eye/aim are covered.
- Final new presentation suite: **4/4 passed,15.5s**. Actual shipped GLB/packed maps load through enabled Training Range on an owned free listener; tests exercise bot muzzle/damage, new-rig bone ownership, four directional deaths, actual kill eligibility and stable held pose. Short observation retention rerun passed1/1,5.9s.
- Existing action lifecycle suite: **20/20 passed** in the combined browser run. The initial30-case combined run passed those20 plus all4new presentation cases; five legacy cases failed on the shared prefixed5173 fixture. No failed result was treated as a pass.
- Existing animation regressions on an owned root-base listener: **6/6 passed,28.8s**. Menu return, death layers, real-rig weapon basis, GPU ownership and grenade simulation marker are retained. The live timing test now observes actual scheduled/weighted copied tracks and their time/duration against the player's remaining reload/roll/throw clocks; it also requires contributing lower-body tracks.
- Production multiplayer unchanged movement/authority regression: **2/2 passed,2.1m**, including authority1.5m and movement35.4s. The first run exposed a new join-time optional collection read; after its guard was corrected, both cases passed. No server/schema/timer changes were made.
- Final lint, root typecheck, multiplayer strict typecheck, production build343ms and diff whitespace checks passed. Existing>500kB chunk warning remains. Browser suites ran sequentially; own output directories and OS-temp production fixtures were used.5173 was not stopped/reconfigured, and unrelated external browser work was untouched.

## TDD Gate Compliance

- Task1 RED: stationary lateral intention produced idle0.5/lateral0.5 instead of planted idle1. Actual blocked-terrain browser also reproduced travelling animation with negligible eye displacement. The persisted unit record `.planning/research/.cache/07-05-local-red.json` required TAP normalization; SDK`RED_EVIDENCE_OK` was established before production implementation.
- Task2 RED: a20m teleport produced600m/s instead of reset0. `.planning/research/.cache/07-05-remote-red.json` passed the SDK gate before GREEN.
- Task3 RED: a copied lower mask remained active after death, blending pelvis5 instead of8. `.planning/research/.cache/07-05-bot-red.json` passed the SDK gate before GREEN. Death now cancels the entire owned mixer set and holds the final pose.
- All three tasks have RED before GREEN. No refactor-only commit was needed. All plan verification commands ran; no test/verification was skipped or waived.

## Deviations from Plan

1. **[Rule1 - Bug] Guard the newly added online-local collection read during initial SDK patch.** The first production run showed a TypeError stopping RAF/HUD while authority kept progressing. Optional collection access corrected it in`100a218`; WINDOWS35 is fixed.
2. **[Rule1 - Ownership] Cancel private copied actions and invalidate cached bones/masks when a mixer is replaced.** Source alias enumeration cannot retire private masks; a replacement fixture also found old bones retained. The mixer guard and death cancellation corrected both in`e2ebd54`; WINDOWS36 is fixed. `enemyAnimations.test.js` was necessarily extended beyond the initial file list to prove these invariants.
3. **[Rule2 - Required current posture] Move the friendly bot animation call after its existing mesh placement/heading.** The unlisted`friendlyBots.js` previously corrected bones using last frame's root basis. This small order adjustment preserves AI/simulation and matches the hostile path, in`e2ebd54`; WINDOWS37 is fixed.
4. **[Rule1 - Regression compatibility] Adapt the legacy live controller assertion to actual played masks.** Inactive source-action rates no longer describe current sampled presentation. Authorized`animation-regressions.spec.js` now checks scheduled weighted track time, live gameplay phase, physical arm tracks and contributing base. In`e2ebd54`; WINDOWS38 is fixed. The owned temporary Playwright config also pins cwd/port across worker reloads; initial fixture-only failures are not behavioral RED evidence.

## Interfaces for Following Plans

- `tickPresentation(actor, raw, dt, updateMixer=true)` stores the frozen normalized sample as`actor.presentation`. Actor owns mesh/mixer/actions; history and copied-mask cache belong to that mixer generation. `finishPresentation` applies the documented mixer/correction/inertia order. `inspectPresentationLayers` returns scalar clip/time/weight/track observations without exposing bindings.
- Local observation: `window.__presentationDebug()` returns a structured copy of pose plus actual contributing layer observations. Remote frozen MP diagnostics expose speed/current reload phase/upper state/feet/pitch/death fallback/settled values. Neither is a gameplay command interface.
- Masks remain actor-owned mixer resources; existing stopAllAction/uncacheRoot disposal covers their bindings.07-09 must verify complete resource/budget behavior after handling/view integration.
07-09's added two-real-client matrix remains required: same snapshot currentTick/posture/yaw/pitch and roots; blocked/back/diagonal/crouch/sprint gait; late reload receipt and unlock; forged unsupported cues; once-only health reaction/repeated snapshots; immediate death with stable0.65s hold; fresh life/match/connection reset; quiet remote fire without invented cue; unchanged M4 inventory/deadlines/private outcomes. Existing production regression here does not substitute for that matrix.

## Known Stubs and Threat Review

No new placeholder, skipped test, executable pose marker or unsupported authority adapter remains. Null histories/empty owned caches are real lifecycle state. No network endpoint, auth path, schema, external package or outcome permission was added. The plan's root/outcome, stale-cue and shared-buffer threats have focused negatives.

Existing WINDOWS34 remains **open**: inherited open finger chains and support-grip fit must be corrected in07-06/07-07. This plan does not claim accepted secure grips, first-person handling or human natural-motion quality.

## Next Phase Readiness

Shared presentation is ready for handling/view/review/resource integration. SDK requirement readiness returned0/2: ANIM-02 and ANIM-03 remain pending in REQUIREMENTS.md until phase verification. The frontmatter copies this plan's assigned IDs as required; it is not shared requirement closure. ANIM-03/unclassified remains a manual-review assumption. Torso/foot/contact quality and numerical thresholds remain ASSUMED until moving evidence and human review. Phase5 owns actual omnimovement, new sprint input and reload timing/cancellation rules; online M4 remains1800ms. Inherited redistribution terms remain unresolved.

## Self-Check: PASSED

All twelve deliverable files and all six listed production/TDD commits exist. The measured ledger base/head/count match this frontmatter; no tracked deletion occurred. Final focused units, new/legacy/lifecycle browser checks and production regressions passed. Checks Run records the complete verification history. Canonical baseline/budget identities and prior03/04 source/recovery facts remain unchanged.
