# Plan 07-09 — host drift diagnostic (2026-10-09)

Status: diagnostic only. No budget, reference, sampler, limit or protected runtime byte was
changed. Plan 09 task 2, plan 10 and Phase 7 remain open. Nothing here is a V2 pass.

## Question

The V2 gate compares current timings against limits frozen from one reference capture on
2026-10-06. Is the failure a source regression, or is this machine now slower than it was
when the reference was captured?

## Method

Smoke profile only (`review.mjs --animation-candidate --smoke`: run 1, Low, one actor, 214
timed frames), three runs each, interleaved on the same host in the same half hour:

- **HEAD**: current source at `74feab1`.
- **Near-reference**: a scratch copy of HEAD with the five mutable runtime owners
  (`characterResources`, `enemyGLTF`, `firstPersonRig`, `enemyAnimations`, `weaponHandling`)
  taken from `c973458` (the commit that froze the budget before runtime tuning) and the
  original motion tuple restored.

The near-reference tree is an approximation. The exact reference bytes for three of the five
owners exist in no git object (the reference was captured from an uncommitted working tree
with mixed line endings), so a byte-exact A/A capture is not possible.

Host during runs: Ryzen 5 5600, Balanced power plan, VS Code, Brave and Claude running,
16-55% CPU load sampled.

## Result (ms; three runs each)

| Component | Stat | Reference run 1 / 2 | Frozen limit | Near-reference now | HEAD now |
|---|---|---|---|---|---|
| frameIntervalMs | median | 206.3 / 225.5 | 244.7 | 322.4 / 335.5 / 319.2 | 293.6 / 334.6 / 313.9 |
| frameIntervalMs | p95 | 227.4 / 244.4 | 261.4 | 394.2 / 433.8 / 420.8 | 415.3 / 470.9 / 403.7 |
| correctionMs | median | 0.9 / 0.9 | 0.9 | 1.9 / 1.8 / 1.9 | 1.5 / 1.3 / 1.6 |
| correctionMs | p95 | 1.2 / 1.2 | 1.2 | 2.6 / 2.4 / 2.6 | 2.1 / 2.0 / 2.3 |
| renderMs | median | 0.7 / 0.7 | 0.7 | 1.3 / 1.3 / 1.4 | 1.4 / 1.3 / 1.5 |
| renderMs | p95 | 0.9 / 0.9 | 0.9 | 1.8 / 1.8 / 1.7 | 1.8 / 2.1 / 1.9 |
| coreCorrectionMs | median | 0.3 / 0.3 | 0.3 | 0.7 / 0.6 / 0.7 | 0.6 / 0.5 / 0.6 |
| coreCorrectionMs | p95 | 0.5 / 0.5 | 0.5 | 0.9 / 0.8 / 1.0 | 0.8 / 0.7 / 0.9 |
| viewMs | median | 0.4 / 0.5 | 0.6 | 0.9 / 0.9 / 1.0 | 0.7 / 0.7 / 0.8 |
| viewMs | p95 | 0.7 / 0.6 | 0.8 | 1.4 / 1.4 / 1.4 | 1.2 / 1.2 / 1.3 |

## Reading

- Pre-optimisation source measured today is about 1.5-2x slower than the reference numbers
  on every component, and fails the frozen limits by the same margin as HEAD. The host, not
  the source, accounts for the gap to the limits.
- Under identical conditions HEAD is faster than near-reference in the components the
  optimisations touched (correction about -20%, view about -15%) and equal within noise in
  render and frame interval.
- Several limits sit at 0.0-0.1 ms with a 0.1 ms browser timer, so one timer tick is a
  100% overrun.

## Limits of this diagnostic

One of twelve profiles; near-reference is not byte-exact; three runs per arm; host load was
not controlled. It shows the direction and size of host drift, not a qualified comparison.

## Separate blocker found

`src/builders/enemyGLTF.test.js` is in the frozen reference identity set and is not a
permitted mutable path. It had to change in `9ce341b` because its frozen form asserts that
provenance equals the current donor, export and manifest, which is false by design after
the CR-02 promotion. `verifyCandidate` will therefore reject any new capture with
"Protected source changed" before it evaluates timings. Resolving this needs an explicit,
reviewed decision; it was not changed here.

## Options for the owner

1. Recapture after restoring host conditions (close other applications, High performance
   power plan). Cheap, but passes only if the original conditions can be reproduced.
2. Amend the contract to a paired same-session comparison: capture reference-equivalent
   source and candidate interleaved in one session and bound the ratio. Robust to host
   drift; needs a reviewed budget amendment and a byte-exact reference source decision.
3. Keep the gate as it is and leave plan 09 halted.

## Full recapture under High performance plan (2026-10-09)

Owner chose option 1 once. Source `2e2f90f`, all 12 profiles, High performance power plan
for the run (Balanced restored afterwards); VS Code, Brave and Claude were not closed.
Report: `.planning/research/.cache/06-art/animation-candidate/07-09-candidate.json`,
SHA256 `c884065f9152a639b7cf2ca8159e05799d75dcc0707fda987c27270fec45c6fa`.

**Actual V2 CLI: exit 1, "Ownership/essential resource changed"** — `view.sourceCallbacks`
is 4, the frozen profile expects 3. Timings were not evaluated by the gate. This is not a
pass and is not a complete qualification.

Cause of the fourth callback: `f89d820` (owner caches) made `handlingReferences()` in
`src/builders/weaponHandling.js` register a character disposer on the handling owner's
skeleton. For the third-person player weapon that skeleton is the source actor, which
already carried three disposers. The last capture that passed the ownership check was at
`2a5b7ef`, before that commit; no full capture had been run since.

Diagnostic timing comparison of the same report against the frozen limits (computed outside
the gate, so it carries no acceptance weight): 72 of 192 statistics over, ratios 1.03-1.62
(the 2026-10-07 capture had 135 over, up to 1.77 on JS components and 2x on frame interval).
Frame-interval medians, actual|limit ms:

| Profile | Run 1 | Run 2 |
|---|---|---|
| Low / 1 | 223 \| 245 | 253 \| 245 |
| Low / 8 | 358 \| 361 | 397 \| 361 |
| Medium / 1 | 258 \| 243 | 259 \| 243 |
| Medium / 8 | 424 \| 410 | 438 \| 410 |
| High / 1 | 264 \| 240 | 275 \| 240 |
| High / 8 | 451 \| 411 | 597 \| 411 |

Run 2 is slower than run 1 in every profile, so conditions also drifted within the session.

Outcome: option 1 did not pass. Two separate problems remain: the structural ownership
mismatch from `f89d820`, which fails the gate regardless of timing, and host-dependent
absolute limits.
