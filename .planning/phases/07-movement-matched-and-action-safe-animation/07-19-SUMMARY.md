---
phase: 07-movement-matched-and-action-safe-animation
plan: "19"
subsystem: testing
tags: [moving-review, strict-capture, qualification, documentation, human-review-pending, gap-closure]
requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-17 stable gates, 07-18 plan 09 qualification on the paired route, 07-23 natural combat approach, 07-26 reviewed collector online route, owner host_ready"
provides:
  - "evidence/07-motion-review.json: complete current-source moving review (exit 0), human verdict pending"
  - "evidence/07-motion-review-index.html: qualifying capture first, every earlier attempt historical"
  - "evidence/07-motion-review-partial-2026-10-10.json and -2026-10-07.json: the two earlier reports, byte for byte"
  - "07-10-SUMMARY.md closed on the real strict exit code"
  - "AGENTS.md, docs/ANIMATION-REVIEW.md, tools/README.md at the measured state"
affects: [phase-07-verification, 05, human-review]
actuals:
  tokens: 8125131
  tasks: 3
  commits: 19
plan_head_before: f564018acfc23dc934ce8a9412b643ce074c6611
plan_head_after: 19172b35227235690af27c442e2a2f818e244191
tech-stack:
  added: []
  patterns: ["archive the previous report byte for byte and commit it alone before a capture", "one strict run is the judge; no sub-mode fill, no splicing", "documents copy numbers from evidence files"]
key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-partial-2026-10-07.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-partial-2026-10-10.json
  modified:
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-tracer.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-motion-review-index.html
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-10-SUMMARY.md
    - AGENTS.md
    - docs/ANIMATION-REVIEW.md
    - tools/README.md
key-decisions:
  - "The second strict capture exited 0 and is the qualifying record; the first (exit 1) stays archived and listed"
  - "Plan 10 coverage D2 stays fail (fixed budget not met); D5 records the paired gate; D3 pass"
  - "No requirement is marked complete; the human review is the remaining acceptance"
  - "STATE.md and ROADMAP.md were not advanced by this agent: the plan carries a human check, returned to the orchestrator as a blocking-human checkpoint"
requirements-completed: []
requirements-mapped: [ANIM-02, ANIM-03, ANIM-05]
requirements-status: pending
coverage:
  - id: D1
    description: "One unspliced strict moving capture complete at the final identity: 45 rows, 9 previews, 3 blocked-gait, 3 shared-movement and 3 offline combat unions, online union complete on three tiers"
    requirement: ANIM-02
    verification:
      - kind: integration
        ref: "node tools/art/review.mjs --animation-capture (exit 0, 2026-10-11 03:35 to 04:11 local); task 2 reader on evidence/07-motion-review.json (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remote posture and aim in the online union come from server snapshots; the collector sends ordinary input and writes no outcome"
    requirement: ANIM-03
    verification:
      - kind: other
        ref: "07-26-COLLECTOR-REVIEW.md answers 1 and 4 on the bytes recorded in toolingIdentities (228ddb43…8b5d); git status --short -- src server tests public empty"
        status: pass
    human_judgment: true
    rationale: "The review is of the collector code, by an agent. Whether the online movies look right is part of the human review."
  - id: D3
    description: "Plan 09 budget qualified by the owner-approved paired same-session gate, not by the fixed budget; the original absolute limits were not met"
    requirement: ANIM-05
    verification:
      - kind: integration
        ref: "evidence/07-motion-review.json#actualV2: passed true on timingGate paired-same-session; frozenApplicableBudgetPass false, exit 1, 21 of 192 over"
        status: fail
    human_judgment: true
    rationale: "The fixed budget failed. Whether the paired gate satisfies ANIM-05 is for phase verification and the owner."
  - id: D4
    description: "Human judgment of D-01 to D-11 moving quality, the natural offline death and respawn, and the two-client online reload, death and fresh life"
    verification: []
    human_judgment: true
    rationale: "No agent can record a human motion or aesthetic pass. humanMotionAcceptance is pending and certification is false."
  - id: D5
    description: "Project documentation describes the measured state, including what is open"
    verification:
      - kind: other
        ref: "node tools/art/stable-gates.mjs check (exit 0) and npm run test:art (669 pass, 0 fail) after the edits"
        status: pass
    human_judgment: false
duration: "this agent: 45 min for tasks 2 and 3 (03:34 to 04:19 local), of which 36 min capture; task 1 and the first capture ran on 2026-10-10"
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 19: Strict Moving Capture and Documentation Summary

