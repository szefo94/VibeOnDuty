---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 5
total_count: 6
last_updated: 2026-10-03T14:39:56.775Z
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
  }
]
````
