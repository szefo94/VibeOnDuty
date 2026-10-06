---
phase: 07-movement-matched-and-action-safe-animation
plan: "09"
subsystem: animation
tags: [resource-ownership, authoritative-generation, first-person, measured-cost, checkpoint]
status: blocked
requires:
  - phase: 07-08
    provides: Isolated actual actor/view review owner and phase-driven handling
provides:
  - Generation retirement and exception-safe resource cleanup with actual two-client evidence
  - Qualified three-tier actor/view/review ownership gates and twelve full-view cost profiles
  - Explicit budget_contract checkpoint preserving the immutable legacy envelope
affects: [07-10, ANIM-02, ANIM-03, ANIM-05]
tech-stack:
  added: []
  patterns: [Cleanup-all deferred disposal error, Current-generation view reset, Main-camera draw qualification]
key-files:
  created:
    - tests/animation-resources.spec.js
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-cost-report.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-world-skeleton-assessment.json
  modified: [src/builders/characterResources.js, src/builders/firstPersonRig.js, src/builders/enemyAnimations.js, src/network/onlineSession.js, src/network/remoteActors.js, src/dev/animationReview.js, tests/action-lifecycle.spec.js, tests/multiplayer.spec.js, tools/art/review.mjs]
key-decisions:
  - "Retire callbacks and view handling before online generation replacement; complete cleanup before reporting owner failures."
  - "Actual source-eye view costs are not comparable to the legacy external-camera workload; preserve strict legacyBudgetPass false and every absolute frame-limit flag."
  - "Keep world skeleton sharing as a measured candidate for root review; no optimization or numerical envelope amendment was applied."
requirements-completed: [ANIM-02, ANIM-03, ANIM-05]
requirements-status: pending
coverage:
  - id: D1
    description: Actual online reload/death/fresh-life, movement, attacks, feedback, rematch and connection retirement
    verification: [{kind: e2e, ref: "tests/multiplayer.spec.js#animation authority:|resources:|animation retirement:", status: pass}]
    human_judgment: false
  - id: D2
    description: Offline action and actual actor/view/review resource retirement with shared survival
    verification: [{kind: e2e, ref: "tests/animation-resources.spec.js and tests/action-lifecycle.spec.js", status: pass}]
    human_judgment: false
  - id: D3
    description: Twelve actual full-view profile measurements with independent draw and pixel evidence
    verification: [{kind: integration, ref: "evidence/07-09-cost-report.json", status: pass}]
    human_judgment: false
  - id: D4
    description: Legacy fixed-budget acceptance and final moving appearance
    verification: [{kind: integration, ref: "evidence/07-09-cost-report.json#comparison", status: fail}]
    human_judgment: true
    rationale: Fixed old numeric acceptance remains unmet/noncomparable; root comparison-contract review and human motion judgment are pending.
actuals:
  tokens: 51234
  tasks: 1
  commits: 4
plan_head_before: b64b594c5316fba4d3e19d04314618e726d458b1
plan_head_after: e0f78d7f8bfad3432f758a727e96b8f175921b83
duration: approximately 100min through budget checkpoint
completed: null
---

# Phase 7 Plan 9: Retirement and Measured View Cost Checkpoint

**Actual online generations and real offline view/review resources retire safely; the full-view cost matrix is qualified, while the fixed legacy budget contract remains open.**

## Execution Position

Task 1 is complete. Task 2's ownership, browser and measurement work is qualified, but its required legacy-envelope acceptance is **not complete**. This is a `budget_contract` checkpoint, not PLAN COMPLETE. Assigned requirement IDs in the frontmatter do not mark requirements accepted. STATE remains on plan 9; ROADMAP and requirements must not advance from this checkpoint.

The first RED commit is timestamped 2026-10-06T15:13:21Z; mandatory context loading preceded it. Execution reached this checkpoint on 2026-10-06 after approximately 100min including context reads, sequential browser gates, measurement pilots and capture. Twelve production/test/evidence files changed. Actual tokens are ceiling(204,936 realized Git diff characters / 4), including the canonical detailed cost report. Four commits are measured from the persisted plan ledger; metadata commits follow separately.

