---
phase: 07-movement-matched-and-action-safe-animation
plan: "09"
subsystem: animation
tags: [resource-ownership, authoritative-generation, first-person, measured-cost, checkpoint]
status: halted
requires:
  - phase: 07-08
    provides: Isolated actor/view review and phase-driven handling
provides:
  - Qualified generation/resource retirement and exact-equal world palettes
  - Owned first-person bone lookup cache with actual lifetime regression
  - Complete independent V2 candidate with135 fixed numeric failures
affects: [07-10, ANIM-02, ANIM-03, ANIM-05]
tech-stack:
  added: []
  patterns: [Cleanup-all deferred disposal error, Exact instance palettes, First-depth-first owned view lookup]
key-files:
  created: [tests/animation-resources.spec.js, tools/art/animation-budget-v2.mjs, tools/art/animation-budget-v2.test.mjs, .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-cost-postopt.json, .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-budget-postopt-result.json, .planning/phases/07-movement-matched-and-action-safe-animation/07-09-OWNER-SCOPE-PROPOSAL.md]
  modified: [src/builders/characterResources.js, src/builders/enemyGLTF.js, src/builders/firstPersonRig.js, src/builders/enemyAnimations.js, src/network/onlineSession.js, src/network/remoteActors.js, src/dev/animationReview.js, tests/action-lifecycle.spec.js, tests/multiplayer.spec.js, tools/art/review.mjs]
key-decisions:
  - "Preserve failed/noncomparable legacy evidence separately from the immutable source-eye V2 contract."
  - "Reuse exact-equal world palettes only per instance; view caches preserve bone identities and retire before foreign callbacks."
  - "Actual V2 failure blocks task2; proposed protected-owner work requires independent scope review without producer or numeric widening."
requirements-completed: [ANIM-02, ANIM-03, ANIM-05]
requirements-status: pending
coverage:
  - id: D1
    description: Actual authoritative online generation/action retirement
    verification: [{kind: e2e, ref: "tests/multiplayer.spec.js#animation authority:|resources:|animation retirement: (historical07-09 tracer)", status: pass}]
    human_judgment: false
  - id: D2
    description: Actual offline action/view/review ownership, exact palettes and owned lookup retirement
    verification: [{kind: e2e, ref: "44 actual resource/action/handling cases and2 legacy keepers", status: pass}]
    human_judgment: false
  - id: D3
    description: Complete actual candidate passes the frozen numerical envelope
    verification: [{kind: integration, ref: "evidence/07-09-budget-postopt-result.json#applicableBudgetPass", status: fail}]
    human_judgment: true
    rationale: Numerical acceptance remains unmet; concrete owner-scope review is pending. No failure is auto-approved.
  - id: D4
    description: Human moving contact/anatomy and representative hardware acceptance
    verification: []
    human_judgment: true
    rationale: Agent pixels and SwiftShader measurements establish neither human motion acceptance nor phone/iGPU/Pi/60FPS qualification.
actuals: {tokens: 163367, tasks: 1, commits: 19}
commits: 19
plan_head_before: b64b594c5316fba4d3e19d04314618e726d458b1
plan_head_after: 1e252aed501ef5bf90bf54d53fd77d004257283f
duration: approximately41min this continuation, including19.5min capture; prior spans retained in history
completed: null
last_verified: 2026-10-07
---

# Phase 7 Plan 9: Frozen V2 Resource and Cost Checkpoint

**Owners retire safely and world palettes reduce350 textures per eight-source profile; the complete independent V2 candidate fails135 unchanged numeric limits.**

## Execution Position

Task1 is complete. Task2's ownership/contract/runtime work is qualified, but required applicable-budget acceptance is **not complete**. This is a technical checkpoint, not PLAN COMPLETE. `status: halted` prevents summary existence from implying that dependent plan10 is runnable. Phase7 stays executing on plan9. Assigned requirement IDs above do not mark requirements accepted; human moving acceptance remains pending.

Continuation ran2026-10-07 approximately08:38–09:20 Europe/Warsaw. Actuals are ceiling(653,468 realized Git diff characters/4), with19 commits measured from the persisted ledger to `1e252ae`, before metadata closeout. These are not harness tokens or narrated counts. Prior original/V2/palette/quota spans remain in Git and retained evidence.

## Accomplishments

