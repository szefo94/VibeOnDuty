---
phase: 07-movement-matched-and-action-safe-animation
plan: "35"
subsystem: animation
tags: [three.js, weapon-handling, crouch, first-person, vitest, gap-closure, owner-item-L-01]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-27 composed live clips, 07-28 look-down offset, 07-34 pelvis held over the root and its first-person contact guard, the reviewed repair at 2f69dfe, and the owner's live check 07-33-OWNER-LIVE-CHECK.md (item L-01)"
provides:
  - "src/builders/weaponHandling.js: a crouched torso lean of CROUCH_TORSO_LEAN_RAD (12 degrees), eased per handler by the pose's sample time, faded out between +0.3 and +0.8 rad of upward aim"
  - "src/builders/crouchTorsoLean.test.js: 80 Node cases on the real rig, the live player, its first-person rig, the real handlers and enemy actors with a mounted weapon"
  - "Built-path figures for the lean, the weapon direction, both views' contact errors and the first-person body view at every pitch"
affects: [07-30, 07-31, 07-32, 07-36, 07-37, phase-5-omnimovement]

actuals:
  tokens: 19586
  tasks: 2
  commits: 6

plan_head_before: 6f1350e07df79ef7050183a4e28e693e6be701d9
plan_head_after: d2b17783b87661911ecb17f26ca247d69d215e5a
commits: 6

tech-stack:
  added: []
  patterns:
    - "A posture adjustment lives in the post-mixer weapon handler and goes through its save-and-restore, so the first-person view arms never see it"
    - "A second player given the recorded ticks of the first, whose handler receives the same pose with one field changed, is the reference without the change"
    - "A tick list is produced by a generator that reads the driver between ticks, so samples land on the key times of the layer the driver plays"
    - "A view guard compares each sample with the same sample with the change undone, not with an absolute figure"

key-files:
  created:
    - src/builders/crouchTorsoLean.test.js
  modified:
    - src/builders/weaponHandling.js

key-decisions:
  - "Amendment 1 (orchestrator, after a failing run): both halves of the first-person body-view guard compare with the same sample with the lean undone; the absolute wording fails with no lean at all"
  - "The torso line and the chest and head bands are asserted from the plan's planning table by degrees of lean, so the file holds for 6 to 13 degrees; at 12 they are the plan's literal figures"
  - "The handler also takes the target at once when its skeleton object changed, sets an inactive handler's amount to 0, and leans nothing when one of the four bones is missing"
  - "No requirement is marked complete; ANIM-02 and ANIM-03 stay with plans 07-32, 07-36 and 07-37"

patterns-established:
  - "The one-line constant is read by the tests and bounded by a guard that binds one degree above the allowed range"

requirements-completed: []

coverage:
  - id: D1
    description: "A crouched character's torso leans forward by CROUCH_TORSO_LEAN_RAD, eased in and out, for the local player with each of four weapons, in the crouch walk at every key in four directions, and for enemy actors with a mounted weapon; standing, the gaits, sprint and the jump chain show no lean at all"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#leans the settled chest forward by the constant"
        status: pass
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#no bone differs from the player whose handler is never told of a crouch"
        status: pass
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#leans by the constant when crouching and not otherwise"
        status: pass
    human_judgment: true
    rationale: "Whether 12 degrees is the lean the owner asked for is the owner's judgment in plan 07-36. Measured in Node on bones; no browser ran and no one has looked at it."
  - id: D2
    description: "The weapon keeps its direction and both hands stay on it: hand_r turns by at most 1.1e-6 degrees against the lean undone, and no third-person or first-person contact error exceeds the value without the lean by more than 2e-8 m"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#keeps the weapon pointing where it pointed, and the support hand on it"
        status: pass
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#leaves every bone of the view arms where the player without the lean has it"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonContact.test.js#no view hand is further from its contact than with the authored clips, plus 0.005 m"
        status: pass
    human_judgment: false
  - id: D3
    description: "With the lean on, the first-person body view shows no more torso vertices, and no more nearer than 0.30 m, than with the lean undone, at every pitch from +1.38 to -1.38, three aspect ratios, standing, settled crouch and every key of the crouch walk; the guard holds at 6 and 13 degrees and breaks at 14"
    requirement: ANIM-03
    verification:
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#no more torso vertices are in view than with the lean undone"
        status: pass
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#no more torso vertices are nearer than 0.30 m than with the lean undone"
        status: pass
      - kind: unit
        ref: "src/builders/crouchTorsoLean.test.js#holds at both ends of the range the constant may take, and binds above it"
        status: pass
    human_judgment: true
    rationale: "The guard was reworded after a failing run (Amendment 1) and is to be judged by the delta review of plan 07-37. It counts projected vertices in Node; nothing was rendered."