## Qualified Work

- `disposeCharacter()` invalidates first, runs every owner callback, unbinds the mixer, detaches and disposes owned geometry/materials/textures/skeletons before reporting an AggregateError. Double disposal never replays work. Actual RED stranded a scene-attached clone with 21 active bindings; GREEN retires the later callback and all bindings once.
- Online API entry, leave and connection/match/life replacement cancel offline actions and reset local view/handling before replacement. The original server owns health, ammunition, movement, death and results. Frozen `__mpDebug()` adds scalar generation/root/pose observations, with no room/state mutation API. Remote retirement clears presentation references first; shared buffers/maps survive.
- Copied gun materials flagged actor-owned/tinted are cloned into the view. Actual RED disposed a live source's material on view retirement, then disposed it again on source retirement; final GREEN records zero source disposal events until source retirement, then exactly one. Geometry fixtures own their clones as well.
- Copied mask/bone/history caches register their lifetime with the character owner. View source-disposer unregistration releases the live source's reference to retired proxies. Review Close restores the caller in finally even when disposal reports an error. Real delayed load/selection/Retry/Close races retain the current actor and dispose stale actors without restoring stale state.
- All three tiers exercise eight deterministic one/eight-actor/view retirement cycles, live keeper and later clone, actual disposal events, source buffers unchanged, exactly 65 shipped skin joint strings and 107 clip occurrences with all 59 exact manifest additions. Required arm/body triangles remain present at Low. Actual owned resources retire once, callbacks/bindings/caches retire, and shared geometry/maps emit zero disposal events.
- Two real M4 browsers exercise remaining 1.8s reload phase, immediate `death_front`, settled body-heading fallback and authoritative fresh life; blocked/directional motion, pitch, stance, sprint, air/landing and currentTick/30; bounded malformed/unsupported/repeated/stale-life wire rejection; private feedback, rematch, Retry and leave/rejoin. Test-only transport/feedback instrumentation adds no production mutation hooks.

## Commits and TDD

1. `bca7619` — Task 1 RED resource failure and real production tracer.
2. `b3f8bde` — Task 2 RED source-material retirement.
3. `948657c` — Qualified generation retirement, cleanup and view material ownership.
4. `e0f78d7` — Qualified retirement expansion, actual view measurement and canonical checkpoint evidence.

Both persisted RED records passed SDK `RED_EVIDENCE_OK`: `.planning/research/.cache/07-09-tracer-red.json` and `07-09-view-red.json`. The source-material RED was prepared while the final Task 1 matrix was running; commit order is recorded explicitly. No refactor-only commit was necessary. Task 2 budget acceptance is not inferred from its passing ownership tests or technical progress commit.

## Checks Run

| Final check | Result |
| --- | --- |
| Focused lifecycle/remote/rig/review/presentation units | 39 passed in 5 files |
| Production `npm run test:mp -- --grep "animation authority:|resources:|animation retirement:"` | 7 passed in 6.3min |
| Owned-root browser resources + action lifecycle, workers=1 | 30 passed in 3.3min |
| Existing animation/character art resource gate | 2 passed in 23.1s |
| Final budget comparator + revised material fixture | 2 passed in 15.7s |
| Read-only world skin assessment | 1 temporary probe passed in 14.3s; result retained, temporary tracked probe removed |
| Lint, root types, strict multiplayer types, build, diff whitespace | Passed; final build 423ms, existing large-chunk warning remains |
| Full corrected view CLI matrix | Complete, exit 0, 910,037ms / 15.17min |
| Fixed old budget acceptance | **False; pending comparison-contract review** |

The first production tracer expected the historical `death` alias; corrected to the current exact `death_front` clip. Initial movement capture compared schema yaw between render snapshots; observations now synchronize currentTick/30. Unsupported messages use the actual `unknown_message` reason. Existing human-art root counting now distinguishes `firstPerson_` proxies from remote actors. One early offline pass had a Vite source-reload context destruction during respawn; the specific case and final full suite passed with unchanged source. Those failures are not credited as behavior RED or final passes.

