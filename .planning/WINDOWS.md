---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 1
total_count: 3
last_updated: 2026-10-03T10:51:32.410Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | package-lock.json |  | Newly production-reachable nanoid updated from 3.3.11 to 3.3.19; runtime npm audit clean. | fixed |  | 2026-10-03T10:51:06.730Z | 2026-10-03T10:51:32.009Z |
| 2 | 01 | unmet-truth | tests/multiplayer.spec.js | 36 | Intentional tracer RED: dedicated server/online entry implementation deferred to 01-02. | open |  | 2026-10-03T10:51:07.145Z |  |
| 3 | 01 | deviation | package-lock.json |  | Retained pre-existing development dependency audit findings: three moderate and three high; separate maintenance required. | open |  | 2026-10-03T10:51:32.410Z |  |

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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-03T10:51:07.145Z",
    "resolved_at": null,
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
  }
]
````
