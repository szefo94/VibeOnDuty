---
verdict: changes-required
reviewer_model: opus
reviewer_effort: high
scope: delta-since-2f69dfe
reviewed_commit: f464b11c5a888a696ef0b9c835d4d247d83b31cc
enemy_gltf_sha256: 802b741465d7826b0bb656eb79a4dd46c8e50708bab870f5ee64f0c417d11781
enemy_animations_sha256: f150cb50bca967ef88b44817b746cace2787085c4fbb38e6d9cd277453992885
first_person_rig_sha256: c0db631c27b5e9da9ecc12905bb4ac46311c91675d3c7fa11200afcdf464acd1
weapon_handling_sha256: 6bcd00e7b0cc1adb0fa66becd165bcf1e91a8424361285a916ae94dd4d593aa3
reviewed: 2026-10-11T15:20:00Z
depth: deep
blockers: 2
warnings: 6
notes: 8
---

# Plan 07-37 task 1: delta review of the crouch lean (2f69dfe to f464b11)

Reviewer: independent, wrote none of the change. Node and Vitest only; no browser was run. Browser
pictures named below are files that earlier runs left on disk.

## Verdict

**changes-required.** Two blockers, both about first person while crouched.

- **B-01.** The lean reaches the first-person body view and uses up all the room between the eye and
  the chest. Without the lean the crouched eye is 42 to 114 mm from the nearest surface of the body view
  and never inside it. With the lean it is inside the chest plate or the torso at every aim between
  -0.15 and +0.3 rad, in every crouched state I drove. While the player turns, ink then appears on
  screen at aims from +0.2 to +0.45 rad; with the handler of `2f69dfe` in the same run there is none.
- **B-02.** No test measures this. The guard of Amendment 1 and the look-down guard both pass while the
  eye is inside the torso.

Separately, and not caused by the lean: the frame `crouch-1.38.png` that the coordinator asked about is
drawn from bones that are identical with and without the lean. Whatever it shows is a property of the
repair I approved at `2f69dfe`. I did not find it then (W-07, W-08).

The lean itself, in third person and on other characters, is built as the plan says. Nothing in
questions 1, 3, 4, 5, 8 and 9 needs a change.

## Identity

- `reviewed_commit` is HEAD as read. `git status --short -- src tests public server tools index.html
  style.css` is empty.
- `git diff --numstat 2f69dfe..HEAD -- src tests`: `src/builders/crouchTorsoLean.test.js` 1055/0,
  `src/builders/weaponHandling.js` 53/0, `tests/animation-live-route.spec.js` 19/0. Nothing else under
  `src`, `tests`, `public`, `server`, `tools`, `index.html` or `style.css` differs.
- The hashes of `enemyGLTF.js`, `enemyAnimations.js` and `firstPersonRig.js` equal those in
  `07-33-REPAIR-REVIEW.md`. Only `weaponHandling.js` is new.

## What I ran

All under the scratch directory `repair-review`; no repository file was written.

- `npx vitest run`: 545 tests in 36 files pass. `crouchTorsoLean.test.js` alone: 80 of 80.
- The same test file against earlier handlers and against in-memory mutants (a load hook serves the
  changed text; the file on disk is untouched).
- Probes with the real GLB, the real driver, the real handlers and the real first-person rig, driven in
  the two phases of `src/loop.js` (`tickPresentation(..., false)`, `finishPresentation`,
  `updatePlayerWeaponHandling`, `updateFirstPersonRig`). Each was run on HEAD and again with
  `weaponHandling.js` of `2f69dfe`; some with the four builders of `e09bf9b`.
  - Distance from the eye to the nearest triangle of every visible body-view mesh.
  - Ray parity: whether the eye is inside a closed mesh.
  - A software rasteriser with the game's rules: front faces painted with a depth buffer, then the ink
    pass of `src/comicOutline.js` (back faces of eligible materials, tested against the paint). Camera
    75 degrees, near plane 0.05 m, 4:3. The 2 pixel widening of the ink is not modelled.
- Check of the rasteriser: in the two standing look-down frames of the browser run, 96 to 100 percent of
  the pixels each mesh covers in Node are painted in the browser frame (meshes above 0.1 percent of the
  screen). It does **not** reproduce the
  browser's crouched frames (see "The browser frames").

