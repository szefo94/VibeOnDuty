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
| Config files | `vitest.config.js`, `playwright.config.js`; add explicit server discovery and multiplayer browser-server fixture |
| Quick command | `npx vitest run src/shared/ server/` once discovery and behavioral tests exist |
| Full suite | `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e` |
| Estimated runtime | Quick target <30 seconds; full browser/runtime duration must be measured during execution |

Do not accept an empty test selection as passing. Quick commands are planned infrastructure, not commands already validated. New boundary code must enter lint and meaningful JavaScript/type checking; existing `checkJs: false` is not proof of authority correctness.

## Sampling Rate

- After each task commit: run the task's narrow deterministic behavioral checks.
- After each wave: run affected shared/server integration and offline regression checks.
- Before phase completion: all full-suite checks above, the production-build two-browser multiplayer suite, and CLI/TLS integration pass.
- Maximum feedback latency target: 30 seconds for deterministic tests; explicit longer browser timeouts with measured durations.
- Every runnable `<automated>` command needs a following `<fails_when>` observable failure signal. No watch flags or success from zero matching tests.

## Behavior Verification Map

The planner must replace these scope rows with its concrete task IDs/waves and commands after decomposition. No implementation test is marked green by this planning document.

| Scope | Requirement | Threat Ref | Secure behavior | Test type | Planned command | File exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Headless world and commands | NET-03 | Bind to plan threat IDs | Reject NaN, bounds, duplicates, stale/future/old-generation requests; isolation and valid collision | Unit/integration | `npx vitest run src/shared/ server/` | Wave 0 required | pending |
| Firing and hit authority | NET-04 | Bind to plan threat IDs | Ammo/cadence/reload and earliest swept impact; forged hit/score ineffective; one death award | Unit + hostile SDK client | `npx vitest run src/shared/ server/` | Wave 0 required | pending |
| TDM lifecycle | MODE-01 | Bind to plan threat IDs | Smaller-team assignment; balanced switch; 25% friendly fire; solo start; respawn; ties; 15-second results/rematch; empty-room suspension | Fake-clock integration | `npx vitest run server/` | Wave 0 required | pending |
| Real browser integration | NET-01, MODE-01 | Bind to plan threat IDs | Two distinct sessions see movement/actors and identical confirmed outcome; hit UI only on shooter; dead client continues receiving updates | Playwright | `npx playwright test tests/multiplayer.spec.js --workers=1` using MP fixture/config chosen by plans | Wave 0 required | pending |
| Startup and TLS | HOST-03 | Bind to plan threat IDs | CLI help/errors/bind; assets/WSS through one link; SAN/key validity/reuse; no private-key serving | Subprocess/TLS + browser | `npx vitest run server/` plus MP browser suite | Wave 0 required | pending |
| Offline preservation | NET-01 | — | Existing local modes, map/editor lifecycle and real asset regressions still work | Existing unit/Playwright | `npm test`, `npm run test:e2e` | Existing tests; dependencies absent at research | pending |

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

- [ ] Concrete task map synchronized with final PLAN files.
- [ ] Every task has automated verification or a real human checkpoint.
- [ ] No three consecutive implementation tasks without automated feedback.
- [ ] All new test/config references exist before their verify command runs.
- [ ] Full automated suite and required manual acceptance evidence recorded.
- [ ] `nyquist_compliant: true` only after the validation audit confirms coverage.

**Approval:** Pending execution/validation; this file defines planned checks, not achieved results.
