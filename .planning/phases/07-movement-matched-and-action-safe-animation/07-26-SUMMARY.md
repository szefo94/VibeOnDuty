---
phase: 07-movement-matched-and-action-safe-animation
plan: "26"
subsystem: testing
tags: [moving-collector, online-route, control, collector-review, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-18 plan 09 qualification on the paired route; 07-19 first strict capture, partial on the online route (report at 0d12fd6)"
provides:
  - "tools/art/online-route.mjs: pure, tested route helper for the collector's online route"
  - "tools/art/moving-online.mjs: hold-and-release walker, bounded input retries, 600 s match, 540000 ms tier deadline, additive leg, timing and failure fields"
  - "tools/art/moving-online-control.mjs: labelled non-evidence control running the real collector function, with a pure reader (judge)"
  - "07-26-COLLECTOR-REVIEW.md: independent review (opus, medium), verdict approved with notes, bound to five file hashes"
  - "AGENTS.md: online route note, low-frame-rate input finding, paired qualification state"
affects: [07-19, netcode, moving-capture]
actuals:
  tokens: 34497
  tasks: 3
  commits: 8
plan_head_before: 80835ae7d5e68f63efffd0eb2b0c1316e470f118
plan_head_after: 1ac9a79a4a8392c472e7e62cde4ef0d7ebb52491
tech-stack:
  added: []
  patterns: ["route numbers live in one pure module tested on the real shared map", "control records bind to file hashes and to a criterion version", "review record bound to the bytes that will run"]
key-files:
  created:
    - tools/art/online-route.mjs
    - tools/art/online-route.test.mjs
    - tools/art/moving-online-control.mjs
    - tools/art/moving-online-control.test.mjs
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-26-COLLECTOR-REVIEW.md
  modified:
    - tools/art/moving-online.mjs
    - AGENTS.md
key-decisions:
  - "The control's stop criterion was changed after run-04 had failed on the old one (Amendment 2, decided by the orchestrator under the owner's standing instruction; the owner did not separately approve it)"
  - "The review approved the collector bytes with five warnings and six notes; no code change before the strict capture"
  - "The low-frame-rate input loss is recorded as a game finding for a later netcode phase and is not fixed"
  - "No requirement is marked complete by this plan"
requirements-completed: []
requirements-mapped: [ANIM-02, ANIM-03]
requirements-status: pending
coverage:
  - id: D1
    description: "Pure route helper with unit tests on the real bunker map"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "npm run test:art (669 pass, 0 fail, 2026-10-11 03:31 local; includes online-route.test.mjs and moving-online-control.test.mjs)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The collector's online route completes on Low, Medium and High in the final control series run-05, run-06, run-07 and warm-01 (35 minute warm-up), under stop criterion version 2"
    requirement: ANIM-02
    verification:
      - kind: other
        ref: "node tools/art/moving-online-control.mjs --read run-05,run-06,run-07 --tiers low,medium,high (exit 0) and --read warm-01 (exit 0); control output, not evidence"
        status: pass
    human_judgment: true
    rationale: "The criterion was changed after a failing run was seen and measures no margin (review I-06, W-02). Whether that is enough is for the owner; the strict capture of plan 07-19 is the real test."
  - id: D3
    description: "Independent review of the collector change bound to the file bytes; gate identity and pinned hashes unchanged"
    requirement: ANIM-03
    verification:
      - kind: other
        ref: "task 3 record check (exit 0), pinned-hash check (exit 0), node tools/art/stable-gates.mjs check (exit 0, identity equal to identity-before.txt), git diff --quiet 0d12fd6..HEAD over protected paths (exit 0)"
        status: pass
    human_judgment: false
duration: about 1h 55m of executor work across two agents (first commit 01:42 local, summary 03:35 local)
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 26: Collector Online Route Summary

**The final control series passed (run-05, run-06, run-07 and warm-01 after a 35 minute warm-up, all three tiers each), but only under a stop criterion that was changed after run-04 had failed; the independent review says `verdict: approved` with five warnings and six notes; `identitySha256` is `c1b062729e765c0086c4c9c283170cf2da3e65044ff4eeacd66937899cbc2c57` before and after.**

## Read this first: the stop criterion was changed after a failing run

- Run-04 failed the criterion in force when it ran (stop step 3.31 m above `MAX_STOP_STEP_M` 3.12).
- After that failure the criterion was replaced (Amendment 2 in `07-26-PLAN.md`, commit `e803853`). Run-04 would pass the new criterion.
- The change was decided by the orchestrator under the owner's standing instruction to follow the recommended route. **The owner did not separately approve it.**
- Both of the single changes the plan allowed were used: the tracer's one change (`559b953`, after tracer-high failed) and the series' one change (`773be68`, after run-02 failed). The final series under Amendment 2 was a third series; the original plan allowed two.
- No run before the change is counted. The acceptance series is run-05, run-06, run-07 and warm-01. The reader rejects every earlier record by its missing `criterionVersion`.

## What the control series proves, and what it does not (from the review)

- Criterion version 2 is in effect "complete and zero samples outside the lane". Rules 2 and 3 follow from rule 1 and completion. **It measures no margin** (I-06).
- The plan's analytic bound (a first stop rests at most 1.06 m past the centre, 4 cm inside the box) **is not a bound** (W-02). The records contradict the figures it was built from: stops reached 3.46 m after release (run-06 High leg 4, run-07 High legs 3 and 4) and 4.32 m and 4.03 m from rest (run-07 High back-offs). Releases also happened up to 0.8 m inside the threshold.
- So the series shows less than the plan claimed: 12 tiers out of 12 complete with no lane exit on the final bytes, not a demonstrated safety margin. The reviewer expects a lane exit in roughly one capture in five to ten.
- **The collector itself never judges the lane** (W-03). In a capture, a sample outside the lane or a rest beyond the box is only counted in `online.samples[*].legs[].outsideLaneSamples` and `legs[].stops`; the tier can still end `complete`. Whoever reads the capture report must read those fields.
- `staleInputSamples` **is not a measurement** (I-01). The debug snapshot keeps the last rejection reason, so the field equals the number of samples in every leg of every record.
- The reload sample is asserted without waiting for the rendered actor, **an unguarded race** of the same kind that failed run-02 Low for the fresh life (W-04). It passed in 25 of 25 tiers that reached it.
- Reviewer's estimate: the online part of the strict capture completes in **roughly nine chances in ten**, on 18 complete tiers out of 18 on the current bytes.

## Every control run that was started

All figures in this table are read from the records under `.planning/research/.cache/07-26/` (`<label>.json`); I did not observe these runs. They are control output, not evidence, and nothing was copied to `evidence/`. Outcome is under the criterion in force when the run ran.

| Run | Collector bytes (`moving-online.mjs` / `online-route.mjs`) | Started (UTC) | Outcome | Detail from the record |
|---|---|---|---|---|
| tracer-high | `cffc8cfa…` / `ec7f1fd9…` (before `559b953`; `STOP_LEAD_M` 1.5) | 23:46:38 | **failed** | High not complete: `corrections` at (62,22), position (61.10, 20.55), 5.0 fps, 13 key presses; 2 of 4 legs; 47 samples outside the lane |
| tracer-high-2 | `cbfb7913…` / `cb3ce0ad…` (`559b953`; `STOP_LEAD_M` 1.87) | 00:00:08 | passed | High complete, 48858 ms, 555.3 s left |
| run-01 | same as tracer-high-2 | 00:02:05 | passed | three tiers complete |
| run-02 | same | 00:06:30 | **failed** | Low not complete: fresh-life assertion `1 !== 2` (remote actor still on life generation 1). High leg (34,46): stop step 3.31 m, a stop at rest 1.96 m past the centre, 6 samples outside the lane |
| run-03 | `228ddb43…` / `aabd7d49…` (`773be68`, the current bytes) | 00:18:30 | passed | three tiers complete |
| run-04 | current bytes | 00:21:13 | **failed** | one criterion only: High leg (34,46) stop step 3.31 m above 3.12. All tiers complete, 0 samples outside the lane, released 2.94 m before the centre, at rest 0.38 m past it |
| run-05 | current bytes, criterion version 2 | 00:31:18 | passed | see below |
| run-06 | current bytes, criterion version 2 | 00:33:57 | passed | see below |
| run-07 | current bytes, criterion version 2 | 00:36:36 | passed | see below |
| warm-01 | current bytes, criterion version 2 | 00:39:36 | passed | warm-up 35.03 minutes, 17 contexts, no warm-up error; see below |

The first lead value 1.5 and the value 1.87 used from tracer-high-2 on are read from the records' `constants`; the measured median that led to 1.87 is not in a record I read and is not restated here.

### Final series, per tier (read from the records)

| Run | Tier | Wall ms | Match s left | Frames per second per leg | Corrections per leg | Back-offs | Largest stop step m | Outside lane |
|---|---|---|---|---|---|---|---|---|
| run-05 | Low | 42108 | 561.33 | 6.71, 6.42, 5.43, 5.47 | 1, 1, 1, 1 | 0 | 1.58 | 0 |
| run-05 | Medium | 53181 | 551.13 | 5.01, 4.80, 4.15, 4.37 | 1, 1, 1, 1 | 0 | 3.31 | 0 |
| run-05 | High | 55021 | 549.57 | 4.75, 4.60, 3.94, 4.19 | 1, 1, 1, 1 | 0 | 2.16 | 0 |
| run-06 | Low | 43682 | 559.63 | 5.95, 5.80, 5.10, 5.25 | 1, 1, 1, 1 | 0 | 2.02 | 0 |
| run-06 | Medium | 53807 | 550.63 | 4.79, 4.65, 4.12, 4.23 | 1, 1, 1, 1 | 0 | 2.16 | 0 |
| run-06 | High | 56206 | 548.47 | 4.62, 4.50, 3.92, 4.09 | 1, 1, 1, 1 | 0 | 3.46 | 0 |
| run-07 | Low | 49038 | 554.37 | 5.94, 5.77, 5.10, 5.18 | 1, 1, 3, 1 | 1 (leg 3) | 1.87 | 0 |
| run-07 | Medium | 55329 | 549.37 | 4.75, 4.61, 4.09, 4.17 | 1, 1, 1, 1 | 0 | 2.16 | 0 |
| run-07 | High | 69163 | 535.40 | 4.63, 4.49, 3.90, 4.04 | 1, 1, 3, 3 | 2 (legs 3, 4) | 3.46 | 0 |
| warm-01 | Low | 46153 | 557.47 | 5.77, 5.67, 4.79, 5.05 | 1, 1, 1, 1 | 0 | 2.02 | 0 |
| warm-01 | Medium | 56233 | 548.27 | 4.61, 4.45, 3.80, 4.11 | 1, 1, 1, 1 | 0 | 3.17 | 0 |
| warm-01 | High | 58853 | 545.83 | 4.54, 4.41, 3.94, 4.05 | 1, 1, 1, 2 | 0 | 2.16 | 0 |

- Smallest margins in the final series: the slowest tier took 69163 ms (run-07 High), which leaves 290837 ms to the control limit of 360000 ms and 530837 ms to the 600000 ms tier allowance; the least match time left was 535.40 s against the required 240 s.
- Rests furthest past the centre in the final series: -0.87 m (warm-01 High leg 4), -0.84 m (warm-01 Medium leg 3), -0.74 m (run-07 High leg 4); the box ends at -1.25 m.
- `staleInputSamples` equals the sample count in every leg (for example 9 of 9, 32 of 32); see I-01. It is not cited as a measurement.
- The warm-up cause of a slower Low tier after a long session stays unexplained; this plan does not claim to have found it.

## Review verdict and findings

`07-26-COLLECTOR-REVIEW.md` (commit `1483eea`, committed as the reviewer wrote it, sha256 `49f96b03…20c7` on disk and in the commit): `verdict: approved`, `reviewer_model: opus`, `reviewer_effort: medium`, 0 critical, 5 warnings, 6 notes. The orchestrator dispatched the review; this executor neither wrote the change nor the review. The five bound hashes equal the current bytes:

| File | sha256 |
|---|---|
| `tools/art/moving-online.mjs` | `228ddb43408d90910c112d3ae0687ff2469a8338976253ab38aa01f24c8a8b5d` |
| `tools/art/online-route.mjs` | `aabd7d4958cfbac89746ad892de67d41997fd2da7bdaacbfaa49214e1a2b9eae` |
| `tools/art/online-route.test.mjs` | `c3c0940afbe0f4e5590138656372851a50028512a4d2196baeef12d40603433a` |
| `tools/art/moving-online-control.mjs` | `6cc1a36af5eed30f822346918e987471d141c67179369c13c3d91a8d5e1227dc` |
| `tools/art/moving-online-control.test.mjs` | `a2c22ce5fa39eb036928755339e752164e161b48ef948c47c871e0abf8731b40` |

Findings, in substance as the reviewer wrote them; none requires a change before the capture:

- **W-01.** The back-off step is taken away from the waypoint on whichever side the body rests. On the far side that means further out of the lane. Leg 1 ends against a solid cell (column 14 row 11): a rest 1.25 to 1.65 m past (62,46) backs off west into the wall, the press never counts as effective and the leg ends as `stalled` after 150 ticks. Leg 2 would back off north onto a ramp tile. Not seen in any record (the tightest far-side rest was -0.87 m). If it happens the tier fails loudly. Later fix: on the far side approach, do not back off.
- **W-02.** The constants call 2.16 m the largest stop after a release and 3.11 m the longest step from rest, and the unit test derives far-side safety from them. The records contradict both: 3.46 m after release and 4.32 m and 4.03 m from rest. So `BACK_OFF_WITHIN_M` 1.86 is too narrow: a body at rest 1.86 to about 3 m short steps toward the waypoint from rest and can pass the far side. This is what failed run-02 (2.07 to -1.96); run-04 (2.26 to -0.90) and warm-01 (2.15 to -0.87) missed it by 0.35 and 0.38 m. The plan's analytic 4 cm bound is not a bound. Treat a lane exit in the capture as expected at roughly one capture in five to ten, not as impossible.
- **W-03.** The collector never judges the lane; only the control fails on it. Beyond the far side lie a wall (leg 1), a ramp (leg 2) and open floor (legs 3 and 4). Collision is server-side, so nothing passes through a wall or crack cell; a blocked body ends as `stalled`, `corrections` or `leg_bound`. No observation depends on the lane. The capture's reader should read `online.samples[*].legs` and say so if `outsideLaneSamples` is not 0.
- **W-04.** The reload sample is the first one seen and is asserted without waiting for the rendered actor (`pose.upper === 'reload'`): the same kind of race that failed run-02 Low for the fresh life and was fixed for that case only. 25 of 25 tiers passed it. Not part of this plan's diff. If a tier of the capture fails with an assertion on `reload`, look here first.
- **W-05.** The race bounds the tier body at 540000 ms, but the teardown after it has no bound of its own; the 60000 ms allowance is a projection, not a limit. After the race fires `runTier` is not cancelled and can still push into `legs` and `observations`; a late `browser.newContext()` leaves a context open until the browser closes. Reachable only when a browser call hangs for minutes.
- **I-01.** `lastInputRejection` is sticky (set on each rejection, cleared only on join). `staleInputSamples` equals the number of samples in every leg of every record; strictly it is not a lower bound of rejections inside the leg. Do not cite the number as a measurement.
- **I-02.** `judge` passes a stop whose `restAtM` is `null`, and an empty tier list passes vacuously. Neither is reachable with the bound bytes and the CLI.
- **I-03.** `release` clears its state before the two `keyboard.up` calls; if the first throws, ControlLeft is not released. Only possible when the page is already gone.
- **I-04.** `STOP_LEAD_M`, `MAX_STOP_STEP_M` and `MAX_STOP_LAG_MS` no longer steer or judge anything. Kept by the plan.
- **I-05.** `aim` turns the view with a synthetic `mousemove` dispatched inside the page, not with `page.mouse` (unchanged from before this plan). It writes no state but is not a trusted event.
- **I-06.** Rules 2 and 3 of criterion version 2 follow from rule 1 and completion. In effect the criterion is "complete and zero samples outside the lane". It measures no margin.

The reviewer's answers to the twelve questions: no path writes game or room state; keys and button are released on every path that still has a page; no wait in the tier body outlives the deadline (teardown unbounded, W-05); retries change only how often input is offered; viewport 800x600, device scale factor 1, video size, tiers, waypoints and the fields the capture reads are unchanged (one planned difference: `matchSeconds` 600); the unit tests need no browser, network or gitignored file; the control is labelled and cannot write under `evidence/`; the changed fresh-life wait does not change what the observation proves; the release threshold depends only on observable values. On the history (question 12): what is weaker than the original plan is that the step limit, which acted as a margin check, is gone, a third series was run, and the analytic bound that replaced the limit is wrong; for the capture this is a completion risk, not an evidence risk. All seven listed deviations were ruled `accept` (the back-off with W-01 and W-02, the deadline race with W-05).

Residual risks the reviewer lists for the strict capture: a lane exit somewhere in the 12 legs is plausible; a far-side rest on leg 1 fails that tier as `stalled`; the reload race; the warm run imitated 35 minutes of offline collection while the capture's offline part is longer, a different sequence, and keeps a Vite server open; host load.

## Gate identities and protected bytes (executed by this agent on 2026-10-11, 03:30 to 03:33 local)

- `node tools/art/stable-gates.mjs check`: exit 0, `stableGatesPass` true, `plan09Qualified` true, `identitySha256` `c1b062729e765c0086c4c9c283170cf2da3e65044ff4eeacd66937899cbc2c57`. Before value in `.planning/research/.cache/07-26/identity-before.txt`: the same.
- Pinned hashes unchanged: `animation-capture.mjs` `20884fee…bd32`, `review.mjs` `fad42d2e…8265`, `animation-budget-paired.mjs` `584bd4ca…9b4e`.
- `git diff --quiet 0d12fd6..HEAD` over `src server tests public index.html style.css` and the four protected tool files: exit 0.
- `git diff --quiet 773be68..HEAD` over the three collector files: exit 0.
- `npm run test:art`: 669 pass, 0 fail.
- Registry `evidence/07-paired-session-registry.json`: unmodified (`git status --short` empty for `evidence/`). Paired session directories still present, with modification times `session-76123eb3…` 2026-10-10 15:30, `session-23e8adde…` 23:07, `session-a16b4bbf…` 23:43; the parent directory 23:10. Nothing was written there.

## Task Commits

1. **07-26-01 (tracer, TDD):** `957e81a` (test, RED), `559b953` (feat, with the tracer's one change)
2. **07-26-02 (control series):** `773be68` (the series' one change), `e803853` (Amendment 2, written by the orchestrator), `51b1004` (test, RED), `967fd8a` (criterion version 2)
3. **07-26-03 (review, identities, notes):** `1483eea` (review record), `1ac9a79` (`AGENTS.md`)

Tasks 1 and 2 and the control runs were executed by an earlier executor; this agent executed the remainder of task 3 and wrote this summary from the commits and the cache records. `actuals.commits` is measured from `80835ae` and so includes the orchestrator's `e803853`; `actuals.tokens` is chars/4 over that whole diff (137,988 chars).

## Deviations from Plan

1. **Criterion change after a failing run (Amendment 2).** Stated above. Not approved separately by the owner.
2. **Three series instead of two.** Series 1 (run-01, run-02), series 2 (run-03, run-04), final series (run-05 to run-07, warm-01).
3. **Executor deviations accepted by the review:** release at a frame-rate-dependent threshold instead of `STOP_LEAD_M`; `CROUCH_WITHIN_M` 12 instead of 4; a back-off step; the fresh-life wait also requiring a shared life generation; a race against the tier deadline; a strict definition of outside the lane; additive leg fields and helper exports.
4. **`AGENTS.md` also corrected for the paired state** (the stale line "Nothing has qualified yet"), on the orchestrator's instruction; each statement was checked against `07-18-SUMMARY.md`.
5. **Plan ledger written late.** `gsd-plan-head-before-07-26` did not exist; it was set to `80835ae`, the commit before the plan's first commit.

## Not verified

- That the online route completes inside the real strict capture, after the real offline matrix. That is plan 07-19 task 2.
- Any margin of the walker against the lane; the criterion measures none.
- The cause of the slower Low tier after a long session.
- The input loss below about 5 frames per second on a real GPU, or its exact rejection counts.
- The control runs themselves: I read their records and reran only the reader; I did not watch them.
- The measured median stop step that set `STOP_LEAD_M` to 1.87.
- The movies of the control runs were not looked at.

## Known Stubs

None.

## Next Phase Readiness

Plan 07-19 task 2 can run its one new strict capture on the reviewed bytes, provided `host_ready` is still inside 12 hours. ANIM-02 and ANIM-03 stay unmarked.
