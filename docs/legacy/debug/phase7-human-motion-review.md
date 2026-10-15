---
status: diagnosed
trigger: "Owner human motion review of Phase 7 (07-19-HUMAN-MOTION-REVIEW.md, items H-04 to H-14): third person stays standing, knees bend backwards, damage transition does nothing, face-down death/prone, weapon at crouch height, looking down shows back, first-person prone stays at standing height."
created: 2026-10-11
updated: 2026-10-11
goal: find_root_cause_only
symptoms_prefilled: true
bug_class: Bohrbug
---

## Current Focus

hypothesis: confirmed, see Resolution (four independent causes; AND-gate yes for H-04)
test: done
expecting: n/a
next_action: none (diagnose-only). A fix plan must choose between re-authoring the 59 clips and returning live play to the inherited clips.

## Symptoms

expected: Third-person body crouches/drops/hips move with gait; knees bend forwards; prone/death on the ground with weapon near ground; damage shows a reaction; looking down shows legs not back; first-person prone near ground.
actual: See H-04..H-14 in 07-19-HUMAN-MOTION-REVIEW.md.
errors: none
reproduction: npm run dev, Training Range, key V; F3 -> Open animation review.
started: Phase 7 (owner's first live review 2026-10-11)

## Eliminated

- hypothesis: The runtime strips or masks away pelvis height (stripRedundantTracks, lower/upper masks).
  evidence: Live probe shows layer vod7_crouch_idle_lower with 10 tracks including pelvis.position at weight 1 and pelvis at 0.60 m (rest 0.92). The non-rest constant track survives stripping (enemyGLTF.js:270-291) and UPPER_TRACK does not match pelvis/thigh/calf/foot/ball.
  timestamp: 2026-10-11
- hypothesis: The review panel shows different clips from the game.
  evidence: Both resolve the same vod7_ clips through findMotionClip. The panel plays the unmasked source clip at weight 1 with inertia cleared (animationReview.js:139-148); the difference in live play is the inertia hold, not the clip.
  timestamp: 2026-10-11

## Evidence

- timestamp: 2026-10-11
  checked: public/models/enemy.glb, all 107 clips, loaded in Node with GLTFLoader (scratch measure.mjs)
  found: The 59 vod7_ clips have 21 quaternion tracks (no Head, no fingers) and a pelvis.position track only where manifest bodyDrop > 0. Walk, run, sprint, supersprint, ready, damage have no pelvis translation and a constant pelvis rotation. Inherited walk has pelvis Y 0.82..0.86, run 0.71..0.82.
  implication: Hips, torso and head are static by authoring in every Phase 7 gait.
- timestamp: 2026-10-11
  checked: knee offset from the hip-ankle line along character forward (+Z), sampled on the real skeleton
  found: vod7_crouch_idle -0.25 m (flex 73 deg), inherited Crouch_Idle_Loop +0.18/+0.36 m. vod7_jump_start/land -0.08..-0.12, inherited Jump_Start +0.30. vod7 walk/run/sprint/supersprint swing leg -0.06..-0.08 (flex up to 27 deg), inherited walk/run always positive. vod7_death_front -0.03..-0.06.
  implication: Knee direction is inverted in the clip data itself.
- timestamp: 2026-10-11
  checked: tools/art/build_motion.py original_pose()
  found: Character faces Blender -Y (line 115). Thigh hinge is +angle about world +X (lines 135, 142, 154, 169), which moves the knee to +Y (backwards); calf hinge is negative (136, 143, 155, 170), which swings the shin forwards.
  implication: Sign convention error in the authoring script; all leg poses share it.
- timestamp: 2026-10-11
  checked: pelvis/head/hand heights
  found: vod7_crouch_idle pelvis 0.60, head 1.25, ankle -0.05, toe -0.14 (inherited crouch: pelvis 0.47, head 0.84, ankle 0.10). Game eye when crouched is 0.85 (config.js PLAYER_H_CROUCH). vod7_death_front end: pelvis 0.22, head 0.24, chest normal straight down, hands 0.66. vod7_prone_hold: pelvis 0.20, head 0.22, shoulders 0.28, hands 0.64, ankles 0.46. vod7_dive_hold equals prone_hold to two decimals in every measured value. vod7_slide_hold: pelvis 0.47, head 1.03 and 0.28 m forward, chest pitched forward. vod7_damage: only a 0.07 rad spine_02 twist, hands move about 1 cm.
  implication: H-08, H-10, H-11, H-12 and H-07 are properties of the authored clips (build_motion.py lines 163-170, 179, 211-216).
- timestamp: 2026-10-11
  checked: live third person on the running dev server, headless, frame-counted waits (scratch live2/3/4.mjs)
  found: Crouched and idle after 120 frames: pelvis 0.60 but knee flex 15 deg (clip says 73) and feet 0.21 m below the mesh root. Per-frame record of calf_l: the mixer writes the crouch value (-0.596) on one frame, inertia blends it to -0.143, and on every later frame the value before and after mixer.update is identical; it settles at -0.075 for good.
  implication: The mixer never re-applies the constant track; the inertia blend's first-frame result is permanent.
- timestamp: 2026-10-11
  checked: node_modules/three/src/animation/PropertyMixer.js apply(), lines 171-178
  found: The scene graph is written only when the accumulated value differs from the previously applied one.
  implication: Any post-mixer write to a bone driven by an exactly constant track persists. _tickInertia (enemyAnimations.js:202-213) does such a write and is not restored before the next mixer update.
- timestamp: 2026-10-11
  checked: transition log on crouch press (window.__animDebug('player'))
  found: loco/ready/m4_ready -> jump_start/ready/crouch_idle -> jump_land/ready/crouch_idle -> loco/ready/crouch_idle
  implication: Pressing crouch is presented as a jump start and landing first (cause in player.js onGround handling not traced).
- timestamp: 2026-10-11
  checked: live dive (KeyZ)
  found: Layer Roll (inherited, 66 tracks, pelvis position) at weight 1; pelvis 1.13 -> 0.41 -> 0.81 over the roll.
  implication: The dive does play a full-body inherited clip; the owner's "leaping forward" remark was not reproduced for KeyZ.
- timestamp: 2026-10-11
  checked: src/dev/animationReview.js and src/builders/firstPersonRig.js
  found: Review camera height is `sample.crouching?1.25:1.65` (line 158); crouching is true only for the crouch scenario (line 67). Body view offset is `-.18 + .43 * clamp(-pitch/1.1)` (firstPersonRig.js:265-266): +0.25 m forward at the panel's -1.3 rad pitch.
  implication: H-14 height is the panel; H-13 is the body-view offset direction (same code runs in live play).
- timestamp: 2026-10-11
  checked: tools/art/motion-pipeline.mjs validateListedMotion (161-210) and tests/animation-*.spec.js
  found: The validator checks names, durations, unit quaternions, no horizontal pelvis travel and vertical travel within bodyDrop. Browser tests assert layer names, weights and track lists. Nothing measures joint direction, ground contact, hand height or the final bone pose after inertia.
  implication: No gate existed for this class.

## Resolution

root_cause: (1) build_motion.py authors the 59 vod7_ clips procedurally with an inverted knee sign, no pelvis/torso/head motion in gaits, arm targets lowered only by bodyDrop while the torso is hinged 83 deg at the pelvis, identical dive and prone poses, a forward-leaning slide and a 4 deg damage twist; since 07-03 these clips replace the inherited mocap for every live action except roll and dance. (2) enemyAnimations.js _tickInertia writes bone quaternions after the mixer and three's PropertyMixer skips unchanged values, so bones on exactly constant tracks (crouch legs) keep the inertia blend forever. (3) firstPersonRig.js:265-266 moves the body view forward under the camera when looking down. (4) animationReview.js:158 has no prone eye height; prone/slide/dive/supersprint are Phase 5 previews with no game state.
fix: not applied (diagnose-only)
verification: n/a
files_changed: []
