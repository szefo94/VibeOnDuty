---
status: testing
phase: 01-two-client-authoritative-tdm
source: [01-VERIFICATION.md]
started: 2026-10-04T11:21:59.175Z
updated: 2026-10-04T11:21:59.175Z
---

## Current Test

number: 1
name: Open the operator's actual advertised LAN TLS link in two ordinary browser windows, complete certificate trust, and click Online TDM/Resume.
expected: |
  Both windows join the same room; each can obtain mouse capture through its own gesture, aim, move and fire; Escape releases input while snapshots and the match continue; Resume recovers without a false connection error.
awaiting: user response

## Tests

### 1. Open the operator's actual advertised LAN TLS link in two ordinary browser windows, complete certificate trust, and click Online TDM/Resume.
expected: Both windows join the same room; each can obtain mouse capture through its own gesture, aim, move and fire; Escape releases input while snapshots and the match continue; Resume recovers without a false connection error.
result: [pending]

### 2. Play a full two-window TDM session at normal display resolution, including deaths, respawns, results, rematch and Retry/Return.
expected: Current map, armed rigs and motion are readable; only the shooter sees the confirmed crosshair/impact feedback; health, teams, personal kills, scores and winner agree; ammo remains visible; respawn/results timers and Resume/Leave/Retry/Return are usable.
result: [pending]

### 3. Resolve the unclassified HOST-03 probe retained by plan 01-06.
expected: The human either records the missing acceptance predicate and its evidence, or explicitly acknowledges that no additional predicate was supplied beyond the documented CLI/TLS contract.
result: [pending]

### 4. Resolve the unclassified MODE-01 probe retained by plan 01-07.
expected: The human either records the missing acceptance predicate and its evidence, or explicitly acknowledges that no additional predicate was supplied beyond the explicit team/life/results contract.
result: [pending]

### 5. Review Phase 1 UI and docs/MULTIPLAYER.md against the unmeasured-capacity prohibition.
expected: Two-human admission is described as an acceptance-slice cap; no slot capacity, Raspberry Pi performance or 60 FPS result is presented as qualified.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

No user test outcomes have been supplied. Undefined probe predicates are not invented.
