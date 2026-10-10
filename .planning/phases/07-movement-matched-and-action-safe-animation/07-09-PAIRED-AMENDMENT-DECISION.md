---
phase: 07-movement-matched-and-action-safe-animation
plan: "15"
decision: approved
approval_condition: conditional-on-review-required-changes-R1-to-R8
decided: 2026-10-10
decided_by: owner
confirms_07_21_option: yes
accepts_enemyGLTF_test_exception: yes
proposal_sha256: 4ecad5a12772a5739012e1a2673fa1c596147e0c44be111183c0482a0e7663cd
review_sha256: 7fe81473b0a7f2eca58f9b5db0b22e3789c0049a135a324e287685ab0a400022
t_aggregate: 0.05
t_single: 0.25
timer_quantum_ms: 0.1
session_cap: 3
reference_commit: c973458
reference_arm_accepted: true
---

# Plan 07-15 task 2: owner decision on the paired same-session timing amendment

## Decision

`decision: approved`, **conditional**. The condition is carried in the frontmatter line
`approval_condition` and here: the owner's approval applies only once the review's required
changes R1 to R8 (`07-09-PAIRED-AMENDMENT-REVIEW.md`, status `changes-required`, no blocker)
have been made to the proposal and to its implementation. No paired result counts before that.
Until the conditional changes are implemented and a paired session passes under the session cap
and disclosure rules below, the frozen V2 contract remains the only applicable timing gate and
plan 09 stays halted.

## Owner reply, verbatim

> approved with the eight fixes, yes, yes, none (i will prepare computer so that this full run is free to go)

## How the reply maps to the fields

The orchestrator presented the review's verdict, what a paired pass would and would not mean,
the weaknesses found, R1 to R8 and three options (approve conditional on R1 to R8; reject;
measure the rebuilt frozen source first). It recommended approval conditional on R1 to R8 with
`T_single` 0.25, `T_aggregate` 0.05 and a cap of 3 sessions, and asked for answers on the 07-21
option, the `enemyGLTF.test.js` exception and a `host_ready` time or `none`. When the owner asked
what was to be decided, the orchestrator restated the four items in plain terms and said a reply
of "approved with the eight fixes, yes, yes" plus a time or `none` would express agreement with
all its recommendations.

- `decision: approved` with the condition R1 to R8: "approved with the eight fixes".
- `confirms_07_21_option: yes`: the first "yes" (option `register-exception-pinned-lf` for
  `src/main.js`).
- `accepts_enemyGLTF_test_exception: yes`: the second "yes" (exact-hash exception for
  `src/builders/enemyGLTF.test.js`, finding G-02).
- Tolerances and cap: `t_aggregate` 0.05, `t_single` 0.25, `session_cap` 3 and the majority and
  disclosure rules are the reviewer's recommendation, carried in the orchestrator's stated
  recommendation, which the owner approved by that reply. **The owner did not type these numbers.**
- `host_ready`: not given. The owner said `none` and that they will prepare the computer so the
  full run is free to go. No time is invented here, and no `host_ready` is written into
  `07-14-MP-ROUTE-DECISION.md`.
- `reference_commit: c973458` and `reference_arm_accepted: true`: the reference arm is accepted as
  the review describes it after R2 (working-tree bytes plus the five owners from `c973458`), not
  as "every file at the candidate commit from git objects".

## Binding conditions (review findings the owner accepted, none overridden)

| id | Required change |
|---|---|
| R1 | State what is measured: the effect of edits to the five owner files after `c973458`, in offline Training Range. Drop "did the Phase 7 runtime changes make animation cost worse". Add the five extra "would not mean" items. |
| R2 | Replace "cannot be rebuilt"/"unrecoverable" with the facts (the frozen bytes are reproducible from `c973458`); describe the arm as working-tree bytes plus five owners from `c973458`; reword decision 3. |
| R3 | Define the aggregate exactly (which middle value, or a mean); apply it per actor count and per tier as well as to all 12 profiles; state the minimum number of profiles with `r > 0` and what happens below it. |
| R4 | Balance capture order inside every tier and actor count (reference-first in run 1 is candidate-first in run 2); odd/even by profile number is confounded with actor count. |
| R5 | One same-arm calibration session (reference against itself, same order scheme) recorded before any qualifying session; tolerances stand only if it passes rules 1 and 2; drop rule 3 or restate it as a gross-instability check plus a ratio-agreement check between runs. |
| R6 | Cap of 3 sessions per candidate source identity; every started session counts; sessions registered before they run; validity decided by the tool before the predicate; pass only if more valid sessions passed than failed and at least one is valid; result worded with its denominator. |
| R7 | Both arm reports carry a nonce from one invocation with per-profile start and end times showing interleaving; reject any arm report created outside that invocation, including any existing single-arm V2 candidate. |
| R8 | State that 5% and 25% are effective only for the frame interval, give the effective bounds for sub-millisecond components, and state that zero limits are loosened from exact to one timer tick. |

The tolerances are ceilings and are never raised after any candidate data has been seen.

## What approval means and does not mean

A paired pass would show only that edits to the five owner files after `c973458` did not add
cost, within tolerance, in the offline Training Range capture (frame interval within 5% typically
and 25% in any single profile; small script components within about one timer tick), with every
structural check of the frozen gate still passing.

It would not mean:

- that the original absolute limits were met (they were not, and that stays recorded);
- anything about Phase 7's total effect on animation cost, or about files outside the five owners;
- that the first-person view cost is visible: the reference arm already contains the view (added
  before `c973458`), so the predicate cannot see it, and the frozen limits have the same blind spot;
- anything about online play or any workload other than offline Training Range with 1 and 8 source actors;
- any frame-rate, representative-device or human aesthetic claim.

No earlier report becomes a pass. `07-09-PAIRED-AMENDMENT.md` is left byte-identical so the hash
decided on stays valid; the R1 to R8 changes are made in the implementation plan's artifacts, not
by editing the proposal.

## Consequence

Plan 07-16 implements the paired predicate with exactly these numbers and the conditions R1 to R8,
and pins the SHA-256 of this file. Plans 07-17, 07-18 and 07-19 stop at their readiness
precondition until the owner states a `host_ready` time. If the conditions cannot be met, the
frozen V2 contract stays the only applicable gate and plan 09 stays halted.
