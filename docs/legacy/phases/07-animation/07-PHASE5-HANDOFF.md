---
for_phase: 5
written_by: orchestrator
date: 2026-10-11
source: owner replies recorded in 07-19-HUMAN-MOTION-REVIEW.md and this file
---

# Handoff from Phase 7 to Phase 5 (omnimovement): owner direction and requirements

Read this before discussing or planning Phase 5. It holds the owner's words and what was measured; it records no agent judgement of motion.

## Owner direction on ordering (2026-10-11), verbatim

Asked what happened to prone and the leap forward, and told that they were deferred to Phase 5 and that Phase 5 could start with them, the owner replied:

> ok, continue, phase 5 with prone and dive first

Recorded: Phase 5 starts with prone and dive, so they are the first things the owner can play and review.

Earlier the same day (reply 3 in `07-19-HUMAN-MOTION-REVIEW.md`), verbatim:

> ok, maybe lets plan tis omnimovement in separate phase as you say, leave it to lean at every animation in separate wit live review, for now lets see what we can continue with, this movement i would now leave for later

Recorded: slide, dive, prone and supersprint are left for the omnimovement phase, where each animation gets its own live review by the owner.

## How the owner wants to review

- Live, in the running game, one animation at a time. The capture movies are too choppy to judge motion (software rendering, a few frames per second).
- A quick non-binding preview first, the independent review after the owner says the look is right, then one binding verdict. This order worked for the crouch lean in plan 07-36.

## The owner's requirements for these actions (from the Phase 7 live review, items H-08 to H-14)

- Prone: the weapon should be almost on the ground, a little beyond the soldier's head. The preview had it at crouch height. First person in prone must lower the view to near the ground; the preview stayed at standing height with the hands upside down.
- Dive (leap forward): must not look the same as death or prone.
- Slide: hips and legs should lead, not the torso and head.
- Supersprint: not stiff like the other running animations.

## State these actions are in after Phase 7

- No gameplay state exists for prone, slide or a dive to prone: no key, no lowered eye, no collider change. The dive key (Z) plays the inherited motion-captured roll.
- The 59 authored `vod7_` clips are procedural hinge poses built by `tools/art/build_motion.py`, not motion capture. Measured defects: knee signs inverted, no pelvis or head motion in gaits, dive and prone holds identical, arm targets not lowered with the rotated torso. See `.planning/debug/phase7-human-motion-review.md`.
- Live play uses composed clips for the in-scope actions: inherited motion-captured legs under the authored weapon pose (plans 07-27, 07-34), with a crouched torso lean in `weaponHandling.js` (plan 07-35). The preview clips for slide, dive, prone and supersprint are unchanged.
- Open items the Phase 7 repair measured and did not fix are listed in the final owner check of plan 07-37 and its record.

## Open items carried from the Phase 7 repair (added 2026-10-11 after the owner's binding verdict)

The owner approved the repaired in-scope motion and accepted these as they are for Phase 7 ("approved, accept all", `07-37-OWNER-LIVE-CHECK.md`). None is fixed. Figures and causes are in `07-33-REPAIR-REVIEW.md`, `07-37-REPAIR-REVIEW.md` and `07-37-REPAIR-REVIEW-2.md`.

Accepted by the owner for Phase 7:

- W-13: jumping on the spot with crouch held while the view turns puts the hips through the first-person eye (jump, landing, stop, reversal, melee and throw play standing legs at crouch eye height). Black over 12 to 80 percent of the screen for a fifth of the frames. A guard exists as a design (draw nothing of the body view while the pelvis is not at least 0.15 m below the eye; plan 07-38 Amendment 2, decision G, not added).
- W-14: the first-person support arm bunches under the gun or crosses to its right while the view turns fast. Older than the repair.
- W-01: feet under the floor in diagonal movement (0.086 m walking forward-left, 0.123 m sprinting forward-left).
- W-05: foot sliding (about 1.2 m of planted feet per 2.4 m walk cycle; crouch walking backwards or sideways shows forward steps).
- W-03: crouch press and release transients (feet 0.368 m under the floor on the first frame; hover up to 0.386 m on release). On a crouch press the local player is also first presented as a jump start and landing (`src/entities/player.js` lines 286 to 292, read from source).
- W-04: melee and grenade throw step the hips up 4 cm with stiff authored legs; a crouched character stands for the action.
- Damage in live play is a quarter-weight additive for 0.3 s and reads weak.
- W-02: a crouched look-down in first person shows legs only, by rule; standing shows little torso except near the pitch limit.
- The crouched third-person lean (12 degrees) straightens when aiming up (fade 0.3 to 0.8 rad).

Listed in the review records, not put to the owner for a verdict:

- The inherited `strafe_l` clip does not close (9.4 degrees), so strafing left hitches once per cycle.
- H-01, the back of a character seen during reload in a capture movie, is unexplained.
- A crouched third-person torso straightens while the game is paused.
- W-16: the pitch-view case of `tests/first-person-rig.spec.js` starts Incursion, where an enemy can spawn on the player's cell and be drawn over the view; its assertions pass either way. Line 276 of that spec lists chest meshes as visible although they are not drawn at its crouched sample (layer mechanism); the second review asks for that assertion to read what is drawn.
- W-17: online, the local pose trails the crouch flag by a round trip; the review panel's crouched first-person row draws the whole body where live play draws legs.
- Game finding: Incursion can place an enemy on the player's cell (`deferred-items.md`).
- Live play uses inherited motion-captured legs whose redistribution terms are unresolved; the authored planted stop, reversal, turn and directional death clips are not shown in play.
