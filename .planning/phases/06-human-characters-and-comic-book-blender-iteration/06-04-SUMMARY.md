---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "04"
subsystem: graphics-settings
tags: [three-r160, native-controls, persistence, dpr, playable-fallback]
requires:
  - phase: 06-03
    provides: protected painted domains and renderer-owned selective silhouette policy
provides:
  - Persisted synchronized Low/Medium/High settings in menu and pause
  - Shared initial/resize DPR caps with original shadow-policy restoration
  - Readable asset loading/recovery and compact keyboard/touch control surfaces
affects: [06-05, 06-06]
tech-stack:
  added: []
  patterns: [DOM-free injectable graphics policy, named synchronized UI owner, native-input isolation]
key-files:
  created: [src/graphicsQuality.js, src/graphicsQuality.test.js]
  modified: [src/main.js, src/scene.js, index.html, style.css, tests/character-art.spec.js]
key-decisions:
  - "One validated local preference owns DPR, shadows and the existing global silhouette tier; renderer resize uses the same policy."
  - "Protect native settings input before document gameplay capture, and preserve native touch scrolling on menu/pause surfaces."
  - "Keep existing lighting/exposure and shadow dimensions: matched real-rig captures retain painted soft planes at all tiers."
requirements-completed: [ART-01, ART-02]
requirements-note: Technical contributions only; shared phase requirements and subjective human acceptance remain pending.
coverage:
  - id: D1
    description: Synchronized bounded graphics policy persists valid preferences and applies on resize/current and future rigs
    requirement: ART-01
    verification:
      - {kind: unit, ref: "src/graphicsQuality.test.js", status: pass}
      - {kind: e2e, ref: "tests/character-art.spec.js#art quality: and art quality resize:", status: pass}
    human_judgment: false
  - id: D2
    description: Loading and malformed/missing media keep playable fallback; compact and online pause controls remain reachable
    requirement: ART-02
    verification:
      - {kind: e2e, ref: "tests/character-art.spec.js#art fallback: and art compact:", status: pass}
    human_judgment: false
  - id: D3
    description: Human aesthetic acceptance of the complete illustrated slice and representative-device performance review
    verification: []
    human_judgment: true
    rationale: Agent captures and software-rendered tests do not establish subjective acceptance or phone/iGPU qualification.
actuals:
  tokens: 8625
  tasks: 3
  commits: 5
plan_head_before: 037a9b14ff47bbf3b7300bba20c77e58fa98ea51
plan_head_after: 54dbec25f4c2c778cff33ca662ef0318d8f5e838
duration: approximately 21min
completed: 2026-10-05
status: complete
---

# Phase 6 Plan 04: Live Graphics Quality and Playable Asset Recovery Summary

**One saved Low/Medium/High preference synchronizes menu and pause, immediately caps rendering cost, survives resize, and preserves playable fallback with accessible compact controls.**

## Performance

- Started: 2026-10-05T08:17:29Z
- Production tasks completed: 2026-10-05T08:37:49Z
- Tasks: 3; production/test files: 7.
- Actual tokens: scoped realized git diff characters / 4, rounded upward; no harness-token estimate.
- Five task commits measured from the persisted plan ledger before documentation commits.

## Accomplishments

- Native labeled selects share one named change handler, associated tier help and polite applied/save-error status. Medium is the default; only exact low/medium/high values are accepted under `vod_graphics_quality_v1`. Storage getter/read/write failures retain a bounded session choice.
- Low caps DPR at 1, disables shadows and draws no extra silhouettes; Medium caps at 1.5 with actor/weapon silhouettes; High caps at 2 with the existing selected structural silhouettes. Effective DPR remains the smaller of device ratio and cap. Initialization, resize and UI changes share `applyGraphicsQuality`.
- The injectable policy preserves the renderer's original shadow enablement and never changes its shadow type or light map dimensions. Painted maps/internal ink, existing soft lighting, exposure and torch timing remain intact. Existing contour ownership handles current and future actors without extra owners.
- Fixed loading/fallback text appears once after actual asset settlement. Missing/corrupt GLB keeps procedural play; missing/corrupt external paint imagery uses its independent existing fallback without falsely reporting character failure. Menu/pause scroll, wrap help and maintain 44px controls at 320x568 and 640x320. Pause stays above the range HUD and outside the bottom ammo band.
- Native settings mouse/key/touch interaction is isolated at the window UI owner before document capture. Menu/pause touch scrolling remains native. Settings do not acquire pointer lock, send combat intentions or restart gameplay; Resume retains its separate gesture and online unlock wording.

## Task Commits

1. **Live menu/pause preference:** `971a5cf` RED; `0961a3e` GREEN.
2. **Shared initial/resize policy:** `7564466` RED; `c4a4260` GREEN.
3. **Loading recovery and compact native surfaces:** `54dbec2`.

## Shipped Interfaces

