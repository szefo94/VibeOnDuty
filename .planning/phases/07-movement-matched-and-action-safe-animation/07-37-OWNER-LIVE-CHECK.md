---
verdict: approved
open_items: accepted-for-this-phase
reviewed_by: owner
reviewed_commit: f4748da4b9ffc28dda34e937eec5a90c0c3b9c62
date: 2026-10-11
---

# Plan 07-37: owner's binding check of the reviewed repair

Written by the orchestrator. It holds the owner's own words; no agent judgement of motion or aesthetics is recorded here.

## What the owner was shown and asked

The dev server on port 5173 at source, tests and assets equal to the reviewed commit above (HEAD was `842a00d`, which adds only the review record `07-37-REPAIR-REVIEW-2.md`, verdict approved).

The owner was asked two things in one message and told the reply that would mean both: "Reply "approved, accept all", or name what you want fixed first".

1. Whether the repair is approved, with this to check in the Training Range: first person crouched, looking level, up and down and shaking the mouse (no black shapes; looking down shows legs and no torso); third person crouched, turning on the spot (the character stays down and leans forward as previewed); standing in first person looking down (chest and legs as before).

2. Whether these open items are accepted for this phase or wanted fixed first, each with what the owner would see:
   - crouch-jump while turning: black flashes in first person (review W-13; in the air the game plays standing legs and at crouch camera height the hips pass through the view; black over 12 to 80 percent of the screen for a fifth of the frames depending on turn rate; older than this repair);
   - support arm on fast turns: the arm bunches or crosses under the gun (W-14; older than this repair);
   - diagonal movement: feet sink 9 to 12 cm on forward-left walk and sprint (W-01);
   - foot sliding: feet cover about half the distance the body travels (W-05);
   - crouch press and release: a brief dip under the floor and a brief hover (W-03);
   - melee and grenade throw: the hips step up 4 cm and a crouched character stands for it (W-04);
   - damage flinch: weak in play, a quarter strength for 0.3 s;
   - crouched look-down: shows legs only, never the torso (W-02, now by rule);
   - aiming up while crouched: the third-person lean straightens.

The orchestrator recommended approving and accepting all of these for Phase 7, because Phase 5 rebuilds crouch, jump and stance behaviour and each animation there gets the owner's live review, and offered to fix the crouch-jump flash first if the owner wanted.

Not put to the owner in that message, although listed in the review records: review W-06 (the paired timing capture looks down at a view this repair changed; it is put to the owner in plan 07-31 before the calibration is spent), the strafe-left hitch (first review, note N-10), the unexplained H-01 (the back seen during reload in a capture movie), the pause behaviour (a crouched third-person torso straightens while paused), and W-16 and W-17 (a test case that an enemy can draw over; online timing of the crouch flag; the review panel's crouched first-person row). The owner's acceptance below covers the items in the list above. These others stay open and are carried in the handoff to Phase 5.

## The owner's reply, verbatim

> approved, accept all

## What is recorded from it

- `verdict: approved`: the repair as it plays at the reviewed commit is approved by the owner for requalification.
- `open_items: accepted-for-this-phase`: the nine listed items are accepted as they are for Phase 7. They are not fixed and are carried to Phase 5.
- This is the owner's acceptance of the repaired in-scope motion as shown. It is not an acceptance of slide, dive, prone or supersprint, which the owner deferred to Phase 5, and it is not a device or frame-rate certification.
