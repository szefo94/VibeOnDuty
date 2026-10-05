---
phase: "06"
slug: human-characters-and-comic-book-blender-iteration
status: automated-complete-human-review-pending
nyquist_compliant: true
wave_0_complete: true
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

Plans 01–05 below have executed evidence in their canonical summaries. Plan 06
records the current corrected export and final suite results at closeout. All
paths are checkout-root-relative. Passing automation is separate from aesthetic
acceptance by a human.

| Task | Requirement | Automated command | Creation / evidence status |
| --- | --- | --- | --- |
| 06-01-1 | ART-01/03/04 | node tools/art/pipeline.mjs self-test; node tools/art/pipeline.mjs build --probe; npm run test:e2e -- tests/character-art.spec.js --grep "art tracer:" --workers=1 | PASS: bounded pipeline, reopened source and 3 actual-game tracers; 06-01-SUMMARY |
| 06-01-2 | ART-01/03 | node tools/art/pipeline.mjs probe --provenance | PASS: input-specific source terms/hashes; inherited terms explicitly unresolved |
| 06-01-3 | ART-01/03 | node tools/art/inspect-character.mjs --self-test; node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb; node tools/art/verify-export.mjs --repeat | PASS: 8 inspector cases, exact rig/motion, two independent source exports; 06-01-SUMMARY |
| 06-02-1 | ART-01/02/03 | node tools/art/pipeline.mjs build --probe; node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb; npm run test:e2e -- tests/character-art.spec.js --grep "art soldier:" --workers=1 | PASS: 15 actual pose samples and retained source; 06-02-SUMMARY |
| 06-02-2 | ART-02/03 | node tools/art/pipeline.mjs build-slice --probe | PASS: reopened editable M4/stone atlas, deterministic export; 06-02-SUMMARY |
| 06-02-3 | ART-02 | npm run test:e2e -- tests/character-art.spec.js --grep "art slice:" --workers=1 | PASS: 4 world/material/fallback/prefixed-production cases; 06-02-SUMMARY |
| 06-03-1 | ART-01/02 | npm run test:unit -- src/builders/characterAppearance.test.js src/network/remoteActors.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art domains:" --workers=1 | PASS: semantic owned accent tint/shared image lifetime; 06-03-SUMMARY |
| 06-03-2 | ART-02 | npm run test:unit -- src/comicOutline.test.js src/builders/characterAppearance.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art ink:|art resources:" --workers=1 | PASS: 15 combined unit cases, render-failure restoration and 14 keeper retirement cycles; 06-03-SUMMARY |
| 06-04-1 | ART-02 | npm run test:e2e -- tests/character-art.spec.js --grep "art quality:" --workers=1 | PASS: 3 tier/menu/pause cases; 06-04-SUMMARY |
| 06-04-2 | ART-02 | npm run test:unit -- src/graphicsQuality.test.js; npm run test:e2e -- tests/character-art.spec.js --grep "art quality resize:" --workers=1 | PASS: 14 pure assertions and 2 resize/storage browser cases; 06-04-SUMMARY |
| 06-04-3 | ART-01/02 | npm run test:e2e -- tests/character-art.spec.js --grep "art fallback:|art compact:" --workers=1 | PASS: 4 fallback and 3 touch/compact cases including isolated online play; 06-04-SUMMARY |
| 06-05-1 | ART-03/04 | node tools/art/pipeline.mjs self-test; node tools/art/pipeline.mjs iterate --demo | PASS: 2 bounded-operation cases plus actual changed/restored source and matching game pixels; 06-05-SUMMARY |
| 06-05-2 | ART-03/04 | node tools/art/verify-export.mjs --iteration; node tools/art/pipeline.mjs self-test | PASS: fresh independent Blender regeneration and protected domains/rejections; rerun on corrected 06-06 source |
| 06-06-1 | ART-01/02/03/04 | npm run test:e2e -- tests/character-art.spec.js tests/animation-regressions.spec.js --workers=1; npm run test:mp -- --grep "resources:"; node tools/art/review.mjs --capture | PASS: 32 focused browser cases, 2 production resource scenarios, 58 full-pixel captures and 3 warmed measured tiers; current export identities in evidence/06-review.json |
| 06-06-2 | ART-01/02/03/04 | npm run lint; npm run typecheck; npm run typecheck:mp; npm test; npm run build; npm run test:e2e; npm run test:mp | PASS: all seven final gates; 273 unit tests in 25 files, 45 offline browser tests, 14 production multiplayer tests; evidence/06-review.json finalValidation |

