---
phase: 01-two-client-authoritative-tdm
plan: "07"
subsystem: multiplayer-presentation
tags: [threejs, colyseus, resource-ownership, feedback, recovery, playwright, asvs5, tdd]
requires:
  - phase: 01-05
    provides: Authoritative teams, death/respawn, results and same-settings rematch
  - phase: 01-06
    provides: Validated operator CLI/TLS and owned isolated production fixtures
provides:
  - Generation-owned remote rigs with template-safe retirement and current cosmetic actions
  - Validated private shooter feedback, render-time expiry and fresh-session Retry/Return
  - Full production/offline regression gates, CI integration and versioned security/capture evidence
affects: [phase-02, phase-04, phase-07, phase-08, phase-09]
actuals:
  tokens: 27536
  tasks: 3
  commits: 5
  plan_head_before: 36b3308125914fd63080215154d500b646cac5b6
  plan_head_after: dd212e4f6210a40354c5d7e301e27809e371a7a2
plan_head_before: 36b3308125914fd63080215154d500b646cac5b6
plan_head_after: dd212e4f6210a40354c5d7e301e27809e371a7a2
tech-stack:
  added: []
  patterns: [injected resource owner, private-event validation before dedupe, static UI ownership, render-delta cosmetic expiry, isolated production recovery tests]
key-files:
  created: [src/network/remoteActors.js, src/network/remoteActors.test.js, src/network/onlineUi.js, src/network/onlineUi.test.js, tests/offline-multiplayer-regressions.spec.js, .planning/phases/01-two-client-authoritative-tdm/SECURITY.md, .planning/phases/01-two-client-authoritative-tdm/01-SECURITY.md, .planning/phases/01-two-client-authoritative-tdm/01-07-CAPTURE.mjs, .planning/phases/01-two-client-authoritative-tdm/evidence/01-07/manifest.json]
  modified: [src/network/onlineSession.js, src/fx/damageNumbers.js, src/main.js, index.html, style.css, tests/multiplayer.spec.js, .github/workflows/test.yml, docs/MULTIPLAYER.md, AGENTS.md]
key-decisions:
  - "Retire SDK automatic reconnection on disconnect; the phase1 Retry action creates fresh membership after complete local teardown. Continuity remains Phase2."
  - "Validate current recipient/lives and bounded finite feedback before monotonic event/shot dedupe; presentation cannot change snapshot health."
  - "Use existing rig, animation and disposal helpers without editing or retargeting assets; online feedback nodes expire with render delta and retire with their session."
  - "Keep exact ASVS5 control levels, accepted self-signed trust, screenshot resolution and all pending human judgments explicit; no shared requirement is fully accepted yet."
patterns-established:
  - "One connection/match/life generation owns one remote rig and named capture handlers; leave/disconnect retires all owned state."
  - "Test-only served-response instrumentation exercises real private feedback and hostile offline outcomes without adding a game mutation API."
requirements-completed: []
requirements-covered: [NET-01, NET-03, NET-04, MODE-01, HOST-03]
requirements-pending-human: [NET-01, NET-03, NET-04, MODE-01, HOST-03]
requirements-status: pending-human
coverage:
  - id: D1
    description: "Current GLB/M4 rigs retire once and remain usable through death, respawn, rematch and repeated fresh joins"
    requirement: NET-03
    verification:
      - kind: unit
        ref: "src/network/remoteActors.test.js (3 tests)"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#resources: repeated joins retire all remote rigs and stabilize allocations; resources/lifecycle score path"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only validated current shooter confirmations create feedback; errors remain readable and recover through fresh Retry/Return"
    requirement: NET-04
    verification:
      - kind: unit
        ref: "src/network/onlineUi.test.js (4 tests)"
        status: pass
      - kind: e2e
        ref: "tests/multiplayer.spec.js#feedback:, authority:, errors: (included in final13 passing tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six local destinations remain usable after production-room leave; existing assets/animations and strict boundary checks remain green"
    verification:
      - kind: e2e
        ref: "npm run test:e2e (18 passed); tests/offline-multiplayer-regressions.spec.js"
        status: pass
      - kind: integration
        ref: "lint, typecheck, typecheck:mp, build, test:unit238, build:mp and test:mp13"
        status: pass
    human_judgment: false
  - id: D4
    description: "All29 unique planned threats have actual implementation/evidence and tagged ASVS5 correspondences or the explicit accepted-low testing trust exception"
    verification:
      - kind: other
        ref: "SECURITY.md; official tagged ASVS5.0.0 JSON; fixture --check-isolation"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real LAN two-window trust, gesture usability, visual map/rig/feedback review and unclassified requirement/product probes"
    verification:
      - kind: manual_procedural
        ref: "docs/MULTIPLAYER.md; phase-end parent-owned review environment"
        status: unknown
    human_judgment: true
    rationale: "Automated HTTPS bypass and small screenshots cannot establish real trust, full-size pose/feedback quality or pointer-lock usability; HOST-03/MODE-01 probes and descriptor-less capacity prohibition need human judgment."
  - id: D6
    description: "Additional full-resolution online capture controller"
    verification:
      - kind: other
        ref: "01-07-CAPTURE.mjs (two first-waypoint timeouts; no images)"
        status: fail
    human_judgment: false
    rationale: "Extra evidence attempt is deferred under the fix-attempt limit; required production captures and full suite passed. This is not a delivered passing capture."
