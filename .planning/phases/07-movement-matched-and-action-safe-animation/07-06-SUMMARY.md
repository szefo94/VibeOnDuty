---
phase: 07-movement-matched-and-action-safe-animation
plan: "06"
subsystem: animation
tags: [weapon-handling, articulated-parts, bounded-contact, snapshot-phase, resource-ownership]
requires:
  - phase: 07-03
    provides: Original weapon action markers and retained inherited rig
  - phase: 07-05
    provides: Shared read-only presentation phase and masked locomotion
provides:
  - Independent M4, P90, AWP and M9 parts in current player weapon views
  - Weapon-local socket samples and bounded real-rig arm and finger correction
  - Single mounted actor owner with snapshot-driven M4 reload and owned retirement
  - Actual-game contact captures and truthful inspected P90 procedural fallback
affects: [07-07, 07-08, 07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Read-only shared phase, Analytic two-segment arm solve, WeakMap instance ownership, Lazy canonical mount capture]
key-files:
  created: [src/builders/weaponHandling.js, src/builders/weaponHandling.test.js, tests/weapon-handling.spec.js]
  modified: [src/builders/weapon.js, src/builders/weaponFBX.js, src/builders/enemyWeapon.js, src/builders/enemyAnimations.js, src/loop.js]
key-decisions:
  - "Handling samples the existing phase without owning gameplay time, ammunition, outcomes or online action permissions."
  - "Preserve the canonical hand mount after asynchronous attachment and keep receiver anchoring independent of AWP bolt-hand motion."
  - "The inspected inseparable P90 FBX remains available for inspection while actual play selects the complete articulated procedural fallback."
requirements-completed: [ANIM-02, ANIM-03, ANIM-05]
coverage:
  - id: D1
    description: Four current player weapon renders articulate correct mechanisms and restore canceled parts
    requirement: ANIM-03
    verification:
      - {kind: unit, ref: src/builders/weaponHandling.test.js, status: pass}
      - {kind: e2e, ref: tests/weapon-handling.spec.js, status: pass}
    human_judgment: false
  - id: D2
    description: Actual third-person rigs reach sampled support and bolt targets with bounded finger closure
    requirement: ANIM-02
    verification:
      - {kind: e2e, ref: "tests/weapon-handling.spec.js#moving loaded rig", status: pass}
    human_judgment: false
  - id: D3
    description: Mounted bot and remote M4 owners update once per common phase and preserve sibling templates
    requirement: ANIM-05
    verification:
      - {kind: unit, ref: src/network/remoteActors.test.js, status: pass}
      - {kind: e2e, ref: "tests/weapon-handling.spec.js#actors:", status: pass}
    human_judgment: false
  - id: D4
    description: Natural moving anatomy, thumb and fingertip clearance, and visible first-person handling
    verification: []
    human_judgment: true
    rationale: Instrumented contact and agent pixel inspection cannot record human aesthetic acceptance; plan07 must create and qualify the visible first-person rig, and the later moving review remains mandatory.
actuals:
  tokens: 13977
  tasks: 3
  commits: 7
plan_head_before: 20eb3491470578be661e307df280c019a642700e
plan_head_after: 336099e45c686a3b29d241bd87aca5071f066599
duration: approximately 34min including initialization and fixture diagnosis
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 6: Articulated Weapon Handling Summary

**Current M4, P90, AWP and M9 renders sample independent magazine/charging parts and bounded third-person hand contact from the existing action phase, with one disposable mounted actor owner.**

## Performance

- Execution began approximately09:38UTC; first RED ran09:40:28UTC; final retained fixture completed approximately10:11UTC. Three tasks and eight deliverable source/test files.
- Actual tokens are ceiling(55,908 realized Git diff characters/4); seven measured TDD/production commits exclude summary/state metadata. Sequential main-checkout execution used the coordinator's temporary protected-branch override, process-local safe.directory and supplied root pin. No package install, branch/worktree creation, source export, asset publication, reset or stash occurred.
- At10:08:56.801UTC, one actual loaded rig at800x600/DPR1 on Windows HeadlessChrome147 with SwiftShader launch policy ran32 warmup and64 synchronous handler samples per weapon. Median M4/P90/AWP/M9 costs were approximately0.30/0.30/0.30/0.20ms; p95 approximately0.40/0.50/0.50/0.40ms; maximum0.60ms. This measures only handling after mixer posing, not rendered frames, the canonical baseline instrument, representative hardware or60FPS. The twelve-profile baseline and budget remain unchanged.
- Exact warmed report: `.planning/research/.cache/07-06-warmed-handling.json`. Its reproducible owned free-port runner is `.planning/research/.cache/07-06-warm.mjs`.

## Accomplishments

