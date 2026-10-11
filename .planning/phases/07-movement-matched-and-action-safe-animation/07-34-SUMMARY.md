---
phase: 07-movement-matched-and-action-safe-animation
plan: "34"
subsystem: animation
tags: [three.js, animation-mixer, clip-composition, two-bone-ik, first-person, vitest, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-27 composed live clips (buildLiveClips, findLiveClip), 07-28 look-down offset and its guard, and the diagnosis in .planning/debug/phase7-repair-browser-failures.md"
provides:
  - "buildLiveClips in src/builders/enemyGLTF.js: composed crouch and jump clips keep the authored horizontal pelvis position and take only the pelvis height from the inherited clip"
  - "src/builders/firstPersonContact.test.js: view-arm contact error per weapon and state on the real rig, one driver as src/loop.js, against a separately built authored-clip player"
  - "Per-key guards and figures for the eight changed clips in src/builders/liveClipRoute.test.js; figures that supersede 07-27-SUMMARY.md for crouch and jump"
affects: [07-29, 07-30, 07-31, 07-32, 07-33, phase-5-omnimovement]

actuals:
  tokens: 11258
  tasks: 2
  commits: 3

plan_head_before: 79e0f3dcbd5a1073d8a359df5c36b7c42d462ea6
plan_head_after: 2114fb2a22179e87988e2bfc6e66982779d26bb4
commits: 3

tech-stack:
  added: []
  patterns:
    - "A view guard drives one player as src/loop.js runs a frame and compares it, tick for tick, with a second player built from findMotionClip under identical input"
    - "A relative limit against the authored clips where no absolute figure was ever measured"
    - "A control that rebuilds the withdrawn composition inside the test and must break the limit"

key-files:
  created:
    - src/builders/firstPersonContact.test.js
  modified:
    - src/builders/enemyGLTF.js
    - src/builders/liveClipRoute.test.js
    - src/builders/firstPersonLookDown.test.js

key-decisions:
  - "The pelvis rule was applied to every composed clip without pelvis sway that is not a held idle clip (crouch idle, four crouch walks, three jump clips) already in task 1, because the plan's own task 1 verify requires the edited composition case, which covers all of them, to pass"
  - "Held idle clips (ready, stop, reversal, turns) also have sway 0 but are excluded: the plan keeps the idle legs unchanged"
  - "The contact test mounts the third-person weapon on the right hand of the driven player, as the game does; without a mount the AWP reload path of weaponHandling.js throws in Node"
  - "No requirement is marked complete; ANIM-02 and ANIM-03 stay with plans 07-32 and 07-33"

patterns-established:
  - "Figures the plan does not limit are recorded by the tests and asserted against nothing"

requirements-completed: []

coverage:
  - id: D1
    description: "In first person both view hands reach their contact points for M4, pistol, AWP and P90 in every listed state; no error exceeds the authored-clip player's by more than 0.005 m, and M4 and pistol stay within 0.005 m absolutely"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/firstPersonContact.test.js#no view hand is further from its contact than with the authored clips, plus 0.005 m"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonContact.test.js#both view hands are within 0.005 m of their contacts in every state"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonContact.test.js#at 1/60 s per tick both view hands stay on the weapon from the first crouch tick to the 200th"
        status: pass
    human_judgment: true
    rationale: "Measured in Node on bone positions. No browser ran, the failing browser case of tests/first-person-rig.spec.js was not re-run here, and no one has looked at the view."
  - id: D2
    description: "The pelvis of the composed crouch and jump clips is at the authored horizontal position at every key, with the inherited height; shoulders, head and chest are where standing has them fore and aft; ankles within 0.03 m of the inherited ankles"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#the pelvis of a composed crouch or jump clip stays over the root"
        status: pass
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#composes every routed action from its inherited legs and its authored upper body"
        status: pass
    human_judgment: true
    rationale: "The leg shape changed (rear knee 0.11 to 0.14 m above the floor in crouch idle, a fully straight leg at the end of the landing). Whether that looks acceptable is the owner's judgment in plan 07-33."
  - id: D3
    description: "Every guard of plan 07-27 passes on the changed composition with its limit unchanged, except the crouch smallest-knee limit, re-derived to 0.12 m by plan 07-34 before the change"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#every in-scope state through the driver"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 34: First-person contact regression, pelvis held over the root Summary

**The composed crouch and jump clips now keep the pelvis at the authored horizontal position and take only its height from the inherited clip. The first-person support hand, which was up to 0.150 m short of the weapon in crouch, is back on its contact point for all four weapons in every listed state (largest error 1.6e-7 m). Verified by unit tests on the real rig only; no browser ran and no one has looked at the result.**

## Contact error per weapon, before and after

Measured by `src/builders/firstPersonContact.test.js`: the live player (`buildPlayerMesh`) and its own first-person rig, driven by one actor object as `src/loop.js` runs a frame, with the real view weapon of `src/builders/weapon.js`. One continuous run per weapon and tick rate (1789 ticks at 1/60 s, 793 at 0.05 s); every tick is measured, also the ticks in which the driver blends between states. An error is the distance between a view hand and its contact target as `updateWeaponHandling` reports it (`leftError` support hand, `rightError` trigger hand), in metres. Each cell is the largest value over both tick rates.

- "Before" is the same test run against `src/builders/enemyGLTF.js` as it was before this plan (SHA-256 `40dad805…0161`), served by a scratch Vitest config; no repository file was changed for it.
- "Authored" is a second, separately built player whose action map is resolved with `findMotionClip`, given identical ticks. It is the behaviour before plan 07-27.
- `0.000` means below 0.00005 m. The largest value behind any `0.000` in the "after" and "authored" columns is 1.6e-7 m.

The trigger hand error is `0.000` for every weapon in every state, before and after (largest 1.3e-7 m). The table is the support hand.

| State | M4 before | M4 after | Pistol before | Pistol after | AWP before | AWP after | P90 before | P90 after | Authored, all four weapons |
|---|---|---|---|---|---|---|---|---|---|
| standing (also at pitch -1.38, -0.9, 0, 1.38; also the ticks between states) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| walk forward, back, left, right (6 m/s) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| run forward, back, left, right (7.44 m/s) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sprint (9.9 m/s) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| first crouch tick | 0.144 | 0.000 | 0.000 | 0.000 | 0.126 | 0.000 | 0.089 | 0.000 | 0.000 |
| crouch idle (also at the four pitches) | 0.150 | 0.000 | 0.000 | 0.000 | 0.131 | 0.000 | 0.095 | 0.000 | 0.000 |
| settled crouch after 200 ticks | 0.146 | 0.000 | 0.000 | 0.000 | 0.128 | 0.000 | 0.091 | 0.000 | 0.000 |
| crouched ADS | 0.138 | 0.000 | 0.000 | 0.000 | 0.120 | 0.000 | 0.083 | 0.000 | 0.000 |
| crouched reload, 12 phases | 0.148 | 0.000 | 0.079 | 0.000 | 0.130 | 0.000 | 0.140 | 0.000 | 0.000 |
| crouch walk (4.32 m/s) | 0.148 | 0.000 | 0.000 | 0.000 | 0.130 | 0.000 | 0.093 | 0.000 | 0.000 |
| jump start (tick rate and 12 phases) | 0.031 | 0.000 | 0.000 | 0.000 | 0.013 | 0.000 | 0.000 | 0.000 | 0.000 |
| jump loop (tick rate and 12 phases) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| jump land (tick rate and 12 phases) | 0.038 | 0.000 | 0.000 | 0.000 | 0.020 | 0.000 | 0.000 | 0.000 | 0.000 |

Largest values after the change, as printed by the test:

| Weapon | Composed, support hand | Composed, trigger hand | Authored, support hand | Authored, trigger hand | Largest composed minus authored on one tick |
|---|---|---|---|---|---|
| M4 | 1.3e-7 (walk left) | 1.2e-7 (sprint) | 1.3e-7 (crouch walk) | 1.2e-7 (sprint) | 2.4e-8 |
| Pistol | 1.1e-7 (crouched reload) | 1.2e-7 (sprint) | 1.1e-7 (crouched reload) | 1.1e-7 (sprint) | 3.0e-8 |
| AWP | 1.6e-7 (standing) | 1.3e-7 (crouched reload) | 1.6e-7 (standing) | 1.3e-7 (crouched reload) | 2.6e-8 |
| P90 | 1.5e-7 (walk back) | 1.3e-7 (sprint) | 1.5e-7 (crouch idle) | 1.2e-7 (sprint) | 2.7e-8 |

What this says, and what it does not:

- **AWP and P90 had never been measured.** With the authored clips their contact error is 0 in every listed state, the crouched reload included. Before this plan the AWP was 0.115 to 0.131 m short in crouch and 0.006 to 0.020 m around a jump; the P90 0.079 to 0.095 m short in crouch and 0.136 to 0.140 m in the crouched reload. The pistol was short only in the crouched reload (0.076 to 0.079 m).
- **Gaits were not a finding.** The view shoulders of the composed player move 0.173 to 0.201 m in front of the eye in the gaits (authored 0.181 to 0.189 m), from the quarter pelvis sway. The error stays 0 for all four weapons. Nothing was returned to the orchestrator, no number was changed.
- In crouch and through the jump chain the view shoulders are now where the authored-clip player has them (crouch 0.181 to 0.189 m in front of the eye, both players). Before, they were 0.036 to 0.051 m behind the eye in crouch.
- An error of 0 means the target is inside the arm's reach: the two-segment solve clamps at full reach, so the figure is the shortfall, not a fit quality.
- States the plan did not list were not measured: standing ADS, standing reload, fire, throw, melee, roll, dance, death, a crouch entered while moving.

### Controls and harness checks (all pass)

| Check | Measured | Limit |
|---|---|---|
| Control, M4: `live_crouch_idle` with the pelvis position of the inherited rifle crouch (the composition of plan 07-27, built in the test), crouch pressed from standing, every one of 200 crouch ticks | support hand 0.140 to 0.149 m at 1/60 s, 0.138 to 0.148 m at 0.05 s | above 0.10 |
| Control, M4, every state, all eight clips with the inherited pelvis position | first crouch tick 0.140 / 0.144; settled 0.140 / 0.146; crouched ADS 0.108 to 0.138; crouch walk 0.117 to 0.148; jump start up to 0.031; jump land up to 0.038; gaits and sprint 0.000 | crouch states above 0.10 on every tick; jump start and land above 0.005; gaits at most 0.005 |
| A player built in the test from the live clips against the builder's player | support hand, trigger hand and view shoulder position equal on all 230 ticks | 1e-9 |
| Both players of a run were given the same run | state, gait, upper action, jump phase and phase equal on every tick; every error finite | exact |
| 12 phases | crouched reload: upper `reload`, phases i/12; jump start and jump land: 12 ticks each at phases i/12; jump loop: 12 ticks over one loop | exact |

## Superseding figures for crouch and jump

These replace the crouch and jump figures of `07-27-SUMMARY.md`. Plan 07-33 reads them. Measured by the helpers of `src/builders/liveClipRoute.test.js` on the built clips. Character forward is +Z; a knee offset is the distance of the knee from the hip to ankle line along +Z.

### Head, chest and pelvis in crouch

Clip alone at its first frame. Negative forward means behind the root.

| Pose | Head height (m) | Head forward (m) | Chest (`spine_03`) forward (m) | Pelvis height (m) |
|---|---|---|---|---|
| composed `live_crouch_idle`, now | 1.121 | 0.005 | -0.005 | 0.469 |
| composed, plan 07-27 | 1.121 | -0.225 | -0.235 | 0.469 |
| whole `rifle_Crouch_Idle_Loop` (before e08e0ac) | 1.064 | -0.085 | -0.184 | 0.469 |
| authored `vod7_crouch_idle` | 1.249 | 0.005 | -0.005 | 0.597 |

Through the driver, crouch idle at 12 phases: head bone 1.124 m high and 0.001 m ahead of the root; `spine_03` 0.870 m high and 0.007 m behind; pelvis 0.469 to 0.477 m high and 0.050 m behind the root, which is where the standing pelvis is. Over all 57 keys the head bone is 1.121 to 1.129 m high.

Against the crouched eye of 0.85 m (`PLAYER_H_CROUCH`): the head bone is 0.27 m above the eye and the chest bone 0.02 m above it. In the first-person body view the eye is 0.185 m in front of the chest at a level view and 0.285 m at the pitch bound, the same as standing (0.184 and 0.284 m). Under plan 07-28's figures the crouched values were 0.415 and 0.515 m. The head height is unchanged by this plan: only the fore and aft position is corrected.

### Through the driver, 12 phases, inertia expired

Weapon yaw, weapon pitch and `spine_03` yaw against the authored actor are 0.0 degrees in all five states, and the upper body bones differ by 0 (limit 1e-6).

| State | Pelvis height (m) | Lowest foot (m) | Largest forward knee offset (m) | Smallest knee offset (m) |
|---|---|---|---|---|
| crouch idle | 0.469 to 0.477 | 0.015 (balls 0.015 and 0.015) | 0.287 | 0.237 |
| crouch walk | 0.465 to 0.525 | 0.014 | 0.361 | 0.152 |
| jump start (airborne bound) | 0.523 to 0.877 | -0.063 | 0.354 | 0.008 |
| jump loop (airborne bound) | 0.868 | -0.073 | 0.285 | 0.065 |
| jump land | 0.433 to 0.927 | 0.011 | 0.346 | 0.003 |

Idle, the gaits and sprint measure what `07-27-SUMMARY.md` records; their clips are unchanged. The fire and reload layers on crouch idle also measure 0.0 degrees.

### The built clips, at every key

| Clip | Keys | Pelvis, local x / y (m) | Smallest knee offset (m) | Largest knee offset (m) | Lowest foot (m) | Farthest ankle from the inherited ankle, at keys / at 12 phases (m) | Keys with a fully straight leg |
|---|---|---|---|---|---|---|---|
| `live_crouch_idle` | 57 | 0.0000 / 0.0501 | 0.237 (right), left 0.284 | 0.287 | 0.015 | 0.0000 / 0.0000 | none |
| `live_crouch_forward`, `_back`, `_left`, `_right` | 39 | 0.0000 / 0.0501 | 0.137 (left), right 0.145 | 0.370 | 0.014 | 0.0000 / 0.0022 | none |
| `live_jump_start` | 26 | 0.0000 / 0.0501 | 0.003 (right) | 0.362 | -0.072 | 0.0013 / 0.0014 | key 2 (0.067 s), right leg, 0.0013 m short of the inherited ankle |
| `live_jump_loop` | 49 | 0.0000 / 0.0501 | 0.064 (right) | 0.285 | -0.074 | 0.0000 / 0.0000 | none |
| `live_jump_land` | 25 | 0.0000 / 0.0501 | 0.003 (right) | 0.346 | 0.002 | 0.0092 / 0.0092 | keys 15 to 24 (0.500 to 0.800 s of 0.800 s), right leg, 0.0042 to 0.0092 m short |

- The horizontal pelvis position equals the authored one exactly at every key (largest difference 0; limit 0.001). The height equals the inherited one to 6 decimals.
- Shoulder shift against the composed standing pose: at most 5.2e-8 m at every key of every clip (limit 0.001). Head bone and `spine_03` in crouch idle: 3.5e-8 m from their standing fore and aft positions (limit 0.02).
- Crouch idle balls: at most 0.015 m above the root (limit 0.03).
- **Crouch smallest knee offset, beside the 0.12 m limit:** 0.237 m in crouch idle and 0.137 m in the crouch walk over every key of the built clips (0.152 m at 12 phases through the driver). The margin at full key resolution is 0.017 m. The plan measured 0.237, 0.152 and 0.137 before the change was written; the built clips measure the same.
- A leg is out of reach of its inherited ankle on 11 keys in total, all on the right leg: one key of the jump start and the last ten keys of the landing. There the leg stays fully extended, 1e-4 m short of straight, with a knee offset of 0.003 to 0.004 m. The plan expected "0.009 at one phase" in the landing; that figure is the largest of ten consecutive keys.
- The ankle limit of 0.03 m holds everywhere; the largest distance is 0.0092 m.

### Front and rear knee in crouch idle

Bone origins over all 57 keys, root at the origin, floor at height 0. The left leg is the front leg (ankle 0.218 m in front of the root), the right leg the rear one (ankle 0.310 to 0.326 m behind).

| Knee | Now: to the side / above the floor / in front of the root (m) | Inherited rifle crouch, as plan 07-27 showed it (m) |
|---|---|---|
| front (left) | 0.205 to 0.215 / 0.499 to 0.500 / 0.381 to 0.384 | 0.183 to 0.195 / 0.529 / 0.164 to 0.166 |
| rear (right) | 0.209 to 0.233 / 0.114 to 0.136 / 0.095 to 0.111 | 0.149 to 0.163 / 0.274 to 0.309 / 0.094 to 0.102 |

The front knee is now 0.38 m in front of the root, 0.03 m beyond the 0.35 m body radius (`PLAYER_R`). The rear knee is 0.16 to 0.17 m lower than before and 0.06 m further out to the side. No leg is fully straight in crouch idle or the crouch walk.

### Look-down screen positions in the settled crouch

Body view of the live player at camera pitch -1.38, after 200 crouch ticks, 75 degree camera at 4:3. Inside the screen is -1 to 1 on both axes. Recorded, asserted against nothing.

| Bone | At 1/60 s per tick | At 0.05 s per tick | Planning prediction |
|---|---|---|---|
| `calf_l` | -0.56, 0.12 | -0.57, 0.12 | -0.45, 0.15 |
| `calf_r` | 0.31, -0.60 | 0.33, -0.59 | 0.30, -0.61 |
| `foot_l` | -0.27, -0.37 | -0.27, -0.37 | -0.26, -0.37 |
| `foot_r` | 0.30, **-1.73** | 0.30, **-1.72** | 0.29, -1.75 |

The right foot is below the screen edge in the settled crouch. `tests/first-person-rig.spec.js` lines 269 to 270 require all four bones on screen at that pitch, on a sample taken one tick after the crouch is entered with two driver objects. That sample was not replayed here; see open items.

## The re-derived limit

One limit of plan 07-27 changed, in the guard table of `src/builders/liveClipRoute.test.js`: the smallest knee offset in crouch states, from at least 0.15 m to at least 0.12 m. The plan declared it before any code, from its own measurement of the changed leg geometry (0.237 crouch idle, 0.152 crouch walk at 12 phases, 0.137 over all 39 keys of the crouch walk; the old shape measured 0.172 and 0.179). It was not moved after a run and may not change again. Every other limit of plan 07-27 is unchanged and passes: weapon yaw 3.5 degrees and range 6.3, weapon pitch 2.5, `spine_03` yaw 3.5, largest knee offset 0.06 m, crouch pelvis 0.55 m, standing pelvis 0.85 m, ankle 0.03 m, crouch ball 0.03 m, idle ball 0.05 m, lowest foot -0.03 m, landing -0.02 m, airborne -0.12 m, death pelvis 0.12 m, the damage limits, the still-foot limits and the upper bone limit.

New limits of this plan, from the plan text: horizontal pelvis position within 0.001 m of the authored one; shoulder shift at most 0.001 m; head and `spine_03` in crouch idle within 0.02 m of standing; contact error at most 0.005 m (M4, pistol) and at most the authored error plus 0.005 m (all four). No measured value missed a limit. No limit was tuned.

## Performance

- **Duration:** 31 min
- **Started:** 2026-10-11T08:47:19Z
- **Completed:** 2026-10-11T09:18:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 source, 1 new test, 2 amended tests)

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/builders/firstPersonContact.test.js src/builders/liveClipRoute.test.js` at `d1815ae` (task 1) | exit 0, 60 of 60 (6 + 54) |
| The five frozen test files (`enemyGLTF`, `enemyAnimations`, `animationPresentation`, `rifleClips`, `firstPersonRig`) | exit 0, 34 of 34, no byte changed |
| `npx vitest run` on the four files of task 2 (`firstPersonContact`, `liveClipRoute`, `firstPersonLookDown`, `presentationInertia`) at `2114fb2` | exit 0, 142 of 142 (33 + 61 + 45 + 3) |
| `npm test` at `2114fb2` | exit 0, 465 tests in 35 files (424 in 34 before this plan) |
| `npm run lint` | exit 0, no warnings |
| `git diff --quiet 1e300c8..HEAD -- src/builders/enemyAnimations.js src/builders/firstPersonRig.js tests public server tools` | exit 0 |
| Allowed-files check since `1e300c8` | exit 0: `enemyGLTF.js`, `firstPersonContact.test.js`, `liveClipRoute.test.js`, `firstPersonLookDown.test.js` |
| `src/builders/enemyAnimations.js` against `3665406` | byte-identical (SHA-256 `f150cb50…2885`) |
| `npm run typecheck` (not required by the plan) | exit 0 |

One intermediate state is on record: between the task 1 source commit and the task 2 commit, `npm test` was 430 of 431, the one failure being the look-down pose assertion the plan tells task 2 to amend: `crouched chest in front of the root: expected -0.005283189859473403 to be close to -0.235, received difference is 0.22971681014052658, but expected 0.005`.

`public/models/enemy.glb` (SHA-256 `2a6bbab2…6e4e`) and `tools/art/motion-manifest.json` are unchanged. Nothing under `tools/`, `tests/`, `public/` or `server/` changed.

Not run: any browser suite, any capture, the build, `tools/art/frozen-bytes.mjs`, the timing gates. No dev server was started.

### TDD record

| Step | Commit | State |
|---|---|---|
| RED, task 1 | `3497de1` | `firstPersonContact`: 2 of 6 failed, 4 passed (the control and the builder equivalence, at both rates). `liveClipRoute`: 2 of 54 failed, 52 passed. |
| GREEN, task 1 | `d1815ae` | 60 of 60. Source only. |
| Task 2 | `2114fb2` | Tests only; 142 of 142 on the source as task 1 left it. No commit-level RED (see deviation 1). |

Failing assertions at RED, verbatim:

- `first crouch tick, tick 30: support hand: expected 0.1397039882331353 to be less than or equal to 0.005` (1/60 s per tick)
- `first crouch tick, tick 30: support hand: expected 0.14467255530932932 to be less than or equal to 0.005` (0.05 s per tick)
- `key 0: pelvis local x against the authored clip: expected 0.03243801370262833 to be less than or equal to 0.001` (the new `live_crouch_idle` case)
- `crouch_idle pelvis local x, key 0: expected 0.03243801370262833 to be less than or equal to 0.001` (the edited composition case)

The 30 standing ticks before the first crouch tick passed the same assertion. Contact error measured by the new test before the change: support hand 0.1397 m on the first crouch tick, 0.140 to 0.149 m over the next 199 ticks at 1/60 s; 0.1447 m and 0.138 to 0.148 m at 0.05 s; trigger hand 0. After the change: at most 1.3e-7 m on every tick.

RED evidence records, in the ignored cache: `.planning/research/.cache/07-34-tracer-red-firstPersonContact.json` and `07-34-tracer-red-liveClipRoute.json`. Both returned `RED_EVIDENCE_OK` (`target_test_failed`) from `check tdd-red-evidence`. Semantic assessment: each target test ran and failed on the planned assertion with a measured value; no load, fixture or syntax failure is credited.

Tracer feedback gate after `d1815ae`: the three task 1 verify commands were re-run at the commit and exit 0, then expansion.

For task 2 the tests were run against the source of before this plan through a scratch Vitest config that serves the saved old file (copies in the cache: `07-34-vitest.before.config.mjs.txt`, `07-34-enemyGLTF.before.js.txt`). Result: `firstPersonContact` 14 of 33 failed (the relative limit for all four weapons at both rates, the absolute limit for M4 and pistol at both rates, the two tracer cases); `liveClipRoute` 9 of 61 failed (the eight held-pelvis cases and the edited composition case); `firstPersonLookDown` 1 of 45 failed (the amended assertion, which there reads -0.235). This is not a commit-level RED. The record for the route file returned `RED_EVIDENCE_OK`; the record for the contact file was rejected by the classifier as `INVALID_RED` (`invalid_record`, malformed TAP: the multi-line object diffs of the failing list assertions break its parser). Its 14 failures are assertion failures, readable in `07-34-expansion-presource-contact.default.log`. No gate depends on that record.

## Permitted edits to existing tests, old and new text

### 1. `src/builders/liveClipRoute.test.js`, guard table (the crouch knee limit)

Old:

```js
  kneeForward: 0.06, crouchKnee: 0.15, crouchPelvis: 0.55, standingPelvis: 0.85, // metres
