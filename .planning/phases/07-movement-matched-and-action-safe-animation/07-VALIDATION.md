---
phase: "07"
slug: movement-matched-and-action-safe-animation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-05"
---

# Phase 7 — Validation Strategy

Planning contract derived from 07-RESEARCH.md Validation Architecture. No Phase 7 runtime checks have run. Planner must replace the provisional task map with exact plan/task IDs, negative cases, commands and threat references.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Existing Vitest 4.1.3, Playwright 1.59.1, pinned Blender 4.5.13 LTS |
| Config | vite.config.js, playwright.config.js, playwright.multiplayer.config.js |
| Quick command | `npx vitest run src/builders/enemyAnimations.test.js src/network/remoteActors.test.js src/shared/protocol.test.js` |
| Full gates | lint, root/MP types, build, unit suite, offline browser suite, production MP suite sequentially |
| Runtime | Measure during execution; pure-helper target under 30 seconds, exporter/browser gates are longer |

## Sampling Rate

- After each task: relevant focused test/exporter self-test with a stated failure signal.
- After each wave: affected real asset/browser checks; run exports before browser suites and browser suites sequentially.
- Before `$gsd-verify-work 7`: lint, root/MP type checks, build, all units, offline browser and production MP suites must be green.
- Measure actual latency; no invented universal timing or device FPS claims.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| Planner assigns | Pending | Pending | ANIM-02 | Pending | Canceled actions never award ammo or release stale damage | unit/browser | `npm run test:e2e -- tests/animation-regressions.spec.js --workers=1` plus new focused policy tests | Existing plus W0 gaps | pending |
| Planner assigns | Pending | Pending | ANIM-03 | Pending | Read-only generation-scoped authoritative inputs; root does not move | unit/MP | `npx vitest run src/network/remoteActors.test.js src/shared/protocol.test.js` plus new input normalization tests | Existing plus W0 gaps | pending |
| Planner assigns | Pending | Pending | ANIM-04 | Pending | Reject malformed, escaping or silently unchanged motion exports | exporter | `node tools/art/inspect-character.mjs --self-test` and new motion-aware export/reopen checks | Existing plus W0 gaps | pending |
| Planner assigns | Pending | Pending | ANIM-05 | Pending | Retired callbacks and resources cannot alter a live sibling | browser/MP | `npm run test:e2e -- tests/animation-regressions.spec.js tests/character-art.spec.js --grep "resources:|repeated character removal" --workers=1` | Existing plus W0 gaps | pending |

## Wave 0 Requirements

- [ ] Pure presentation and action policy fixtures: cancellation boundaries, held ADS, blocked locomotion, root ownership and generation retirement.
- [ ] Real first-person camera/view resource and weapon-contact fixtures through normal asset loading.
- [ ] Motion publication/reopen negative controls: missing/duplicate clips, wrong rig, NaN, root travel, silent unchanged-motion export, unsafe source execution and path escape.
- [ ] Exact new file names and runnable commands assigned by planner before execution.
- No new package installation needed on the researched environment.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|---|---|---|---|
| Human anatomy, contact, pacing, smooth transitions and stable ADS | ANIM-02/03 | Metrics cannot establish visible motion quality | Play all four weapons in first/third person, down-look body, sprint, jump/landing, turns, reload/action interruption, damage and death at each quality tier; record actual source/export identities and human verdict |
| Editable creator workflow and iteration quality | ANIM-04 | Automated reopen does not judge authored motion | Reopen retained source, change donor motion, retarget/export and inspect moving transition in game |
| Device frame budget | ANIM-05 | Review hardware is not all target hardware | Record actual warmed actor count, mixer/IK/frame/allocation costs and limitations; SwiftShader does not certify 60fps |

## Validation Sign-Off

- [ ] Every task has automated verification or exact Wave 0 dependency.
- [ ] No three consecutive tasks without automated verification.
- [ ] All missing files/commands have creation tasks before use; no watch flags.
- [ ] Planner maps every threat mitigation to a meaningful negative check.
- [ ] Independent checker confirms complete planning coverage.
- [ ] Execution results remain pending until commands actually run.

**Approval:** pending plan verification; no runtime approval claimed.
