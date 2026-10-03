---
phase: 01-two-client-authoritative-tdm
plan: "02"
subsystem: multiplayer
tags: [colyseus, authoritative-simulation, canonical-map, threejs, playwright, strict-js]
requires:
  - phase: 01-01
    provides: Approved runtime pins, strict boundary checks and isolated production-server fixture
provides:
  - Two real browsers moving and exchanging an authoritative travelling M4 hit
  - Canonical Greek Columns terrain with isolated headless world queries
  - Asset-gated Online TDM entry, confirmed HUD and clean return to offline play
affects: [01-03, 01-04, 01-05, 01-06, 01-07]
tech-stack:
  added: []
  patterns: [Per-room simulation ownership, same-origin transport, private shooter confirmations, named disposable input handlers]
key-files:
  created: [server/index.js, server/tdmRoom.js, src/shared/tdmSimulation.js, src/shared/world.js, src/shared/maps/bunker.js, src/shared/world.test.js, src/network/onlineSession.js]
  modified: [src/maps/bunker.js, src/main.js, src/loop.js, src/entities/drone.js, index.html, style.css, tests/multiplayer.spec.js, AGENTS.md]
key-decisions:
  - "Online authority owns bodies, ammunition, projectiles and confirmed outcomes; the existing renderer consumes snapshots."
  - "The two-client keyboard/mouse M4 slice uses one same-origin room and canonical Greek Columns data; later plans expand movement, lifecycle and hosting."
patterns-established:
  - "Validate intentions against the framework session and current generation before simulation."
  - "Render private confirmed hit feedback separately from replicated victim health."
requirements-completed: [NET-01, NET-03, NET-04, MODE-01, HOST-03]
requirements-status: pending-shared-plan-completion
actuals:
  tokens: 23890
  tasks: 3
  commits: 6
plan_head_before: 1c86423c74ba4e3f5e38ece7d8d2bfb5c55aea6f
plan_head_after: 2e8ee0973daea7e0dd545babd15680167ad269e5
coverage:
  - id: D1
    description: Two live production browsers join, move and exchange server-confirmed M4 damage
    requirement: NET-03
    verification:
      - kind: e2e
        ref: "tests/multiplayer.spec.js#tracer: two browsers join and move; latest pass 50.5s"
        status: pass
      - kind: unit
        ref: "src/shared/world.test.js#rejects client-claimed damage and identity without changing authoritative bodies"
        status: pass
    human_judgment: false
  - id: D2
    description: Canonical terrain, tangent contact, valid pending spawns and independent headless worlds
    requirement: NET-01
    verification:
      - kind: unit
        ref: "src/shared/world.test.js: 11 tests; included in 97-test full unit run"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#tracer: two browsers join and move after extraction"
        status: pass
    human_judgment: false
  - id: D3
    description: Asset-ready online menu, server HUD, explicit leave/rejoin and working offline controls
    requirement: MODE-01
    verification:
      - kind: e2e
        ref: "tests/multiplayer.spec.js#entry: assets gate online join, leave clears actors, and offline controls remain usable; latest pass 33.9s"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e -- --workers=1: 17 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: Current character asset and weapon remain visibly rendered in the online map
    verification:
      - kind: automated_ui
        ref: "evidence/01-02/current-rig.png; both clients assert usingGLTF=true"
        status: pass
    human_judgment: true
    rationale: "Screenshot inspection confirms the current armed rig is rendered; movement smoothness and complete pose quality still require end-of-phase visual UAT."
  - id: D5
    description: Dedicated root-base production serving with isolated fixture build directories
    requirement: HOST-03
    verification:
      - kind: e2e
        ref: "Production fixture --build-dir, /health and two-browser scenarios; owned servers exited after both tests"
        status: pass
      - kind: other
        ref: "npm run build:mp; npm run typecheck:mp"
        status: pass
    human_judgment: false
duration: 214min
completed: 2026-10-03
status: complete
---