```

New:

```js
  // crouchKnee was 0.15 for the leg shape of plan 07-27 (measured 0.172 and 0.179). Plan 07-34 holds the
  // crouched pelvis over the feet and re-derived this one limit from measurement before that change was
  // written: 0.237 in crouch idle and 0.152 in crouch walk at 12 phases, 0.137 over all 39 keys of the
  // crouch walk. It is 0.12 and does not change again, whatever the built clips measure.
  kneeForward: 0.06, crouchKnee: 0.12, crouchPelvis: 0.55, standingPelvis: 0.85, // metres
```

### 2. `src/builders/liveClipRoute.test.js`, case "composes every routed action from its inherited legs and its authored upper body" (old lines 467 to 471)

Old:

```js
      const keys = timing === 'held' ? 1 : stamps.length;
      for (let k = 0; k < keys; k++) {
        const theirs = valueAt(height, stamps[k]);
        for (let axis = 0; axis < 3; axis++) expect(position.values[k * 3 + axis]).toBeCloseTo(theirs[axis], 6);
      }
```

New:

```js
      const keys = timing === 'held' ? 1 : stamps.length;
      for (let k = 0; k < keys; k++) {
        const theirs = valueAt(height, stamps[k]);
        // Plan 07-34: a crouch or jump clip keeps the inherited height (local z) only; its two horizontal
        // components are the authored clip's, or the rest value for a clip without that track.
        if (HELD_PELVIS.test(id)) {
          const level = authoredLevel(id, stamps[k] * authored.duration / inherited.duration);
          expect(position.values[k * 3 + 2], `${id} pelvis height, key ${k}`).toBeCloseTo(theirs[2], 6);
          for (const axis of [0, 1]) expect(Math.abs(position.values[k * 3 + axis] - level[axis]),
            `${id} pelvis local ${'xy'[axis]}, key ${k}`).toBeLessThanOrEqual(HOLD.pelvisLevel);
          continue;
        }
        for (let axis = 0; axis < 3; axis++) expect(position.values[k * 3 + axis]).toBeCloseTo(theirs[axis], 6);
      }
