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
  - Complete earlier V2 candidate with135 fixed numeric failures
  - Exact generation-owned handling/presentation caches and current failed smoke
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
  - "Binding owner review permits exactly two reference-cache owners; all producer/numeric/protected-unit predicates remain fixed."
  - "Current smoke fails14 fixed Low/one statistics; no unchanged expensive full matrix is launched without readiness."
requirements-completed: []
requirements-mapped: [ANIM-02, ANIM-03, ANIM-05]
requirements-status: pending
coverage:
  - id: D1
    description: Actual authoritative online generation/action retirement
    verification: [{kind: e2e, ref: "tests/multiplayer.spec.js#animation authority:|resources:|animation retirement: (historical07-09 tracer)", status: pass}]
    human_judgment: false
  - id: D2
    description: Actual offline action/view/review ownership, exact palettes and owned lookup retirement
    verification: [{kind: e2e, ref: "45/46 current distinct resource/action/handling cases qualified; legacy1/2 qualified", status: fail}]
    human_judgment: true
    rationale: Two original checks did not reach assertions in setup; targeted verification remains open, not human-rubber-stampable.
  - id: D3
    description: Complete actual candidate passes the frozen numerical envelope
    verification: [{kind: integration, ref: "evidence/07-09-owner-cache-pilot-result.json#actualV2Cli exit1 Incomplete report", status: fail}]
    human_judgment: true
    rationale: Current source has an incomplete pilot with14 fixed Low/one overruns; no fresh complete candidate or numerical acceptance is qualified.
  - id: D4
    description: Human moving contact/anatomy and representative hardware acceptance
    verification: []
    human_judgment: true
    rationale: Agent pixels and SwiftShader measurements establish neither human motion acceptance nor phone/iGPU/Pi/60FPS qualification.
actuals: {tokens: 223269, tasks: 1, commits: 25}
commits: 25
plan_head_before: b64b594c5316fba4d3e19d04314618e726d458b1
plan_head_after: 1dea2c242b8520d20d21fb47f8bfbfc526302c89
duration: approximately30min owner-cache continuation; prior spans retained in history
completed: null
last_verified: 2026-10-07
---

# Phase 7 Plan 9: Bounded Owner Caches and Failed Pilot Checkpoint

**Exact loaded-rig caches remove repeated traversal without changing poses; the current unchanged-producer smoke fails14 fixed Low/one statistics and cannot qualify a complete V2 candidate.**

## Historical Execution Position — Before Approved Owner Extension

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

## Checks Run — Historical View-Cache Continuation

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

Report: `.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-cost-postopt.json`; actual failed gate: `.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-budget-postopt-result.json`. Metrics/36 PNGs: `.planning/research/.cache/06-art/animation-candidate/capture-1791356297635-26892/`. Source: `2a5b7efe1e939ce7962bc9501aac977cbce712a3`; identity: `97d77c14a822357f7ea82ba6739f605c43beb34819ba4dda104e71e93b0c21b5`. Owned browser and listener closed.

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

## Historical Deviations and Prior Scope Checkpoint

The approved scope amendment repairs external-camera versus source-eye comparison; it does not waive a numeric failure. Original legacyBudgetPass=false, cameraWorkloadComparable=false and every old failed flag remain immutable. No bound/reference was replaced after tuning.

The V2 verifier permits only characterResources/enemyGLTF/firstPersonRig runtime changes. Protected enemyAnimations/weaponHandling produce the failing selection/core costs. The protected probe was restored, not wrapped to evade protection; permitted view caching was qualified instead.

`07-09-OWNER-SCOPE-PROPOSAL.md` proposes exactly two additional runtime owners, `src/builders/enemyAnimations.js` and `src/builders/weaponHandling.js`, with regressions in existing resource/handling browser files. Candidate work is generation-owned stable lookup caching while preserving every solver/weight/phase/correction/authority operation. No whitelist expansion was implemented. These CPU candidates are **not demonstrated solutions for frame failures**; any reviewed implementation must independently pass every existing bound with a new complete matrix.

An unrelated software GPU process used29.65625 CPU seconds in3.0522724 wall seconds during initial diagnosis. It exited naturally before the complete capture and was never stopped. No causal conclusion or waiver follows. Initial smoke is incomplete diagnostic evidence only.

WINDOWS41 records the actual V2 unmet truth; WINDOWS40 retains historical checkpoint evidence. No new stub, missing essential limb, placeholder, skipped test, auth gate, endpoint, schema or outcome permission was introduced. Inherited asset terms, human motion and representative device/Pi/60FPS acceptance remain separate pending work.

