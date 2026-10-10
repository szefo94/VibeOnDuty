---
phase: 07-movement-matched-and-action-safe-animation
plan: "13"
subsystem: animation-budget-gate
tags: [frozen-v2-gate, requalification, guard-review, numeric-only-fail]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-21 register-exception (corrected src/main.js) and 07-22 collector diagnostics"
provides:
  - "evidence/07-13-cost-candidate.json: one complete 12-profile current-source candidate"
  - "evidence/07-13-v2-requalification.json: verbatim frozen V2 result, routing numeric-only-fail"
  - "07-13-GUARD-REVIEW.md: independent opus/high review of 2e2f90f and 2c9330b, pass-with-notes"
affects: [07-15, 07-18]
actuals:
  tokens: 22000
  tasks: 2
  commits: 3
plan_head_before: 8d47e0023ba4419d31dcb62f8d38d438f290a66d
plan_head_after: 1cfeefaf1a6394dd90980390881c1bf08755cff3
tech-stack:
  added: []
  patterns: ["one capture only; numeric failure recorded as failure, not repaired"]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-13-cost-candidate.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-13-v2-requalification.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-13-GUARD-REVIEW.md
  modified: []
key-decisions:
  - "Recorded the frozen gate result as numeric-only-fail; no rerun, no source/limit/sampler/reference change."
  - "Orchestrator ruling (not the owner's): rate G-03 bounded idle-owner retention a WARNING, not a blocker."
requirements-completed: []
coverage:
  - id: D1
    description: "Frozen source-eye V2 gate evaluated once on a complete current-source candidate, verbatim result recorded"
    requirement: ANIM-05
    verification:
      - kind: other
        ref: "node tools/art/animation-budget-v2.mjs verify --budget evidence/07-budget-view-v2.json --candidate evidence/07-13-cost-candidate.json (exit 1, applicableBudgetPass false)"
        status: fail
    human_judgment: false
  - id: D2
    description: "Independent review of 2e2f90f and 2c9330b"
    verification:
      - kind: other
        ref: "07-13-GUARD-REVIEW.md status pass-with-notes; node --test tools/art/motion-promotion.test.mjs (34/34)"
        status: pass
    human_judgment: false
duration: 41min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 13: Frozen V2 requalification at current source Summary

**The unchanged frozen V2 gate was run once on a complete current-source candidate: routing `numeric-only-fail` (structure passes, 40 of 192 timing statistics exceed the frozen limits, exit 1); the two post-summary guard changes carry an independent `pass-with-notes` review.**

## Result up front

- **Frozen V2 gate: FAILED numerically.** Exit code 1, `applicableBudgetPass: false`. This is NOT a pass, NOT a certification and NOT a plan 09 qualification. ANIM-05 is not met by it, and `requirements-completed` is empty. `07-09-SUMMARY.md` and every other plan's summary are untouched.
- **Structural outcome: PASS.** No `Protected source changed`, `Ownership/essential resource changed`, `Stale current source hash`, `Changed frozen` or `Incomplete report` message; `view.sourceCallbacks` is 3 in all 12 samples (frozen value 3), so `2c9330b` did restore the ownership predicate.
- **Numeric outcome: FAIL.** 40 of 192 statistics over the frozen limits: frameIntervalMs 19, renderMs 6, correctionMs 6, coreCorrectionMs 4, viewMs 4, inertiaMs 1. By statistic p95 30, median 10. Actual-to-limit ratios 1.0005 to 1.50. Every one of the 12 profiles has at least one overrun (1 to 6 each).
- **Guard review: `pass-with-notes`** (opus, effort high; 0 blockers, 3 warnings, 6 notes). The candidate is not made unusable by either change.
- **Plan status `complete`** because the plan's job was to measure and review, and both were done. A recorded numeric failure is a valid completed measurement; it is not a gate pass.

Comparison counts (context only, different conditions): 135 overruns on 2026-10-07 (`07-09-budget-postopt-result.json`); 72 of 192 on 2026-10-09 computed outside the gate under the High performance plan; 40 of 192 now through the gate.

## Performance

- **Duration:** about 41 min (task 1 plus continuation)
- **Started:** 2026-10-10T07:04:53Z
- **Completed:** 2026-10-10T07:45:12Z
- **Tasks:** 2
- **Files modified:** 3 created, none modified

## Accomplishments

- One complete candidate (2 runs x 3 tiers x 1 and 8 actors, 214 timed frames each, 950,188 ms, software renderer) copied byte for byte (SHA-256 `5803ffe0...94b5`) to `evidence/07-13-cost-candidate.json`.
- Result record with verbatim exit code, stdout and stderr, routing `numeric-only-fail`, `certification: false`.
- D-06 identity check: candidate `identities['src/main.js']` = `f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393` = the registered corrected hash (not the frozen `c762044...`), and the on-disk file after the run equals it. The measured build contains the 07-21 pause-menu fix.
- Golden files byte-identical before and after (re-hashed at close): baseline `177686a0...0b20`, budget `66722a27...14e1ff`, view reference `6d5fd411...6aef`, view budget `6f0bf775...a34`. `frozen-bytes verify`: 26 verified, 0 mismatched.
- Independent review written by the reviewer (not edited by the executor).

## Task Commits

1. **Task 1: one complete current-source candidate through the frozen gate** - `63d81f0` (test)
2. **Task 2: independent guard review** - `1cfeefa` (docs)