duration: 61min
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 35: Crouched torso lean in the weapon handler Summary

**A crouched character's torso now leans forward by one named amount, `CROUCH_TORSO_LEAN_RAD` = 12 degrees, in `src/builders/weaponHandling.js`: `spine_01` forward, `clavicle_l`, `clavicle_r` and `neck_01` back, eased over about 0.3 s and faded out between +0.3 and +0.8 rad of upward aim. The weapon direction, both views' contact errors and the first-person arms are unchanged to within 1e-6. Verified by unit tests on the real rig only; no browser ran and no one has looked at the result.**

## What must be read first

1. **Amendment 1: one guard was reworded after a failing run.** The orchestrator decided it, not the owner. It is recorded in `07-35-PLAN.md` (commit `62651d1`), and the delta review of plan 07-37 is asked to judge it.
   - **Old wording** (plan, task 2): no torso vertex of the first-person body view lies inside the frustum closer than 0.30 m, and the count between 0.05 and 0.6 m is never larger than in the same pose with the handler's corrections restored.
   - **New wording:** for every state, pitch and aspect ratio, no more torso vertices are in the frustum between 0.05 and 0.6 m than in the same sample with the lean undone, and no more are nearer than 0.30 m than with the lean undone.
   - **Why:** the absolute wording fails with no lean at all, so no lean value from 0 to 13 could pass it. Standing and looking down has torso vertices as near as 0.253 m; crouch-walking and looking straight up has them as near as 0.094 m; and the arm solves move 4 to 7 torso-weighted vertices against "corrections restored". The planning measurement used a posed skeleton, not the built path.
   - **How it happened:** I stopped task 2 on the plan's stop rule before committing anything of task 2, returned the figures, and continued after the amendment. The distances 0.05, 0.30 and 0.6 m did not change.
   - **In the test, "the lean undone"** is the same sample with the four lean bones put back to what the handler saved; the arm solves stay as the handler made them.
2. **Two properties older than this plan are open, covered by no test, and not changed here.** They are for the owner.
   - Crouch-walking and looking straight up: 175 torso vertices of the body view are in the frustum at pitch +1.33 and 720 at +1.38, as near as 0.094 m, with or without the lean (the lean is 0 there).
   - Standing and looking down: torso vertices are as near as 0.253 m; 52 to 243 are nearer than 0.30 m from pitch -1.27 down. Standing has no lean.
3. **A crouched character that aims upward straightens.** The lean is whole up to +0.3 rad of aim, 10.75 degrees at +0.4, 4.22 at +0.6 and absent from +0.8. It is whole at every downward aim.
4. **On pause the crouched third-person torso stands upright at once, and leans again at once on resume.** The paused loop's pose carries no crouching state and no sample time.
5. **The constant may be set from 6 to 13 whole degrees.** The default of 12 has one degree of room: 13 passes the body-view guard and 14 breaks it.
6. **The crouch entry and exit transients of review warning W-03 are unchanged.** The lean eases over them; the pelvis position still jumps on the first frame.
7. **The jump chain is not leaned.** The lean follows the simulated `crouching` state only.

## The rule as built

For a handler that has a skeleton, is not a view (fixed-anchor) handler, and carries the pose's current weapon:

- The crouch amount has the target 1 when the pose is alive and `crouching`, otherwise 0. It is stored on the handler (`crouchLean`).
- With `dt` the difference of `pose.sampleTimeSeconds` to that handler's previous update:
  - above 0 and at most 0.1 s: the amount moves toward the target with a time constant of 0.10 s;
  - exactly 0: it holds;
  - negative, above 0.1 s, a reset pose, a missing or non-finite time, or a handler that was not the active one: it takes the target at once.
