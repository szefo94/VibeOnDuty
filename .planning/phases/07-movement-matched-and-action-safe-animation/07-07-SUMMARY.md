---
phase: 07-movement-matched-and-action-safe-animation
plan: "07"
subsystem: animation
tags: [first-person, skinned-view, weapon-contact, ads, resource-ownership]
requires:
  - phase: 07-05
    provides: Shared normalized presentation and sampled source bones
  - phase: 07-06
    provides: Weapon-specific moving parts, sockets and bounded contact correction
provides:
  - Accepted-skin animated first-person forearms and hands with an owned gun copy
  - World-root down-look torso, equipment, thighs, knees and feet
  - Four-weapon physical manipulation and monotonic 120ms ADS on every quality tier
  - Exception-safe view handoff and template-safe idempotent retirement
affects: [07-08, 07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Sampled bone copying without a second mixer, Owned selected geometry with closed skinned boundaries, Fixed gun anchor with bounded arm solves, Reversible render selection]
key-files:
  created: [src/builders/firstPersonRig.js, src/builders/firstPersonRig.test.js, tests/first-person-rig.spec.js]
  modified: [src/builders/enemyGLTF.js, src/builders/characterResources.js, src/builders/weaponHandling.js, src/loop.js, src/combat/shoot.js]
key-decisions:
  - "Copy the already sampled source bones and pre-handling correction snapshots; no second mixer or independent action clock."
  - "Own the rendered gun geometry while keeping the original camera gun, simulation muzzle and gameplay outcomes unchanged."
  - "A bounded first-person body fit exposes lower anatomy; source roots, bone scales, world floor heights and third-person placement stay authoritative."
requirements-completed: [ANIM-02, ANIM-03, ANIM-05]
coverage:
  - id: D1
    description: Loaded first-person hands/forearms and down-look torso/equipment/thighs/knees/feet with one V view owner
    requirement: ANIM-02
    verification:
      - {kind: unit, ref: src/builders/firstPersonRig.test.js, status: pass}
      - {kind: e2e, ref: "tests/first-person-rig.spec.js#tracer: and lit: full-pitch", status: pass}
    human_judgment: false
  - id: D2
    description: M4/P90/AWP/M9 actual visible ready/fire/reload/manipulation/recontact and ADS on Low/Medium/High
    requirement: ANIM-03
    verification:
      - {kind: e2e, ref: "tests/first-person-rig.spec.js#lit: actual visible view contacts", status: pass}
    human_judgment: false
  - id: D3
    description: Render exceptions, death/menu/life boundaries and double disposal preserve eyes, templates and keeper rigs
    requirement: ANIM-05
    verification:
      - {kind: e2e, ref: "tests/first-person-rig.spec.js#tracer: render exception, lifecycle: and runtime:", status: pass}
    human_judgment: false
  - id: D4
    description: Natural moving grips, fingers, body/view transitions and camera comfort
    verification: []
    human_judgment: true
    rationale: Real pixels and measured palm residuals establish implementation behavior, but human moving anatomy/comfort acceptance is still required at the phase review.
actuals:
  tokens: 14937
  tasks: 2
  commits: 4
plan_head_before: 93ec2d654afed638cae7bc8c25f2390bb1d4c775
plan_head_after: b1e2801bf90dd174b0db0b464cf9c46509e7677c
duration: approximately 49min
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 7: First-Person Human View Summary

**The accepted human skin supplies animated first-person hands and forearms, a visible down-look body and four-weapon physical handling from the existing action phase, with an owned rendered gun and restored simulation camera.**

## Performance

- Started approximately10:20UTC; first intentional RED ran10:23:13UTC; final code commit11:03:38UTC; legacy and warm diagnostic completed11:04:32UTC. Two tasks and eight deliverable source/test files.
- Actuals use ceiling(59,747 realized Git diff characters/4), with four measured TDD/production commits. The metadata commit is separate. Main-checkout execution used the coordinator's temporary default-branch override, process-local safe.directory and supplied root guard; the coordinator-owned config change was never staged.
- No second mixer advances. Each view copies the already sampled source bones and shares exactly equal owned skeleton bindings across its painted domains. The retained view owns two Skeletons,131 copied geometries and zero mixers; six packed maps remain borrowed. Geometry and normal/index buffers are owned, with template buffers intact.
- One actual loaded actor at800x600/DPR1 in Windows HeadlessChrome147 with SwiftShader policy ran32 warmup and64 synchronous view updates per weapon. All four median costs were approximately0.30ms, p95 approximately0.40ms; the P90 maximum was1.30ms and other maxima0.40ms. These timings include view pose/appearance copy, motion, matrices and handling, after the source mixer; they exclude rendering and are not a matched whole-animation budget result or device/FPS qualification.
- Retained diagnostic: `.planning/research/.cache/07-07-warmed-view.json`; reproducible owned listener runner: `.planning/research/.cache/07-07-warm.mjs`. The immutable twelve-profile baseline and `evidence/07-budget.json` were not regenerated or widened. Plan07-09 owns the matched combined resource/timing instrument.