## Stable Final Results

The final source revision is `a93e0f94163ce67f17d0fe286768e6c0661c7240`.
All seven existing commands passed, with sequential browser suites and existing
dependencies. The initial full unit run exposed browser image IO during Node
imports and missing Node `self` during animation-only GLB parsing. These
Phase 6 defects were repaired; only the affected lint, root types and unit gates
were repeated before completing the remaining gates. No tests were intentionally
skipped. Later closeout changes are documentation, provenance and evidence only.

| Command | Latest result | Completed (UTC, 2026-10-05) |
| --- | --- | --- |
| npm run lint | PASS, zero warnings | 10:20:36 |
| npm run typecheck | PASS | 10:20:37 |
| npm run typecheck:mp | PASS; unaffected by Node-only repair | 10:16:21 |
| npm test | PASS, 273 tests / 25 files | 10:21:34 |
| npm run build | PASS; existing >500 kB JS chunk warning | 10:21:35 |
| npm run test:e2e | PASS, 45 tests | 10:31:08 |
| npm run test:mp | PASS, 14 tests | 10:40:34 |

The tracked `evidence/06-review.json` binds current source/runtime/export hashes,
67 retained PNG identities and successful log hashes. The owned cache retains
`final-gates.json` and its logs; superseded initial log streams are explicitly
marked rather than represented as preserved. The reviewed full-pixel capture at
10:23:35 UTC uses the final source revision and GLB SHA256
`3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`:
26,416 vertices, 34,172 triangles, 65 joints and 48 animation occurrences.

The current accepted source was also exercised by the bounded iteration demo
and independently reopened/re-exported recovery in
`.planning/research/.cache/06-art/iteration-GKGhaJ/`. Changed game pixels differ;
before/restored pixels and regenerated GLB identity match. The actual 58 frames,
eight exhaustive review sheets and selected pose sheet are retained in
`.planning/research/.cache/06-art/reviewed-3d92a093fc67/`; all 67 PNG hashes were
verified during closeout. Agent inspection covered the exhaustive sheets and
original face, hands, team and first-person images.

| Tier | Median / p95 (ms) | Sample duration (ms) | Calls / triangles / programs |
| --- | --- | --- | --- |
| Low | 4.1 / 13.9 | 222.8 | 365 / 35,442 / 12 |
| Medium | 8.8 / 16.6 | 337.5 | 1,102 / 86,418 / 15 |
| High | 11.7 / 21.6 | 489.2 | 1,317 / 87,198 / 15 |

Each tier used 12 warm-up frames and 40 synchronous mixer/render/GPU-finish
samples at 1280x960, DPR 1, in Windows headless Chromium reporting SwiftShader.
All tiers retained a warmed retirement plateau (428 geometries / 60 textures)
over six spawn/tint/retire cycles. These short samples omit normal input/network
and whole-game work, show run-to-run jitter and cannot certify 60 FPS or any
phone/iGPU/Pi capacity. Production resource tests use their existing reduced
200x150/DPR 0.25 fixture; the retained pose/tier images use full pixels.

## Edge Probe Resolution Map

These resolutions are exercised by the tests named in the map and canonical
summaries; they do not establish aesthetic acceptance.

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

- [x] Every task has automated checks or a declared Wave 0 dependency.
- [x] No three consecutive tasks lack automated checks.
- [x] All missing test/tool references are created and run.
- [x] Export, repeatability and restoration are demonstrated.
- [x] Required final regression suites pass.
- [ ] Human subjective acceptance accurately recorded.

Approval: all six implementations and automated validation are delivered, ready
for phase verification. Human subjective acceptance remains pending, including
proportions, face, grips, paint, armor facets and contour judgment. Inherited
support-hand/barrel fitting, first-person box-based M4 geometry, motion and
rig/FBX licensing limits remain explicit. No later phase has started.
