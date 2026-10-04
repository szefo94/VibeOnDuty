---
phase: "06"
slug: human-characters-and-comic-book-blender-iteration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-04"
---

# Phase 6 — Validation Strategy

## Test Infrastructure

Vitest and Playwright are installed with existing asset, rig, retirement and
multiplayer regressions. Pinned portable Blender supplies offline integration.
Fast checks: focused Vitest tests and the authored semantic asset inspector.
Full final gates: npm run lint, npm run typecheck, npm run typecheck:mp, npm test,
npm run build, npm run test:e2e, npm run test:mp. Estimated full runtime 15 minutes;
small task checks should return within 60 seconds where practical. Existing
animation/browser integration and Blender exports may take longer; report progress.

## Sampling Rate

Each task runs its relevant automated check. Asset changes require real export
inspection and existing real-rig browser tests; renderer changes require actual
quality/tint/resource checks. Run full suites once on the completed source, then
repeat only suites affected by repairs. Before final human review all required
automated gates must pass. No watch-mode commands.

## Per-Task Verification Map

Planner must replace this requirement map with exact plan/task IDs and concrete
created commands before execution; do not invent nonexistent passing tests.

| Requirement | Test type | Automated evidence | Current status |
| --- | --- | --- | --- |
| ART-01 | Asset semantic + real-rig browser | Inspector and existing assets/animation tests; source/license hashes | New inspector needed |
| ART-02 | Appearance unit + browser/resource | Semantic tint, textures, quality, repeated actor retirement | New appearance checks needed |
| ART-03 | Blender integration | Two exports compared semantically; editable .blend reopened | New export tooling needed |
| ART-04 | Blender integration + pose review | Bounded edit/export/restore and source hashes, matched capture evidence | New iteration tooling needed |

## Wave 0 Requirements

- Pinned verified portable Blender and positively licensed human source.
- Bounded source/cache/output handling and provenance manifest.
- Semantic export/rig/clip inspector.
- Focused appearance/quality/resource regressions and in-game capture harness.

## Manual-Only Verifications

Human aesthetic acceptance of proportions, face, grip, painted treatment and
outline intensity requires reviewing the actual model in gameplay. Agent visual
inspection must precede presenting the concrete result, but cannot be mislabeled
as a human pass. Broader phone/iGPU/Pi qualification remains unmeasured unless
actually performed. Inherited rig/motion provenance gaps must remain explicit.

## Validation Sign-Off

- [ ] Every task has automated checks or a declared Wave 0 dependency.
- [ ] No three consecutive tasks lack automated checks.
- [ ] All missing test/tool references are created and run.
- [ ] Export, repeatability and restoration are demonstrated.
- [ ] Required final regression suites pass.
- [ ] Human subjective acceptance accurately recorded.

Approval: pending implementation evidence.
