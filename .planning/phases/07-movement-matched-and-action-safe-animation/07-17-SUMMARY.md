---
phase: 07-movement-matched-and-action-safe-animation
plan: "17"
subsystem: testing
tags: [stable-gates, playwright, vitest, multiplayer, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: plan 07-24 test-only lifecycle fix, 07-14 source-fix route, 07-18 identity-width decision (keep)
provides:
  - tools/art/stable-gates.mjs run/check tool with GATES and buildRecord, and its 7+ controls
  - current-source stable-gate record: six of seven gates exit 0, offline gate exit 1 (record complete false)
  - creator recovery evidence bound to the promoted motion tuple, original-tuple record retained
affects: [07-18, 07-19]
status: halted
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: fecdb048be58eb9065e3d559fb09291466406c57
plan_head_after: 8eba56cb00e8685668ee5772d6aa180bfdfc2a08
requirements-completed: []
duration: segment B 41 min of runs (offline 24.3 min, multiplayer 16.2 min)
completed: 2026-10-10
---

# Phase 7 Plan 17: Stable Gates Summary

**Stable gates are NOT complete: lint, typecheck, typecheck:mp, build, unit and the 18-case production multiplayer suite exit 0 at the current identity, but the full offline suite exited 1 (137 passed, 1 failed), so `requireStableGates` still refuses the record.**

Status is `halted`: the plan's success criterion (`check --only stable` exits 0) is not met and 07-17 must not be ticked. `commits: 4` is the measured count from the ledger and includes orchestrator commit 57f049c (decision records); three are this plan's own.

## Gate results (record `evidence/07-10-stable-gates.json`, identity `c1b06272...2c57`, `complete: false`)

| Gate | Exit | Duration | Counts |
|---|---|---|---|
| lint | 0 | 1.9 s | as recorded |
| typecheck | 0 | 2.3 s | as recorded |
| typecheck:mp | 0 | 2.0 s | as recorded |
| build | 0 | 1.3 s | as recorded |
| unit | 0 | 132 s | 323 passed, 0 failed, 0 skipped, 31 files |
| offline | **1** | 24.3 min | 137 passed, **1 failed**, 0 skipped, 0 flaky (138 cases) |
| multiplayer | 0 | 16.2 min | 18 passed, 0 failed, 0 skipped, 0 flaky |

Segment B (observed by me): offline and multiplayer, one invocation, `CI` unset, no timeout changed, 2026-10-10 21:20 to 22:01 +02:00. Rows lint to unit come from segment A's record and logs (commit 6daf909), not observed by me; the record kept them because the identity was unchanged (`recordIdentitiesCurrent: true`) and their log hashes still match. Run reports: `.planning/research/.cache/07-17-gates/offline-report.json` (sha256 `ae58fc6e...1cb8c`) and `multiplayer-report.json` (sha256 `b79c410c...37b7`).

### The failing case

`tests\action-lifecycle.spec.js:40:3 › throw: cancels reload before award with 1ms remaining` (30.1 s, the first test of the run).

First error: `Test timeout of 30000ms exceeded while running "beforeEach" hook.` then `expect(locator('#range-startbtn')).toBeEnabled() failed ... Received: disabled ... <button disabled id="range-startbtn">LOADING...</button>`. The same title with 0ms and -1ms remaining passed (17.6 s, 4.6 s). This matches a cold-start (first test, asset load) timeout, which `07-11-SUMMARY.md` records as a warm-up concern; it was NOT diagnosed as such by a rerun. Per the dispatch rules no rerun, retry, test edit or timeout change was made. The 30 s per-test limit is the owner-informed default for a normal local run.

### Entries for plan 07-18

- `throw: cancels reload before award with 1ms remaining`: **failed** (above), so it cannot be recorded as passed.
- `repeated character removal frees instance GPU allocations and preserves live shared geometry` (`tests\animation-regressions.spec.js:101`): **passed** (3.2 s).
- All 10 `tests/animation-review.spec.js` entries in the log show passed (0 failed), taken from the log, not the JSON report.

## Task commits

1. Task 07-17-01 (tool, controls, five fast gates): `6daf909`
2. Task 07-17-02 (creator recovery re-verified, original record kept): `1e832fb`
3. Task 07-17-03 (offline and multiplayer record, gate failed): `8eba56c`

## Verification after the run

- `check --only stable`: exit 1, `stableGateBlocker: "Nonpassing stable gate: offline"`, `recordIdentitiesCurrent: true`.
- Full `check`: exit 1, same blocker, `plan09Qualified: false` ("Plan09 is missing, halted or unqualified"), expected and left to plan 07-18.
- `npm run test:art`: 625 pass, 0 fail (run after the suites exited).
- `frozen-bytes.mjs verify`: 26 verified, 0 mismatched.
- `git status --short -- src server tests playwright.config.js playwright.multiplayer.config.js`: empty. The three pinned tool hashes are unchanged (`584bd4ca...`, `fad42d2e...`, `20884fee...`). `evidence/07-paired-session-registry.json` blob equals its HEAD blob (`16822d99...`).

## Segment A results (from commits and records, not observed by me)

The tool `stable-gates.mjs` (GATES, buildRecord, run, check; plan 09 called once with three arguments) and `stable-gates.test.mjs` were committed in 6daf909. The superseded 2026-10-07 record is archived byte for byte (sha256 `01fab6d9...150e`). Task 2 (1e832fb): self-test, `motion-pipeline recover --demo`, `iterate --demo` and `verify-export --iteration` all exit 0; `07-motion-recovery.json` names GLB `2a6bbab2`, donor `3d1702cc`, manifest `2b571250`, 48 + 59 = 107 clips, `complete: true`; the old record kept as `07-motion-recovery-original-tuple.json` (sha256 `27caaec9...7914`); nothing published.

## Deviations from Plan

None in code. One outcome deviates from the plan's expected result: the offline gate did not pass (see above); the record is left showing the real exit code as the plan directs.

## Known Stubs

None.

## Issues Encountered

The offline gate failure above. Not diagnosed beyond the report text; whether it is cold-start flakiness or a defect is open.

## Not verified

- Whether the failing case passes in isolation or on a second full run (deliberately not rerun).
- Counts and durations of lint, typecheck, typecheck:mp and build beyond the record; host state during segment A.
- Host preparation: the owner stated "now" at 21:18:47 +02:00; I did not inspect other load on the machine.
- Plan 09 qualification, paired timing, animation capture, human aesthetic acceptance.

## Next Phase Readiness

Blocked: the owner or orchestrator must decide how to treat the first-test offline timeout (a full rerun of `--gates offline` is a new, separately recorded result and is not part of this run). Plans 07-18 and 07-19 depend on `stableGatesPass: true`.

## Self-Check: PASSED

Commits 6daf909, 1e832fb and 8eba56c are ancestors of HEAD; the record file exists and matches the commit.
