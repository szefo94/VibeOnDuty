---
phase: 01-two-client-authoritative-tdm
plan: "04"
subsystem: combat
tags: [colyseus, authority, projectiles, m4, tdd, playwright]
requires:
  - phase: 01-03
    provides: Exact bounded intentions, current-step movement and canonical swept terrain
  - phase: 01-06
    provides: Typed operator settings bridge and owned isolated production fixtures
provides:
  - Server-time M4 fire/reload and seeded spread with first-impact travelling projectiles
  - Current-life double-precision damage and single lethal score transition
  - Bounded forged-outcome rejection and private deduplicated hit-confirmed delivery
affects: [01-05, 01-07, phase-02, phase-08]
actuals:
  tokens: 17183
  tasks: 2
  commits: 5
  plan_head_before: f91c653b56eb0dcfca69ddc56bc6a5ee436cb5e7
  plan_head_after: d5328f3f14cc251486d8daab7a4c955c7163c705
plan_head_before: f91c653b56eb0dcfca69ddc56bc6a5ee436cb5e7
plan_head_after: d5328f3f14cc251486d8daab7a4c955c7163c705
tech-stack:
  added: []
  patterns: [room-owned seeded RNG, swept current-step hit regions, private event high-water mark, float64 replicated health]
key-files:
  created: [src/shared/combat.js, src/shared/combat.test.js, .planning/phases/01-two-client-authoritative-tdm/01-04-01-RED.json, .planning/phases/01-two-client-authoritative-tdm/01-04-02-RED.json]
  modified: [src/shared/tdmSimulation.js, src/combat/damage.js, server/tdmRoom.js, server/index.js, server/tdmRoom.test.js, server/testHelpers/hostileClient.js, src/network/onlineSession.js, tests/multiplayer.spec.js, AGENTS.md, .planning/codebase/ARCHITECTURE.md, .planning/codebase/STRUCTURE.md, .planning/WINDOWS.md]
key-decisions:
  - "M4 preserves the authoritative base28 body damage and training-range4x head pattern; existing source has no range falloff or ADS spread multiplier."
  - "Projectile lifetime is half-open at1.1s; current-step sweeps use the true minimum plus1e-7 tie band, obstruction then stable sessionId."
  - "Operator-only validated seed drives the same room combat algorithm; fractional health uses explicit float64 and feedback reports actual clamped damage."
  - "Only the firing session receives generation-checked deduplicated hit-confirmed events; unsupported messages share the bounded receipt budget."
patterns-established:
  - "Weapon milliseconds and ballistic seconds remain separate; all actors move before swept impacts."
  - "Browser authority attacks can invoke the real compiled offline emitter through test-only response instrumentation without production mutation hooks."
requirements-completed: [NET-01, NET-04]
coverage:
  - id: D1
    description: "Server-owned M4 timing, ammo, spread, cover and projectile lifetime"
    requirement: NET-04
    verification:
      - kind: unit
        ref: "npm run test:unit -- src/shared/combat.test.js (32 passing tests)"
        status: pass
      - kind: e2e
        ref: "npm run test:mp -- --grep 'tracer:|combat:' (2 passed,1.7m; task1 GREEN)"
        status: pass
      - kind: e2e
        ref: "npm run test:mp -- --grep 'combat:|authority:' (2 passed,1.8m; final task2 GREEN)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Current-life precise damage, single lethal score and private deduplicated confirmation"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "server/tdmRoom.test.js#one real projectile retires one life and duplicate delivery cannot repeat its private confirmation or score"
        status: pass
      - kind: integration
        ref: "server/tdmRoom.test.js#delivers a real eligible hit only to its firing session and replicates damage to both"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#authority: real M4 cover, ammo, reload and private hit outcomes agree after forged offline outcomes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Forged network and actual offline-bus outcomes cannot award server health/ammo/score"
    requirement: NET-04
    verification:
      - kind: integration
        ref: "server/tdmRoom.test.js#explicitly rejects outcome messages without awarding damage, ammo or score"
        status: pass
      - kind: unit
        ref: "npm run test:unit -- server/tdmRoom.test.js (15 passed,21.33s)"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#authority: real M4 cover, ammo, reload and private hit outcomes agree after forged offline outcomes"
        status: pass
    human_judgment: false
duration: 29min
completed: 2026-10-03
status: complete
---

# Phase 1 Plan 4: Authoritative M4 Combat Summary

**Room-owned M4 timing, spread and swept travel now produce precise current-life damage and shooter-only deduplicated confirmations; clients cannot award combat outcomes.**

## Performance