# Phase 01 Plan 02: Authoritative Two-Browser M4 Slice Summary

**Two production browsers share server-owned movement, canonical Greek Columns terrain and travelling M4 damage, with private shooter feedback and an explicit online-to-offline menu flow.**

## Performance

- **Duration:** Approximately 214 minutes of wall time, including the prior executor interruption and continuation; this is not a gameplay performance measurement.
- **Started:** 2026-10-03T11:06:09Z (first plan RED commit)
- **Completed:** 2026-10-03T14:40:00Z
- **Tasks:** 3/3
- **Task files:** 17, including two RED evidence records; codebase context, ledger and three screenshots are additional completion documentation.
- **Actuals method:** 95,557 characters in the realized task diff from the persisted ledger base through task3, divided by four and rounded up. The six commits are measured with `git rev-list --count`, before completion metadata commits.

## Accomplishments

- `TdmRoom` uses a room-owned fixed-step simulation and canonical map. The server validates bounded intentions, binds them to its session player and owns ammunition, reload timing, swept travelling projectiles and damage. Clients cannot supply trusted outcomes.
- The production tracer passes through real built assets, validated fixture build directories, HTTP readiness, Colyseus, both browsers and the existing renderer. Sessions differ, remote actors appear, movement is server-derived, target health changes by 28 and only the shooter receives the private confirmed event.
- Renderer and authority consume equal Greek Columns arrays/spawns. Each world copies its own arrays and supplies ground selection, occupancy, earliest obstruction sweep and deterministic valid spawn selection. Exact tangency is allowed; penetration is blocked; exhausted valid spawns remain pending and retry later.
- The current menu owns one asset-gated Online TDM action and one pause-menu leave action. Existing HUD elements display confirmed team, health, ammo, reload, score and time. Leaving removes actors/handlers, cancels delayed offline actions and returns to working offline controls.

## Task Commits

1. **Task1: Two-browser vertical tracer** — `0da0a98` (intentional production RED), `27f947c` (GREEN).
2. **Task2: Canonical isolated headless world** — `8569e49` (tangent RED), `6991f86` (classifier-compatible RED record), `7e155d1` (GREEN).
3. **Task3: Explicit menu ownership and offline return** — `2e8ee09` (GREEN).

Completion metadata is committed separately. There were no tracked-file deletions in task commits and no package installation in this plan.

## Verification

| Check | Actual result |
| --- | --- |
| `npm run test:unit -- src/shared/world.test.js` | Initial task2 GREEN: 10 passed; full final run includes the added forged-outcome test, 11 world tests |
| `npm run test:unit` | 97 passed in 11 files |
| `npm run typecheck:mp` | Passed, strict multiplayer boundary checks retained |
| `npm run typecheck` | Passed, legacy project check also remains compatible |
| `npm run lint` | Passed with zero warnings |
| `npm run build:mp` | Passed, root-base production output in `dist` |
| Production tracer after task2 | Passed before task2 commit, 53.4s scenario |
| Final `npm run test:mp -- --grep 'tracer:|entry:'` | 2 passed in 1.4m: tracer50.5s, entry33.9s |
| `npm run test:e2e -- --workers=1` | 17 passed, existing animation/assets/menu/S&D regressions |
| `git diff --check` | Passed |

The final production fixtures used unique temporary builds `vod-mp-BS08Un` and `vod-mp-RtUt11`, ports57355 and57381. Their owned processes34428 and32516 were absent after teardown. The entry test holds the GLB request to prove controls stay disabled, releases it, verifies one entry/leave control, joins both contexts, checks confirmed HUD/reload, blocks unsupported actions, leaves/rejoins with a new session and enters offline Training Range with the M9.

Screenshots were copied out of Playwright's disposable results and inspected:

- [Current rendered armed rig](evidence/01-02/current-rig.png) — current GLB character, weapon and map cover are visible; both contexts assert actual GLB use.
- [Asset-ready Online TDM menu](evidence/01-02/online-menu.png) — explicit current-menu entry and supported/unavailable-action notice.
- [Offline after online leave](evidence/01-02/offline-after-online.png) — Training Range, M9 and local HUD after online actors/session are removed.