- The applied lean is the amount times `CROUCH_TORSO_LEAN_RAD` times the fade of the pose's pitch (1 up to `CROUCH_LEAN_FADE_START_RAD` 0.3, 0 from `CROUCH_LEAN_FADE_END_RAD` 0.8, a smoothstep between; a missing pitch counts as 0).
- Above 0.0005 rad the four rotations go through the handler's `worldRotate`, after its restore and before the arm solves, also while melee, throw, roll or dance suppress the arm solves. The axis is the lateral axis of the skeleton root.

## Measured on the built path

All figures are from `src/builders/crouchTorsoLean.test.js` at commit `d2b1778`: the live player (`buildPlayerMesh`) and its first-person rig, one driver object as `src/loop.js` runs a frame, the real handlers. Character forward is +Z; metres and degrees.

### Posture, M4, level aim, settled crouch after 200 ticks of 1/60 s

| | Standing | Crouch, lean undone | Crouch, leaned | Planning |
|---|---|---|---|---|
| Chest pitch (`spine_03`) | -2.0 | -1.4 | 10.6 | 10.1 |
| Torso line (pelvis to `spine_03`) | 6.4 | 6.5 | 14.4 | 14.4 |
| `spine_03` ahead of the root / high | -0.005 / 1.275 | -0.005 / 0.871 | 0.050 / 0.863 | 0.050 / 0.859 |
| Head bone ahead / high | 0.004 / 1.529 | 0.007 / 1.124 | 0.098 / 1.113 | 0.096 / 1.111 |
| Weapon yaw / pitch | -0.21 / -0.39 | -0.19 / -0.48 | -0.19 / -0.48 | 0.0 / 0.0 |

- The chest lean (chest pitch over the lean undone) is 12.00 degrees.
- The head is 0.091 m further forward and 0.011 m lower than with the lean undone; the chest 0.055 m further forward and 0.008 m lower.
- The simulated crouched eye is at 0.85 m; the head bone is at 1.113 m.

### Third-person lean by upward aim, crouched and settled

| Pose pitch (rad) | Applied lean | Torso line |
|---|---|---|
| every downward pitch, and up to +0.3 | 12.00 | 14.1 at +0.3 |
| +0.4 | 10.75 | 13.3 |
| +0.6 | 4.22 | 9.0 |
| +0.8 and above | 0 | 6.2 |

The fade follows the pitch on the same update: one update at +1.0 gives 0, the next at 0 gives the whole lean.

### Per weapon, crouch pressed, held 200 ticks and released (320 ticks)

Every weapon measures chest lean 12.00, chest pitch 10.6, torso line 14.4, and the M4 chest and head positions. Contact errors are the largest over the run, with the lean / without it.

| Weapon | `hand_r` turn against the lean undone (deg) | Third-person support (m) | First-person support (m) | First-person trigger (m) |
|---|---|---|---|---|
| M4 | 1.1e-6 | 8.4e-8 / 7.6e-8 | 1.3e-7 / 1.3e-7 | 8.3e-8 / 8.3e-8 |
| Pistol | 1.1e-6 | 7.8e-8 / 7.0e-8 | 8.9e-8 / 8.9e-8 | 1.0e-7 / 1.0e-7 |
| AWP | 1.1e-6 | 6.3e-8 / 4.7e-8 | 1.6e-7 / 1.6e-7 | 8.6e-8 / 8.6e-8 |
| P90 | 1.1e-6 | 7.0e-8 / 6.7e-8 | 1.5e-7 / 1.5e-7 | 1.1e-7 / 1.1e-7 |

- The largest third-person excess on one tick is 1.9e-8 m (limit 0.005).
- Every bone of the view arms equals the player without the lean exactly (difference 0) on all 320 ticks, for all four weapons.
- Only one handler turns the torso on any tick.

### Crouch walk at every key, M4

39 keys of the lower layer of `live_crouch_<direction>` in each direction, sampled within 1e-6 of the key.

