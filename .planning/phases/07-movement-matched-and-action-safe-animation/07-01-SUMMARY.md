---
phase: 07-movement-matched-and-action-safe-animation
plan: "01"
subsystem: testing
tags: [animation, playwright, threejs, swiftshader, resource-ownership]
requires:
  - phase: 06-human-characters-and-comic-book-blender-iteration
    provides: Accepted soldier, packed paint and owned actual-game review infrastructure
provides:
  - Two independently loaded moving baseline runs covering all six tier/actor profiles
  - Immutable numeric pre-tuning timing and deterministic resource envelopes
  - Failure/cancellation cleanup and stale/incomplete evidence rejection
affects: [07-02, 07-04, 07-09, 07-10, ANIM-03, ANIM-05]
tech-stack:
  added: []
  patterns: [Owned loopback capture, separated media/timing playback, atomic evidence publication]
key-files:
  created:
    - tests/animation-baseline.spec.js
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-baseline.json
    - .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-budget.json
  modified: [tools/art/review.mjs, docs/ANIMATION-REVIEW.md]
key-decisions:
  - "Keep controlled moving Range playback and software-renderer cost evidence separate from gameplay FPS and human motion acceptance."
  - "Lock per-profile upper bounds at the larger observed repeat statistic plus its measured absolute repeat dispersion; require optimization or a justified separate remeasurement for overruns."
  - "Use separate media attempts and atomic reports; retire owned callbacks/listeners/bindings/props while preserving shared templates and an unrelated listener."
requirements-completed: [ANIM-03, ANIM-05]
coverage:
  - id: D1
    description: Two moving actual-asset repetitions at Low/Medium/High with one and eight cloned actors
    requirement: ANIM-03
    verification:
      - kind: integration
        ref: node tools/art/review.mjs --animation-baseline
        status: pass
      - kind: e2e
        ref: tests/animation-baseline.spec.js#baseline CLI records actual moving assets with renderer and cleanup evidence
        status: pass
    human_judgment: false
  - id: D2
    description: Atomic failure/cancellation cleanup and numeric budget validation
    requirement: ANIM-05
    verification:
      - kind: e2e
        ref: tests/animation-baseline.spec.js#failed capture restores borrowed state and releases only its own listener
        status: pass
      - kind: e2e
        ref: tests/animation-baseline.spec.js#canceled capture cannot publish fresh evidence
        status: pass
      - kind: e2e
        ref: tests/animation-baseline.spec.js#budget rejects stale, incomplete, nonfinite and truncated moving evidence
        status: pass
      - kind: integration
        ref: node tools/art/review.mjs --animation-budget
        status: pass
    human_judgment: false
actuals:
  tokens: 47423
  tasks: 2
  commits: 3
plan_head_before: aed271f8e4ce08e70e05b2bd334a367a892071b7
plan_head_after: d80cdcf8dbc970e6626d3454f67a1ac884993ba2
duration: 34min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 1: Moving Baseline and Measured Budget Summary

**Two real-asset moving Range repetitions establish six immutable timing/resource envelopes before animation tuning.**

## Performance

- Started: 2026-10-05T19:43:22Z; completed: 2026-10-05T20:16:41Z.
- Two tasks and five deliverable files; 47,423 tokens measured as ceiling of 189,689 realized diff characters / 4.
- Full two-run matrix: **991.331s (16.52min)**; each sample bounded at 180s. Twelve profiles ×214 timed frames =2,568 measured frames, plus a separate214-frame full-pixel motion sequence.
- Final actual-browser tracer: **3 passed**, about90s reported by Playwright; owned CLI smoke report duration **82.630s**. Budget negative gate: **1 passed in1.2s**. Budget CLI first publication: **0.767s**, with subsequent immutable verification passing.

## Accomplishments

- Ordinary enabled Training Range loading decodes shipped HumanBody/packed maps before current ready, directional, run, crouch, jump/landing and reload playback. Existing animation helpers, normal scene lighting and selective ink are used; gameplay roots stay fixed.
- Two separately loaded browser contexts measure all Low/Medium/High ×1/8 actual actor profiles. Twelve warmup frames and eight deterministic replacement loops precede each sample; live keepers, shared maps/geometry and subsequent clones survive retirement.
- Camera/quaternion/FOV/borrowed visibility restore in finally. Actual owned listeners, scheduled frame callbacks, scene props/actors and active mixer bindings return to zero. Failure closes the owned browser/server without terminating an unrelated listener; cancellation cannot publish fresh evidence.
- Baseline reports publish atomically after the complete matrix and source/cleanup validation. Future attempts keep media separate. Budget verification checks exact source/export/sampler identities, media hashes, complete repetitions, finite timings and matched resource plateaus, then refuses changed existing decisions.