These captures establish rendered current assets and reachable UI. They do not establish complete animation pose quality, remote smoothing, device FPS or hosting capacity. End-of-phase visual acceptance remains scheduled.

## TDD Gate Compliance

- Task1's earlier missing-server failure from01-01 was infrastructure RED, not accepted behavioral evidence. `0da0a98` records the corrected assertion failure: the production server's `/health` was ready, but `#mp-join-btn` was absent. The checker returns `RED_EVIDENCE_OK` for `01-02-RED.json`; GREEN is `27f947c`.
- Task1's real two-browser tracer passed before canonical/menu expansion. The prior executor reran the end-to-end feedback gate twice successfully; continuation preserved that completed task and did not request redundant human approval.
- Task2 recorded an intentional exact-tangent assertion failure before implementing the world. `01-02-02-RED.json` returns `RED_EVIDENCE_OK`; tests and the production tracer passed before `7e155d1`.
- Task3 is not marked TDD in the plan; its behavior is covered by the production entry scenario and existing regressions. No skipped tests or unrun automated verification remain.

## Files Created/Modified

- `src/shared/tdmSimulation.js` — per-room bodies, bounded inputs, M4 cadence/reload/projectiles and server outcomes.
- `server/tdmRoom.js` — initialized replicated schema, session-bound input, fixed timestep and shooter-only confirmations.
- `server/index.js` — validated host/port/build directory, root-base production serving and readiness on one HTTP/transport server.
- `src/shared/maps/bunker.js`, `src/maps/bunker.js` — canonical data-only terrain consumed by authority and visual map.
- `src/shared/world.js`, `src/shared/world.test.js` — independent world ownership, terrain/obstruction/body/spawn rules and meaningful boundary tests.
- `src/network/onlineSession.js` — same-origin adapter, snapshot rendering, named handlers, immutable observations and leave cleanup.
- `src/loop.js` — online processing ahead of local gates and suppression of offline simulation/input paths during sessions.
- `src/main.js`, `index.html`, `style.css` — asset-ready entry, leave/menu integration and supported-action notice.
- `src/entities/drone.js` — mode-transition cleanup owns delayed respawns.
- `tests/multiplayer.spec.js` — real production tracer, current assets, action guards and join/leave/rejoin/offline acceptance.
- `AGENTS.md`, `.planning/codebase/{ARCHITECTURE,INTEGRATIONS,STACK,STRUCTURE}.md` — current ownership/runtime/navigation context.

## Decisions Made

The implementation follows the plan's same-origin single-room, current map/current assets and authority boundaries. The two-client maximum qualifies this acceptance slice only. Keyboard/mouse walking, M4 fire and reload are supported here; sprint/jump/crouch/ADS, fuller combat and complete match transitions retain their later plan assignments.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule3 - Blocking] Correct behavioral RED and stable real-input aiming evidence**
- **Found during:** Task1 and task3 verification.
- **Issue:** An unavailable-server failure cannot satisfy RED; a single mouse adjustment was not reliable under concurrent browser load.
- **Fix:** Record missing online entry against a running production server; use bounded normal mouse adjustments against replicated yaw, retaining the strict final yaw assertion and immutable observations. Correct the offline assertion to the actual configured weapon name `M9`.
- **Files:** `tests/multiplayer.spec.js`, RED evidence records.
- **Verification:** Both RED records classify `RED_EVIDENCE_OK`; final production suite passes.
- **Commits:** `0da0a98`, `6991f86`, `2e8ee09`.

**2. [Rule2 - Critical ownership] Remove the room's visual-map import during extraction**
- **Found during:** Task2.
- **Issue:** Canonical extraction is incomplete if the room continues importing the material/Three map definition; that additional file lies outside task2's five-file list.
- **Fix:** Switch `server/tdmRoom.js` to canonical `bunkerData` alongside the renderer/simulation extraction.
- **Verification:** Headless Node import, map parity, independent worlds and production tracer pass.
- **Commit:** `7e155d1`.

