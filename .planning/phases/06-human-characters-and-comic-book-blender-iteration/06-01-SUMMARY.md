---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "01"
subsystem: art-tooling
tags: [blender, gltf, human, provenance, reproducibility]
requires:
  - phase: 01-two-client-authoritative-tdm
    provides: compatible game rig, animation preparation, weapons and actor ownership
provides:
  - Anatomical fitted human with editable Blender source, open helmet and starter chest/back armor
  - Official checksummed portable Blender and CC0 source acquisition with bounded paths
  - Exact inherited skeleton, inverse binds and all 48 sampled animation entries
  - Asset-specific source/license ledger and semantic repeat-export checks
affects: [06-02, 06-03, 06-05, 06-06]
tech-stack:
  added: [Blender 4.5.13 LTS portable cache]
  patterns: [candidate-before-publication, exact compatibility merge, PNG pixel comparison]
key-files:
  created:
    - tools/art/pipeline.mjs
    - tools/art/build_soldier.py
    - tools/art/sources/soldier.blend
    - tools/art/sources/base.obj
    - tools/art/sources/LICENSE.md
    - tools/art/sources/LICENSE.ASSETS.md
    - tools/art/provenance.json
    - tools/art/inspect-character.mjs
    - tools/art/verify-export.mjs
    - tools/art/character-params.json
    - tools/art/.gitattributes
    - tests/character-art.spec.js
  modified: [public/models/enemy.glb, .gitignore]
key-decisions:
  - "Fit CC0 body topology to the existing skeleton and preserve baseline skin/motion domains exactly through a render-data merge."
  - "Keep source-specific CC0 evidence separate from unresolved inherited rig, mannequin motion, raw Mixamo redistribution and weapon evidence."
  - "Publish only after source reopening, invariant checks and candidate-routed real-game browser tracers."
requirements-completed: [ART-01, ART-03, ART-04]
requirements-note: "Technical contributions to shared Phase 6 requirements; REQUIREMENTS.md remains pending until remaining plans and human aesthetic review."
coverage:
  - id: human-source
    description: "Actual anatomical geometry, editable source and preserved gameplay compatibility"
    requirement: ART-01
    verification:
      - kind: automated_ui
        ref: "tests/character-art.spec.js#art tracer"
        status: pass
      - kind: integration
        ref: "node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb"
        status: pass
    human_judgment: true
    rationale: "Agent reviewed and corrected face/hand captures; end-of-phase human aesthetic acceptance remains pending."
  - id: portable-authoring
    description: "Verified portable Blender invocation and retained source/provenance"
    requirement: ART-04
    verification:
      - kind: integration
        ref: "node tools/art/pipeline.mjs build --probe; node tools/art/pipeline.mjs probe --provenance"
        status: pass
    human_judgment: false
  - id: repeat-export
    description: "Two isolated reopen/export operations with independent semantic domains"
    requirement: ART-03
    verification:
      - kind: integration
        ref: "node tools/art/verify-export.mjs --repeat"
        status: pass
      - kind: unit
        ref: "node tools/art/inspect-character.mjs --self-test"
        status: pass
    human_judgment: false
actuals:
  tokens: 476307
  tasks: 3
  commits: 5
commits: 5
plan_head_before: 8bef7d22a51533cecb1826bb5bd1fe62bb902a95
plan_head_after: 4ec5db50490987e214075db7fe3012dca93ece5c
duration: 42min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 1: Anatomical Human Authoring Pipeline Summary

**A real CC0 anatomical body is fitted to the unchanged game rig, saved as editable Blender source, and exported through a bounded, reproducible pipeline.**

## Accomplishments

- Ran official portable Blender 4.5.13 LTS, build `daeeeca98fb0`, after checking the exact 398,648,740-byte archive against the pinned SHA256. No installation, packages, service or executable was committed.
- Replaced mannequin render topology with 13,380 anatomical source vertices, skinning all ten digits. Authored deliberate eye/iris geometry, fitted starter chest/back plates and an open helmet. The final export has **16,212 vertices, 28,632 triangles, 65 joints and 48 animation entries**.
- Imported armature/actions remain editable in `tools/art/sources/soldier.blend`. The export merge retains baseline hierarchy, local rest transforms, inverse binds, action times and transforms exactly. Weapon basis and gameplay code are unchanged.
- Browser candidates load through the existing prefix-aware game loader before publication. Training Range third person uses the human player and current M4 attached to `hand_r`.
- Retained unmodified MakeHuman base/header/licenses at the pinned upstream commit. `.gitattributes` prevents Windows checkout newline conversion from breaking exact-byte provenance pins.
- Named budgets, PNG pixel validation, NFC semantic names, duplicate clip occurrence identity and independent mesh/skin/material/image/motion comparison now have executable self-tests.

## Task Commits

1. Task 1 RED — `e0570d8`: prove old mannequin lacks anatomical replacement.
2. Task 1 GREEN — `bcb4923`: fit anatomical soldier to preserved game rig.
3. Task 2 — `85a6d44`: retain licensed inputs and mixed asset provenance.
4. Task 3 RED — `8378b53`: require missing gameplay motion rejection.
5. Task 3 GREEN — `4ec5db5`: verify bounded reproducible human exports.

The measured 476,307 actual tokens use **1,905,228 realized diff characters / 4**, rounded up; most characters are the retained raw OBJ topology. Binary changes appear as Git binary-diff markers, not invented harness tokens. Five production/task commits are measured from the persisted ledger, before metadata commits.

## Verification

