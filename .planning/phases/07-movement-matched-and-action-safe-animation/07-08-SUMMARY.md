---
phase: 07-movement-matched-and-action-safe-animation
plan: "08"
subsystem: animation
tags: [developer-review, native-controls, isolated-clock, recovery, accessibility]
requires:
  - phase: 07-05
    provides: Shared sampled presentation and simulation-owned action phases
  - phase: 07-06
    provides: Phase-driven weapon parts and bounded hand correction
  - phase: 07-07
    provides: Accepted-skin first-person arms/body and owned gun view
provides:
  - DEV-only offline Training Range review with one isolated actor/view owner
  - Sixteen bounded scenarios, four weapon labels and three native view choices
  - Generation-safe loading, recovery, playback, scrub and retirement
  - All twenty-eight UI predicates covered by actual native browser cases
affects: [07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Independent inspection clock, Stale-generation disposal, Session AbortController listeners, Exception-safe live visibility suppression]
key-files:
  created: [src/dev/animationReview.js, src/dev/animationReview.test.js, tests/animation-review.spec.js]
  modified: [src/builders/enemyGLTF.js, src/builders/firstPersonRig.js, src/builders/weaponHandling.js, src/input.js, src/loop.js, src/main.js, index.html, style.css]
key-decisions:
  - "Review samples a template-only actor and owned view; the live offline simulation, mixer and action markers remain frozen until Close."
  - "Supersprint, slide, dive, prone and sprint reload remain labeled previews owned by Phase 5; inspection changes no outcomes or authoritative timing."
  - "P90 fallback stays visible but detailed handling comparisons remain disabled and are not credited as contact passes."
requirements-completed: [ANIM-02, ANIM-03, ANIM-04, ANIM-05]
coverage:
  - id: D1
    description: Explicit DEV F3 offline-range opener and isolated real actor playback with frozen live simulation and restored context
    requirement: ANIM-02
    verification:
      - {kind: e2e, ref: "tests/animation-review.spec.js#tracer:", status: pass}
      - {kind: unit, ref: src/dev/animationReview.test.js, status: pass}
    human_judgment: false
  - id: D2
    description: Sixteen truthful scenarios, three views, four weapon labels and all twenty-eight native UI predicates
    requirement: ANIM-03
    verification:
      - {kind: e2e, ref: "tests/animation-review.spec.js#UI-01 through UI-28", status: pass}
      - {kind: e2e, ref: ".planning/research/.cache/07-08-qualified/observations.json", status: pass}
    human_judgment: false
  - id: D3
    description: Async replacement, renderer recovery, repeated cleanup, production absence and preview-only future ownership
    requirement: ANIM-05
    verification:
      - {kind: unit, ref: src/dev/animationReview.test.js, status: pass}
      - {kind: e2e, ref: "tests/animation-review.spec.js#production: and recovery fixtures", status: pass}
    human_judgment: false
  - id: D4
    description: Natural moving grip, posture, camera comfort and final animation aesthetics
    verification: []
    human_judgment: true
    rationale: Passing native predicates, real rendered pixels and palm residuals cannot record human motion acceptance; the phase review remains pending.
actuals:
  tokens: 14708
  tasks: 2
  commits: 4
plan_head_before: 397959a3ce510248247c1c2ed802febcae9245c0
plan_head_after: 511e989a0ff482199037693a107a0630b18c99f4
duration: approximately 225min wall span including usage-limit interruption
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 8: Isolated Native Animation Review Summary

**An explicit development-only Training Range panel plays and scrubs sixteen bounded real-rig scenarios through one isolated actor/view pair, with native recovery, truthful Phase 5 previews and frozen live gameplay.**

## Performance

- First RED committed at 11:18:37UTC; final Task 2 GREEN committed at approximately 15:02UTC on 2026-10-06. The approximately 225-minute wall span includes the account usage-limit interruption; it is not uninterrupted implementation effort. This continuation started approximately 14:50UTC.
- Two tasks changed eleven source/UI/test files. Actuals are ceiling(58,832 realized Git diff characters / 4), measured across the persisted plan ledger base through the final code commit. Four TDD task commits precede the separate metadata commits.
- Sequential main-checkout execution used the coordinator-owned temporary default-branch override, process-local Git trust and the supplied literal root guard. The coordinator's `.planning/config.json` modification was never staged. No worktree, new branch, package, asset export or dependency was created.

## Accomplishments

