---
phase: 07-movement-matched-and-action-safe-animation
plan: "27"
subsystem: animation
tags: [three.js, animation-mixer, clip-composition, two-bone-ik, inertia, vitest, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-19 owner motion review (reply 4: repair now) and the diagnosis in .planning/debug/phase7-human-motion-review.md"
provides:
  - "buildLiveClips and findLiveClip in src/builders/enemyGLTF.js: runtime-only live_<action id> clips with inherited legs and pelvis height under the authored upper body"
  - "Inertia restore in src/builders/enemyAnimations.js: a bone the blend wrote goes back to the mixer's value before the mixer runs again"
  - "src/builders/liveClipRoute.test.js and src/builders/presentationInertia.test.js: composed-pose and inertia guards on the real skeleton"
affects: [07-28, 07-29, 07-30, 07-31, 07-32, 07-33, phase-5-omnimovement]

actuals:
  tokens: 17750
  tasks: 2
  commits: 5

plan_head_before: 002da6442a86dd499f94b7691966c148e19f015f
plan_head_after: fe3117b2bf3f956c0410279aa84b0416e7083c14
commits: 5

tech-stack:
  added: []
  patterns:
    - "Clips composed once at load on a skeleton clone and kept beside the prepared set in a WeakMap; the prepared set and the GLB stay unchanged"
    - "A post-mixer bone write remembers the mixer's value and puts it back before the next mixer update"
    - "Pose guards compare the builder's actor with an actor made from findMotionClip under identical observations"

key-files:
  created:
    - src/builders/liveClipRoute.test.js
    - src/builders/presentationInertia.test.js
  modified:
    - src/builders/enemyGLTF.js
    - src/builders/enemyAnimations.js

key-decisions:
  - "The four ready clips and sprint keep the authored duration, not the inherited one, because the driver plays their upper mask in real time; this keeps the upper body bone for bone what it was (measured difference 0 in all 15 states)"
  - "The inertia restore runs in tickPresentation after the transition snapshot, only on bones that still hold the blend; a caller that only runs the mixer is settled inside the inertia tick"
  - "The idle control uses the foot bone criterion of the blocked-feet browser test; in metres the inherited idle does not reach 0.001 m at every start"
  - "No requirement is marked complete; ANIM-02 and ANIM-03 are re-derived in plan 07-32 and judged by the owner in plan 07-33"

patterns-established:
  - "live_<action id>: ten lower tracks (pelvis position; rotations of pelvis, thighs, calves, feet, balls) plus the authored upper tracks"
  - "A guard has a control that asserts a violation on the withdrawn design"

requirements-completed: []

coverage:
  - id: D1
    description: "Live play selects composed clips with inherited legs and pelvis height for idle, walk, run, sprint, crouch, jump, stop, reversal and turns; weapon and chest stay forward within the plan's limits"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#every in-scope state through the driver"
        status: pass
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#the live route, clip by clip"
        status: pass
    human_judgment: true
    rationale: "Unit tests measure angles and positions on the skeleton in Node. No browser ran in this plan, and whether the motion looks acceptable is the owner's judgment in plan 07-33."
  - id: D2
    description: "A bone on an exactly constant track reaches the clip's value after a transition with inertia on"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/presentationInertia.test.js#inertia over the presentation driver"
        status: pass
    human_judgment: false
  - id: D3
    description: "Death in every direction plays the whole inherited death; the damage additive is built from the inherited hit"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#death front plays the whole inherited death down to the ground"
        status: pass
      - kind: unit
        ref: "src/builders/liveClipRoute.test.js#builds the damage reaction from the inherited hit against the inherited idle"
        status: pass
    human_judgment: true
    rationale: "The driver still plays the damage layer at quarter weight for 0.3 s; whether a reaction is visible, and how the single death looks, only the owner can say."

duration: 41min
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 27: Live play on composed inherited legs, inertia restore Summary

**Live play now takes its legs and pelvis height from the inherited motion-captured clips, composed at load under the Phase 7 authored upper body, and the inertia blend no longer leaves a permanent pose on constant tracks. Verified by unit tests on the real skeleton only; no browser ran and no one has looked at the result.**

## What live play shows now, and what was given up

This is a composition. It is not the motion Phase 7 authored, and it is not the look of the game before Phase 7.

Shown now, for an M4, P90, AWP or pistol character:

- **Standing idle:** legs are one fixed frame of the inherited idle. They do not move at all. Reason: the driver plays the standing leg layer in real time, and a standing player blocked by a wall must not move a foot (`tests/animation-presentation.spec.js`). The upper body keeps the authored ready pose and the breathing layer.
- **Walk, run, strafe, sprint:** inherited legs, inherited pelvis height, and a quarter of the inherited pelvis sway. The upper body is the authored weapon pose (sprint keeps its authored carry).
- **Crouch idle and crouch walk:** legs and pelvis height from the `rifle_` crouch clips composed before commit e08e0ac. Every crouch direction shows the one inherited crouch walk.
- **Jump start, loop, landing:** legs and pelvis height from the `rifle_` jump clips.
- **Stop, reversal, both turns:** the same held idle legs under their own authored upper body.
- **Death, every direction:** the one inherited death clip, whole. Direction is lost.
- **Damage:** the existing additive layer is built from the inherited `hit` clip again.

Given up:

- The authored `vod7_` legs and pelvis for all of the above. The 59 clips stay in the GLB and stay resolvable through `findMotionClip`.
- Leg motion in the standing idle.
- The authored turn, stop, reversal and directional death in live play (CONTEXT D-05 and D-11).
- The clips that return have unresolved redistribution terms. That is unchanged and still open.

Kept as built: the authored upper body of every state, weapon handling, melee, throw, roll, dance, ADS, fire, reload and every preview action.

The owner must also hear this: the torso stays the upright weapon pose. In crouch the head bone is 1.12 m high and 0.225 m behind the root, while the crouched player is simulated with an eye at 0.85 m. Figures below.

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-11T06:49:05Z
- **Completed:** 2026-10-11T07:30:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (2 source, 2 new tests)

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/builders/liveClipRoute.test.js src/builders/presentationInertia.test.js` | exit 0, 56 of 56 passed (53 + 3) |
| The five frozen test files (`enemyGLTF`, `enemyAnimations`, `animationPresentation`, `rifleClips`, `firstPersonRig`) | exit 0, 34 of 34 passed, no byte changed |
| `npm test` | exit 0, 379 tests in 33 files (323 in 31 before this plan) |
| `npm run lint` | exit 0, no warnings |
| Changed-files guard since `e09bf9b` | exit 0: only the four allowed files |
| `npm run typecheck` (not required by the plan) | exit 0 |

`public/models/enemy.glb` and `tools/art/motion-manifest.json` have the same SHA-256 as before the plan. Nothing under `tools/`, `tests/`, `public/` or `server/` changed.

Not run: any browser suite, any capture, the build, `tools/art/frozen-bytes.mjs`, the timing gates.

### TDD record

| Step | Commit | State |
|---|---|---|
| RED, tracer | `e1e3399` | `presentationInertia`: 3 of 3 failed. `liveClipRoute`: 4 of 13 failed, 9 passed (controls and invariants). |
| GREEN, tracer | `1a8b141` | 16 of 16 passed. |
| RED, expansion | `a614f4d` | `liveClipRoute`: 23 of 53 failed, 30 passed. |
| GREEN, expansion | `5bc4a55` | 53 of 53 passed. |
| Test follow-up | `fe3117b` | Layers read on the recorded frame; one assertion added. No limit changed. |

Failing assertions at RED, verbatim examples:

- `thigh_l after 90 frames: expected 41.24792178621279 to be less than or equal to 0.5`
- `thigh_l reached: expected 45.831024516101195 to be less than 0.001`
- `knee l in front of the hip to ankle line: expected 0.015145226112861721 to be greater than or equal to 0.15`
- `walk_forward: largest forward knee offset: expected 0.015145284975096325 to be greater than or equal to 0.06`
- `crouch_walk: largest forward knee offset: expected -0.2422930229836221 to be greater than or equal to 0.06`
- `expected 'vod7_death_front' to be 'Death01'`

RED evidence records are in the ignored cache: `.planning/research/.cache/07-27-tracer-red-inertia.json`, `07-27-tracer-red-route.json` and `07-27-expansion-red-route.json`. All three returned `RED_EVIDENCE_OK` from `check tdd-red-evidence`. Semantic assessment: each target test ran and failed on the planned assertion; no load, fixture or syntax failure is credited. One limit of that record: the expansion record is a run filtered to its one target test. The unfiltered run of the same file (`07-27-expansion-red-route-all.json`, 23 failed) is rejected by the classifier as malformed TAP, because multi-line object diffs break its parser. The 23 failures in it are assertion failures.

The tracer feedback gate ran after `1a8b141`: all three tracer verify commands exit 0, then expansion.

## Re-measured table

Measured by the tests' own helpers on the built clips, through `tickPresentation` and `finishPresentation`, at 12 phases, inertia expired. Weapon and chest columns are the difference to an actor whose action map is made with `findMotionClip` (the authored clips) under identical observations. Character forward is +Z; weapon forward is +Y of `hand_r`; a knee offset is the distance of the knee from the hip to ankle line along +Z.

| State | Weapon yaw (deg) | Weapon pitch (deg) | `spine_03` yaw (deg) | Pelvis height (m) | Lowest foot (m) | Largest forward knee offset (m) |
|---|---|---|---|---|---|---|
| idle (one held frame) | 0.0 | 0.0 | 0.0 | 0.877 | 0.028 | 0.099 |
| walk forward | -1.7 to 1.6 | -1.5 to 1.0 | -1.7 to 1.6 | 0.819 to 0.862 | 0.009 | 0.279 |
| walk back | -2.5 to 2.4 | -0.8 to 0.9 | -2.5 to 2.4 | 0.778 to 0.881 | 0.005 | 0.218 |
| walk left | -1.8 to 1.6 | -0.7 to 0.6 | -1.8 to 1.5 | 0.810 to 0.899 | -0.008 | 0.129 |
| walk right | -1.1 to 1.5 | -0.6 to 0.4 | -1.1 to 1.5 | 0.846 to 0.880 | 0.021 | 0.151 |
| run forward | -1.2 to 0.9 | -0.6 to 1.0 | -1.2 to 0.8 | 0.711 to 0.818 | -0.025 | 0.319 |
| run back | -2.5 to 2.1 | -1.0 to 0.7 | -2.5 to 2.1 | 0.844 to 0.888 | 0.018 | 0.270 |
| run left | -1.8 to 1.6 | -0.7 to 0.6 | -1.8 to 1.5 | 0.810 to 0.891 | -0.008 | 0.129 |
| run right | -1.1 to 1.5 | -0.6 to 0.4 | -1.1 to 1.5 | 0.846 to 0.880 | 0.021 | 0.151 |
| sprint | -1.2 to 0.9 | -0.6 to 1.0 | -1.2 to 0.8 | 0.711 to 0.818 | -0.025 | 0.319 |
| crouch idle | 0.0 | 0.0 | 0.0 | 0.469 to 0.477 | 0.015 (balls 0.015 and 0.015) | 0.365 (smallest 0.183) |
| crouch walk | 0.0 | 0.0 | 0.0 | 0.465 to 0.525 | 0.014 | 0.372 (smallest 0.179) |
| jump start (airborne bound) | 0.0 | 0.0 | 0.0 | 0.523 to 0.877 | -0.063 | 0.351 |
| jump loop (airborne bound) | 0.0 | 0.0 | 0.0 | 0.868 | -0.073 | 0.294 |
| jump land | 0.0 | 0.0 | 0.0 | 0.433 to 0.927 | 0.011 | 0.288 |
| reload or fire on walk forward | -1.7 to 1.6 | -1.5 to 1.0 | -1.7 to 1.6 | as the gait | as the gait | as the gait |
| reload or fire on walk right | -1.1 to 1.5 | -0.6 to 0.4 | -1.1 to 1.5 | as the gait | as the gait | as the gait |
| reload or fire on run forward | -1.2 to 0.9 | -0.6 to 1.0 | -1.2 to 0.8 | as the gait | as the gait | as the gait |
| reload or fire on crouch idle | 0.0 | 0.0 | 0.0 | as the state | as the state | as the state |

Every value is inside its limit. No limit was changed. The absolute weapon yaw with a level view and forward movement stays between -1.9 and 1.4 degrees (walk), -1.4 and 0.7 (run), -1.3 and 0.7 (sprint) and -0.2 and -0.1 (crouch walk); it includes the breathing layer.

Run left reads 0.891 m where walk left reads 0.899 m from the same source: the 12 phases fall on the two sides of the loop seam of `strafe_l`, which does not close exactly.

Standing idle balls: 0.028 m and 0.032 m (limit 0.05). Standing pelvis 0.877 m (limit at least 0.85).

**Upper body:** the largest difference of any upper body bone quaternion component to the authored actor is 0 in all 15 states (limit 1e-6).

**Authored legs under the same driver, for comparison** (the second actor): largest forward knee offset 0.015 m in idle, gaits, jump start and jump land, -0.055 in jump loop, -0.246 in crouch idle, -0.242 in crouch walk; crouch pelvis 0.597 m with the lowest foot at -0.142 m.

### Ankles against the inherited source

Largest distance of an ankle of a composed clip from the ankle of its inherited source, clip alone, 12 phases (limit 0.03 m):

| Clip | Source | Largest distance (m) |
|---|---|---|
| the four ready clips, stop, reversal, both turns | `attack`, frame 0 | 0.0000 |
| `live_walk_forward` | `walk` | 0.0002 |
| `live_walk_back` | `walk_back` | 0.0003 |
| `live_walk_left`, `live_run_left` | `strafe_l` | 0.0179 |
| `live_walk_right`, `live_run_right` | `strafe_r` | 0.0004 |
| `live_run_forward`, `live_sprint` | `run` | 0.0008 |
| `live_run_back` | `run_back` | 0.0013 |
| `live_crouch_idle` | `rifle_Crouch_Idle_Loop` | 0.0000 |
| the four crouch walks | `rifle_Crouch_Fwd_Loop` | 0.0004 |
| `live_jump_start` | `rifle_Jump_Start` | 0.0006 |
| `live_jump_loop`, `live_jump_land` | `rifle_Jump_Loop`, `rifle_Jump_Land` | 0.0000 |

The 0.018 m on `strafe_l` is the one place where the leg cannot reach and stays fully extended, as planned.

### Head and chest in crouch

Clip alone at its first frame. Negative forward means behind the root.

| Pose | Head height (m) | Head forward (m) | Chest (`spine_03`) forward (m) | Pelvis (m) |
|---|---|---|---|---|
| composed `live_crouch_idle` (now) | 1.121 | -0.225 | -0.235 | 0.469 |
| whole `rifle_Crouch_Idle_Loop` (before e08e0ac) | 1.064 | -0.085 | -0.184 | 0.469 |
| authored `vod7_crouch_idle` (before this plan) | 1.249 | 0.005 | -0.005 | 0.597 |

Through the driver, settled after a crouch press with inertia on: head 1.122 m high and 0.226 m behind, chest 0.235 m behind, pelvis 0.470 m, knees 0.185 m and 0.362 m in front of the line. The crouched eye is at 0.85 m (`PLAYER_H_CROUCH`). The visible head is not where the crouched player is simulated.

### Track counts of the selected layers

| State | Before (authored) | After (composed) |
|---|---|---|
| standing idle | lower 9, upper 12 | lower 10, upper 12 |
| forward walk | lower 9, upper 12 | lower 10, upper 12 |
| forward run | lower 9, upper 12 | lower 10, upper 12 |
| crouch idle | lower 10, upper 12 | lower 10, upper 12 |

Every composed clip has exactly 10 lower tracks. The upper layer is unchanged. The whole inherited death that now plays has 66 tracks; the authored death had 22. The damage additive now has 66 tracks; it had 21.

### Death and damage

- Death, all four variants: the one selected layer is `Death01` at weight 1. Final pelvis 0.063 m (limit at most 0.12), final lowest foot 0.065 m, lowest foot on the way 0.014 m (limit at least -0.03).
- Damage: largest bone rotation of the additive built from the inherited `hit` against the inherited idle is 43.1 degrees; of one built from `vod7_damage` against the authored ready 6.0 degrees; factor 7.1 (limits: at least 30 degrees and at least 5 times).

### Controls that must fail, and do

| Control | Measured | Limit it violates |
|---|---|---|
| Inherited crouch legs under the authored upper mask (the withdrawn mask swap) | weapon pitch -18.3 deg, yaw -7.8, `spine_03` yaw -7.3 | pitch 2.5, yaw 3.5 |
| Mask swap, walk forward | weapon yaw -40.8 to -27.1 deg | 3.5 |
| Mask swap, walk right | weapon yaw -66.5 to -55.7 deg | 3.5 |
| `vod7_crouch_idle` | knees -0.246 m, lowest foot -0.142 m, pelvis 0.597 m | 0.15, -0.03, 0.55 |
| `vod7_walk_forward`, `vod7_jump_start` | largest forward knee offset 0.015 m | 0.06 |
| Composition without the leg solve, crouch idle | left ball 0.053 m (inherited 0.015 m, composed 0.015 m) | 0.03 |
| `vod7_death_front` | final pelvis 0.217 m | 0.12 |
| Whole inherited idle under the same driver, 8 frames at 1/15 s | foot bone quaternion change 0.0036, 0.0015, 0.0040; foot travel 0.00068, 0.00197, 0.00140 m | 0.001 (bone criterion); 1e-6 m (travel guard) |

### Unchanged authored clips whose legs stay in play

Measured, asserted against nothing: `vod7_melee_cross`, `vod7_melee_jab` and `vod7_throw` each have a pelvis at 0.917 m, largest and smallest knee offset 0.015 m and lowest foot 0.015 m. Their legs are a still standing pose.

### Cost at load

`buildLiveClips` took 24 ms per call in Node on this host (five calls, 23.7 to 25.2 ms); `prepareEnemyClips` took 14 ms. It builds 25 composed clips with 79,456 float values. This is a Node measurement, not a browser or device figure.

## Crouch press: presentation key sequence

Recorded by the tracer test with the test actor (grounded throughout): `loco:m4_ready`, then `loco:crouch_idle`. The driver itself shows no jump.

The jump the debug session saw in the live game (`jump_start`, `jump_land`, then crouch) comes from the caller. Cause, read from source and not reproduced in a browser here:

- `src/entities/player.js:183` sets `eyeFloor` from the crouch eye height as soon as crouch is held.
- `src/entities/player.js:286-289`: the camera is still at standing height, so `drop` is 0.8 m, which is over 0.4 m. The "walked off a ledge" branch sets `player.onGround = false`.
- `src/loop.js:134` passes `onGround: player.onGround` to the presentation.
- `src/builders/animationPresentation.js:77-78` turns every change of `onGround` into a jump start or a landing.

All three files are frozen identities. Nothing was changed. **Open.**

## Damage: what the code before e08e0ac did

Before e08e0ac the additive hit layer played at full weight (1.0) with a 0.03 s fade in for as long as the stun lasted, then faded out over 0.12 s. Today's driver plays it at weight 0.25 for 0.3 s, with no fade, and stops it (`src/builders/enemyAnimations.js:551-552`). The inherited `hit` clip is 0.467 s long, so 64 percent of it plays, at a quarter of its size.

The driver was not changed. The difference is **open for the owner's judgment**. If the owner still sees no reaction at the live check, the item stays open and goes to Phase 5.

## Accomplishments

- Live play selects composed `live_` clips for every in-scope state; the authored legs are no longer selected for them.
- Weapon and chest stay within 2.5 degrees of the authored direction in every state, also under fire and reload.
- A crouched character has knees in front of the line, feet on the floor and a pelvis at 0.47 m, also after a transition with inertia on.
- The inertia blend leaves no permanent pose on constant tracks.
- Each guard has a control that asserts a violation.

## Task Commits

1. **Task 07-27-01 (tracer), RED** - `e1e3399` (test)
2. **Task 07-27-01 (tracer), GREEN** - `1a8b141` (feat)
3. **Task 07-27-02, RED** - `a614f4d` (test)
4. **Task 07-27-02, GREEN** - `5bc4a55` (feat)
5. **Task 07-27-02, test follow-up** - `fe3117b` (test)

## Files Created/Modified

- `src/builders/enemyGLTF.js` - `buildLiveClips`, `findLiveClip`, the route, `inheritedClip`; the three action loops resolve through `findLiveClip`; the hit additive reads the inherited clips; `normaliseClipQuatSigns` takes an optional reference clip. SHA-256 `40dad805…0161`.
- `src/builders/enemyAnimations.js` - the inertia restore only. SHA-256 `f150cb50…2885`.
- `src/builders/liveClipRoute.test.js` - 53 cases (new, LF).
- `src/builders/presentationInertia.test.js` - 3 cases (new, LF).

Both source files had mixed CRLF and LF line endings before the plan. They were edited byte for byte; every unchanged line keeps its terminator. New exports: `buildLiveClips` and `findLiveClip`. No helper or key list was exported.

## Decisions Made

- **Where the inertia restore runs.** The plan says restore, mixer, correction, inertia. The restore is in `tickPresentation`, right after the transition snapshot, so the snapshot still reads the pose that was shown. It puts a bone back only if the bone still holds the blend, so nothing written since is overwritten. For a bone the presentation correction turned, the value kept is the one from before the correction. A caller that runs the mixer without `tickPresentation` (the exported `tickInertia`, used by `tools/art/review.mjs`, and a loop that only calls `finishPresentation`) is settled at the start of the inertia tick. When the blend is cancelled, a pending restore is dropped: this matters for the review panel, which stops all actions and finishes a second time in one frame. `crossfade` to death and retirement restore and clear. No allocation per bone and frame was added; two quaternions per bone are allocated once per skeleton.
- **Mean of the pelvis.** The inherited pelvis's mean is taken over the clip's keys.
- **Hit additive.** The test reads the additive from the real `buildEnemyMesh`, so the source function is what is measured.

## Deviations from Plan

### 1. [Rule 1 - Plan conflict] The ready clips and sprint keep the authored duration

- **Found during:** design of task 1, before any test result.
- **Issue:** The plan says a composed clip has the duration of its inherited source and the authored upper keys are scaled to it. The authored upper tracks are not constant (a sway of up to 0.012 in a quaternion component, over 1 s for ready and 0.65 s for sprint). The driver plays the upper mask of `<weapon>_ready` and of `sprint` in real time. Scaled to 3.0 s and 0.767 s, the upper body would differ from today's at almost every moment, against the must-have "bone for bone what it is today" and its 1e-6 limit.
- **Fix:** Those five clips keep the authored duration. The ready legs are held and have no length of their own. The sprint leg keys are scaled to 0.65 s; the driver never selects the sprint legs, it plays the run gait under the sprint upper body. Stop, reversal and turns use the held legs and keep the authored duration too. Every other clip follows the plan (inherited duration, upper keys scaled), which matters where the legs play in real time (crouch idle, jump loop).
- **Verification:** upper body difference 0 in all 15 states.
- **Committed in:** `1a8b141`, `5bc4a55`.

### 2. [Rule 1 - Plan conflict] The idle control uses the browser test's criterion, not metres

- **Found during:** task 1, on the unchanged source, before the RED commit.
- **Issue:** The plan's control reads "moves a foot by more than 0.001 m within 8 frames at 1/15 s". In metres the whole inherited idle moves a foot by 0.00068, 0.00197 and 0.00140 m at the three start times used, so that statement does not hold at every start. The planning measurement behind it, and the browser test it exists for, use the change of a foot bone quaternion component.
- **Fix:** The control asserts that criterion (measured 0.0036, 0.0015, 0.0040 against 0.001) and that the foot travel is more than 500 times the 1e-6 m guard. The guard on the composed clips was not touched: less than 1e-6 m at 60, 30 and 15 frames per second, from three start times, plus the bone criterion.
- **Committed in:** `e1e3399`.

### 3. [Test harness] Notes that are not limits

- The builder starts the breathing layer at a random time. The tests set it to 0.875 s on both actors so they breathe in step. A first attempt stubbed `Math.random`; that made every UUID of the clone equal and broke the inertia map, so it was dropped before the RED commit.
- Jump start (0.32 s) and landing (0.38 s) are shorter than the inertia of their entry. The tests cut that blend for these two states, as the review panel does, and say so. Every other state lets it expire by itself.
- The test file changed once after its RED commit (`fe3117b`): layers are read on the recorded frame, and each state also asserts that its leg layers are `live_` clips with 10 tracks.

**Total deviations:** 2 plan conflicts resolved toward the plan's must-haves, 1 set of harness notes. **Impact:** no limit loosened, no file outside the four touched.

## Issues Encountered

None that stopped the plan. No measured value missed a limit.

## Open items and what is not verified

1. **No browser ran.** Not verified here: how the result looks; the first-person view; the review panel; `tests/animation-resources.spec.js`, which compares this driver bone for bone with the pinned reference driver (plan 07-29); any browser test that expects `vod7_` layer names; the build.
2. **Human judgment.** No one has seen this motion. `humanMotionAcceptance` stays `pending`. A quarter of the pelvis sway, the upright torso over crouched legs and the still idle legs are planning choices only the owner can accept (plan 07-33).
3. **Head in crouch** is 1.12 m high against a simulated eye of 0.85 m (ANIM-03 is met only partly).
4. **Foot sliding** is not measured. Gait phase follows the cadence computed for the authored clips.
5. **Crouch press shows a jump in the live game.** Cause in `src/entities/player.js:286-289`, frozen. Open.
6. **Damage weight and duration** differ from the code before e08e0ac. Open for the owner.
7. **Redistribution terms** of the inherited rig and motion are unresolved, and these clips are now in live play again.
8. **Timing gates.** Two of the five mutable runtime files changed identity. No timing gate was run or requalified. The paired session evidence refers to the earlier identity.
9. **`AGENTS.md`** still describes authored motion in live play. Plan 07-32 owns that update; it was not edited here.
10. **Line endings of the new tests.** They are LF on disk and in the repository, but `.gitattributes` does not pin them, so a fresh checkout with `core.autocrlf=true` writes CRLF.
11. **Plan 07-19 bookkeeping** was left as it is.

## Self-Check: PASSED

- `src/builders/liveClipRoute.test.js`, `src/builders/presentationInertia.test.js`: found.
- Commits `e1e3399`, `1a8b141`, `a614f4d`, `5bc4a55`, `fe3117b`: ancestors of HEAD; `git rev-list --count 002da64..HEAD` is 5.
- Acceptance criteria of both tasks re-run at `fe3117b`: both new test files were committed failing first and pass now; the controls assert a violation; the five frozen test files pass with no byte changed; the driver diff holds the inertia restore only and did not change in task 2; `enemy.glb` and the manifest are unchanged.
- No stub, no skipped test, no verify command left unrun.

## Next Phase Readiness

Ready for plan 07-28. Plans 07-29 to 07-33 carry the browser consequences, the requalification, the documentation and the owner's live check.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-11*
