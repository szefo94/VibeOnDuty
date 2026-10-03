---
phase: "01"
slug: "two-client-authoritative-tdm"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-03"
---

# Phase 1 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Existing Vitest 4.1.3 and Playwright 1.59.1; retain repository versions |
| Config files | `vitest.config.js`, `playwright.config.js`, planned `playwright.multiplayer.config.js`, `tsconfig.multiplayer.json`; concrete creation in 01-01 |
| Quick command | `npm run test:unit -- src/shared/ server/` after 01-01 discovery and relevant test creation |
| Full suite | `npm run lint`, `npm run typecheck`, `npm run typecheck:mp`, `npm run build`, `npm run test:unit`, `npm run test:e2e`, `npm run build:mp`, `npm run test:mp` |
| Estimated runtime | Quick target <30 seconds; full browser/runtime duration must be measured during execution |

Do not accept an empty test selection as passing. Quick commands are planned infrastructure, not commands already validated. New boundary code must enter lint and meaningful JavaScript/type checking; existing `checkJs: false` is not proof of authority correctness.

## Sampling Rate

- After each task commit: run the task's narrow deterministic behavioral checks.
- After each wave: run affected shared/server integration and offline regression checks.
- Before phase completion: all full-suite checks above, the production-build two-browser multiplayer suite, and CLI/TLS integration pass.
- Maximum feedback latency target: 30 seconds for deterministic tests; explicit longer browser timeouts with measured durations.
- Every runnable `<automated>` command needs a following `<fails_when>` observable failure signal. No watch flags or success from zero matching tests.

## Behavior Verification Map

The final seven PLAN files define this concrete map. All rows remain pending; commands for new scripts/files become runnable only after their specified creation tasks. Each PLAN command has an immediately following fails_when; nonzero exit and zero discovered tests are failure signals. A checkpoint approval is separate from package metadata checks.

| Task ID | Wave | Requirement | Threat Ref | Behavior / planned command | Test availability | Status |
| --- | --- | --- | --- | --- | --- | --- |
|01-01-01|1|NET-01,HOST-03|T-01-01,T-01-SC|Exact npm metadata for four flagged versions, then blocking human approval before install|Registry check; human checkpoint|pending|
|01-01-02|1|NET-01,NET-03,NET-04,MODE-01,HOST-03|T-01-01,T-01-SC|`npm run test:unit`; `npm run build`; approved pins/Node24/discovery|Existing suite after npm ci|pending|
|01-01-03|1|NET-01,HOST-03|T-01-02|`npm run build:mp`; `npm run typecheck:mp`; `npm run test:mp -- --list`; record bounded expected tracer RED|Creates fixture/config/tracer test|pending|
|01-02-01|2|NET-01,NET-03,NET-04|T-01-03,T-01-04,T-01-05|`npm run test:mp -- --grep "tracer:"`; `npm run typecheck:mp`; real two-context movement/M4 hit|Created01-01-03; GREEN before expansion|pending|
|01-02-02|2|NET-01,NET-03,NET-04|T-01-06|`npm run test:unit -- src/shared/world.test.js`; tracer scenario; canonical parity,tangent/spawn/independence|Creates world tests before verify|pending|
|01-02-03|2|NET-01|T-01-04|`npm run test:mp -- --grep "tracer:|entry:"`; `npm run lint`; enabled entry/leave/offline menu|Extends browser tests before verify|pending|
|01-03-01|3|NET-01,NET-03|T-01-10|`npm run test:unit -- src/shared/movement.test.js`; `npm run test:mp -- --grep "tracer:|movement:"`|Creates movement tests/browser cases|pending|
|01-03-02|3|NET-03|T-01-07,T-01-08,T-01-09|`npm run test:unit -- src/shared/protocol.test.js server/tdmRoom.test.js`; movement browser check; checked boundaries|Creates raw hostile SDK/protocol tests|pending|
|01-04-01|4|NET-01,NET-04|T-01-11,T-01-14|`npm run test:unit -- src/shared/combat.test.js`; `npm run test:mp -- --grep "tracer:|combat:"`|Creates combat boundaries/browser cases|pending|
|01-04-02|4|NET-04|T-01-11,T-01-12,T-01-13|`npm run test:unit -- server/tdmRoom.test.js`; `npm run test:mp -- --grep "combat:|authority:"`|Extends hostile/browser tests|pending|
|01-05-01|5|MODE-01,NET-01|T-01-15,T-01-18|`npm run test:unit -- src/shared/tdmRules.test.js`; `npm run test:mp -- --grep "teams:"`|Creates rules/team browser cases|pending|
|01-05-02|5|MODE-01,NET-03,NET-04|T-01-16,T-01-17|`npm run test:unit -- src/shared/tdmRules.test.js server/tdmRoom.test.js`; `npm run test:mp -- --grep "teams:|lifecycle:"`|Extends fake-clock/replay/real rematch cases|pending|
|01-06-01|3|HOST-03,NET-01|T-01-19,T-01-22,T-01-23|`npm run test:unit -- server/cli.test.js server/hosting.test.js`; tracer browser check|Creates CLI/listener/path/origin tests|pending|
|01-06-02|3|HOST-03|T-01-20,T-01-21|`npm run test:unit -- server/tls.test.js server/hosting.test.js`; checked boundaries; SAN/key/reuse/permissions|Creates TLS tests before verify|pending|
|01-06-03|3|HOST-03,NET-01|T-01-19,T-01-20,T-01-24|`npm run test:mp -- --grep "hosting:"`; hosting unit checks; manual trust at phase end|Creates separate HTTPS/WSS browser spec|pending|
|01-07-01|6|NET-01,MODE-01|T-01-27|`npm run test:unit -- src/network/remoteActors.test.js`; `npm run test:mp -- --grep "resources:|lifecycle:"`|Creates ownership tests; extends browser cases|pending|
|01-07-02|6|NET-04,NET-01|T-01-25,T-01-26|`npm run test:unit -- src/network/onlineUi.test.js`; `npm run test:mp -- --grep "feedback:|errors:|authority:"`|UI units here; failing browser cases authored01-07-01|pending|
|01-07-03|6|All five phase requirements|T-01-01..T-01-28,T-01-SC|Full suite above; actual ASVS5.0.0 mitigation evidence; offline modes/editor; phase-end trust/pose/prohibition judgment|Creates offline regression spec; existing+new suites|pending|

