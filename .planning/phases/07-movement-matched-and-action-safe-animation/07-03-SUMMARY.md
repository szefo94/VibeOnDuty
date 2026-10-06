---
phase: 07-movement-matched-and-action-safe-animation
plan: "03"
subsystem: animation
tags: [original-motion, blender, gltf, exact-aliases, protected-art, recovery]
requires:
  - phase: 07-02
    provides: Retained donor and strict protected motion merge
  - phase: 07-04
    provides: Simulation-owned current action lifecycle
provides:
  - Published 59-action original donor repertoire with exact handling and contact metadata
  - Protected accepted art and 48 inherited occurrences plus immutable prepared aliases
  - Normal-game moving source proof and missing-asset/old-motion fallback controls
  - Exact current source/publication provenance and bounded owned Blender execution
affects: [07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 05]
tech-stack:
  added: []
  patterns: [Explicit saved action slots, Parent-first world-rest retarget, Immutable clip preparation, Retained accepted baseline]
key-files:
  created: [src/builders/enemyGLTF.test.js, tests/animation-motion-source.spec.js]
  modified: [tools/art/build_motion.py, tools/art/motion-manifest.json, tools/art/sources/motion.blend, public/models/enemy.glb, src/builders/enemyGLTF.js, tools/art/motion-pipeline.mjs, tools/art/motion-pipeline.test.mjs, tools/art/pipeline.mjs, tools/art/provenance.json]
key-decisions:
  - "Preserve the accepted art baseline separately from the runtime publication; named original additions never become inherited protected motion."
  - "Keep all 14 future movement/reload candidates previewOnly and owned by Phase5; retain current online M4 timing."
  - "Treat inherited open finger chains and effective weapon contact as mandatory 07-06/07-07 integration work, not aesthetic acceptance."
requirements-completed: [ANIM-02, ANIM-03, ANIM-04]
coverage:
  - id: D1
    description: Saved original repertoire regenerates and publishes while protected art and inherited motion remain exact
    requirement: ANIM-04
    verification:
      - {kind: integration, ref: "node tools/art/motion-pipeline.mjs build --candidate", status: pass}
      - {kind: integration, ref: "node tools/art/motion-pipeline.mjs repeat", status: pass}
      - {kind: integration, ref: "node tools/art/motion-pipeline.mjs recover --demo", status: pass}
      - {kind: integration, ref: "node tools/art/verify-export.mjs --motion", status: pass}
      - {kind: integration, ref: "node tools/art/motion-pipeline.mjs publish --latest", status: pass}
    human_judgment: false
  - id: D2
    description: Actual game loads moving authored walk/reload, decoded packed maps and usable negative fallbacks without template corruption
    requirement: ANIM-02
    verification:
      - {kind: unit, ref: "src/builders/enemyGLTF.test.js", status: pass}
      - {kind: e2e, ref: "tests/animation-motion-source.spec.js", status: pass}
    human_judgment: false
  - id: D3
    description: Secure per-weapon grips and natural full transition quality after handling/view integration
    requirement: ANIM-03
    verification: []
    human_judgment: true
    rationale: Finger/contact correction belongs to07-06/07-07; actual moving human review remains required. Short-turn correctness sampling at0.1x does not establish normal-speed aesthetic acceptance.
actuals:
  tokens: 47642
  tasks: 2
  commits: 5
plan_head_before: 3e4341ec8360ad435f83631881a994f568677667
plan_head_after: 9ae5a40ffa52b9ee118fad49e93ef591514b2a55
duration: approximately 65min from first RED commit, including contended exports
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 3: Original Motion Repertoire and Actual Loading Summary

**A retained 59-action donor retargets into the shipped human, preserving accepted art and all 48 inherited occurrences while normal gameplay loads authored motion and safe fallbacks.**

## Performance

