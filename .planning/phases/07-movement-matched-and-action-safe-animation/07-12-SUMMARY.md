---
phase: 07-movement-matched-and-action-safe-animation
plan: "12"
subsystem: art-capture-tooling
tags: [animation-capture, simulation-time, tracer, tdd]
status: complete
requirements: [ANIM-02]
commits: 3
plan_head_before: 951506c9496905b70d7aa24ca6b5233a8c7aa252
plan_head_after: b16aab99732f7836ae93c04d94d2e41b064e6b66
key-files:
  modified:
    - tools/art/animation-capture.mjs
    - tools/art/animation-capture.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer.json
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer-third.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/red/07-12-red-record.json
actuals:
  tokens: 14000
  tasks: 1.5
  commits: 3
---

# Phase 7 Plan 12: Simulation-bounded natural death and respawn waits - Summary

Status: PARTIAL. The collector change and its controls are done and green, but the single permitted tracer run did not reach the natural death or respawn waits, so the tracer acceptance (`independentTracerComplete: true`, `natural-death` and `natural-respawn` stages) is NOT met.

## What was built

- `tools/art/animation-capture.mjs`: exported `simulationBudget` (met / sim-expired / pending), `NATURAL_DEATH_SIM_SECONDS` 120, `NATURAL_RESPAWN_SIM_SECONDS` 20, `NATURAL_DEATH_WALL_GUARD_MS` 1200000, `NATURAL_RESPAWN_WALL_GUARD_MS` 300000, `COLLECTION_LIFETIME_PROJECTION`, `COLLECTION_LIFETIME_MS`, and `independentTracerComplete` (the existing predicate extracted unchanged; the report field now calls it). Observer samples carry `simSeconds` (running sum of `min(frame interval, 0.05)`, the cap read from `src/loop.js` line 75). Only the two waits after `__combatDriverApproach()` were replaced; wall-guard expiry throws `Wall guard expired before the simulation bound ...`, simulation expiry throws `Natural death|respawn did not occur within N simulation seconds ...`. Each natural stage now records its `wait` (simulation seconds, wall ms, bounds).
- Collection lifetime: old `90 * 60 * 1000` = 5,400,000 ms (90 min). New 11,400,000 ms (190 min), the projection sum rounded up to the next 600000. Projection figures: recordedMatrix 3754085, fallbackRows 358846, combatUnions 4500000, energyAndThrow 450000, onlineUnions 1800000; sum 10862931.
- `offlineCombatUnion` still has wall-bounded 60000/45000 death and respawn waits but is defined and never called anywhere (`grep` finds only its definition); it was left untouched as the plan directs.
- No `src/` change (`git diff --stat -- src/` empty). No health, energy, pose, position, action or clock write was added.

## TDD