```

`HELD_PELVIS` is `/^(crouch|jump)_/`. Every other clip keeps the three-axis equality to 6 decimals, with its line unchanged.

Everything else in that file is added, with no existing line changed: a `HOLD` constant with the three new limits and `HELD_PELVIS` after the guard table; the helpers `authoredLevel`, `posed` and `shoulderCentre`; and the describe block "the pelvis of a composed crouch or jump clip stays over the root" with eight cases. The file's `figures` declaration is untouched; the new figures are attached to that object at run time.

### 3. `src/builders/firstPersonLookDown.test.js`, case "poses the live player standing and in the composed crouch"

Old:

```js
    // The pose itself, level view: the chest is behind the root in the composed crouch (plan 07-27).
    const standing = at(runs.get('standing/0'), 0), crouched = at(runs.get('crouched/0'), 0);
    expect(-standing.offset - standing.chest, 'standing chest in front of the root').toBeCloseTo(-0.005, 2);
    expect(-crouched.offset - crouched.chest, 'crouched chest in front of the root').toBeCloseTo(-0.235, 2);
```

New:

```js
    // The pose itself, level view: the chest of the composed crouch is over the root, where the standing
    // chest is (plan 07-34; under plan 07-27 it was 0.235 m behind the root).
    const standing = at(runs.get('standing/0'), 0), crouched = at(runs.get('crouched/0'), 0);
    expect(-standing.offset - standing.chest, 'standing chest in front of the root').toBeCloseTo(-0.005, 2);
    expect(-crouched.offset - crouched.chest, 'crouched chest in front of the root').toBeCloseTo(-0.005, 2);
