---
phase: 07-movement-matched-and-action-safe-animation
plan: "28"
subsystem: animation
tags: [three.js, first-person, view-offset, vitest, gap-closure]

requires:
  - phase: 07-movement-matched-and-action-safe-animation
    provides: "07-27 composed live clips (the crouch pose live play shows) and the owner's review item H-13"
provides:
  - "Body view offset in src/builders/firstPersonRig.js that keeps the eye in front of the chest at every camera pitch"
  - "src/builders/firstPersonLookDown.test.js: guard on the live player and its first-person rig, with a control on the withdrawn offset"
  - "Measured eye-to-chest distances before and after, and the H-01 measurement"
affects: [07-29, 07-30, 07-31, 07-32, 07-33]

actuals:
  tokens: 4552
  tasks: 1
  commits: 2

plan_head_before: 965bb9d314e82bad11cfbd529b054035773e00d7
plan_head_after: 779ef7f9116ec6dd823e76c8f902abd4f2a85d9e
commits: 2

tech-stack:
  added: []
  patterns:
    - "A view guard drives the real player actor and its real rig as src/loop.js does, and measures along the body's forward axis in metres"
    - "A guard has a control that re-measures the same pose under the withdrawn design"

key-files:
  created:
    - src/builders/firstPersonLookDown.test.js
  modified:
    - src/builders/firstPersonRig.js

key-decisions:
  - "The body view moves back, not forward, as the pitch goes down: -0.18 m at a level view as before, -0.28 m at the presentation's pitch bound of 1.1 rad"
  - "The size 0.10 m is the measured forward travel of the neck base (0.099 m) under the driver's torso lean of 0.55 x pitch, so the eye stays as far in front of the neck base as at a level view"
  - "H-01 stays open and not diagnosed: at the collector's pitches (0 and +0.423) the old and the new offset are the same and the eye is in front of the chest"
  - "No requirement is marked complete; the view is judged by the owner in plan 07-33"

patterns-established:
  - "Limits come from the plan; figures the plan does not limit are recorded and asserted against nothing"

requirements-completed: []

coverage:
  - id: D1
    description: "Looking down in first person, the eye is at least 0.10 m and at most 0.60 m in front of the chest (spine_03) at every camera pitch, standing and in the composed crouch"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#the eye stays at least 0.10 m in front of the chest at every pitch"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#the eye is never more than 0.60 m in front of the chest"
        status: pass
    human_judgment: true
    rationale: "A distance between the eye and a bone excludes the reported defect only. No browser ran and no one has looked at the view; whether it looks right is the owner's judgment in plan 07-33."
  - id: D2
    description: "The change is view-only: level offset unchanged, offset continuous in pitch and independent of yaw; source, camera and arms view not moved"
    requirement: ANIM-02
    verification:
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#the update moves the body view only, and only along its forward axis"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#a level view keeps the body offset it had"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#the body offset is continuous in pitch"
        status: pass
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#the body offset does not depend on yaw"
        status: pass
    human_judgment: false
  - id: D3
    description: "H-01 measured on the reload pose: not explained by this offset at the collector's pitches; recorded open"
    verification:
      - kind: unit
        ref: "src/builders/firstPersonLookDown.test.js#measures the reload pose for owner item H-01 and asserts no limit on it"
        status: pass
    human_judgment: true
    rationale: "The test records figures and asserts no limit on them. H-01 is not diagnosed and stays open for the owner."

duration: 18min
completed: 2026-10-11
status: complete
---

# Phase 7 Plan 28: First-person look-down body offset Summary

**The first-person body view now moves 0.10 m back instead of 0.43 m forward as the camera pitches down, so the eye stays in front of the chest (standing 0.18 to 0.29 m, crouched 0.42 to 0.52 m). Verified by unit tests on the real rig only; no browser ran, no one has looked at the view, and an existing browser assertion is predicted to fail (see "Predicted conflict").**

## What changed

