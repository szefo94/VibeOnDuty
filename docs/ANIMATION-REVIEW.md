# Animation and model review

Original audit: 2026-09-09 against `dc27c6f`. The findings below describe that
pre-fix snapshot; the current working tree includes the following repairs.

## Fix status — 2026-09-09

All six findings have implementation changes and regression coverage:

1. Locomotion explicitly restores action state and clears obsolete fades. Aliases of
   the same action no longer fade through the bind pose; interrupted overrides are stopped.
2. Death clears the entire blend tree and additive layers before playing alone, for
   both teams. The player restarts breathing when alive again.
3. Player/enemy mounts now use the retargeted hand basis (+Y forward, +Z up). The
   pistol FBX is centered inside a separate canonical wrapper; enemy muzzle flashes
   attach at the weapon tip. In the sampled idle pose, weapon up changed from world
   Y **-0.099** to **0.990**, while forward remains **0.994** along character +Z.
4. `rifleClips.js` composes five armed crouch/jump clips at load, preserving original
   lower-body motion and maintaining the rifle torso orientation in character-root
   space. These are composed poses, not newly sourced mocap. The original GLB remains
   unchanged; dedicated rifle mocap is still an option for further animation polish.
5. Reload, throw, roll, and jump phases scale to gameplay durations. Resuming an
   interrupted player action starts at its elapsed gameplay phase. Grenades now release
   once at 45% of their 0.9-second throw window (about 0.405 s after the input), rather
   than immediately. Pending throws cancel on death/menu return. This deliberately
   changes grenade input-to-release timing. Third-person weapons hide while throwing,
   punching, or dancing.
6. `characterResources.js` frees per-instance geometry, owned/tinted materials,
   skeleton textures, mixer bindings, and helper references while preserving template
   geometry. Despawn, death cleanup, and deactivation use it. In the repeated-removal
   diagnostic, counts now stay at **2 shared geometries / 0 textures** after every
   removal, instead of growing by 5 geometries / 2 textures per instance.

Validation: **86 unit tests (10 files), 17 browser tests (3 files), lint, typecheck,
and production build passed**. New tests include the real GLB poses, interrupted
shooting, both teams' deaths, all enemy weapon roles, shared-geometry preservation,
procedural cleanup, grenade release/cancellation, and live player action time scales.
The existing bundle-size warning and headless pointer-lock messages remain.

Final close-ups confirm upright weapons and raised armed movement poses. Finger
placement and support-hand contact still need visual polish, particularly where the
shared rifle pose is used with different weapon shapes; these fixes do not add hand IK.

[Updated pose sheet](../test-results/animation-fixes/pose-atlas.png) ·
[Weapon close-ups](../test-results/animation-fixes/weapon-closeups.png) ·
[Updated diagnostics](../test-results/animation-fixes/diagnostics.json)

The original audit and evidence follow for comparison.

## Findings, in recommended repair order

### 1. High: returning to locomotion can leave the character without a base animation

Source: [enemyAnimations.js](../src/builders/enemyAnimations.js), `_applyLocoWeight`
(lines 152–161), `_enterLocoMode`, and the attack/shoot override selection.

Reproduced in Chromium with the real GLB and `tickEnemyAnimation`: stationary attack,
five shooting frames, then stationary patrol for 40 frames. The controller reports
`currentClip: idle`, but the idle action has `enabled: false`, `weight: 1`, and
effective weight **0**. No scheduled base action contributes nonzero effective weight
(unplayed actions still have their default weight fields). This allows the bind pose,
modified only by additive animation, to show through.

`idle` and `attack` alias the same AnimationAction. A fade scheduled when leaving
attack for shoot survives the return to locomotion. `_applyLocoWeight()` calls
`play()` and writes weights, but that does not cancel the fade or re-enable a disabled
action in the installed Three.js version. A later mixer update overrides those writes.

Repair direction: explicitly restore enabled/unpaused action state and cancel obsolete
fades when the locomotion controller takes ownership. Add a regression that advances
the mixer through the whole transition and checks actual effective weights.

### 2. High: moving bots keep locomotion blended into their death animation

Source: [enemies.js](../src/entities/enemies.js), `killEnemy()` calls at lines 213/231.

Both friendly and hostile deaths call `crossfade(e, 'death', 0)` without leaving the
locomotion blend tree. During locomotion `currentClip` is `idle`, even when walk/run
actually carries the weight, so crossfade only fades the idle action.

Reproduced with a walking GLB actor and the real friendly `killEnemy()` path: after
0.8 seconds, **walk effective weight = 1 and death effective weight = 1**. The dying
list continues updating this mixer, producing a mixture of walking and falling.

Repair direction: leave locomotion and clear unrelated action weights before death;
also decide which additive layers should remain active. Cover walk/run/strafe deaths
and both team branches, rather than only death from idle.

### 3. Medium: weapon mounting no longer matches the retargeted hand basis

Source: [weapon3pTransform.js](../src/builders/weapon3pTransform.js), lines 6–26;
[enemyWeapon.js](../src/builders/enemyWeapon.js), lines 132–146.