- Named receivers, grips, magazines, M4/P90 charging handles, AWP bolt and M9 slide articulate independently in current player1P/3P weapon groups. Sockets share weapon-local grip/support/magazine/charging samples. M4 and AWP magazines move down, P90 top feed lifts up, and M9 magazine moves out of the grip. Authored reload markers entry/remove/insert/charge/recontact/ready remain0/.22/.56/.76/.9/1.
- Reload windows stay M4/P90/AWP/M9=1800/2000/2500/1200ms. AWP bolt presentation fits the existing1100ms firing cadence, with firing-hand release and receiver anchoring; M9 has a distinct slide cycle. Sampling does not award ammunition, change fire eligibility, issue gameplay markers or alter weapon capacities/cadences. Unsupported online shots remain quiet; no extra online weapons/actions were introduced.
- Analytic arms use two rotations per solve, four for normal carry/support and six during AWP bolt manipulation. Firing carry fit is bounded to0.10m, finger joints to0.8rad and differently rolled thumb opposition to0.7rad per joint. The actual inherited +Y finger segments and mirrored rest rolls were inspected. Corrections change quaternions and owned weapon transforms only, preserving bone translations/scales, roots, eyes and the canonical PI/2 mount. The ready posed barrel is tested against actual body heading above0.8 dot product.
- Across seven observed reload phases for each current player weapon, actual support wrist targets satisfy the0.025m test bound; the measured middle-finger second joint differs0.8rad from the restored mixer pose. AWP firing-hand bolt targets also satisfy0.025m. These are instrumented implementation limits, not human-approved anatomical tolerances, exact fingertip collision guarantees or moving aesthetic acceptance.
- One existing magazine part represents removal/replacement continuously; no discarded magazine enters the world and no replacement prop accumulates. Repeated cancellation restores part transforms and keeps zero transient props. Instance owners live in a WeakMap so ordinary Object3D cloning remains valid; disposal restores corrections without disposing borrowed geometry, materials or maps.
- Actual P90 inspection found one `P90` SkinnedMesh, three material groups and2862 vertices, with no independently named top-feed/charging topology. Both loaded and404-missing paths deliberately select the complete articulated original procedural model and expose `Procedural fallback — detailed weapon handling unavailable`. One unmounted `inspectedWeaponFBX` remains available; replacement generations retire stale loads and bound retained inspection geometry. No mesh-order socket inference or detailed FBX contact-pass claim is made.
- Mounted actor handling registers with character disposal and updates once after the common mixer/correction/inertia path. Six remote snapshot updates produced exactly six owner updates at reload phase0.5 under contributing lower locomotion; eight bot ticks produced eight updates, actual muzzle-driven fire and no fabricated bot reload. Retirement disposes the removed owner while a live sibling stays usable and shared skinned geometry receives zero disposal events.

## Task Commits

1. **07-06-01: M4 tracer** — `4141b62` RED, `f11936c` GREEN.
2. **07-06-02: Distinct mechanisms and fallback** — `ef907ea` RED, `d5d4d63` GREEN, `ddfaf0a` corrective canonical-mount/contact fix. The uncorrected d5d4d63 pixel result is historical and is not the qualified final result.
3. **07-06-03: Mounted actor ownership** — `db1453a` RED, `336099e` GREEN.

## Checks Run

| Check | Current result |
|---|---|
| `npm run test:unit -- src/builders/weaponHandling.test.js src/network/remoteActors.test.js src/builders/enemyAnimations.test.js src/builders/animationPresentation.test.js src/builders/weapon3pTransform.test.js` |37 tests in5 files passed;4.28s |
| `npm run test:e2e -- tests/weapon-handling.spec.js --workers=1` |10 cases passed; final retained repeat1.6min, preceding complete pass1.5min |
| `node .planning/research/.cache/07-06-legacy.mjs` |3 existing weapon-basis/GPU-retirement/action-clock cases passed23.4s on owned root-base Vite |
| `npm run lint` |passed |
| `npm run typecheck` |passed |
| `npm run typecheck:mp` |passed |
| `npm run build` |passed1.17s; existing large-chunk warning remains |

All three intentional RED records validate `RED_EVIDENCE_OK`: `.planning/research/.cache/07-06-m4-red.json`, `.planning/research/.cache/07-06-weapons-red.json`, `.planning/research/.cache/07-06-actors-red.json`. Their behavior assertions fail before implementation; no parser/fixture crash is credited as RED. No refactor commit was necessary.

## Retained Actual-Game Evidence

Each following directory contains seven complete800x600 comic game PNGs and `contacts.json`; the four final ready/manipulation/bolt views were inspected by the agent:

