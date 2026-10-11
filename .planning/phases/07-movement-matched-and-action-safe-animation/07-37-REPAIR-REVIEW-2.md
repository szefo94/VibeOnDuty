---
verdict: approved
reviewer_model: opus
reviewer_effort: high
scope: delta-since-f464b11
reviewed_commit: f4748da4b9ffc28dda34e937eec5a90c0c3b9c62
enemy_gltf_sha256: 802b741465d7826b0bb656eb79a4dd46c8e50708bab870f5ee64f0c417d11781
enemy_animations_sha256: ca5eed86b57e1b20710391e4f2dd8b1134a348d26fe13af59509fd9f67105cd2
first_person_rig_sha256: d99d55713abdb8b577d2e776ce5843eb41a553ab80a611eb9a2a7f1fc6e982eb
weapon_handling_sha256: 6bcd00e7b0cc1adb0fa66becd165bcf1e91a8424361285a916ae94dd4d593aa3
reviewed: 2026-10-11T18:15:00Z
depth: deep
blockers: 0
warnings: 5
notes: 7
---

# Plan 07-37 task 1: second delta review (f464b11 to f4748da, plan 07-38)

Reviewer: independent, wrote none of the change. Node and Vitest only; no browser was run. The frames
named below are files that plan 07-38 left on disk; I opened them.

## Verdict

**approved.** No finding of this review has to change source, tests or the pinned baseline before the
owner's binding check.

- B-01 and B-02 of the first delta review are met.
- In every state plan 07-38 lists, and in every state I probed for the first review, the eye is now
  inside no drawn mesh and at least 0.18 m clear. Ink is 0 in my rasteriser and at most 0.28 percent in
  the browser frames.
- I found no regression in the standing view, the standing foot turn, the arms view when still, or the
  lean.

Two things the owner must be told, both older than this plan and neither fixed by it:

- **W-13.** A jump on the spot with crouch held, with the view turning, still puts the hips through the
  eye: black over 12 to 80 percent of the screen for about a quarter of a second. Plan 07-38 calls W-07
  resolved; that is true on the ground and not in the air. This is the item I would fix first.
- **W-14.** While the view turns fast, the support arm of the first-person arms view swings across to
  the right of the gun. It is in the plan's own final frames and nobody remarked on it.

## Identity

- `reviewed_commit` is HEAD as read. `git status --short -- src tests public server tools index.html
  style.css` is empty.
- `git diff --numstat f464b11..HEAD`: `firstPersonRig.js` 51/6, `enemyAnimations.js` 2/2,
  `crouchTorsoLean.test.js` 110/1, `firstPersonBodyView.test.js` 583/0, `crouchFootTurn.test.js` 155/0,
  `tests/first-person-own-body.spec.js` 366/0, `tests/fixtures/enemyAnimations.uncached.js` 2/2,
  `tests/animation-resources.spec.js` 1/1. Nothing else under the product paths.
- `enemyGLTF.js` and `weaponHandling.js` have the hashes of the first delta review. The driver and the
  rig are new.

## What I ran

- `npx vitest run`: 635 tests in 38 files pass. `npm run lint`: clean.
- The new and edited unit tests against earlier bytes and against in-memory mutants (a load hook; no
  repository file changed).
- My probes of the first review again on the final source, and new ones, each also with the rig and
  driver of `f464b11`: the nine crouched states at twelve aims; seven turning runs; stance changes and
  the clips that play standing legs at crouch height; the cut geometry and its cap; the arms view while
  turning; rig cost. Real GLB, driver, handlers and rig, driven in the two phases of `src/loop.js`.
- My own count of ink and own-body pixels over the 92 final frames.

## B-01 and B-02, re-checked

**B-01: done as asked.**

- `firstPersonRig.js:290` puts back `spine_01`, `clavicle_l`, `clavicle_r` and `neck_01` on the body
  view from `rawCorrections`, through `rig.bodyBones` (`:205-206`), cleared at `:367`. Only those four
  (`leanName`, `:10`).
- Body-view bone matrices against a handler that never leans, in the spec's eight samples: exactly 0
  standing and at +1.38. In the three crouched samples with a lean, 46 arm-chain bones differ by at most
  0.00018 per element: the arms were solved on the leaned chest. They are not drawn in the body view.
- The repository test measures against "the lean undone" and reads exactly 0.

**B-02: done.** `firstPersonBodyView.test.js` asserts bone equality, eye inside no closed mesh, and
0.10 m clearance. It can fail:

| Mutant of `firstPersonRig.js` | Result |
|---|---|
| no four-bone restore | 8 cases fail |
| margin -9 (torso always drawn) | 25 fail |
| margin 9 (torso never drawn) | 14 fail |
| margin 0.25 or 0.06 | 1 fails (the room case) |
| torso meshes keep their layer | 24 fail |
| no geometry swap | 24 fail |
| every saved bone restored, not four | **all 147 pass** (N-20) |
| the alternate never disposed | **all 147 pass** (N-20) |

**My figures on the final source** (first review's probes; `f464b11` in brackets):

- Nine crouched states, twelve aims: eye inside a mesh in 0 frames (17 to 100 percent of frames at
  level aims); nearest drawn surface 0.198 to 0.292 m (0.000 to 0.050).
- Turning one way at 1, 2, 3, 5 and -3 rad/s, walking and turning, swinging: ink 0 in every cell
  (up to 34 percent); nearest 0.180 to 0.274 m.
- Crouch pressed, crouch released, run then stop and crouch on one frame: inside 0, ink 0, nearest
  0.22 m or more. The draw rule switches once per press or release and not otherwise.

## What the frames show

I opened the final frames and recounted them. My counts equal the summary's to the second decimal.

| Frame (stage `final`) | Statistic | What I see | Agree |
|---|---|---|---|
| `B-crouch-0-swing_4_rad_s-most-ink.png` | ink 0.23 % | The range, targets, forearm and gun. No black shape. | yes |
| `head/B-crouch-0-swing_4_rad_s-most-ink.png` | ink 38.8 % | The left 40 percent of the screen is one black shape. | yes |
| `B-crouch--1.38-swing_4_rad_s-most-body.png` | own body 20.8 % | Thigh, knee guard and shin at the left, forearms, gun. No torso. | yes |
| `B-crouch--0.9-turn_1_rad_s-most-body.png` | own body 9.3 % | Thigh and knee at the lower left. | yes |
| `B-crouch-0-still.png`, `B-crouch-0-turn_3_rad_s-last.png` | own body 0 % | The range, forearm, gun. | yes, but see W-14 |
| `B-crouch--1.38-still.png` | 19.2 %, 3 joints | Thigh, knee guard, shin, forearms, gun. | yes |
| `B-crouch-1.38-walk_forward-last.png` | own body 0 % | Ceiling, forearm, gun. No chest. | yes |
| `B-stand--1.38-still.png` | own body 5.4 %, 4 joints | Chest identifier strip, forearm, gun, dark shapes at the bottom edge. | yes |
| `existing-pitch-view/stand--1.38.png` (daylight) | ink 0.22 % | The same view in light: identifier strip, chest edge at the bottom. | yes |
| `existing-pitch-view/crouch--1.38.png` | ink 0.22 % | Thigh, knee guard, shin, forearm, gun. No torso, no black. | yes |
| `existing-pitch-view/crouch-0.png`, `crouch-1.38.png` | ink 0.21, 0.22 % | Clean. Looking up: sky and an orange tracer with a pale trail. | yes |

- The Training Range is a dark hall. A person cannot judge "no dark shape" there by eye alone; the
  `head` frame shows that the black ink does stand out against it, and the exact-colour count does not
  miss fogged ink (colours within 3 of the ink colour are 0.11 percent at most).
- The pinkish patch of the first review is the trail of a tracer. It is a scene effect.
- **Not in the statistics:** in `B-crouch-0-turn_3_rad_s-last.png` the support forearm is bunched under
  the gun, and in `B-crouch-0-swing_4_rad_s-last.png` it points to the right of the gun (W-14).
- The two third-person frames show only the ceiling, as the summary says.

## W-08: the explanation judged

Another character on the player's cell in Incursion. I judge it **most likely right**, and it resolves
three things I could not explain in the first review:

- The bones of the +1.38 sample were identical with and without the lean, yet the picture differed.
- The leg bones in the browser matched Node to three decimals while the picture did not.
- In the standing look-down frame of that run about 7 percent of the screen was painted where Node
  drew nothing.

The control frames (`w08-control`, `w08-sweep`) show the same kind of picture with an enemy 0.2 m away,
and in the recorded frame the player's own thigh and knee guard sit where the clean frames have them,
with black around. It stays constructed, not observed. The pitch-view case of
`tests/first-person-rig.spec.js` still starts Incursion and asserts nothing about pixels, so its frames
can mislead again (deferred item, open).

## The amendment decisions

**A, one lean case compares with the leaned source bones: accepted.** The old line pinned the defect
B-01 removes. One line changed; tolerance kept. Consequence: nothing in `crouchTorsoLean.test.js`
guards B-01 any more (it passes 83 of 83 with the rig of `f464b11`), and its two Amendment 1 count cases
now compare two equal poses. The new file is the guard.

**B, leg-joint rule at -1.38 only: accepted.** The rule as first written failed on the standing view at
every stage, and no step touches that view. The counts are pinned at the measured 4 and 3. Consequence:
nothing asserts legs at -0.6 and -0.9, where a crouched view shows one joint.

**C, case A in the Training Range: accepted.** See W-08.

**D, feet planted before crouched stills: accepted.** It removes a carry-over from the preceding turn.
Leftover twist is still measured by the turning runs and by the Node cases.

**E, hips and legs only unless the chest is 0.15 m below the eye: accepted, with its limits.**

- Margin: standing states are 0.319 m or more, crouched ones -0.013 m or less; the tests accept a margin
  from about 0.09 to 0.22.
- Switching: once on the frame of a press or a release, also for a crouch pressed in the air and for a
  stop that runs into a crouch. I found no flicker.
- Geometry: one cut mesh (7046 of 8444 triangles plus a cap of 48); it is closed by the test's own rule
  (10641 welded edges, each used twice), so the eye-inside check is not empty for it.
- The waist cap faces up, 0.53 to 0.68 m above the root. Crouched at -0.6, -0.9, -1.2 and -1.38, still,
  turning, swinging and walking: on screen in 0 of 90 frames each.
- Disposal: the meshes take their geometry back, the alternate is disposed once (`:369-371`). Read, not
  tested (N-20).
- Shadow: a mesh off the camera's layer is skipped by the shadow pass too, so a crouched player's own
  shadow is legs only.
- What it does not cover: hips (W-13). What it gives up: a crouched look-down never shows the torso
  (W-02).

**F, no foot turn on the leg layer while crouching: accepted.**

- Exactly lines 520 and 522 of `enemyAnimations.js`. For a pose that is not crouching the expressions
  reduce to the old ones. I re-ran the comparison: every bone of four standing turning runs is equal to
  the driver of `f464b11`, difference 0.
- `pose.turn` and `turnPhase` are read nowhere else in `src`. The presentation is untouched, so feet
  yaw, twist and the turn's name are what they were. Side effect: `currentClip` reads `loco` during a
  crouched turn where it read `turn_*` (debug display only).
- It applies to bots and remote actors alike.
- A turn begun standing, then crouch: crouched legs at once. A crouched turn, then standing up: the
  standing turn clip for the rest, as before.
- Third person, crouched and turning: the legs yaw in place while the feet unwind, with no step, as a
  standing turn does (both turn clips are one held frame). Feet lag reaches 1.6 rad at 3 rad/s and 2.0
  swinging against a twist bound of 0.7, standing and crouched, before and after. No frame shows it.
- Mutants: the driver of `f464b11` fails 12 of 20 cases; no turn for anyone fails the 4 standing cases.
- Fixture: the same four changed lines as the driver and nothing else; the pin is its hash; the
  containment rule of plan 07-29 holds after trimming whitespace.
- `matched`: it compares the cached driver with the uncached copy, and both got the edit. It cannot
  show the change in behaviour and was never meant to. `crouchFootTurn.test.js` guards that. The
  "standing unchanged bone for bone" figure of the summary is not a committed assertion.

**G not needed: true only for the states measured.** See W-13.

**H, layers instead of `visible`; `tests/first-person-rig.spec.js` line 276: accepted for now.** The
mechanism works. The assertion still says what it always measured (those meshes belong to the body view
and have triangles) but its word "visible" no longer means drawn. It should be changed, in the next plan
that edits that spec, to read what is drawn at the standing -1.38 sample. Not needed before the owner's
check: the own-body spec (standing chest share at least 4.5 percent) and the unit cases already guard
what is drawn.

## The twelve questions

**1, 3, 4, 5 (the lean's writes, owners, easing, weapon).** `weaponHandling.js` is byte-identical to the
first delta review. Those answers stand with their lines.

**2. First-person view.** Arms view: bone matrices equal with and without the lean, difference 0 in all
eight samples. Body view: no lean (`firstPersonRig.js:290`). Panel: unchanged call (`animationReview.js:159`).

**6. Earlier answers of `07-33-REPAIR-REVIEW.md`.**

| Answer | After this plan |
|---|---|
| 1, no gameplay or authority writes | Holds. The rig reads `camera.position.y` and one bone's world height (`:316`). |
| 5, driver and inertia restore | Holds; the driver's diff is lines 520 and 522 only. |
| 6 and 11, look-down body view | Standing: the draw is what it was. Crouched: hips and legs only. |
| 9, 10 | See questions 9 and 12. |
| 12, crouch transient | Unchanged in third person. In first person the press and release frames are now clean (inside 0; `f464b11`: inside in 34 of 45 frames at level). |
| 13 | Not touched. |

**7. Tests.** The three W-10 cases each fail under their mutant and only then. No existing test changed
except the one line of decision A, the pin and the fixture.

**8.** `tests/animation-live-route.spec.js` is unchanged in this delta; 19 added, 0 removed since
`2f69dfe`.

**9. Cost (Node, this host).**

- `updateFirstPersonRig`: 190 microseconds standing and looking down at -1.3 (184 at `f464b11`), 196
  crouched (185). One set lookup per saved bone, one subtraction, one comparison.
- `createFirstPersonRig`: 139 ms (105). Once per player build and per opening of the review panel.
- Memory: one geometry of 331,528 bytes, uploaded on first crouch.
- Driver: two boolean tests per tick.
- Paired gate: three of its five measured files now differ from the qualified identity (rig, driver,
  handler). The capture looks down at -1.3 standing and crouched; the standing draw is unchanged, the
  crouched one draws fewer triangles. W-06 stands; the gate must be run again.

**10. Body view, fade, frames.** The fade now protects nothing in first person; it is kept for the
third-person look, as the plan says. The range 6 to 13 and the easing are unchanged. `crouch-1.38.png`
and `crouch-0.png` of the final run are clean.

**11. Plan 07-38.**

- B-01, B-02: above.
- Eye inside no mesh and 0.10 m clear in every listed state: yes; my smallest is 0.180 m.
- Clean view in crouch at every pitch, hand-driven and real loop: yes in the frames and counts.
- Looking down, crouched: thigh, knee guard, shin, boots; own-body share 3.5, 9.1 and 19.2 percent at
  -0.6, -0.9 and -1.38.
- Limits: ink 1.0 percent, 0.5 points and 0.10 m were fixed before and left alone. Set after results,
  and disclosed: the leg-joint counts, the standing chest share, planted feet, the pelvis band, the
  margin's room. I found no undisclosed change.
- Simulated eye, arms view and third person: not moved by the rig change. Third person changes only by
  F.
- W-07: resolved on the ground, not in the air (W-13). W-08: explained, constructed. W-09: resolved.
  W-10: resolved.

**12. Summaries.** `07-38-SUMMARY.md` says plainly what the owner will see. Two things are missing or
too strong: "W-07 resolved" (W-13), and the arm in its own turning frames (W-14).

## Earlier warnings after this plan

| Warning | Status |
|---|---|
| W-01 diagonal feet under the floor | open, untouched |
| W-02 little torso when looking down | open; crouched now none at all, by rule |
| W-03 crouch step of 0.37 m | open in third person; first person clean on press and release |
| W-04 hip step on melee and throw | open; crouched it lifts the pelvis to 0.92 m (W-13) |
| W-05 foot sliding | open; a crouched turn now slides as a standing one does |
| W-06 paired gate comparability | open; three measured files changed |
| W-07 body in front of the eye when the view swings | resolved on the ground; open in the air (W-13) |
| W-08 half-black frames on record | explained as another character; constructed, not observed |
| W-09 chest when crouch-walking and looking up | resolved (own body 0.00 %; my probe: paint 0) |
| W-10 three untested conditions | resolved |
| W-11 online fade trails the camera | no longer first person; unchanged for other players |
| W-12 sentence for the owner | replaced in `07-37-PLAN.md:139-140` |

## New warnings

**W-13. A jump on the spot with crouch held puts the hips through the eye when the view turns.**

- Cause: jump start, loop and landing, stop and reversal, melee and throw all play standing legs. At
  crouch eye height the pelvis rises to 0.92 to 0.93 m above the root, 0.07 m above the eye. In the air
  the feet yaw is frozen unless the player moves (`animationPresentation.js:100-101`), so the hips twist
  under a turning view. The body view draws hips and legs then.
- Jump with crouch held, not moving, level aim, 90 frames:

| View | Frames with the eye inside the hips | Frames over 1 % ink | Largest ink |
|---|---|---|---|
| still, or turning at 0.5 rad/s | 0 | 0 | 0 |
| turning 1 rad/s | 12 | 18 | 12 % |
| turning 2 rad/s | 9 | 19 | 27 % |
| turning 3 rad/s | 14 | 18 | 50 % |
| swinging 4 rad/s | 16 | 20 | 80 % |
| moving at 4.32 m/s, 3 rad/s or swinging | 0 | 0 | 0 |

- At 3 rad/s the largest ink is 27, 42 and 39 percent at +0.45, -0.6 and -1.2.
- Standing jump with crouch pressed in the air, 3 rad/s: inside in 3 frames, ink up to 30 percent.
- Near misses, no ink: crouched melee and throw (nearest 0.054 m still, 0.029 swinging; hips over 12 to
  15 percent of the screen at level); run, stop, crouch 0.1 s later (0.073 m still, 0.010 turning).
- The same runs at `f464b11` give the same ink within 0.5 points. This plan neither caused nor fixed
  it. Rasteriser and ray-parity figures; not seen in a browser.
- Fix direction if wanted: decision G of Amendment 2 (nothing of the body view while the pelvis is not
  0.15 m below the eye), or the driver keeping crouched legs for these clips as F does for the turn.
  Guard states to add: the rows above.

**W-14. The first-person support arm leaves the gun's left side while the view turns fast.**

- With planted feet the lag exceeds the twist bound, and the arms view copies the yawed shoulders.
  Shoulder line against the view: up to 26 degrees at 1 rad/s, 76 at 3 rad/s, 88 swinging.
- The left elbow is to the right of the left wrist in 118 of 180 frames at 3 rad/s, standing. The view
  handler's contact error stays under 0.026 m, so the contact check does not see it.
- Standing figures are equal at `e09bf9b`, `f464b11` and HEAD: older than the repair.
- Crouched, F makes it somewhat larger: 154 of 180 frames (118 before), shoulder line up to 90 degrees
  (76 before).

**W-15. Three of the five timing-gate files have changed; rig creation costs 34 ms more.** Question 9.

**W-16. The pitch-view case of `tests/first-person-rig.spec.js` can still be drawn over by an enemy.**
It starts Incursion; its assertions pass either way. Deferred item, open.

**W-17. Online and the review panel differ from what was measured.** Online, the local pose trails the
local crouch flag by a round trip, so for that time the draw rule sees a standing pose at crouch eye
height (the W-13 geometry). The panel puts the crouched eye at 1.25 m (`animationReview.js:158`), so
its crouched first-person row draws the whole body where live play draws hips and legs. Read from
source.

## Notes

- **N-20.** Two properties of the rig are untested: that only the four lean bones are restored on the
  body view, and that the alternate geometry is disposed.
- **N-21.** The standing "bone for bone" equality of F is a scratch comparison, not a committed case.
  The committed case checks the layer name and a pelvis above 0.85 m.
- **N-22.** `tests/first-person-rig.spec.js` line 276: decision H.
- **N-23.** A crouched player's own shadow is legs only. No frame checked.
- **N-24.** `createFirstPersonRig` builds the alternate eagerly; a player who never crouches pays the
  34 ms and not the upload.
- **N-25.** `BODY_VIEW_TORSO_BELOW_EYE` is a new export, read by the guard.
- **N-26.** `currentClip` reads `loco` during a crouched foot turn.

## What the owner should be told at the binding check

1. First person, crouched: your own torso is not drawn. Looking down shows thigh, knee, shin and boots.
   Standing is as before.
2. Crouched and turning on the spot: the character no longer stands up on its legs for each turn, in
   first and third person. The feet turn in place without a step, as they do standing.
3. **Still open (W-13):** jump on the spot with crouch held and turn the view, and the screen can go
   black over a large part for about a quarter of a second. Jumping while moving does not do it.
4. **Still open (W-14):** when the view turns fast, the left arm swings to the right of the gun. It did
   so before Phase 7's repair too.
5. The half-black frames on record were most likely another character standing on the player in
   Incursion. That an enemy can spawn on the player's cell is open and not fixed.
6. A crouched player's own shadow is legs only.
7. The crouch lean is unchanged and is seen in third person, on bots and on other players only.
8. Still standing: W-01 to W-06 as listed in the plan, and the timing gate must be run again.

## What I could not verify

- Anything in a browser. W-13 and W-14 are Node figures; for W-14 the plan's own frames show it.
- That the frames of 13:26 on record held an enemy.
- Third person while crouched and turning: no usable frame exists.
- Online play, a real GPU, 60 frames per second.
- The waist cap and the legs-only shadow in a rendered frame.
- How any of it looks. That is the owner's.
