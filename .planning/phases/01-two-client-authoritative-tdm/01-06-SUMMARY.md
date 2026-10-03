---
phase: 01-two-client-authoritative-tdm
plan: "06"
subsystem: hosting
tags: [node24, colyseus, express, selfsigned, tls, windows-acl, playwright]
requires:
  - phase: 01-02
    provides: Same-origin room, root-base production host and owned OS-temp fixture
provides:
  - Validated operator bind, port, advertised URL, build directory and rule configuration
  - Restricted automatically generated and reused self-signed HTTPS/WSS certificate pairs
  - Real two-browser same-link TLS acceptance and documented manual trust procedure
affects: [01-04, 01-05, 01-07, phase-02]
tech-stack:
  added: []
  patterns: [Atomic cert-key manifest, serialized certificate publication, actual Windows ACL verification, Origin-gated upgrade]
key-files:
  created: [server/cli.js, server/cli.test.js, server/hosting.test.js, server/tls.js, server/tls.test.js, tests/hosting.spec.js, docs/MULTIPLAYER.md]
  modified: [server/index.js, server/tdmRoom.js, tests/helpers/mpServer.js, .gitignore, AGENTS.md]
key-decisions:
  - "Publish certificate and private key together in one restricted atomic pair.json manifest; never expose PEM through the static root or error causes."
  - "Advertised URL controls operator output, SAN and approved Origin; browser transport continues using its page origin, including proxy topology."
  - "Operator definition settings override browser join options; current simulation consumes match time/friendly damage while full lifecycle remains 01-05."
requirements-completed: [HOST-03, NET-01]
requirements-status: pending-shared-plan-completion
actuals:
  tokens: 16501
  tasks: 3
  commits: 6
plan_head_before: 67ee0fd58a25921b2dbc2fc053f7492833ad6006
plan_head_after: 9ef5857b404508926eb29709695cb9c151a4ca34
coverage:
  - id: D1
    description: Exact console flags configure real built-game hosting with bounded errors and private-path denial
    requirement: HOST-03
    verification:
      - kind: integration
        ref: "server/cli.test.js: 21 subprocess/parser/rule tests; server/hosting.test.js: 15 actual host tests"
        status: pass
      - kind: other
        ref: "npm run typecheck; npm run typecheck:mp; npm run lint"
        status: pass
    human_judgment: false
  - id: D2
    description: Matching DNS/IP certificate pairs are generated, restricted, reused and safely replaced
    requirement: HOST-03
    verification:
      - kind: integration
        ref: "server/tls.test.js: 8 tests; DNS/IPv4/IPv6 SAN, key/date, bytes/mtime, replacement, failed publication, concurrent writers, actual Windows ACL"
        status: pass
      - kind: integration
        ref: "server/hosting.test.js#uses a trusted matching certificate for HTTPS assets and reuses the pair across restart"
        status: pass
    human_judgment: false
  - id: D3
    description: Two built browsers load real GLB/assets and join one WSS room on the HTTPS page origin
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "tests/hosting.spec.js: 2 passed standalone in 12.5s; full production set 5 passed in 1.7m"
        status: pass
      - kind: integration
        ref: "server/hosting.test.js#permits configured proxy Origin over private HTTP and rejects a foreign real join"
        status: pass
    human_judgment: false
  - id: D4
    description: Actual self-signed LAN trust in two windows and gesture-driven pointer lock are usable
    verification: []
    human_judgment: true
    rationale: "Automated ignoreHTTPSErrors proves TLS/WSS integration only. Actual two-window trust and join/resume pointer lock remain pending at phase end, recorded in WINDOWS entry17."
duration: 31min
started: 2026-10-03T16:32:34.399Z
completed: 2026-10-03
status: complete
---

# Phase 01 Plan 06: Console Hosting and Protected Testing TLS Summary

**Validated console hosting serves real built assets and Origin-gated rooms through one HTTP/HTTPS link, with automatic matching SAN certificates and verified restricted Windows storage.**

## Performance

- Duration: approximately 31 minutes from the first behavioral RED run at 16:32:34 UTC through close-out at 17:03 UTC; initial mandatory context loading is excluded because no separate start clock was captured.
- Tasks: 3/3. Task diff: 14 files, including two RED evidence records, the typed room bridge and AGENTS context. Four codebase maps and the defect ledger are additional completion documentation.
- Actuals: exactly 66,001 characters in `git diff plan_head_before..plan_head_after`, divided by four and rounded up. Six task commits are measured from the persisted ledger before SUMMARY/state documentation commits.

## Accomplishments