- `.planning/research/.cache/07-06-final/weapon-handling-m4-moving--4dc40-ore-end-with-closed-fingers/`
- `.planning/research/.cache/07-06-final/weapon-handling-p90-moving-eec8b-ore-end-with-closed-fingers/`
- `.planning/research/.cache/07-06-final/weapon-handling-awp-moving-fec37-ore-end-with-closed-fingers/`
- `.planning/research/.cache/07-06-final/weapon-handling-pistol-mov-0198a-ore-end-with-closed-fingers/`
- `.planning/research/.cache/07-06-final/weapon-handling-awp-actual-6bd37-terruption-without-outcomes/bolt.json`
- `.planning/research/.cache/07-06-final/weapon-handling-actors-rem-05b48--a-retired-sibling-template/actors.json`
- `.planning/research/.cache/07-06-final/weapon-handling-actors-off-249a0-nd-unsupported-reload-quiet/bot.json`

Earlier tracer/fallback captures under `.planning/research/.cache/07-06-m4-tracer/` and `.planning/research/.cache/07-06-weapons/` are historical; only07-06-final describes the current corrected matrix. Legacy Playwright output shares a directory, so the final matrix was repeated and copied immediately for durable evidence.

## Interface for Plan07

- `createWeaponHandling({weapon, root, skeleton = null})`, `getWeaponHandling(root)`, `sampleWeaponHandling(weapon, pose)`, `updateWeaponHandling(owner, pose)`, `restoreWeaponHandlingBones(owner)` and `disposeWeaponHandling(owner)` are the shared seam. The frozen common pose supplies weapon/alive/upper/action.phase; update accepts no delta and cannot advance gameplay time.
- `owner.parts` exposes receiver/grip/support/magazine/charging (charging maps to the actual named bolt/slide). `owner.sample` exposes finite weapon-local socket targets, marker data, current phase and supported reload/fire/bolt-hand state. Root socket nodes use names such as `m4_supportSocket`. The current camera gun has finite part/socket samples; it does not yet have visible first-person hands.
- Restore prior owned corrections before the mixer. Apply handling after common rest-aware correction and inertia. Capture a hand-owned mount only after asynchronous canonical attachment. Player integration updates once after `finishPresentation`; mounted bot/remote integration updates inside that common finish. Do not call both paths on the same mounted instance.
- This supplies the mandatory third-person arm/finger integration carried by WINDOWS34. Plan07 must consume the same samples on its actual visible first-person rig and prove all four visible hand contacts. WINDOWS34 and shared requirements remain pending until that work and phase verification; human motion/anatomy acceptance remains pending.

## Deviations from Plan

- **[Rule1] Canonical mount capture:** initial capture at module construction preceded asynchronous hand attachment, causing downward guns despite self-target contact metrics. Lazy mounted capture, explicit canonical quaternion and actual posed-forward tests fix this; ddfaf0a contains the correction. Actual pixel review caught the defect before final qualification.
- **[Rule1] Actual anatomy fit:** a0.10m bounded carry correction and AWP support point within the existing fore-end make the inherited arm reach; thumb opposition uses actual differently rolled segments instead of a generic curl axis. No skeleton/mesh/export change occurred.
- **[Rule1] Fresh actor entry:** suppress bind/T-pose inertia capture on normalized reset. New actors now sample their current legal pose on the first frame; ordinary transition inertia remains. Files: enemyAnimations.js and actor fixtures;336099e.
- **[Rule3] Validation environment:** root-relative legacy imports on the retained `/VibeOnDuty/` preview produced duplicate uninitialized modules. An owned free-port root-base Vite/config runner recovered the three unchanged legacy cases. The user's5173 server and unrelated jobs were untouched.
- **Execution process:** one corrective diagnostic run overlapped the tail of an earlier browser run and a source edit caused HMR invalidation. Those results are not qualified evidence; the final ten-case pass was sequential and retained. The SDK plan counter advanced shortly before SUMMARY publication; remaining progress/session/roadmap updates follow its committed summary, with the actual next pointer07-07.

## Remaining Review Limits

The inherited palm/thumb silhouette and natural fingertip clearance need moving human review; agent pixels and wrist residuals are not aesthetic acceptance. The deliberate detailed-P90 fallback is truthful and fully playable, rather than an unimplemented gameplay stub. Visible first-person anatomy/contact is the explicit plan07 dependency. No accepted art,65-joint skin, inherited clips or material maps were exported or changed; inherited redistribution terms remain unresolved. Later07-09/07-10 own combined resource/budget and production online review. No current verification was skipped, and no unresolved introduced stub prevents this plan's scoped goal.

## Self-Check: PASSED

All eight deliverable source/test files, seven measured commits and retained final evidence exist. The current final matrix, focused unit set, legacy recovery, types, lint and build passed. The diff ledger and measured actuals match the recorded before/after commits. Shared requirements are intentionally not marked accepted, and no human aesthetic pass is recorded.