## The crouched first-person view

### What the lean does (established in Node)

Nearest surface of the body view to the eye, settled crouch, metres. Standing is 0.22 to 0.31 at every
aim on both sources.

| Aim (rad) | `2f69dfe` handler | HEAD | Lean applied |
|---|---|---|---|
| +0.9 to +1.38 | 0.043 to 0.046 | 0.043 to 0.046 | 0 |
| +0.6 to +0.7 | 0.043 to 0.045 | 0.025 to 0.041 | 1.2 to 4.2 degrees |
| +0.45 to +0.5 | 0.043 to 0.046 | 0.005 to 0.012 | 7.8 to 9.4 |
| +0.3 | 0.042 to 0.044 | 0.000 to 0.002 | 12 |
| +0.15 | 0.043 to 0.046 | 0.000 to 0.001 | 12 |
| 0 | 0.042 to 0.046 | 0.000 to 0.005 | 12 |
| -0.15 | 0.056 to 0.060 | 0.001 to 0.004 | 12 |
| -0.3 | 0.070 to 0.074 | 0.005 to 0.011 | 12 |
| -0.6 | 0.077 to 0.081 | 0.023 to 0.029 | 12 |
| -0.9 | 0.094 to 0.098 | 0.034 to 0.044 | 12 |
| -1.38 | 0.110 to 0.114 | 0.044 to 0.050 | 12 |

Share of sampled frames with the eye inside a closed body-view mesh (fabric torso, `ChestPlate` or
`LowerChestPlate`), HEAD. With the `2f69dfe` handler it is 0 in every state at every aim.

| State | +0.3 | +0.15 | 0 | -0.15 |
|---|---|---|---|---|
| crouch idle | 0.33 | 1.00 | 0.92 | 0.67 |
| crouch walk forward | 0.58 | 0.25 | 0.50 | 0.33 |
| crouch strafe left / right | 0.58 / 0.50 | 0.25 / 0.42 | 0.58 / 0.50 | 0.33 / 0.17 |
| crouched, firing | 0 | 1.00 | 1.00 | 0.58 |
| crouched, reloading | 0.42 | 1.00 | 0.92 | 0.58 |
| crouched, aiming down sights | 0.75 | 0.25 | 1.00 | 1.00 |

Why: the chest's front surface is about 0.13 m in front of the bone `spine_03`. The lean moves the
chest 0.055 m toward the eye (`07-35-SUMMARY.md`, and the planning table of `07-36-PLAN.md` line 59 says
so itself). The room that was there was 0.042 m.

What that puts on screen, by the rasteriser:

- Still, walking, strafing, firing, reloading, aiming: nothing changes. Ink is 0 on both sources at
  every aim, and the painted share is the same to three decimals. The wall in front of the eye is nearer
  than the near plane, so it is clipped.
- Turning at a constant rate (1, 2, 3, 5 and -3 rad/s), aims +0.2 to +0.45: with the lean, ink in 1 to 7
  percent of frames, largest 0.6 to 9.7 percent of the screen, in 25 of the 30 cells. With the `2f69dfe`
  handler: none in any of the 30.
- Swinging the view left and right (4 rad/s, reversing every 0.5 s): ink on both sources, see W-07. With
  the lean it is in 13 percent of frames at +0.3 and +0.35, against 7 percent.

So the lean causes the eye to enter the body view and makes the turning case worse. By the
coordinator's rule that is a blocker.

### The coordinator's questions

**(a) Crouched and looking up: what is in the frustum, how near, why.**

- Settled crouch, +0.9 to +1.38: nothing of the body view, on either source. The lean is 0 there (the
  fade). The nearest surface, `LowerChestPlate`, is 0.043 to 0.046 m away, below and behind the frustum.
- Crouch walk, +1.38: `ChestPlate` (weighted to `spine_03`) is in view in 60 percent of frames, up to
  3.8 percent of the screen, 0.10 to 0.14 m from the eye. The same share on both sources. This is the
  older property that Amendment 1 names (W-09).
- The browser frame shows far more than either. See "The browser frames".

**(b) Does it exist at `2f69dfe`, at `e09bf9b`, at HEAD.**