**Strict exit code: 0. `node tools/art/review.mjs --animation-capture` completed on 2026-10-11 as one unspliced run with `complete: true` and status `automated-qualified-human-pending`. The human review of D-01 to D-11 moving quality, of the natural offline death and respawn and of the two-client online reload, death and fresh life has not happened and is the remaining acceptance. Plan 09 behind this capture is qualified on the paired same-session route only; the frozen absolute V2 limits were not met.**

## What the human still has to review

Nothing below has been reviewed by a person. `humanMotionAcceptance` is `pending` and `certification` is `false` in the report, and no agent's reading stands in for it.

- Open `C:\Programowanie\VibeOnDuty\.planning\phases\07-movement-matched-and-action-safe-animation\evidence\07-motion-review-index.html` and watch the movies of the first section ("Qualifying capture").
- Play the running game: `npm run dev` on a free port, Training Range, enabled Start, F3, Open animation review; Close review returns to Resume.
- Judge, in your own words: D-01 restrained weapon and camera motion with steady ADS; D-02 real first-person arms and hands plus torso and legs when looking down, with credible hand contact; D-03 physical magazine and bolt handling fitted to reload time for M4, P90, AWP and pistol; D-04 immediate, short ADS raise and lower with no bounce; D-05 planted turns and stops with feet matching movement speed; D-06 lowered two-handed sprint carry (one-handed supersprint is a labelled preview only); D-07 compact jump, landing compression and quick recovery; D-08 torso-led small turns and foot repositioning on larger turns; D-09 reload x1.15 and supersprint cancellation only as labelled previews, online M4 timer unchanged; D-10 melee and throw taking priority immediately with no overlap, duplicate release or ammo award; D-11 short directional death collapse that settles. Also the natural offline death and respawn, and the two-client online reload, death and fresh life.
- Identities reviewed: stable gate identity `c1b062729e765c0086c4c9c283170cf2da3e65044ff4eeacd66937899cbc2c57`; report sha256 `615e5d22eb156ca76670338e3b182702da98e840cbdaae3c39f5aec3a807d574` (commit `23de5a4`); motion tuple GLB `2a6bbab2…6e4e`, donor `3d1702cc…c463`, manifest `2b571250…60a5`.

## The capture (task 07-19-02)

| Fact | Value (from `evidence/07-motion-review.json` unless noted) |
|---|---|
| Command | `node tools/art/review.mjs --animation-capture`, no sub-mode, run once, in the background, nothing else started while it ran |
| Start and end (observed) | 2026-10-11 03:35:06 to 04:11:06 local |
| Exit code (observed) | 0 |
| `durationMs` | 2159077 (36.0 minutes) |
| `complete`, `status` | true, `automated-qualified-human-pending` |
| `matrixComplete`, `stableGatesPass`, `plan09Qualified`, `protectedBytesUnchanged`, `creatorTracer.complete`, `actualV2.passed` | all true |
| `collectionErrors`, `canceled` | empty, false |
| Current rows | 45, 45 distinct keys, 15 per tier, all completed (variants m4, p90, awp, pistol, p90-fallback) |
| Previews | 9, all completed, each with a Preview and Phase 5 label |
| Blocked-gait, shared-movement, offline combat unions | 3, 3, 3, all complete; each combat union has the stages accepted-aim, earned-resource, throw-canceled-reload, natural-death, natural-respawn and a menu return |
| Online union | complete on Low, Medium and High; 6 movies, all `continuousFullPixels: true` |
| Movies | 24, 197,024,303 bytes |
| Browser | 147.0.7727.15, headless, software rendering |

### Online union per tier (review note W-03: the collector does not judge the lane, so these fields are stated whatever they are)

| Tier | Complete | Wall ms | Match s left | Frames per second per leg | Corrections | Back-offs | Outside-lane samples | Stops, released at / at rest (m before the centre) |
|---|---|---|---|---|---|---|---|---|
| Low | true | 45225 | 558.27 | 5.69, 5.59, 4.76, 5.05 | 1, 1, 1, 1 | 0 | 0, 0, 0, 0 | 1.70/0.11; 1.98/0.25; 2.30/0.42; 2.44/0.57 |
| Medium | true | 57099 | 547.73 | 4.64, 4.50, 3.86, 4.09 | 1, 1, 1, 1 | 0 | 0, 0, 0, 0 | 2.42/0.26; 2.38/0.22; 2.93/0.77; 2.65/0.49 |
| High | true | 66366 | 538.40 | 4.57, 4.42, 3.87, 4.00 | 1, 1, 3, 1 | 1 (leg (34,22)) | 0, 0, 0, 0 | 2.27/0.26; 2.23/0.36; 3.74/1.58, 2.73/4.89, 2.87/0.57; 2.16/0.14 |

