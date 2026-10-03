---
phase: 01-two-client-authoritative-tdm
plan: "03"
subsystem: multiplayer
tags: [colyseus, authoritative-movement, input-validation, real-transport, playwright, strict-js]
requires:
  - phase: 01-02
    provides: Canonical headless world, room-owned M4 simulation and production two-browser tracer
provides:
  - Authoritative walk, sprint, jump, crouch and ADS through existing browser controls and rigs
  - Exact versioned intent rejection, acknowledged-tick age and bounded per-session receipt queues
  - Real SDK evidence for raw hostile rejection, session/room isolation and sustained flood disconnect
affects: [01-04, 01-05, 01-06, 01-07, phase-02]
tech-stack:
  added: []
  patterns: [Numeric stance-aware movement, rejection-only validation, fixed-step latest intent consumption, explicit neutral retirement]
key-files:
  created: [src/shared/movement.js, src/shared/movement.test.js, src/shared/protocol.js, src/shared/protocol.test.js, server/tdmRoom.test.js, server/testHelpers/hostileClient.js]
  modified: [src/shared/world.js, src/shared/tdmSimulation.js, server/tdmRoom.js, src/network/onlineSession.js, tests/multiplayer.spec.js, index.html, AGENTS.md, .gitignore]
key-decisions:
  - "Crouched speed remains the existing 6 * 0.72 = 4.32m/s; authority stores eye Y and queries terrain with a standing-equivalent reference."
  - "Framework session identity, exact schema, server tick age and monotonic receipt time determine input acceptance; client clocks and claimed outcomes are rejected."
  - "Explicit neutral cancels queued action edges on blur/unlock before the legacy locked binding updates; rendering consumes authoritative snapshots without prediction."
patterns-established:
  - "One room-owned bounded command queue per transport session; consume latest admissible intent once per fixed step and preserve one-shot edges."
  - "Raw SDK tests observe reason codes and state rather than sanitizing hostile commands or mutating trusted bodies."
requirements-completed: [NET-01, NET-03]
requirements-status: pending-shared-plan-completion
actuals:
  tokens: 22576
  tasks: 2
  commits: 5
plan_head_before: ec3fb6bf53835d2e3e1a7ba651cf332d0afa27bf
plan_head_after: 864114db1a90cb2bd861a3336f45cb53704d201f
coverage:
  - id: D1
    description: Existing WASD, Shift, Space, Ctrl/C and secondary mouse controls produce authoritative movement and ADS
    requirement: NET-01
    verification:
      - kind: unit
        ref: "src/shared/movement.test.js: 8 tests, included in 132-test full run"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#movement: latest standalone 28.7s; complete production set 31.6s"
        status: pass
    human_judgment: false
  - id: D2
    description: Both browsers agree on stance/body position across ramps, raised terrain and walls; camera render offsets preserve the authoritative eye
    requirement: NET-03
    verification:
      - kind: e2e
        ref: "tests/multiplayer.spec.js#movement: real controls, terrain height, wall bound and third-person eye restore"
        status: pass
      - kind: unit
        ref: "src/shared/movement.test.js: exact max-step and multi-floor crouch/standing clearance"
        status: pass
    human_judgment: false
  - id: D3
    description: Raw malformed, forged, replayed, stale and flooded transport messages have explicit bounded rejection semantics
    requirement: NET-03
    verification:
      - kind: integration
        ref: "server/tdmRoom.test.js: 9 actual SDK/controlled-room tests; Origin derives from serverUrl"
        status: pass
      - kind: unit
        ref: "src/shared/protocol.test.js: 18 boundary tests; targeted protocol/room run 27 passed in 6.87s"
        status: pass
      - kind: other
        ref: "npm run typecheck:mp and npm run lint"
        status: pass
    human_judgment: false
  - id: D4
    description: Current armed character rigs, terrain and HUD remain rendered online
    verification:
      - kind: automated_ui
        ref: "evidence/01-03/movement-rig.png; both clients assert usingGLTF=true"
        status: pass
    human_judgment: true
    rationale: "The screenshot was inspected and the existing rig is visible on the raised walkway; complete pose quality and perceived smoothness remain end-of-phase visual UAT."
  - id: D5
    description: Confirmed M4 tracer, asset-gated entry/leave/rejoin and offline controls continue to work
    verification:
      - kind: e2e
        ref: "Complete production set: tracer 45.5s, movement 31.6s, entry 13.9s; 3 passed in 1.5m"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e -- --workers=1: 17 passed in 38.5s"
        status: pass
    human_judgment: false