| Direction | Chest lean | Torso line | Weapon yaw / pitch turn | `spine_03` yaw turn | Head ahead (m) | Head high (m) |
|---|---|---|---|---|---|---|
| forward | 11.999 to 12.000 | 14.1 to 14.2 | 2.6e-7 / 9.6e-7 | 0.011 | 0.093 to 0.096 | 1.106 to 1.167 |
| back | 11.999 to 12.000 | 14.4 to 14.6 | 2.6e-7 / 1.0e-6 | 0.012 | 0.097 to 0.099 | 1.105 to 1.166 |
| left | 11.999 to 12.000 | 14.2 to 14.4 | 2.7e-7 / 1.0e-6 | 0.009 | 0.092 to 0.097 | 1.106 to 1.167 |
| right | 11.999 to 12.000 | 14.3 to 14.5 | 2.7e-7 / 1.0e-6 | 0.010 | 0.094 to 0.096 | 1.106 to 1.166 |

The turns are against the lean undone; the limit is 0.2 degrees.

### Crouched actions at every key of the upper clip, M4

| Action | Keys | `hand_r` turn (deg) | Third-person support, with / without (m) | First-person support | First-person trigger |
|---|---|---|---|---|---|
| ADS | 61 | 9.4e-7 | 9.4e-8 / 9.1e-8 | 9.2e-8 / 9.2e-8 | 6.5e-8 / 6.5e-8 |
| Fire | 13 | 9.6e-7 | 4.0e-8 / 4.0e-8 | 6.7e-8 / 6.7e-8 | 5.7e-8 / 5.7e-8 |
| Reload | 109 | 1.1e-6 | 6.8e-8 / 6.8e-8 | 1.3e-7 / 1.3e-7 | 1.1e-7 / 1.1e-7 |

The lean is whole (12.00) on every one of these keys.

### States with exactly no lean, M4

After a crouch and its release, sampled at every key of the layer the driver plays. On every key the handler turned `spine_01` by 0, no handler held a lean bone, and no bone differs (difference 0) from the player whose handler is never told of a crouch.

| State | Keys | State | Keys |
|---|---|---|---|
| standing idle | 61 | run forward / back | 23 / 17 |
| walk forward / back | 42 / 42 | run left / right | 30 / 44 |
| walk left / right | 30 / 44 | sprint | 23 |
| jump start | 26 | jump loop / land | 49 / 25 |

### Easing

| Cadence | Measured |
|---|---|
| Local, 1/60 s per tick | 15.4 % of the constant after one tick, above 95 % after 18 ticks (0.30 s), 99.3 % at 0.5 s; 84.6 % one tick after release, 0.7 % at 0.5 s |
| Remote: snapshots 1/30 s apart, each on two updates | 28.3 % on the first update, held exactly on the repeat, 99.3 % after 15 snapshots, largest single step 28.3 %; the same at the handler and through `tickPresentation` on an enemy actor |
| Review panel: a newly active handler, the same sample time on every update | 100 % from the first update, on five updates |
| One step of 0.09 s | 59.3 %; a repeated time then holds it whatever the target |
| Reset pose, backward step, step above 0.1 s, missing or NaN time | the target at once; the stored amount stays finite |

### Enemy actors (real `buildEnemyMesh` with the real enemy weapon mount, `tickPresentation` only)

The mount builds in Node. All four roles (assault/M4, smg/P90, sniper/AWP, pistol) measure the same: applied lean 12.00, chest pitch 10.6, torso line 14.4, chest 0.050 m ahead and 0.863 m high, head 0.098 / 1.113, `hand_r` turn 1.0e-6 degrees, 0 when standing, 15.4 % after one tick, 99.3 % at 0.5 s, 0.7 % left 0.5 s after release.

### First-person body view

Method: the drawn vertices of the body view whose heaviest bone is a spine, clavicle or pelvis bone (4145), placed as the skinning shader places them; camera 75 degrees, near plane 0.05 m; counted inside the frustum between 0.05 and 0.6 m along the view axis, and separately nearer than 0.30 m. Counts are at 4:3 / 16:9 / 21:9. The sweep is 57 pitches from +1.38 to -1.38, at most 0.05 rad apart.

