---
phase: 07-movement-matched-and-action-safe-animation
plan: "20"
subsystem: art-capture-tooling
tags: [animation-capture, simulation-time, tracer, tdd, gap-closure]
status: complete
requirements: [ANIM-02]
requirements-completed: []
commits: 8
plan_head_before: 3897129937e774e842ae9bcd850b457cbf1edeaa
plan_head_after: becec95dac6626400b586d6dbdd43cb8bd4a42a5
actuals:
  tokens: 12133
  tasks: 3
  commits: 8
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "plan 07-12 simulationBudget/waitSimulation and the partial tracer"
provides:
  - "Tested diagnoseAcquisition rule and the saved-failure classification"
  - "Simulation-bounded aim, energy, throw and row game-event waits"
  - "COLLECTION_LIFETIME_MS 15600000 with acquisitionWaits in the projection"
  - "One fresh tracer report observing all five combat stages"
affects: [07-13, 07-19, 07-12]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-20-aim-timeout-diagnosis.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer-fourth.json
  modified:
    - tools/art/animation-capture.mjs
    - tools/art/animation-capture.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer.json
key-decisions:
  - "Waits on the combat path and game-event rows are bounded in observed simulation seconds with separate wall guards"
  - "The failed 19:29:06.828Z tracer is archived byte for byte and never described as a pass"
coverage:
  - id: D1
    description: "Saved aim-proof timeout classified by a tested pure rule before any wait changed"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "tools/art/animation-capture.test.mjs#acquisition diagnosis (7 controls)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Combat-path and reachable game-event row waits bounded in simulation seconds; lifetime re-derived and pinned"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "npm run test:art (179 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh tracer records accepted aim, earned resource, throw-cancelled reload, natural death and natural respawn with independentTracerComplete true"
    requirement: ANIM-02
    verification:
      - kind: other
        ref: "evidence/07-motion-review-tracer.json (capturedAt 2026-10-09T19:54:33.020Z): five stages observed, independentTracerComplete false"
        status: fail
    human_judgment: false
duration: 28min
completed: 2026-10-09
---

# Phase 7 Plan 20: Simulation-bounded combat waits and the single fresh tracer Summary

**Diagnosis: `still-searching`. Tracer: DID NOT PASS (`independentTracerComplete: false`) although all five combat stages were observed; the plan is `partial` and the gap stays open on one remaining wall wait, the post-union main-menu `#overlay` visibility check.**

## What was done

- **Task 1 (diagnosis).** `diagnoseAcquisition` (exported, pure) was written test-first (7 controls named "acquisition diagnosis", RED `5180ee8`, GREEN `201a4a2`). Applied to the 106 samples of the failed 19:29:06.828Z report it returned `still-searching`: simulation span 5.25 s, wall span 30.2 s (ratio 5.76), absolute route counter 2 (0.5 loop), final-third displacement 7.4 m. Recorded in `evidence/07-20-aim-timeout-diagnosis.json` (`b7b77b8`), source SHA-256 `f552736407d579a273f2b45d8a4d84b7bc67b5f2071f15f3bc604a6ab87eea74`. The stop rule did not trigger.
- **Task 2 (wait conversions).** Controls first (RED `7cfa3a8`), then `5c2e81d`. `waitSimulation` is now exported with an optional label and attaches the final budget to its error as `error.wait`; the plan 07-12 death and respawn messages are byte for byte unchanged (pinned by a control). New exports: `AIM_PROOF_SIM_SECONDS` 60 / `AIM_PROOF_WALL_GUARD_MS` 600000, `ENERGY_SIM_SECONDS` 90 / `ENERGY_WALL_GUARD_MS` 900000, `THROW_SIM_SECONDS` 10 / `THROW_WALL_GUARD_MS` 180000, `ROW_ACTION_SIM_SECONDS` 10 / `ROW_ACTION_WALL_GUARD_MS` 180000, `describeAimProofExpiry`. An aim-proof expiry appends the `diagnoseAcquisition` classification, absolute route count, whole loops and the wait's own total simulation seconds. `COLLECTION_LIFETIME_PROJECTION.energyAndThrow` became `acquisitionWaits: 5040000`; sum 15452931; `COLLECTION_LIFETIME_MS` 15600000 (was 11400000, sum 10862931). `node --test` 61 pass, `npm run test:art` 179 pass. `git status` for `src`, `review.mjs`, `moving-online.mjs`, `animation-budget-v2.mjs` is empty.
- **Task 3 (tracer).** The failed report was copied with an exclusive-create flag to `07-motion-review-tracer-fourth.json` (identical SHA-256 `f552736407d579a273f2b45d8a4d84b7bc67b5f2071f15f3bc604a6ab87eea74`, `capturedAt` 2026-10-09T19:29:06.828Z, `independentTracerComplete: false`; commit `1c6cc7d`). `node tools/art/review.mjs --animation-capture --tracer` was run exactly once: started 19:54:30Z, ended 20:12:51Z (18 min 21 s, report `durationMs` 1099195), **exit code 1**. The fresh report (`capturedAt` 2026-10-09T19:54:33.020Z, SHA-256 `b8508017612141be8de65331715a72aab4ebe3c57d6d51702c7c78cb197c9911`, commit `7b94352`) was kept as written. Not rerun.