- No tier has a `failure` or `error` field. No rest was past the centre in this run; the High leg (34,22) stopped 1.58 m short, stepped back to 4.89 m and approached again.
- `staleInputSamples` equals the sample count in every leg (review I-01); it is not a measurement and is not cited as one.
- The reload race (W-04) and the far-side back-off (W-01) did not occur in this run. That is one run; it does not remove either risk.
- Observations per tier: joined-blue-red, crouch, aim, authoritative-reload-death-fresh-life, fresh-life-pixels (twice).

### Timing gate as the report records it

- `actualV2.passed`: true, on `timingGate: paired-same-session`, `pairedVerdict: pass`, `pairedWording`: "passed, session 1 of 1; 0 valid sessions failed; 0 invalid", `pairedSessionsVerified: true`, `structuralV2Pass: true`.
- The unchanged frozen command, run inside the capture on `evidence/07-18-cost-candidate.json`: exit code 1, `frozenApplicableBudgetPass: false`, `frozenOverrunCount` 21 (of 192). **The original absolute limits were not met.** The earlier evaluation at this identity was 40 of 192 over (plan 07-13).
- The paired result shows only that edits to the five owner files after `c973458` added no cost, within tolerance, in the offline Training Range capture on this host. It says nothing about the first-person view's cost, Phase 7 as a whole or online play, and it is not device or frame-rate certification.

### Two captures, one collector change

- First full capture, 2026-10-10: exit 1, partial only on the online route (`Ordinary input route did not reach (34,22)` on all three tiers). Report committed in `0d12fd6`, now archived byte for byte as `evidence/07-motion-review-partial-2026-10-10.json` (sha256 `d0f912c0…33d4`, equal to the `0d12fd6` blob; committed alone in `edf69db` before the new run started).
- Plan 07-26 then changed the collector's online route and had it independently reviewed (`verdict: approved` with notes).
- Second full capture, 2026-10-11: this one. It was the last run the plan allowed. Nothing was rerun, filled by a sub-mode or combined.
- `toolingIdentities['moving-online.mjs']`: tracer report (task 1, 2026-10-10) `5945eda2e3d3d681e25dfd4818814f86f675eff4abbf3b97686cdc8f6ea6ed59`; this capture `228ddb43408d90910c112d3ae0687ff2469a8338976253ab38aa01f24c8a8b5d`, equal to `moving_online_sha256` in `07-26-COLLECTOR-REVIEW.md`. The difference is the reviewed collector change, not a defect; a tracer never calls the online collector.
- `evidence/07-motion-review-partial-2026-10-07.json` is unchanged since `7d2f00e`.

### Preconditions checked before the capture (by this agent)

`07-26-SUMMARY.md` present with `status: complete`; review record `verdict: approved` with five hashes equal to the current bytes; `stable-gates.mjs check` exit 0; `07-12-SUMMARY.md` `status: complete`; `COLLECTION_LIFETIME_MS` 15600000 (at least 15452931); `route: source-fix`; `host_ready: 2026-10-10T21:18:47+02:00`, 6.3 hours old at the start and 6.9 hours old at the end. Task 1's reader on the committed tracer report: exit 0 (the tracer was not run again, as the amendment directs).

### Index and plan 10

- `evidence/07-motion-review-index.html` now lists the qualifying capture first, then the 2026-10-10 partial, then every earlier attempt, each labelled historical. The section that used to be headed `07-motion-review.json` (the 2026-10-07 report) now names and links its archive. Rechecked: 85 movie references exist with the recorded size and hash; the 45 row images of this capture and of the 2026-10-10 capture match their hashes. The 2026-10-07 `07-10-artifact-self-check.json` was not regenerated; it is linked as a historical check.
- `07-10-SUMMARY.md`: root `status: complete`; D3 `pass`; D2 stays `fail` with a ref saying the matrix is complete and the fixed budget was not met; D5 added for the paired gate in the contract's words; one dated section appended with the exit code, duration, counts, the paired sentence with its denominator and the full "does not mean" list; every earlier section kept; `requirements-completed: []`.

## Documentation (task 07-19-03)