- Original cleanup invalidates owners first, completes all callbacks/mixer/owned resource retirement before reporting errors, and preserves shared templates, siblings and later clones. Historical actual two-client evidence covers reload/death/fresh life, movement/posture, malformed/stale intentions, feedback, rematch, Retry and rejoin while authority retains outcomes. The original committed checkpoint summary retains those detailed results.
- V2 freeze/verify and33 negative controls were committed before tuning. Original golden files, failed/noncomparable cost report and every legacy flag remain preserved. Successful capture cannot substitute for acceptance.
- Exact ordered-bone/inverse-bind world consolidation stays inside each actor, preserving mesh bind matrices/posed vertices. Actual render/resource tests prove independent palettes, single disposal, unequal-palette rejection and shared survival.
- The permitted view cache preserves installed Three r160's first depth-first name matches. Real view-only RED measured60 recursive lookups in20 warmed updates; GREEN reuses exact owned references and the same correction quaternion, clearing its cache before foreign callbacks. No pose calculation, simulation root/eye, clock, draw or protected art changed.
- Complete independent actual source-eye evidence contains12 profiles,214 timed frames each,36 full1280×960 PNGs, essential arms/body/gun draws, two view palettes, deterministic plateaus and zero retired ownership/shared disposal. Numerical acceptance fails as recorded below.

## Task Commits and TDD

Original owner/tracer work: `bca7619` and `b3f8bde` RED; `948657c` and `e0f78d7` qualified retirement/full-view evidence. Prior continuation: `f9505e7`→`c973458` V2 freeze; `78b8dab`→`d30da22` per-instance palette consolidation. Earlier11-profile interruption remains separate and is never spliced into the current report.

| Current commit | Outcome |
| --- | --- |
| `3656f42` | Diagnostic handling-cache RED:920 recursive rig lookups over20 warmed updates. |
| `a9cbc5f` | Scoped restoration preserves that history and exact protected handling source/test bytes; handling implementation was never committed. |
| `97b8b37` | Real permitted view-cache RED:60 warmed recursive lookups and missing owned cache/release. |
| `2a5b7ef` | View cache GREEN, exact identities/correction copy and retirement; capture source frozen here. |
| `1e252ae` | Complete failing candidate, raw actual CLI result and concrete owner-scope proposal. |

Both new RED records pass SDK `RED_EVIDENCE_OK`: `.planning/research/.cache/07-09-handling-cache-red.json` and `07-09-view-cache-red.json`. The handling record needed parser-compatible normalized output before GREEN authorization; its genuine failing assertion is retained. Its synthetic reach assertion was corrected to unchanged contact comparison before restoring the probe. Invalid fixture/setup failures were not credited as RED.

## Checks Run

| Check | Actual result |
| --- | --- |
| Focused view/handling/animation units |17 passed in3 files. |
| Final retirement-order targeted view check |2 units and1 actual browser case passed. |
| Actual action/resource/all-weapon suite, owned root-base port, workers1 |44 passed in4.7min. |
| Existing animation/character-art resource keepers |2 passed in24.9s. |
| V2 freeze/verify negative controls |33 passed. |
| Lint, root types, strict MP types, build, diff whitespace |Passed; existing large-chunk warning remains. |
| Full independent source-eye capture |Complete, exit0,1,170,050ms;12 profiles/36 PNGs. |
| Actual named V2 acceptance CLI |**Exit1, applicableBudgetPass=false,135 numeric overruns.** |

Initial three action cases timed out in setup while the start button stayed LOADING; that owned run was stopped. A diagnostic grep found zero tests and failed. A probe-only browser run was interrupted before scoped source restoration. These are nonpasses, not full qualification or behavioral RED. The justified final44-case suite passed. Final cache disposal ordering was rechecked by a targeted browser/unit pass.

Browser artifacts were copied before shared output reuse to `.planning/research/.cache/07-09-view-cache-qualified/` and `07-09-view-cache-final/`. Suites/capture ran sequentially on owned free root-base listeners. The5173 application and unrelated processes were untouched. No install, art edit/export, global trust, reset, stash, push or blanket restore occurred. Root-owned temporary config remains unstaged.

## Canonical Independent V2 Evidence

Report: `evidence/07-09-cost-postopt.json`; actual failed gate: `evidence/07-09-budget-postopt-result.json`. Metrics/36 PNGs: `.planning/research/.cache/06-art/animation-candidate/capture-1791356297635-26892/`. Source: `2a5b7efe1e939ce7962bc9501aac977cbce712a3`; identity: `97d77c14a822357f7ea82ba6739f605c43beb34819ba4dda104e71e93b0c21b5`. Owned browser and listener closed.