- `getGraphicsQuality()` returns the validated session tier.
- `setGraphicsQuality(value)` validates/persists the preference and returns `{ quality, saved }`; false `saved` drives the documented readable error. It preserves the session choice when storage throws.
- `applyGraphicsQuality(renderer, deviceRatio)` applies DPR/shadows plus `setComicQuality` for current and future render eligibility. It returns the applied tier/ratio/shadow state. Renderer dimensions continue to belong to `scene.js`.
- `createGraphicsQuality({ storage, outline })` injects a storage accessor and contour callback for DOM-free tests. The production singleton uses the browser preference and existing contour owner; no framework or dependency was added.

## Verification

- Exact focused unit gate: **14 assertions/tests passed** in `src/graphicsQuality.test.js`, covering invalid values, exact caps, malformed DPR, shadow restoration, repeated application and storage getter/read/write failures.
- Exact browser groups: **12 distinct cases passed** in the final combined scoped run: three `art quality:`, two `art quality resize:`, four `art fallback:`, three `art compact:`. The tracer's three quality cases passed again before expansion.
- After the final touch-scroll guard, **all three compact cases passed again**, with actual `hasTouch:true` at 320x568, native scrolling/default-event checks, keyboard reachability and an isolated production online server. The production fixture owns and removes its OS-temp build/server; its browser observes membership and match generation without mutating authority.
- Resize checks use a browser context at DPR 3 and synthetic changes to 0.8/3/1.25, tier caps 1/1.5/2, actual drawing-buffer widths and viewport resize. Existing PCFSoft shadows and 2048x2048 sun map remain configured.
- Actual loaded rigs retain painted material/map identity. Eight tier/spawn/retirement cycles plateau at **56 geometries / 59 textures / 10 programs** on this run; assertions compare to the measured warmed baseline. Low has one base pass; Medium/High have at most one additional contour pass.
- Scoped ESLint passed with zero warnings; scoped diff whitespace checks passed. The isolated production online case built the client successfully. Full offline/multiplayer suites remain scheduled for plan 06-06.

## Visual Review and Limits

Matched real-rig tier captures and compact UI screenshots were inspected from ignored `.planning/research/.cache/06-art/`: `04-quality-low.png`, `04-quality-medium.png`, `04-quality-high.png`, `04-menu-320.png`, `04-menu-640.png`, `04-pause-320.png`, `04-pause-640.png`. Resource/settings evidence is in `04-quality-resources.json`.

Tier rig captures use 1280x960, DPR 1, the current ambient/sun/fill values and ACES exposure 1.05; queried renderer reports `WebKit WebGL`. These are headless Chromium tests with the configured SwiftShader launch flag, not physical device benchmarks. Painted face/armor planes remain visible without lighting tuning. High and Medium correctly match in the actor-only capture; structural selection is the preceding plan's actual Greek Columns coverage.

Initial compact screenshots exposed Training Range HUD ink over the relocated pause settings. Raising pause stacking above game overlays, while retaining higher connection-error ownership, corrected the overlap; refreshed screenshots and an explicit stacking assertion pass. The controls scroll in short landscape views; individual frames show the currently focused portion, with all actions separately checked as reachable.

The existing grip/collar/cloth limits recorded in plan 03 remain. This work does not certify every indoor/daylight view, motion shimmer, all actual touch hardware, 60 FPS, source provenance, or subjective human acceptance. Final combined visual/device review remains pending.

## TDD Gate Compliance

Both TDD tasks have committed assertion-based RED before GREEN. `04-quality-red.json` verifies the missing labeled control; `04-resize-red.json` verifies the old ratio remaining 1 instead of 0.8. The SDK returned `RED_EVIDENCE_OK` before production implementation. Resize evidence initially needed its full describe-qualified test name for the SDK matcher; the corrected evidence preserves the original JUnit failure. No refactor gate was necessary. Phase-wide runtime `tdd_mode` is false, while task-local TDD was followed.

## Deviations from Plan

None in delivery scope. Preventing document capture from swallowing native settings, preserving touch scrolling and correcting the newly exposed compact HUD overlap are correctness work required by the planned UI contract. No network/protocol/simulation, binary asset, package, later-phase or unrelated formatting change occurred. `lighting.js` did not need modification after matched current-light review.

## Issues Encountered

An initial Resume test assumed one capture request; the existing offline global mouse handler and explicit Resume can both request capture. The check now verifies that the explicit user gesture works while quality changes trigger no request. Compact software-WebGL cases use a bounded 60-second test timeout after full-resolution screenshots and focus operations exceeded 30 seconds; assertions were preserved. The blocked-storage browser deliberately causes a Vite HMR storage exception, and corrupt media deliberately logs loader warnings; neither strands the verified app controls.

No known placeholder deliverables, skipped tests, unrun task verification or new security surface beyond the plan's bounded storage/DOM boundaries remain. Root-owned temporary config and milestone lock stay unstaged.

## Next Plan Readiness

Plan 06-05 can continue the authorized Blender iteration. The existing renderer seam and quality singleton are ready for plan 06-06 full regression/visual review. Global ART-01/ART-02 checkboxes remain pending because these requirements span later plans and human acceptance.

## Self-Check: PASSED

All seven source/test files and this canonical summary exist. All five task commits resolve. The measured ledger range contains five commits; scoped verification and actual review artifacts exist. Root-owned config/lock are excluded from metadata staging.