- RED (`6021108`): 8 controls plus stub exports. Target `simulation budget is met when a satisfying sample exists at or before the limit` failed on the planned assertion (`'pending' !== 'met'`); 7 tests failed in total (met, sim-expired, after-limit, pending, invalid samples, lifetime, tracer-without-respawn), 40 passed. `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: target executed and failed on the planned outcome assertion against the stub; no load, syntax or fixture fault. Record: `evidence/red/07-12-red-record.json`.
- GREEN (`f2d4a2f`): `node --test tools/art/animation-capture.test.mjs` 47/47 pass; `npm run test:art` 165/165 pass. No refactor commit.
- Ordering deviation: the plan lists the tracer task first, but the tracer needs the implementation, so the RED controls were committed first, then implementation, then the one tracer run.

## Tracer result (the gap is NOT closed)

`node tools/art/review.mjs --animation-capture --tracer` was run exactly once (145.6 s wall, exit 1). New `capturedAt` 2026-10-09T19:29:06.828Z. Outcome: `independentTracerComplete: false`, `offlineCombat: [{complete: false, stages: []}]`, `canceled: false`, `protectedBytesUnchanged: true`, `collectionErrors: [{stage: 'eligible-combat', tier: 'low', error: 'page.waitForFunction: Timeout 30000ms exceeded.'}]`.

The failing wait is the unchanged 30000 ms WALL `accepted-aim` gate (`__combatDriverProgress().some(s => s.aimProof)`), which precedes both new waits. In that window the bot walked its route with no visible target (`visible:false`, `aimProof:null`) while the game advanced only about 7 mixer seconds (mixer 3.45 s at 21 wall s, 7.85 s at 46.7 wall s; observer `simSeconds` 1.8 at 21 wall s). Matrix, movement, shared-movement and preview entries were all complete. This supports the wall-versus-simulation-time cause (the game runs several times slower than wall time) and does not contradict it, but it shows a further wall-bounded wait ahead of the death wait. The plan says to leave the aim-proof gate (and the energy 120000 ms and throw 30000 ms waits) unchanged, forbids a second tracer run, and says to keep the partial report and stop. Natural death and respawn simulation/wall times could therefore not be measured (no death wait started).

Archive: `07-motion-review-tracer-third.json` SHA-256 `c3c371bf36b449a9760a916b673988507fb59187543e6dfd51e1cef88f3fc5aa`, identical to the pre-run tracer. The overwritten `07-motion-review-tracer.json` is the partial report above.

## Deviations from Plan

None to code beyond the commit ordering noted above. The stop condition triggered; nothing was widened.

## Self-Check

- Exports present and `COLLECTION_LIFETIME_MS` = 11400000, projection sum 10862931 (verified by import): PASSED.
- `90 * 60 * 1000` literal removed: PASSED.
- Commits 6021108, f2d4a2f, b16aab9 reachable from HEAD: PASSED.
- Tracer acceptance (`independentTracerComplete`, natural stages): FAILED (see above).

## Known Stubs

None.

## For post-execution review

Collector waits were changed after `07-10-CONTINUATION.md` recorded that no further blind combat tuning was authorized. The change is evidence-based, not gameplay tuning: the recorded 158-second movie showed about 15 game seconds elapsed, and this run again showed the game advancing a small fraction of wall time (observer 1.8 simulation seconds at 21 wall seconds). A 60 wall-second death wait therefore bounds wall time, not the game events it is meant to observe. The change measures the game's own capped frame intervals (read only), adds no input, damage, difficulty change or state write, leaves the aim-proof, energy and throw waits and every acceptance predicate unchanged, and adds distinct non-passing outcomes for simulation expiry and wall-guard expiry. Recommended follow-up (new gap, not done here): the 30000 ms wall `accepted-aim` gate and the 120000 ms wall energy wait are subject to the same slowdown and need the same simulation-time treatment before a tracer can reach the natural death wait.

## Tracer acceptance met by plan 07-23 (2026-10-10)

Plan 07-23 spent its single fresh tracer capture (`node tools/art/review.mjs --animation-capture --tracer`). The report `evidence/07-motion-review-tracer.json` (capturedAt `2026-10-10T09:01:35.566Z`, SHA-256 `55c4e4e23ccf4c30f4c7a637d3711e78a0e93c45d1290494551802c99d865202`) has `independentTracerComplete: true`, the five combat stages `accepted-aim`, `earned-resource`, `throw-canceled-reload`, `natural-death`, `natural-respawn` in order, `menuReturn: true`, `protectedBytesUnchanged: true` and empty `collectionErrors`. The driver change that made the approach reach a natural death is commit `5b067f5` (route steer, early stall failure, approach diagnostics).

07-12 its own part was the simulation-bounded natural death and respawn waits with their wall guards. The tracer exercised the Low tier once; Medium and High are first run by plan 07-19. The runs of 2026-10-09T19:29:06.828Z, 2026-10-09T19:54:33.020Z and 2026-10-10T05:20:38.924Z remain failed runs, archived as `evidence/07-motion-review-tracer-fourth.json`, `-fifth.json` and `-sixth.json`. `complete`, `matrixComplete` and `plan09Qualified` stay false in the fresh report. No requirement is marked complete by this change. All earlier sections, including each "Tracer result" section, are kept above unchanged as history.