| State | Samples | Handler (12 degrees, with fade) | Lean undone | More than the lean undone |
|---|---|---|---|---|
| Standing sweep | 57 | up to 1988/1988/1988 in view, 243 nearer than 0.30 m | the same | 0 |
| Settled crouch sweep | 57 | 0 at every pitch | 0 | 0 |
| Settled crouch at +1.38, +1.1, +0.9 | 3 | 0 | 0 | 0 |
| Crouched look-down, 7 pitches to -1.411 | 7 | up to 19 in view, none nearer than 0.30 m | up to 22 | 0 |
| Crouch walk, 39 keys at each of 57 pitches | 2223 | up to 720/720/720 in view, all nearer than 0.30 m | the same | 0 |

This file's own four rotations on the body view, at several amounts with the fade, against the lean undone over all 2347 samples:

| Degrees | Samples with more in view, or more nearer than 0.30 m, than the lean undone |
|---|---|
| 6, 8, 10, 12, 13 | 0 |
| 14 | 35: settled crouch at +0.13 to +0.33 (4, 15, 11, 11 and 8 vertices), crouch walk at +0.33 (11/11/23) |

- At the constant, this file's rotations equal the handler's four bones within 1e-9 on every sample, so the table is the handler's rule.
- The same was checked on the handler itself with the constant served at other values from a scratch Vitest config (no repository file changed): at 6, 8 and 13 degrees 79 of 80 cases pass, the one failure being the case that reads the one line from the file, which still says 12; at 14 the settled-crouch and crouch-walk cases of both halves fail (`crouched sweep 0.33, 4:3: ... expected 8 to be less than or equal to 0`).

Without the fade, at 12 degrees, settled crouch, torso vertices in view:

| Pitch | 4:3 / 16:9 / 21:9 | Planning (4:3) |
|---|---|---|
| +1.38 | 1157 / 1173 / 1191 | 995 |
| +1.1 | 531 / 563 / 563 | 511 |
| +0.9 | 44 / 59 / 59 | 71 |
| +0.63 and below | 0 | - |

The control runs these rotations at 12 degrees without the fade at +0.9 and breaks the guard, as required.

The two older properties, per pitch, identical with and without the lean:

| State | Pitch | In view | Nearer than 0.30 m |
|---|---|---|---|
| Standing | -1.17 | 10 | 0 |
| | -1.22 | 485 | 0 |
| | -1.27 | 809 | 52 |
| | -1.32 | 1478 | 165 |
| | -1.37 | 1915 | 242 |
| | -1.38 | 1988 | 243 |
| Crouch walk, largest over 39 keys | +1.33 | 175 | 175 |
| | +1.38 | 720 | 720 |

Recorded and asserted against nothing: against "the handler's corrections restored" the standing count is 1478 against 1471 at -1.32 and 1988 against 1984 at -1.38.

### Look-down with the lean, crouched

The eye in front of `spine_03` of the body view, limits 0.10 and 0.60 m:

| Camera pitch | 0 | -0.4 | -0.8 | -1.1 | -1.3 | -1.38 | -1.411 (with head bob) |
|---|---|---|---|---|---|---|---|
| Metres | 0.132 | 0.168 | 0.205 | 0.232 | 0.232 | 0.232 | 0.232 |

Over the whole sweep: 0.130 to 0.232 m crouched, 0.128 to 0.232 m in the crouch walk, 0.185 to 0.287 m standing. Planning predicted 0.130 at a level view.

## What did not change

- No clip, no driver byte, no rig byte: `src/builders/enemyAnimations.js` is byte-identical to commit `3665406` (SHA-256 `f150cb50…2885`); `enemyGLTF.js` (`802b7414…1781`) and `firstPersonRig.js` (`c0db631c…f1d1`) equal the review record.
- Legs, pelvis and feet: no clip changes, and the handler turns only `spine_01`, `clavicle_l`, `clavicle_r` and `neck_01`.
- The first-person arms: bone for bone what they are without the lean.
- Standing, the eight gaits, sprint and the jump chain: no bone differs.
- The crouch entry and exit transient (W-03), the crouched head height against the eye, foot sliding and every other review warning.
- Nothing under `tests/`, `public/`, `server/`, `tools/`; no existing unit test byte.