- `initAnimationReview()` mounts an explicit **Open animation review** button in the existing F3 diagnostic host and a named nonmodal native region. The module is imported only under `import.meta.env.DEV`; a real production same-origin online game has no active opener or review region. Eligibility rejects online membership and death/killcam with the approved reason. Menu/mode retirement closes the owner first.
- `createAnimationReviewOwner()` owns one bounded selection, independent once-play 1x clock, generation and actor/view pair. No autoplay occurs. Pause/Resume holds preview time; the native step-1 0–100 phase range only scrubs while stopped; Reset returns to ready phase zero. Selection, Retry and Close invalidate prior loads before replacement. Stale resources dispose silently without installing actors, taking focus or announcing old state. Renderer failure produces one recoverable state announcement. Close/teardown are idempotent.
- `createReviewCharacter()` clones the loaded accepted template directly, builds one source mixer and prepares the approved actions without an enemy pool, spawn, random outcome or live weapon builder. The view copies sampled source bones into its existing full 65-joint selected hierarchies and owns zero additional mixers. Gun clones restore source handling rest before capturing their own rest. The bounded metadata clone helper restores original userData in finally, including runtime circular metadata. Character resources retain template geometry, clip buffers and packed maps.
- The review attaches both arms and body to the real scene. A temporary camera renders Third person, First person or Looking down. It temporarily hides the frozen live player mesh/view/procedural fallback/guns and restores every visibility value in finally, preventing duplicated anatomy or shadows. Existing first-person render ownership restores its selected nodes in finally. The main loop returns before all offline simulation, presentation and effect ticks while review is open; it does not advance the live mixer or action markers.
- A connected actual-game marker fixture starts a real pending throw lifecycle, plays/scrubs/reset previews, and verifies unchanged source mixer time, source root, action snapshot, inventory, health and simulation eye with zero marker calls. After Close the same marker executes once, proving the fixture was connected to the live clock rather than an unused spy. Review exits without pointer capture; the existing explicit Resume gesture remains the way to capture again. Native keyboard/pointer/wheel/touch events are stopped before gameplay handlers. A generation-owned late pointer-lock release guard retires on Close.
- Four fixed labels are M4A1/P90/AWP/M9; the three view labels are First person/Looking down/Third person. Exactly sixteen scenario options remain: Ready, Directional locomotion, Normal sprint, Crouch, Jump and landing, ADS and fire, Reload, Reload to melee, Reload to grenade, Damage, Directional death, Preview — supersprint, Preview — slide, Preview — dive, Preview — prone and Preview — sprint reload rules. Missing candidates have disabled choices and a visible reason. Required pose/handling remains present under reduced motion and every tier.
- Future options and persistent status retain **Preview —** and Phase 5 ownership. Normal sprint reload comparison is exactly the current weapon base duration multiplied by 1.15; a later synthetic interruption retires the visual reload into source one-handed supersprint. Support-hand release requires both `pose.previewOnly === true` and `pose.oneHandedCarry === true`; ordinary sprint remains two-handed. These sequences grant no movement, stamina, ammunition, projectile, collider, input mapping or network action. Accepted online M4 timing remains unchanged.
- Existing quality controls remain the only quality owner. The review adopts their current tier without another select. Added reduced-motion cosmetic sway/damage flinch is disabled while physical handling and posture remain inspectable. P90 is truthfully a procedural partial fallback: its geometry stays visible, detailed comparisons are disabled with the approved copy, and no detailed P90 contact pass is claimed.
- Approved loading/empty/error/Retry/partial/missing/death fallback/reduced-motion/exit copy is wired through text content. Native labels, described help/recovery, state-only polite status, visible focus, document order and 44px controls survive narrow widths and long HTML-shaped identity fixtures. The 360px bounded panel has 16px inset/padding, 8px button gaps, wrapping text and vertical scroll; below 768px it becomes a bottom panel with maximum 50vh height.

## Task Commits

1. **07-08-01 isolated M4 tracer:** `d90146d` RED; `aaea52d` GREEN.
2. **07-08-02 scenario/recovery/accessibility expansion:** `92d6551` RED; `511e989` GREEN.

Both persisted RED records return `RED_EVIDENCE_OK`: `.planning/research/.cache/07-08-tracer-red.json` fails on the absent native opener, and `07-08-expansion-red.json` fails on the missing sixteen-scenario contract. Prior completed Task 1 was preserved during continuation. The current full suite includes the tracer again; no refactor-only commit was necessary.

## Checks Run

