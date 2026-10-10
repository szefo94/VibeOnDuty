---
phase: 07-movement-matched-and-action-safe-animation
plan: "14"
subsystem: testing
tags: [multiplayer, attribution, playwright, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: plan 07-23 serial host ordering; 07-10 multiplayer diagnosis and failed gate
provides:
  - tools/art/multiplayer-ab.mjs two-arm runner with tested pure classify rule
  - evidence/07-14-mp-ab.json per-run results, controls, verdicts and narrowed commit pair
  - 07-14-MP-ROUTE-DECISION.md owner route source-fix
affects: [07-24, 07-17, 07-18, 07-19]
actuals:
  tokens: 34000
  tasks: 3
  commits: 4
plan_head_before: 5b6b0476ee913815ef6302dc7679ca24c9e9e1e2
plan_head_after: 2b0c7053cf6665effe6174495d6f7e8f5b23c4c2
tech-stack:
  added: []
  patterns: ["Same-session interleaved two-arm attribution with a harness control and a pure verdict rule"]
key-files:
  created:
    - tools/art/multiplayer-ab.mjs
    - tools/art/multiplayer-ab.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-14-mp-ab.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-14-MP-ROUTE-DECISION.md
  modified: []
key-decisions:
  - "Route source-fix, selected by the owner by reference to the recommended option; host_ready none; gap plan 07-24 to be created"
requirements-completed: []
status: complete
---

# Phase 7 Plan 14: Multiplayer attribution and route Summary

One source regression found (time-limit lifecycle, narrowed to the 07-06 to 07-07 step `336099e`..`b1e2801`), seven failing families not reproduced in isolation, four not measured, no host verdict. Owner route `source-fix` leads to gap plan 07-24; `host_ready: none`. The production multiplayer gate is still failed and ANIM-03 is not met.

## Result

| Family | Candidate / reference passes (3 runs each) | Verdict |
|---|---|---|
| lifecycle: time-limit results and rematch | 0/3 vs 3/3 (aed271f) | source |
| tracer, movement, combat, authority, entry, score-limit lifecycle | 3/3 vs 3/3 (aed271f) | not-reproduced (6) |
| animation retirement: two real M4 clients | 3/3 vs 3/3 (e0f78d7) | not-reproduced |
| two `animation authority:` cases and the `feedback:` variant | not run | no-reference (3) |
| hosting: shared HTTPS assets and WSS room | not run | excluded (single ECONNRESET; judged by 07-17) |

Failing titles: 7 not-reproduced, 1 source, 3 no-reference, 1 excluded (12 total). Harness controls passed for `aed271f`, `e0f78d7`, `b1e2801`, `336099e`. No `host` verdict was issued. `limitsChanged: false` (pending queue 8, receipt age 500 ms, acknowledgement age 15 ticks; `git diff aed271f HEAD -- src/shared/protocol.js` is empty).

Narrowing: `336099e` reference 3/3, `b1e2801` 0/3, `e0f78d7` 0/3, giving `lastPassing` `336099e` (07-06) and `firstFailing` `b1e2801` (07-07). The diff covers seven files and no server or network file: `src/builders/characterResources.js`, `enemyGLTF.js`, `firstPersonRig.js`, `firstPersonRig.test.js`, `weaponHandling.js`, `src/combat/shoot.js`, `src/loop.js`. Candidate first errors varied (`TypeError: Cannot read properties of null (reading 'x')` twice, `TimeoutError: locator.click` once), so the pair locates onset, not mechanism.

## Confidence limits

Low to moderate. Three runs per arm; each case run in isolation, while the 2026-10-07 failures came from one full 17-case suite; one host condition. The full suite was not run in this plan; plan 07-17 runs it. "not-reproduced" means the case passed in isolation today, not that the full-suite failure is explained.

## Decision provenance

The orchestrator presented the three routes with the measured table, stated its recommendation (`source-fix`), and asked for a `host_ready` time (`none` allowed). The owner replied: "for now, go with recommended route and try to continue 07, if sometihng needs to be done first, please do". The owner selected the route by reference to the recommendation and did not type the option name, and gave no `host_ready` time. `07-14-MP-ROUTE-DECISION.md` records `route: source-fix`, `decided_by: owner`, `host_ready: none`, `fix_plan: 07-24` (a plan still to be created, not existing) with the quote verbatim.

Consequence: a new gap plan with a failing regression first is needed before 07-17. Any `src/` change invalidates the plan 07-13 candidate, so the timing gate is captured again in 07-18. Of the seven files, `characterResources.js`, `enemyGLTF.js`, `firstPersonRig.js`, `weaponHandling.js` are in `MUTABLE_RUNTIME` of `tools/art/animation-budget-v2.mjs`; `src/combat/shoot.js` and `src/loop.js` are frozen V2 reference identities needing a reviewed exact-hash exception; `firstPersonRig.test.js` is a test file that is also a listed reference identity. Plans 07-17, 07-18 and 07-19 stop at their readiness precondition until the owner states a `host_ready` time.

## Deviations from Plan

Reported by the executor of tasks 1 and 2; no Rule 4 items.

1. **[Rule 3 - Blocking] node_modules junction for the reference arm.** The scratch reference copy needed the plan's own fallback: a directory junction named `node_modules` owned by the scratch directory and removed with it. No install was run.
2. **[Rule 1 - Bug] tar relative-path fix.** The extraction of the reference via `git archive` used a path form tar mishandled on Windows; fixed inside `tools/art/multiplayer-ab.mjs` before any recorded run.
3. **Heuristic field not used.** `sameCaseSource.identical` is a line-range heuristic of the case body and is false for several cases whose spec text changed in Phase 7. No verdict uses it.

Task 07-14-03 was completed after the owner checkpoint by a continuation agent; no auth gates.

## Known Stubs

None.

## For post-execution review

New tool: `tools/art/multiplayer-ab.mjs` (exports `classify`, `materialize`; commands `run` and `control`), tested by `tools/art/multiplayer-ab.test.mjs` (pure `classify` only). It executes historical source extracted into the gitignored cache `.planning/research/.cache/07-14-mp-ab/`, guarded by ancestor check, `boundedPath` and a commit marker. No `src/`, `server/` or `tests/` file changed.

## Self-Check: PASSED

Files present: the four listed in key-files. Commits `455c1fc`, `5532a7b`, `ba82fdc`, `2b0c705` are ancestors of HEAD; the route-decision verify command exited 0.