| Source | Node, crouched | Browser frames on disk |
|---|---|---|
| `e09bf9b` (before the repair) | +0.6 to 0: nothing in view, eye 0.027 to 0.060 m clear. At -0.3: ink in 17 to 100 percent of frames, 69 to 98 percent of the screen. At -0.6: the whole screen, every frame. That is the old offset that moved the body under the camera. | Five runs of 6, 7 and 10 October, frames at -1.38, -0.9, 0, +1.38: 0.1 to 0.3 percent ink. The body is painted and visible. |
| `2f69dfe` (repair, no lean) | Eye never inside. Clean when still or turning one way. Ink and paint when the view swings (W-07). | None exists. |
| HEAD | As `2f69dfe`, plus B-01. | One run: 48.3, 19.6, 0.2, 20.1 percent ink at -1.38, -0.9, 0, +1.38. |

**(c) Does the lean add to it between level and +0.8 once all meshes are counted.** Yes: the two tables
above. Amendment 1's guard is blind to it. It counts vertices weighted to spine, clavicle or pelvis
that lie inside the frustum between 0.05 and 0.6 m. An eye that is inside the torso has the wall in
front of it nearer than 0.05 m, so the count is 0 and the guard passes.

**(d) Would the owner see it in live play.** `src/loop.js:133` passes `pitch: player.pitch`, clamped to
plus or minus 1.38 at `src/main.js:267` and `src/loop.js:90`; the presentation clamps it to 1.1.

- From the lean: by Node, short black flashes at the edge of the view when crouched, looking 11 to 26
  degrees up and turning. Nothing when still.
- From the repair, with or without the lean: larger flashes when the view swings left and right while
  crouched (W-07).
- The owner's preview at `eb43041` asked for first person crouched "level, up and down" and the owner
  named no issue. That does not tell me whether the owner turned while crouched.

**The pinkish patch in `crouch-0.png`.** One flat colour, 171/145/134. It is also in the frames of
6, 7 and 10 October, in crouched level and up frames only, with a size that changes from run to run
(0 to 20588 pixels). It predates the lean and the repair and no first-person mesh draws it. I did not
establish what it is; a translucent scene effect over sky fits the colour.

### The browser frames (not explained)

Files: `test-results/first-person-rig-lit-full--d7e80-n-one-anatomy-and-gun-owner/`, written
2026-10-11 13:26 UTC. Ink is counted as pixels of exactly 8/9/11.

- `crouch--1.38.png` 48.3 percent, `crouch--0.9.png` 19.6, `crouch-0.png` 0.2, `crouch-1.38.png` 20.1.
  The four standing frames: 0.2 to 0.3.
- The pictures read as the eye being inside the torso: black below a line when looking down, clean when
  level, the neck opening and cap triangles overhead when looking up. At -0.9 the black covers 62
  percent of the first-person gun's pixels, so the black surface is nearer than the gun.
- My replay of the spec's own sequence in Node gives the same bone positions as the browser recorded
  (`pitch.json`: four leg points in all eight samples equal to three decimals; 18 settling ticks in
  both). From those bones Node draws no ink in any crouched frame, and the eye is inside a mesh only in
  the level sample.
- **`crouch-1.38.png` does not depend on the lean.** In that sample the handler applies no rotation
  (pose pitch 1.1, fade 0, `weaponHandling.js:167-169`, `:271`). I compared every bone matrix of the body view
  and of the arms view between HEAD and the `2f69dfe` handler for the spec's eight samples: the
  difference is exactly 0 for all four standing samples and for crouch +1.38. The same spec run at
  `2f69dfe` draws the same bones.
- For `crouch--1.38.png` and `crouch--0.9.png` the lean is partly on in the spec's sequence (4.72 and
  7.59 degrees; the spec repeats one sample time while settling). 53 body-view bones differ. I cannot
  say what share of those two pictures the lean accounts for.
- I tested and rejected: the source character drawn; a body view one sample late; a stale skin palette
  (three.js updates it on every render, `WebGLObjects.js` lines 44 to 56); stretched cap triangles; a second
  handler on the player; the old offset. I did not find the cause. Either the browser has state my
  replay lacks, or the renderer draws something the bones do not explain.

## Blockers and the fixes wanted

**B-01. Keep the lean out of the first-person body view.**

