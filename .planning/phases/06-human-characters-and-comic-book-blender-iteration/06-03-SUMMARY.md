---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "03"
subsystem: character-rendering
tags: [three-r160, comic-ink, skinning, team-tint, gpu-lifetime]
requires:
  - phase: 06-02
    provides: painted human, semantic material domains, illustrated M4 and structural stone slots
provides:
  - Accent-only team assignment with immutable neutral restoration and reusable owned materials
  - Selective projected-normal contours sharing the actual posed rig and geometry
  - Explicit contour disposal, renderer teardown and exception-safe simulation-eye restoration
affects: [06-04, 06-05, 06-06]
tech-stack:
  added: []
  patterns: [semantic tint allowlist, renderer-owned ink cache, actor disposal callbacks, outline-only smooth normals]
key-files:
  created: [src/builders/characterAppearance.js, src/builders/characterAppearance.test.js, src/comicOutline.js, src/comicOutline.test.js]
  modified: [src/builders/enemyGLTF.js, src/builders/characterResources.js, src/loop.js, tests/character-art.spec.js]
key-decisions:
  - "Preserve source material colors/maps outside team-accent; tint reuses each actor's designated accent materials."
  - "Adapt pinned r160 projected-normal skinning/morph chunks with full MIT notice and explicit GPU disposal."
  - "Average only outline normals at coincident vertices with matching skin influences; keep authored shading and deformation intact."
  - "Exclude the open collar shell from inverted-hull ink to preserve the painted neckline."
requirements-completed: [ART-01, ART-02]
requirements-note: Technical contributions only; phase-wide requirements and human aesthetic acceptance remain pending.
coverage:
  - id: D1
    description: Protected painted domains survive offline and generation-owned online team assignments and retirement
    requirement: ART-01
    verification:
      - {kind: unit, ref: "src/builders/characterAppearance.test.js; src/network/remoteActors.test.js", status: pass}
      - {kind: e2e, ref: "tests/character-art.spec.js#art domains:", status: pass}
    human_judgment: false
  - id: D2
    description: Selective actual-rig contours restore render state and plateau across repeated retirement
    requirement: ART-02
    verification:
      - {kind: unit, ref: "src/comicOutline.test.js", status: pass}
      - {kind: e2e, ref: "tests/character-art.spec.js#art ink: and art resources:", status: pass}
    human_judgment: false
  - id: D3
    description: Human aesthetic acceptance of the complete illustrated character/weapon/environment slice
    requirement: ART-02
    verification: []
    human_judgment: true
    rationale: Agent close-up/pose review is complete; subjective human acceptance occurs after all Phase 6 plans.
actuals:
  tokens: 11548
  tasks: 2
  commits: 4
plan_head_before: b47343d7681abe24ba20cf7cefeb106fdec24fef
plan_head_after: 50c885f7cd46ebc7eec0f9bf56ad4e36d833d3c4
duration: approximately 23min
completed: 2026-10-05
status: complete
---

# Phase 6 Plan 03: Protected Painted Domains and Skinned Comic Ink Summary

**Accent-only blue/red assignments preserve painted skin, fabric, armor, ink and M4 colors; bounded silhouette materials draw the same posed rig and retire with its owner.**

## Performance

- Started: approximately 2026-10-05T07:44:00Z
- Completed: 2026-10-05T08:07:00Z
- Tasks: 2
- Production/test files changed: 8
- Actual tokens: realized scoped git diff characters / 4, rounded upward; no harness-token estimate.
- Four task commits measured from the persisted plan ledger before documentation commits.

## Task Commits

1. Task 1 RED: `ae79bca` — protected tint domains and repeated ownership assertions.
2. Task 1 GREEN: `164ac35` — semantic appearance, reusable accent tint, owned cleanup and actual remote-generation browser coverage.
3. Task 2 RED: `ef9656e` — selective ink, lifecycle and finally-state assertions.
4. Task 2 GREEN: `50c885f` — adapted skinned contours, smooth hull normals, bounded lifetime, actual posed captures and gameplay eye restoration.

## Accomplishments and API Handoff

- `applyCharacterAppearance(root)` records mesh ownership and clones only designated accents. `tintCharacterAccents(root, color)` / existing `tintEnemyMesh(root, color)` reuse those materials; null restores neutral base. Material arrays, maps and untagged/protected domains remain intact. `team-accent` is the actual GLB metadata value; `teamAccent` node metadata is also supported.
- `registerCharacterDisposer(root, callback)` invokes each registered callback once at retirement. `registerCharacterTexture(root, texture)` retires explicitly owned textures only. Shared GLB/atlas maps remain alive; existing geometry, material, skeleton and mixer disposal remains the owner.
- `renderComicScene(renderer, scene, camera)` draws the base and at most one selective silhouette pass. Medium selects opaque tagged actor/M4 surfaces; High additionally selects tagged structural stone with `artContour` enabled. Transparent effects, helpers, untagged surfaces, ink-only detail meshes and explicit `artContour:false` nodes/materials are excluded. Low draws only the base.
- `setComicQuality('low'|'medium'|'high')` applies globally to current/future render calls; invalid values resolve to Medium. It changes outline policy only. Plan 04 owns DPR, shadows, persistence and menu controls.
- `disposeComicOwner(actorRoot)` releases its generated materials immediately. Existing actor retirement invokes it automatically. `disposeComicOwner(renderer)` releases all effect materials/cache entries and its context-loss handler; call it when tearing down an auxiliary renderer, before `renderer.dispose()`. WebGL context loss also releases the renderer's effect cache.
- Removed/hidden nodes expire on the next render; replaced materials dispose their previous contour immediately. Geometry, skeleton and morph influences are reused. A shared `comicNormal` geometry attribute averages coincident vertices only when bind influences match; authored lighting normals, topology and weights stay unchanged and no independent rig is allocated.
- Outer armor/M4 contours target 2 CSS pixels at 720px height, scaling with viewport height; skin uses 1.35px to retain face/finger detail and stone uses 1px. These costs are tier-scalable, not device certification.
- Scene/material arrays, callbacks, visibility, override material, matrix update, background, auto-clear and shadow state restore in `finally`. The gameplay render seam also restores simulation eye position when outline rendering throws.

