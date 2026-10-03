---
phase: 01-two-client-authoritative-tdm
plan: "05"
subsystem: multiplayer
tags: [colyseus, tdm, lifecycle, teams, generations, tdd, playwright]
requires:
  - phase: 01-04
    provides: Current-life authoritative M4 impacts, damage and private confirmations
  - phase: 01-06
    provides: Validated operator rules and owned isolated production fixtures
provides:
  - Immutable operator settings, blue/red balanced teams and immediate solo start
  - Once-per-life scores, valid-spawn respawns and fixed15-second results/rematch
  - Empty-room suspension and retired input/event generations across lifecycle transitions
affects: [01-07, phase-02, phase-08]
actuals:
  tokens: 26508
  tasks: 2
  commits: 5
  plan_head_before: 28d628c84370699e5c27640a3d5690901e9b464b
  plan_head_after: bc1e8b58c4e1aa2a782b24f75d8a36cc49a1d901
plan_head_before: 28d628c84370699e5c27640a3d5690901e9b464b
plan_head_after: bc1e8b58c4e1aa2a782b24f75d8a36cc49a1d901
tech-stack:
  added: []
  patterns: [immutable operator rules, stable join ordinals, once-per-life score, generation-aware queue retirement, fixed server results deadline]
key-files:
  created: [src/shared/tdmRules.js, src/shared/tdmRules.test.js, .planning/phases/01-two-client-authoritative-tdm/01-05-01-RED.json, .planning/phases/01-two-client-authoritative-tdm/01-05-02-RED.json, .planning/phases/01-two-client-authoritative-tdm/evidence/01-05/teams.png, .planning/phases/01-two-client-authoritative-tdm/evidence/01-05/results-score.png, .planning/phases/01-two-client-authoritative-tdm/evidence/01-05/results-time.png]
  modified: [src/shared/tdmSimulation.js, src/shared/world.js, src/shared/protocol.js, src/shared/movement.test.js, server/tdmRoom.js, server/tdmRoom.test.js, server/testHelpers/hostileClient.js, src/network/onlineSession.js, tests/multiplayer.spec.js, AGENTS.md, docs/MULTIPLAYER.md, .planning/codebase/ARCHITECTURE.md, .planning/codebase/STRUCTURE.md, .planning/WINDOWS.md]
key-decisions:
  - "Two balanced humans cannot switch without violating the locked difference<=1 rule; a solo results switch followed by a smaller-team replacement join proves the legal browser path."
  - "Resolve the entire current-step impact batch before score threshold and time expiry; ties yield draw and results remain fixed15 seconds."
  - "Life/match transitions reset receipt sequence and pending commands while preserving the bounded flood budget; client intentions and feedback follow connection/match/life generations."
  - "Respawn waits for a valid unoccupied candidate; empty rooms remain waiting without repeating rematches, and a later fresh connection starts immediately."
patterns-established:
  - "Authoritative deadlines drive respawn/results UI; pointer lock releases on death/results and a Resume gesture does not delay server rematch."
  - "Real SDK routes wait for neutral input consumption before aiming; reconnect browser assertions wait for both admitted membership and the replacement session snapshot."
requirements-completed: [NET-01, NET-03, NET-04, MODE-01]
coverage:
  - id: D1
    description: "Server-owned settings, stable blue/red balance, cosmetic guest identity and immediate solo start"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "src/shared/tdmRules.test.js#authoritative TDM teams (6 tests)"
        status: pass
      - kind: integration
        ref: "server/tdmRoom.test.js#binds guest identity and team requests to membership, life and operator rules"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#teams: solo start and smaller-team assignments are visible in both browsers"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real deaths, reset inventory respawns, score/time endings, shared results and automatic same-settings rematch"
    requirement: MODE-01
    verification:
      - kind: unit
        ref: "src/shared/tdmRules.test.js#authoritative TDM lifecycle (8 tests, including default50/600/3/0.25 and results15)"
        status: pass
      - kind: e2e
        ref: "npm run test:mp -- --grep 'teams:|lifecycle:' (3 passed,1.7m; final GREEN)"
        status: pass
      - kind: automated_ui
        ref: "playwright:.planning/phases/01-two-client-authoritative-tdm/evidence/01-05/results-score.png"
        status: pass
      - kind: automated_ui
        ref: "playwright:.planning/phases/01-two-client-authoritative-tdm/evidence/01-05/results-time.png"
        status: pass
    human_judgment: false
  - id: D3
    description: "Queued stale life/match traffic and delayed confirmations retire; disconnect and empty-room state cannot bind replacement sessions"
    requirement: NET-04
    verification:
      - kind: integration
        ref: "server/tdmRoom.test.js#real SDK old-life and old-match replay cannot survive respawn, results, rematch or disconnect"
        status: pass
      - kind: unit
        ref: "server/tdmRoom.test.js#life and match resets retire queued commands, sequence cursors and delayed confirmations"
        status: pass
      - kind: unit
        ref: "npm run test:unit (231 passed in19 files,54.58s; final source)"
        status: pass
    human_judgment: false