- Two tasks, eleven deliverable files. First RED commit at2026-10-06T04:57:44Z; initialization reads preceded it. Closeout approximately2026-10-06T06:03Z. Actual tokens are ceiling(190,566 realized Git diff characters/4); binary files use Git binary-diff markers, not binary bytes or harness tokens.
- Five measured production/TDD commits, excluding summary/state metadata. Work ran sequentially in the supplied main checkout under the coordinator's temporary protected-branch override; no worktree/branch/reset/stash or package installation was used.
- Final repeat **390,344ms**, editable recovery **842,319ms**. Host timing was contended. An unrelated MP process command was observed, its cwd unknown; no causation, representative-device, FPS or baseline comparison is claimed. The canonical twelve-profile baseline was untouched.

## Accomplishments

- **45 current actions:** sixteen weapon ready/ADS/fire/reload variants; twelve forward/back/left/right walk/run/crouch gaits; crouch idle; stop/reversal/two stationary turns; two-handed sprint; compact jump start/loop/land; two melee variants; throw; restrained damage; four directional0.65s settled deaths.
- **14 Phase5 previews:** four base-times1.15 sprint reload comparisons, distinct one-handed supersprint, and slide/dive/prone entry/hold/exit. These add no input, velocity, stamina, collision, ammunition, server intention or movement permission. Current online M4 reload remains1800ms.
- Original neutral/rest curves use world-space hand paths and bounded two-segment arm reach. M4 bottom magazine/charging, P90 top-feed/charging, AWP magazine/right-hand bolt and M9 grip magazine/slide have distinct contact goals and normalized phases. Goals alone do not establish fitted weapon-part contact.
- Runtime uses exact `vod7_` names from the static bounded manifest. Existing aliases remain fallbacks; full skeleton cloning remains. Preparation copies clip/track buffers, strips only rest-equivalent position/scale tracks, preserves non-rest constants, normalizes signs and aligns jump boundaries. Duplicate source-ID lookups do not duplicate live semantic action enumeration.
- Publication preserves render graph, mesh, skin/inverse binds, materials/images and all48 inherited occurrences exactly. Only the59 approved additions change motion. Bounded vertical pelvis compression/collapse is allowed; horizontal root/body travel rejects.

## Task Commits

1. Task07-03-01 RED: `e548210` — require original weapon repertoire.
2. Task07-03-01 supplemental RED: `f336ba0` — reproduce missing owned subprocess deadline.
3. Task07-03-01 GREEN: `e08e0ac` — publish retained repertoire, protected aliases and bounded execution.
4. Task07-03-02 RED: `62e2a23` — real browser source/fallback fixtures and stale provenance identity assertion.
5. Task07-03-02 GREEN: `9ae5a40` — current original-source/publication provenance with historical evidence retained.

## Checks Run and TDD Evidence

- Repertoire RED asserted missing `m4_ready`; provenance RED asserted historical source `d8f6c231…` against current `5a9e8c4c…`; deadline RED demonstrated successful completion after4810.9ms despite an injected20ms limit. The records `.planning/research/.cache/07-03-repertoire-red.json`, `.planning/research/.cache/07-03-timeout-red.json`, and `.planning/research/.cache/07-03-provenance-red.json` received SDK `RED_EVIDENCE_OK` before their associated production changes. The initial repertoire record needed TAP normalization before the SDK gate accepted it; the assertion itself was real.
- Final Node motion controls: **34/34 passed**,68.1806s; includes corruption/path/publication controls and the new owned-child deadline. Existing inspector controls: **12/12 passed**,20.368s. Final loader/provenance unit suite: **5/5 passed**,820ms; actual GLB buffers, sibling/template isolation, constant transforms, exact aliases, stable death endpoints, preview timing and horizontal travel rejection are covered. Image mocks are scoped to Node; browsers decode shipped packed images.
- Final real browser suite: **4/4 passed**,1.5m. Enabled Training Range opens through normal prefix-aware loading on an owned free loopback Vite listener. Actual player mixer frames play walk/reload at1x; maps decode; root/simulation remain fixed; temporary render camera restores in `finally`. Missing GLB enables procedural play; an unchanged48-occurrence old-motion response remains playable and cannot count as authored success.
- Short0.4s stationary turn is observed on the natural render clock at**0.1x** so contended browser IPC cannot miss the entire transition. This verifies changing feet/root isolation, **not normal-speed turn aesthetics**. Initial fixture runs missed the short turn and compared reload recontact against a late manipulation snapshot; final fixtures capture the actual time-zero entry synchronously and then observe real moving frames. No source tuning was made for these sampling errors.
- Lint, root types, multiplayer strict types and diff whitespace checks passed. All requested task verification commands ran. Full phase regression/build and human motion acceptance belong to the coordinator's later gates.
- The repertoire was expanded before the first browser walk proof. This deviates from the intended early tracer order; no early gameplay feedback gate is claimed. Eventual actual-game walk/reload proof and all candidate/recovery/publication checks passed. No undo or second publication was performed merely to recreate that historical order.