## Tracer result (the gap is NOT closed)

Stages in `offlineCombat[0]` (`complete: true`): `accepted-aim`, `earned-resource`, `throw-canceled-reload`, `natural-death`, `natural-respawn`, in that order. Both reader checks were run: the first `07-20-03` verify command exits 1 (`independentTracerComplete` is `false`); the archive/summary consistency command exits 0 (archive is the failed run; `07-12-SUMMARY.md` is untouched at `status: partial`).

Why `independentTracerComplete` is false: `collectionErrors` is not empty. After the union logged "qualified earned grenade/damage/death/respawn", the post-union return to the main menu failed:

```
stage eligible-combat, tier low: locator.waitFor: Timeout 45000ms exceeded.
  waiting for locator('#overlay') to be visible
  26 x locator resolved to hidden <div id="overlay">
```

That is `await page.locator('#overlay').waitFor({state:'visible'})` in `collectCombat`, one of the waits listed below as left on wall time (a page/interface readiness check, not a game event). `entry.menuReturn` was therefore never set. The earlier archived third tracer (2026-10-07) also carried one collection error, so this wait has not yet been shown to pass in a tracer. The cause (whether the pause main-menu click ran, or `#overlay` stays hidden after `returnToMainMenu()` in this adapter/state) was not investigated here and is not known. `complete`, `matrixComplete`, `plan09Qualified` remain false and `protectedBytesUnchanged` is true.

The aim-proof classification is not applicable to this run (a proof was accepted); the earlier hypothesis is supported: the aim proof needed 5.25 simulation seconds but 44.2 wall seconds, which the old 30000 ms wall wait could not have covered.

Measured waits of the fresh tracer (Low, one run):

| Wait | Simulation s observed | Wall ms | Simulation bound / wall guard | Wall / sim ratio |
|---|---|---|---|---|
| accepted-aim | 5.25 | 44167 | 60 s / 600000 ms | 8.41 |
| earned-resource (energy) | 6.90 | 60230 | 90 s / 900000 ms | 8.73 |
| throw-canceled-reload | 0.00 | 0 | 10 s / 180000 ms | n/a (condition already true at the first poll) |
| natural-death | 6.00 | 50780 | 120 s / 1200000 ms | 8.46 |
| natural-respawn | 1.35 | 8060 | 20 s / 300000 ms | 5.97 |

The measured ratio on this host in this run was 6.0 to 8.7, higher than the 5.8 to 7 assumed in the plan.

## For post-execution review

Changes follow `07-10-CONTINUATION.md`'s note that no further blind combat tuning was authorized: they alter how long the collector waits for unchanged game events and alter no input, difficulty, damage, route or game state. The driver, its 256-sample buffer and `route` counter, all awaited conditions, stage names and `resourceAuthority` are untouched.