duration: 86min
started: 2026-10-03T14:51:41.992Z
completed: 2026-10-03
status: complete
---

# Phase 01 Plan 03: Authoritative Movement and Hostile Input Summary

**Two production browsers share server-owned walk/sprint/jump/crouch/ADS and stance-aware terrain, while raw SDK traffic proves exact input rejection, fixed-step displacement and room isolation.**

## Performance

- **Duration:** Approximately 86 minutes of wall time, including browser-load investigation; this does not measure gameplay performance.
- **Started:** 2026-10-03T14:51:41.992Z.
- **Completed:** 2026-10-03T16:17Z.
- **Tasks:** 2/2.
- **Task files:** 17, including two RED records and one gameplay screenshot. Architecture maps and the broken-windows ledger are completion documentation.
- **Actuals method:** 90,301 characters in the realized `git diff` from the persisted ledger base through `864114d`, divided by four and rounded up. Binary screenshot content is represented by Git's binary-file summary. Five commits are measured with `git rev-list --count` before completion documentation.

## Accomplishments

- `stepMovement(body,intent,world,dtSeconds)` is numeric and headless. Walk is 6m/s, sprint 9.9m/s, crouch 4.32m/s, jump force 7.5, gravity 18, standing eye 1.65 and crouched eye 0.85. Diagonals normalize, horizontal probes resolve X then Z, max-step is 0.8 and stance changes preserve feet/floor selection. Standing requires clearance; jumping requires ground. Invalid timesteps and dead/finished bodies do not move.
- The existing browser emits current acknowledged tick, increasing sequence and match/life generations with all supported actions. Authoritative bodies replicate crouching, ground/vertical state, moving, aiming, sprinting and consumed sequence. Local camera eye comes from the body; existing third-person render restore, aim cosmetics, HUD, current GLB ownership and effect expiry remain active. Blur/unlock force neutral immediately; snapshots continue while unlocked.
- `validateInput(raw,context)` rejects unknown/missing keys, nonnumeric/nonfinite values, out-of-range axes/aim, invalid booleans, client claims, wrong generations, stale/future ticks and duplicate/reordered sequences. It never sanitizes hostile values into accepted commands. The room binds identity to `client.sessionId` and sends only a reason code.
- Each session admits at most eight pending commands. Application payloads have a 1024-byte serialized UTF-8 budget. A 60-token/second refill with capacity 120 permits the planned burst; three consecutive one-second windows exhausting the budget disconnect with code 4008. Acknowledged tick age is at most 15 steps; receipt age is at most 500ms. Consumption rechecks context, uses server fixed dt once per player/tick, preserves fire/reload/jump edges and clears them on neutral. Death, leave, generation changes and results retire input. Sequence exhaustion requires a fresh session and closes with code 4002.
- The hostile helper uses the already installed pinned SDK and existing Node WebSocket transport with an explicit Origin derived from the ephemeral server URL. Real messages demonstrate malformed rejection, two-session/two-room isolation, queue/rate overflow, delayed input, sequence exhaustion and sustained flood disconnection. Controlled clocks verify exact queue, age and rate boundaries without wall-clock sleeps.

## Task Commits

1. **Task 1 RED:** `9410815` — specify authoritative movement and stance behavior.
2. **Task 1 GREEN:** `6ddc82c` — replicate authoritative movement stance and ADS.
3. **Task 2 RED:** `4ed6ea2` — expose raw hostile input rejection over real transport.
4. **Task 2 GREEN:** `ffac4d4` — reject hostile input with bounded session queues.
5. **Integration correction:** `864114d` — retire unlocked action edges, observe rejection/lock state and stabilize real browser observations.