**Plan metadata:** committed with the final docs commit.

## Verify results

- `node --test tools/art/motion-promotion.test.mjs`: 34 tests, 34 pass, 0 fail, 0 skipped.
- Review-record `node -e` check (status, `reviewer_model: opus`, `reviewer_effort: high`): exit 0.
- `npm run test:e2e -- tests/weapon-handling.spec.js --workers=1`: exit 0, 11 passed, run by the task 1 executor on these exact source bytes after the capture (log `.planning/research/.cache/07-13-requalification/0713-e2e.log`, SHA-256 beginning `9a50c941`). Not rerun: `git status --short -- src tests tools` is empty and `src/main.js` is unchanged.
- Task 1 verify command 1 (`animation-budget-v2.test.mjs` + `motion-promotion.test.mjs`) and the frozen gate command (command 2): the gate is the recorded exit-1 numeric failure above; its fail condition "exit 1 with applicableBudgetPass false means the gap stays open" applies.

## Acceptance criteria

All met as written: candidate complete with 12 samples and SHA matching the record; result file parses with `routing` in the allowed set, integer `exitCode` 1, `certification: false`; `numeric-only-fail` has `structural: pass` and `overrunCount` 40 >= 1; golden hashes equal before and after; no change under `src/`, `tools/art/` or pre-existing evidence; review has the required frontmatter and three answered questions with file and line evidence. No criterion was turned into a pass: the numeric result stays a failure.

## Host context (not an excuse)

Balanced power plan (the 2026-10-09 recapture used High performance), other applications and agent sessions running (browser, VS Code, Discord, Defender, Unity Hub, two agent sessions), CPU not sampled during the capture so that nothing ran beside it (before: 6 to 43 percent busy, after: 0 to 14 percent). Software renderer on a shared desktop. This helps read the result against host drift; it does not reduce it to a non-failure. Headless software timings certify no device or frame rate.

## Sequencing

This plan ran before the collector tracer gap closed (07-12, 07-20 and 07-22 remain `partial`; the last tracer failed because natural death did not occur within 120 simulation seconds), by owner decision. That is sound here because the game source was settled at its registered identity (D-06 above), and `tools/art/animation-capture.mjs` is not in the frozen identity set, so collector changes cannot move this result. No tracer is treated as passed.

## Routing

- The numeric failure goes to the owner decision in plan 07-15 (paired amendment) and is an input to plan 07-18.
- A non-blocking guard review (`pass-with-notes`) satisfies the plan 07-18 precondition.
- Plan 09 qualification is still written only by plan 07-18 at the final source identity.

## For post-execution review

- Confirm the 40 overruns are read as a timing-predicate failure only; structure held.
- Confirm `routing: numeric-only-fail` is not cited anywhere as a pass.
- Read G-01 to G-03 below before any push.

## Known limitations / open items for the owner

- **G-01 (warning, must fix before any push):** the CI step `npm run test:art` added by `2e2f90f` (`.github/workflows/test.yml:26`) cannot pass on a fresh checkout. 3 of 47 tests in `tools/art/animation-budget-v2.test.mjs` need the gitignored `.planning/research/.cache/`. Once pushed it would stop the Tests job before `test:e2e` and `test:mp` and block deployment (`deploy.yml:24,27`). Local `main` is far ahead of origin (311 commits at review), so no hosted run has hit it. Fix: make those cases skip visibly without the cache, or provide tracked fixtures.
- **G-02 (warning):** no recorded owner decision for the `src/builders/enemyGLTF.test.js` exact-pair exception. The mechanism is correct and narrow (one tuple of 241,026 changed), but it goes one path beyond what the CR-02 review approved and relaxes the owner scope review's "keep existing source-unit-test hashes". The review documents it; only the owner can decide it.
- **G-03 (warning):** bounded idle-owner retention in `2c9330b`: an owner that does not own its skeleton and is not used again keeps the retired character's JS object graph reachable until its next use. GPU resources are freed regardless; at most one character per owner; no shipped path produces it; the code the budget was frozen from behaved the same. **The orchestrator's ruling (not the owner's) is to rate it a warning, not a blocker.** The owner may rate it differently or ask for a release that adds no callback.
- Reviewer notes: G-04 first update after retirement writes rest rotations before the lazy check (write only); G-05 all of the exception's own controls need the gitignored cache and none covers the swapped pair, so on a fresh checkout only the other-name rejection runs; G-06 nothing checks the `.gitattributes` pin line for the test file; G-07 the browser case omits same-frame reuse, double retirement, per-frame reassignment and idle retention; G-08 `07-09-HOST-DRIFT.md:90-94` misattributes the fourth callback (the actor's own handling alone reproduces it); G-09 unit tests are frozen identities, so any later unit-test edit needs the same treatment.
- Not verified by the reviewer: browser behaviour first hand, hosted CI, other OS or git versions.

## Deviations from Plan

None - plan executed exactly as written. Task 2 was split between the reviewer (the review) and the executor (commit and verify), as the plan requires.

## Issues Encountered

None beyond the recorded numeric failure, which the plan defines as a measurement.

## Known Stubs

None.

## Next Phase Readiness

Frozen V2 gate still fails numerically; ANIM-05 stays open pending plans 07-15 and 07-18. No tracer plan is complete.

## Self-Check: PASSED

Evidence files and review file exist; commits `63d81f0` and `1cfeefa` are ancestors of HEAD; golden hashes and `src/main.js` verified at close.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-10*
