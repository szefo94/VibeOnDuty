---
phase: "07"
slug: movement-matched-and-action-safe-animation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-05"
---

# Phase 7 — Validation Strategy

Planning contract for ten executable plans, twenty-two tasks and nine waves. Every automated gate has an adjacent fails_when. Nyquist compliance here describes the plan; wave_0_complete is false and all execution results remain pending. No Phase 7 runtime suite or measurement was run during planning.

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
| 07-01-01 | 01 | 1 | ANIM-03/05 | T-07-01-01/02 | Partial captures cannot pass; owned fixture cleanup leaves unrelated listener alive | browser/capture | `npm run test:e2e -- tests/animation-baseline.spec.js --workers=1`; `node tools/art/review.mjs --animation-baseline` | W0 new browser file; existing CLI extended here | pending |
| 07-01-02 | 01 | 1 | ANIM-05 | T-07-01-01 | Reject stale hashes, incomplete samples and nonfinite budget bounds | evidence | `node tools/art/review.mjs --animation-budget` | CLI created by this task, consumes 01-01 evidence | pending |
| 07-02-01 | 02 | 2 | ANIM-04 | T-07-02-01/02 | Original keyed donor reaches target with unchanged protected art | Node/Blender | `node --test tools/art/motion-pipeline.test.mjs`; `node tools/art/motion-pipeline.mjs build --candidate` | W0 new Node file and CLI created here | pending |
| 07-02-02 | 02 | 2 | ANIM-04 | T-07-02-01/02/03 | Reject malformed slots/names/rig/NaN/root/unlisted/old-motion/path/script subjects; fresh editable recovery | Node/Blender | `node tools/art/motion-pipeline.mjs self-test`; `node tools/art/inspect-character.mjs --self-test`; `node tools/art/motion-pipeline.mjs repeat`; `node tools/art/motion-pipeline.mjs recover --demo` | Existing inspector; motion CLI from 02-01 extended here | pending |
| 07-03-01 | 03 | 3 | ANIM-02/03/04 | T-07-03-01 | Reject stale/foreign/incomplete publication and protect accepted domains | Blender/publication | `node tools/art/motion-pipeline.mjs build --candidate`; `node tools/art/motion-pipeline.mjs publish --latest`; `node tools/art/inspect-character.mjs --self-test` | CLI/validator from 02; exact publish contract in 02-02 | pending |
| 07-03-02 | 03 | 3 | ANIM-02/04 | T-07-03-01/02 | Real moving normal load/packed decode; stale old motion cannot pass; sibling isolation; retain provenance/command facts for10 documentation | unit/browser | `npm run test:unit -- src/builders/enemyGLTF.test.js`; `npm run test:e2e -- tests/animation-motion-source.spec.js --workers=1` | W0 both new paths; docs/ART.md moved10-01, tools/README.md moved10-02 | pending |
| 07-04-01 | 04 | 2 | ANIM-02/03 | T-07-04-01 | Reload cancellation wins before/at deadline; held ADS suppressed; release once at0.405s | unit/browser | `npm run test:unit -- src/entities/actionLifecycle.test.js`; `npm run test:e2e -- tests/action-lifecycle.spec.js --grep "throw:" --workers=1` | W0 both new paths created before gate | pending |
| 07-04-02 | 04 | 2 | ANIM-02/03 | T-07-04-02 | No stale melee damage/throw/ammo after death/menu/respawn/weapon change; no delayed queue | unit/browser | `npm run test:unit -- src/entities/actionLifecycle.test.js`; `npm run test:e2e -- tests/action-lifecycle.spec.js --workers=1` | Tests from 04-01 expanded here | pending |
| 07-05-01 | 05 | 4 | ANIM-02/03 | T-07-05-01/03 | Equal normalized data equal pose; blocked feet stationary; masks/base/roots/camera protected | unit/browser | `npm run test:unit -- src/builders/animationPresentation.test.js src/builders/enemyAnimations.test.js`; `npm run test:e2e -- tests/animation-presentation.spec.js --grep "local:" --workers=1` | W0 presentation/new browser paths; existing mixer tests | pending |
| 07-05-02 | 05 | 4 | ANIM-02/03 | T-07-05-01/02 | Unit fixtures reject forged/stale cues, verify pose/phase/tick/generation and1800ms; existing production regression protects authority | unit/MP | `npx vitest run src/network/remoteActors.test.js src/shared/protocol.test.js`; `npm run test:mp -- --grep "movement:|authority:"` | Existing unit tests expanded; existing MP cases unchanged; new two-client animation matrix owned09-01 | pending |
| 07-05-03 | 05 | 4 | ANIM-02/03 | T-07-05-01/03 | Bot/local/remote equivalence, no root drift; settled death stops and replacement resets | unit/browser | `npm run test:unit -- src/builders/animationPresentation.test.js src/builders/enemyAnimations.test.js`; `npm run test:e2e -- tests/animation-presentation.spec.js --workers=1` | Existing/from 05-01 expanded | pending |
| 07-06-01 | 06 | 5 | ANIM-02/03/05 | T-07-06-01 | M4 articulated1P/3P weapon parts plus actual3P hand contact; finite1P sockets; no ammo/props after cancellation | unit/browser | `npm run test:unit -- src/builders/weaponHandling.test.js src/builders/weapon3pTransform.test.js`; `npm run test:e2e -- tests/weapon-handling.spec.js --grep "m4:" --workers=1` | W0 handling/new browser tests; real visible1P hands/contact owned07 | pending |
| 07-06-02 | 06 | 5 | ANIM-02/05 | T-07-06-01/02 | Correct P90/AWP/M9 parts and actual3P contacts; wrong/fallback detail cannot pass; bounded props;1P contact contract consumed07 | unit/browser | `npm run test:unit -- src/builders/weaponHandling.test.js`; `npm run test:e2e -- tests/weapon-handling.spec.js --workers=1` | From06-01 expanded; visible1P contact requires07 rig | pending |
| 07-06-03 | 06 | 5 | ANIM-02/03/05 | T-07-06-01/02 | No fabricated/double phase; bot/remote mounted contacts and keeper survive | unit/browser | `npm run test:unit -- src/builders/weaponHandling.test.js src/network/remoteActors.test.js`; `npm run test:e2e -- tests/weapon-handling.spec.js --grep "actors:" --workers=1` | Existing/from 06-01 expanded | pending |
| 07-07-01 | 07 | 6 | ANIM-02/03/05 | T-07-07-01/02 | Real hands/down-look body; no duplicate gun/limbs; injected render failure restores camera | unit/browser | `npm run test:unit -- src/builders/firstPersonRig.test.js`; `npm run test:e2e -- tests/first-person-rig.spec.js --grep "tracer:" --workers=1` | W0 both new paths created before gate | pending |
| 07-07-02 | 07 | 6 | ANIM-02/03/05 | T-07-07-01/02 | Separate actual moving visible1P hand/manipulation/recontact cases for M4/P90/AWP/M9; all tiers/ADS/reduced motion/lifecycle | unit/browser | `npm run test:unit -- src/builders/firstPersonRig.test.js src/builders/weaponHandling.test.js`; `npm run test:e2e -- tests/first-person-rig.spec.js --workers=1` |06 handlers +07 rig now exist; missing any four-weapon contact case fails | pending |
| 07-08-01 | 08 | 7 | ANIM-02/03/04/05 | T-07-08-01/02 | DEV/offline only; no auto-play/outcome/input/capture; close/context/focus restoration | browser | `npm run test:e2e -- tests/animation-review.spec.js --grep "tracer:" --workers=1` | W0 new browser path before gate | pending |
| 07-08-02 | 08 | 7 | ANIM-02/03/04/05 | T-07-08-01/02/03 | Stale requests retire; UI28 lossless cases; exact future labels/x1.15/cancel; bounded native accessibility | unit/browser | `npm run test:unit -- src/dev/animationReview.test.js`; `npm run test:e2e -- tests/animation-review.spec.js --workers=1` | W0 unit path; browser from 08-01 expanded | pending |
| 07-09-01 | 09 | 8 | ANIM-02/03/05 | T-07-09-01/02 | Added two-client pose/phase/root authority matrix from05; forged/stale cues reject; old actions/feedback/props cannot affect fresh actors/templates | unit/MP | `npm run test:unit -- src/network/remoteActors.test.js src/entities/actionLifecycle.test.js src/builders/firstPersonRig.test.js`; `npm run test:mp -- --grep "animation authority:|resources:|animation retirement:"` | Existing/prior paths; owns tests/multiplayer.spec.js new matrix after05 adapters/06 handling/07 rig; new resource fixture | pending |
| 07-09-02 | 09 | 8 | ANIM-02/03/05 | T-07-09-01/02 | Double disposal/zero/one/keeper/new clone safe; listeners/props plateau and measured envelope | browser | `npm run test:e2e -- tests/animation-resources.spec.js tests/action-lifecycle.spec.js --workers=1`; `npm run test:e2e -- tests/animation-regressions.spec.js tests/character-art.spec.js --grep "resources:|repeated character removal" --workers=1` | W0 resource path from 09-01; other paths existing/prior | pending |
| 07-10-01 | 10 | 9 | ANIM-02/03/04/05 | T-07-10-02 | Incomplete/stale moving matrix cannot pass; human/automation separation; docs/ART.md owns donor/retarget/creator instructions moved03 | capture | `node tools/art/review.mjs --animation-capture` | Existing CLI extended; whole matrix plus03-SUMMARY source/manifest/provenance prerequisite | pending |
| 07-10-02 | 10 | 9 | ANIM-02/03/04/05 | T-07-10-01/02 | Old-motion/protected corruption rejects; editable recovery/stable gates; tools/README.md owns exact creator command/import/slot/bone instructions moved03 | integration/full | `node tools/art/pipeline.mjs self-test`; `node tools/art/motion-pipeline.mjs recover --demo`; `node tools/art/pipeline.mjs iterate --demo`; `node tools/art/verify-export.mjs --iteration`; `npm run lint`; `npm run typecheck`; `npm run typecheck:mp`; `npm run build`; `npm run test:unit`; `npm run test:e2e`; `npm run test:mp` | Existing/from02;03-SUMMARY source/provenance prerequisite; exact fails_when per gate in10 | pending |