## Historical Self-Check: PASSED — Artifacts and Qualified Behavior Only

All new task/evidence commits, both new RED records, the complete12-profile report and36 referenced PNGs, actual failed CLI result, golden identities and owner-scope proposal exist. Qualified behavioral checks pass. **Numerical acceptance fails; task2, plan09 and Phase7 remain incomplete.**

## Approved Owner Extension — Current 2026-10-07 Checkpoint

The sections above retain the earlier `2a5b7ef` source and actual complete failed attempt. Their earlier owner restriction/proposal is superseded only by binding `07-09-OWNER-SCOPE-REVIEW.md` at `1e537a4`. Current source is `f89d820`; task1 stays complete and task2 stays open. No plan10/requirement/phase advancement occurs. Actuals above are ceiling(realized Git diff characters/4), with25 commits measured from the persisted ledger through `1dea2c2`, before current metadata closeout.

| New commit | Outcome |
| --- | --- |
| `116f9ba` | Loaded-rig/allowlist RED; three SDK `RED_EVIDENCE_OK` records. |
| `f89d820` | Exact reviewed owner reference/collection caches, lazy-mask inclusion and bounded retirement GREEN. |
| `1dea2c2` | Earlier complete failure/source identity archived byte-identically; current actual failed pilot and named CLI rejection retained. |

Only `src/builders/enemyAnimations.js` and `src/builders/weaponHandling.js` change in `src/` after owner approval. Runtime caches contain references or stable collections only. Installed r160 root-first depth-first duplicate/missing-name semantics remain exact. Every arm/finger rotation, original rest restoration, contact target/part movement, eligibility, phase, weight, authoritative cue and action priority still executes; no transform/matrix/target/solver result is cached. Newly created lower/upper mask actions enter the collection immediately in the same mixer generation. Actor/mixer/action-map and handling rig/root replacement clear stale references; current mounted weapon children are resolved each call, actors/views own independent caches, and retirement is idempotent.

Loaded-rig RED measured920 handling rig lookups in20 updates and960 presentation rig lookups plus20 action enumerations in20 ticks. Five original full pose/layer snapshots and28 handling snapshots already matched before optimization. GREEN performs zero warmed rig/socket lookups or action enumerations while preserving all comparisons. Actual checks include duplicate/missing references, first-time reload masks followed by interruption/death, root/mixer/current-weapon replacement, old-root disposal, retirement, live keepers and later clones. Loaded pistol FBX has no named magazine part; the fixture preserves original absence semantics rather than fabricating a part. The first presentation fixture crashed before its assertion and is invalid RED; its corrected assertion failure is the accepted RED. Normalized records and actual logs remain under `.planning/research/.cache/07-09-owner-*-red.*`.

**[Rule1 - Bug]** The initial implementation cleared a caller-supplied bone list on first initialization; an unchanged mask unit caught it. First initialization now preserves that original behavior and caches its references once. The17 unchanged units and final loaded presentation check pass. No protected source-unit file changed. The later pistol root-replacement failure was a fixture assumption about an absent original part; its correction changes no runtime behavior.

### Checks Run — Current Owner-Cache Continuation

| Check | Actual result |
| --- | --- |
| New loaded-rig presentation/handling regressions |2 passed in1.5min; final presentation passed in broader run, final corrected all-weapon/root replacement retry passed in10.4s. |
| Unchanged animation/handling/view units |17 passed in3 files. |
| V2 controls |41 passed. Exactly two new owner mutations allowed; combat/art/sampler/weapon and protected source-unit mutations reject. |
| Broader resource/action/all-weapon suite |44 passed,2 failed in8.9min. Corrected handling retry passes, yielding45/46 distinct current cases qualified. |
| Original throw1ms assertion |Not reached in3 setup/asset-loading or initial-click timeout attempts. Test/assertion/timeouts unchanged; no further unchanged retries. |
| Legacy keepers |1 passed (character-art resource/tier keeper);1 failed in asset-loading setup before repeated-removal assertion. |
| Lint, root types, strict MP types, build, whitespace |Passed; existing large-chunk build warning remains. |
| Actual unchanged-producer Low/one smoke |Exit0,83,037ms,1 profile,214 timed frames,3 full PNGs; `complete:false` is intentional. |
| Actual named V2 CLI on current pilot |Exit1: `Incomplete report`. Separate fixed-profile diagnostic records14 overruns among16 statistics. |

