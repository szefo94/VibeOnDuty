# Plan 07-10 — Implementation and final acceptance dependencies

2026-10-07. User constraint: “Other jobs need to keep running.” Leave unrelated jobs untouched. Independent `gsd-plan-checker` review found this dependency refinement legitimate only with an enforced separate final acceptance dependency. Parent adopts those conditions below; no numerical, human or verification gate is waived.

Implementation inputs already exist in plans 07-03 (published motion/source/recovery interfaces) and 07-08 (isolated review). Plan 07-10 may implement candidate-only recovery, moving review collection, documentation and stable checks after those predecessors. Reconcile its implementation wave to 8 and `depends_on` to exactly those plans. Execution remains sequential with plan 09; shared review owners, output and source publication must not overlap.

## Enforced final qualification

Plan 07-09 task 2 remains a binding final acceptance dependency. `--animation-capture` must execute the applicable frozen-V2 verification against actual current-source independent evidence and require plan 09's current non-halted acceptance plus the two outstanding browser assertions to be qualified. Add negative controls proving the capture gate rejects halted/unqualified plan 09 even when collection or recovery succeeds. An absent, stale, incomplete or failing acceptance result cannot become a pass. Capture may save clearly identified partial artifacts, but must exit nonzero whenever this dependency, matrix completeness or any original capture predicate is unmet.

Do not complete plan 07-10 or Phase 7, advance requirements, or record human acceptance while plan 09 remains unqualified. A truthful recovery-only result may pass its own checks and report partial task progress; it confers no capture/performance acceptance. Keep both original task acceptance criteria.

## Protected domains

Use the applicable frozen V2 contract; preserve original failed comparisons and every historical source/candidate identity. Keep all protected identity bytes unchanged, including `tools/art/provenance.json`, accepted GLB, soldier source/parameters/paint, protected runtime and sampler. New provenance/recovery facts belong in separate evidence/docs. Candidate edits stay unpublished. Semantic equality cannot substitute for protected byte equality. Recovery must still reject old-motion-only and protected-domain corruption, and independently reopen/regenerate current motion.

All stable checks report actual outcomes. Browser suites run sequentially using isolated owned listeners/output, coexist with unrelated jobs, and never stop or modify them. Record setup limitations rather than raising timeouts or claiming unrun assertions passed. Human moving review and representative-device/60 FPS acceptance remain separate.

This is an implementation sequencing refinement, not acceptance of the failed performance gate. It is binding for amended plan 07-10 and its validation.