## Wave 0 Requirements

- [ ] 07-01-01 creates tests/animation-baseline.spec.js before its first run; measures actual current baseline before any asset/runtime mutation in waves2+.
- [ ] 07-02-01 creates tools/art/motion-pipeline.test.mjs and the strict CLI before use. Embedded fixtures include donor/target and malformed-name/slot/rig/NaN/root/unchanged/protected-domain controls; 02-02 adds traversal/junction/alias/script and recovery negatives plus publish --latest rejection.
- [ ] 07-03-02 creates src/builders/enemyGLTF.test.js and tests/animation-motion-source.spec.js before use.
- [ ] 07-04-01 creates src/entities/actionLifecycle.test.js and tests/action-lifecycle.spec.js before use, with before/at/after deadline, ADS, duplicate marker and stale generation cases.
- [ ] 07-05-01 creates src/builders/animationPresentation.test.js and tests/animation-presentation.spec.js before use; 05-02 extends existing protocol/remote/MP tests.
- [ ] 07-06-01 creates src/builders/weaponHandling.test.js and tests/weapon-handling.spec.js before use.
- [ ] 07-07-01 creates src/builders/firstPersonRig.test.js and tests/first-person-rig.spec.js before use.
- [ ] 07-08-01 creates tests/animation-review.spec.js; 08-02 creates src/dev/animationReview.test.js before use. All UI28 row IDs and eight exact grouped truths are traced in08.
- [ ] 07-09-01 creates tests/animation-resources.spec.js before any resource browser gate; 09-02 expands retirement and measured-envelope cases.
- [x] Every missing path/CLI has an owning creation task before its first verification. Wave0 is local to each tracer/expansion, not an unimplemented global harness dependency.
- Revision1 ownership: plan03 has8 modified files, plan05 has9; docs authoring genuinely moves to10 and additional two-client animation tests genuinely move to09. No runtime adapter, motion repertoire or required test is omitted. Plan06 proves parts/sockets and available3P hands; plan07 owns visible1P hands/contact for all four weapons after creating the rig.
- No new package installation needed on the researched environment.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|---|---|---|---|
| Human anatomy, contact, pacing, smooth transitions and stable ADS | ANIM-02/03 | Metrics cannot establish visible motion quality | Play all four weapons in first/third person, down-look body, sprint, jump/landing, turns, reload/action interruption, damage and death at each quality tier; record actual source/export identities and human verdict |
| Editable creator workflow and iteration quality | ANIM-04 | Automated reopen does not judge authored motion | Reopen retained source, change donor motion, retarget/export and inspect moving transition in game |
| Device frame budget | ANIM-05 | Review hardware is not all target hardware | Plans01/09/10 record numeric envelope and matched warmed one/eight actor/tier costs; human review observes comfort. SwiftShader does not certify60FPS or phone/iGPU/Pi capacity. |