- `parseArgs`, `validateAdvertisedAddress` and `loadRoomSettings` implement the exact command, help, port/bind/public/build/rules defaults and corrective errors. Public URL rejects credentials, wildcard destinations, whitespace/backslashes, raw query/fragment delimiters and normalized non-root paths. IPv6 links are bracketed. Explicit external HTTPS without direct TLS describes proxy termination; it never redirects the browser.
- Default build serving resolves repository `dist` independently of caller cwd. Explicit fixture builds remain isolated OS-temp outputs. Static validation checks root-base asset references and actual asset files, rejects source/secret roots, symlinks and copied key/certificate files, and serves no repository fallback. Health is minimal; absent/foreign WebSocket Origins are rejected before framework preflight/handshake, while actual listen and configured advertised Origins work.
- `loadOrCreateCertificate` generates async SHA-256 certificates with 30-day validity and explicit DNS/IPv4/IPv6 SAN, verifies identity/date/private-key matching and self-signature, and reuses valid bytes/mtime. Changed identity, corrupt JSON, mismatched key and expiry within24h regenerate. A locked, validated temp manifest is atomically renamed, publishing key/cert together. A failed rename leaves the old active manifest unchanged.
- TLS storage has owner-only POSIX modes or current-user/SYSTEM/Administrators Windows ACL. Argument-array `icacls` removes inherited/broad grants; PowerShell inspects actual SID grants and denies unsafe access. Files and inspected causes/logs disclose no PEM. Fixtures keep TLS storage private in their owned temp root, restart only their owned child and remove the root after shutdown.
- Two production browser contexts fetch real GLB/built assets, observe different sessions and current rigs in the same WSS room, and assert the endpoint matches the HTTPS page host. A separate restart scenario verifies unchanged pair bytes/mtime and a working WSS join after restart. Operator docs cover trust, supported actions, rule bounds, reverse proxies and unmeasured device/Pi/capacity/FPS limits.

## Task Commits

1. Task1 RED: `5f15898` — operator CLI and host boundary tests.
2. Task1 GREEN: `7298a8d` — validated CLI and confined built-game hosting.
3. Task2 RED: `933de31` — running TLS startup must create a private active pair.
4. Task2 GREEN: `3d1abbc` — automatic protected TLS reuse, trusted-CA host tests, typed operator room bridge and owned fixture restart/storage.
5. Integration correction: `0785b1e` — numeric room contract preserves both strict/server and legacy/browser checks; reject raw normalized public URL edge cases.
6. Task3: `9ef5857` — actual HTTPS/WSS browser spec, proxy/foreign join checks, operator docs and AGENTS context.

Normal hooks and supplied-root/HEAD guards ran before every commit under the parent-authorized temporary default-branch override. No packages were installed, no push occurred and no tracked files were deleted. Completion metadata is committed separately.

## Verification Results

| Command/check | Latest actual result |
| --- | --- |
| Task1 CLI/HTTP checks | 29 passed before task1 GREEN; later expansion covered by full suite |
| `npm run test:unit -- server/tls.test.js server/hosting.test.js` | Task2 22 passed, then hosting expanded to15 tests |
| `npm run test:unit -- server/hosting.test.js` | 15 passed in19.61s, including real proxy-approved/foreign-denied join |
| `npm run test:unit -- server/cli.test.js` | 21 passed in8.25s, including raw URI normalization edges |
| Final `npm run test:unit` | 176 passed in17 files,33.66s |
| `npm run typecheck` / `npm run typecheck:mp` | Both exit0; new boundaries explicitly checked, no new suppressions retained |
| `npm run lint` | Exit0, zero warnings |
| `npm run build` / `npm run build:mp` | Both exit0; existing large-bundle advisory only |
| `npm run test:mp -- --grep 'tracer:'` | Task1 production tracer passed44.9s, total45.8s |
| `npm run test:mp -- --grep 'hosting:'` | 2 passed in12.5s; scenarios6.2s/5.4s |
| Full `npm run test:mp` | 5 passed in1.7m: HTTPS6.2s/restart5.5s/tracer46.8s/movement29.7s/entry13.6s |
| `npm run test:e2e -- --workers=1` | 17 offline regressions passed in47.0s |
| Root guard, `git diff --check`, task deletions | Passed; no deletions |

The HTTPS integration test uses Node requests trusting the generated certificate as the CA, preserving identity verification. Browser acceptance explicitly uses `ignoreHTTPSErrors` for the self-signed test pair. IPv6 SAN is verified without assuming an IPv6 listener. Actual Windows ACL checks and deliberate broad-ACL rejection ran on this Windows host; POSIX mode logic is present but was not executed on another OS.

Latest production fixtures used independent temp builds `vod-mp-JN3LxA`, `vod-mp-zInF9N`, `vod-mp-s1RODb`, `vod-mp-D0ExGn`, `vod-mp-KKuvuy`; owned server PIDs33840/3136/28112/27384/22928/30512 were absent after teardown. The two standalone hosting fixture PIDs29620/26592/30980 also exited. Unrelated browser processes were preserved.

## TDD Gate Compliance

- Task1 reaches a real subprocess assertion: `--help` exits1 instead of0. `01-06-01-RED.json` returns `RED_EVIDENCE_OK`; its24-test run collected8 failures. GREEN precedes task2 production work and the real M4 tracer passed.
- Task2 reaches a running CLI/listener assertion: no private active `pair.json` exists. `01-06-02-RED.json` returns `RED_EVIDENCE_OK`; no missing-module or failed-fixture exit is claimed as RED. GREEN includes real SAN/key/ACL and trusted-CA checks.
- Phase-wide additional MVP/TDD mode is disabled. No skipped tests or unrun automated task verification remain; refactoring required no separate refactor-only commit.