- `AGENTS.md`: the two stale statements replaced (frozen gate "remains unqualified"; 42 + 3 contexts and open gates) with the measured state; final gate counts (323 unit tests in 31 files, 138 offline, 18 multiplayer; offline on the second of two runs); what is still open; one paragraph on the gate tools. The G-01 note is still present and still true.
- `docs/ANIMATION-REVIEW.md`: new first section "Qualification state — 2026-10-11" with the path in order, the index location, the human review scope and what a paired pass does and does not mean; the 2026-10-07 section is kept as history.
- `tools/README.md`: command lines of plans 07-14, 07-16, 07-17, 07-18, 07-21 and 07-23 (and the 07-26 control), each with when to run it.
- Stated in the documents where they touch it: paired route qualified and frozen limits not met; offline gate on the second of two runs; first capture partial and this the second after the reviewed collector change; software-rendered headless measurements on one desktop (Balanced power plan, Discord and Steam running during the timing sessions) are not device or FPS certification; no agent records a human pass; G-01 open, fix before any push.

## Verification after the capture and the documents (executed 04:13 to 04:16 local)

| Check | Result |
|---|---|
| Task 2 reader on `evidence/07-motion-review.json` | exit 0 |
| `node tools/art/stable-gates.mjs check` | exit 0, both flags true, identity `c1b06272…2c57` |
| `npm run test:art` | 669 pass, 0 fail |
| `node tools/art/frozen-bytes.mjs verify` | 26 verified, 0 mismatched |
| `git status --short -- src server tests public` | empty |
| Pinned hashes (`animation-capture.mjs`, `review.mjs`, `animation-budget-paired.mjs`) and the collector hashes | unchanged |
| Registry `chain` | valid, 9 events, every event committed; nothing appended; registry file unmodified |
| Paired session directories | present, modification times unchanged (15:30, 23:07, 23:43 on 2026-10-10) |
| `.planning/REQUIREMENTS.md` | unmodified |

## Task Commits

1. **07-19-01 (tracer, 2026-10-10, earlier executor):** `9ef7718`
2. **07-19-02:** first run `7d2f00e` (archive), `0d12fd6` (partial report, exit 1); this run `edf69db` (archive alone), `23de5a4` (complete report, exit 0), `e575d18` (index and plan 10 summary)
3. **07-19-03:** `19172b3`

`actuals.commits` is measured from the ledger base `f564018` and counts 19 commits, of which 7 carry the 07-19 scope, 2 are orchestrator planning commits and 10 belong to plan 07-26, which ran in between. `actuals.tokens` is chars/4 over this plan's files in that range (32,500,524 chars), almost all of it tool-written report JSON.

## Deviations from Plan

1. **Two strict captures instead of one.** The plan as first written allowed one; the amendment after plan 07-26 allowed exactly one more with the changed collector. Both are on record.
2. **Index: the old first section was relabelled** to its archive name, and the link to the 2026-10-07 artifact self-check is described as historical. The self-check file itself was not regenerated; this plan's files do not include it.
3. **`AGENTS.md` also names `tools/art/frozen-bytes.mjs` and plan 07-26's control** in the tools paragraph and README, beyond the plan's list. Additive.
4. **STATE.md and ROADMAP.md not advanced.** The orchestrator directed that a plan with a human check ends in a blocking-human checkpoint; the state and roadmap update is left to the orchestrator. `.planning/state.json` was rewritten as a side effect of the plan 07-26 state commands and is left unstaged.

## Not verified

- Any human judgment of motion, grips, anatomy, feet, ADS comfort or death. Pending.
- A real GPU, a representative device, a frame rate.
- The movies themselves: no agent watched them; existence, size and hash only.
- The cause of the 2026-10-07 Low/P90-fallback observer loss. It did not recur in this run.
- The frozen route on real data; the byte-for-byte frozen-source capture on today's host (available, not run).
- Whether the paired gate satisfies ANIM-05; that is for phase verification and the owner.
- G-01 is open: the CI step running `npm run test:art` cannot pass on a fresh checkout. Fix before any push.
- The independent re-review listed as pending in `07-REVIEW-DISPOSITION.md` is an orchestrator step and was not done here.

## Known Stubs

None.

## Next Phase Readiness

Automated qualification is complete. Phase verification can collect the human check. No requirement is marked complete by this plan.

## Self-Check: PASSED

Checked before this file was committed: the two archive files and the report exist and hash as stated; commits `9ef7718`, `7d2f00e`, `0d12fd6`, `edf69db`, `23de5a4`, `e575d18` and `19172b3` are ancestors of HEAD (listed by `git log` from the ledger base); the verification table above was executed after the last task commit.