- **Duration:** 29min, uninterrupted execution
- **Started:** 2026-10-03T19:21:12.552Z
- **Completed:** 2026-10-03T19:49:45.284Z
- **Tasks:** 2/2
- **Files modified:** 16 at the measured post-task/context HEAD
- **Actuals method:** ceil(68730 realized diff characters/4)=17183, measured over persisted ledger base through `d5328f3`;5 commits. Subsequent SUMMARY/STATE closure commits are outside that frozen measurement.

## Accomplishments

- Eligible M4 fire/reload uses server milliseconds; heat grows0.08 and recovers0.5/s with the source spread expression, room-owned RNG, authoritative muzzle and65m/s gravity-affected travel. No client clock, spread, muzzle, ammo or damage claims are accepted.
- Current-step swept actor/terrain contact resolves the true earliest impact with1e-7 ties, obstruction first and stable actor identity. Fractional final steps stop at the half-open1.1s lifetime; existing walls/cracks/columns/ramp/slab queries are reused without changing `world.js`.
- Damage rechecks the current target life, retains float64 health, clamps0..100 and reports the amount actually removed. A launched shot can outlive its shooter in the same match; dead/retired lives and matches cannot receive new damage/credit. One current life awards at most one enemy kill; friendly kills award none.
- Unsupported message types and outcome-shaped input fields are rejected. Real SDK tests prove recipient-private confirmations and replicated damage; production browser tests invoke actual bundled legacy offline outcomes, then prove unchanged server state and usable normal combat.

## Task Commits

1. **Task1 RED — lifetime regression:** `105e58b` (`test`)
2. **Task1 GREEN — timing and swept first impacts:** `4d48d2d` (`feat`)
3. **Task2 RED — real transport unsupported outcome rejection:** `98a433a` (`test`)
4. **Task2 GREEN — forged outcome rejection/private dedup:** `6ec59fe` (`feat`)
5. **Context and resolved deviation ledger:** `d5328f3` (`docs`)

SUMMARY and sequential state/progress are captured in separate SDK metadata commits.

## Files Created/Modified

- `src/shared/combat.js`, `combat.test.js`: Extracted numeric server combat and32 boundary/order/precision/life tests.
- `src/shared/tdmSimulation.js`: Per-room clock/RNG/IDs, movement-before-projectiles and one current-life enemy kill callback.
- `src/combat/damage.js`: Pure finite body/head damage helper plus unchanged grenade formulas with checked numeric contracts.
- `server/index.js`, `server/tdmRoom.js`: Validated operator seed, float64 schema health, bounded unsupported-message rejection and private event delivery high-water mark.
- `src/network/onlineSession.js`: Typed `hit-confirmed` listener, generation/event filtering and explicit shooter identity check.
- `server/tdmRoom.test.js`, `server/testHelpers/hostileClient.js`:15 real-transport and controlled-clock input/combat tests; raw message sending and observed private confirmations.
- `tests/multiplayer.spec.js`: Real cover/fire/reload route and actual offline-emitter authority attack. The probe is appended only to Playwright's browser response, never the production source/server.
- Both `01-04-*-RED.json` records: Intentional failing assertions verified by `check tdd-red-evidence`.
- `AGENTS.md`, mapped architecture/structure and `WINDOWS.md`: Current combat navigation and three resolved deviation records.

## Decisions Made

The original `damage.js` was grenade-only. Offline `shoot.js` adds random0..9 to body damage, while the existing online tracer uses the configured28 and training targets use4x head damage. The authoritative minimum slice keeps that configured base and explicit head multiplier; the helper validates server-derived range without inventing falloff. Source ADS has no accuracy multiplier, so the source heat/spread expression is preserved.

Standing hit regions: feet=eye-1.65, body radius0.35 from feet to eye-0.20; head radius0.20 from eye-0.20 to eye+0.10. Crouched feet=eye-0.85 with the same head span/radii. At the shared region boundary, body wins the same-actor tie. No timestamp rewind is introduced.

The existing exact intention protocol already rejects unknown fields; unsupported message types now explicitly reject while consuming the same session token budget. IDs originate only in the simulation. Room confirmation delivery checks both life generations and current match, consumes each event ID once, and sends only to the firing session. No client join option can choose the seed.

## TDD Gate Compliance

| Task | Intentional RED | GREEN | Evidence |
| --- | --- | --- | --- |
|01-04-01|Target beyond1.1s received late28 damage: expected100,actual72|32 combat tests pass|`01-04-01-RED.json`; RED_EVIDENCE_OK|
|01-04-02|Actual SDK damage message received no explicit rejection: expected unknown_message,actual[]|15 room tests pass|`01-04-02-RED.json`; RED_EVIDENCE_OK|

