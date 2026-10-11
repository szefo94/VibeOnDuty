---
phase: 07-movement-matched-and-action-safe-animation
plan: "38"
subsystem: animation
tags: [first-person, body-view, crouch, foot-turn, playwright, vitest, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-35 crouched torso lean, 07-36 browser proof, 07-37 delta review (B-01, B-02, W-07 to W-12)"
provides:
  - "tests/first-person-own-body.spec.js: pixel guard on ink and own-body share, by the hand-driven sequence and through the real loop"
  - "src/builders/firstPersonBodyView.test.js: body-view bones independent of the lean, eye inside no drawn mesh, clearance at least 0.10 m, hips and legs only in crouch"
  - "src/builders/crouchFootTurn.test.js: a crouched foot turn keeps the crouched legs; a standing one is unchanged"
  - "src/builders/firstPersonRig.js: lean kept out of the body view; hips and legs only unless the chest is clearly below the eye"
  - "src/builders/enemyAnimations.js: no foot turn on the leg layer while crouching (two lines); reference-driver baseline and pin follow"
affects: [07-37, 07-30, 07-32]

plan_head_before: dff54caa01cda68853a9b9f6d918c79134c1d092
plan_head_after: 83f5ca5fa8bacf5c97f124473c44a12e04860e35
commits: 14
actuals:
  tokens: 23388
  tasks: 3
  commits: 14

tech-stack:
  added: []
  patterns:
    - "Own-body share: pixels that differ between a frame and the same frame drawn again with the body-view meshes hidden, shadow map kept"
    - "Real-loop browser input: trusted mousemove through pointer lock, frame-counted waits, turn rate held in simulated time"
    - "Stateless draw rule on bone height against the eye; alternate geometry built once through selectViewGeometry"

key-files:
  created:
    - tests/first-person-own-body.spec.js
    - src/builders/firstPersonBodyView.test.js
    - src/builders/crouchFootTurn.test.js
    - .planning/phases/07-movement-matched-and-action-safe-animation/deferred-items.md
  modified:
    - src/builders/firstPersonRig.js
    - src/builders/enemyAnimations.js
    - src/builders/crouchTorsoLean.test.js
    - tests/fixtures/enemyAnimations.uncached.js
    - tests/animation-resources.spec.js

key-decisions:
  - "Amendment 1 (orchestrator): unit case compares with the leaned source bones; leg joints asserted at -1.38 only; case A in the Training Range; feet planted before crouched stills; hips and legs only in crouch"
  - "Amendment 2 (orchestrator): a crouched foot turn keeps the crouched legs, fixed in the driver; the pelvis guard (G) was not needed and is not added"
  - "Margin of the body-view rule is 0.15 m, between the measured 0.319 m (lowest with the standing eye height) and -0.013 m (highest with the crouched one); no hysteresis"
  - "Torso meshes leave the camera's layer in crouch; their visible flags are not touched (accepted for now, second review to judge)"

requirements-completed: []

coverage:
  - id: D1
    description: "In first person the own body does not cover the view: ink at most 1.0 percent in every frame, crouched own-body share within 0.5 points of standing above -0.3 rad, still, turning, swinging and walking"
    requirement: ANIM-02
    verification:
      - kind: e2e
        ref: "tests/first-person-own-body.spec.js#own body: the real game loop with key and pointer input keeps ink and the body out of the view"
        status: pass
      - kind: e2e
        ref: "tests/first-person-own-body.spec.js#own body: the existing sequence of eight first-person frames keeps ink and the body out of the view"
        status: pass
    human_judgment: true
    rationale: "Pixel shares are measured; whether the crouched first-person view looks right (no torso, legs only) is the owner's judgment."
  - id: D2
    description: "The crouch lean does not reach the first-person body view; eye inside no drawn mesh; nearest drawn surface at least 0.10 m in every listed state"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/firstPersonBodyView.test.js (67 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A crouched character turning on the spot keeps its crouched legs; a standing foot turn is unchanged"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/crouchFootTurn.test.js (20 cases)"
        status: pass
      - kind: e2e
        ref: "tests/animation-resources.spec.js (13 of 13, matched all true against the replaced baseline)"
        status: pass
    human_judgment: true
    rationale: "Pelvis height and layers are measured; how the crouched turn looks in third person is the owner's judgment. No usable third-person frame was captured."
  - id: D4
    description: "Three untested conditions of the lean (W-10) are tested and each kills its mutant"
    verification:
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#a handler that must not lean"
        status: pass
    human_judgment: false

duration: 2h 15m
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 38: First-person own body in crouch Summary

**Live play at HEAD did show the defect, but only in motion: a crouched view that swung went black over up to 57 percent of the screen. On the final source the own-body browser spec passes in both cases (ink at most 0.28 percent in every frame of every motion), because a crouched foot turn no longer stands the legs up and the first-person body view draws hips and legs only while crouched.**

No requirement is marked complete. No motion or aesthetic judgement is made here; that is the owner's.

## What was found

1. **Stills were never the problem.** All 18 still frames of the real loop were clean at HEAD (ink 0.20 to 0.27 percent).
2. **The frames on record (48.3, 19.6, 20.1 percent ink) are not the player's body.** Seven starts of the hand-driven sequence gave 0.21 to 0.23 percent. The record's `crouch-1.38.png` shows a head with an open helmet from below, which the body view never draws. Review warning W-08 is most likely another character standing on the player's cell in Incursion. That is constructed, not observed: the run kept no enemy positions. See `deferred-items.md`.
3. **The lean did reach the body view (B-01).** Fixed; it accounted for one failure in the browser (1.99 percent ink at +0.3 rad while turning at 1 rad/s).
4. **The cause of the black screen was the driver.** When the view has twisted more than 0.42 rad from planted feet, a foot turn of 0.4 s plays on the leg layer. Both turn clips are the held frame of the standing idle. A crouched character therefore stood up on its legs for each turn: pelvis 0.469 m to 0.877 m above the root, 0.027 m above the crouched eye. Hips and thighs passed through the eye.

## What the owner will see

- **Crouched, turning on the spot (first and third person):** the character no longer stands up on its legs for each foot turn. The legs hold the crouch while the feet yaw unwinds as before.
- **Crouched, first person:** the player's own torso is not drawn. Looking down shows thigh, knee guard, shin and boots, with the arms and the gun.
- **Standing, first person:** unchanged. Looking down still shows chest, hips and legs.
- **Crouch-walking and looking straight up:** the chest no longer crosses the top of the screen.
- **Third person, bots, other players:** the crouch lean is unchanged.

Read from source, not seen in a frame: the first-person shadow of a crouched player is cast by the body view, so it is now legs only.

## Commits

| Commit | Task | What |
|---|---|---|
| `17646d0` | 1 | `tests/first-person-own-body.spec.js` (new) |
| `389f1f4` | 2 RED | `src/builders/firstPersonBodyView.test.js` (new), 16 of 24 failing |
| `bbdfae9` | 2 GREEN | B-01 in `src/builders/firstPersonRig.js` |
| `fcc98dd` | 2 | Three W-10 cases and one comment in `crouchTorsoLean.test.js` |
| `4ff144e` | (docs) | `deferred-items.md`: enemy on the player's cell |
| `f35a7a1` | (orchestrator) | Amendment 1 |
| `389db44` | 2 | Decision A: one line of `crouchTorsoLean.test.js` |
| `ead4a1b` | 3 RED | Guard for the lower-body rule, 27 of 67 failing |
| `2020963` | 3 | Lower-body rule in `firstPersonRig.js` (5 guard cases still failing at this commit) |
| `64a366a` | 3 | Own-body spec follows decisions B, C, D |
| `ea18fe4` | (docs) | `deferred-items.md`: standing foot turn in crouch |
| `ff1adef` | (orchestrator) | Amendment 2 |
| `458393d` | 3 RED | `src/builders/crouchFootTurn.test.js` (new), 12 of 20 failing |
| `83f5ca5` | 3 GREEN | Driver edit, reference-driver baseline and pin |

Two commits were made at a red state and say so in their messages: `bbdfae9` (one existing case failed by design until decision A) and `2020963` (the turning cases failed until decision F).

## Amendments and every permitted edit, old and new text

### Amendment 1, A: `src/builders/crouchTorsoLean.test.js`, helper `bodyViews`

The case "applies in this file the rotations the handler applies" failed after B-01, verbatim: `AssertionError: crouched sweep 0.78: expected 0.0004882758525945746 to be less than or equal to 1e-9`. It compared the file's rotations with the body view's lean bones. One line changed, in the helper that computes the compared value; lines 898 to 900 and the tolerance are unchanged.

Old:
```
  const amount = owner.crouchLean ?? 0, fade = fadeOf(pitch), theirs = LEAN_BONES.map(name => viewBone(rig, name).quaternion.clone());
```
New:
```
  const amount = owner.crouchLean ?? 0, fade = fadeOf(pitch), theirs = LEAN_BONES.map(name => rig.bodyPairs.find(([, node]) => node.name === name)[0].quaternion.clone());
```

The file's diff since `88caabc` is 110 added, 1 removed: the W-10 block, the naming comment and this line. The plan's "additions only" numstat check is superseded by this decision.

### Amendment 1, B to D: `tests/first-person-own-body.spec.js` (this plan's own file)

- B: leg joints asserted on the still frame at -1.38 only: at least 4 standing, 3 crouched.
- C: case A runs in the Training Range.
- D: six frames of crouched walking and a full stop before each crouched still of case B.
- Added by the executor and kept by Amendment 2, H: the standing still at -1.38 keeps at least 4.5 percent own-body share (measured 5.25 to 5.41).

### Amendment 2, F: `src/builders/enemyAnimations.js`, lines 520 and 522

Old:
```
    key = pose.jump ? `jump_${pose.jump}` : pose.turn || pose.transition || 'loco';
    else if (pose.turn) add(key, false, 1, pose.turnPhase);
```
New:
```
    key = pose.jump ? `jump_${pose.jump}` : (!pose.crouching && pose.turn) || pose.transition || 'loco';
    else if (pose.turn && !pose.crouching) add(key, false, 1, pose.turnPhase); // both turn clips stand
```

- Edited byte-wise. Only lines 520 and 522 differ; the count of carriage returns in the working file is 439 before and after.
- Driver diff since `3665406`: 2 added, 2 removed, this edit only.
- sha256 of the working file: `f150cb50bca967ef88b44817b746cace2787085c4fbb38e6d9cd277453992885` before, `ca5eed86b57e1b20710391e4f2dd8b1134a348d26fe13af59509fd9f67105cd2` after.

### Amendment 2, F: `tests/fixtures/enemyAnimations.uncached.js` and the pin

- The fixture received the same two lines (lines 497 and 499) and nothing else: 2 added, 2 removed.
- Fixture sha256: `61db86321fb6d179d643e74d9b2797a463e1f6c9eabed215b37d74a918239f67` before, `28ff6662e664f673c0c2229566023e41b5ce1af2c64991bd6385f471903730bb` after.
- `tests/animation-resources.spec.js` line 9, old: `  '61db86321fb6d179d643e74d9b2797a463e1f6c9eabed215b37d74a918239f67')`; new: `  '28ff6662e664f673c0c2229566023e41b5ce1af2c64991bd6385f471903730bb')`. One line.
- Containment check of plan 07-29 (fixture diff since `e09bf9b` inside the driver's): exit 0. The same check since `3665406`: exit 0, 4 lines each. Pin equals the fixture's sha256: exit 0.
- `tests/animation-resources.spec.js`: 13 of 13, with `matched` all true (asserted in its first case).

### Not edited

`tests/first-person-rig.spec.js` and `src/builders/firstPersonLookDown.test.js` needed no permitted edit: the crouched joints named at line 281 stay on screen, and the body offset did not change.

## Source changes

### `src/builders/firstPersonRig.js` (51 added, 6 changed since `88caabc`; sha256 `d99d55713abdb8b577d2e776ce5843eb41a553ab80a611eb9a2a7f1fc6e982eb`)

- **B-01.** After the pose is copied, the body view takes back `spine_01`, `clavicle_l`, `clavicle_r` and `neck_01` from the handler's saved rotations, through a name lookup built once per rig and cleared with it.
- **Lower-body rule (Amendment 1, E).** Hips and legs only when the eye is less than 0.15 m above the body view's `spine_03` (`BODY_VIEW_TORSO_BELOW_EYE`, exported).
  - Lower body: a vertex whose heaviest bone is `pelvis`, `thigh_*`, `calf_*`, `foot_*` or `ball_*`.
  - 20 leg and boot meshes are wholly lower body and untouched.
  - 8 torso meshes have no lower-body triangle and leave the camera's layer.
  - One mesh, `Anatomical_human_topology_1`, is cut at the waist and swaps its geometry: 7046 of 8444 triangles plus one welded cap of 48.
  - The alternate is selected from the body view's own whole geometry, so a vertex index means the same in both.
  - Per frame: one subtraction and one comparison; on a change, 9 assignments. No allocation.
  - Memory: one geometry of 5557 vertices and 7094 triangles, 331,528 bytes, uploaded on first crouch; the outline pass adds 66,684 bytes of normals to it lazily.
  - Retirement: the meshes take their built geometry back, then the alternate is disposed once.

Margin, measured over every frame of the Node guard:

| Eye height of the state | Eye above the chest bone (m) |
|---|---|
| Standing (standing, gaits, jump, landing, melee, throw, roll, crouch release) | 0.319 to 1.504 |
| Crouched (idle, walks, actions, turning, crouch press) | -0.073 to -0.013 |

The rule switches on the frame a crouch is pressed and the frame it is released, and at no other measured frame.

### `src/builders/enemyAnimations.js`

Two lines, above. A crouched actor now keeps `live_crouch_idle` on its leg layer through a foot turn. `animationPresentation.js` is unchanged, so the feet yaw still unwinds through its history.

## Layer mechanism and `tests/first-person-rig.spec.js` line 276 (Amendment 2, H)

The torso meshes leave the camera's layer; their `visible` flags are never cleared. That existing assertion lists the visible body meshes after its last, crouched, sample and expects `ChestPlate` and `LowerChestPlate`. It passes unchanged, but at that moment those meshes are not drawn. `visible` now means "this mesh belongs to the body view". The second delta review is asked whether the assertion should change instead.

## Measurements in the browser, per stage

How they were taken:

- Headless software rendering, 800 by 600, 20 frames per second with the loop's 0.05 s cap.
- Case B: real pointer lock was granted; pitch and yaw came from trusted `mousemove` events, crouch from `KeyC` held, walking from `KeyW` held; no lock flag was set by the spec.
- Achieved turn rates: 0.97 to 1.00, 2.90 to 3.00, and a mean of 3.4 to 3.9 rad/s for the swing.
- A frame drawn again unchanged differed in 0 pixels wherever checked.
- Ink is the exact colour 8/9/11.
- The Training Range is a dark hall (80 to 97 percent of a frame darker than 24/24/24); the exact-colour count reads 0.2 percent there, so statistic and picture agree.

Differences between stages that are not the source:

- HEAD and after B-01 ran case A in Incursion and without planted feet.
- The two crouched stills at -0.6 and -0.9 after B-01 (0.00 and 2.02 percent) carried leftover foot twist from the preceding turn. With planted feet they return to the HEAD values.

#### HEAD (`88caabc` source)

Case A (ink % / own-body % / leg joints), misses 2 (leg joints at -0.9 under the rule as first written):

| Pitch | Standing | Crouched |
|---|---|---|
| -1.38 | 0.22 / 5.32 / 4 | 0.22 / 19.46 / 3 |
| -0.9 | 0.21 / 0.42 / 0 | 0.23 / 9.13 / 1 |
| 0 | 0.21 / 0.00 / 0 | 0.21 / 0.00 / 0 |
| 1.38 | 0.21 / 0.00 / 0 | 0.22 / 0.00 / 0 |

Case B, standing stills: ink 0.21 to 0.27; own-body 0.42 at -0.9 and 5.25 at -1.38, 0.00 elsewhere; leg joints 0 everywhere except 4 at -1.38.

Case B, crouched (largest ink % / largest own-body %; stills with leg joints; the swing with frames over 1 percent ink), misses 30:

| Pitch | Still | Turn 1 rad/s | Turn 3 rad/s | Swing 4 rad/s |
|---|---|---|---|---|
| 1.38 | 0.22 / 0.00 (0) | 0.31 / 12.49 | 0.40 / 11.94 | 0.34 / 12.56, 0 of 122 |
| 0.9 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 0.22 / 0.00, 0 of 120 |
| 0.45 | 0.21 / 0.00 (0) | 0.21 / 0.00 | 0.21 / 0.00 | 33.45 / 33.41, 7 of 122 |
| 0.3 | 0.22 / 0.00 (0) | 1.99 / 1.84 | 0.22 / 0.14 | 35.42 / 35.62, 7 of 122 |
| 0 | 0.21 / 0.00 (0) | 0.22 / 0.66 | 0.22 / 0.00 | 38.78 / 39.24, 8 of 120 |
| -0.3 | 0.21 / 0.00 (0) | 0.23 / 1.44 | 0.22 / 0.00 | 6.21 / 15.63, 1 of 121 |
| -0.6 | 0.26 / 3.46 (1) | 0.26 / 4.99 | 0.24 / 3.51 | 15.90 / 29.65, 5 of 121 |
| -0.9 | 0.24 / 9.18 (1) | 0.29 / 11.48 | 0.22 / 7.93 | 33.65 / 41.09, 2 of 122 |
| -1.38 | 0.20 / 19.33 (3) | 0.31 / 20.20 | 0.29 / 19.93 | 56.88 / 57.37, 4 of 123 |

Crouch-walk forward at +1.38: 0.29 / 8.38, body in 44 of 62 frames.

The first run at HEAD aborted in case B on a file-name bug in the new spec (a slash in a frame name), fixed before the commit. Case A was identical in both runs.

#### After B-01 (`bbdfae9`)

Case A: as at HEAD (19.47 at crouched -1.38), misses 2.

Case B, standing stills: ink 0.21 to 0.26; own-body 0.43 at -0.9 and 5.35 at -1.38.

Case B, crouched, misses 27:

| Pitch | Still | Turn 1 rad/s | Turn 3 rad/s | Swing 4 rad/s |
|---|---|---|---|---|
| 1.38 | 0.22 / 0.00 (0) | 0.32 / 12.55 | 0.45 / 11.92 | 0.32 / 12.58, 0 of 122 |
| 0.9 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 0.23 / 0.00, 0 of 121 |
| 0.45 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 16.61 / 19.62, 1 of 121 |
| 0.3 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 35.34 / 35.54, 2 of 122 |
| 0 | 0.20 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 22.02 / 28.85, 5 of 121 |
| -0.3 | 0.21 / 0.00 (0) | 0.23 / 1.80 | 0.21 / 0.00 | 55.40 / 55.32, 4 of 122 |
| -0.6 | 0.21 / 0.00 (0) | 0.25 / 5.59 | 0.26 / 3.53 | 32.85 / 38.09, 7 of 121 |
| -0.9 | 0.21 / 2.02 (0) | 0.27 / 12.13 | 0.25 / 9.02 | 55.63 / 55.65, 2 of 121 |
| -1.38 | 0.20 / 19.36 (3) | 0.31 / 20.21 | 0.29 / 20.05 | 36.96 / 44.04, 4 of 121 |

Crouch-walk forward at +1.38: 0.29 / 9.34, body in 44 of 62 frames.

#### Lower-body rule (`64a366a`), case A in the range, feet planted

Case A, misses 0:

| Pitch | Standing | Crouched |
|---|---|---|
| -1.38 | 0.24 / 5.35 / 4 | 0.23 / 19.48 / 3 |
| -0.9 | 0.22 / 0.42 / 0 | 0.23 / 9.13 / 1 |
| 0 | 0.21 / 0.00 / 0 | 0.21 / 0.00 / 0 |
| 1.38 | 0.21 / 0.00 / 0 | 0.22 / 0.00 / 0 |

Case B, standing stills: ink 0.21 to 0.26; own-body 0.43 at -0.9 and 5.29 at -1.38.

Case B, crouched, misses 14 (all in motion):

| Pitch | Still | Turn 1 rad/s | Turn 3 rad/s | Swing 4 rad/s |
|---|---|---|---|---|
| 1.38 | 0.21 / 0.00 (0) | 0.26 / 4.33 | 0.24 / 5.87 | 0.25 / 5.63, 0 of 122 |
| 0.9 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.22 / 0.00, 0 of 120 |
| 0.45 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 33.45 / 33.41, 2 of 122 |
| 0.3 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 35.34 / 35.54, 2 of 120 |
| 0 | 0.21 / 0.00 (0) | 0.22 / 0.76 | 0.21 / 0.00 | 38.78 / 39.23, 3 of 121 |
| -0.3 | 0.06 / 0.00 (0) | 0.22 / 1.44 | 0.22 / 0.00 | 11.22 / 12.71, 2 of 121 |
| -0.6 | 0.25 / 3.53 (1) | 0.26 / 5.59 | 0.25 / 3.54 | 36.50 / 41.15, 4 of 122 |
| -0.9 | 0.22 / 9.05 (1) | 0.25 / 12.18 | 0.24 / 9.29 | 15.22 / 37.06, 2 of 121 |
| -1.38 | 0.19 / 19.21 (3) | 0.30 / 20.14 | 0.29 / 20.34 | 37.09 / 48.94, 5 of 120 |

Crouch-walk forward at +1.38: 0.22 / 0.00, body in 0 of 61 frames.

#### Final (`83f5ca5`): both cases pass, exit 0

Case A, misses 0: the same figures as the stage before.

Case B, standing stills: ink 0.21 to 0.28; own-body 0.43 at -0.9 and 5.41 at -1.38; leg joints 0 everywhere except 4 at -1.38.

Case B, crouched, misses 0:

| Pitch | Still | Turn 1 rad/s | Turn 3 rad/s | Swing 4 rad/s |
|---|---|---|---|---|
| 1.38 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.22 / 0.00, 0 of 121 |
| 0.9 | 0.22 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.22 / 0.00, 0 of 121 |
| 0.45 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.22 / 0.00, 0 of 121 |
| 0.3 | 0.22 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.22 / 0.00, 0 of 120 |
| 0 | 0.21 / 0.00 (0) | 0.22 / 0.00 | 0.21 / 0.00 | 0.23 / 0.00, 0 of 122 |
| -0.3 | 0.22 / 0.00 (0) | 0.22 / 0.00 | 0.22 / 0.00 | 0.24 / 0.79, 0 of 122 |
| -0.6 | 0.25 / 3.53 (1) | 0.27 / 3.50 | 0.26 / 3.54 | 0.27 / 4.14, 0 of 123 |
| -0.9 | 0.22 / 9.05 (1) | 0.25 / 9.29 | 0.21 / 4.10 | 0.25 / 9.15, 0 of 122 |
| -1.38 | 0.19 / 19.21 (3) | 0.28 / 20.09 | 0.28 / 20.46 | 0.27 / 20.75, 0 of 121 |

Crouch-walk forward at +1.38: 0.23 / 0.00, body in 0 of 61 frames.

Look-down view now: 4 leg joints standing and 3 crouched at -1.38; crouched own-body share 3.53, 9.05 and 19.21 percent at -0.6, -0.9 and -1.38.

## What is on screen, in plain words

**HEAD**

- Crouched, looking down, still: thigh, knee guard, shin panel, both forearms and the gun, painted with thin outlines; no black.
- Crouched, level and looking up, still: the range or the ceiling, forearm and gun.
- Crouched, level, swinging, worst frame: the left 40 percent of the screen is one black shape.
- Crouched, +0.3, turning at 1 rad/s: a small black wedge with a light edge in the top-left corner.
- Crouched, looking straight up, swinging or walking: a large dark-blue chest mass across the top of the screen.

**After B-01**

- The stills look as at HEAD.
- Crouched, -0.3, swinging: the left 55 percent of the screen is black.
- Crouch-walking and looking up: the chest across the top with a light strip under it.

**Lower-body rule**

- Stills as before; the crouched look-down frame shows thigh, knee guard and shin, no torso.
- Swing worst frame unchanged: the left 40 percent black.
- Looking up while turning: a dark mass across the top quarter, about half its earlier size.

**Final**

- Crouched, level, swinging, the frame with the most ink (0.23 percent): the range with its targets, the forearm and the gun; no black shape.
- Crouched, looking straight down, swinging: thigh, knee guard and shin panel carried to the left of the screen, forearms and gun; nothing over the view.
- Crouched, -0.9, turning at 1 rad/s: thigh, knee and shin at the lower left, forearm and gun.
- Crouched, turning at 3 rad/s, level: the range, forearm and gun.
- Crouched, looking down, level and up, still: as at HEAD.
- Standing, looking down: a light strip of the chest identifier, knee and boot shapes, forearm and gun.
- The waist cap of the cut mesh is in no captured frame at -0.9 or -1.38; how it looks from above was not judged.

## Third person: a crouched character turning on the spot

| | Pelvis above the root | Lowest foot | Leg layers |
|---|---|---|---|
| Before F (Node, four turning runs) | 0.469 to 0.877 m | -0.368 m | `live_crouch_idle`, `live_turn_right`, `live_turn_left` |
| After F (Node, the same runs) | 0.469 to 0.477 m | 0.015 m | `live_crouch_idle` only |
| After F (browser, real loop, third person, about 3 rad/s, 80 frames, 74 with a foot turn named) | 0.469 to 0.477 m | not read | `live_crouch_idle` only |

A standing foot turn is bone for bone what it was: the largest difference of any bone quaternion component before and after the edit is 0 over the four standing turning runs (15,600 to 31,200 numbers each).

The two third-person frames the scratch probe saved show only the hall ceiling, because the probe left the view pitched up. They are not a usable picture.

## Node figures

Nearest drawn body-view surface to the eye over 29 pitches (metres), and frames with the eye inside a closed mesh:

| State | HEAD | After B-01 | Lower-body rule | Final |
|---|---|---|---|---|
| Standing, still, turning, swinging | 0.222 to 0.309 | same | same | same |
| Crouch idle | 0.001 to 0.048, inside 1 of 29 | 0.044 to 0.115 | 0.231 to 0.295 | 0.231 to 0.295 |
| Crouch walk, four directions | 0.000 to 0.047, inside 67 to 99 of 1131 | 0.039 to 0.113 | 0.199 to 0.258 | 0.199 to 0.258 |
| Crouched ADS / fire / reload | 0.000 to 0.045, inside 195 / 26 / 392 | 0.042 to 0.113 | 0.230 to 0.295 | 0.230 to 0.295 |
| Crouched, turning 1 rad/s | 0.000 to 0.075, inside 12 of 870 | 0.004 to 0.109 | 0.004 to 0.109 | 0.234 to 0.273 |
| Crouched, turning 3 rad/s | 0.000 to 0.072, inside 13 of 870 | 0.001 to 0.093, inside 7 | 0.001 to 0.093, inside 7 | 0.228 to 0.293 |
| Crouched, swinging 4 rad/s | 0.000 to 0.035, inside 115 of 1740 | 0.000 to 0.035, inside 68 | 0.000 to 0.035, inside 68 | 0.179 to 0.237 |

On the final source the eye is inside no drawn mesh in any state. Largest body-view bone difference against the lean undone: 0.209 at HEAD, exactly 0 from B-01 on, in all eight crouched states (29 to 3161 samples each).

## Test results on the final source

| Command | Result |
|---|---|
| `npx playwright test` own-body spec alone (stage `final`) | exit 0, 2 passed, 7.8 minutes |
| Focused set, nine spec files in one command | exit 0, 63 passed, 0 failed, 0 skipped, 17.4 minutes |
| `tests/character-art.spec.js -g "art ink: posed current rig\|art soldier: fitted painted equipment"` | exit 0, 2 passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:mp` | exit 0 |
| `npm test` | exit 0, 635 tests in 38 files (545 in 36 before this plan) |
| `npm run build` | exit 0 (the known chunk-size note) |
| Focused vitest (six files) | exit 0, 250 passed |

Focused set by file: own-body 2, live-route 1, resources 13, presentation 4, regressions 6, motion-source 4, first-person-rig 12, weapon-handling 11, review 10. Every browser command was preceded by the two-address probe of port 5173, which exited 0 each time. The live-route case read a crouched chest lean of 12.2 degrees and 0.25 degrees after release.

### TDD record

| Step | Commit | State |
|---|---|---|
| RED, body view and lean | `389f1f4` | 16 of 24 failed |
| GREEN | `bbdfae9` | 24 of 24 |
| RED, lower-body rule | `ead4a1b` | 27 of 67 failed |
| Rule in | `2020963` | 62 of 67; the 5 crouched turning cases failed |
| RED, foot turn | `458393d` | 12 of 20 failed |
| GREEN | `83f5ca5` | 20 of 20; body-view guard 67 of 67 |

Verbatim at RED:

- `spine_03 at pitch 0.08: expected 0.20902151750180104 to be less than or equal to 0.00001`
- `expected [ 'pitch -0.12: ChestPlate (111)' ] to deeply equal []`
- `LowerChestPlate at pitch 1.08: expected 0.03887766683020344 to be greater than or equal to 0.1`
- `tick 0, turn "turn_right": expected 0.8768213136656238 to be less than or equal to 0.525`

W-10: under an in-memory mutant of each condition (load hook, repository file untouched) exactly the matching new case fails: anchor `expected 0.9999999979388463 to be +0`, weapon `update 1: expected 1 to be +0`, alive `expected 0.2094395102393195 to be +0`.

### Sweep before the driver edit (Amendment 2)

| Case | Prediction | Result |
|---|---|---|
| `animationPresentation.test.js` "bounded torso leads small turns" | Unchanged: the presentation still names the turn | passed |
| `liveClipRoute.test.js` (standing feet, route table) | Unchanged: no crouched foot turn | passed |
| `tests/animation-presentation.spec.js` "local: loaded directional masks" | Unchanged: its turn is standing | passed |
| `tests/animation-motion-source.spec.js` "stationary turn" | Unchanged: plays the authored clip directly, not through the driver | passed |
| `tests/animation-resources.spec.js` reference-driver comparison | Passes once the fixture has the same edit | 13 of 13, matched all true |
| `firstPersonBodyView.test.js` crouched turning | Changes, as intended | 67 of 67 |
| Lean, contact, look-down, inertia, live-route | Unchanged: yaw is fixed in all of them | passed |

No frozen test failed.

## Byte and containment checks

- Files changed since `88caabc` under `src`, `tests`, `public`, `server`, `tools`: `firstPersonRig.js`, `enemyAnimations.js`, `crouchTorsoLean.test.js`, `firstPersonBodyView.test.js`, `crouchFootTurn.test.js`, `tests/first-person-own-body.spec.js`, `tests/animation-resources.spec.js`, `tests/fixtures/enemyAnimations.uncached.js`. The last three source and fixture entries and the new test come from Amendment 2.
- Identical to `88caabc`: `enemyGLTF.js`, `weaponHandling.js`, `animationPresentation.js`, `firstPersonRig.test.js`, `firstPersonContact.test.js`, `firstPersonLookDown.test.js`, `liveClipRoute.test.js`, `presentationInertia.test.js`, `tests/first-person-rig.spec.js`, `tests/animation-live-route.spec.js`, `public`, `server`, `tools`.
- `weaponHandling.js` sha256 `6bcd00e7…3aa3` and `enemyGLTF.js` `802b7414…1781`, as in the review record.

## Frames

Frames and JSON per stage are kept in two places:

- `C:\Users\Marcin\AppData\Local\Temp\claude\C--Programowanie-VibeOnDuty\4d573713-6811-4df0-9bbf-b0d751eb657c\scratchpad\frames-07-38\` (`head`, `after-b01`, `lower-body`, `final`, and the controls `w08-control`, `w08-sweep`)
- `.planning/research/.cache/07-38-frames/` (gitignored), with the Node figures and logs

Each stage's `own-body-real-loop.json` and `own-body-existing-sequence.json` hold the sha256 of every frame of the new spec (122 files in `final`). Final JSON hashes: `d896c68ef6457481719478c8d1fa616823a6a6e074dc30310146ec154131110d` and `94adf0d143a2b9af4a8d46cb049880f34fb1775b1041df0a5d0b43af90341697`.

Key frames of the new spec, stage `final`:

| Frame | sha256 |
|---|---|
| `A-stand--1.38.png` | `02d44c3e1bbffa2a886c4b9c2d5fb34511dd5b011573dfb438acf722e0f11e6a` |
| `A-crouch--1.38.png` | `caf436866b615a951838d4020948a79dec8f2168ce76605bd6467080ff2fc61f` |
| `A-crouch-0.png` | `e40150a5960be4c28493bd18e67995f8954ae7053878bf391afe095804f2bae1` |
| `A-crouch-1.38.png` | `dd4076fb49852adff0f0867f55e34a02e9d05f10a48912158094d743f81c833a` |
| `B-stand--1.38-still.png` | `ee5c1ac53744ace43cff99c0944a15bb97eca849787ebf17e84175242c6bc701` |
| `B-crouch--1.38-still.png` | `bffc3e24445e9f9ca238e0be303b16874d8800470c184f8e536144e703f06c85` |
| `B-crouch-0-still.png` | `a4b663307a07dbd77ded86e7c7365a8851f1ad758c2d57887e9ea2fbbb46d6e6` |
| `B-crouch-1.38-still.png` | `2246cfa33b71418dfdf79e146270eb59387b86de589e2fcea144c96cdb5757ac` |
| `B-crouch-0-swing_4_rad_s-most-ink.png` | `50e77ec3b16100106b568897c99b025168a182af7232febbbdf5bad61db615f1` |
| `B-crouch--1.38-swing_4_rad_s-most-body.png` | `dc0f6b2a740c2ba16972c791c6db3f91e0ef02254258558e4724113bf56e1628` |
| `B-crouch--0.9-turn_1_rad_s-most-body.png` | `6a025bfa3b60e290c360482f1efea3468dc01431b700b940570e54c7bd6afbbf` |
| `B-crouch-0-turn_3_rad_s-last.png` | `3ed02b152c39173b378e58a4e092c276ddf499fbcc5d2499a0481c15a6310400` |
| `B-crouch-1.38-walk_forward-last.png` | `4522b42bf0e0ffdf8e691f54dcf313ce2238ee02b40d6f11453db63c05306e08` |

The eight frames of `tests/first-person-rig.spec.js` from the focused run (`final/existing-pitch-view/`, Incursion; ink 0.2 percent in all eight):

| Frame | sha256 |
|---|---|
| `stand--1.38.png` | `d59aae167f8cfafcd439831f8b8ea2e05013825a5f66897bd57815acdb6a6089` |
| `stand--0.9.png` | `4ca0df1bd130e8bd41c6536c6ef318f45bb48306759a2f08a256fc2bbfbe00c1` |
| `stand-0.png` | `69c5304e01eb0e3bbe7cb61e38c0afc64551f79495a8265a5ec74c1f202b0709` |
| `stand-1.38.png` | `6458986bc8f7ceeb3fef878c58f3d912ed41ec66d19b65464aab1d8cf8eb4664` |
| `crouch--1.38.png` | `3900b0f6d9975bf116aee1dcdac7429f801ae0080b7edbe7aedf9136ca2f712e` |
| `crouch--0.9.png` | `9782d87a2daecba42568837a115c922b824abaf48843efd899e4b3c486c8ad96` |
| `crouch-0.png` | `1997e36ea33d1a1099fc21e2bc2dfade044a77cc914604ef2684af8773057504` |
| `crouch-1.38.png` | `715e9506e3b842dd1699efd9074715db38d6abce9e7adfb948fb34cca9fc4906` |

## Review warnings

| Warning | Status |
|---|---|
| B-01 lean in the body view | Resolved: bone difference exactly 0 |
| B-02 no test measures it | Resolved: `firstPersonBodyView.test.js` |
| W-07 body in front of the eye when the view swings | Resolved by measurement: ink at most 0.27 percent in every swing frame; cause was the standing foot turn |
| W-08 crouched frames on record | Most likely another character on the player's cell in Incursion; constructed, not observed |
| W-09 chest when crouch-walking and looking up | Resolved: own-body 0.00 percent (was 8.38) |
| W-10 three untested conditions | Resolved: three cases, each fails under its mutant |
| W-11 online fade trails the camera | No longer bears on first person; the lean never reaches the body view. Unchanged for how other players see the fade |
| W-12 owner sentence | Corrected in `07-37-PLAN.md`, not here |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] File-name bug in the new spec**
- **Found during:** Task 1, first run at HEAD
- **Issue:** a motion label with a slash ("turn 1 rad/s") became a file path; case B aborted after ten stills
- **Fix:** frame names are sanitised; the run was repeated; the aborted run is kept as `head-run1-aborted`
- **Files modified:** `tests/first-person-own-body.spec.js`
- **Commit:** `17646d0`

### Other deviations

- Two stops were returned to the orchestrator and answered by Amendments 1 and 2. The plan's three clearance steps were replaced by Amendment 1, E and then completed by Amendment 2, F.
- A leg joint counts as on screen only when it is in front of the camera (depth inside -1..1), stricter than the existing spec's read. Leg joints are asserted on still frames only.
- The own-body share keeps the shadow map during the hidden drawing, so the body's shadow is not counted.
- `BODY_VIEW_TORSO_BELOW_EYE` is a new export of `firstPersonRig.js`; the guard reads the margin from it.
- `src/builders/crouchFootTurn.test.js` is a new file, as Amendment 2 allows.
- Scratch probes outside the plan, no repository change: the Incursion enemy control, the in-memory mutant runs, two clearance estimates, bone and height probes, a third-person pelvis trace.
- Decision G was not added: F alone meets the limits.
- `AGENTS.md` was not updated; this plan's file list does not include it.

**Total deviations:** 1 auto-fixed (Rule 1), plus the items above. **Impact:** the delivered source differs from the plan as first written in the ways Amendments 1 and 2 record.

## Deferred Issues

- Incursion can place an enemy of the first wave on the player's own cell (`deferred-items.md`, open). It can blacken the hand-lowered frames of the pitch-view case of `tests/first-person-rig.spec.js`, which still starts Incursion.

## Open and not verified

- Human motion and aesthetic acceptance: pending, the owner's.
- The paired timing gate: `firstPersonRig.js`, `weaponHandling.js` and now `enemyAnimations.js` differ from the qualified identity. Nothing is requalified here.
- `tests/first-person-rig.spec.js` line 276 passes while the chest meshes are not drawn at its sampling point.
- The waist cap seen from above, and the legs-only first-person shadow in crouch: no frame checked.
- A stop or reversal that begins standing and runs into a crouch may show the same standing legs for up to 0.4 s; read from source (`animationPresentation.js` starts no transition while crouching, but one already running continues). Not measured.
- Online play, a real GPU, 60 frames per second: not measured.
- The 13:26 frames on record: explained only by a constructed control.
- Still standing from the earlier reviews: W-01 to W-06 of `07-33-REPAIR-REVIEW.md`.

## Self-Check: PASSED

- Created files exist: `tests/first-person-own-body.spec.js`, `src/builders/firstPersonBodyView.test.js`, `src/builders/crouchFootTurn.test.js`, `deferred-items.md`.
- All 14 commits listed are ancestors of HEAD `83f5ca5`.
- Acceptance criteria of the three tasks re-read against the final source: the new spec passes in both cases; the Node guard asserts bone equality, eye inside no mesh and 0.10 m clearance; the focused set, the two character-art cases and the five gates pass; every permitted edit is recorded with old and new text.