- Where: `src/builders/firstPersonRig.js:249` copies the leaned source pose to the body view. Lines
  253 to 254 put the saved rotations back on the arms view only.
- Wanted: after `copyPose(rig.bodyPairs)`, put the saved rotations of the four lean bones (`spine_01`,
  `clavicle_l`, `clavicle_r`, `neck_01`) back on the body view from `rawCorrections`, as the arms view
  gets them. It needs a name lookup for the body view like `rig.armBones`. Only those four: the body
  view had the solved arm bones at `2f69dfe` and should keep them.
- Result to show: the body view's bone matrices in every crouched state are equal to those with the
  handler of `2f69dfe`. First person is then the picture of `2f69dfe` exactly; the lean stays in third
  person, on bots and on other players.
- Consequence: the fade with upward aim then protects nothing in first person. Whether it stays is the
  owner's call on the third-person look.
- This edits one of the paired gate's owner files; requalification is due anyway (question 9).

**B-02. A test that measures what B-01 protects.**

- Wanted, with the real meshes: (1) the body view's bone matrices with the lean equal those with the
  lean undone, crouch idle, crouch walk, fire, reload and aim, over the pitch sweep (the arms view
  already has this at `LIMIT.viewArm`); (2) the eye is inside no closed body-view mesh in those states.
- Keep Amendment 1's count if wanted, but name it for what it is: a count of torso vertices in view.
- Then one browser run of `tests/first-person-rig.spec.js`, recording the ink share of all eight
  frames. After B-01 the body view is that of `2f69dfe`, so that run also answers what the repair alone
  draws (W-08).

## The three orchestrator decisions

**(i) Amendment 1: not accepted as sufficient.** The reason for rewording holds: the absolute wording
fails with no lean at all, so it could not judge a lean. The reworded guard isolates the lean, but only
for one quantity, and that quantity is 0 exactly when the defect is present (answer (c)). The property
it was written to protect, "the lean does nothing to the first-person body view", is false at HEAD.
Also: the rewording was decided after a failing run, and the older fault it stepped around was not put
on the owner's list (W-09).

**(ii) Release tolerance 0.5 to 2 degrees: accepted, with one remark.** Over the four recorded runs the
standing mean moves between -2.056 and -1.881 and the released chest differs from it by +0.080, -0.513,
+0.310 and +0.023. A bound of 0.5 was inside the run-to-run spread; the failure by 0.013 was noise. Two
degrees still catches a lean that stays on (12 degrees). It does not catch one that stays at 2 degrees
or less; the unit case does (`LIMIT.released` 0.05, `crouchTorsoLean.test.js:37-56`). Remark: a bound
changed after a failing run on the same data is only acceptable because the exact property is held
elsewhere. The summary says this plainly.

**(iii) Preview before the browser set, `shown_commit` eb43041: accepted as a preview, nothing more.**
`git diff --stat eb43041..HEAD -- src tests public server index.html style.css tools` is one file,
`tests/animation-live-route.spec.js`, 19 added lines, none removed. The owner saw the `src/` that is at
HEAD. The plan's precondition (`07-36-PLAN.md` line 163) was not met and the task's verify command
exits 1; the record says so. What the preview is worth is limited by B-01: the owner was shown a build
in which the eye is inside the chest when crouched and level, and was not asked about that.

## The eleven questions

**1. Does the lean write anything but saved-and-restored bone rotations.** No.

- Every write goes through `worldRotate` (`weaponHandling.js:136-141`): `save` first (`:137`,
  `:133-135`), then the quaternion (`:139`), then derived world matrices (`:140`).
- `leanTorso` (`:172-180`) turns `spine_01` (`:177`) and the three counter bones (`:179`); all four or
  none (`:175`).
- It is called at `:270-271`, before and outside the arm-solve condition (`:272-273`), so the four bones
  are saved also during throw, melee, dance and roll.
- Restore: top of every update (`:244`), the loop (`loop.js:83`, `weapon.js:168-170`), the driver for mounted actors
  (`enemyAnimations.js:472`), dispose (`:319`).
- Other state: three fields on the owner (`:117`, written at `:154`, `:164-165`).
- Path without a lean: `:262` returns before `:270` when the weapon has no definition. Bones were
  already restored at `:244`.

