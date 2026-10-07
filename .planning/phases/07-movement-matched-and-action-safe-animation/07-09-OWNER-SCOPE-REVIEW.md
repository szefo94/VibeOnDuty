# Plan 07-09 — Approved owner scope correction

Decision: 2026-10-07. Root reviewed the concrete proposal and obtained independent `gsd-plan-checker` **VERIFICATION PASSED** for the two-owner whitelist extension only. It is a reversible implementation correction within the authorized animation scope; no new user performance tradeoff is required. The actual V2 gate remains failed with 135 numerical violations. Scope approval establishes no performance pass or frame-time cause.

## Binding scope

Extend `MUTABLE_RUNTIME` by exactly `src/builders/enemyAnimations.js` and `src/builders/weaponHandling.js`. Keep every other protected-source check, including existing source-unit-test hashes. New loaded-rig regression work belongs in `tests/animation-resources.spec.js` and `tests/weapon-handling.spec.js`; acceptance negative controls belong in `tools/art/animation-budget-v2.test.mjs`. Do not expand the whitelist to other owners or tests.

Only bounded generation-owned reference and stable-collection caches are authorized. Preserve the original first depth-first lookup semantics, including duplicate names and missing references. Never cache pose-dependent targets, matrices/transforms, solver outputs, phase, eligibility, weights or outcome data. Perform every existing correction and preserve rest restoration, rotations, contact targets, weapon part movement, root/eye values, masks, phases, authoritative cues, action priority and timing.

Invalidate on relevant rig/root/mixer/weapon replacement and retirement; independent actor/view owners never share mutable caches. `presentationAction()` creates mask actions lazily within one mixer generation: any cached action collection must include every new lower/upper mask before stop/weight processing. Mixer replacement alone is insufficient. Prove first-time transitions followed by interruption/death cannot leave a masked action running.

Use real loaded-rig RED/GREEN checks for lookup traversal, identical correction/contact outputs, action-layer behavior, current/replaced owners, stale generations, live siblings, subsequent clones and idempotent cleanup. Negative controls must show the two exact owners are permitted while unrelated simulation/art/sampler/other owners still reject mutation. Retain protected checks rather than adapting them to incomplete tests.

## Immutable acceptance

Preserve frozen reference and budget bytes, producer hash `035432f721cb0661a82c288d3b5e92ce4d631a48da5bc6fbb73022897960f5e0`, sampler, workload/settings, all per-profile/component/statistic bounds and epsilon `1e-7`. No removal of required geometry, limbs, layers, corrections or rendering work. No numerical or timer-precision allowance is added.

Preserve the complete failed candidate at its source identity separately before publishing a later attempt. After meaningful implementation checks, capture a new independent complete twelve-profile matrix and run the actual named V2 CLI. Every numeric, pixel, scope, ownership and plateau predicate remains binding. No reference reuse, profile splicing or selective acceptance. If limits still fail, task 2 and dependent plan 10 remain open. Human motion acceptance and representative-device/60 FPS qualification remain separate.

This correction supersedes only the earlier restriction to palette/view owner optimizations in `07-BUDGET-AMENDMENT.md`; it does not replace or re-freeze the measurement contract. It is binding for plan 07-09 task 2 and its validation.