## Accomplishments

- Two accepted full SkeletonUtils hierarchies retain all65 joints and inverse binds. View-owned triangle selection renders lower arms/hands and world-root body surfaces while excluding upper-arm shoulder plates and head/neck/face surfaces. Welded selected boundaries get owned skinned caps in the adjacent paint domain. Original lighting normals survive; comicNormal never replaces them. Packed paint, anatomical proportions, template geometry and bone translations/scales remain intact. No GLB, Blender source, motion export or dependency changed.
- The world body follows the source floor, stance, heading and pose. Its first-person-only fore/aft fit is `-.18 + .43 * clamp(-cameraPitch / 1.1, 0, 1)` metres along source forward: a bounded range of−18cm through+25cm. This exposes torso/equipment, thighs, knees and feet under down-look without moving the source root, simulation eye, collision or third-person body. Standing and crouched calf/foot projections are within the extreme down-look viewport, and their world Y equals the source bones' Y. Extreme up/down captures show no head/neck interior.
- The forearm root uses camera pitch once and fits the sampled shoulder height to−22cm in camera space. Copying the source's pre-presentation spine quaternion prevents applying world torso pitch again; copying the source handler's saved pre-correction bone quaternions prevents double finger curl. Neither view owns an action clock, independent mixer, outcome callback or gameplay permission.
- The owned view gun clones all four current first-person geometries. A source gun already posed mid-reload is restored from its handler's rest transforms before capturing view rest, so preview/replacement cannot double magazine displacement. The original camera gun and its flash remain the simulation source. Its observed flash position/quaternion/scale and shared opacity feed the corresponding view flash at the new rendered muzzle; first-person render selection hides the original gun.
- Fixed-anchor handling solves both palms around the actual rendered gun: four bounded analytic arm rotations, no carry translation, per-joint finger closure≤0.8rad and thumb opposition≤0.7rad. All M4, P90, AWP and M9 ready/fire/reload/manipulation/recontact samples satisfy the0.025m wrist-to-palm target residual bound. Ready palms are actually projected inside the viewport and barrel forward alignment exceeds0.9 against camera aim. These are implementation assertions, not human-approved anatomical/fingertip collision tolerances.
- Normal reload framing raises/turns the owned gun according to the shared authoritative phase, making skin hands and the removed magazine visible. Each supported mechanism preserves plan06's independent part/socket trajectory and existing M4/P90/AWP/M9 reload windows1800/2000/2500/1200ms; AWP fire/bolt still fits1100ms. No magazine prop accumulates. P90 inspected and404 paths both truthfully select `Procedural fallback — detailed weapon handling unavailable`; neither is credited as detailed FBX articulation.
- ADS starts on the first presentation update and monotonically reaches both endpoints in120ms with smoothstep interpolation and no overshoot. Optional added hip sway is bounded to3mm horizontally/4mm vertically, attenuates to zero in ADS, and is zero under reduced motion. No added camera bob/roll exists. Source default160ms pose settling and current authoritative phase remain in control. Existing recoil/accuracy/firing eligibility, FOV targets and AWP overlay/crosshair behavior are preserved.
- The V camera transition remains existing behavior, while render selection draws one arm pair and gun. View arms and gun do not cast world shadows; the selected world body and original third-person body keep their existing casting ownership. All temporary view visibility is restored in finally, and the outer loop restores the simulation eye after a real injected GPU exception. The source root and aim are unchanged. Killcam keeps its existing camera ownership.
- Reduced motion and Low/Medium/High retain required limbs, contacts, mechanisms and posture. Actual normal gameplay fire/reload, throw and melee interruption, death/fresh-life and menu retirement clear the current view/parts without awarding canceled reload ammo. Original borrowed geometry/maps receive zero disposal events; owned geometry receives exactly one disposal event. A live keeper and new clone remain finite and playable after double retirement. Source-disposer unsubscription avoids retaining retired views on a live source. Owned team accents copy the current source colors without touching shared paint.