**2. Is the first-person view really unchanged.** The arms and the gun: yes. The body view: no.

- Arms: `firstPersonRig.js:253-254` restores every saved bone, the four included. Measured: arms-view
  bone matrices equal with and without the lean in all eight spec samples, difference exactly 0.
- Per weapon: the loop passes the corrections of `3p:${player.weapon}` (`loop.js:246`); the lean
  belongs to the owner of `pose.weapon` (`weapon.js:173`). Offline these are one key. After a switch
  the new owner takes the target at once (`:161`) and is the one passed.
- Review panel: restore at `animationReview.js:131`, update at `:153`, its corrections passed at `:162`.
- Body view: `copyPose(rig.bodyPairs)` at `:249`, no restore. It shows the lean: B-01.

**3. More than one owner on a skeleton, or an owner of a weapon not in hand.** Not in the paths I read.

- Player: only the `3p` owner of the pose's weapon gets the skeleton (`weapon.js:171-176`). An owner
  without a skeleton, a view owner or an owner of another weapon returns 0 and is cleared
  (`weaponHandling.js:153-156`).
- View owners: `fixedAnchor` set at `firstPersonRig.js:223-224`.
- Bots, friendly bots, remote players: one handler per mount (`enemyWeapon.js:160`), resolved on each
  call (`enemyAnimations.js:578-586`). The panel has its own (`animationReview.js:120`).
- Not tested: see W-10.

**4. Easing.** Correct as built.

- Stepped by the pose's sample time with `exp(-step / 0.1)` (`:158-165`): independent of frame rate. A
  mutant with a fixed share per update fails three cases.
- Reset: target at once (`:161`); a mutant that ignores it fails one case.
- Repeated time: holds (`:163` is skipped). Backward, longer than 0.1 s, or missing: target (`:162`).
- Respawn and character replacement: the skeleton comparison at `:161`; a retired skeleton is dropped at
  `:46`. State is per owner object, so nothing leaks between actors.
- Not eased, by this rule: the local player below 10 frames per second, a remote player across a gap
  over 0.1 s, and pause.

**5. Weapon orientation, bolt hand, carry fit.** Holds.

- The right clavicle is turned back, so the arm chain and the gun keep their world orientation; they
  move with the chest (0.055 m forward, about 0.01 m down). The test bound is 0.2 degrees per weapon.
- Carry fit (`:277-284`) reads world positions after the lean (`:274`); wrist and other shoulder move
  together. Bolt hand (`:294-305`) anchors the mount in world space after the lean; the mount is reset
  at `:252-255`.
- Crouched fire, reload and aim keep `hand_r` and both views on the weapon (bound 0.005 m).

**6. Earlier answers the diff touches.**

| Earlier answer | Still holds |
|---|---|
| 1, no gameplay, network or authority writes | Yes. New reads are fields of the frozen pose: `crouching`, `alive`, `sampleTimeSeconds`, `reset`, `pitch`, `weapon`. |
| 5, driver and inertia restore | Yes; the driver's bytes are unchanged. The handler saves after the inertia blend and restores before the driver's own restore (`loop.js:83`, `enemyAnimations.js:472`). |
| 6, look-down change confined to the body view | The file is unchanged. But the body view now also takes the lean. |
| 9, summaries plain | See question 11. |
| 10, tracks, cost, paired gate | Tracks unchanged (`enemyGLTF.js` identical). Cost and gate: question 9. |
| 11, look-down body view | **Incomplete, mine.** "No torso in view at any pitch, crouched" was a vertex projection of a still pose looking down. It did not look up, did not turn, and I did not look at a browser frame. W-07, W-08, W-09. |
| 12, crouch transient | Unchanged; the lean eases over it. |
| 13 | Not touched. |

W-01, W-04 and W-05 are untouched (driver and clips identical). W-02 stands: looking down, the painted
share is the same with and without the lean. W-03 stands. W-06 stands and grows (question 9).

**7. Do the new tests fail without the change.** Yes, with gaps.

- Handler of `2f69dfe`: 40 of 80 fail. Handler of `2b83215` (lean, no fade): 9 fail, the body-view and
  fade cases.
- Mutants that fail as they should: no counter-rotation (17), no easing (11), fixed share per update
  (3), reset ignored (1), fade ignoring pitch (8).
