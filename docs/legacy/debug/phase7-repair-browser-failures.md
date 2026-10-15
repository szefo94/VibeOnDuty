---
status: diagnosed
trigger: "Two unpredicted browser-test failures after the Phase 7 motion repair (07-27, 07-28): tests/animation-motion-source.spec.js 2 of 4 cases; tests/first-person-rig.spec.js case at line 213 (crouched leftError 0.035 m). goal: find_root_cause_only"
created: 2026-10-11T10:15:00Z
updated: 2026-10-11T10:40:00Z
---

## Current Focus

hypothesis: both confirmed (see Resolution)
test: done
expecting: n/a
next_action: none; diagnose-only. A later plan decides the fix routes.
bug_class: Bohrbug (both deterministic)

## Symptoms

expected: 07-29 plan predicted animation-motion-source.spec.js "passes, no edit ever"; first-person-rig.spec.js line 265 contact errors under 0.025 m.
actual: (1) spec line 152 `sample.authored` false for walk samples, line 175 names not `vod7_turn_left`. (2) spec line 265: crouched samples leftError 0.0358/0.0355/0.0352/0.0349 m at pitch -1.38/-0.9/0/1.38; rightError 0; standing 0.
errors: Playwright expect toBe(true) received false.
reproduction: `MSYS_NO_PATHCONV=1 PUBLIC_BASE=/ npx playwright test tests/<spec> --workers=1` at HEAD 3665406.
started: after commits 1a8b141 / 5bc4a55 (plan 07-27). Pre-repair source e09bf9b.

## Eliminated

- hypothesis: the 3.5 cm is an inertia-blend artifact "one tick after crouch entry"
  evidence: Node, one driver object: pelvis.position is at the full crouch value on the first crouch tick (0.0325, 0.28, 0.4693) and leftError is 0.139 m at once; it never decays (0.138 to 0.145 m after 200 ticks).
- hypothesis: the 07-28 look-down offset causes it
  evidence: tree fe3117b (07-27 only) and HEAD give identical figures; the offset moves rig.body only, the contact is solved on rig.arms.
- hypothesis: the inertia restore / rawCorrections / restoreWeaponHandlingBones cause it
  evidence: error equals shoulder-to-target distance minus arm reach (0.6864 - 0.5471 = 0.1393) exactly; it is pure geometry of the shoulder position, which none of those write.

## Evidence

- checked: `git diff e09bf9b HEAD -- src/builders/enemyGLTF.js`
  found: `createReviewCharacter` (enemyGLTF.js:708-719) resolved clips with `findClip` before; since 1a8b141 line 714 uses `findLiveClip`. Plan 07-27 intended it (07-27-PLAN.md line 207, 272).
  implication: the spec's "independent-loaded-source-clone" is `g.createReviewCharacter('m4')` (spec line 43), so `actions.walk` is `live_walk_forward`, `actions.turn_left` is `live_turn_left`. `actions.reload` stays `vod7_m4_reload`.
- checked: Node (scratch `panel.test.js`), old e09bf9b tree vs HEAD: `createReviewCharacter('m4').actions[key].getClip().name`
  found: HEAD walk=live_walk_forward, turn_left=live_turn_left, idle=live_m4_ready, crouch=live_crouch_idle, jump_start=live_jump_start, death=Death01, hit/damage=hit, reload=vod7_m4_reload, attack=vod7_m4_ads, nade=vod7_throw, supersprint=vod7_supersprint. Old: all vod7_ (roll, dance inherited). `findMotionClip` unchanged in both.
  implication: 07-29's table row for this spec ("through findMotionClip ... passes, no edit ever") rests on a wrong reading; the spec never calls findMotionClip.
- checked: Node (scratch `contact.test.js`) on three trees (e09bf9b, fe3117b, HEAD): live player + real first-person rig + real `weapon.js` view gun, spec sequence and 60 fps loop sequence
  found: one driver object: crouch leftError old 0.0000; fe3117b and HEAD 0.1394 to 0.1401 on the four spec ticks, 0.1406 to 0.1454 settled; rightError 0. Shoulder in camera space z -0.186 standing, +0.044 crouched (0.23 m further back), x -0.033. pelvis.position (bone local) standing (0, 0.0501, 0.8768), composed crouch (0.0325, 0.28, 0.4693); authored crouch (0, 0.0501, 0.5967).
  implication: the composed crouch carries the inherited rifle_ crouch pelvis 0.23 m behind the root; the view arms copy it and only the vertical shoulder offset is compensated (firstPersonRig.js:280-287), while the view gun is fixed to the camera. The support target is 0.69 m from the left shoulder; the arm reaches 0.547 m.
- checked: Node emulation of the spec's setup: loop actor object warms the mixer, then a second actor object on the same mesh/mixer (spec line 222) runs the spec sequence
  found: crouch leftError 0.0330 / 0.0333 / 0.0337 / 0.0342; pelvis (0.0162, 0.165, 0.673); mixer has `live_m4_ready_lower@1` (left running by the loop's object) and `live_crouch_idle_lower@1` together. Old tree: same two layers, error 0.
  implication: the browser's 0.035 m is a half crouch averaged by two drivers on one mixer, not the real crouch. The real figure is about 0.14 m. (2 mm difference to the browser unexplained in detail; breathing phase starts at a random time.)
- checked: other live states at HEAD, one driver, 60 fps
  found: stand/walk/run/sprint/ADS standing 0; crouch idle 0.138-0.145; crouch walk 0.116-0.149; crouch ADS 0.110-0.136; jump: 0.031 on the take-off frame, up to 0.034 for the first frames after landing.
- checked: review panel sequence in Node per scenario (m4, pistol)
  found: see Resolution table. M4 first-person crouch scenario leftError 0.144; jump 0.038; pistol 0.
- checked: fix direction on a scratch copy of src (`fix-trial`), shoulder-centre fore/aft pinned like the vertical fit
  found: leftError 0.0000 in every state and in the two-driver emulation.

## Resolution

root_cause: (1) `createReviewCharacter` was switched to `findLiveClip` by plan 07-27 (deliberately); `tests/animation-motion-source.spec.js` uses that factory as its authored-source clone, which plan 07-29 misread as a `findMotionClip` path. (2) Composed crouch (and jump start/land) clips take the whole inherited `pelvis.position`, 0.23 m behind the root; `updateFirstPersonRig` compensates the view shoulders vertically only, so the M4 support target is out of the left arm's reach by about 0.14 m in a real crouch. The spec reports 0.035 m only because its second driver object leaves the loop's standing layer running.
fix: not applied (diagnose-only)
verification: n/a
files_changed: []