**3. [Rule2 - Critical guards] Close delayed and alternate offline action paths**
- **Found during:** Task3.
- **Issue:** Editing only menu files leaves delayed drone/melee callbacks and direct touch/gamepad action paths active during the online slice. Adapter cleanup/HUD ownership also needs coordinated edits.
- **Fix:** Track/cancel drone and melee timers, guard alternate offline input, retire named adapter handlers/heartbeat and pending joins, and render confirmed HUD values. Keep the existing Three import's narrow declaration suppression compatible with both legacy and strict configs; use explicit `node:process` in the headless test and a bounded15s subprocess test timeout.
- **Files:** `src/entities/drone.js`, `src/loop.js`, `src/network/onlineSession.js`, `src/main.js`, `src/shared/world.test.js`.
- **Verification:** Unsupported actions leave online presentation/ammo/score unchanged; client-claimed damage/identity cannot change health/ammo/events/score; both checks, lint and production/offline regressions pass.
- **Commit:** `2e8ee09`.

All corrections preserve the planned architecture. Resolved deviations are recorded as fixed in `.planning/WINDOWS.md`; the earlier tracer unmet truth is also fixed.

## Security Evidence

The plan's STRIDE mitigations are implemented for this slice:

| Threat | Evidence | Applicable ASVS5.0.0 Level1 controls |
| --- | --- | --- |
| T-01-03 session/input spoofing | Room callback supplies framework session; extra outcome fields and unknown-session input are rejected without changing authority | v5.0.0-2.2.1, v5.0.0-2.2.2, v5.0.0-8.2.2 |
| T-01-04 local outcome tampering | Online guard blocks offline simulation/actions; server owns fire eligibility and damage | v5.0.0-2.2.2, v5.0.0-8.2.1 |
| T-01-05 confirmation disclosure | `client.send` targets the shooter; the victim receives replicated health and has no private confirmation | v5.0.0-8.2.2 |
| T-01-06 world tampering | Canonical data copies and per-instance ownership; map parity, mutation isolation and Node import tests | v5.0.0-2.2.2 |
| T-01-SC installs | No new package install; existing approved pins/lockfile retained | Existing01-01 review |

IDs were checked against the [official OWASP ASVS5.0.0 source](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json). This is control-linked implementation evidence, not a certification claim. Consent-based room leave behavior was checked against [official Colyseus connection documentation](https://docs.colyseus.io/sdk/connection).

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: static-serving | `server/index.js` | New public HTTP readiness/static asset surface is planned but outside the browser/world STRIDE table; the build root is validated once and serves only built game assets. Complete TLS/public/origin hosting checks remain in01-06. |

## Issues Encountered

Execution continued after a quota interruption with task1 already committed and task2 edits intact. No SUMMARY existed, so incomplete work was resumed rather than treated as completed. Root/branch checks ran before each continuation commit under the parent-authorized temporary default-branch override. No push was performed.

No goal-blocking stubs were found. Empty actor/projectile collections and nullable session/hit state are runtime lifecycle values; editor HTML placeholder attributes are existing form hints. The pre-existing development-dependency audit findings remain open in ledger entry3 and outside this plan. There were no authentication gates or additional manual setup.

## Next Phase Readiness

01-03 can extend the proven movement/input contract;01-06 can expand the working dedicated-server CLI/hosting path.01-04 and01-05 still own fuller combat and death/respawn/results/rematch behavior. Full phase requirements remain pending until all declaring sibling plans have SUMMARY files; this plan proves its listed slice, not full TDM phase completion.

## Self-Check: PASSED

All seven new production modules, the world test, both RED records and three screenshot artifacts exist. All six task commits exist in history. The persisted ledger base and final task HEAD resolve; task commits contain no deletions. Automated checks above passed and the final fixture processes exited.
