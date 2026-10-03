---
phase: 01-two-client-authoritative-tdm
plan: "01"
subsystem: testing
tags: [colyseus, node24, playwright, vite, isolation, strict-js]
requires: []
provides:
  - Human-approved exact multiplayer dependency pins and reproducible lockfile
  - Strict boundary checking and server unit-test discovery
  - Isolated production-build server fixture and first real two-browser RED tracer
affects: [01-02, 01-03, 01-06, 01-07]
tech-stack:
  added: ["@colyseus/core 0.18.18", "@colyseus/sdk 0.18.4", "@colyseus/schema 5.0.35", "@colyseus/ws-transport 0.18.4", "express 5.2.1", "selfsigned 5.5.0"]
  patterns: ["Owned OS-temp production builds per fixture", "Argument-array Node child processes", "Strict JSDoc with explicit @ts-check"]
key-files:
  created: [tsconfig.multiplayer.json, playwright.multiplayer.config.js, tests/helpers/mpServer.js, tests/multiplayer.spec.js]
  modified: [package.json, package-lock.json, .github/workflows/test.yml, eslint.config.js, vitest.config.js, playwright.config.js]
key-decisions:
  - "The recorded human approve response satisfies the four exact-release package gate; no replacement releases were installed."
  - "Update only newly production-reachable nanoid to 3.3.19 within the supported range; retain existing primary tooling."
  - "First tracer remains intentionally RED until 01-02 supplies the dedicated server and online entry."
requirements-completed: [NET-01, NET-03, NET-04, MODE-01, HOST-03]
requirements-status: pending-shared-plan-completion
actuals:
  tokens: 22523
  tasks: 3
  commits: 2
plan_head_before: 0f1b2f0b6019affe89163edf0e4dc4829fea18ef
plan_head_after: 27c05d4527eb5da2cd029fb6069fdf4e18e1e8ed
coverage:
  - id: D1
    description: "Approved exact runtime dependency pins and reproducible installation"
    verification:
      - kind: other
        ref: "01-PACKAGE-REVIEW.md#Human approval received"
        status: pass
      - kind: other
        ref: "npm ci; exact package/lock pin assertions; npm audit --omit=dev"
        status: pass
      - kind: unit
        ref: "npm run test:unit: 86 tests in 10 files"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multiplayer build/check scripts and separate nonempty test discovery"
    verification:
      - kind: other
        ref: "npm run build; npm run build:mp; npm run typecheck; npm run typecheck:mp; npm run lint"
        status: pass
      - kind: other
        ref: "tsc --listFilesOnly includes tests/helpers/mpServer.js"
        status: pass
      - kind: other
        ref: "npm run test:mp -- --list: one tracer; offline --list: 17 tests"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e -- tests/smoke.spec.js --workers=1: 8 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Concurrent production fixture isolation and recorded missing-implementation RED"
    verification:
      - kind: integration
        ref: "--list isolation: two simultaneous builds, unchanged dist hash, sibling survival, both roots removed"
        status: pass
      - kind: other
        ref: "Expected RED: tracer exits 1 with MODULE_NOT_FOUND server/index.js; owned PID/temp cleanup verified"
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-10-03
status: complete
---

# Phase 01 Plan 01: Approved Runtime and Production Test Harness Summary

**Exact approved Colyseus packages, Node 24 tooling, isolated production-server fixtures, and a discovered two-browser movement/M4 test awaiting server implementation.**

## Performance

- Duration: approximately 18 minutes, using the recorded approval/continuation timestamp (10:35:33 UTC) to this close-out (10:53:03 UTC); a separate executor-start clock was not captured.
- Completed tasks: 3/3, including the satisfied human approval gate; 2 implementation commits.
- Planned implementation files: 10. Additional planning metadata records evidence, deferred findings, and updated codebase navigation.
- Actual tokens: 90,091 characters / 4, rounded up, over `git diff plan_head_before..plan_head_after`; this uses the realized task diff, not model/harness token usage. Commits are measured from the persisted per-plan ledger before summary/state metadata commits.

## Accomplishments

- Installed all six exact planned dependencies after explicit human approval; `npm ci` reproduces the lockfile. Three 0.160.1, Vite 8.0.8, Vitest 4.1.3, Playwright 1.59.1, and TypeScript 6.0.2 remain locked at their previous versions. Production audit reports zero vulnerabilities.
- Added `mp-server`, `build:mp`, `test:mp`, and `typecheck:mp`; Node engines require `>=24 <25`, test CI uses Node 24, Vitest includes server tests without empty-suite success, and ESLint scopes Node globals to server/helper files. The new lint target tolerates the intentionally absent server directory.
- Added strict multiplayer checking with explicit helper `@ts-check`, preserving unchecked legacy imports. Separate Playwright discovery includes multiplayer/hosting specs and excludes both from the Vite runner. Hosting spec creation remains assigned to 01-06.
- Fixture builds use the tracked Vite entry with root-base assets, unique `vod-mp-` OS-temp roots and explicit server `--build-dir`. Server readiness is bounded to 10 seconds by default; owned child termination precedes checked filesystem cleanup. Optional TLS/public/rules settings travel through the helper and operator process arguments.
- The first scenario creates two independent contexts, waits for enabled entry, observes distinct sessions in the same room/map and rendered remote counts, tests replicated movement from real keys, walks around existing bunker cover, and fires one M4 shot. Assertions cover authoritative target health, one consumed round, private confirmation, crosshair marker, and shooter-only damage text. Its game assertions are authored, not yet proven GREEN.

