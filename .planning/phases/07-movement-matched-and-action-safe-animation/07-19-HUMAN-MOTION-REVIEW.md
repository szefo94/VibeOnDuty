---
status: issues-raised-adjustment-requested
verdict: none
reviewed_by: owner
started: 2026-10-11
capture: evidence/07-motion-review.json sha256=615e5d22eb156ca76670338e3b182702da98e840cbdaae3c39f5aec3a807d574
---

# Plan 07-19: owner's human motion review (in progress)

This file holds the owner's own words only. No agent judgement of motion or aesthetics is
recorded here. The verdict stays `none` until the owner states one. `humanMotionAcceptance`
in the capture report remains `pending`.

## Reply 1 (2026-10-11), verbatim

> 1. when character is reloading, i can see the back of him in front of me, when proning, weapon is on the level of crouching, weapon in proning should be almost on the ground, a little further than the head of the soldier of course. next: i need to test the list of animations on my own, because captures are having too low of an fps, i.e. it captures jump in one frame when it starts and then when it ends, hard to tell anything, please let me run it so i can check it

## Items the owner raised (restated by the orchestrator, not judged)

| # | Owner's observation | Not yet established |
|---|---|---|
| H-01 | During reload the back of the character is visible in front of the viewer. | Which view (first person in the live game, or a capture movie) and whether offline, online or both. Cause not diagnosed. |
| H-02 | When prone, the weapon sits at crouch height; it should be almost on the ground, a little beyond the soldier's head. | Prone is a labelled "Preview — Phase 5" action in this phase. Cause not diagnosed. |
| H-03 | The capture movies have too low a frame rate to judge motion (a jump shows as one frame at the start and one at the end). The owner will check the animation list in the live game instead. | The captures are software-rendered headless recordings. The live check has not happened yet. |

No item is approved. The review continues with the owner's live check.

## Reply 2 (2026-10-11), after the owner's live check on the dev server, verbatim

> first person is mostly okay, where it comes to the third person, it is completely stale, in all of the available options, character is just moving his legs, and hands, nothing much else, there is no synchro with hips, movement, changing elevation when crouching, leapingforward or proning, character animation stays entirely in the standing position. also when playing myslelf, the remarks i've provided above do not appear to happen, no showing back of soldiers back and character is completely no crouching or prunning so the other two remarks are having no use in live session. ok, so that was for a game, now animation review. First, crouch, knees are rotated to te opposite side( bending backwards, when jumping knees are also bending backwards. Next, Damage transition does nothing. Directional death as well, knees bent backwards, character lies on te ground face down, hands and weapon on the level of crouch, not the level of ground. supersprint, super stiff as other running animations. Slide, hips and legs should go in front, not the corpus and head. Dive-> same as death, its just like proning. Prone, once again, character is face down to the ground, weapon is at the crouch level. Ok, moving on to looking down-> nooooooooooow i can se my characters back. Moving on-> first person, crouching, standing ok, pruning does not change elevation to near ground, it just at te level of the standing and hands are turned upside down, is what i see. i think this is all the options to check and see. Please adjust

## Items from reply 2 (restated by the orchestrator, not judged; causes not diagnosed)

Live game:

| # | Owner's observation |
|---|---|
| H-04 | Third person, every available option: only legs and hands move. No hip involvement, no match with movement, no change of height when crouching, leaping forward or going prone; the character stays in the standing position. |
| H-01, H-02 | Not seen in live play (no back of the soldier during reload; the character does not crouch or go prone in third person at all, so the prone weapon height cannot be seen there). |
| — | First person in live play: "mostly okay". |

Animation review panel:

| # | Owner's observation |
|---|---|
| H-05 | Crouch: knees bend backwards. |
| H-06 | Jump: knees bend backwards. |
| H-07 | Damage transition: does nothing. |
| H-08 | Directional death: knees bend backwards; the character lies face down; hands and weapon at crouch height instead of ground height. |
| H-09 | Supersprint: very stiff, like the other running animations. |
| H-10 | Slide: hips and legs should lead, not the torso and head. |
| H-11 | Dive: same as death, looks like prone. |
| H-12 | Prone: face down to the ground, weapon at crouch height. |
| H-13 | Looking down: the character's back is visible. |
| H-14 | First person: crouching and standing are fine; prone does not lower the view to near the ground (stays at standing height) and the hands are upside down. |

The owner's request: "Please adjust". No item is approved and no verdict is stated.
