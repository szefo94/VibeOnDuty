# Phase 7 — Explicit View Measurement Contract Amendment

Decision recorded 2026-10-06 following independent `gsd-plan-checker` review. This is a reversible measurement-scope correction, not a gameplay, art, hardware-performance or human-acceptance approval.

The original plan01 budget was measured with an external third-person FOV44 camera and no rendered essential first-person view. Current qualification uses a source-eye FOV75/down-look1.3 camera, actual arms/body/gun draws and an expanded correction producer. The original reference is therefore not a matched acceptance contract for this workload. Plan01 explicitly permits justified matched remeasurement. No locked user decision selected these numerical limits.

## Preserved evidence

Keep original `evidence/07-baseline.json` and `evidence/07-budget.json` byte-identical. Preserve the failed/noncomparable `evidence/07-09-cost-report.json`, all absolute old-frame-limit flags, and historical core/CPU-only attempts. Never rename or reinterpret their `legacyBudgetPass: false` or `cameraWorkloadComparable: false` as a pass. Do not claim an improvement across different cameras or producers.

## Applicable acceptance contract

Before any further performance tuning, archive the qualified twelve-profile source-eye report separately as `evidence/07-09-view-reference-v2.json` and freeze `evidence/07-budget-view-v2.json`. Record reference bytes SHA256, original evidence hashes, contractVersion, a canonical producerContractSha256, rationale, device/browser/GPU, viewport/DPR, source actors and separate view-pair counts, actor layout/scales, render scope, FOV/pitch/eye policy, warmup, 214 timed frames, simulation/sample clock, clone cycles, statistic definitions and timer limitations. The existing qualified report is reference evidence only; it cannot also serve as post-optimization candidate evidence.

For each tier/count/component/statistic, freeze `upper = max(run1, run2) + abs(run1 - run2)`. Define selectionMs, coreCorrectionMs and viewMs independently; define total correctionMs explicitly. Preserve timer precision and floating-point limitations without silently expanding numerical limits. No further source-eye reference/budget replacement is allowed after tuning begins.

Use a separately captured post-optimization candidate with the same measurement contract. Require two runs × three tiers × one/eight source actors, actual nonempty color-writing main-pass arms/body/gun draws, two allocated view bone textures, full-pixel evidence, exact protected source topology/skin and unchanged simulation roots/eyes. Keep essential limbs/parts at Low. Every applicable median/p95 limit must pass; an eight-actor improvement cannot excuse a failed one-actor profile.

Record fixed structural additions (charging geometry and view resources) separately from growth. Require deterministic plateau continuity, zero owned post-retirement actors/bindings/callbacks/listeners/props, zero shared resource disposals, live keeper survival and a usable subsequent clone. Proven resource reductions are allowed; unexplained increases are rejected.

## Executable gates and implementation

Create `tools/art/animation-budget-v2.mjs` and `tools/art/animation-budget-v2.test.mjs` with explicit freeze and verify commands. Freeze rejects incomplete/unqualified/mixed reference data and refuses changing an existing budget. Verify rejects incompatible producers/scopes/settings, missing view draws/pixels, numerical overruns, growth/leaks and damaged shared resources. Verify exits nonzero on failure; successful capture alone is never budget acceptance.

Planned commands:

- `node --test tools/art/animation-budget-v2.test.mjs`
- `node tools/art/animation-budget-v2.mjs freeze --reference .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-view-reference-v2.json --budget .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-budget-view-v2.json`
- `node tools/art/animation-budget-v2.mjs verify --budget .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-budget-view-v2.json --candidate .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-cost-postopt.json`

Then implement only per-instance exact-equality world skeleton sharing: same ordered bone objects and inverse-bind values, unchanged per-mesh bind matrices/skin palette mapping and posed vertices. Never share mutable skeletons between actors or independent view rigs. Retire the retained instance skeleton once; protect live siblings/templates. This optimization is supported by `evidence/07-09-world-skeleton-assessment.json` and requires its own behavioral/visual checks.

No Phase7/ANIM-05 completion is authorized until the actual post-optimization gate passes. Representative-device/60FPS qualification and human moving motion/anatomy acceptance remain separate pending work. Plan09 and VALIDATION must reference this versioned contract explicitly.

2026-10-07 owner-scope correction: `07-09-OWNER-SCOPE-REVIEW.md` independently approves exactly `enemyAnimations.js` and `weaponHandling.js` for bounded reference/collection caching in task 2. It supersedes only the implementation-owner restriction above. All frozen bytes, numerical limits, producer/settings, protected-source checks outside those two exact runtime paths and executable acceptance remain unchanged. Scope approval does not qualify the current failed candidate.
