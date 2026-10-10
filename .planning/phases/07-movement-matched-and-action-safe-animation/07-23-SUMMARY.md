---
phase: 07-movement-matched-and-action-safe-animation
plan: "23"
subsystem: review-tooling
tags: [animation-capture, tracer, approach-route, bfs, playwright, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-22 page journal and menu-return diagnostics; the failed 05:20:38.924Z tracer this plan answers"
provides:
  - "Pure tested approach route (openGrid, approachStep, classifyStall) in tools/art/approach-route.mjs"
  - "Collector approach steered by the route with W and mouse movement only; early Approach stalled failure; approachFailure diagnostics"
  - "Labelled fixture control (not evidence) for the recorded stall geometry"
  - "One fresh passing tracer report and root status complete for 07-12, 07-20 and 07-22"
affects: [07-19, 07-14]
actuals:
  tokens: 33000
  tasks: 4
  commits: 7
plan_head_before: a70f1cbc870cdde729bda500dcde17bac631fa19
plan_head_after: 38a1b6ee959c11cf3d429ebcd34deec5bb2e4909
commits: 7
tech-stack:
  added: []
  patterns:
    - "Pure steering and stall classification module with no imports, loaded unchanged in Node and, via Vite, in the page"
    - "waitSimulation sample.abort(sample) returning a reason string for an early, explained end"
key-files:
  created:
    - tools/art/approach-route.mjs
    - tools/art/approach-route.test.mjs
    - tools/art/approach-fixture-control.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer-sixth.json
  modified:
    - tools/art/animation-capture.mjs
    - tools/art/animation-capture.test.mjs
    - AGENTS.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-12-SUMMARY.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-20-SUMMARY.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-22-SUMMARY.md
    - .planning/ROADMAP.md
key-decisions:
  - "Approach steering is a 4-neighbour BFS over plain-floor cells of the player's level; no diagonals, no smoothing"
  - "approachStep takes the cell size as its `cell` argument; classifyStall returns the classification string"
  - "Early stall abort applies only on a `route` step; fallback, arrived and unreachable are left to the 120 s bound"
requirements-completed: [ANIM-02]
duration: 2h 15m
completed: 2026-10-10
status: complete
---

# Phase 07 Plan 23: The fresh tracer PASSED (five combat stages, menuReturn true, empty collectionErrors)

**A pure BFS route over open flat bunker cells replaces the straight-line approach steer, so the collector reached a natural death in 7.7 simulation seconds and the 2026-10-10T09:01:35.566Z tracer completed all five stages; 07-12, 07-20 and 07-22 are closed on it.**

## Performance

- **Duration:** about 2 h 15 min (plan start about 08:50Z; last task commit 09:06Z for tracer and closeout; the tracer itself ran 243.7 s wall)
- **Tasks:** 4 of 4
- **Files modified:** 12 (4 created)

## Accomplishments

- Pure `tools/art/approach-route.mjs` (no imports) with 23 controls on real `bunkerData`: the pin geometry (player (36, 31.93), hostile (35.97, 50)) routes west of the solid cell (9, 8) to the hostile's own cell (8, 12) and never enters a closed cell.
- Collector approach now sends only `KeyW` down/up and `mousemove`, never fires, writes no state; the in-page driver is exported as `installCombatDriver(page)` and used by both the collector and the control.
- `waitSimulation` accepts `sample.abort`; a stalled route step ends the natural-death wait as `Approach stalled: ...` with observed simulation seconds and wall ms. Natural-death and natural-respawn failures now carry `combatProgress` and `approachFailure` into `collectionErrors`.
- Labelled fixture control passed: page `MAP`/`HMAP` equal `bunkerData` cell by cell (0 mismatches), displacement 10.2 m, nearest hostile distance 6.6 m with line of sight, step kinds `["route"]`.
- The single fresh tracer passed; the three partial summaries and their ROADMAP lines were closed on it.

## Task Commits

1. **Task 1 (tdd): pure route and stall classification**
   - RED `ae45ce7` (test) - 16 of 23 controls failing against an exporting stub
   - GREEN `44dca0b` (feat) - 23 of 23 pass
2. **Task 2 (tdd): route steer, early stall, control**
   - RED `991474d` (test) - 5 new controls failing
   - GREEN `5b067f5` (feat) - driver, abort, diagnostics; 97 tests across both files pass
   - `51dd66b` (feat) - fixture control (passed) and AGENTS.md notes
3. **Task 3 (tracer): the one capture** - `543f0d7` (chore) - fresh report plus the `-sixth` archive
4. **Task 4: closeout on a real pass** - `38a1b6e` (docs)

**Plan metadata:** the commit adding this SUMMARY and STATE/ROADMAP progress follows.

## TDD Red / Green evidence

- **RED, task 1:** target `pin geometry: the route leaves the corner at column 9 row 8 and reaches engagement range`; command `node --test --test-reporter=tap tools/art/approach-route.test.mjs`, exit 1, 16 failing of 23. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed on `kind === 'route'` against a stub returning `unimplemented`; the fixture-precondition control passed on the real data. A first run before the stub failed on a missing module (ERR_MODULE_NOT_FOUND) and was correctly not used as RED.
- **RED, task 2:** target `approach stalled: the abort ends the wait at once with the observed simulation seconds and wall milliseconds`; exit 1, 5 failing of 74, `RED_EVIDENCE_OK`. Semantic assessment: failed on the planned message assertion (the abort was ignored and the wall guard ended the wait); the other four fail on missing exports.
- **GREEN:** after implementation the two files pass 97 of 97; `npm run test:art` 233 of 233. In GREEN the test file was adjusted in three places (a wall guard of 0 that pre-empted the second sample, a reason-text regex, and the forbidden-mixer-assignment regex that matched `mixerTime:`); the same-row tie control was strengthened because the first version was trivially satisfied. No assertion was weakened.

## Tracer result (task 3, run exactly once)

- Archive first: the failed 05:20:38.924Z report copied exclusive-create to `evidence/07-motion-review-tracer-sixth.json`, SHA-256 `dc6b5b6c7ada27d0277a8bae0c5b55307ff4c9e474e5b14a8ebba91822fd84ac`, byte-identical.
- Fresh report: capturedAt `2026-10-10T09:01:35.566Z`, SHA-256 `55c4e4e23ccf4c30f4c7a637d3711e78a0e93c45d1290494551802c99d865202`, 243.7 s wall (not the ~18 minutes estimated), process exit code 1 by design (`complete` false, `plan09Qualified` false, `matrixComplete` false, `actualV2.passed` false).
- Reader checks: `independentTracerComplete: true`, stages in order `accepted-aim`, `earned-resource`, `throw-canceled-reload`, `natural-death`, `natural-respawn`, `menuReturn: true`, `protectedBytesUnchanged: true`, `canceled: false`, `collectionErrors: []`, `pageJournal` empty. Both plan verify commands exited 0.

| Wait | Simulation s (bound) | Wall ms (guard) |
|---|---|---|
| accepted-aim | 1.3 (60) | 9173 (600000) |
| earned-resource | 1.7 (90) | 14908 (900000) |
| throw-canceled-reload | 0.0 (10) | 0 (180000) |
| natural-death | 7.7 (120) | 58797 (1200000) |
| natural-respawn | 2.9 (20) | 15996 (300000) |

Approach `step` kinds seen in the retained progress: `route`, `arrived`. Player hp in the natural-death observations falls 100, 90, 84, 76, 69, 61, 55, 46, 39, 29, 22, 15, 6, 0 with no firing and no collector write (bot damage only). The throw wait met at its first sample (0.0 simulation seconds, 0 wall ms); that is recorded as measured, not as a defect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED for task 1 needed an exporting stub**
- **Found during:** Task 1 - a missing module is a load failure, which is INVALID_RED.
- **Fix:** committed `approach-route.mjs` as a stub exporting the five names so the controls fail on assertions; replaced in GREEN.
- **Commits:** ae45ce7, 44dca0b

**2. [Rule 1 - Bug] Four test defects found while turning RED into GREEN** (see TDD section). Test-only; fixed in the GREEN commits or the immediately following working tree before the commit.

**3. [Interpretation] `approachStep` argument `cell`** is the cell size in metres (needed for the world-to-cell mapping); the player's cell is derived inside. `classifyStall` returns the classification string.

**4. [Interpretation] `approach-fixture-control.mjs` defines its own minimal `__movingSim`/`__movingRead`** because `installObserver` is not exported and exporting it would widen the plan's diff. Its sim clock uses the same 50 ms frame cap.

**Total deviations:** 1 blocking, 1 test-only bug, 2 interpretations. **Impact:** none on evidence or scope.

## Issues Encountered

- The first attempt to apply the capture patch through a long heredoc failed on shell quoting before touching any file; the patch was reapplied from files (CRLF preserved: `git ls-files --eol` still reports `i/crlf w/crlf` for `animation-capture.mjs` and its test).
- `.planning/state.json` and `.planning/config.json` carry unrelated uncommitted changes and `.planning/milestone.lock` is untracked; none was touched or staged.

## For post-execution review

- **Driver change.** In the approach the driver imports `openGrid`/`approachStep` from `/tools/art/approach-route.mjs` through the collector's own Vite server (it loaded without a special mechanism, confirmed by the control), builds the grid once from live `MAP`/`HMAP` at the player's start level, steers to the waypoint with pitch 0, holds W on `route`/`fallback` and releases it on `arrived`/`unreachable`. It sends only `KeyW` keydown/keyup and `mousemove`; it never fires and never holds ADS; nothing writes health, energy, pose, position, action state, AI state or a clock (a source control asserts this). Not changed: `src/` (`git status --short -- src` empty; `src/main.js` still `f768954f...bc393`; `frozen-bytes verify` 26 verified, 0 mismatched), difficulty `recruit`, map `bunker`, the aim-proof, energy and throw waits, every bound and guard, `COLLECTION_LIFETIME_MS` (15600000), and the non-approach branches of `tick` (diff shows them only relocated). Added in progress samples during the approach: `approaching`, `step`, `hostiles`; the 5 s journal line gained `step`.
- **Stall backstop.** `classifyStall` (window 5 simulation seconds, minimum displacement 0.5 m) ends the natural-death wait as `Approach stalled` only when the player is alive, approaching, holding W, on a latest `route` step and displaced under 0.5 m; it does not fire in this passing run. Two edges are left to the 120-second bound on purpose: with no living hostile the `fallback` leg from (34, 46) to (62, 46) can press into solid cell (9, 11) until hostiles respawn, which resolves by itself and must not abort; and `unreachable` or `arrived` release W, so the player stands idle and the wait ends on the bound with the snapshot attached.
- **Fixture control.** `tools/art/approach-fixture-control.mjs` is a command-line collector control, not a `*.test.mjs` file and not in `npm run test:art`. It is the only place that places actors directly (player at (36, 31.93), one hostile at (35.97, 50), every other pool actor parked dead); its record `.planning/research/.cache/07-23/fixture-control.json` carries the label "collector control with directly placed fixture; not moving-review evidence", lives in the gitignored cache and is referenced as evidence nowhere. It exited 0.
- **Stall figures, small samples.** Before the change the old straight-line steer stalled in 2 of 8 observed runs; in the debug session a grid route died naturally in 10 of 10 trials; this plan's tracer adds one more pass (natural death at 7.7 simulation seconds). These are small samples on one map, at Low tier, without a guarantee: the debug trials had no video recording, and this tracer exercised Low once. Plan 07-19 is the first run at Medium and High. A hostile reachable only over a ramp is approached to the nearest flat cell; whether that is always within engagement range is not shown.
- **Known game defects recorded in AGENTS.md as open for a later movement and collision phase** (the files are frozen-gate identities): `astar.js` ignores crack tiles that collision blocks; the TDM defender spawn slot `[1,0]` on `bunker` is a crack cell; player movement probes only the centre and sideways points and misses a leading corner; the friendly-bot shot cooldown counts frames. Also recorded as open: 07-13 review finding G-01 (the CI step `npm run test:art` cannot pass on a fresh checkout; three controls in `animation-budget-v2.test.mjs` need the gitignored cache) must be fixed before any push; no plan in this set fixes it.

## Known Stubs

None.

## Threat Flags

None. The only new network-facing surface is the owned loopback Vite listener the control starts on a strictly bound free port, already the pattern of the collector.

## Next Phase Readiness

Plan 07-19 can read `status: complete` in `07-12-SUMMARY.md`. `complete`, `matrixComplete` and `plan09Qualified` remain false, as expected; human aesthetic acceptance and Medium/High tiers are untouched.

## Self-Check: PASSED

- Files found: `tools/art/approach-route.mjs`, `tools/art/approach-route.test.mjs`, `tools/art/approach-fixture-control.mjs`, `evidence/07-motion-review-tracer-sixth.json`.
- Commits found as ancestors of HEAD: ae45ce7, 44dca0b, 991474d, 5b067f5, 51dd66b, 543f0d7, 38a1b6e.
- Acceptance: `git status --short -- src` empty; control record has the label, `dataAgreement: true`, `reachedEngagementRange: true`, displacement 10.2 m; three summaries `status: complete` and three ROADMAP lines ticked, three changed lines in the diff; `.planning/REQUIREMENTS.md` untouched.