`src/builders/firstPersonRig.js`, `updateFirstPersonRig`, one expression and its comment:

- before: `bodyForward = -.18 + .43 * clamp(-pitch / 1.1)` (body 0.25 m in front of the root when looking down)
- after: `bodyForward = -.18 - .1 * clamp(-pitch / 1.1)` (body 0.28 m behind the root when looking down)

Nothing else in the file changed: 8 lines added, 4 removed, all in that block. The arms view, the view weapon, `rig.source`, the simulated eye and disposal are untouched. No allocation was added. The offset depends on the camera pitch only.

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-11T07:35:50Z
- **Completed:** 2026-10-11T07:53:00Z
- **Tasks:** 1 of 1
- **Files modified:** 2 (1 source, 1 new test)

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/builders/firstPersonLookDown.test.js src/builders/firstPersonRig.test.js` | exit 0, 47 of 47 passed (45 + 2) |
| `npm test` | exit 0, 424 tests in 34 files (379 in 33 before this plan) |
| `npm run lint` | exit 0, no warnings |
| Changed-files guard since `e09bf9b` | exit 0: `enemyAnimations.js`, `enemyGLTF.js`, `firstPersonRig.js` and the three new tests only |
| `npm run typecheck` (not required by the plan) | exit 0 |

All four verify commands were run twice: on the working tree before the GREEN commit and again at `779ef7f` (tracer gate). `src/builders/firstPersonRig.test.js` passes with no byte changed (SHA-256 `9dce4bc6…9ea9`). `public/models/enemy.glb` and everything under `tools/`, `tests/`, `public/` and `server/` are unchanged.

Not run: any browser suite, any capture, the build, `tools/art/frozen-bytes.mjs`, the timing gates.

### TDD record

| Step | Commit | State |
|---|---|---|
| RED | `56c592c` | 8 of 45 failed, 37 passed |
| GREEN | `779ef7f` | 45 of 45 passed |

The eight failures at RED are the case "the eye stays at least 0.10 m in front of the chest at every pitch", standing and crouched, at yaw 0, 90, 180 and 270. Verbatim:

- `pitch -0.40: expected 0.02739821440267054 to be greater than or equal to 0.1` (standing)
- `pitch -1.10: expected -0.014831518911770477 to be greater than or equal to 0.1` (crouched)

RED evidence record: `.planning/research/.cache/07-28-red-lookdown.json` (ignored cache), whole-file run with the `tap-flat` reporter. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target test ran and failed on the planned assertion with a measured distance; no load, fixture or syntax failure is credited; the 37 other cases passed, including the control. No refactor commit.

## Measured eye-to-chest distance, before and after

The live player actor (`buildPlayerMesh`) and its own rig (`playerFirstPersonRig`), driven as `src/loop.js` runs a frame: root under the eye, `tickPresentation` and `finishPresentation` with the same pitch, then `updateFirstPersonRig`. Standing eye 1.65 m, crouched eye 0.85 m; the crouch is pressed from standing and 120 frames let its inertia expire. Distance is the eye minus the body view's `spine_03` along the body's forward axis, in metres; negative means the eye is behind the chest. Identical at yaw 0, 90, 180 and 270.

| Camera pitch (rad) | Offset before | Offset after | Standing before | Standing after | Crouched before | Crouched after |
|---|---|---|---|---|---|---|
| 0 | -0.180 | -0.180 | 0.184 | 0.184 | 0.415 | 0.415 |
| -0.4 | -0.024 | -0.216 | 0.027 | 0.220 | 0.259 | 0.452 |
| -0.8 | 0.133 | -0.253 | -0.129 | 0.257 | 0.102 | 0.488 |
| -1.1 | 0.250 | -0.280 | -0.246 | 0.284 | -0.015 | 0.515 |
| -1.3 (review panel) | 0.250 | -0.280 | -0.246 | 0.284 | -0.015 | 0.515 |
| -1.38 (live limit of `player.pitch`) | 0.250 | -0.280 | -0.246 | 0.284 | -0.015 | 0.515 |
| -1.411 (limit plus the largest head bob) | 0.250 | -0.280 | -0.246 | 0.284 | -0.015 | 0.515 |

Over a sweep of 58 pitches from +1.411 to -1.411 rad, 0.05 rad apart:

| | Before | After | Limit |
|---|---|---|---|
| Standing, nearest to farthest | -0.246 to 0.186 | 0.184 to 0.287 | 0.10 to 0.60 |
| Crouched, nearest to farthest | -0.016 to 0.415 | 0.415 to 0.515 | 0.10 to 0.60 |
| Largest change of the offset between neighbours | 0.0195 | 0.0045 | under 0.03 |
| Offset at a level view | -0.180 | -0.180 | -0.18 within 0.001 |

Before the change the standing distance fell under 0.10 m from the sweep sample at -0.24 rad (0.092 m) and the eye was behind the chest from -0.49 rad; crouched, under 0.10 m from -0.84 rad (0.086 m) and behind from -1.09 rad. The plan estimated "from about -0.5 rad" for standing; that is where the eye goes behind the chest, the 0.10 m limit is crossed earlier.

The pose itself, level view: `spine_03` is 0.004 m behind the root standing and 0.235 m behind it crouched (plan: 0.005 and 0.235).

View-only checks on every one of the 520 samples (8 runs of 65): source position and rotation exactly unchanged by the update; camera position and rotation exactly unchanged; body view rotation and scale exactly the source's; body offset off its forward axis at most 7e-17 m; arms view position against the unchanged formula at most 2.4e-15 m. Between yaws the offset differs by at most 9e-16 m and the distance by at most 3e-15 m.

Control (asserts a violation, and does): the same poses re-measured with the body placed by the withdrawn term give -0.246 m standing at -1.3 and at -1.38 rad, and -0.015 m crouched at -1.38 rad.

### Neck base, measured and asserted against nothing

The driver leans `spine_03` by 0.55 x pitch, and the presentation bounds the pitch at 1.1 rad. That lean does not move `spine_03` itself (0.0002 m) but brings the neck base (`neck_01`) 0.099 m forward at the bound, standing and crouched. Eye in front of `neck_01`:

| | Level | Looking down, before | Looking down, after |
|---|---|---|---|
| Standing | 0.189 | -0.340 | 0.190 |
| Crouched | 0.421 | -0.108 | 0.422 |

This is where the size 0.10 m comes from (see Decisions). These are bone origins, not mesh surfaces.

## H-01 (back visible during reload in a capture movie)

Measured with the same rig, M4 reload at 12 phases of the action, yaw 0. The pitch of the collector's movies was read, not assumed:

- the client that films the other one is levelled by the collector (`tools/art/moving-online.mjs`, `aim` sends `movementY = pitch / MOUSE_SENS`): pitch 0;
- the client that reloads had pitch +0.423 rad (looking up) in all three tiers of `evidence/07-motion-review.json` (`online.observations[*].seen.reload.p.pitch`).

| Reload, camera pitch (rad) | Standing before | Standing after | Crouched before | Crouched after |
|---|---|---|---|---|
| 0 | 0.184 | 0.184 | 0.415 | 0.415 |
| +0.423 | 0.184 to 0.185 | 0.184 to 0.185 | 0.415 | 0.415 |
| -0.4 | 0.029 | 0.221 to 0.222 | 0.258 | 0.451 |
| -0.8 | -0.127 | 0.258 to 0.259 | 0.102 | 0.487 |
| -1.1 and below | -0.244 | 0.286 to 0.287 | -0.016 | 0.514 |

**Finding: H-01 is not explained by this offset. It stays not diagnosed and open.** At both collector pitches the old offset is the same as the new one (-0.18 m; the forward term only acted below a level view) and the eye is 0.184 m in front of the chest during the whole reload, before and after. The old offset did put the eye behind the chest during a reload once the view was below about -0.47 rad, as in any other state; no recorded collector pitch is in that range.

Read from the collector source and not investigated further: the reload is pressed on the second client while the first client's movie films it, so in that movie the reloading character is a remote actor with a full third-person body, not a first-person body view.

## Predicted conflict with an existing browser assertion (not run; for the orchestrator before plan 07-29)

`tests/first-person-rig.spec.js` lines 269 to 270 (test "lit: full-pitch standing/crouched body and V handoff retain one anatomy and gun owner") requires `calf_l`, `calf_r`, `foot_l` and `foot_r` of the body view to project inside the screen at pitch -1.38, standing and crouched. No browser ran in this plan. The same sequence was replayed in Node on the live player (ticks of 0.05 s, crouch entered one tick before its sample, 800 by 600, 75 degrees), projecting the four bones for several offsets. Probe and output: `.planning/research/.cache/07-28-browser-pitch-probe.test.js.txt` and `07-28-browser-pitch-probe.json`. Screen y, where the assertion needs every value between -1 and 1:

| Offset at the pitch bound | Standing: calf l, calf r, foot l, foot r | Crouched sample of the browser test: calf l, calf r, foot l, foot r | Predicted |
|---|---|---|---|
| +0.25 (withdrawn) | 0.259, 0.030, 0.129, -0.199 | 0.388, -0.024, 0.166, -0.456 | passes |
| -0.095 (most forward the plan's 0.10 m limit allows) | -0.126, -0.365, -0.154, -0.513 | -0.297, -0.675, -0.251, -0.959 | passes by 0.04 |
| -0.18 (no pitch term at all) | -0.228, -0.470, -0.228, -0.594 | -0.489, -0.855, -0.361, **-1.094** | fails |
| -0.28 (this plan) | -0.351, -0.597, -0.316, -0.693 | -0.729, **-1.079**, -0.497, **-1.260** | fails |

What this says:

- With the committed offset the crouched sample of that browser test is predicted to fail (right foot and right calf below the screen edge). Standing is predicted to pass.
- Removing the forward term alone (-0.18) is predicted to fail it too. Only an offset of about -0.12 m or more forward at the pitch bound passes it, while the plan's own limit allows at most -0.095 m. The two meet only in a band of about 0.03 m in which the body still moves forward under the camera when looking down, with the eye 0.10 to 0.13 m in front of `spine_03` and 0.00 to 0.03 m in front of the leaned neck base.
- The crouched sample of that test is taken one tick of 0.05 s after the crouch is entered, during the inertia blend: the pelvis has dropped while the legs are still near standing, and the feet are 0.20 m below the root. In the settled composed crouch the right foot is 0.32 m behind the root and no offset tried puts all four bones on screen (withdrawn: left calf at 1.142; -0.095: right foot at -1.219; -0.18: -1.450; -0.28: -1.740).

Plan 07-29 allows an edit of `tests/first-person-rig.spec.js` "only for an assertion that states the old body view offset". Whether this on-screen assertion falls under that, or the offset should be a different one, is a decision for the orchestrator and the owner. Nothing in `tests/` was changed here. The prediction is a Node replay, not a browser result.

## Accomplishments

- The look-down offset no longer pushes the body under the camera; the eye is in front of the chest at every pitch the camera can have, standing and crouched.
- The level view keeps its offset; the source, the camera and the arms view are not moved by the update.
- The guard runs on the live player builder and its own rig and has a control on the withdrawn term.
- H-01 was measured and is recorded open.

## Task Commits

1. **Task 07-28-01 (tracer), RED** - `56c592c` (test)
2. **Task 07-28-01 (tracer), GREEN** - `779ef7f` (feat)

Tracer feedback gate after `779ef7f`: all four verify commands exit 0. The plan has no expansion task.

## Files Created/Modified

- `src/builders/firstPersonRig.js` - body view offset and its comment. SHA-256 `c0db631c…acd1` (before `fa3a2b0c…3e1f`). LF throughout, before and after.
- `src/builders/firstPersonLookDown.test.js` - 45 cases (new, LF). SHA-256 `9bb4e096…4343`.

## Decisions Made

- **Direction and size.** The plan's limits allow any offset between -0.365 and -0.095 m with -0.18 m at a level view. Chosen: back by 0.10 m at the pitch bound, linear in pitch, same clamp at 1.1 rad as before. Reason, from measurement: the torso lean the driver adds for aiming brings the neck base 0.099 m forward at that bound, so a body that stays put ends with the eye over the leaned upper torso; moving it back by the same amount keeps the eye as far in front of the neck base as at a level view (0.19 m standing). The clamp matches the presentation's pitch bound, where the lean stops growing. This is a geometric choice, not a judgment of how the view looks.
- **What the test asserts.** The plan's limits only. The neck figures and the reload figures are recorded without a limit.
- **The actor.** The test uses `buildPlayerMesh` and `playerFirstPersonRig`, the objects live play uses, one at a time.
- **Pitches.** The plan lists 0, -0.4, -0.8, -1.1, -1.3 and the live lower limit. The test adds the camera's true lowest pitch (-1.38 minus the largest head bob, -1.411) and asserts the two distance limits on the whole sweep, upward pitches included. Stricter than the plan; no limit changed.

## Deviations from Plan

None - plan executed as written. One figure of the plan is restated by measurement (where the standing view first fails, see above); no limit was touched.

## Issues Encountered

- A first draft of the test compared rotations with `angleTo`, which returns 3e-8 for equal quaternions; it was replaced by exact equality before the RED commit.
- A temporary probe file was created under `src/builders/` to replay the browser sequence, run once and removed; a copy is in the ignored cache. It was never staged.

## Open items and what is not verified

1. **No browser ran.** How the view looks is not verified: whether torso and legs are framed as the owner expects, near-plane clipping, the capped neck opening, the review panel (crouch camera at 1.25 m there). Owner, plan 07-33.
2. **Predicted failure of `tests/first-person-rig.spec.js:269-270`** in its crouched sample, as tabled above. Not run. Plan 07-29 runs that file.
3. **The guard measures a bone origin**, `spine_03`, not the mesh surface. It excludes the reported defect; it does not show what is on screen.
4. **H-01** is not diagnosed and stays open.
5. **Crouch in first person:** the crouched eye is at 0.85 m while the composed crouch has its head bone at 1.12 m and its chest at 0.87 m (plan 07-27). The eye is level with the chest bone, 0.42 to 0.52 m in front of it. Unchanged by this plan and not judged here.
6. **Timing gates.** A third of the five mutable runtime files changed identity. No timing gate was run or requalified (plans 07-30, 07-31).
7. **`AGENTS.md`** was not edited (plan 07-32).
8. **Line endings of the new test** are LF on disk and in the repository; `.gitattributes` does not pin it.

## Self-Check: PASSED

- `src/builders/firstPersonLookDown.test.js`, `src/builders/firstPersonRig.js`: found.
- Commits `56c592c`, `779ef7f`: ancestors of HEAD; `git rev-list --count 965bb9d..HEAD` is 2; `check evaluation-scope --plan 07-28` resolves both.
- Acceptance criteria re-run at `779ef7f`: the new test was committed failing first and passes now; `firstPersonRig.test.js` passes with no byte changed; the diff of `firstPersonRig.js` holds the body view offset and its comment only; this summary holds the before and after distances and the H-01 finding.
- No stub, no skipped test, no verify command left unrun.

## Next Phase Readiness

Plan 07-29 can run, with one known risk: the crouched down-view assertion of `tests/first-person-rig.spec.js` is predicted to fail on this offset, and plan 07-29's allowed edit of that file may not cover it. Decide that before dispatch.

---
*Phase: 07-movement-matched-and-action-safe-animation*
*Completed: 2026-10-11*