duration: 42min
completed: 2026-10-03
status: complete
---

# Phase 1 Plan 5: Authoritative TDM Lifecycle Summary

**Blue/red server-owned teams now complete real deaths, inventory respawns, shared score/time results and an automatic same-settings rematch after15 seconds.**

## Files Created/Modified

- Created `src/shared/tdmRules.js`: bounded immutable settings, cosmetic guest names, stable membership, balance and waiting/active/results rules.
- Created `src/shared/tdmRules.test.js`: behavioral solo-start and lethal-score REDs, default/boundary lifecycle tests and safe spawn/empty-room coverage.
- Created both `01-05-01-RED.json` and `01-05-02-RED.json` evidence records in this phase directory.
- Created `evidence/01-05/teams.png`, `evidence/01-05/results-score.png` and `evidence/01-05/results-time.png` in this phase directory from the passing production-browser run.
- Updated simulation/world, room/schema, input gate, browser adapter, real SDK helper/tests, multiplayer scenarios and the directly affected movement test. Updated AGENTS, multiplayer operating docs, architecture/structure maps and WINDOWS.

## Performance

- Started: 2026-10-03T19:59:47.170Z; task checks and measured context HEAD completed: 2026-10-03T20:42Z; uninterrupted execution,42min through that boundary. SUMMARY/state closure followed separately.
- Tasks:2/2;21 realized files before SUMMARY/STATE closure.
- Actuals:ceil(106030 realized Git diff characters/4)=26508. Persisted ledger measures5 commits through `bc1e8b5`; subsequent SUMMARY/state metadata commits are outside the frozen measurement.

## Accomplishments

- Defaults50 kills/600 seconds/3-second respawn/0.25 friendly damage and fixed15-second results remain server-owned. Operator bounds reject malformed, unknown, nonfinite and out-of-range settings. Guest join claims cannot select team or trusted settings; null/empty options generate bounded identity, malformed structures reject, printable nicknames render with textContent.
- First human starts immediately, joins use smaller team/tieblue and stable ordinal. Switches require exact current membership/match/life, death or results, and post-switch difference<=1. Switching does not resurrect or reset score. Two balanced humans correctly reject a switch; the browser also proves a legal solo results switch visible to a fresh smaller-team peer.
- Current-step impacts award each enemy death once before score/time expiry. Friendly deaths award no team score, tied time yields draw, and results freeze combat. Active-only respawn honors the server deadline, full100/30/90 inventory, stance/velocity/action/input reset and valid unoccupied spawn; exhaustion waits safely.
- Fifteen-second rematch preserves settings/teams and resets scores/stats, timers, bullets, event/shot IDs, queued commands, acknowledgement/sequence cursors and life inventory with new match/life generations. Last leave removes membership/body/inputs and suspends matches. A later connection starts fresh; launched old-session shots cannot credit a replacement.
- Both clients show the same authoritative results/countdown and automatically hide results at rematch. Death/results release pointer lock; Resume obtains a new gesture and Leave stays available. Connection/match/life guards reject retired intentions and private confirmations.

## Task Commits

1. Task1 RED: `3c46db5` — existing running simulation returned playing rather than the locked active solo contract.
2. Task1 GREEN: `82845f4` — settings, guest identity, blue/red assignment/switch validation and browser team presentation.
3. Task2 RED: `c16db68` — a real lethal kill at killLimit1 failed to enter results.
4. Task2 GREEN: `5f578b2` — complete respawn/results/rematch, queue/event retirement and real transport/browser proofs.
5. Context/evidence: `bc1e8b5` — current architecture/operating context, fixed deviation ledger and three browser captures.

## TDD Gate Compliance

Both REDs were actual named assertion failures against existing runtime behavior, with nonzero exits and checker verdict RED_EVIDENCE_OK before production implementation. Task1's initial evidence XML used an unescaped greater-than: its RED commit already existed when the checker rejected that representation; the corrected record passed before any GREEN code was written and is committed in `82845f4`. Task2 evidence passed before its RED commit/implementation. Both RED→GREEN commit pairs exist; no separate refactor was necessary. Phase TDD_MODE runtime gate was inactive by configuration; task behavioral TDD was followed.