## Verification

- Focused Vitest: **15 tests across 3 files passed** (`characterAppearance`, `comicOutline`, `remoteActors`).
- Actual GLB browser: **art domains** passes offline blue/red assignment and injected production remote actor generation ownership; protected domains retain original identities/colors/maps.
- Actual ink browser: full-resolution 1280x960 face, complete support fingers, armed body, crouch, jump, 10m and 20m frames visibly gain near-black silhouette pixels; no shader compile errors.
- Actual ink browser: intentional second-pass failure during exported gameplay `loop()` occurs after third-person camera displacement; exact simulation eye restoration passes.
- Actual High browser: Greek Columns structural slots receive silhouettes; omitted floor/detail slots stay out of ink; original materials/visibility restore. Inspected `ink-greek-columns-high.png` preserves existing rectangular world geometry and painted stone seams.
- Resource browser: **14 cycles**, four warm-up then ten measured tint/tier/spawn/double-retirement cycles with a live keeper. Every sample matched **56 geometries / 59 textures / 10 programs**. Keeper skin geometry/bone textures remain intact and no shared map disposal fires. The test compares to its measured warmed baseline, not these hardcoded values.
- Scoped ESLint passed with zero warnings.
- Full offline/MP suites and representative-device performance are intentionally scheduled for final Phase 6 validation; no claim of those gates passing is made here.

## Visual Review and Corrections

Actual screenshots in ignored `.planning/research/.cache/06-art/`:
`ink-face.png`, `ink-face-low.png`, `ink-hands.png`, `ink-hands-low.png`,
`ink-armed.png`, `ink-crouch.png`, `ink-jump.png`, `ink-distant-10m.png`,
`ink-distant-20m.png`, `ink-greek-columns-high.png`.

Split-normal seams on helmet/armor improved after introducing the outline-only averaged normal attribute. Matched Low/Medium face captures then exposed a filled black neckline caused by inverted-hull rendering of the open `RaisedFabricCollar` shell. Explicitly excluding that shell restores the painted neckline while retaining its finer authored seam. Latest face/hands/crouch and environment frames were visually inspected, not only numerically tested.

The close captures still show an inherited support-hand pose wrapping the barrel and cloth/collar surface facets/seam irregularity. These are visible on the matched Low image too. This plan does not retarget animation or alter weapon mount/geometry; broader motion/grip changes remain Phase 7. Final Phase 6 review should present these honestly, with human subjective acceptance still pending. Static captures and current animation samples do not certify all motion-view shimmer or representative hardware performance.

## TDD Gate Compliance

Both tasks have assertion-based RED commits before GREEN. Evidence is retained under `03-tint-red-junit.json` and `03-ink-red-junit.json`; SDK `check tdd-red-evidence` returned `RED_EVIDENCE_OK` before production implementation. The SDK parser did not accept Vitest's nested TAP summary, so actual JUnit output was used for classification. Existing tests reproduced full-body recolor/material replacement; the contour baseline reproduced the missing second pass, restoration and retirement behavior. No optional refactor commit was necessary.

## Deviations from Plan

None in delivery scope. Outline-only smoothing and excluding the open collar are the planned correction of actual silhouette defects. No dependency installation, binary asset change, authority/protocol change, animation overhaul or later-phase work occurred.

## Issues Encountered

Git Bash was not on PATH; the installed `C:/Program Files/Git/bin/bash.exe` ran the literal project-root guard and process-scoped safe-directory configuration. One test-only write preceded successful execution of that guard after the missing-PATH call; the correct pinned main checkout was verified before staging or any implementation. No worktree or protected-ref recovery was attempted. Root-owned temporary config and milestone lock stayed unstaged.

No placeholder deliverables, skipped tests or unrun task verification remain. No new network/auth/file-input trust surface was introduced. Existing inherited asset licensing and subjective/device limitations remain as documented by preceding plans.

## Next Plan Readiness

Plan 04 can use the named outline policy API above. Keep quality UI ownership separate and invoke explicit effect teardown for auxiliary renderers. Final plan 06 should update AGENTS.md with the semantic appearance/disposer/render-seam architecture and retain the actual review limitations. Shared ART requirements remain pending until all declaring plans and final human review finish.

## Self-Check: PASSED

Created source/test files and this summary exist; all four task commits resolve. Focused unit/browser evidence and visual captures are present. Root-owned config/lock are excluded from metadata staging.