duration: 520min
completed: 2026-10-04
status: complete
execution-status: automated-complete-human-acceptance-pending
---

# Phase 1 Plan 7: Presentation, Resource Ownership and Acceptance Summary

**Generation-owned current rigs, private validated hit feedback and fresh-session recovery pass the full production/offline gates; human phase acceptance remains pending.**

## Performance

- **Started:** 2026-10-03T20:52:32.2108874Z
- **Automated work completed/measured:** 2026-10-04T05:32:20.3483754Z
- **Duration:** 520min wall time, including approximately454min host suspension during a running browser check; uninterrupted execution effort is not comparable to that wall duration.
- **Tasks:** 3 automated implementation/evidence tasks executed; the task3 human check remains pending at phase end.
- **Files:** 47 committed implementation/evidence paths before SUMMARY/STATE/WINDOWS closeout, including26 PNG captures.
- **Actuals instrument:** 110144 characters in the realized Git textual diff divided by4 =27536 estimate-scale tokens. Binary image bytes are not text characters. The persisted plan ledger measures five commits before metadata, with both heads recorded above.

## Accomplishments

- `remoteActors.js` owns real skeleton clones, M4 mounts, team tint, current-life locomotion/death/reload/jump cosmetics and once-only template-safe retirement. Tests prove shared template survival, exact live rig accounting and zero retired actors/handlers after leave; stabilized texture counts are evidence of these runs, not a GPU/FPS guarantee.
- `onlineUi.js` validates finite bounded private confirmations, current recipient/shooter/target lives, match and session, then applies monotonic event/shot dedupe. It never changes health. Owned marker/damage nodes expire with render delta even while dead/unlocked and clear on generation retirement. Static controls provide top-screen safe-text errors, Retry and Return above pause/results.
- Disconnect releases pointer lock, disables SDK automatic reconnect, retires state synchronously and exposes fresh-session recovery. The existing fixed15-second rematch and gesture-driven Resume remain server-owned.
- The six-destination offline regression and the existing17 asset/animation/menu tests pass. Menu return now retires Training Range targets, HUD and its handler before the next mode/editor. CI retains Node24, reusable deployment gating and failure reports while adding strict multiplayer checks, both builds and the real production suite.
- [SECURITY.md](SECURITY.md) records all29 unique planned threats against exact tagged ASVS5 controls and levels. [01-SECURITY.md](01-SECURITY.md) is only the conventional gate-discovery pointer. No new packages, asset retargeting or gameplay catalogs were added.

## Task Commits

1. **Task1 RED:** `e97a472` — remote retirement assertion tests and authored resource/feedback/error browser scenarios.
2. **Task1 GREEN:** `f1bc74f` — generation-owned remote rig manager and current presentation integration.
3. **Task2 RED:** `23a23aa` — malformed confirmation and safe recovery UI assertion tests.
4. **Task2 GREEN:** `c145dc9` — validated feedback, static recovery UI, SDK retirement and managed cosmetic expiry.
5. **Task3:** `dd212e4` — complete regression/CI/security/capture evidence, range cleanup and coherent deadline assertion.