## Checks Run

- `npm run test:unit -- src/shared/tdmRules.test.js`:14 passed; rules/room targeted suite32 passed in55.18s. Final full source run `npm run test:unit`:231 passed in19 files,54.58s, including the extended actual SDK empty-room/rejoin case and corrected bounded movement fixture.
- Final `npm run test:mp -- --grep 'teams:|lifecycle:'`:3 passed,1.7m. Score path uses ordinary controls and real lethal shots, shows dead input/team rejection and fresh inventory, then common BLUE2–0 results. Time path shows DRAW0–0, legal solo results switch, replacement connection assignment and the same15-second automatic generation2 reset. Resume obtains actual headless pointer lock after rematch.
- Broader `npm run test:mp`:9 passed/1 failed,5.1m. All7 existing hosting HTTPS/restart, combat, authority, tracer, movement and entry/offline-return scenarios passed, as did teams and score lifecycle. Its time lifecycle failed because the test captured a null replacement ID before the new adapter session arrived. The explicit session/state waits corrected that test; the final required3-test run above passes. No claim that the earlier aggregate command exited successfully.
- `npm run test:e2e`:17 passed,39.9s. Existing menus/S&D, GLB/weapon poses, action timing and instance resource cleanup remain functional.
- Lint, strict multiplayer types, legacy types, production build and diff whitespace checks passed. Existing >500kB JS chunk warning remains; no package or configuration suppression was added.
- Passing browser captures were read visually and preserved before offline tests replaced test-results. Low-DPR automation establishes the asserted lifecycle UI/behavior; artistic quality and actual LAN certificate trust are separate phase-end acceptance.
- Owned production fixture PIDs from final lifecycle and regression runs are absent; unrelated processes were preserved. No tracked deletion occurred.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule2 - Lifecycle companions] Queue and adapter generations needed coordinated reset.** Added receipt reset preserving flood budget, blue spawn alias, replicated settings/results/stats, generation-aware input/event retirement and death/results Resume/Leave controls. `src/shared/protocol.js`, `src/shared/world.js`, room and adapter; `82845f4`/`5f578b2`. WINDOWS21 fixed.

**2. [Rule1 - Affected fixture] The old movement test selected a now-invalid zero-second match.** It now advances an approved one-second match to results and verifies input rejection/frozen position. `src/shared/movement.test.js`; `5f578b2`. All231 unit tests pass; WINDOWS22 fixed.

**3. [Rule3 - Verification timing] Real SDK and browser lifecycle boundaries are asynchronous.** SDK aiming waits for neutral consumption. Production lifecycle uses approved5-second respawn for accessible UI checks, a1e-7ms clock tolerance and explicit new session/state waits. Fixture teardown always stops owned resources. Earlier browser failures and their final passing corrections are reported above. `server/tdmRoom.test.js`, `tests/multiplayer.spec.js`; `5f578b2`. WINDOWS23 fixed.

**4. [Rule3 - RED record representation] Corrected XML escaping before GREEN.** Task1 behavioral assertion was valid; its first record encoding failed the checker. Corrected evidence passed before implementation. `01-05-01-RED.json`; `82845f4`. WINDOWS24 fixed.

No new package, auth gate, architecture decision, skipped test, unrun plan verification or goal-blocking stub. Stub/placeholder scan found no unresolved stub; security surface is the planned switch/settings/lifecycle boundary, with no extra endpoint, auth path or file trust boundary.

## Issues Encountered

All task-local issues are resolved. Existing development dependency advisories and phase-end two-window actual LAN certificate trust/gesture pointer-lock UAT remain open in WINDOWS3/17. Automated trusted-origin HTTPS transport and headless pointer-lock checks do not substitute for actual LAN trust acceptance.

## User Setup Required

No additional setup in this plan. Existing operator/TLS instructions remain in `docs/MULTIPLAYER.md`; actual LAN trust and gesture acceptance stay at phase end.

## Next Phase Readiness

Ready for01-07 (Wave6): complete current-rig/confirmed-feedback/error/offline/security acceptance. `requirements.ready-ids` reports all4 plan IDs blocked by unfinished declaring sibling01-07; global NET-01/NET-03/NET-04/MODE-01 remain pending. The phase is still executing.

## Self-Check: PASSED

Both created rules files, both RED records, all three browser captures and this SUMMARY exist. All five measured commits resolve as Git commit objects. Required task checks pass on final source; no unresolved task-local defect, uncommitted code or tracked file deletion remains.