## Task Commits

1. **07-07-01 M4 tracer:** `18a293e` RED; `1ccde8c` GREEN.
2. **07-07-02 Four-weapon/accessibility/retirement:** `45fa6bd` RED; `b1e2801` GREEN.

## Checks Run

| Check | Current result |
|---|---|
| `npm run test:unit -- src/builders/firstPersonRig.test.js src/builders/weaponHandling.test.js src/builders/enemyAnimations.test.js src/builders/characterAppearance.test.js src/builders/weapon3pTransform.test.js` |28 tests in5files passed426ms |
| `npm run test:e2e -- tests/first-person-rig.spec.js --workers=1` |12 actual-browser cases passed2.3min after the final down-look fit; all four weapons, three tiers, P90 inspection/missing paths, pitch/stance/V, exceptions and lifecycle |
| `node .planning/research/.cache/07-06-legacy.mjs` |3 unchanged armed-basis, GPU-retirement and live action-clock regressions passed15.2s on an owned root-base listener |
| `npm run lint` |passed |
| `npm run typecheck` |passed |
| `npm run typecheck:mp` |passed |
| `npm run build` |passed411ms; existing large-chunk warning remains |
| `node .planning/research/.cache/07-07-warm.mjs` |one qualified diagnostic run; not matched budget/FPS evidence |

Tracer feedback after its GREEN commit reran its unit and three browser cases successfully before expansion. Both persisted intentional RED records passed `RED_EVIDENCE_OK`: `.planning/research/.cache/07-07-tracer-red.json` and `.planning/research/.cache/07-07-motion-red.json`. Each target assertion failed on the planned missing behavior, with no fixture/parser failure credited as RED. No refactor-only commit was necessary.

## Retained Actual-Game Evidence

Canonical final matrix: `.planning/research/.cache/07-07-qualified/`, copied immediately after the final12-case pass, before legacy output could clear it. Files include:

- `first-person-rig-lit-m4-ac-17467--manipulation-on-every-tier/view-contacts.json` and M4 Low/Medium/High ready, removal, recontact, settled ADS, fire and reduced-motion reload PNGs.
- `first-person-rig-lit-p90-a-1f23c--manipulation-on-every-tier/view-contacts.json` and the same P90 fallback capture surfaces.
- `first-person-rig-lit-awp-a-93827--manipulation-on-every-tier/view-contacts.json` and AWP reload/actual bolt-hand firing captures.
- `first-person-rig-lit-pisto-a8b77--manipulation-on-every-tier/view-contacts.json` and M9 grip-magazine/slide captures.
- `first-person-rig-lit-full--d7e80-n-one-anatomy-and-gun-owner/pitch.json` and eight full-pixel standing/crouched pitch captures from−1.38 through+1.38rad.
- `first-person-rig-runtime-n-bc0ae-and-menu-clear-current-view/runtime.json` describes the normal-game action/life/menu observations.

The final weapon manipulation, bolt, body and extreme-pitch pixels were inspected by the agent. Earlier `.cache/07-07-tracer/` and `.cache/07-07-final-matrix/` are historical and do not qualify the final down-look fit. Human moving anatomy, transition and comfort approval remains pending.

## Integration Interface for Plan08