The actual CLI validated complete scope/device/producer/settings, current/protected source hashes, exact source-eye settings, required draws/full pixels, ownership and deterministic plateaus before its numerical failure. Six eight-source reductions are exactly350 textures: Low367→17; Medium/High368→18. One-source and after-retirement plateaus retain fixed values. Twenty-seven of36 PNG hashes match reference bytes; this is neither universal pixel equality nor human aesthetic acceptance.

| Run | Tier | Sources | Actual frame median/p95 ms | Frozen median/p95 upper ms |
| --- | --- | --- | --- | --- |
|1|Low|1|237.9 /262.3|244.7 /261.4|
|1|Low|8|427.8 /586.8|360.7 /370.0|
|1|Medium|1|308.0 /405.6|243.0 /261.1|
|1|Medium|8|509.7 /656.7|410.2 /434.6|
|1|High|1|303.7 /401.8|240.2 /264.9|
|1|High|8|433.5 /470.5|411.2 /435.7|
|2|Low|1|243.5 /273.0|244.7 /261.4|
|2|Low|8|519.1 /628.4|360.7 /370.0|
|2|Medium|1|295.4 /395.4|243.0 /261.1|
|2|Medium|8|617.6 /676.7|410.2 /434.6|
|2|High|1|316.2 /398.4|240.2 /264.9|
|2|High|8|455.5 /649.8|411.2 /435.7|

Display rounding does not alter JSON limits or epsilon1e-7. The135 flags comprise22 frame intervals,22 total corrections,18 render,19 selection,24 core corrections,7 mixer,5 inertia and18 view values. All24 core median/p95 values fail. Example: run1 Low/one selection median.2>.1 and core.4>.3; run2 Medium/eight core4.1>2.1. Exact values/limits remain in the raw result.

### Immutable Identities

- Original baseline: `177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20`.
- Original budget: `66722a272115cdc1145cf1af97a1cb583389d7ea5adb75a4534445c15a14e1ff`.
- V2 reference: `6d5fd41136766209445b9694dfb0ffdf269d4a1887cffadba868dcad8a8b6aef`.
- V2 budget: `6f0bf775eda9061b601023d5890a50248668a3bccbec48eeaeb7f84e7a64ba34`.
- Producer: `035432f721cb0661a82c288d3b5e92ce4d631a48da5bc6fbb73022897960f5e0`.
- Sampler: `2720e51eed272c40fe9e12ff561e4d63072f9b7548b5c270a71ec0ae527ab83f`.
- Actual candidate: `799b7217d1e1120fac2d16442accfadfa578a7d5cec14bb75d57faef58742c39`.

## Deviations and Concrete Remaining Checkpoint

The approved scope amendment repairs external-camera versus source-eye comparison; it does not waive a numeric failure. Original legacyBudgetPass=false, cameraWorkloadComparable=false and every old failed flag remain immutable. No bound/reference was replaced after tuning.

The V2 verifier permits only characterResources/enemyGLTF/firstPersonRig runtime changes. Protected enemyAnimations/weaponHandling produce the failing selection/core costs. The protected probe was restored, not wrapped to evade protection; permitted view caching was qualified instead.

`07-09-OWNER-SCOPE-PROPOSAL.md` proposes exactly two additional runtime owners, `src/builders/enemyAnimations.js` and `src/builders/weaponHandling.js`, with regressions in existing resource/handling browser files. Candidate work is generation-owned stable lookup caching while preserving every solver/weight/phase/correction/authority operation. No whitelist expansion was implemented. These CPU candidates are **not demonstrated solutions for frame failures**; any reviewed implementation must independently pass every existing bound with a new complete matrix.

An unrelated software GPU process used29.65625 CPU seconds in3.0522724 wall seconds during initial diagnosis. It exited naturally before the complete capture and was never stopped. No causal conclusion or waiver follows. Initial smoke is incomplete diagnostic evidence only.

WINDOWS41 records the actual V2 unmet truth; WINDOWS40 retains historical checkpoint evidence. No new stub, missing essential limb, placeholder, skipped test, auth gate, endpoint, schema or outcome permission was introduced. Inherited asset terms, human motion and representative device/Pi/60FPS acceptance remain separate pending work.

## Self-Check: PASSED — Artifacts and Qualified Behavior Only

All new task/evidence commits, both new RED records, the complete12-profile report and36 referenced PNGs, actual failed CLI result, golden identities and owner-scope proposal exist. Qualified behavioral checks pass. **Numerical acceptance fails; task2, plan09 and Phase7 remain incomplete.**