- `node tools/art/pipeline.mjs self-test` — passed: malformed/unsafe/link/oversized archives, path escape, invalid operation and retained-source checks.
- `node tools/art/pipeline.mjs build --probe` — passed: actual version/RNA probe, authored source save, source reopen, export invariants and all three candidate-routed browser tracers before publication.
- `node tools/art/pipeline.mjs probe --provenance` — passed: consumed source hashes, terms and unresolved inherited dispositions.
- `node tools/art/inspect-character.mjs --self-test` — **8/8 passed**: empty/truncated/oversized inputs, invalid bounds/joints/nonfinite values/weights, zero/one/many primitives/materials, hierarchy/material errors, required clips, NFC versus byte identity, domain changes and bounded PNG pixels/checksums.
- `node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb` — passed exact rig/inverse-bind/48-animation checks.
- `node tools/art/verify-export.mjs --repeat` — passed two separate Blender processes reopening the retained source. All five semantic domains match; observed byte hashes also match: `da5725994f3c90284d3fbe5e392785238adfa0330c3f05c8d22ce66ce571e004`.
- Character art browser tracer — **3/3 passed**: anatomical face/all ten weighted digits/aliases; actual-loader armed/face/hand captures; Training Range third-person human/M4.
- Existing real-rig weapon orientation and asset alias tests — **2/2 passed**. Full lint/types/unit/offline/multiplayer gates remain scheduled for final Plan 06-06, per the orchestrator's requested cadence.
- `git diff --check` — passed. No tracked deletions or implementation stubs.

## Visual Review and Corrections

The agent inspected full-resolution **1280×960** captures. Early iterations exposed an oversized head, unstable jaw/neck deformation, jagged/inward helmet surfaces and a shell behind the skull. Corrections use the source neck landmark, rigid face/head skinning with a smooth neck blend, shoulder exclusion, an original continuous helmet shell with outward winding and a measured forward offset. Source helpers are removed after landmark extraction. Both hands have distinct digit geometry around the existing rifle contact; no animation or mount correction was introduced.

Evidence is retained in ignored `.planning/research/.cache/06-art/`:

- `tracer-armed.png`, `tracer-face.png`, `tracer-hands.png` — close-up render captures using the actual game-loaded actor/weapon builders.
- `tracer-game.png` — actual Training Range game renderer/HUD in third person.
- `baseline.glb`, `acquisition.json`, `probe.json`, `rig.json` — retained compatibility/acquisition/probe evidence.
- `repeat-report.json` — source/parameter/script/runtime identities, checks and repeat comparison.
- `red-task1.json`, `red-task3.json` — intentional failing assertions, both accepted by `check tdd-red-evidence` as `RED_EVIDENCE_OK`.

Agent visual review is recorded; **human aesthetic acceptance is not**. Expanded armor, collar/boot detail, painted maps and ink are the next plan's intentional authoring work.

## Decisions and Deviations

1. **[Rule 2 — Missing critical reproducibility] Exact compatibility merge.** Blender exports authored render domains; the pipeline merges them into the retained original skeleton/skin/action domains after joint-index mapping. This protects current rest spaces, numbered action entries and motion from importer/exporter resampling. The compatibility inspector was introduced during Task 1 to gate publication, then expanded under Task 3.
2. **[Rule 2 — Exact-byte Windows source retention] Added `tools/art/.gitattributes`.** The repository's automatic newline conversion would otherwise change pinned source/license/script hashes on a new Windows checkout. Art source bytes now remain exact.
3. **Research correction:** actual baseline inspection reports **48 unique serialized clip names**, including twelve numbered Mixamo-family names, rather than literal duplicate names. Every existing entry remains exact; true duplicate-name occurrence identity is also covered by synthetic comparator tests.
4. User-delegated implementation proceeds to end-of-phase review; no early aesthetic approval gate was inserted. The tracer was verified and corrected by the agent before expansion.

## Risks and Next Plan Readiness

- CC0 evidence applies to the pinned anatomical base only. Inherited compatible rig/mannequin motion original terms, raw Mixamo redistribution and loaded weapon origins remain explicitly **unresolved**. The combined `.blend`/GLB is mixed provenance; there is no whole-asset CC0 claim.
- Compatible raw baseline is recoverable from Git revision `8bef7d22a51533cecb1826bb5bd1fe62bb902a95`; a fresh build requires that history or the retained checksum-matching cache. Raw FBX redistribution was not expanded.
- Headless Chromium SwiftShader captures establish local rendering evidence, not phone/iGPU/Pi qualification or a 60 FPS device pass.
- Temporary `.planning/config.json` settings `workflow.use_worktrees:false` and `git.allow_default_branch_commits:true` belong to the orchestrator's authorized sequential main-branch run. **They were not committed; the root orchestrator must restore the prior absence of these keys after Phase 6.**
- All script operations remain bounded to owned source/cache/export paths. No new server/network/auth/gameplay surface was introduced; download/file/render trust boundaries are covered by the plan threat register.

## TDD Gate Compliance

Both task RED assertions failed for the intended behavior before their corresponding GREEN commits. The Task 1 Playwright assertion result was adapted losslessly to the gate's supported TAP summary; Task 3 used actual Node TAP output. Both stored records received `RED_EVIDENCE_OK`. No missing RED/GREEN gate or skipped test remains.

## Self-Check: PASSED

All required source/tool/test/runtime export files exist. All five recorded task commits resolve as commits. Required task verifications passed; source/provenance hashes and retained baseline invariants were checked after final authoring changes.
