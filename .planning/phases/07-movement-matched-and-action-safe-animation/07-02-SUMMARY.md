---
phase: 07-movement-matched-and-action-safe-animation
plan: "02"
subsystem: animation
tags: [blender, gltf, retargeting, original-motion, protected-art, recovery]
requires:
  - phase: 07-01
    provides: Immutable moving baseline and numeric budget
  - phase: 06-human-characters-and-comic-book-blender-iteration
    provides: Accepted 65-joint human and protected illustrated art
provides:
  - Original saved donor action with distinct rest rolls and fresh-process append/retarget
  - Strict manifest-limited motion merge preserving accepted art and 48 inherited occurrences
  - Retained negative fixtures, independent repeat/export and editable recovery
  - Validated staged publication command reserved for plan 07-03
affects: [07-03, 07-04, 07-09, 07-10, ANIM-04]
tech-stack:
  added: []
  patterns: [Fresh pinned Blender reopen, Exact motion allowlist, Protected semantic comparison, Owned candidate cache]
key-files:
  created: [tools/art/build_motion.py, tools/art/motion-manifest.json, tools/art/sources/motion.blend, tools/art/motion-pipeline.mjs, tools/art/motion-pipeline.test.mjs]
  modified: [tools/art/inspect-character.mjs, tools/art/verify-export.mjs, tools/art/provenance.json]
key-decisions:
  - "Author original keyed curves from neutral/rest on a separately retained donor with distinct bone rolls, then append and retarget world-rest deltas parents-first."
  - "Keep accepted render/skin/inverse-bind/material/image domains and all inherited clip occurrences exact; only explicitly named original motion additions are permitted."
  - "Keep new curve authorship separate from unresolved inherited rig, mannequin/Mixamo motion and weapon redistribution terms."
requirements-completed: [ANIM-04]
coverage:
  - id: D1
    description: Saved original donor independently retargets into changing named target channels without rewriting accepted art
    requirement: ANIM-04
    verification:
      - kind: unit
        ref: node --test tools/art/motion-pipeline.test.mjs
        status: pass
      - kind: integration
        ref: node tools/art/motion-pipeline.mjs build --candidate
        status: pass
    human_judgment: false
  - id: D2
    description: Corruption, source scripts and path escapes reject; editable backups regenerate the original motion
    requirement: ANIM-04
    verification:
      - kind: integration
        ref: node tools/art/motion-pipeline.mjs self-test
        status: pass
      - kind: integration
        ref: node tools/art/motion-pipeline.mjs repeat
        status: pass
      - kind: integration
        ref: node tools/art/motion-pipeline.mjs recover --demo
        status: pass
      - kind: integration
        ref: node tools/art/verify-export.mjs --motion
        status: pass
    human_judgment: false
  - id: D3
    description: Natural moving donor quality and transition suitability
    requirement: ANIM-04
    verification: []
    human_judgment: true
    rationale: Original keyed donor aesthetic sufficiency and the unclassified ANIM-04 edge remain assumptions until end-of-phase moving human review.
actuals:
  tokens: 14633
  tasks: 2
  commits: 4
plan_head_before: 6c85902fc73d9c2e17b7b1f6a3412c85253e3e7f
plan_head_after: b99d7c0c4579325ef788cdbf1645faba622f6931
duration: 14min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 2: Editable Original Motion and Protected Export Summary

**A saved original directional-walk donor retargets through fresh Blender processes into twelve changing quaternion channels while preserving all accepted art and inherited motion.**

## Performance

- Observed implementation window: 2026-10-05T20:22:46.928Z through approximately20:36Z; mandatory initialization reads preceded this window.
- Two tasks; eight deliverable files. Actual tokens are ceiling(58,532 realized Git diff characters /4), with binary source represented by Git's binary-diff marker rather than treating binary bytes as text.
- Final Node motion suite: **33 passed, 0 skipped**, 11.386s. Existing exact inspector suite: **12 passed, 0 skipped**, 10.382s.
- Two fresh repeat exports: **8.796s**, semantic and byte identical. Editable recovery with four fresh exports: **18.702s**. Separate independent `verify-export --motion` also passes.

## Accomplishments

- `motion.blend` retains one original `OriginalWalk` action, its exact `OBMotionDonor` slot and inspectable changing keyed curves authored from neutral/rest. The donor derives its hierarchy from the inherited rig and deliberately changes bone rolls; actual rest differences are measured after fresh reopen and library append.
- The pinned Blender4.5.13 LTS process uses factory startup, disabled autoexec and `use_scripts=False`, appends only selected donor resources, explicitly assigns the action slot and bakes finite quaternion keys with world-rest deltas parents-first. Unwanted translations are zeroed; gameplay remains root authority.
- Strict schemaVersion1 metadata bounds exact action IDs, names, slots, mapping, frame/FPS/duration, loop/contact phases, cycle-displacement calibration and torso limits. Duplicate/unknown JSON fields, unknown targets, invalid samples, loop seams, wrong rigs and silently unchanged motion reject.
- Motion merge appends only mapped changing rotation channels to a copy of accepted GLB data. Protected render graph, mesh attributes, weights, inverse binds, skin hierarchy, material/image pixels and all48 inherited animation occurrences remain exact. Varying unlisted raw channels reject rather than silently disappearing.
- The real candidate validator rejects18 retained corrupt GLB fixtures. Manifest, duplicate-key, equal-corrupt comparison, existing-output, source/output alias, traversal, external and in-root junction, incomplete/foreign/stale publication controls also pass.
- The integration self-test retains four corrupt editable sources: wrong slot, wrong action, wrong rig and unchanged keys. All reject without creating a candidate. A raising registered source-text sentinel is saved and explicitly skipped by the fresh Blender reopen.
- Repeat and recovery retain separate editable source/manifest/backups and fresh export evidence. A bounded1.12 left-thigh keyed-quaternion change changes only motion; restored editable inputs independently regenerate the original bytes. The standalone verifier reopens them again.
- `publish --latest` validates owned complete evidence and hashes, retains editable inputs and previous export, validates a staged GLB, then atomically renames it. The ready latest candidate validates without publication; plan03 invokes this command first.