## Decisions Made

One atomic operational manifest is simpler and safer than publishing two independently renamed active files. The advertised link controls SAN/output/Origin, while the browser retains reachable page-origin transport. Definition options override browser settings in pinned Colyseus; the typed room bridge maps `friendlyFire` to existing simulation `friendlyDamage` and applies `matchSeconds`. Current simulation does not yet implement complete kill-limit, respawn, results or rematch lifecycle: that remains01-05, whose settings bounds are preserved. This is not claimed as full match completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule2 - Missing critical functionality] Typed room settings and browser type-graph bridge.**
- Found during hosting integration: the zero-argument room could not accept checked operator definition settings. A temporary new-boundary suppression was removed after parent review.
- Added a typed numeric `onCreate` bridge in `server/tdmRoom.js`, outside this plan's original task file list, and applied existing simulation time/friendly-damage settings. Kept the contract self-contained so browser state-type imports do not load filesystem CLI code into the legacy type graph.
- Verified actual hostile join options cannot override configured match time, and both typecheck modes plus full room/unit/browser suites pass. Commits: `3d1abbc`, `0785b1e`; fixed WINDOWS entry15.

**2. [Rule3 - Blocking] Windows ACL query environment.**
- PowerShell7's inherited module path cannot be used by Windows PowerShell5.1. Vitest child environment also retained case aliases, causing the ACL query to fail finitely.
- Remove all inherited case aliases and supply the Windows5.1 system module path with terminating errors; inspect actual ACLs after argument-array `icacls`, never substitute chmod.
- TLS tests pass real SID/inheritance/grant checks and broad-access rejection. File: `server/tls.js`; commit: `3d1abbc`; fixed WINDOWS entry14. A compound temporary PowerShell diagnostic/cleanup was automatically rejected; a smaller read-only diagnostic and native owned cleanup resolved it without bypassing approval review.

**3. [Rule2 - Missing critical functionality] Complete private serving/error/fixture boundaries.**
- Source-root validation alone would permit copied key files or symlinks in a nominal build. Raw exception causes could reveal private parser/generator contents. TLS fixtures also needed private storage/restart earlier than task3 to verify real HTTPS safely.
- Validate static tree entries, sanitize both outward TLS messages and inspected causes, and extend the owned helper with temp TLS storage/restart. Test failed publication, deliberate broad ACL and private routes.
- Files: `server/index.js`, `server/tls.js`, `tests/helpers/mpServer.js`, hosting/TLS tests; commit: `3d1abbc`; fixed WINDOWS entry16.

All deviations preserve the planned architecture. No new runtime dependency or public mutation/auth endpoint was introduced. Context maps record the shipped hosting modules. Earlier test failures from incorrect test response-shape assumptions and inherited Windows module paths were corrected and are not represented as passing verification.

## Security and Threat Review

T-01-19 is covered by confined root/tree validation, dotfile404 and private-path content assertions. T-01-20 uses SAN/date/key/self-signature validation and regeneration tests. T-01-21 uses ignored restricted atomic storage, failed-publication and no-PEM cause/log checks. T-01-22 uses strict public URL parsing and actual allowed/rejected upgrade/SDK joins. T-01-23 has bounded startup, occupied-port/unresolved-host failure, owned restart and shutdown. T-01-24 remains the expressly accepted self-signed testing trust model. Exact approved dependencies are unchanged (T-01-SC). No unregistered security surface was added beyond these planned filesystem/HTTP/TLS boundaries.

## Pending Human Acceptance and Deferred Issues

- Phase-end human check: launch the documented self-signed LAN link, establish trust in two actual browser windows, then click join/resume and verify usable pointer lock, aim, movement and fire. This remains explicitly pending; WINDOWS entry17 is open. Remaining phase plans proceed before that consolidated check.
- HOST-03's descriptor-less/unclassified generic probe supplied no further predicate. Known console/TLS acceptance is covered; that generic assumption is not claimed independently verified.
- Existing development dependency advisories remain the unrelated open WINDOWS entry3. No device/Pi/slots/FPS or perceived-smoothness benchmark is claimed.
- Stub scan found no TODO/FIXME/placeholder, skipped tests or unwired data blocking this hosting goal. Empty queues/collections and optional test settings are owned runtime values.

## Next Phase Readiness

01-06 hosting is ready for remaining combat/lifecycle/presentation plans. Shared HOST-03 and NET-01 still have no ready requirement IDs, so no requirement was marked globally complete. `docs/MULTIPLAYER.md` names the remaining lifecycle dependency and concrete manual trust steps. Operator certificate issuance/renewal and full proxy infrastructure remain out of scope.

## Self-Check: PASSED

All seven created implementation/test/docs artifacts, both accepted RED records and this SUMMARY exist. All six recorded task commits resolve. The persisted ledger measures six commits through `9ef5857`; the final full unit/browser checks are nonempty and passed. No task commit deletes tracked files.