## Exact Identities and Retained Evidence

| Identity | SHA256 |
|---|---|
| Protected accepted Phase6 GLB | `3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847` |
| Current runtime GLB | `8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936` |
| Saved donor | `5a9e8c4c160cd4d7bb072f724e28dbb52b902f05d75d68a37c68d98449470903` |
| Manifest | `af139b82f372c8b66c994a519fbe5a685cae23dc5b5153c8607578ef02f296c5` |
| Author/retarget script | `806d39e0ed030c0da1e862eae20653a9d63e0bd3ca83c1a941a12bd3ff160d70` |
| Motion pipeline | `e5108c73eac33d821fe1e860e473413cba9a2070e5d7c2d22daf2fab0437391d` |
| Inspector | `c277cd224b95e8a8e9192f82e4d0de1e9960645625fb6d7e7d7dd631c518f0bb` |
| Blender4.5.13 LTS archive | `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6` |

- Current candidate report: `.planning/research/.cache/07-motion/candidate-cCoP1y/report.json`.
- Canonical matching reports: `.planning/research/.cache/07-motion/{latest,repeat,recovery,verification,publication}.json`; provenance retains their exact hashes and full owned directory paths. Recovery inputs/artifacts are `.planning/research/.cache/07-motion/recovery-J9wX5O/`; before completed07:29:11.948, changed07:32:59.132, restored07:35:45.959 and independent07:38:45.736 local. Recovery report completed07:38:53.316; separate verification completed07:40:23.429 local.
- Actual full800x600 game frames and `frames.json`: `.planning/research/.cache/07-03-browser-pass/animation-motion-source-or-f220c-cal-reload-over-real-frames/`. Five walk and seven reload PNGs are retained. `reload-0.png` was inspected by the agent; this is no human aesthetic pass.
- Earlier `e8a6b4ef…` source reports and8.8/18.7s plan02 figures are historical. They do not qualify this source.

## Creator and Runtime Facts for Plan10