## Probe/decision coverage and unresolved assumptions

- D-01–D-11 are implemented/reviewed by the exact plan10 multi-source audit; Phase5 mechanics/ANIM-01 remain excluded according to the locked boundary.
- All five explicit edge resolutions are exact must_haves truths in03 (missing detail),04 (deadline/ordering),09 (empty/resource encoding).
- Exact engine ANIM-03/unclassified and ANIM-04/unclassified remain flagged-unresolved assumptions in05/02 and final10. No guessed resolution is recorded.
- UI-SPEC's28 explicit rows map losslessly to eight identical truth strings in08; categories/elements/IDs are retained in its trace ledger.
- Three bespoke transparency prohibitions were projected with canonical projectProhibitions, descriptor-less and unresolved: future gameplay claims, inherited/original/license claims, automated/human/device claims. They remain flagged-unverified for downstream disposition; tests cannot self-clear them. Canonical injection/path/authorization concerns stay in threat/negative gates and $gsd-secure-phase/lint rather than duplicate prohibitions.
- Hybrid near-camera anatomy/contact, original keyed-motion aesthetics and contact/turn thresholds require actual moving review. Inherited rig/motion/weapon terms remain unresolved. Broader device qualification and actual Phase5 sprint/movement/timing/input decisions are pending.
- Deterministic external API detector ran on complete current plans plus the Phase7 roadmap section: detected=false, signals=[]; no COVERAGE.md/service matrix is required. Assumption-delta root scan detected=false; no schema-relevant ORM path appears. No new install/AI service/schema push is planned.