All browser/capture suites ran sequentially on owned free root-base listeners. The existing 5173 application and unrelated jobs were untouched. The temporary default-branch override is root-owned and was never staged. No package install, asset edit/export, branch/worktree, reset, stash or destructive Git operation occurred.

## Canonical Full-View Evidence and Definitions

`evidence/07-09-cost-report.json` is the complete twelve-profile report. Its 36 full-pixel PNGs and incremental metrics live under `.planning/research/.cache/06-art/animation-candidate/capture-1791303759814-10312/`. Each profile has 214 paced timed frames, 12 warmup frames and 8 deterministic clone cycles. Media encoding is excluded from the next frame interval. Device: DESKTOP-NUH2KOI, Windows10.0.19045 x64, Ryzen5 5600, Node24.19.0, Chromium147.0.7727.15, ANGLE Vulkan SwiftShader; renderer1280x960/DPR1.

There are exactly 1 or 8 **source entities**. Source0 is visually replaced by its owned arms/body/gun proxies; remaining entities retain their world rigs. Source0's complete 65-bone CPU skeleton is valid without a GPU bone texture. Both actual proxy skeleton textures are allocated. Every profile records attached scene ancestry, nonempty visible geometry groups, normal-main-camera opaque/color-writing draw callbacks, two allocated proxy bone textures, source-eye XZ colocation, actual camera yaw/height, source scale and pixel evidence. Agent inspection verifies rendered hands/gun and down-look torso/knees/boots; this is not human aesthetic acceptance.

The view uses source0 eye height1.65m standing/.85m crouched, FOV75, down-look1.3rad and source torso pitch clamped1.1rad. Source roots/layout/scales remain fixed inspection data. The baseline used an external third-person FOV44 camera. Therefore `cameraWorkloadComparable:false`, `matched:false`, `legacyBudgetPass:false` and `budgetPass:false` are intentional; a lower eight-actor value is not a matched performance improvement.

| Run | Tier | Source entities | Frame median/p95 ms | Selection median | Source correction median | View median |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Low | 1 | 206.3 / 227.4 | .1 | .3 | .4 |
| 1 | Low | 8 | 341.7 / 369.6 | .5 | 2.0 | .4 |
| 1 | Medium | 1 | 241.8 / 260.5 | .1 | .3 | .4 |
| 1 | Medium | 8 | 410.0 / 433.2 | .5 | 2.1 | .4 |
| 1 | High | 1 | 238.4 / 262.5 | .1 | .3 | .4 |
| 1 | High | 8 | 408.6 / 430.5 | .5 | 2.1 | .5 |
| 2 | Low | 1 | 225.5 / 244.4 | .1 | .3 | .5 |
| 2 | Low | 8 | 351.2 / 369.8 | .5 | 2.1 | .4 |
| 2 | Medium | 1 | 240.6 / 260.8 | .1 | .3 | .4 |
| 2 | Medium | 8 | 410.1 / 433.9 | .5 | 2.1 | .4 |
| 2 | High | 1 | 239.3 / 260.1 | .1 | .3 | .4 |
| 2 | High | 8 | 409.9 / 433.1 | .5 | 2.1 | .5 |

All times are milliseconds. Mixer median/p95 is0/.1 for one entity and.1/.3 for eight. Combined correction median is approximately.9 and2.9–3.1 respectively; it includes selection, current source contact/correction and the view. The old correction term only selected legacy clips/weights; its fixed median0/p95.1 envelope is neither widened nor reported as passed. The report retains **12 absolute frame-limit flags**: median and p95 for each one-actor tier in each repetition. Lower eight-actor absolute values do not excuse one-actor flags.

| Scope | Warm geometry / texture / program plateau | After-retirement plateau |
| --- | --- | --- |
| Low1 | 102 / 10 / 10 | 58 / 8 / 9 |
| Low8 | 109 / 367 / 10 | 58 / 8 / 9 |
| Medium/High1 | 177 / 11 / 15 | 133 / 9 / 12 |
| Medium/High8 | 184 / 368 / 16 | 133 / 9 / 12 |