The player mount assumes hand-local +X points upward. In the current rifle idle pose
at 0.3 seconds, that axis points approximately world **(-0.994, -0.099, 0.039)**.
The resulting weapon points forward correctly, but its up axis points almost sideways.
The screenshot sheet also shows the player weapon sitting below the gripping fingers.

Enemy mounts use the opposite roll around the barrel, through an independent transform.
Consequently, copying the player's current transform to enemies would not establish
correct alignment. Existing mount tests encode the older hand-basis assumption and
do not evaluate the loaded, posed GLB hand.

Repair direction: recalibrate grip and rotation against the current rifle pose, check
scope/magazine orientation, and verify all four weapons on player and enemy models.
Then share only the conventions that truly agree. Include at least one test against
the actual asset pose, plus visual checks from front, side, and third person.

### 4. Medium: crouch and jump actions are not weapon-holding animations

Source: [enemyGLTF.js](../src/builders/enemyGLTF.js), `ALIASES` lines 39–49;
[retarget.py](../tools/retarget.py), source clip mapping.

The pose sheet visibly shows crouch/crouch-walk with arms down and the rifle pointing
toward the floor; jump actions spread the arms while the rifle remains attached to one
hand. These aliases still use the original mannequin actions, which were authored
without the rifle. This is an authored-pose mismatch, not evidence that the old
global +/-90-degree correction should return.

Repair direction: source rifle-ready crouch and jump clips, retarget through the existing
pipeline, and update aliases. A deliberate upper-body aiming system is another design
option, but the removed corrective arm graft should not be reinstated as a shortcut.

### 5. Medium: gameplay timers and animation lengths disagree

Source: [config.js](../src/config.js), weapon reload values and `ROLL_ANIM_DUR`;
[grenades.js](../src/entities/grenades.js), lines 22–23;
[loop.js](../src/loop.js), action selection lines 155–166.

| Action | Actual clip duration | Controller duration | Result |
| --- | --- | --- | --- |
| Reload | 3.333 s | 1.2–2.5 s by weapon | Reload pose is interrupted before its end |
| Grenade throw | 3.233 s | 0.9 s | Throw animation is cut short |
| Roll | 0.933 s | 1.467 s | Completed LoopOnce pose can remain frozen for about 0.53 s |

The controller does not adjust action time scales to these durations. The grenade
projectile is also created immediately, so its release is not synchronized to a clip
event. Repair direction: define the intended timing per action and either scale/trim
clips to gameplay or synchronize gameplay events to animation markers.

### 6. Medium: character removal leaves per-instance GPU allocations behind

Source: [enemyGLTF.js](../src/builders/enemyGLTF.js), `disposeEnemyMaterials()` at
lines 473–481; removal callers in [enemyUpdate.js](../src/entities/enemyUpdate.js)
and [enemies.js](../src/entities/enemies.js).

An isolated browser renderer repeatedly built, rendered, removed, and cleaned up six
assault characters using the production builder/disposal functions. After the first
instance initialized shared geometry, each further cycle retained **5 geometries and
2 textures**. Final renderer counters were 32 geometries / 12 textures with no
characters left in that inspection scene.

Cleanup currently disposes only tinted materials. Instance-created weapon/muzzle
geometry and skeleton bone textures need ownership-aware disposal. Shared GLB geometry
and shared materials must remain available to other live characters. This demonstrates
allocation accumulation, not a measured frame-rate degradation threshold.

## What worked and what was checked

- Actual browser GLB loading, P90 FBX loading, and pistol FBX loading succeeded.
- All gameplay aliases resolved. The GLB contains 65 skin joints and 48 clips; 12
  extra `Armature.001|mixamo.com|Layer0*` actions are not gameplay aliases. Older
  documentation describes an earlier 36-clip export.
- The loader stripped 6,204 inert tracks and retained 3,156 live tracks. Independent
  clip playback produced recognizable locomotion, reactions, death, and other poses.
- Inspected a 24-panel sheet: 21 player action samples with the third-person AWP,
  plus assault/sniper/pistol enemy idle samples. These are controlled samples, not
  proof that every frame and transition is visually correct.
- The unchanged source's earlier baseline passed 72 unit tests and 12 browser tests,
  plus lint, typecheck, and build. The diagnostics above exercise gaps in that coverage;
  this review did not rerun the entire unchanged suite.
- Headless browser logs included the known pointer-lock error. No unrelated uncaught
  error appeared in the visual capture. First-person weapon feel, every fallback path,
  prolonged match performance, and Blender export reproducibility were not fully
  validated by this review.

Local review artifacts (ignored by Git and potentially cleared by future test runs):

- [Pose sheet](../test-results/animation-review/pose-atlas.png)
- [Third-person gameplay capture](../test-results/animation-review/game-third-person.png)
- [Reproducible browser diagnostics](../test-results/animation-review/diagnostics.mjs)
- [Diagnostic results](../test-results/animation-review/diagnostics.json)
- [Pose capture script](../test-results/animation-review/inspect.mjs)
- [Pose metrics](../test-results/animation-review/pose-metrics.json)