All-tier zero/one/eight retirement, deterministic plateaus, exact shared buffers, actual posed vertices/pixels/binds, callback-failure cleanup, stale review loads, borrowed source material, keeper and later clone checks passed. Moving M4/P90/AWP/M9 contacts and bolt/slide/interruption checks passed. Current setup-limited nonpasses are not a passing full browser suite. Artifacts were copied before shared output reuse to `07-09-owner-qualified-initial/`, `07-09-owner-qualified-retry/`, `07-09-owner-throw-selfhosted/` and `07-09-owner-legacy-keepers/` under `.planning/research/.cache/`. Owned free root-base listeners/browser suites ran sequentially;5173 and unrelated processes remain untouched.

### Actual Current Pilot — Diagnostic Only

`.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-owner-cache-smoke.json` SHA256 is `3bf8ae8972a4a429075a61e56f3877d93d84650a42527adad0f6bbd58051bc78`, source `f89d82082dfea6ee5ce4544011745e1bfbba0ff1`. Raw metrics and3 PNGs: `.planning/research/.cache/06-art/animation-candidate/capture-1791359694832-10580/`. `.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-owner-cache-pilot-result.json` retains the actual named CLI command/exit/stderr, exact statistics/bounds and source/host facts.

| Low/one component | Actual median/p95 ms | Frozen median/p95 upper ms |
| --- | --- | --- |
| Frame interval |300.8 /410.3|244.7 /261.4|
| Mixer |.1 /.2|0 /.1|
| Inertia |0 /.1|0 /.2|
| Total correction |1.4 /1.9|.9 /1.2|
| Render |1.2 /1.6|.7 /.9|
| Selection |.2 /.3|.1 /.2|
| Core correction |.5 /.7|.3 /.5|
| View |.7 /1.1|.6 /.8|

Rounding here changes neither exact JSON bounds nor epsilon1e-7. A one-profile diagnostic cannot replace two runs/all tiers/one-eight actors. Its14 flags are not a fresh full-matrix failure count. Essential arms/body/gun draws, full pixels, keeper survival, zero retired ownership/shared disposals and owned browser/listener cleanup pass. Protected source identities outside the exact reviewed owners remain unchanged. Removed repeated traversal is proven; applicable frame/CPU improvement is not accepted.

An unrelated `node tests/browser-probes.mjs` (PID31152), browser23584 and GPU28780 were observed. That GPU accumulated16.109375 CPU seconds over3.1812703 wall seconds; it was never stopped or altered. No causal inference or performance waiver follows. Parent owns host-condition followup. No known-unready unchanged twelve-profile matrix was launched.

### Preserved Earlier Complete Failure

`07-09-cost-view-cache-failed.json` matches the earlier complete canonical report SHA799b7217d1e1120fac2d16442accfadfa578a7d5cec14bb75d57faef58742c39. `07-09-budget-view-cache-failed.json` matches its actual exit1 result SHA6735152e4810f4ad37a95b8f9f4a7b02c668ef941f6b65c6c643764ba464e31d. `07-09-view-cache-failure-archive.json` records exact source `2a5b7ef`, identity97d77c14a822357f7ea82ba6739f605c43beb34819ba4dda104e71e93b0c21b5,12 profiles/36 PNGs/1,170,050ms and135 numeric failures. All four golden hashes, producer and sampler listed above remain unchanged; old legacy false/noncomparable flags and earlier interrupted evidence remain untouched.

### Remaining Gate

Task2, plan09 and dependent plan10 remain open. After justified host readiness or independently reviewed scoped work, capture a fresh complete twelve-profile matrix and run the actual unchanged V2 CLI. Never splice/reuse profiles/reference, re-freeze bounds, widen zero/timer allowances, alter producer/settings or remove required geometry/layers/corrections. Two original setup-limited assertions require targeted qualification. WINDOWS41 retains the full numeric unmet truth; WINDOWS42/43 record those unrun assertions. No requirements or roadmap completion is advanced. No new stub, endpoint, schema, authority permission, asset export/install, global trust, reset/stash/push/blanket restore occurred. Root-owned temporary config remains unstaged; human motion and representative hardware/Pi/60FPS acceptance remain pending.

**Qualification remains halted. The numerical, full-suite and required coverage gates above remain open; no plan, requirement, human or phase acceptance is granted.**

## Self-Check: PASSED — Artifact Integrity Only

Referenced artifacts and commits exist. Current protected source and media identity checks agree with saved evidence. Owned collection and fixture handles are retired. This section verifies artifact integrity only; qualification is governed by the actual gates recorded above.