## Performance

- **Duration:** 61 min of work, with a stop and an orchestrator decision in between
- **Started:** 2026-10-11T11:13:17Z
- **Completed:** 2026-10-11T12:15:16Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 source, 1 new test)

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/builders/crouchTorsoLean.test.js` at `d2b1778` | exit 0, 80 of 80 |
| The five guard files of task 2 (`crouchTorsoLean`, `firstPersonContact`, `firstPersonLookDown`, `liveClipRoute`, `presentationInertia`) | exit 0, 222 of 222 |
| `weaponHandling.test.js`, `firstPersonContact.test.js`, `firstPersonRig.test.js` at `2b83215` (task 1) | exit 0, 40 of 40 |
| `npm test` at `d2b1778` | exit 0, 545 tests in 36 files (465 in 35 before this plan) |
| `npm run lint` | exit 0, no warnings |
| `git diff --quiet 3665406..HEAD -- src/builders/enemyAnimations.js tests/fixtures tests/animation-resources.spec.js` | exit 0 |
| `git diff --quiet 2f69dfe..HEAD` on the protected builders, the four existing guard tests, `tests public server tools` | exit 0 |
| Allowed-files check since `2f69dfe` | exit 0: `src/builders/weaponHandling.js`, `src/builders/crouchTorsoLean.test.js` |

Not run: any browser suite, any capture, the build, the typechecks, `tools/art/frozen-bytes.mjs`, the timing gates. The dev server on port 5173 was neither stopped nor restarted.

### TDD record

| Step | Commit | State |
|---|---|---|
| RED, task 1 | `9b0d3df` | 10 of 14 failed: `CROUCH_TORSO_LEAN_RAD` not exported, the crouched chest did not lean |
| Instrument fix | `f5e7e45` | tests only, still failing on unchanged source (see deviation 1) |
| GREEN, task 1 | `2b83215` | 14 of 14; the lean without the fade |
| Stop | - | task 2 drafted and measured, nothing committed; returned to the orchestrator |
| Amendment 1 | `62651d1` | the orchestrator's commit to `07-35-PLAN.md` |
| RED, task 2 | `d2aed94` | 9 of 80 failed on the lean without a fade |
| GREEN, task 2 | `d2b1778` | 80 of 80; the fade |

Failing assertions at the task 1 RED, verbatim: `radians the handler turned spine_01: expected +0 to be close to NaN` (the target; the constant was undefined) and `expected undefined to be type of 'number'`.

Failing assertions at the task 2 RED, verbatim:

- `expected undefined to be 0.3 // Object.is equality` (the fade bounds are not exported)
- `crouched sweep 1.38: expected 0.10466674461771147 to be less than or equal to 1e-9` (this file's faded rotations against the handler's)
- `crouched sweep 1.38, 4:3: torso vertices between 0.05 and 0.6 m: expected 1133 to be less than or equal to 0` (the target)
- `crouched, planning pitches 1.38, 4:3: ... expected 1157 to be less than or equal to 0`
- `crouch walk sweep 1.38, 4:3: ... expected 1195 to be less than or equal to 0`
- the same three states for `torso vertices nearer than 0.3 m` (1133, 1157, 1195 against 0)
- `pitch 1.38: chest lean: expected 11.999936409265931 to be less than or equal to 0.2` (the third-person fade)