All five task commits retain normal hooks, the project root guard and the temporary orchestrator-authorized default-branch override. No files were deleted and no packages were installed.

## Verification

| Command | Terminal evidence |
| --- | --- |
| `npm run test:unit -- src/shared/movement.test.js` | 8 passed; task1 GREEN |
| `npm run test:unit -- src/shared/protocol.test.js server/tdmRoom.test.js` | 27 passed in 6.87s |
| `npm run test:unit` | 132 passed in 14 files, 25.73s |
| `npm run test:mp -- --grep "tracer:|movement:"` | Task1 2 passed in 2.1m; final full production set also covers both |
| `npm run test:mp -- --grep "movement:"` | Hardened final standalone scenario passed in 28.7s, total 29.7s |
| `npm run test:mp -- --grep "tracer:|movement:|entry:"` | Final 3 passed in 1.5m: 45.5s / 31.6s / 13.9s |
| `npm run test:e2e -- --workers=1` | 17 passed in 38.5s |
| `npm run typecheck:mp` | Exit 0; new authority/protocol/helper boundaries explicitly checked |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0, zero warnings |
| `npm run build` | Exit 0; existing bundle-size advisory remains |
| `git diff --check` | Exit 0 |

Every production fixture builds its own root-base OS-temp output and owns its server lifecycle. Latest fixture server PIDs were checked after exit and were absent. Unrelated browser processes were preserved. Application payload budget is distinct from the existing 2048-byte transport-frame cap in `server/index.js`; this plan did not change the host transport configuration.

## TDD Gate Compliance

- Both tasks are `tdd="true"`; phase-wide MVP/TDD mode is disabled in project config, so its additional runtime gate does not apply.
- Task1 RED reaches the movement behavior: extended intent was rejected and walking X remained 10 instead of 12. `.planning/phases/01-two-client-authoritative-tdm/01-03-01-RED.json` passes `check tdd-red-evidence` with `RED_EVIDENCE_OK`.
- Task2 RED reaches an actual connected SDK body: raw NaN produces no observable `invalid_number` reply in the prior room. `.planning/phases/01-two-client-authoritative-tdm/01-03-02-RED.json` passes the same checker. An earlier infrastructure attempt using a non-root-base `dist` build was discarded; the accepted RED uses the isolated production fixture.
- RED tests were committed before production implementation. GREEN task commits pass targeted checks; subsequent full unit and production browser runs pass. No separate refactor was needed.

## Decisions Made

- Preserve the established crouched speed expression, simulation-eye convention, terrain reference and seconds/milliseconds units.
- Keep exact rejection at the room and shared simulation boundary; use transport identity and server tick/receipt clocks only.
- Preserve one-shot edges between messages, while explicit neutral cancels them immediately. On generation change, also retire already consumed held input even if no new message arrives.
- Render authoritative snapshots in this phase. Prediction, cross-device responsiveness, complete match lifecycle and hosting qualifications retain their later owners.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Complete stance-aware terrain and schema companions**
- **Found during:** Task1.
- **Issue:** Extracting movement alone could not safely enter raised slabs or render/replicate crouched bodies.
- **Fix:** Add radius-aware support elevation, height-aware occupancy/body overlap, schema fields and current supported-control notice/context. Update `.gitignore` for generated `.gsd/` output.
- **Files:** `src/shared/world.js`, `server/tdmRoom.js`, `index.html`, `AGENTS.md`, `.gitignore`, alongside task1 files.
- **Verification/commit:** Movement boundary tests, real ramp/walkway/wall/camera assertions; `6ddc82c`.