## Task Commits

1. **01-01-01: Exact release approval** — satisfied by the direct human `approve` response, retained in `01-PACKAGE-REVIEW.md`; no implementation files or standalone task commit were required.
2. **01-01-02: Approved runtime and discovery** — `af30e03` (`chore`).
3. **01-01-03: Production harness and RED browser tracer** — `27c05d4` (`test`).

Summary/evidence metadata is committed before sequential STATE/ROADMAP updates; final metadata commits are reported by the executor separately.

## Verification Results

| Check | Observed result |
| --- | --- |
| `npm ci` | Passed after exact pins and the transitive security fix |
| `npm run test:unit` | 86 passed, 10 files; nonempty collection |
| `npm run build` | Passed; built index exists; existing large-chunk warning |
| `npm run build:mp` | Passed; built index/assets use `/`, not `/VibeOnDuty/` |
| `npm run typecheck` / `npm run typecheck:mp` | Passed; list-files proof includes helper |
| `npm run lint` | Passed, zero warnings |
| `npm run test:mp -- --list` | One tracer discovered; concurrent isolation check passed |
| Offline `--list` | 17 tests in 3 files; no MP/hosting specs selected |
| Offline smoke execution | 8 passed in 10.9 seconds |
| `npm audit --omit=dev` | Zero vulnerabilities |
| Root/branch assertions, `git diff --check` | Passed; configured default-branch exception was verified before commits |

## Intentional RED Evidence

`npm run test:mp -- --grep 'tracer: two browsers join and move'` collected exactly one test and exited **1**. The final run failed in **787 ms** during fixture readiness with **MODULE_NOT_FOUND: C:\Programowanie\VibeOnDuty\server\index.js**. The fixture stopped owned PID **20672** and removed `C:\Users\Marcin\AppData\Local\Temp\vod-mp-kBZI3c`; subsequent native process/file checks confirmed both absent. This is the missing implementation deliberately assigned to 01-02, not a browser/gameplay pass or an empty-suite result. Chromium was installed through the tracked Playwright CLI after an initial launch exposed missing binaries; that infrastructure failure is not the claimed RED evidence.

Discovery executed simultaneous builds at `vod-mp-2a56Tu` and `vod-mp-KCvQAW`. Distinct roots, full repository `dist` fingerprint equality, readable sibling index after first-root cleanup, and final absence of both roots all passed. No fixture uses repository dist; only normal `--build-only` does.

## Decisions Made

The exact human-approved versions govern installation. Build output and process ownership belong to each fixture. The browser scenario observes frozen snapshots and ordinary input; no server implementation, debug state setter, or mutation endpoint was introduced here. Shared Phase 1 requirements remain pending until all sibling plans declaring them finish.

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Updated newly production-reachable nanoid.**
- Found during 01-01-02: retained nanoid 3.3.11 previously belonged to development tooling, but new Colyseus core also depends on it, causing a high runtime npm audit finding.
- Updated only this transitive to 3.3.19 within core's `^3.3.11` range. The six approved direct pins and primary tooling versions remain unchanged.
- Verified `npm ci`, 86 units, production build and clean production audit. File: `package-lock.json`; commit: `af30e03`. Broken-windows entry 1 is fixed.

**2. [Rule 3 - Blocking] Accommodated the planned absent server directory in lint.**
- Added `--no-error-on-unmatched-pattern` while retaining lint targets and zero-warning enforcement, so prerequisite tooling can run before server files exist. File: `package.json`; commit: `af30e03`.

The orchestrator resolved the sequential-main commit guard by setting `git.allow_default_branch_commits=true` under the existing execution authorization. This override and direct package approval are preserved in metadata; the orchestrator owns restoration after phase completion. No remote push occurred.

## Deferred Issues

Retained development dependencies have six npm audit findings (three moderate, three high), already present at baseline; they were not broadly upgraded against the explicit tooling-retention plan. Full details and unchanged deployment assembly Node 20 are recorded in `deferred-items.md`; broken-windows entry 3 remains open. Entry 2 tracks intentional tracer RED for 01-02 to close after genuine GREEN. No task verification was skipped or represented as gameplay completion.

## Known Stubs

No placeholder production implementation was added. `server/index.js`, online entry and `window.__mpDebug()` are intentionally absent until 01-02; `hosting.spec.js` belongs to 01-06. The current build/check/discovery goals are complete, while multiplayer gameplay is unimplemented and unverified.

## User Setup Required

None for this plan. Required Chromium was installed automatically.

## Next Phase Readiness

Ready for 01-02: implement the actual server, room/simulation and online entry, then make this production-browser tracer GREEN before expansion. The test expects players with `sessionId,x,y,z,yaw,pitch,health,ammo`, root `remoteActorCount`, and private `lastConfirmedHit` with `targetSessionId,damage,impact`. Full gameplay/visual/TLS trust/capacity acceptance remains later work.

## Self-Check: PASSED

All four created artifact paths and both task commits exist. Exact pins, targeted checks, nonempty discovery, intentional missing-server failure, process/temp cleanup, and scoped root/branch guards were verified. No accidental tracked deletions were introduced.
