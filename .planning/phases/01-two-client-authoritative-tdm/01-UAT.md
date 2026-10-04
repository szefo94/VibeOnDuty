---
status: testing
phase: 01-two-client-authoritative-tdm
source: [01-VERIFICATION.md]
started: 2026-10-04T11:21:59.175Z
updated: 2026-10-04T11:21:59.175Z
---

## Current Test

<!-- Review setup is recorded below; no manual test has been pre-approved. -->

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

## Review setup

The parent started the actual requested console command in an attached exec session:

```powershell
npm run mp-server -- --port 2567 --host 0.0.0.0 --tls --public 192.168.0.16
```

Open [the LAN game](https://192.168.0.16:2567) in two ordinary browser windows.
Follow the self-signed testing trust instructions in docs/MULTIPLAYER.md, wait for
Online TDM to become enabled, and click it in each window. The default rules remain
50 kills,600 seconds,3-second respawn,25% friendly damage and15-second rematch.

Owned Node PID35084, exec session99002; ownership/readiness record is in ignored
`.planning/research/.cache/01-review-server.json`. HTTPS health and root game
both returned200; this readiness request trusted only the generated certificate
explicitly and verified its LAN identity. No certificate was installed in the
browser/OS trust store. Actual browser trust and other-device reachability remain
manual tests. The server is intentionally left running for this review; request
its shutdown when finished. No firewall/NAT setting or remote publication changed.
