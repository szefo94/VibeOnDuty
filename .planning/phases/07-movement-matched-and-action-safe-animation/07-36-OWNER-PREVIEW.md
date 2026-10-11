---
status: preview
lean: right
lean_degrees: 12
shown_commit: eb4304115911b00565fa7acaac25c6619148972d
reviewed_by: owner
date: 2026-10-11
---

# Plan 07-36: owner's preview of the crouched torso lean (not an approval)

Written by the orchestrator. It holds the owner's own words. A preview is not an approval of the repair: the binding check is plan 07-37, after the delta review.

## Preview 1 (2026-10-11)

Shown: the dev server on port 5173 with the working tree at the commit above (source as committed in `d2b1778`: `CROUCH_TORSO_LEAN_RAD` 12 degrees, fade with upward aim). The owner was asked to look at crouch and crouch walk in third person at level aim and aiming up, and at first person crouched looking level, up and down, and to answer "right", "more", "less" or in their own words.

Order changed by the orchestrator: the preview was shown before tasks 1 and 2 of plan 07-36 (browser tracer, focused browser set, fast gates), because a change of the value would have required those to run again. The shown version had passed the unit tests only (545 in 36 files). Tasks 1 and 2 run after this preview on the same source; they may add assertions to `tests/animation-live-route.spec.js`, so `tests/` at the end of plan 07-36 can differ from the shown commit while `src/` may not.

The owner's reply, verbatim:

> ok, lets proceed, now crouch is looking okay, what would be the next step?>

Recorded from it: `lean: right` at 12 degrees ("now crouch is looking okay"; "lets proceed"). The owner named no other issue in this reply. It is not a verdict on the repair as a whole or on the open items, which are put to the owner in plan 07-37.

## Correction by the orchestrator (2026-10-11)

The `shown_commit` line first carried a hash that is not a git object: the orchestrator wrote the short hash `eb43041` out to 40 characters wrongly. It is corrected above to the full hash that `git rev-parse eb43041` returns. Nothing else in this record changed; the owner's words are as first written.