### Waits changed (old wall bound, new simulation bound, new wall guard)

| Function | Awaited condition | Old wall bound | New |
|---|---|---|---|
| earnedCombatUnion | aim proof (`__combatDriverProgress().some(aimProof)`) | explicit 30000 | 60 sim s / 600000 ms |
| earnedCombatUnion | grenade energy `>= 100` | explicit 120000 | 90 sim s / 900000 ms |
| earnedCombatUnion | throw without reload at energy 0 | explicit 30000 | 10 sim s / 180000 ms |
| earnedCombatUnion | natural death, natural respawn | plan 07-12 | unchanged (120 s / 1200000 ms, 20 s / 300000 ms) |
| weaponSegment | ADS settled | inherited 45000 | 10 sim s / 180000 ms |
| weaponSegment | ammo decrease | inherited 45000 | 10 sim s / 180000 ms |
| weaponSegment | reload completion | explicit 30000 | 10 sim s / 180000 ms |
| sharedMovementUnion | directional moving (x4 keys) | inherited 45000 | 10 sim s / 180000 ms |
| sharedMovementUnion | sprint | inherited 45000 | 10 sim s / 180000 ms |
| sharedMovementUnion | crouch | inherited 45000 | 10 sim s / 180000 ms |
| sharedMovementUnion | jump and landing | explicit 30000 | 10 sim s / 180000 ms |
| sharedMovementUnion | melee | inherited 45000 | 10 sim s / 180000 ms |
| blockedWalkUnion | blocked stationary feet | explicit 30000 | 10 sim s / 180000 ms |
| blockedWalkUnion | return to start z | explicit 30000 | 10 sim s / 180000 ms |
| previewChain | review preview phase `>= .95` | explicit 30000 | 10 sim s / 180000 ms |

`previewChain`'s phase wait was converted: `src/dev/animationReview.js` advances the isolated review clock by `Math.min(.05, dt)` (the same capped frame delta as the observer's `__movingSim`).

### Waits deliberately left on wall time

| Function | Awaited condition | Wall bound | Reason |
|---|---|---|---|
| collectOffline (x2), collectCombat | start button enabled | inherited 45000 | page/asset readiness before a mode is entered, not a game event |
| previewChain | `Play transition` button visible, then enabled | inherited 45000 | interface readiness |
| collectCombat | `#overlay` visible after menu return | inherited 45000 | interface visibility, not a game event. **This is the wait that failed in the fresh tracer** |
| locator clicks (`click`, selects) | Playwright actionability | inherited 45000 | not game events |
| executeV2 | subprocess timeout | its own | not a game wait |
| moving-online.mjs `until`/`walk` | online match | 15000 / 45000 | server wall clock; plan 07-14's subject; file not edited |
| waitAnimation, actualChain, offlineCombatUnion | various | various | **defined but called from nowhere** (see deviations); untouched |

### Ratio assumption behind the 10-second row bound

Ten simulation seconds allows more game time than the old 30 or 45 wall seconds only while the wall-to-simulation ratio is above 3 to 4.5. Measured here: 5.8 (failed run), 6.0 to 8.7 (this run). On a host near ratio 1 the simulation bound would be the tighter one, still several times the longest awaited row event (a reload of about 1.8 to 3 simulation seconds). The 180000 ms row wall guard exceeds every old wall bound.

### Collection lifetime

Old: projection `{recordedMatrix 3754085, fallbackRows 358846, combatUnions 4500000, energyAndThrow 450000, onlineUnions 1800000}`, sum 10862931, `COLLECTION_LIFETIME_MS` 11400000. New: `energyAndThrow` replaced by `acquisitionWaits 5040000` (3 x (600000 + 900000 + 180000)); the other four figures unchanged; sum 15452931; `COLLECTION_LIFETIME_MS` 15600000 (260 minutes). The per-tier combat-path guard sum is 3180000. Row wall guards are not added (rows are covered by the recorded matrix duration). Plan 07-19's precondition reads this figure.

## Deviations from Plan

