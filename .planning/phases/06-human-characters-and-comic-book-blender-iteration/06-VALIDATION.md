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

Commands below are planned checks, with no passing evidence claimed. All paths
are checkout-root-relative. New commands/tests are created by their named task
before that task runs its verification.

| Task | Requirement | Automated command | Creation / evidence status |
| --- | --- | --- | --- |
| 06-01-1 | ART-01/03/04 | node tools/art/pipeline.mjs self-test; node tools/art/pipeline.mjs build --probe; npm run test:e2e -- tests/character-art.spec.js --grep "art tracer:" --workers=1 | Task creates pipeline, Blender source and real-game tracer |
| 06-01-2 | ART-01/03 | node tools/art/pipeline.mjs probe --provenance | Pipeline exists after 06-01-1; ledger retained here |
| 06-01-3 | ART-01/03 | node tools/art/inspect-character.mjs --self-test; node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb; node tools/art/verify-export.mjs --repeat | Task creates semantic inspector/repeat checker |
| 06-02-1 | ART-01/02/03 | node tools/art/pipeline.mjs build --probe; node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb; npm run test:e2e -- tests/character-art.spec.js --grep "art soldier:" --workers=1 | Complete posed human source and browser cases |
| 06-02-2 | ART-02/03 | node tools/art/pipeline.mjs build-slice --probe | Task creates slice source/export command |
| 06-02-3 | ART-02 | npm run test:e2e -- tests/character-art.spec.js --grep "art slice:" --workers=1 | Task creates playable M4/stone assertions |
| 06-03-1 | ART-01/02 | npm run test:unit -- src/builders/characterAppearance.test.js src/network/remoteActors.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art domains:" --workers=1 | Task creates semantic tint/lifetime cases |
| 06-03-2 | ART-02 | npm run test:unit -- src/comicOutline.test.js src/builders/characterAppearance.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art ink:|art resources:" --workers=1 | Task creates ink/resource cases |
| 06-04-1 | ART-02 | npm run test:e2e -- tests/character-art.spec.js --grep "art quality:" --workers=1 | Task creates menu/pause policy cases |
| 06-04-2 | ART-02 | npm run test:unit -- src/graphicsQuality.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art quality resize:" --workers=1 | Task creates pure resize/storage policy tests |
| 06-04-3 | ART-01/02 | npm run test:e2e -- tests/character-art.spec.js --grep "art fallback:|art compact:" --workers=1 | Task creates missing/corrupt media/compact cases |
| 06-05-1 | ART-03/04 | node tools/art/pipeline.mjs self-test; node tools/art/pipeline.mjs iterate --demo | Actual edit/source restore and matched game routing |
| 06-05-2 | ART-03/04 | node tools/art/verify-export.mjs --iteration; node tools/art/pipeline.mjs self-test | Independent restored-source re-export and bounded rejection checks |
| 06-06-1 | ART-01/02/03/04 | npm run test:e2e -- tests/character-art.spec.js tests/animation-regressions.spec.js --workers=1; npm run test:mp -- --grep "resources:"; node tools/art/review.mjs --capture | Task creates full pose/measurement report and production backstop |
| 06-06-2 | ART-01/02/03/04 | npm run lint; npm run typecheck; npm run typecheck:mp; npm test; npm run build; npm run test:e2e; npm run test:mp | Exact stable final gate set, run once after final source repairs |

## Edge Probe Resolution Map

These are planned resolutions for the cached probes, not evidence of a pass.

| Requirement / category | Resolution | Task / check |
| --- | --- | --- |
| ART-01 empty | Explicit: reject empty/truncated asset; zero/one/many primitives/materials; missing detailed media remains playable | 06-01-3 self-tests, 06-03-1 material tests, 06-04-3 fallback |
| ART-01 encoding | Explicit: exact byte SHA256 for source identity, NFC semantic names with duplicate-clip occurrence preserved | 06-01-3 inspector/comparison self-tests |
| ART-02 empty | Explicit: null/empty appearance roots and material arrays; missing paint falls back; fixed tier options | 06-03-1 tests, 06-02-3/06-04-3 browser checks |
| ART-02 encoding | Backstop: byte hashes and semantic domain validation are shared asset contracts; quality accepts exact enum strings | 06-01-3, 06-04-1/2 |
| ART-03 unclassified | Explicit domain review: actual repeat export, matching in-game comparison and source/runtime identity | 06-01-3, 06-05-1/2, 06-06-1 |
| ART-04 unclassified | Explicit domain review: inspect operation bounds, edit failure behavior and regenerate restored editable source | 06-05-1/2, 06-06-1 |

Descriptor-less probes do not establish an invented prohibition or human pass.

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
