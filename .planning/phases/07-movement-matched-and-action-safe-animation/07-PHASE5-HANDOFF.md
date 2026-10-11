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