**2. [Rule 2 - Missing critical functionality] Reuse strict validation and retire held commands**
- **Found during:** Task2 and integration.
- **Issue:** Shared simulation needed the exact protocol contract, consumed-input cleanup on generation changes, and immediate neutral retirement before the legacy lock flag changed.
- **Fix:** Reuse `validateInput`, expose `clearInput`, track room input generations, and force neutral from blur/unlock capture. Handle rejection reasons in a read-only snapshot diagnostic.
- **Files:** `src/shared/tdmSimulation.js`, `server/tdmRoom.js`, `src/network/onlineSession.js`.
- **Verification/commits:** Exact protocol/controlled-clock/real SDK tests plus final unlocked browser assertions; `ffac4d4`, `864114d`.

**3. [Rule 3 - Blocking] Make behavioral transport/browser evidence valid under this runner**
- **Found during:** Task2 RED and browser integration.
- **Issue:** A root-prefix build was required for the SDK fixture. Network bursts can span ticks, and very short key down/up pairs can correctly cancel within one consumed batch. Concurrent external software-WebGL load also caused asset/session waits and snapshot observations to time out.
- **Fix:** Use the isolated actual server for RED; measure real flood displacement by elapsed server ticks and verify exact queue size with a controlled clock. Use ordinary key pulses of at least 100ms and read-only transient observations. Explicitly resume pointer lock before entry fire. Keep enabled-asset/session readiness bounded at 60/30s and total scenarios at 240s. Use test-only DPR 0.25 with unchanged CSS viewports and gameplay bounds.
- **Files:** `server/testHelpers/hostileClient.js`, `server/tdmRoom.test.js`, `tests/multiplayer.spec.js`.
- **Verification/commits:** Final production set all passes, raw SDK tests pass; `4ed6ea2`, `ffac4d4`, `864114d`. Earlier failed runs are timing/infrastructure investigation, not accepted GREEN evidence.

Resolved deviations are recorded as fixed in `.planning/WINDOWS.md` (entries 7–13). Existing open dependency advisories in entry3 remain outside this plan.

## Security Mapping

The scoped input/session checks map to official [OWASP ASVS 5.0.0 requirements](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json):

| Threat | Implemented mitigation and evidence | ASVS 5.0.0 Level1 mapping |
| --- | --- | --- |
| T-01-07 spoofing | Framework session owns its body; raw forged-session test leaves the peer and separate room unchanged | V8.2.2, V8.3.1 |
| T-01-08 tampering | Exact finite/bounded schema, tick age, generations and replay rejection; raw SDK plus exact-boundary tests | V2.2.1, V2.2.2 |
| T-01-09 denial of service | Application byte budget, eight-command queue, 60/s refill, 120 burst, reason codes and real 4008 disconnect; fixed-tick displacement assertion | V2.2.1, V2.2.2 |
| T-01-10 action eligibility | Alive/results, grounded jump, standing clearance and server-dt movement; unit and production wall/stance tests | V8.2.1, V8.3.1 |
| T-01-SC supply chain | Existing exact pins retained; no added installation | Existing approved dependency gate |

This is a scoped mitigation mapping. The plan introduces no additional production network endpoint, auth path, file-access boundary or schema trust boundary beyond its threat register.

## Known Stubs and Deferred Issues

- Scan of changed production and test files found no TODO/FIXME/placeholders, skipped tests or unwired data preventing this plan's goal. Empty owned queues and nullable inactive input are lifecycle state, not UI stubs.
- Existing development-dependency audit findings remain deferred in the cross-phase ledger; no unrelated dependency change was made.
- Human judgment of full pose quality and perceived smoothness remains end-of-phase UAT. No device/FPS/Pi capacity, prediction or impairment qualification is claimed.

## Next Phase Readiness

`stepMovement`, `validateInput`, `createInputGate` and the real hostile helper are available to later plans. Commands include `ackTick`, supported actions and explicit `neutral`; room state includes `currentTick` and body `lastConsumedSeq`/stance flags. `requirements.ready-ids` returns zero ready IDs: NET-01 and NET-03 remain pending until the remaining declaring sibling plans complete.

## Self-Check: PASSED

The SUMMARY, all six new implementation/test/helper files, both accepted RED records, the gameplay screenshot and all five task commits were verified after writing this file. The persisted ledger measures five task commits through `864114d`.