## Task Commits

1. Task1 RED: `9b3a0c3` — specify protected motion-only candidate export.
2. Task1 GREEN: `aae1c5d` — retarget original editable donor into protected motion candidate.
3. Task2 RED: `636a059` — specify independent motion slot rejection and regeneration.
4. Task2 GREEN: `b99d7c0` — validate fresh motion export rejection and editable recovery.

Both intentional RED runs were persisted in `.planning/research/.cache/07-02-red1.json` and `07-02-red2.json`; both received **RED_EVIDENCE_OK** before implementation. Task1 tracer was rerun successfully before expansion under the automated-only end-of-phase verification policy.

## Source and Evidence Identities

- Accepted runtime GLB remains `3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`.
- Saved donor: `d8f6c2315f2661254256f22f049d1c8cf0826c3cab304db41663ad4a45e8303d`.
- Manifest: `e37d4c19e27dba60e922f182e9714027f0ca0da7b6f646b585c9573acc0e3de8`.
- Original motion candidate: `e5f1dfb8c45ba1d4492297d4818c3188efccc46cb23f6bcd6b2e48fcae221ddb`.
- Changed recovery candidate: `e03424e3d8e072415cfd50502f9e3255ee2d7989169ee797fda5d6e9750ec689`.
- Restored source hash equals saved donor exactly; changed editable source hash is `bf17f8e0249a712225af30e34a955fd2538d89ed3ae92943602b958eeb617b82`.
- Candidate report: `.planning/research/.cache/07-motion/candidate-zogPAp/report.json`; latest report SHA256 `9b68e5ab50ca9c62ba59c93f2513ad793ca377b756506e1016654c869e8b8cc6`.
- Repeat: `.planning/research/.cache/07-motion/repeat-WkM71s/report.json`, SHA256 `00f1a8cd65345c2a2df9cff7efaf5fa9eddeae22ee95543afea396c4959adcbb`.
- Recovery: `.planning/research/.cache/07-motion/recovery-FNPgIR/report.json`, SHA256 `7699a66472b21c6e1c6c02c2638702c33984045dba8fbe8883d7a8561cec90f8`.
- Independent verification: `.planning/research/.cache/07-motion/independent-17c3RQ/report.json`, SHA256 `55e1f4cd5b9b7fea8980dfa2d1736bea0b30aaba10ccfa35a1658373a7e46393`.
- Source suppression/rejections: `.planning/research/.cache/07-motion/script-suppression-cvJYXk/report.json`, SHA256 `68defec40d77ae6a9ab5c5f22c6e06fd2ab576a0aa582aadb0950ad0326fa59c`.
- Paths above are under ignored `.planning/research/.cache/`; per-attempt artifacts remain separately retained. Final command logs are `07-02-tests.log`, `07-02-inspector.log`, `07-02-self-test.log`, `07-02-repeat.log`, `07-02-recovery.log`, `07-02-independent.log` and `07-02-final-candidate.log`.
- Canonical07-baseline.json and07-budget.json were read and remain unchanged; no baseline capture or browser suite was rerun.

## Deviations from Plan

**1. [Rule2 - Missing critical validation] Retain actual corrupt saved-source controls in the trusted authoring script.**
- Task2 needed meaningful saved-source slot/action/rig/unchanged rejection, beyond synthetic candidate metadata corruption.
- Extended the task1-owned `build_motion.py` with exact bounded test-fixture modes, measured donor rest differences and donor slot target checks. Task2's listed inspector/CLI/test files consume these controls.
- Self-test verifies all four saved-source candidates reject before output, and records their retained paths.
- Commit: `b99d7c0`.

## Issues Encountered

- An ESM dynamic-import cycle while awaiting the CLI at module top level prevented repeat completion. Matching the existing nonblocking CLI entry pattern resolves it; final repeat and independent verification pass.
- A paint corruption fixture initially assumed an existing baseColorFactor array. The corrected fixture supplies a changed authored factor and now reaches the real protected-domain validator.
- Earlier failed attempts remain in unique ignored directories; none is described as passing evidence. No package installation or authentication gate occurred.

## Limits and Next Plan Readiness

- No runtime GLB publication occurred, and soldier.blend remains unchanged. Plan03 can extend the original repertoire and invoke validated publication.
- Repeat/recovery here use the accepted Phase6 baseline hash. Perform repertoire build/repeat/recovery before first publication; retained independent recovery evidence continues to reference its own baseline.
- Cycle displacement2.4m is declared authoring calibration for this donor, not measured live gait or a changed movement speed.
- Original curve authorship does not clear the inherited donor hierarchy, mannequin/Mixamo motion, weapon/FBX or anatomical asset terms as a combined asset.
- The unclassified ANIM-04 edge and original donor aesthetic sufficiency remain explicit assumptions. Human moving review and representative-device/FPS qualification are outstanding phase-level work; this tooling plan makes no such acceptance claim.
- No goal-blocking stubs, skipped tests or unrun plan verification remain.

## Self-Check: PASSED

All eight deliverable files exist. All four task commits exist. Both task verification sets pass; accepted runtime/baseline/budget publication is unchanged.