Both RED records returned `RED_EVIDENCE_OK` (`target_test_failed`) from `check tdd-red-evidence`; they are in the ignored cache as `07-35-tracer-red.json` and `07-35-task2-red.json`. Semantic assessment: each target ran on the real GLB and failed on its planned assertion with a measured value; no load, fixture or syntax failure. The 71 task 2 cases that passed at RED hold without a fade (weapons, crouch walk, actions, absent states, enemies, look-down, the range ends and the control, which use this file's own rotations).

Tracer feedback gate after `2b83215`: the three task 1 verify commands were re-run at the commit and exit 0, then expansion.

All task 2 cases are in the one RED commit. After the fade no further source change was needed, so there is no third step.

## Task Commits

1. **Task 07-35-01 (tracer), RED** - `9b0d3df` (test)
2. **Task 07-35-01, instrument fix** - `f5e7e45` (test)
3. **Task 07-35-01, GREEN** - `2b83215` (feat)
4. **Amendment 1** - `62651d1` (docs, by the orchestrator)
5. **Task 07-35-02, RED** - `d2aed94` (test)
6. **Task 07-35-02, GREEN** - `d2b1778` (feat)

The measured count of 6 since the plan base includes the orchestrator's commit; five are the executor's.

## Files Created/Modified

- `src/builders/weaponHandling.js` - 53 lines added, none changed or removed. SHA-256 `6bcd00e7…3aa3`. The file was LF only and stays LF only (0 carriage returns, 329 lines). New exports: `CROUCH_TORSO_LEAN_RAD`, written `export const CROUCH_TORSO_LEAN_RAD = 12 * Math.PI / 180;` on one line, `CROUCH_LEAN_FADE_START_RAD` and `CROUCH_LEAN_FADE_END_RAD`. New handler fields: `crouchLean`, `crouchLeanTime`, `crouchLeanSkeleton`.
- `src/builders/crouchTorsoLean.test.js` - new, 1055 lines, 80 cases, LF. SHA-256 `3f650b13…8250`.

## Decisions Made

- **The measure of "the lean undone".** The four lean bones are put back from the handler's corrections map; the arm solves stay. The player "without the lean" is a second player given the recorded ticks whose handler receives the same pose with `crouching: false`.
- **Every key through the driver.** Ticks are timed so that the gait phase, the jump phase, the action phase or a free-running layer lands on each key time of the layer the driver plays; each keyed sample is asserted to be within 1e-6 of its key. A looping layer's last key is sampled 1e-6 of the clip before it, because the layer wraps there.
- **Sprint** is sampled at the keys of its lower layer (`run_forward`); its upper clip runs in real time.
- **Pitch sweep in the crouch walk.** For every pitch one whole cycle through all 39 keys, so every key is seen at every pitch.
- **Aspect ratios** change only the horizontal bound of the frustum; the vertical field of view stays 75 degrees.

## Deviations from Plan

### 1. [Rule 1 - Test instrument] `Quaternion.angleTo` misread a turn

- **Found during:** task 1, first run after the handler change.
- **Issue:** mixer output is not exactly unit length, so `angleTo` read a turn of 12 degrees as 11.99995, more than the equality tolerance of the guard.
- **Fix:** the test measures a turn with `atan2` of the vector and scalar parts, which does not assume unit length. No limit, case or expectation changed.
- **Committed in:** `f5e7e45`, between the RED and the GREEN of task 1.

### 2. [Plan intent - accepted in Amendment 1] Bands by degrees of lean

- **Issue:** the plan asserts a torso line of 14.4 ± 1.5 and three position bands that hold for 12 degrees only; plan 07-36 re-runs this file with the constant at 6 to 13, where the literal figures fail below about 10 degrees.
- **Fix:** the test takes the torso line from the plan's planning table by degrees of lean (interpolated between its rows), and moves each position band by the difference of its planning figure to the row of 12. At 12 degrees these are the plan's literal 14.4, 0.03 to 0.07, 0.07 to 0.12 and 1.09 to 1.13.
- **Committed in:** `9b0d3df` (torso line), `d2aed94` (bands).

### 3. [Rule 2 - Handler details beyond the rule's text]

- The handler also takes the target at once when its skeleton object changed since its previous update.
- A handler that is not the active one has its stored amount set to 0.
- If any of the four bones is missing, nothing leans. The frozen `weaponHandling.test.js` drives a skeleton that has only `hand_r`.
- **Committed in:** `2b83215`.

### 4. A dead pose with a sample time eases the lean out

The rule gives a dead pose the target 0 and no exception from the easing, so a character that dies crouched loses the lean over about 0.3 s of the death clip. A dead pose without a time drops it at once. This is the rule as written; it is stated because nothing else says it.

### 5. "A standing actor pays one comparison"

True for the bone work: nothing is turned and nothing is allocated. The easing itself runs on every update of an active handler and is a few scalar operations.

### 6. The control runs at a fixed 12 degrees

The plan's control applies "the full constant" without the fade at +0.9. At 6 to 10 degrees the un-faded constant puts no vertex in view at that pitch, so the control would stop failing when the owner lowers the constant. The test runs it at the plan's 12 degrees whatever the one line holds, and additionally asserts the constant itself without a fade at +1.38.

### 7. [Plan stop rule] Task 2 stopped and was continued after Amendment 1

Described under "What must be read first", item 1. No limit, fade bound, range or default was tuned.

**Total deviations:** 7 recorded (1 test instrument, 1 accepted plan-intent change, 1 set of handler details, 3 statements, 1 stop with an amendment). **Impact:** one guard reworded by the orchestrator after a failing run; no file outside the two touched.

## Issues Encountered

- Shell quoting mangled two scratch scripts (backticks and backslashes inside `node -e`); they were rewritten as files. Nothing in the repository was affected.
- The first draft of the remote cadence case stepped 2/30 s on its first update, a harness error that read 48.7 % instead of 28.3 %; fixed before the task 2 commit.
- Every git command prints `warning: unable to find all commit-graph files`, as recorded in `07-34-SUMMARY.md`. Nothing was done about it.

## Open items and what is not verified

1. **No browser ran.** Nothing was rendered. Every view figure is projected vertices in Node; near-plane clipping, the comic outline and the look of the lean are unseen.
2. **Human judgment.** Whether 12 degrees is the lean the owner asked for is plan 07-36. `humanMotionAcceptance` stays `pending`.
3. **Amendment 1** awaits the delta review of plan 07-37.
4. **The two older properties** of the body view (item 2 at the top) are open for the owner.
5. **Tick rates.** The lean was run at 1/60 s per tick and at the remote cadence; 0.05 s per tick was not run for the lean.
6. **States not measured for the lean:** throw, melee, roll and dance while crouched (the lean is applied, the arm solves are not), death, a crouch entered while moving, diagonal crouch walking, weapons other than M4 in the crouch walk and the crouched actions.
7. **Remote players** carry `weapon: 'm4'` and a snapshot time of tick/30; a gap of more than 0.1 s between presented snapshots makes the lean take its target at once. Not measured online.
8. **Timing gates.** `src/builders/weaponHandling.js`, one of the five mutable runtime files, changed identity. No timing gate was run or requalified (plans 07-30, 07-31). A crouched actor now does four more bone rotations per update.
9. **`AGENTS.md`** was not edited (plan 07-32).
10. **The contact figures** are the solver's shortfall; they show the hands reach, not how the grip looks.

## Evidence outside the repository history

In the ignored cache `.planning/research/.cache/`: `07-35-tracer-red.json`, `07-35-task2-red.json`, and the folder `07-35-task2/` with `final-figures.json` and `final-digest.txt` (the figures of this summary), the draft as it stood at the stop, the figures of the runs with the constant served at 6, 8, 10, 13 and 14, and the scratch Vitest config.

## Self-Check: PASSED

- `src/builders/crouchTorsoLean.test.js` and `src/builders/weaponHandling.js`: found.
- Commits `9b0d3df`, `f5e7e45`, `2b83215`, `d2aed94`, `d2b1778`: ancestors of HEAD; `git rev-list --count 6f1350e..HEAD` is 6 with the orchestrator's `62651d1`.
- Acceptance criteria re-run at `d2b1778`: the new test was committed failing first in both tasks and passes now; `git diff 2f69dfe..HEAD --stat -- src` lists only the two files; `CROUCH_TORSO_LEAN_RAD` is one exported constant on one line and the tests take the amount from it; all cases pass for four weapons; every existing test file passes with no byte changed; `npm test` and `npm run lint` exit 0.
- No stub, no skipped test, no verify command left unrun.

## Next Phase Readiness

Plan 07-36 can preview the lean. The constant may be changed on its one line to a whole number from 6 to 13; this file was run on the handler at 6, 8 and 13 and passes there apart from the case that reads the line.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-11*