## Verification scheduling and failure semantics

Pure focused unit/Node self-tests target under30s feedback; execution measures actual durations. Blender export/reopen/recovery, capture matrices and full browser/MP gates may exceed60s and are never advertised as fast. No watch flags. Every nonzero command, zero-test match, missing named negative/control or incomplete/stale evidence fails its task. Negative subjects use behavioral validators/fixtures, not source greps. Exports precede browser runs; offline and production browser runs remain sequential because output is shared.

T-07-SC is the reserved cross-plan package threat: no installation tasks exist. Added installs require the legitimacy audit and blocking human gate for ASSUMED/SUS before execution; SLOP is forbidden. All other threat IDs are unique by plan and mapped above. Security uses ASVS5 L1 and blocks high/critical unresolved findings.

## Validation Sign-Off

Plan09 acceptance amendment (2026-10-06): `07-BUDGET-AMENDMENT.md` explicitly repairs external-camera versus source-eye measurement scope. Original golden files and false comparison remain immutable. Before further optimization, freeze separate `07-09-view-reference-v2.json` and `07-budget-view-v2.json` with producer/settings lineage and two-run max-plus-dispersion limits. The actual independently captured `07-09-cost-postopt.json` must pass `node tools/art/animation-budget-v2.mjs verify --budget .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-budget-view-v2.json --candidate .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-cost-postopt.json` with nonzero failure. Add `node --test tools/art/animation-budget-v2.test.mjs` negatives for changed producer/scope/settings, missing draw/pixels, numeric overrun/growth/shared disposal and frozen-budget replacement. World skeleton sharing is per-instance exact equality only, with posed-vertex/bind-matrix/sibling-disposal proof. Execution remains pending until these new gates run; no original failure becomes a pass.

- [x] Every task has automated verification and adjacent explicit failure semantics.
- [x] No three consecutive tasks without automated verification.
- [x] All missing files/commands have creation tasks before use; no watch flags.
- [x] Planner maps every threat mitigation to a meaningful negative check.
- [ ] Independent checker confirms complete planning coverage.
- [ ] Execution results remain pending until commands actually run.

**Approval:** independent plan checker pending. Planning Nyquist coverage is complete; execution, Wave0 completion, measured budgets, runtime gate results and human moving aesthetic acceptance remain pending.
