---
phase: 07-movement-matched-and-action-safe-animation
plan: "25"
subsystem: testing
tags: [paired-timing, contract, independent-review, animation-budget]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "plan 07-15 owner decision (approved, conditional on R1 to R8)"
provides:
  - "Approved paired timing contract V2 (07-09-PAIRED-AMENDMENT-V2.md), hash-pinned to the proposal, its review and the decision"
  - "Independent opus/high review in two passes (07-09-PAIRED-AMENDMENT-V2-REVIEW.md), status pass-with-notes"
affects: [07-16, 07-18]

review_status: pass-with-notes
v2_sha256: 8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3
review_sha256: f61edef1eeeaf35d6ff07226592151a79b7f506a2d77cb7fbe010d8c5afd6689

plan_head_before: 022591020a1f8631f3953385894331174fb73f88
plan_head_after: 61f9f69

actuals:
  tokens: 40000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: ["hash-pinned contract document plus independent review bound to its exact bytes"]

key-files:
  created:
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-09-PAIRED-AMENDMENT-V2.md
    - .planning/phases/07-movement-matched-and-action-safe-animation/07-09-PAIRED-AMENDMENT-V2-REVIEW.md
  modified:
    - .gitattributes

key-decisions:
  - "Rule 2 aggregates per-CELL ratios (mean of the cell's two opposite-order profile ratios) with sorted[floor(n/2)]; approved numbers unchanged"
  - "A frozen-command exit 0 is recorded with its evaluation count and escalated to the owner; never a pass by tooling"

requirements-completed: []

duration: record-keeping close of a multi-agent plan (started 2026-10-10T12:09:39Z)
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 25: Paired timing contract V2 Summary

**Review status: pass-with-notes. Final `v2_sha256`: `8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3`.**

The approved paired timing contract exists in one hash-pinned document and has an independent `opus`/`high` verdict tied to its exact bytes. No code changed, no capture or suite was run, and the owner's numbers are untouched: `t_single` 0.25, `t_aggregate` 0.05, `timer_quantum_ms` 0.1, `session_cap` 3, `reference_commit` `c973458`.

## Commits

| Commit | What |
|---|---|
| `2ea292e` | V2 document created |
| `56da66a` | Review's required edits E1 to E9 applied |
| `8eba2e1` | LF pins for the hash-bound documents in `.gitattributes` |
| `61f9f69` | Review record added, unedited |

Hashes after the last commit (working file and HEAD blob agree): V2 document `8f3f6c72...1aa3`; review record `f61edef1...6689`. The proposal (`4ecad5a1...63cd`), the proposal review (`7fe81473...0022`) and the decision record (`c1af5d9b...7f69`) are byte-identical. `git status --short -- tools src` is empty; `src/main.js` is `f768954f...c393`.

## The two review passes

First pass (on `1ae66f8b...b47d`): `changes-required`; nine edits, no owner decision needed, approved numbers untouched.

- **E1** rule 2 now aggregates per-cell ratios, each the mean of the cell's two opposite-order profile ratios, then the frozen median `sorted[floor(n/2)]` over cells in the same six groups. Reviewer's figures: no-change failures 0.2 to 0.5% at 2% noise for order effects up to 10%, versus about 60% under the first form at a 5% order effect. A 20% regression in one actor count, one tier or one cell fails 100% of simulated sessions. With no order effect it equals the profile-median form exactly.
- **E2** a calibration runs the frozen command on neither arm (no `structuralV2Pass`); every reference arm's five owner identities must equal the pinned SHA-256 values.
- **E3** the verdict is refused unless every committed version of the registry is a prefix of the current event list; shallow history refused; registration commits never rewritten and named in the final record.
- **E4** a `started` event is appended to the tracked registry before the first capture; a second run for the same registration is refused.
- **E5** no timing value is printed, logged or written before a session is closed.
- **E6** a calibration applies only to the tool hashes, sampler identity and browser version it ran with.
- **E7** a frozen evaluation is defined, and the list is built by a scan of the evidence and cache directories, not from memory.
- **E8** hash-bound documents, registry and session evidence pinned to LF before the first registration.
- **E9** same context/page lifetime, launch flags and sampler arguments across session kinds, recorded.

Second pass (on `8f3f6c72...1aa3`, at `8eba2e1`): `pass-with-notes`. All nine edits are present in the reviewer's wording or stricter; nothing exceeds the owner's approval; every sentence about what a pass means is inside R1; the document needs no further edit. N2-1 (add the settings-mismatch invalidity as a seventh section 5 criterion if the document is ever revised) and O-1 (pin the proposal and its review to LF) are optional.

## Section 11: the 20 choices and the reviewer's ruling

None of these is owner-approved beyond R1 to R8 and the three numbers. The reviewer found nothing exceeding the owner's approval, so the owner is told, not asked.