**1. [Plan inaccuracy] actualChain waits not converted.** The plan lists the landing, reload-completion and action-idle waits in `actualChain` for conversion, but `actualChain` (and `waitAnimation`, which only it calls) is not called from `captureAnimationReview`; it is unreachable, like `offlineCombatUnion`. The plan's own inventory rule limits conversion to reachable waits, so they were left untouched and listed above.

**2. [Rule 1 - Bug] RED stub export in Task 1.** A bare missing-export import would be an invalid RED (load failure), so the RED commit adds a stub `diagnoseAcquisition` returning `unimplemented`; GREEN replaced it. Task 1's "adds only the exported diagnoseAcquisition" holds for the net diff.

**3. [Rule 1 - Bug] Line endings.** A `sed -i` step rewrote the controls file with LF; restored to CRLF in `becec95` (`git diff -w` empty; net diff versus base is minimal). `animation-capture.mjs` stayed CRLF throughout.

**4. [Test correction] Wall-guard control.** Its first expectation said "observed 0.2 simulation seconds"; with a zero guard the first poll is the only sample, so the (unchanged) message correctly says 0.0. Corrected in the control within the GREEN commit.

**Total deviations:** 4 (1 plan inaccuracy, 2 bug/tooling, 1 test correction). **Impact:** none on game inputs or evidence; deviation 1 leaves dead code on wall time.

## Issues Encountered

The single authorised tracer failed on the post-union menu-return `#overlay` wait (details above). Per the plan it was not rerun, no bound or guard was raised, and `07-12-SUMMARY.md` was left at `status: partial`. **Gap is open.** Suggested new gap for the planner: find why `#overlay` is hidden after `#pause-mainmenu-btn` click following the combat union (and whether that wait belongs to the collector's tracer acceptance), then spend one more tracer.

## Known Stubs

None.

## Authentication Gates

None.

## Self-Check: PASSED

- Files exist: `07-20-aim-timeout-diagnosis.json`, `07-motion-review-tracer-fourth.json`, `07-motion-review-tracer.json`, `animation-capture.mjs`, `animation-capture.test.mjs`.
- Commits present: `5180ee8`, `201a4a2`, `b7b77b8`, `7cfa3a8`, `5c2e81d`, `1c6cc7d`, `7b94352`, `becec95`. TDD gates: RED `test(07-20)` precedes GREEN `feat(07-20)` for both tasks.
- `npm run test:art`: 179 pass, 0 fail. `git status --short` for `src`, `review.mjs`, `moving-online.mjs`, `animation-budget-v2.mjs` is empty.
- The self-check passing means the claims above were verified, not that the tracer passed: the tracer did not.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-09 (status: partial)*

## Tracer acceptance met by plan 07-23 (2026-10-10)

Plan 07-23 spent its single fresh tracer capture (`node tools/art/review.mjs --animation-capture --tracer`). The report `evidence/07-motion-review-tracer.json` (capturedAt `2026-10-10T09:01:35.566Z`, SHA-256 `55c4e4e23ccf4c30f4c7a637d3711e78a0e93c45d1290494551802c99d865202`) has `independentTracerComplete: true`, the five combat stages `accepted-aim`, `earned-resource`, `throw-canceled-reload`, `natural-death`, `natural-respawn` in order, `menuReturn: true`, `protectedBytesUnchanged: true` and empty `collectionErrors`. The driver change that made the approach reach a natural death is commit `5b067f5` (route steer, early stall failure, approach diagnostics).

07-20 its own part was the other simulation bounds and the five-stage observation of the tracer. The tracer exercised the Low tier once; Medium and High are first run by plan 07-19. The runs of 2026-10-09T19:29:06.828Z, 2026-10-09T19:54:33.020Z and 2026-10-10T05:20:38.924Z remain failed runs, archived as `evidence/07-motion-review-tracer-fourth.json`, `-fifth.json` and `-sixth.json`. `complete`, `matrixComplete` and `plan09Qualified` stay false in the fresh report. No requirement is marked complete by this change. All earlier sections, including each "Tracer result" section, are kept above unchanged as history.