- Exact action IDs, frame ranges,60fps source keys, duration remapping, aliases, preview ownership, mechanisms, contacts and markers are in `tools/art/motion-manifest.json`. Every donor action is `Original_{id}`, target clip `vod7_{id}`, slot `OBMotionDonor`, saved object `MotionDonor`. Fresh Blender disables autoexec, reopens then appends only the named rig/actions, and retargets world-rest deltas parents first.
- Twenty-one mapped target bones: pelvis; spine01–03; neck01; both clavicles/upperarms/lowerarms/hands; both thighs/calves/feet/balls. The complete inherited65-joint skeleton remains. Contact coordinates use Blender metres (+X left, -Y forward, +Z up); Three conversion is `[x,z,-y]` before actor transforms.
- Authored cycle distances: walk2.4m, run/two-hand sprint3.1m, crouch1.65m, preview supersprint3.3m. Contact phases0/0.5; torso bound0.7rad; turn entry/plant/pivot/recontact/ready0/.25/.55/.85/1. Death duration0.65s, stable final pose from phase0.82. Jump candidates fit existing runtime windows via action duration fitting.
- Reload markers entry/remove/insert/charge/recontact/ready0/.22/.56/.76/.9/1. Base windows M4/P90/AWP/M9=1.8/2/2.5/1.2s; preview comparisons=2.07/2.3/2.875/1.38s, exactly base×1.15. Throw release phase0.45 is data; simulation owns release/outcomes.
- Creator command order: `build --candidate`, `repeat`, `recover --demo`, independent `node tools/art/verify-export.mjs --motion`, then `publish --latest` through `motion-pipeline.mjs`. Publication rejects foreign/stale source, manifest, script, runtime, repeat/recovery and independent identities. Update `sourceHash` after an intentional saved donor edit; `baselineHash` remains the accepted Phase6 art identity. Retained baseline publication prevents promoting new motion into the inherited domain.
- The shared art `run` helper now gives future owned Blender invocations a900000ms deadline, terminates only the returned child handle and rejects expired work. The initial qualified publication completed before this guard addition; the fast negative proves the guard separately. No failed/timed-out command is recorded as current passing evidence.
- New curve authorship remains separate from unresolved inherited rig/mannequin/Mixamo/weapon-FBX redistribution terms. No new external motion was acquired and no combined asset license clearance is claimed. Documentation edits belong to07-10.

## Deviations from Plan

- **[Rule2] Required pipeline metadata/protection extension:** strict known authored fields,128KiB manifest limit, exact duration remapping, bounded vertical pelvis tracks, retained accepted baseline and matching repeat/recovery/independent publication gates. Files: `motion-pipeline.mjs`; protected-domain and negative controls passed.
- **[Rule1] Constant export transforms:** Blender emitted STEP/two-endpoint held channels. Only proven-constant transforms normalize to three LINEAR samples; non-rest holds survive and changing STEP channels reject.
- **[Rule3] Export cost:** parent-first retarget computes resolved pose matrices in memory and defers mesh deformation during key generation, avoiding per-bone full-scene updates. Only owned earlier Blender invocations were stopped to adopt the optimization; the final corrected chain completed uninterrupted.
- **[Rule2] Execution reliability:** shared `pipeline.mjs` gained a generous owned Blender deadline after the qualified chain; `motion-pipeline.test.mjs` proves expiry with a short injected child limit. No generic job framework or unrelated process termination was added.
- **Process order:** full repertoire authoring preceded browser tracer feedback, as described above. Final required proof exists; historical order is not rewritten.

## Known Stubs and Mandatory Carry

| File | Limitation | Required owner |
|---|---|---|
| `tools/art/build_motion.py:83`, inherited finger chains in the shipped rig | Finger chains remain inherited rest/open; effective support-grip fit is visible in the actual `reload-0.png`. Contact targets are goals, not secure physical grip acceptance. | **07-06 weapon handling and07-07 first-person/body view must add bounded per-weapon anatomy/finger/contact correction. ANIM-02/D-03 cannot be accepted until this is resolved.** |

This is an intentional integration boundary for the retained source candidate, not optional polish. Windows ledger **34** records the same mandatory carry. Shared requirements remain pending; no human aesthetic acceptance is recorded. Agent inspection cannot close that acceptance.

## Next Phase Readiness

Plan05 can consume the exact authored slots/immutable clip helpers and plan04's simulation clock. Plans06/07 must resolve ledger34 before phase acceptance; plan09 measures/reviews the final combined behavior and plan10 consumes these source/provenance/command facts. Phase5 owns future movement gameplay and final ANIM-01 integration.

## Self-Check: PASSED

All eleven deliverable files and five measured commits exist. Current published/source/manifest hashes match the provenance unit test; all stated current gates passed. Canonical artifacts are on disk, protected inherited domains remain exact, and the mandatory later grip integration is explicitly retained.