| # | Choice | Ruling |
|---|---|---|
| 1 | Median over cell ratios | Changed by E1; accepted |
| 2 | Six groups, minimum of 3 | As strict; note N-1 added |
| 3 | Order rule | As strict (R4 exactly); cancels a second-capture slowdown to first order with item 1 |
| 4 | Warm-up discard | As strict |
| 5 | Validity criteria and threshold | As strict; changed by E2; `d` above about 11.8% makes every session invalid |
| 6 | Calibration, exactly one per identity | As strict; E6 binding added |
| 7 | Smoke writes no timing | As strict |
| 8 | Both arms materialised alike | As strict |
| 9 | Event chain, commit before capture, history | Strengthened by E3, E4 |
| 10 | Counting from registration | As strict |
| 11 | Early `failed` | As strict; verdict table recomputed and agrees |
| 12 | Earlier identities listed | As strict; discloses, does not prevent |
| 13 | A frozen exit 0 | As strict; E7 |
| 14 | Comparison allowance (1e-7 ms) | Within the approval; needed |
| 15 | Nonce at registration | As strict in effect |
| 16 | Source identity | Better than a commit id; E6 |
| 17 | Frozen evaluation list | Acceptable with E7 |
| 18 | No timing before close | Added by E5; correct |
| 19 | Same capture conditions across kinds | Acceptable; implementation fixes the lifetime |
| 20 | Line endings of hash-bound files | Correct; pinned by exact path |

## Residual the owner should know

A tier group has two cells and its aggregate is the larger of the two cell ratios. At about 4% adjacent-pair noise about 23% of no-change sessions fail per statistic. Adjacent-pair noise on this host has never been measured. The calibration is the first measurement of it and may change only whether qualifying sessions run, never a tolerance. Rule 2 adds its own no-change failures from noise, which the cell ratio does not remove.

## Plan edits required before plan 07-16 (NOT confirmed done)

The reviewer lists five edits to `07-16-PLAN.md`, none of which changes the contract or a number. The planner is applying them to the plan; they must be confirmed before 07-16 is dispatched. This summary does not claim they are done. Plan 07-18 needs none.

- **P-1** `--register` must refuse (message `Line-ending pin is not committed`) unless `.gitattributes` at `HEAD` holds one exact-path `text eol=lf` line per frozen-list path; a precondition is not a refusal. Add a control.
- **P-2** the binding rejects overlapping captures and capture times outside `started`/`closed`; add controls.
- **P-3** every session report carries the hash of its `started` event as well as its registration event; a mismatch is rejected; add a control.
- **P-4** validity: not exactly the warm-up pair and 12 pairs, each profile once per arm, or an incomplete arm report; controls for a missing warm-up pair, a missing profile and a duplicate.
- **P-5** the `closed` event of a qualifying session records `frozenExitCode` and `frozenOverrunCount` (a calibration's and a smoke's record neither); `verify` exits non-zero when its recomputed outcome differs from the `closed` event; controls.
- Wording: T-07-16-03 "registration and `started` event hashes in each report"; assumptions "above about 11.8%".

## Reviewer's rulings on the four open points

1. Pins enforced by precondition and order are not sufficient: the tool must refuse at `--register` (P-1).
2. Pinning the proposal and its review is recommended, not required (O-1; harmless, add on the next `.gitattributes` commit).
3. `.gitattributes` without an attribute of its own is fine; it is in no identity set, but readers must split on `\r?\n`.
4. The "upper-middle median" wording: see the deviation below.

## `.gitattributes` lines added (`8eba2e1`)

Exact-path `text eol=lf` for `07-09-PAIRED-AMENDMENT-V2.md`, `07-09-PAIRED-AMENDMENT-DECISION.md`, `07-09-PAIRED-AMENDMENT-V2-REVIEW.md` and `evidence/07-paired-session-registry.json`, each with a comment line. Session evidence paths are not yet pinned; plan 07-16 adds them before its first registration.

## Deviations from Plan

**1. [Stated deviation] Task 1 criterion "section 4 names the upper-middle median".** After E1 the reviewer's exact replacement text for section 4 states `sorted[floor(n/2)]` with the position for every group size (for example 4th of 6, 2nd of 3, larger of 2) rather than the phrase "upper-middle median". Section 11 item 1 says in words that for an even count it is the upper middle value. The reviewer ruled this met in substance and asked for the difference to be recorded here. The document was not edited for it.

**2. Plan process.** Task 2 was executed by the orchestrator dispatching an independent reviewer (the plan forbids self-review), with the edits E1 to E9 applied between two passes as the plan's `changes-required` branch directs. The document was edited only through those required edits; the approved numbers were not touched.

Otherwise the plan was executed as written.

## Corrections recorded here only

The plan 07-24 first-person view figure "about 25 to 30 percent" (`07-24-SUMMARY.md`) is not what that summary's own numbers show: they give about 11 to 12% in generation-2 active play and about 20 to 25% on the results screen, from a few samples each, unverified. `07-24-SUMMARY.md` was not edited. The contract does not depend on the size, and states the observation as unverified.

## Frozen-pass rule and what was not run

The frozen-pass rule (section 9): an exit 0 of the frozen command on a later capture is recorded with its evaluation count and escalated to the owner; the tooling never treats it as a pass, writes no frozen qualification and does not stop or alter paired sessions.

The exact frozen source is reconstructible byte for byte, and capturing it on today's host is an available measurement that would show how much of the 40 overruns is the machine. It was NOT run (option O-1 of the proposal review is not adopted; the owner approved `reference_commit: c973458`).

## Threat Flags

None. No code changed.

## Known Stubs

None.

## Self-Check: PASSED

- V2 document and review record exist; working files and HEAD blobs hash to `8f3f6c72...1aa3` and `f61edef1...6689`.
- Task 1 and task 2 verify commands exit 0.
- Commits `2ea292e`, `56da66a`, `8eba2e1`, `61f9f69` are ancestors of HEAD; `git rev-list --count 022591020a1f..HEAD` was 4 before this summary.
- `git status --short -- tools src` empty.
