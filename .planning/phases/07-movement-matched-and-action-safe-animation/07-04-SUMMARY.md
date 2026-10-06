---
phase: 07-movement-matched-and-action-safe-animation
plan: "04"
subsystem: gameplay
tags: [action-lifecycle, simulation-time, grenade, melee, reload, retirement]
requires:
  - phase: 07-01
    provides: Retained animation baseline and budget
provides:
  - Generation-scoped offline action owner with read-only presentation snapshots
  - Immediate ADS/reload interruption and once-only grenade/melee simulation markers
  - Cancellation before death, menu, respawn, weapon, mode, editor and online replacement
affects: [07-05, 07-06, 07-08, 07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Simulation-owned markers, Generation retirement before field reset, Callback-free presentation]
key-files:
  created: [src/entities/actionLifecycle.js, src/entities/actionLifecycle.test.js, tests/action-lifecycle.spec.js]
  modified: [src/entities/player.js, src/entities/grenades.js, src/main.js, src/combat/shoot.js, src/modes/tdm.js, src/modes/buyMenu.js, src/editor/mapEditor.js]
key-decisions:
  - "Use one simulation clock and generation owner for exclusive offline throw/melee; presentation never executes gameplay markers."
  - "Retire before direct same-weapon, respawn and editor resets as well as main menu/mode replacements."
  - "Preserve online M4 authority and current timing; Phase 5 sprint/reload rules remain deferred."
requirements-completed: [ANIM-02, ANIM-03]
coverage:
  - id: D1
    description: Offline throw and melee immediately interrupt ADS/reload and release once on simulation time
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: npm run test:unit -- src/entities/actionLifecycle.test.js
        status: pass
      - kind: e2e
        ref: npm run test:e2e -- tests/action-lifecycle.spec.js --workers=1
        status: pass
    human_judgment: false
  - id: D2
    description: Retired action generations cannot damage or award reload ammo after replacement
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: src/entities/actionLifecycle.test.js#simulation action ownership
        status: pass
      - kind: e2e
        ref: tests/action-lifecycle.spec.js#retirement
        status: pass
    human_judgment: false
actuals:
  tokens: 8104
  tasks: 2
  commits: 4
plan_head_before: 22e8ca416383b9e88559cf98a56a8e9c604b0c3e
plan_head_after: 5f7657ca410d18568115fb6594bc46191426fcfc
duration: approximately 486min retained wall span including quota interruption; approximately 11min continuation
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 4: Simulation-Owned Offline Actions Summary

**Throw and melee cancel reload/ADS immediately, execute their supported markers once in simulation time, and retire before player replacement.**

## Performance

- Earliest retained RED evidence: 2026-10-05T20:43:28.632Z; continuation resumed after the quota interruption at approximately 2026-10-06T04:38Z and closed at approximately 04:49Z. The retained wall span includes the long interruption and does not measure active engineering effort.
- Two tasks, ten deliverable files. Actual tokens are ceiling(32,415 realized Git diff characters / 4), excluding coordinator-owned temporary configuration and closeout metadata. Four production/TDD commits are measured from the existing per-plan Git ledger.
- Fully resumed from the existing task 1 RED/GREEN commits and pending task 2 tests; no completed task or baseline was recreated.

## Accomplishments

- Pure `createActionLifecycle` owns generation, accepted exclusive action, finite simulation duration and once-only ordered markers. Retirement invalidates the generation before dropping callbacks. Frozen presentation exposes phase without executable markers; sampling cannot cause outcomes. Deterministic request selection prioritizes retirement, throw, melee, reload, fire and ADS; an existing exclusive action rejects subsequent requests without a queue.
- Accepted throw cancels reload timers/UI and ADS before pending awards, including 1/0/-1 ms reload boundaries. Its existing 0.9-second window releases at 0.405 seconds. Energy is spent only after accepted entry. ADS remains suppressed during the exclusive action and completion update.
- Keyboard melee uses the same owner, retains alternating supported punch clips, hits once at 0.35 seconds and completes at 0.7 seconds. Repeated keydown, throw, reload and fire requests cannot overlap or queue during the action. The previous unowned 350/700 ms callbacks are removed.
- Death, menu return, main mode changes, weapon switching, direct TDM start/respawn, buy reset/purchase, editor open/preview/playtest/exit, and online-button entry retire work before resetting fields. Snapshot observation and animation completion do not award ammo or release actions. The injected offline eligibility guard excludes online gameplay; no server/shared authority files changed.

## Task Commits

1. **Task 07-04-01 RED:** `6c68c72` — reproduce throw reload deadline and ADS interruption failures.
2. **Task 07-04-01 GREEN:** `1eec49e` — interrupt offline reload and ADS with simulation-owned throw.
3. **Task 07-04-02 RED:** `b3653a7` — reproduce melee deadline and stale action retirement failures.
4. **Task 07-04-02 GREEN:** `5f7657c` — own melee markers and retire action work before player replacement.

Plan closeout metadata is committed separately from these measured task commits.

