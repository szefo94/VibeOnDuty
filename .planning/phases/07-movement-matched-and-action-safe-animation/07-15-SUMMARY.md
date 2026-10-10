---
phase: 07-movement-matched-and-action-safe-animation
plan: "15"
subsystem: testing
tags: [animation-budget, paired-timing, owner-decision, review]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-09 paired amendment proposal, 07-13 requalification (numeric-only-fail), 07-21 and 07-13 guard exceptions"
provides:
  - "Independent opus/high review of the paired timing proposal: changes-required, no blocker, R1 to R8"
  - "Owner decision record: approved, conditional on R1 to R8, with T_aggregate 0.05, T_single 0.25, session cap 3"
  - "Owner answers: confirms_07_21_option yes, accepts_enemyGLTF_test_exception yes"
affects: [07-16, 07-17, 07-18, 07-19, plan-09]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["record-only plan: review, blocking-human decision, hash-pinned decision record"]

key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-09-PAIRED-AMENDMENT-REVIEW.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-09-PAIRED-AMENDMENT-DECISION.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-15-SUMMARY.md
  modified: []

key-decisions:
  - "Paired amendment approved by the owner, conditional on review changes R1 to R8 being made before any paired result counts"
  - "Tolerances 0.05 / 0.25 and cap 3 are the reviewer's recommendation approved by the owner's reply; the owner did not type the numbers"
  - "Frozen V2 contract stays the only applicable gate and plan 09 stays halted until a conditional paired session passes"

requirements-completed: []

coverage:
  - id: D1
    description: "Independent technical review of the paired timing proposal on record"
    verification:
      - kind: other
        ref: "task 1 verify command (status, reviewer_model, proposal_sha256) exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owner decision on the amendment recorded verbatim with pinned hashes"
    verification:
      - kind: other
        ref: "task 2 verify command (decision, decided_by, t_aggregate, t_single, confirmations) exit 0"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-10
status: complete
---

# Phase 07 Plan 15: Paired timing amendment review and owner decision Summary

**The review is `changes-required` (no blocker). The owner decided `approved`, conditional on the eight required changes R1 to R8, with `T_aggregate` 0.05, `T_single` 0.25 and a cap of 3 sessions. Both confirmations are `yes`. No `host_ready` was given.**

This plan reviews, decides and records. It changes no code and ran no browser, server, capture or suite.

## Outcome

- Review (`cb21699`): independent reviewer `opus`/`high`, status `changes-required`, 0 blockers, 8 required (R1 to R8), 5 optional (O-1 to O-5). `proposal_sha256` `4ecad5a1...e7663cd` equals the proposal on disk; the proposal is unmodified. Five blob ids for the reference owners are in the review; the recommended cap is 3.
- Decision record (`ffcf466`): `decision: approved`, `approval_condition: conditional-on-review-required-changes-R1-to-R8`, `decided_by: owner`, `confirms_07_21_option: yes`, `accepts_enemyGLTF_test_exception: yes`, `t_aggregate: 0.05`, `t_single: 0.25`, `timer_quantum_ms: 0.1`, `session_cap: 3`, `reference_commit: c973458`, `reference_arm_accepted: true`, `review_sha256: 7fe81473...400022`.
- `host_ready` is not given. The owner said `none` and that they will prepare the computer so the full run is free to go. Nothing was written into `07-14-MP-ROUTE-DECISION.md`. Plans 07-17, 07-18 and 07-19 will stop at their readiness precondition until the owner states a time.
- Until R1 to R8 are implemented and a paired session passes under the cap and disclosure rules, the frozen V2 contract remains the only applicable gate and plan 09 stays halted. No earlier report becomes a pass.

## Binding conditions for plan 07-16 (R1 to R8)

- R1: say what is measured: edits to the five owner files after `c973458`, offline Training Range; add the five extra "would not mean" items.
- R2: correct "cannot be rebuilt"; describe the arm as working-tree bytes plus five owners from `c973458`; reword decision 3.
- R3: define the aggregate exactly; apply it per actor count and per tier as well as to all 12; state the minimum profiles with `r > 0`.
- R4: balance capture order inside every tier and actor count.
- R5: one same-arm calibration session first; drop rule 3 or restate it as a gross-instability and ratio-agreement check.
- R6: cap of 3 sessions per source identity, majority rule, registration before running, full disclosure with denominator.
- R7: bind both arm reports to one invocation with a nonce and interleaving timestamps; reject any existing single-arm V2 candidate.
- R8: state that 5% and 25% are effective only for the frame interval, give bounds for sub-millisecond components, and state that zero limits loosen from exact to one tick.

## What a paired pass would and would not mean (review wording)

A pass would show only that edits to the five owner files after `c973458` did not add cost, within tolerance, in the offline Training Range workload, with the frozen structural checks still passing. It would not mean the original absolute limits were met, says nothing about Phase 7's total effect or files outside the five owners, and cannot see the first-person view cost, because the reference arm already contains it (the frozen limits have the same blind spot). It says nothing about online play, frame rate, devices or human quality.

## New fact

The review's appendix shows the frozen reference source is reconstructible byte for byte: `c973458` holds the capture's content for all 127 files, differing only in line endings, and the three mixed-ending owners can be rebuilt from the listed line ranges. A capture of the exact frozen tree on today's host is therefore possible. It has NOT been run.

## Gaps answered

- G-02 in `07-13-GUARD-REVIEW.md` (no recorded owner decision for the `enemyGLTF.test.js` exception) is answered by `accepts_enemyGLTF_test_exception: yes`.
- The note in `07-21-SUMMARY.md` that explicit owner confirmation of `register-exception-pinned-lf` was not on record is answered by `confirms_07_21_option: yes`.
- `07-21-SOURCE-CHANGE-DECISION.md`, `07-21-SUMMARY.md` and `07-13-GUARD-REVIEW.md` were deliberately not edited.

## Decision provenance

The orchestrator presented the verdict, the weaknesses, R1 to R8 and three options, recommended approval conditional on R1 to R8 with 0.25, 0.05 and a cap of 3, and restated four items in plain terms, saying that "approved with the eight fixes, yes, yes" plus a time or `none` would express agreement with all its recommendations. The owner replied, verbatim:

> approved with the eight fixes, yes, yes, none (i will prepare computer so that this full run is free to go)

The owner did not type the numeric tolerances or cap; they are the recommendation the owner approved by that reply.

## Task Commits

1. Task 1: independent review record - `cb21699`
2. Task 2: owner decision record - `ffcf466`

## Deviations from Plan

None. Task 1 was performed by an orchestrator-dispatched independent reviewer because the executor cannot spawn subagents; the blocking-human checkpoint was resolved by the owner.

## Known Stubs

None.

## Self-Check: PASSED

Both records exist, both verify commands exit 0, `proposal_sha256` and `review_sha256` equal the on-disk hashes, the proposal is unmodified, `src/main.js` is `f768954f...bc393`, and no change was made under `src/` or `tools/`.
