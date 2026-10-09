# Plan 07-09 — paired same-session timing amendment (proposal)

Status: **proposed, not approved, not implemented.** Owner approval of the tolerances and an
independent technical review are required before any implementation counts. Until then the
frozen V2 contract is the only applicable gate and plan 09 stays halted.

## Why

`07-09-HOST-DRIFT.md` records that the pre-optimisation source, measured today, fails the
frozen absolute limits by the same margin as the current source, that a recapture under the
High performance plan still had 72 of 192 statistics over, and that run 2 was slower than
run 1 in every profile of one session. Absolute limits taken from one capture on a shared
desktop measure the host as much as the code. The question the gate exists to answer is
"did the Phase 7 runtime changes make animation cost worse?", and that can be answered
without depending on host speed by measuring both sources together.

## What changes and what does not

Changes: only the **timing** predicate of the V2 gate.

Does not change, and is still evaluated exactly as V2 does today against the frozen budget:
producer contract and sampler hash, device class, view/pixel settings, essential geometry,
ownership and resource predicates (including `sourceCallbacks`), warmed plateau and
after-retirement counts, protected source identities with the registered CR-02 exceptions,
runtime dependency binding, completeness (2 runs x 3 tiers x 2 actor counts, 214 timed
frames each) and non-zero exit on any failure.

The frozen V2 reference, budget and every earlier failed result stay byte-identical and are
labelled historical. No earlier report becomes a pass.

## Reference arm

A byte-exact reference of the uncommitted working tree used on 2026-10-06 cannot be rebuilt
(see the drift note). The reference arm is therefore defined from git objects:

- every file at the candidate commit, except
- the five permitted mutable owners (`characterResources.js`, `enemyGLTF.js`,
  `firstPersonRig.js`, `enemyAnimations.js`, `weaponHandling.js` under `src/builders/`)
  taken from `c973458`, the commit that froze the budget before runtime tuning.

Both arms serve the same motion tuple and assets, so only the runtime owners differ. The
tool materialises the reference arm into an owned cache directory, verifies each of the five
blobs against hashes pinned in code, and refuses any other difference between the arms.

## Session

One invocation, one browser version, one host, no other capture running. For each of the 12
profiles the two arms are captured back to back, alternating which arm goes first (reference
first on odd profiles, candidate first on even), so slow drift within the session falls on
both arms equally. Each arm uses its own owned strict loopback listener.

## Timing predicate

For each profile, component and statistic (median, p95) let `r` be the reference-arm value
and `c` the candidate-arm value, both in ms, and `q = 0.1` ms (the browser timer quantum).

1. **Per-statistic bound:** `c <= r * (1 + T_single) + q`.
2. **Aggregate bound per component and statistic:** the median over the 12 profiles of
   `(c - q) / r` (profiles with `r = 0` use rule 1 only) must be `<= 1 + T_aggregate`.
3. **Session validity:** a session is invalid, and is a failure rather than a pass, if the
   reference arm's own run 1 and run 2 differ by more than `T_single` on frame-interval
   median for any tier and actor count.

Proposed tolerances, for the owner to set:

| Tolerance | Proposed | Basis |
|---|---|---|
| `T_aggregate` | 5% | The claim being tested is "no slower"; this allows measurement noise only. |
| `T_single` | 25% | Same-source smoke runs today varied by 14% on frame-interval median and 17% on p95. |

A failing or invalid session may be repeated, but every session's report and result are
retained, and a pass must come from one complete valid session, never from combining
sessions or selecting profiles.

## What a pass would and would not mean

Would mean: under one software-rendered session on this host, the current runtime owners
cost no more than the pre-tuning owners within the stated tolerances, with every structural
V2 predicate intact.

Would not mean: any frame-rate or representative-device claim, human motion acceptance, or
that the original absolute limits were met. Those remain open or historical as recorded.

## Implementation scope if approved

- `tools/art/animation-budget-paired.mjs`: pure predicate plus CLI, with negative controls
  for each rule (single overrun, aggregate overrun, invalid session, missing profile, arm
  source drift, reused report, stale lineage).
- `tools/art/review.mjs`: a paired capture mode that reuses the existing sampler unchanged.
- `tools/art/animation-capture.mjs`: `requirePlan09` accepts a paired result only when this
  amendment's approved identity is pinned in code; otherwise behaviour is unchanged.
- No change to `src/`, the sampler, the producer contract or any frozen evidence.

## Decisions required from the owner

1. Approve the approach (replace absolute timing limits with the paired predicate).
2. Set `T_aggregate` and `T_single`.
3. Accept the git-defined reference arm in place of the unrecoverable byte-exact one.