- `createFirstPersonRig({source})` clones an accepted full source hierarchy; source may be an isolated review actor. The original runtime actor userData objects are restored exactly even if cloning throws. Bounded metadata copying excludes actor back-references before Three r160's JSON-copy operation.
- `updateFirstPersonRig(rig, {pose, camera, weapon, active=true, thirdPerson=false, spineQuaternion, rawCorrections=[], eyeHeight=1.65, dt=.05})` reads the current normalized pose and camera. `weapon` is the complete source camera-gun group containing named `m4_1p`, `p90_1p`, `awp_1p` and `pistol_1p` children; its geometry, transforms and original gameplay flash are never disposed or moved by the view. The rendered gun lives in `rig.weapon` under the supplied camera.
- Pass the source actor's `_presentationCorrection.get(source.getObjectByName('spine_03'))` as `spineQuaternion`. Pass its current world handler's `corrections` as `rawCorrections`, after common source finish/handling. For the player this is `playerWeaponHandling.get('3p:'+weapon).corrections`; a mounted review actor can use its existing `getWeaponHandling(...)` owner. These snapshots remove doubled pitch and finger closure.
- `renderFirstPersonRig(rig, {weapon, worldWeapon, firstPerson, active}, render)` selects view ownership only for the callback and restores visibility in finally. A review-owned camera can render isolated actors without touching gameplay camera state. The caller remains responsible for restoring any camera offsets it applied; the normal loop does so on render failure.
- `disposeFirstPersonRig(rig)` retires owned geometry, skeletons, accents, ink registrations, parts/owners and source callbacks idempotently. `rig.pose`, `rig.motionSample`, and each handler's `sample`/`contacts` are callback-free scalar/array observations suitable for a serialized review projection. The rig exposes no ammo, damage or input mutation API. View source mesh references should not be serialized directly.
- `sampleFirstPersonMotion(state, pose, dt)` owns only the bounded cosmetic ADS transition; action phase always comes from `pose.action.phase`. New identities reset it. The existing character disposer now returns an optional unregister function; existing callers may ignore it.

## Deviations from Plan

1. **[Rule2 - Required first-person anchor]** Extended `src/builders/weaponHandling.js` with a fixed-anchor branch so both hands follow the actual camera-relative rendered gun. Third-person canonical mount/carry/AWP receiver anchoring remains intact. Borrowed simulation gun resources are unaffected.
2. **[Rule1 - Actual pixel defects]** Case-sensitive `Head` initially escaped selection, and inherited camera-gun framing occluded visible hands. Case-aware head/neck exclusion, owned gun framing and closed selected buffers fixed these before tracer GREEN. Final pixel review also rejected torso-only down-look; the bounded body fit and actual calf/foot projection/floor assertions corrected it before final task2 GREEN.
3. **[Rule1 - Clone/replacement ownership]** Runtime actors carry cyclic `enemyGroup` observations, and posed source guns can have displaced magazines. The bounded clone metadata/finally path, exact node correspondence, canonical part-rest capture, source-disposer unregister, source accent sampling and exactly equal owned-skeleton reuse fix these in `b1e2801`. `characterResources.js` was the planned lifetime seam.
4. **Validation environment:** All new/legacy browser suites use owned free-port root-base listeners and run sequentially; the user's5173 listener and unrelated jobs were untouched. Daylight cases enter actual Greek Columns via its normal start, retaining its existing lights and packed maps. Earlier tracer illumination experiments are historical, not canonical final evidence.
5. **State bookkeeping:** The required SDK requirement command optimistically checked ANIM-02/03/05 despite remaining phase plans and human gates. Only those three checkbox/table fields were restored to Pending to honor the coordinator's partial-phase acceptance boundary. SDK plan/progress/metric/decision/session/roadmap updates remain applied, with the actual next pointer07-08.

## Remaining Review and Mandatory Carry

The technical integration requested by WINDOWS34 is now implemented in both third-person plan06 and visible first-person plan07, with individual four-weapon contact, finger and moving-part cases. The SDK marked WINDOWS34 fixed after the qualified final matrix; this resolves the missing runtime integration only, and does not record human anatomical or moving-grip acceptance. No new TODO, placeholder, skipped test or unrun plan verification remains. Detailed imported P90 handling is a truthful inspected fallback, not a claimed FBX contact pass.

Shared ANIM requirements remain pending phase/code/UI/production/matched-budget review and explicit human motion/anatomy/comfort acceptance. The required frontmatter copies this plan's assigned requirement IDs; it does not confer human acceptance. Inherited redistribution terms and Phase5 actual omnimovement integration remain unchanged. No network endpoint, auth path, schema or new trust-boundary outcome permission was introduced.

## Self-Check: PASSED

All eight deliverable files, four measured task commits and canonical retained12-case evidence exist. Focused units, all new browser cases, the three owned legacy cases, lint, both type checks and build passed. The persisted Git ledger measured four commits and59,747 diff characters with the recorded base/head. No tracked deletion occurred, no generated file is left untracked, and no human aesthetic acceptance or matched device/FPS pass is claimed.