## Measurement Decision

Named setup: DESKTOP-NUH2KOI, Windows10.0.19045 x64, AMD Ryzen5 5600, Node24.19.0, Chromium147.0.7727.15, ANGLE Vulkan SwiftShader. Every profile is1280×960/DPR1. Frame intervals include native browser/compositor pacing; render-call/GPU-finish time is separately recorded. Short component measurements are browser-timer-limited. PNG encoding occurs in a separate playback.

| Tier | Actors | Median upper ms | p95 upper ms | Warm geometry/texture/program plateau |
| --- | --- | --- | --- | --- |
| Low | 1 | 185.900 | 198.100 | 75/59/10 |
| Low | 8 | 425.500 | 435.400 | 110/416/10 |
| Medium | 1 | 191.800 | 200.300 | 143/60/16 |
| Medium | 8 | 487.000 | 518.200 | 178/417/16 |
| High | 1 | 193.800 | 207.100 | 143/60/16 |
| High | 8 | 488.200 | 516.900 | 178/417/16 |

The JSON preserves raw statistics and component-specific dispersion/bounds. Exact plateau counts apply to the seeded deterministic Range clone loop; randomized map rubble is excluded from exact whole-map geometry comparisons. Existing clip/weight selection is called correctionMs; this baseline measures no new contact IK.

- Baseline SHA256: `177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20`.
- Budget SHA256: `66722a272115cdc1145cf1af97a1cb583389d7ea5adb75a4534445c15a14e1ff`.
- GLB SHA256: `3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`.
- Provenance SHA256: `60b7f4ee3ef29253253cfbc102f57f998442a1c5f8e7fc99fcfd19bb4e3968b7`.
- Sampler SHA256: `a5b7c998315b49aa2c81070820edb06591636dd90cf268a6eddc48258addb5b9`.
- Capture revision: `af174d0`;117 source/export/sampler identities are retained in the baseline. Code metadata commits follow capture without gameplay/art tuning.

No phone/iGPU/gaming-GPU/Pi/60FPS qualification or human natural-motion acceptance is inferred. Agent inspection of a full-pixel frame confirms the rendered current human, without aesthetic approval. Phase6 human art acceptance remains canonical; Phase7 contact, motion, camera comfort and new hands/reloads still require their own implementation and human moving review.

## Task Commits

1. Task07-01-01 RED: `af174d0` — named Playwright/JUnit assertion failed because the baseline CLI was unavailable; SDK returned RED_EVIDENCE_OK. Record retained in ignored `.planning/research/.cache/07-01-red.json`.
2. Task07-01-01 GREEN: `993a2b5` — actual moving baseline, owned fixture, failure/cancellation checks and complete evidence.
3. Task07-01-02: `d80cdcf` — immutable baseline-derived numeric budget, negative validation fixtures and comparison documentation.

Refactor was unnecessary. Actual commit count3 is measured from the persisted per-plan ledger through plan_head_after; metadata commits are separate.

## Deviations from Plan

- **Rule3 — blocking fixture issue:** readiness polling must use timers while this owned offline RAF is held. Corrected the baseline readiness wait; final real loading succeeds.
- **Rule2 — evidence correctness:** media encoding was separated from timed playback, and per-attempt directories preserve earlier media on failure. Direct listener/binding/prop retirement counters replace assumed cleanup values.
- **Rule2 — validation coverage:** budget rejection cases extend the baseline browser fixture during Task2 to cover the plan's stale/incomplete/nonfinite threat register.
- **Coordinator-directed bounded feedback:** after the two complete full repetitions, reran the real one-actor/cancellation/failure tracer, then verified the entire retained matrix and media through the budget gate. No additional full matrix capture was made, per explicit coordinator instruction.

## Issues Encountered

An intentional cancellation before browser launch may log Vite's dependency-scan closure warning; cleanup and canceled-publication assertions pass. No authentication gate, package installation, unexpected tracked deletion, stub, skipped test or unresolved unrun task gate remains.

## Next Plan Readiness

Plans02/04 can consume the locked budget and accepted source/export identities. Candidate changes must compare against this historical baseline, preserve its media and justify any separate remeasurement. Shared ANIM-03/ANIM-05 requirements remain phase-wide pending until sibling plans finish; frontmatter lists this plan's declared IDs rather than claiming their whole-phase acceptance. Human motion acceptance remains pending for the later review gate.

## Self-Check: PASSED

All five deliverable files and this summary exist; all three task commits are present. Baseline/budget source, raw media and renderer identities validate; the measured ledger span contains three commits. No generated untracked file remains outside the ignored owned cache.