- The amount comes from the one constant: the case at `crouchTorsoLean.test.js:430-446` reads the line
  by pattern and compares it with the export.
- No existing test or limit was edited: every changed file has 0 removed lines.
- Mutants that survive, 80 of 80 passing: W-10.

**8. Only additions to `tests/animation-live-route.spec.js`.** Yes: 19 added, 0 removed (`:65-66`,
`:124-131`, `:217-226`).

**9. Cost.** One handler pass for the player, restore and update of its eight owners, Node on this host,
median of nine rounds of 4000, two runs each:

| | `2f69dfe` | HEAD |
|---|---|---|
| standing | 150 to 151 microseconds | 151 to 156 |
| crouched | 150 | 168 to 170 |

- Standing: a few scalar operations and one `exp`; no measurable change.
- Crouched: four `worldRotate` calls, each walking the ancestors and then the subtree below the bone (97
  nodes under `spine_01`, 68 under `clavicle_r`, 24 under `clavicle_l`). About 18 microseconds per
  crouched actor per frame, 12 percent of that pass.
- Paired gate: `weaponHandling.js` is one of its owner files (`07-09-PAIRED-AMENDMENT-V2.md:83`), so
  the qualified identity no longer matches and the gate must be run again. B-01 will also change
  `firstPersonRig.js`. W-06 stands: the gate still does not compare like with like on frame time.

**10. The first-person body view.**

- Coverage: 57 pitches, standing, crouched and crouch walk, three aspect ratios, real meshes
  (`crouchTorsoLean.test.js:801-981`). But only vertices weighted to spine, clavicle or pelvis
  (`:89`, `:194-218`), only inside the frustum between 0.05 and 0.6 m (`:242-255`), and only against the
  lean undone. It does not see distance to the surface, the eye inside a mesh, triangles without a
  vertex in view, back faces, or turning.