| Command | Final result |
|---|---|
| `npm run test:unit -- src/dev/animationReview.test.js src/builders/weaponHandling.test.js` | 15 tests in 2 files passed; final run 880ms |
| `npm run test:e2e -- --config .planning/research/.cache/07-05-playwright.config.mjs tests/animation-review.spec.js --workers=1` | All 10 native/actual-game/production cases passed in 2.7min after the final arm attachment and visibility fix |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed after final source changes |
| `npm run typecheck:mp` | Passed after final source changes |
| `npm run build` | Passed in 351ms; pre-existing large-chunk warning remains |
| Both `check tdd-red-evidence` records | `RED_EVIDENCE_OK` |
| `requirements.ready-ids` for this plan and four shared IDs | 0/4 ready; remaining siblings and phase/human review keep requirements pending |

The browser runner used owned free root-base listeners and left the existing 5173 review game untouched. Its production fixture owned and stopped its temporary build/server. Browser suites and exports were not run concurrently. This plan did not rerun or widen the canonical baseline/repertoire export or claim the later resource/hardware qualification.

## UI Row/Test Mapping

| UI predicates | Current actual browser case |
|---|---|
| UI-01,06,13,24 | Empty selection retains controls/Close/quality ownership and disables Play |
| UI-02,07,14,21,25 | Loading disables playback/scrub; Close retires a late resource without focus theft |
| UI-03,08,15,22,26 | Error uses approved recovery copy; Retry installs one current actor |
| UI-04,10,27 | Partial fallback has visible copy and disabled detailed handling; real P90 pixels are separately retained |
| UI-05,18,20,23,28 | HTML-shaped long identities remain text, wrap at 360px and retain focus/Close/Escape |
| UI-09,16 | Sixteen actual scenarios, three views and one actor/view; four weapons across Low/Medium/High |
| UI-11,17,19 | Native document order, 44px controls, bounded scroll and keyboard outcome isolation |
| UI-12 | Zero/one/many compatibility uses one fixed select and visible disabled reasons |

## Retained Actual-Game Evidence

`.planning/research/.cache/07-08-qualified/` contains 36 full 800x600 actual-game PNGs, one per four weapons × three tiers × three views, with the panel/opener hidden during capture. `observations.json` records each corresponding selection, attached arm hierarchy, owned view/world contact observations and source/export identity. All 36 final observations report attached arms. M4/AWP/M9 ready contacts use the actual world support residual and, in first/down views, both owned view hand residuals below 0.025m. The world mount's right residual is intentionally null outside independent bolt/fixed-anchor solves; it is not invented evidence. Partial P90 samples are visual fallback evidence only.

- Source motion hash: `5a9e8c4c160cd4d7bb072f724e28dbb52b902f05d75d68a37c68d98449470903`.
- Browser-observed export SHA-256, independently matched to the current file: `8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936`.
- Headless Windows Chromium/SwiftShader, 800x600/DPR1. These are implementation pixels, not representative-device/FPS certification, the matched multi-actor budget instrument, or human moving aesthetic approval.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Attach preview arms and restore live visual ownership.**
- Found during Task 2 pixel inspection after a passing contact matrix: the cloned review arms were sampled and measured but absent from the scene, so no hands rendered.
- Fixed by attaching `view.arms` and adding finally-restored suppression of frozen player visual nodes during preview render. The actual matrix now asserts attachment and retains visible hand pixels.
- Files: `src/dev/animationReview.js`, `src/main.js`, `tests/animation-review.spec.js`; committed in `511e989`.
- Broken-windows deviation 39 is recorded and fixed. No unresolved stub, skipped test or unrun plan verification was introduced.

## Issues Encountered

- The first expanded pixel fixture asserted a numeric right-hand residual on the third-person hand-attached mount; that observation is intentionally null. The fixture now qualifies actual world support and independent first-person hand residuals. Its initial failure was not credited as behavior RED or a contact pass.
- The account quota interrupted the preceding executor. Its three existing TDD commits and uncommitted Task 2 implementation were retained; this continuation completed the actual final gates and GREEN commit.
- No authentication gate occurred. Existing inherited rig/motion/weapon redistribution limits and human motion acceptance remain outside this developer inspection surface.

## Next Phase Readiness

Plan 07-09 can consume the isolated owner, current observation schema and retained pixels for the matched multiple-actor/two-client/resource matrix. Plan 07-10 owns reproducibility/final phase gates. Shared ANIM requirements remain pending until sibling plans and phase verification complete; human motion acceptance is separate. Phase 5 owns actual future sprint/slide/dive/prone and reload timing/cancellation mechanics.

## Self-Check: PASSED

All eleven changed source/UI/test paths and the four task commits exist. The final native suite and final focused/static gates passed; all 36 retained observations report an attached arm hierarchy, and their browser export identity matches the current GLB file. No tracked file deletion or unintended untracked generated file was left by the task commit.