The separate metadata commit records this SUMMARY, STATE, ROADMAP and defect ledger. Its hash is returned to the orchestrator, not fabricated in this pre-commit summary.

## TDD Gate Compliance

Both behavior-adding tasks used actual assertion REDs against extracted baseline behavior, not missing modules. `01-07-01-RED.json` reports disposal expected once but observed zero; `01-07-02-RED.json` reports malformed feedback accepted when false was required. The canonical checker returned `RED_EVIDENCE_OK` for each before GREEN and again at closeout. Remote ownership3 and online UI4 tests pass in the full238-test run. No implementation-reflection tests or skipped tests were added.

## Automated Check Results

| Gate | Final result |
| --- | --- |
| `npm run lint` | PASS; zero ESLint warnings |
| `npm run typecheck` | PASS |
| `npm run typecheck:mp` | PASS; all16 relevant new production/helper shared/server/network JS boundaries explicitly opt into checked coverage |
| `npm run build` | PASS; default prefix preserved; existing >500kB chunk warning remains |
| `npm run test:unit` | PASS;238 tests in21 files,55.10s |
| `npm run test:e2e` | PASS;18 tests,2.9m; final run after range cleanup |
| `npm run build:mp` | PASS; final root-base output,2.547s |
| `npm run test:mp` | PASS;13 tests,6.4m; clean full run after deadline assertion correction |
| `node tests/helpers/mpServer.js --check-isolation` | PASS; distinct owned temp roots, unchanged root-dist fingerprint and surviving sibling through scoped cleanup |
| Both `check tdd-red-evidence` records | PASS; intentional target assertion failures verified |

The production13 cover hosting/TLS, teams, score/time endings, real traveling M4, forged offline awards, malformed/stale/duplicate/wrong-recipient feedback, top error Retry/Return, repeated rig retirement, tracer, movement and entry/leave. Existing offline17 stay selected by the Vite config; the extra offline lifecycle test uses its own isolated production fixture. No test dependency was downloaded. Legacy untested JS is not newly declared strict merely because the project has `checkJs:false`.

All gates were run in full. After the menu cleanup fix, lint/types/build and the entire18-test offline suite were rerun; strict MP/root build and the whole13-test production suite also passed. The latest test-only whitespace change does not change behavior. Browser startup used enabled asset-loaded controls and explicitly accounted for existing headless pointer-lock limitations.

## Evidence and Its Limits

[Capture manifest](evidence/01-07/manifest.json) inventories26 PNG files with SHA256, dimensions and write timestamps. Eighteen production PNGs are200x150 and two entry PNGs250x200, from800x600/1000x800 viewports with deviceScaleFactor0.25. Six offline PNGs are800x600 at deviceScaleFactor1. They include current armed/moving rigs, shooter/victim feedback, death/respawn, both clients' results, automatic rematch, errors, resource rejoin and every offline destination. The final editor image has no retained Training Range HUD. Capture provenance does not imply accepted visual quality.

Fixtures build actual production source and load the existing `enemy.glb`; no fake room or runtime authority mutation surface was added. Test-only response instrumentation injects attacks through the real installed callback or offline event bus. The final full production fixture built the committed Task3 source before its commit (c145dc9 plus those verified edits). Each fixture/context was closed in finally; no persistent review server is running. The parent owns the consolidated review server.

## Decisions Made

Fresh Retry membership follows the scope of the existing slice; reconnect continuity and prediction remain Phase2. Private presentation validates before dedupe so malformed high IDs cannot poison later genuine hits. Existing disposal/animation helpers remain the asset authority. ASVS L2 supplementary engineering controls are labeled L2 rather than invented L1 IDs; self-signed testing deliberately does not meet public trust V12.2.2. No security certification, unmeasured capacity, Raspberry Pi or60FPS qualification is claimed.

## Deviations from Plan