```

Measured: crouched chest 0.0053 m behind the root, standing 0.0037 m behind. Same precision as before. This was the file's only failure. Its look-down limits (0.10 and 0.60 m) were not edited and pass: crouched 0.183 to 0.285 m over the sweep, standing 0.184 to 0.287 m. Its control on the withdrawn offset still asserts a violation.

No other existing assertion failed at any point, so no stop rule fired.

## Accomplishments

- The pelvis of the eight composed crouch and jump clips is over the root; the first-person shoulders are where the authored clips had them, so the contact geometry is the pre-repair one for every weapon.
- A Node guard drives one player as the game loop does and measures the real contact error for four weapons through every listed state. The browser case measures a half crouch with two driver objects and under-reports.
- AWP and P90 contact error was measured for the first time, before and after.
- The third-person crouched head and chest are within 0.007 m of the root fore and aft instead of 0.23 m behind it.

## Task Commits

1. **Task 07-34-01 (tracer), RED** - `3497de1` (test)
2. **Task 07-34-01 (tracer), GREEN** - `d1815ae` (feat)
3. **Task 07-34-02** - `2114fb2` (test)

## Files Created/Modified

- `src/builders/enemyGLTF.js` - `buildLiveClips`: 17 lines added, none changed or removed (a rest position captured once, the pelvis hold before the leg solve, six comment lines). SHA-256 `802b7414…1781` (before `40dad805…0161`). The file has mixed CRLF and LF endings; the edit was made byte for byte in an LF region and every existing line keeps its terminator.
- `src/builders/firstPersonContact.test.js` - 33 cases (new, LF). SHA-256 `a3a126da…3f83`.
- `src/builders/liveClipRoute.test.js` - 61 cases (53 before). SHA-256 `bc2ce4eb…9b53`.
- `src/builders/firstPersonLookDown.test.js` - one assertion and its comment. SHA-256 `3657057a…4eaa`.

No new export. `findMotionClip`, `getMotionDefinition`, `prepareEnemyClips`, the route, the upper tracks, the sway factors, the idle legs and the gait clips are unchanged.

## Decisions Made

- **Which clips.** The rule applies to a composed clip whose sway factor is 0 and whose timing is not `held`. The ready clips, stop, reversal and the two turns also have sway 0, but they are the held idle legs, which the plan keeps unchanged; the edited composition case asserts their three-axis equality as before.
- **Which authored time.** A key at time t of the composed clip takes the authored horizontal position at t scaled by the ratio of the two durations, the same mapping the authored upper keys already follow. All authored crouch and jump position tracks are constant at (0, 0.0501) in the two horizontal components, so the choice does not change a value today.
- **Fallback.** `vod7_jump_loop` keys no pelvis position; its clip takes the two components from the pelvis bone of the fresh skeleton clone, (0, 0.0501).
- **Run speed in the contact test.** Walk 6 m/s, sprint 9.9 m/s and crouch walk 4.32 m/s are the game's. The run family without the sprint key uses 7.44 m/s, the speed the route guard uses, because the driver shows that family above 6.5 m/s.
- **Every tick is asserted**, not only the settled ones, and standing and crouch idle are also sampled at the four pitches of the browser case. Stricter than the plan; no limit changed.

## Deviations from Plan

### 1. [Rule 3 - Plan conflict] The rule was applied to all eight clips in task 1; task 2 changed no source

- **Found during:** task 1, before the RED commit.
- **Issue:** The plan asks task 1 to change `buildLiveClips` "for the crouch idle clip" and task 2 to apply the rule to the crouch walk and the three jump clips. It also puts the named edit of the composition case in task 1's RED commit, and that edit states the rule for every crouch and jump clip. With a change to crouch idle alone that case would still fail, and task 1's own verify requires the file to pass. The two cannot both hold.
- **Fix:** Task 1's source commit applies the one rule to every composed clip without sway that is not held, as the design section states it ("one for both families and not tuned per clip"), including the rest-position fallback. Task 2 added its tests and found nothing still wrong, so it has no source change and no commit-level RED.
- **What stands in for the task 2 RED:** the same tests fail on the pre-plan source (14 of 33, 9 of 61, 1 of 45, see the TDD record), and the file's own control rebuilds the composition of plan 07-27 for all eight clips and breaks the limit in every crouch state and around a jump.
- **Files modified:** `src/builders/enemyGLTF.js`.
- **Committed in:** `d1815ae`.

### 2. [Rule 3 - Blocking, test harness] The contact test mounts the third-person weapon

- **Found during:** task 2, first run of the AWP.
- **Issue:** The sibling Node tests mock `weaponFBX.js`, whose `attachWeapons3pToHand` mounts the third-person weapon group on the right hand. Without a mount, the AWP reload's bolt-hand path fails: `TypeError: Cannot read properties of null (reading 'matrixWorld')` at `src/builders/weaponHandling.js:249`. In the game the group is always mounted.
- **Fix:** `play()` in the test mounts the group on the right hand of the player it is about to drive, with the game's `WEAPON3P_ROT` and `WEAPON3P_GRIP`. No source file changed. The tracer figures did not move (still below 1.3e-7 m).
- **Committed in:** `2114fb2`.

### 3. Test additions beyond the plan's list (no limit involved)

- The held-pelvis cases also assert the crouch knee limit of 0.12 m at every key of the five crouch clips; the plan asserts it at 12 phases through the driver, which still runs.
- A case that a player built in the test from the live clips measures what the builder's player measures (1e-9), because the control and every reference player come from that helper.
- A case that both players of a run received the same run and that every error is a finite number, so a missing contact cannot pass as "no miss".
- Explicit timeouts of 30 s on the cases that build players (120 s on the per-weapon setup).

**Total deviations:** 2 resolved toward the plan's own verify gates and must-haves, 1 set of added checks. **Impact:** no limit loosened, no file outside the four touched, no stop rule fired.

## Issues Encountered

- A shell heredoc halved a doubled backslash in the scratch config for the pre-source run; the file was rewritten with the Write tool. It lives outside the repository.
- From the task 1 source commit on, every git command prints `warning: unable to find all commit-graph files`. `.git/objects/info/commit-graphs/commit-graph-chain` (dated 10 October) names five layer files; two exist, one of them written at the time of that commit. This looks like git's own background maintenance replacing layers without rewriting the chain file. `git fsck --connectivity-only` exits 0 and the history is complete (663 commits, 3 since the plan base). Nothing was done about it: the dispatch allows only `git add` and `git commit`. `git commit-graph write --reachable` would rebuild the cache; that is the orchestrator's or the owner's call.

## Open items and what is not verified

1. **No browser ran.** `tests/first-person-rig.spec.js` line 265 (contact under 0.025 m) was failing at `1e300c8` with 0.035 m. It was not re-run. The Node guard measures the real crouch; the browser's two-driver half crouch was not replayed after the change.
2. **`tests/first-person-rig.spec.js` lines 269 to 270** (four leg bones on screen at pitch -1.38): in the settled crouch the right foot is at screen y -1.73, off screen, as planning predicted. The browser's own sample (one tick after the crouch is entered, two drivers) was not replayed on the new pose. Plan 07-28 predicted that assertion to fail on its offset; that prediction was made on the old crouch pose and is not updated here.
3. **Human judgment.** No one has seen the new crouch or landing. Facts for the owner (plan 07-33): the rear knee is 0.11 to 0.14 m above the floor in crouch idle (0.27 to 0.31 m before); the front knee is 0.38 m in front of the root, 0.03 m beyond the body radius; the smallest knee offset in the crouch walk is 0.137 m; the right leg is fully straight on the last ten of 25 keys of the landing and on one key of the take-off; the feet are where they were. `humanMotionAcceptance` stays `pending`.
4. **Head in crouch** is still 1.12 m high against an eye of 0.85 m. Only fore and aft was corrected (ANIM-03 remains partly met).
5. **States not in the plan's list** were not measured for contact: standing ADS and reload, fire, throw, melee, roll, dance, death, crouch entered while moving, a jump from a crouch.
6. **The contact figure is the solver's shortfall.** It shows the hands reach their targets; it does not show how the grip looks.
7. **Crouch press shows a jump in the live game** (`src/entities/player.js`, frozen; `07-27-SUMMARY.md`). Unchanged. The jump clips now also keep the pelvis over the root, so the contact error is 0 through that sequence too; the sequence itself is still open.
8. **Timing gates.** `src/builders/enemyGLTF.js`, one of the five mutable runtime files, changed identity again. No timing gate was run or requalified (plans 07-30, 07-31).
9. **Load cost** of `buildLiveClips` was not re-measured (24 ms per call in Node under plan 07-27). The change adds one interpolant read per key of eight clips.
10. **Foot sliding** is not measured, as before.
11. **`AGENTS.md`** was not edited (plan 07-32). It still does not mention the composed clips.
12. **Line endings of the new test** are LF on disk and in the repository; `.gitattributes` does not pin it.
13. **The commit-graph warning** above.

## Self-Check: PASSED

- `src/builders/firstPersonContact.test.js`, `src/builders/enemyGLTF.js`, `src/builders/liveClipRoute.test.js`, `src/builders/firstPersonLookDown.test.js`: found.
- Commits `3497de1`, `d1815ae`, `2114fb2`: ancestors of HEAD; `git rev-list --count 79e0f3d..HEAD` is 3.
- Acceptance criteria of both tasks re-run at `2114fb2`: the new test was committed failing first on the crouch and passes now; its control asserts an error above 0.10 m; the five frozen test files pass with no byte changed; `git diff 1e300c8..HEAD --stat -- src` lists only the four allowed files; the contact cases pass for four weapons under the relative limit and for M4 and pistol under the absolute limit; `npm test` and `npm run lint` exit 0.
- No stub, no skipped test, no verify command left unrun.

## Next Phase Readiness

Plan 07-29 can continue with its browser run. Two things to decide before it: whether the on-screen assertion of `tests/first-person-rig.spec.js` lines 269 to 270 still applies to the crouch pose (item 2), and whether to rebuild the commit-graph cache (item 13).

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-11*