- Is 13 the largest value that passes: yes for the guard. At 14 it fails ("crouch walk sweep 0.33, 4:3:
  11 torso vertices"). The range 6 to 13 is enforced only by the pattern case that reads the source
  line.
- Fade on the same frame, right sign: yes for the offline local player (`:167`, pose pitch positive
  up). Bots pass `pitch: 0` (`enemyAnimations.js:693`) and never fade. Online: W-11.
- Frames: figures above. `crouch-0.png` is clean because the wall in front of the eye is nearer than
  the near plane, not because the eye is clear of the chest.
- Easing rule: missing time, target at once; repeated, hold; backward, target. Paused loop: no crouch
  and no time (`loop.js:159-160`), so upright at once and back at once on resume. Remote: hold between
  snapshots, ease across 1/30 s (`remoteActors.js:125`). Panel: `phase * duration`
  (`animationReview.js:134`), holds when paused, takes the target on wrap, which is the same value.

**11. Do the summaries say plainly what the lean is and is not.**

- Is: yes. `07-35-SUMMARY.md` gives 12.00 degrees of chest lean in crouch only, four rotations, head
  0.091 m further forward and 0.011 m lower, chest 0.055 m forward (`:149`).
- Is not: it says the entry and exit transients of W-03 are unchanged (`:119`) and the jump chain is not
  leaned (`:120`). It does not say that this is not the crouch pose from before Phase 7.
- Missing: nothing says the chest moves 0.055 m toward a crouched eye that had 0.042 m of room.
- `07-36-SUMMARY.md` describes `crouch-1.38.png` honestly and declines to attribute it. It does not
  mention `crouch--1.38.png` and `crouch--0.9.png`, the two worst frames.

## New warnings

**W-07. At `2f69dfe` already: swinging the view while crouched puts the body in front of the eye.**
Crouched, yaw 4 rad/s reversing every 0.5 s, both sources: ink in 5 to 9 percent of frames, largest 7
to 34 percent of the screen; paint in 5 to 22 percent of frames, largest 6 to 24 percent; at every aim
from -0.6 to +0.45. Turning one way at 1 rad/s and +0.6: ink 7.8 percent, paint 10.8, 3 percent of
frames, both sources. Standing: none, the eye is 0.22 m clear. Turning one way without the lean leaves
0.007 to 0.031 m at aims from 0 to +0.45. This is the repair's, not the lean's, and my first review missed it. Rasteriser
figures; not seen in a browser.

**W-08. The crouched browser frames at HEAD show the inside of the body and nobody has explained
them.** Section "The browser frames". The spec asserts nothing about them, so it passes.

**W-09. Crouch-walking and looking straight up shows the chest plate.** 60 percent of frames, up to 3.8
percent of the screen, both sources. Named in Amendment 1, not on the owner's list.

**W-10. Three conditions of the lean are untested.** Each mutant leaves 80 of 80 passing: dropping
`owner.fixedAnchor` from `weaponHandling.js:153` (a view handler would lean the arms view); dropping the
weapon comparison from `:153`; dropping `pose.alive !== false` from `:157`.

**W-11. Online, the fade trails the camera.** The local online pose comes from the snapshot
(`onlineSession.js:515-519`) and overrides `pitch` (`loop.js:138` after `:133`), while the camera turns
at once (`main.js:267-268`). A crouched player who looks up quickly keeps the lean for a round trip. The
plan's own control case says an unfaded 12 degrees puts the torso into view at +0.9. Read from source,
not run. B-01 removes it for first person.

**W-12. The sentence planned for the owner is not true as written.** `07-37-PLAN.md:127`: "so that in
first person the chest never comes in front of the view". See B-01, W-07, W-09.

## Notes

- **N-12.** The lean applies to offline bots and friendly bots when they crouch
  (`enemyAnimations.js:694`).
- **N-13.** The local player below 10 frames per second and a remote player across a gap over 0.1 s
  take the lean at once. `07-35-SUMMARY.md` item 7 says the second.
- **N-14.** Pause: the third-person torso stands upright at once and leans again on resume. Stated in
  the summary and in the plan's list for the owner.
- **N-15.** `loop.js:246` picks the corrections by `player.weapon`; the online pose's weapon is always
  `m4` (`remoteActors.js:129`). If a player can be online holding another weapon, the view arms get no
  restore. Older than the lean for the arm solves; I did not check whether online forces the M4.
- **N-16.** The review panel puts the crouched eye at 1.25 m (`animationReview.js:158`); the live
  crouched eye is 0.85 m. Older than the delta; the panel's first-person crouch is not the game's.
- **N-17.** A dead, crouching actor eases out of the lean over about 0.3 s while the death clip plays.
- **N-18.** The in-memory mutants at 5, 13 and 14 degrees each fail the pattern case, because file and
  module then disagree. That is my method, not the test.
- **N-19.** `e09bf9b` drew a full black screen when crouched and looking 17 to 34 degrees down (answer
  (b)). The repair removed that. It was not in any browser frame because the spec samples -0.9 and
  -1.38 only.

## What the owner should be told at the binding check

From this review:

1. The lean is 12 degrees of chest pitch in crouch only; arms, gun and head keep their direction; the
   head is about 0.09 m further forward. It is not the crouch pose from before Phase 7 and not a fix of
   the crouch entry step (W-03).
2. First person, crouched: after B-01 the body under the camera is as it was before the lean. Before
   B-01 the eye is inside the chest when level.
3. First person, crouched, swinging the view: the body can flash in front of the view. Older than the
   lean (W-07). Show the frames of W-08 with it.
4. Crouch-walking and looking straight up shows the chest plate (W-09).
5. A crouched character that aims upward straightens; bots never do.
6. Pause straightens the crouched torso at once.
7. Online, look-up while crouched: the straightening trails by the connection delay (W-11).

Still standing from `07-33-REPAIR-REVIEW.md`: W-01 (diagonal feet under the floor), W-02 (little torso
when looking down), W-03 (crouch step of 0.37 m), W-04 (hip step on melee and throw), W-05 (foot
sliding), W-06 (paired gate comparability, and it must be run again).

## What I could not verify

- Anything in a browser. No frame exists for `2f69dfe`.
- Why the browser's crouched frames differ from what the same bones give in Node.
- Whether the flashes of B-01 and W-07 look in a real renderer as the rasteriser draws them. It has no
  2 pixel ink widening and was run at 160 by 120.
- What the pinkish patch is.
- Online behaviour (W-11, N-15): read from source only.
- The crouch entry and exit frames in first person with the lean easing in.
- How the motion looks. That is the owner's.