Both RED tests failed on the intended behavioral assertion against running code. Neither RED relies on missing infrastructure/modules or zero-test discovery. No phase-mode additional TDD gate is active.

## Verification

- `npm run test:unit -- src/shared/combat.test.js`:32 passed. Includes ready-1/ready/ready+1ms, ammo0/1, reload-1/exact/+1, t0/t1, epsilon ties, ramp/slab, standing/crouched head, exact lifetime, current-step moving target, target-life recheck, dead shooter and fractional serialization.
- `npm run test:unit -- server/tdmRoom.test.js`:15 passed,21.33s. Actual SDK forged identity/outcome fields/unknown messages/replay, real private hit, floods; controlled current-life single death/score, friendly lethal clamp5.125, retired confirmation generations and disconnected shooter without replacement credit.
- `npm run test:mp -- --grep 'tracer:|combat:'`:2 passed,1.7m, after task1 implementation.
- `npm run test:mp -- --grep 'combat:|authority:'`:2 passed,1.8m, after final task2 implementation. Production root-base assets, isolated server/context fixtures, ordinary controls, cover health100, reload30/89, accepted hit28 and replicated health72. Victim receives no confirmation/marker/damage number; shooter observes one `-28` number. Actual offline bus emissions leave both server participants health100/ammo30/score0 before normal combat.
- `npm run test:unit`:214 passed in18 files,39.79s.
- `npm run test:e2e`:17 offline browser tests passed,33.8s; menus/S&D, current assets/animation/weapons, resource disposal and action timing remain functional.
- `npm run lint`, `npm run typecheck:mp`, `npm run typecheck`, `npm run build`, `git diff --check`:passed. Existing large JS chunk warning remains; no new package or suppression.
- Production fixtures clean up their own server/build resources. Final owned process IDs34596/4420/35180 are absent. Unrelated browser processes are preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule2 - Missing correctness helper] The source helper was grenade-only.** Added pure configured M4 body/head damage as described above; no unsupported range/ADS formula. `src/combat/damage.js`; task1 `4d48d2d`;32 combat tests and production path pass. WINDOWS18 fixed.

**2. [Rule2 - Precision and integration] Combat required schema/hosting/client companions.** Explicit float64 preserves fractional values through actual schema encode/decode. The existing typed operator bridge passes a validated server-only seed; the browser listener follows the required private message name. `server/index.js`, `server/tdmRoom.js`, `src/network/onlineSession.js`; `4d48d2d`/`6ec59fe`; strict types and browser/transport proof pass. WINDOWS19 fixed.

**3. [Rule3 - Verification fixture] Production source modules are bundled, and pointer moves affect aim.** Test-only response instrumentation binds the actual offline emitter with an exact single-match guard. Corrected pointer aim reset, the existing negative damage label expectation, and an upward test trajectory that missed the long-range target. Ordinary controls and the same production combat remain in use; final task/browser/room checks all pass. `tests/multiplayer.spec.js`, `server/tdmRoom.test.js`; `4d48d2d`/`6ec59fe`; WINDOWS20 fixed.

No new packages, auth gate, architecture stop, skipped test, unrun plan verification or goal-blocking stub. Existing swept world code needed no modification.

## Issues Encountered

All task-local issues above are resolved. Existing development dependency audit items and actual LAN trust/gesture pointer-lock acceptance stay open in WINDOWS3/17. Automated low-DPR headless browser checks establish asserted behavior, not visual-quality or actual LAN trust acceptance.

## User Setup Required

No new setup for this plan. Existing hosting setup remains documented in `docs/MULTIPLAYER.md`; the actual two-window LAN certificate trust and gesture pointer-lock check remains phase-end human work.

## Next Phase Readiness

Ready for01-05 (Wave5): full respawn/results/rematch lifecycle must coordinate the tested weapon/projectile/input/event generations. Then01-07 completes presentation/end-to-end acceptance. Generation rejection is tested here with controlled room/simulation clocks; a complete rematch UI is not delivered by this combat plan.

NET-01/NET-04 are copied above for plan traceability. `requirements.ready-ids` reports0/2 ready because declaring sibling plans remain unfinished; global requirements stay pending. The phase is still executing.

## Self-Check: PASSED

Both created combat files, both RED records and this SUMMARY exist. All five measured commits resolve as Git commit objects. Required task checks passed; no unresolved task-local defects or tracked file deletions remain.
