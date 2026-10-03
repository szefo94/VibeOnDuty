---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 18
total_count: 20
last_updated: 2026-10-03T19:49:23.780Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | package-lock.json |  | Newly production-reachable nanoid updated from 3.3.11 to 3.3.19; runtime npm audit clean. | fixed |  | 2026-10-03T10:51:06.730Z | 2026-10-03T10:51:32.009Z |
| 2 | 01 | unmet-truth | tests/multiplayer.spec.js | 36 | Intentional tracer RED: dedicated server/online entry implementation deferred to 01-02. | fixed |  | 2026-10-03T10:51:07.145Z | 2026-10-03T14:39:02.880Z |
| 3 | 01 | deviation | package-lock.json |  | Retained pre-existing development dependency audit findings: three moderate and three high; separate maintenance required. | open |  | 2026-10-03T10:51:32.410Z |  |
| 4 | 01 | deviation | src/entities/drone.js |  | Online entry/exit now cancels delayed offline drone spawns and melee actions; unsupported touch/gamepad actions are guarded for the keyboard/mouse slice. | fixed |  | 2026-10-03T14:39:28.424Z | 2026-10-03T14:39:40.890Z |
| 5 | 01 | deviation | server/tdmRoom.js |  | Task2 also switched room imports to the canonical data-only map, removing the rendering dependency required for a headless room. | fixed |  | 2026-10-03T14:39:41.673Z | 2026-10-03T14:39:54.989Z |
| 6 | 01 | deviation | tests/multiplayer.spec.js |  | Replaced missing-server infrastructure RED with a running-server missing-entry assertion; bounded aim correction uses normal mouse input while retaining the strict replicated-yaw assertion. | fixed |  | 2026-10-03T14:39:55.860Z | 2026-10-03T14:39:56.775Z |
| 7 | 01 | deviation | src/shared/world.js |  | Movement also required radius support, stance-aware collision and replicated schema fields; production ramp/camera scenario passes. | fixed |  | 2026-10-03T15:38:09.937Z | 2026-10-03T15:38:37.592Z |
| 8 | 01 | deviation | tests/multiplayer.spec.js |  | Ordinary-key pulses and read-only transient observers stabilize production movement checks while retaining terrain, camera and wall bounds. | fixed |  | 2026-10-03T15:38:13.758Z | 2026-10-03T15:38:38.541Z |
| 9 | 01 | deviation | src/shared/tdmSimulation.js |  | Shared simulation uses the exact room validator and held-input clearing; real SDK flood/identity isolation and browser movement pass. | fixed |  | 2026-10-03T15:38:17.358Z | 2026-10-03T15:38:39.574Z |
| 10 | 01 | deviation | server/tdmRoom.test.js |  | Real SDK RED requires isolated root-base fixture; network flood displacement is measured by elapsed ticks, exact queue behavior uses controlled clock. | fixed |  | 2026-10-03T15:38:22.012Z | 2026-10-03T15:38:40.663Z |
| 11 | 01 | deviation | src/network/onlineSession.js |  | Read-only rejected-input and pointer-lock diagnostics expose hardened transport decisions; production tracer passes without weakening the strict movement route. | fixed |  | 2026-10-03T15:46:24.565Z | 2026-10-03T15:46:32.181Z |
| 12 | 01 | deviation | src/network/onlineSession.js |  | Blur and pointer-unlock capture send explicit forced neutral before the legacy locked binding changes, cancelling retained action edges immediately. | fixed |  | 2026-10-03T16:09:42.226Z | 2026-10-03T16:09:43.616Z |
| 13 | 01 | deviation | tests/multiplayer.spec.js |  | Under concurrent external software-WebGL load, keep enabled-asset/session waits bounded at60/30s and use test-only DPR0.25 with unchanged CSS viewport/gameplay assertions; hardened movement passes28.7s. | fixed |  | 2026-10-03T16:13:17.104Z | 2026-10-03T16:13:17.964Z |
| 14 | 01 | deviation | server/tls.js |  | Atomic cert-key manifest and actual Windows ACL verification protect TLS storage; remove inherited PowerShell7 module-path case aliases before the 5.1 ACL query. | fixed |  | 2026-10-03T16:58:27.808Z | 2026-10-03T17:01:37.455Z |
| 15 | 01 | deviation | server/tdmRoom.js |  | Typed onCreate bridge applies validated operator match time and friendly damage without importing Node CLI types into the browser graph; complete lifecycle remains 01-05. | fixed |  | 2026-10-03T17:01:37.869Z | 2026-10-03T17:01:38.289Z |
| 16 | 01 | deviation | server/index.js |  | Validate static tree for symlinks and copied secret files; sanitize TLS error causes and give TLS fixtures private owned storage before browser acceptance. | fixed |  | 2026-10-03T17:01:38.724Z | 2026-10-03T17:01:39.145Z |
| 17 | 01 | unrun-verify | docs/MULTIPLAYER.md |  | Phase-end human check of actual self-signed LAN trust in two browser windows and gesture-driven pointer lock remains pending; automated HTTPS bypass proves transport only. | open |  | 2026-10-03T17:01:39.601Z |  |
| 18 | 01 | deviation | src/combat/damage.js |  | The source damage helper was grenade-only; added pure online M4 body/head helper preserving authoritative base28 and training head multiplier4 without invented range falloff or ADS spread. | fixed |  | 2026-10-03T19:48:37.766Z | 2026-10-03T19:49:22.910Z |
| 19 | 01 | deviation | server/tdmRoom.js |  | Combat also required explicit float64 health, validated operator-only seeded room RNG, and coordinated hit-confirmed listener to retain fractional outcomes and deterministic production browser proof. | fixed |  | 2026-10-03T19:48:38.176Z | 2026-10-03T19:49:23.359Z |
| 20 | 01 | deviation | tests/multiplayer.spec.js |  | Test-only bundled offline-emitter instrumentation proves actual legacy outcome events cannot award server state; real pointer aim reset and negative damage-text expectation corrected fixture errors. | fixed |  | 2026-10-03T19:48:38.573Z | 2026-10-03T19:49:23.780Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "package-lock.json",
    "line": null,
    "description": "Newly production-reachable nanoid updated from 3.3.11 to 3.3.19; runtime npm audit clean.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T10:51:06.730Z",
    "resolved_at": "2026-10-03T10:51:32.009Z",
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unmet-truth",
    "phase": "01",
    "file": "tests/multiplayer.spec.js",
    "line": 36,
    "description": "Intentional tracer RED: dedicated server/online entry implementation deferred to 01-02.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T10:51:07.145Z",
    "resolved_at": "2026-10-03T14:39:02.880Z",
    "milestone": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "01",
    "file": "package-lock.json",
    "line": null,
    "description": "Retained pre-existing development dependency audit findings: three moderate and three high; separate maintenance required.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-03T10:51:32.410Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "src/entities/drone.js",
    "line": null,
    "description": "Online entry/exit now cancels delayed offline drone spawns and melee actions; unsupported touch/gamepad actions are guarded for the keyboard/mouse slice.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T14:39:28.424Z",
    "resolved_at": "2026-10-03T14:39:40.890Z",
    "milestone": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "01",
    "file": "server/tdmRoom.js",
    "line": null,
    "description": "Task2 also switched room imports to the canonical data-only map, removing the rendering dependency required for a headless room.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T14:39:41.673Z",
    "resolved_at": "2026-10-03T14:39:54.989Z",
    "milestone": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "01",
    "file": "tests/multiplayer.spec.js",
    "line": null,
    "description": "Replaced missing-server infrastructure RED with a running-server missing-entry assertion; bounded aim correction uses normal mouse input while retaining the strict replicated-yaw assertion.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T14:39:55.860Z",
    "resolved_at": "2026-10-03T14:39:56.775Z",
    "milestone": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "01",
    "file": "src/shared/world.js",
    "line": null,
    "description": "Movement also required radius support, stance-aware collision and replicated schema fields; production ramp/camera scenario passes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T15:38:09.937Z",
    "resolved_at": "2026-10-03T15:38:37.592Z",
    "milestone": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "01",
    "file": "tests/multiplayer.spec.js",
    "line": null,
    "description": "Ordinary-key pulses and read-only transient observers stabilize production movement checks while retaining terrain, camera and wall bounds.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T15:38:13.758Z",
    "resolved_at": "2026-10-03T15:38:38.541Z",
    "milestone": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "01",
    "file": "src/shared/tdmSimulation.js",
    "line": null,
    "description": "Shared simulation uses the exact room validator and held-input clearing; real SDK flood/identity isolation and browser movement pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T15:38:17.358Z",
    "resolved_at": "2026-10-03T15:38:39.574Z",
    "milestone": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "01",
    "file": "server/tdmRoom.test.js",
    "line": null,
    "description": "Real SDK RED requires isolated root-base fixture; network flood displacement is measured by elapsed ticks, exact queue behavior uses controlled clock.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T15:38:22.012Z",
    "resolved_at": "2026-10-03T15:38:40.663Z",
    "milestone": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "01",
    "file": "src/network/onlineSession.js",
    "line": null,
    "description": "Read-only rejected-input and pointer-lock diagnostics expose hardened transport decisions; production tracer passes without weakening the strict movement route.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T15:46:24.565Z",
    "resolved_at": "2026-10-03T15:46:32.181Z",
    "milestone": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "01",
    "file": "src/network/onlineSession.js",
    "line": null,
    "description": "Blur and pointer-unlock capture send explicit forced neutral before the legacy locked binding changes, cancelling retained action edges immediately.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T16:09:42.226Z",
    "resolved_at": "2026-10-03T16:09:43.616Z",
    "milestone": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "01",
    "file": "tests/multiplayer.spec.js",
    "line": null,
    "description": "Under concurrent external software-WebGL load, keep enabled-asset/session waits bounded at60/30s and use test-only DPR0.25 with unchanged CSS viewport/gameplay assertions; hardened movement passes28.7s.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T16:13:17.104Z",
    "resolved_at": "2026-10-03T16:13:17.964Z",
    "milestone": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "01",
    "file": "server/tls.js",
    "line": null,
    "description": "Atomic cert-key manifest and actual Windows ACL verification protect TLS storage; remove inherited PowerShell7 module-path case aliases before the 5.1 ACL query.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T16:58:27.808Z",
    "resolved_at": "2026-10-03T17:01:37.455Z",
    "milestone": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "01",
    "file": "server/tdmRoom.js",
    "line": null,
    "description": "Typed onCreate bridge applies validated operator match time and friendly damage without importing Node CLI types into the browser graph; complete lifecycle remains 01-05.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T17:01:37.869Z",
    "resolved_at": "2026-10-03T17:01:38.289Z",
    "milestone": null
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "01",
    "file": "server/index.js",
    "line": null,
    "description": "Validate static tree for symlinks and copied secret files; sanitize TLS error causes and give TLS fixtures private owned storage before browser acceptance.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T17:01:38.724Z",
    "resolved_at": "2026-10-03T17:01:39.145Z",
    "milestone": null
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "docs/MULTIPLAYER.md",
    "line": null,
    "description": "Phase-end human check of actual self-signed LAN trust in two browser windows and gesture-driven pointer lock remains pending; automated HTTPS bypass proves transport only.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-03T17:01:39.601Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "01",
    "file": "src/combat/damage.js",
    "line": null,
    "description": "The source damage helper was grenade-only; added pure online M4 body/head helper preserving authoritative base28 and training head multiplier4 without invented range falloff or ADS spread.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T19:48:37.766Z",
    "resolved_at": "2026-10-03T19:49:22.910Z",
    "milestone": null
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "01",
    "file": "server/tdmRoom.js",
    "line": null,
    "description": "Combat also required explicit float64 health, validated operator-only seeded room RNG, and coordinated hit-confirmed listener to retain fractional outcomes and deterministic production browser proof.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T19:48:38.176Z",
    "resolved_at": "2026-10-03T19:49:23.359Z",
    "milestone": null
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "01",
    "file": "tests/multiplayer.spec.js",
    "line": null,
    "description": "Test-only bundled offline-emitter instrumentation proves actual legacy outcome events cannot award server state; real pointer aim reset and negative damage-text expectation corrected fixture errors.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-03T19:48:38.573Z",
    "resolved_at": "2026-10-03T19:49:23.780Z",
    "milestone": null
  }
]
````