## Checks Run and TDD Gate Compliance

- Task 1 retained RED record `.planning/research/.cache/07-04-throw-red.json` describes actual reload/ADS and ammo failures; its existing RED/GREEN history is preserved. The prior executor verified the throw tracer end to end twice (4/4, 24.7s and 24.2s), as reported in the continuation handoff. Current full runs cover all four throw cases again.
- Task 2 actual-browser RED: **4 intended assertion failures**. Before the fix, ADS/reload remained active, reload awarded ammo 3→30 at all three deadlines, no hit occurred at the simulation marker, and the old wall-clock callback produced `deadHits=1` after real death. `.planning/research/.cache/07-04-melee-red.json` passed `check tdd-red-evidence` with `RED_EVIDENCE_OK` before the RED commit and implementation.
- Additional pre-fix direct-reset probes failed on behavioral assertions for TDM respawn, same-weapon purchase and editor playtest: the action remained melee and invoked its marker after replacement. These establish the need for the small reset-hook extension.
- Final pure suite: **10/10 passed**, 217ms Vitest duration. It covers marker boundaries, overlap, all retirement reasons, stale generation rejection, same-batch retirement, deterministic selection and callback-free presentation.
- Actual-browser lifecycle suite: **20/20 passed**, Playwright reported **1.9m**, then **20/20 passed, 1.9m** after the fixture portability and idle-dead-generation refinements. Uses the shipped loaded character, normal gameplay modules, an owned free loopback Vite listener and measured simulation steps. Tests include real keyboard punch collision, actual death plus the former wall-clock wait, fire/reload/throw rejection, and eleven replacement routes.
- Lint, root typecheck, multiplayer strict typecheck, production build and `git diff --check` passed. Build retained the existing chunk-size warning. No package install occurred.
- Existing touch reload/grenade and gamepad grenade routes call the guarded common functions; no new device bindings were added. Online entry cancellation is tested at its real button; production multiplayer protocol/match behavior is left to the later online plan and phase gates.
- Both tasks have RED before GREEN. Refactor commits were unnecessary. No automated task verification was skipped.

## Files Created/Modified

- `actionLifecycle.js` and its unit tests: pure action policy and generation-safe simulation clock.
- `player.js` / `grenades.js`: interruption, ownership, reload award ordering, held ADS suppression and existing grenade projectile integration.
- `main.js` / `shoot.js`: melee adapter, common offline guards and main lifecycle retirement.
- `tdm.js`, `buyMenu.js`, `mapEditor.js`: cancellation immediately before direct field replacements.
- `tests/action-lifecycle.spec.js`: owned browser fixture and actual interruption/retirement regressions.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Cover direct replacements outside main.**
- Found during task 2 source inspection and behavioral RED probes. Main-only cancellation cannot cover TDM respawn, same-weapon purchase/buy-phase reset, or editor map/playtest replacement because those paths mutate player fields directly and may keep the same weapon/mode identity.
- Added only cancellation imports/calls to `src/modes/tdm.js`, `src/modes/buyMenu.js` and `src/editor/mapEditor.js`, before their existing resets. Eleven real replacement routes now pass. Committed in `5f7657c`; WINDOWS entry 32 is fixed.

**2. [Rule 1 - Fixture bug] Keep the owned browser fixture portable and use a live enemy slot.**
- The earlier fixture hardcoded the author's Windows checkout; it now derives its repository root from its test module. The death negative now calls the existing spawn-slot primitive before enabling the retired Range enemy, avoiding animation of disposed bindings during the real 400ms wait.
- Corrected only this plan's fixture; actual character loading, collision/damage, death and timing remain exercised. Committed in `5f7657c`; WINDOWS entry 33 is fixed.

## Issues Encountered

The previous executor ended at a usage limit with task 1 committed and task 2 tests pending. Continuation verified that history and resumed task 2 without reverting any work. The first RED death fixture reactivated a disposed Range slot; the existing spawn primitive corrected that fixture and final runs emitted no such error.

## Known Stubs and Threat Review

No newly introduced placeholders, skipped tests or unwired outcome adapters remain. Empty pools and nullable action state represent real runtime lifecycle state. No new network endpoint, schema, external trust boundary or package was added. The plan's canceled-award and stale-marker threats are covered by the unit and actual-browser negatives.

## User Setup Required

None.

## Next Phase Readiness

Action phase observation is ready for later animation/view adapters. Shared ANIM-02/ANIM-03 remain pending in REQUIREMENTS.md (ready-ID gate returned 0/2), and phase verification plus human moving acceptance remain separate. No human aesthetic approval, representative-device FPS/capacity pass, full-phase regression pass or future Phase 5 sprint/reload gameplay completion is claimed. Online M4 reload remains 1800ms; grenade and melee gameplay windows are unchanged.

## Self-Check: PASSED

All ten deliverable files and all four listed task commits exist. The per-plan ledger resolves to the recorded base, the measured production range contains four commits, no tracked file deletion occurred, and the final focused unit/browser and necessary static/build gates passed.