1. **[Rule2 — Missing critical cleanup] Managed damage-number expiry.** The existing helper owned its own animation-frame timer and exposed no retirement handle. Added an optional managed handle in `src/fx/damageNumbers.js` so online expiry uses render delta and session retirement removes nodes; default offline behavior remains. Verified by online UI units and production feedback expiry. Commit`c145dc9`; WINDOWS25 fixed.
2. **[Rule1 — Lifecycle bug] Training Range survived menu return.** The six-mode screenshot exposed range HUD/targets/input persisting into the editor. `src/main.js` now calls the existing `stopTrainingRange()` at menu return. Final18-test suite and clean editor capture pass. Commit`dd212e4`; WINDOWS26 fixed.
3. **[Rule1 — Test race] Results check crossed a real deadline between reads.** An initial full run passed12 and failed one time-path assertion because a busy runner moved from results to active between snapshots. The assertion now evaluates one coherent snapshot: results before deadline or the correct match2/startedAt after it. Server behavior and fixed15-second unit checks were unchanged. The clean full13-test run passes. Commit`dd212e4`; WINDOWS27 fixed.
4. **[Rule3 — Gate evidence encoding] RED target text encoding.** The JUnit gate compares the XML-encoded separator `&gt;`; the evidence target was corrected to that exact extracted assertion name before GREEN. Both canonical checks pass. WINDOWS28 fixed.

Task3 also attempted one extra high-resolution capture controller adjustment; the second attempt still timed out. No additional fix loop was started after the three-attempt limit. This deferred extra check is recorded below rather than represented as passing.

## Issues Encountered

The host suspended for approximately454min during an owned browser check, producing an overnight timeout; later normal recovery and full regression runs pass. Initial served-response test instrumentation assumed a quote style that Vite did not preserve; matching actual bundled backtick/single/double delimiters let the intended real callback attack run. Installed SDK declarations/source established `.reconnection.enabled=false` and avoiding `leave()` on an already-closed connection, whose onLeave event has already fired. These are adapter correctness decisions, not changes to server authority.

## Deferred Issues and Human Acceptance

- **WINDOWS31:** The additional deviceScaleFactor1 controller in `01-07-CAPTURE.mjs` timed out twice at the first waypoint and produced no images. It reached approximately(62.23,46.42) while its0.35m tolerance oscillated under software rendering/input latency and `stale_input` rejection. The required production suite/captures pass; this extra automated capture remains unverified.
- **WINDOWS17/30:** Real LAN self-signed trust in two actual browser windows, gesture-driven pointer lock, full-size current map/rig/shooter-feedback judgment and death/respawn/results/rematch usability are pending. Automated contexts bypass HTTPS errors and cannot provide that acceptance.
- **WINDOWS29:** HOST-03 and MODE-01 unclassified probes plus the descriptor-less product-transparency/capacity prohibition require phase-end human judgment. Tests cannot infer a missing predicate.
- **Existing WINDOWS3:** Three moderate and three high development-tool audit findings remain out of scope. The earlier production-only audit was clean, not a current dependency certification. No unrelated upgrades were installed.

The five shared requirements stay globally pending. `requirements-completed:[]` intentionally overrides the template's mechanical copy rule so pending acceptance cannot be misreported as achievement. `status:complete` records the automated plan execution artifact, not completion of Phase1 or its human checks. No goal-blocking runtime stub, TODO or skipped test was introduced; existing HTML input `placeholder` attributes are real editor inputs, not unwired features. No new unregistered network/auth/file-access trust surface was introduced.

## User Setup Required

No additional service or package setup is required. The parent will provide the consolidated running LAN review environment. Users only visit its advertised URL, trust the documented testing certificate, click Resume/Retry/Return and judge the running game; they need not execute CLI commands.

## Next Phase Readiness

All seven Phase1 automated plans now have implementation evidence. Phase1 acceptance remains open until the parent records the actual-window human results. Phase2 retains lobbies/prediction/latency/cross-device responsiveness; Phase3 other online modes; Phase4 bots and measured Pi profiles; Phase8 richer combat; Phase9 loadouts and gameplay persistence. None is implicitly qualified by this two-client slice.

## Self-Check: PASSED

Required source/test/security/manifest/SUMMARY files exist; all five task commits
resolve as actual Git commits; all26 preserved PNGs match their manifest SHA256.
No tracked deletions occurred in the task3 commit. Stub scan found only existing
editor HTML input placeholder attributes, with no unwired runtime feature or
skipped test. Remaining acceptance/deferred checks are explicitly open above.