Counts match all late deterministic loops and both repetitions in this scope. Camera-dependent map geometry makes the new floor different from the external-camera floor; this is not exact whole-map equality or a leak claim. Listeners, scheduled callbacks, scene props, actors and active mixer bindings all retire to zero. Shared resource disposal count is zero in every profile. View allocation diagnostics count131 geometry objects,2 owned skeletons,10 owned materials,9 borrowed maps including gun maps and0 new mixers; raw allocation is distinct from GPU upload/draw cost.

- Current export SHA256: `8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936`.
- Full current source identity SHA256: `a45e9f3dec64e314a9ad37be81a6415926631fdcef864aaf1f976f1035491334`.
- Golden baseline SHA256 remains `177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20`.
- Golden budget SHA256 remains `66722a272115cdc1145cf1af97a1cb583389d7ea5adb75a4534445c15a14e1ff`.

## Measurement Corrections and Remaining Contract

An initial capture retained six first-run core profiles under `capture-1791301616908-768`. It sampled a hidden view on the CPU and cannot qualify view GPU/frame costs. The root review caught that distinction. Only its verified owned browser was stopped; Node finally retired its listener. No complete report was published. Those historical records stay separate from the corrected full matrix.

Corrected pilots added actual view draws and pixels, changed the legacy keeper check for the legitimate unuploaded CPU source skeleton, and used the existing1.3rad down-look for readable knees/boots. One metadata scope typo was caught immediately before any completed full profile and corrected. The final source remained unchanged through all twelve profiles. Candidate validation rejects unknown/mixed scopes, missing numeric bounds, incomplete matrices, changed viewport/DPR/renderer, missing draw/pixel proof and intentional numerical/resource overruns.

The source procedural M4 now owns14 geometries versus the baseline13: its required physical charging part is an explicit +1 per entity. Removing that part or Low hands/body to fit a stale envelope is not an acceptable optimization.

`evidence/07-09-world-skeleton-assessment.json` proves51 distinct source Skeleton objects and51 GPU bone textures per rendered world entity, despite exact equality of all65 bone object identities and inverse-bind matrices. Per-mesh bind matrices remained unchanged after proper world update/render. A per-instance exact-equality sharing helper is a warranted candidate, while maintaining each mesh bind matrix and owned disposal. **No source skeleton sharing was implemented.** Root review owns that scoped decision and any subsequent evidence refresh. This does not fix/excuse one-actor full-view absolute frame flags, since source0 is hidden there.

## Deviations from Plan

1. **Rule1 — disposal failure:** finish all cleanup before reporting owner exceptions; actual callback/material negative evidence and idempotence checks passed.
2. **Rule2 — lifetime seams:** minimally extended `enemyAnimations.js` to retire copied presentation caches and expose optional offline component timing; minimally extended `tools/art/review.mjs` with separately owned actual-view measurement and strict comparison validation. Runtime markers/authority/timers were unchanged.
3. **Rule2 — measurement correctness:** replaced a CPU-only hidden-view attempt with actual main-camera draws, skeleton allocations and full-pixel proof. Camera/workload noncomparability and all absolute flags remain explicit.
4. **Open budget contract:** the old external-camera/legacy-selection envelope cannot be reported as passed by this new essential-view workload. Root independent review must resolve the technical comparison contract or require scoped optimization/qualified remeasurement; no automatic widening occurred.

No authentication gate, new endpoint/schema, outcome permission, placeholder, skipped test or missing essential visual was introduced. Inherited asset redistribution terms and human motion acceptance remain open. SwiftShader data certifies no phone/iGPU/gaming-GPU/Pi capacity or60FPS gameplay.

## Self-Check: PASSED (Artifact and Technical Evidence Only)

All twelve canonical cost profiles,36 referenced full-pixel files, both persisted RED records, the real skeleton assessment and all four measured task commits exist. Final qualified technical gates passed. This self-check does **not** waive the failed/noncomparable budget acceptance: Task2 and plan09 remain open at `budget_contract`; no phase/requirement/roadmap completion is claimed.