Wave3 is parallel only for01-03 and01-06: modified files are disjoint. Browser fixture output is also isolated:01-01-03 creates each fixture's unique OS-temp vod-mp- build root,Vite writes only its build subdirectory,and server --build-dir support is delivered by first tracer01-02-01. Concurrent fixtures serve independent immutable outputs and delete only their owned root after stopping child servers; repository dist remains the normal operator output.01-05 depends on01-04 and01-06;01-07 depends on01-05 and01-06. First gameplay implementation is tracer01-02-01;01-01 is required package approval/tooling only. Browser checks explicitly use production MP fixture,not Vite. Verification command names stay unchanged;01-01-03 discovery also checks simultaneous isolated build allocations.

Six classified spec-less edges are planned explicit checks (world adjacency; room empty/ordering; input concurrency; combat boundary/precision). MODE-01 and HOST-03 unclassified rows remain flagged assumptions. The single descriptor-less product-transparency prohibition in01-07 stays flagged-unverified until human review; ordinary security requirements remain threat rows rather than probe prohibitions.

## Wave 0 Requirements

- [ ] Shared/server behavioral test discovery and deterministic world/clock fixtures.
- [ ] Production-built multiplayer Playwright fixture/config using the actual dedicated server, not Vite alone.
- [ ] Hostile-message helper and observable authoritative state without a client-trusted mutation path.
- [ ] Exact dependency pins/lockfile and Node 24 CI; installation checkpoints required by package-legitimacy seam remain explicit in plans.
- [ ] Browser binaries and existing dependency install as needed during execution.
- [ ] Explicit lint/checking coverage for shared/server/network boundaries.

Infrastructure belongs inside the first end-to-end slice or the task immediately before a check needs it. No mocks-only completion; no unimplemented test-file references after Wave 0.

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
| --- | --- | --- | --- |
| Self-signed browser trust and usable pointer lock | HOST-03, NET-01 | Automated ignoreHTTPS errors does not prove operator/user trust experience | Launch `--tls` with the advertised test hostname/IP, follow documented browser trust step, open same link, click join/resume, aim and fire |
| Actual rendered player and hit-feedback usability | NET-01, NET-04 | Passing state assertions do not establish visual quality | Two browser windows join; verify current rigs/maps, movement, shooter-only marker/character feedback, death, respawn and rematch; inspect screenshots |

## Validation Sign-Off

- [x] Concrete task map synchronized with final PLAN files (planned coverage only).
- [ ] Every task has automated verification or a real human checkpoint.
- [ ] No three consecutive implementation tasks without automated feedback.
- [ ] All new test/config references exist before their verify command runs.
- [ ] Full automated suite and required manual acceptance evidence recorded.
- [ ] `nyquist_compliant: true` only after the validation audit confirms coverage.

**Approval:** Pending execution/validation; this file defines planned checks, not achieved results.
