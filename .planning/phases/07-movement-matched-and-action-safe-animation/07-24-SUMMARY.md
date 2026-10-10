---
phase: 07-movement-matched-and-action-safe-animation
plan: "24"
subsystem: testing
tags: [multiplayer, lifecycle, playwright, gap-closure, test-only]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: plan 07-14 source verdict and source-fix route for the time-limit lifecycle case
provides:
  - tests/multiplayer.spec.js time-limit case without a deadline race, score case owning the path-independent tail, new rematch-results release case
  - evidence/07-24-lifecycle-fix.json 8, 5 and 5 isolated runs with margins
affects: [07-17]
actuals:
  tokens: 22000
  tasks: 2
  commits: 2
plan_head_before: f6592a9305e44ef4662926797ce5251091670441
plan_head_after: b07595d842a2c96fb1e389a0ea5c894d679602ab
tech-stack:
  added: []
  patterns: ["In-page observation recorder read after the fact, so test speed cannot race a match deadline"]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-24-lifecycle-fix.json
  modified:
    - tests/multiplayer.spec.js
    - AGENTS.md
key-decisions:
  - "Restructure assertion ownership instead of raising matchSeconds; no source, server, helper or timeout change"
requirements-completed: []
status: complete
---

# Phase 7 Plan 24: Lifecycle test deadline fix Summary

Runs: 18 of 18 passed in isolation (time-limit 8/8, score-limit 5/5, new release case 5/5), plus the task 1 time-limit run (1/1).
Largest lateness across the 8 time-case runs, presentation and Resume, client a: 0 ms and 0 ms; client b: 0 ms and 0 ms, against the 1500 ms bound. Every fact already held on the first generation-2 tick, so the bound was never approached.

The plan 07-14 `source` verdict was a correct observation: the cause is a test deadline (a 6-second match that the rematch preserves, with about 25 frame-bound steps still running when generation 2 ended) exposed by a legitimate rendering cost, not a product defect. No file under `src/`, `server/` or `tests/helpers/` changed (`git status --short -- src server tests/helpers` empty), so the plan 07-13 frozen-gate candidate still describes current source. `requirements-completed` stays empty; ANIM-03 needs the plan 07-17 full gate.

## Measured margins

| Case | Runs | Result | Margin |
|---|---|---|---|
| time-limit | 8 | 8 passed (26.2 to 27.3 s each) | smallest results window left after the join block 5967 ms of 15000; lateness 0 ms everywhere |
| score-limit | 5 | 5 passed | tail 6.7 to 7.0 s (largest 7014 ms) against a 180 s match; the debug session had measured 5.3 to 5.9 s |
| release case | 5 | 5 passed (about 81 s each) | smallest match time remaining at lock 25067 ms, required above 5000 ms |

Evidence: `evidence/07-24-lifecycle-fix.json` (report hashes, `red` pointer to the 07-14 file hash `26dc7101...`, unmodified). The recorder did not need reinstalling (no `recorder-reinstalled` annotation in any run).

## Deviations from Plan

None - plan executed as written. Notes: the `#mp-resume` and results visibility in the recorder use `hidden`, computed display/visibility and `getClientRects()` so an ancestor hidden state also counts as hidden. The new case does not set `VOD_COMBAT_SEED` (the plan did not list it). The unchanged-in-score-case branch `if (path === 'score')` around remote-actor checks was folded into the score block, behaviour identical.

## For post-execution review

Ownership (the one stated difference: on the switched client the pause-layout check is not repeated, and it leaves from the results screen, not from the pause menu):

| Assertion group | Lives in |
|---|---|
| Draw on time limit, results duration from deadline, results screen both clients | time case, unchanged |
| Solo results switch, replacement joins smaller team | time case, unchanged |
| Rematch state facts | time case from recorder `firstActive` snapshot; score case direct polling |
| Rematch presentation and `#mp-resume` visible | time case via recorder, 1500 ms bound; score case retrying expectations |
| Resume capture, pause menu right of controls by 8 px, Leave with kills 0 | score case both clients; new case on replacement client |
| Switched client capture, then results of rematched match release pointer and hide `#mp-resume`, `#pause-menu` | new case |

Every `boundingBox()` result now has a named non-null assertion. Original titles are unchanged; the new title is listed by `--list`.

Frame-rate finding (labelled limits): first-person view meshes are drawn whenever the local player is online and alive, including on results; under software rendering one debug session measured about 25 to 30 percent of the frame rate (13.0 fps vs 14.6 to 14.8 before plan 07-07). Not measured on a real GPU; the dominant part was not split. UNVERIFIED hypothesis: this cost contributes to the plan 07-13 frozen V2 numeric failure and other tight-window multiplayer cases; a reduction confined to the five mutable builders is conceivable but changes frozen-budget view evidence and needs its own plan and review.

Not measured: the three `animation authority` multiplayer cases have no reference arm. Deferred: a unit control that a rematch preserves `matchSeconds` belongs in `src/shared/tdmRules.test.js`, a frozen identity, so it is not written. Limits: isolated headless software-rendering runs on one host; the full suite is not run here; eight runs bound a residual race only loosely, the structural argument (nothing after the rematch is bounded by the 6-second match) is the proof. The 0 ms lateness also means background-page throttling was not exercised by this case. The `evidence/07-14-mp-ab.json`, `07-14-SUMMARY.md` and `07-14-MP-ROUTE-DECISION.md` records are unmodified; `host_ready` remains `none`.

## Known Stubs

None.

## Self-Check: PASSED

Files exist (`tests/multiplayer.spec.js`, evidence JSON, AGENTS.md note); commits `b2c3188` and `b07595d` are ancestors of HEAD.
