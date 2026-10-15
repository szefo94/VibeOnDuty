# Animation and model review

## Qualification state — 2026-10-11

Automated qualification of Phase 7 motion is complete. Human review has not happened.
The section below this one (2026-10-07) describes an earlier, partial state and is kept
as history; where the two differ, this section is current.

The qualification path, in the order it has to run:

1. **Stable gates.** `node tools/art/stable-gates.mjs run --gates all` runs lint, both
   typechecks, build, units, the offline browser suite and the production multiplayer
   suite one after another; `node tools/art/stable-gates.mjs check` reads the record back.
   Record: phase 07 `evidence/07-10-stable-gates.json`, all seven gates at exit 0 (323
   unit tests in 31 files, 138 offline browser tests, 18 multiplayer tests). The offline
   gate passed on the second of two full runs; the first failed one case (the first test
   timed out while the game was loading, cause not diagnosed) and stays on record.
2. **Timing gate.** The frozen source-eye V2 command still decides the original absolute
   limits, and they were **not met**: exit 1 on both evaluations at the final source
   identity (40, then 21 of 192 statistics over). The owner approved a second route, the
   paired same-session gate (`07-09-PAIRED-AMENDMENT-DECISION.md`, contract
   `07-09-PAIRED-AMENDMENT-V2.md`): `node tools/art/review.mjs --animation-paired`
   registers and runs sessions, `node tools/art/animation-budget-paired.mjs` verifies and
   judges them. Result in `evidence/07-18-timing-result.json`: passed, session 1 of 1;
   0 valid sessions failed; 0 invalid (one calibration, one qualifying session).
3. **Plan 09 record.** `evidence/07-09-qualification.json`, `complete: true`,
   `timingGate: paired-same-session`, `applicableBudgetPass: false`.
4. **Strict capture.** `node tools/art/review.mjs --animation-capture` exited 0 on
   2026-10-11: one unspliced run of 36 minutes with 45 current weapon, view and tier
   rows, nine labeled previews, three blocked-gait, three shared-movement and three
   offline combat unions (natural damage, death, respawn and menu return), and a
   two-client online M4 union on Low, Medium and High with reload, death and a fresh
   life. Report `evidence/07-motion-review.json`, status
   `automated-qualified-human-pending`. This was the second full capture; the first
   (2026-10-10) was partial because the collector's own online route did not reach its
   third waypoint, and it is kept as `evidence/07-motion-review-partial-2026-10-10.json`.
   The collector's route was then changed and independently reviewed (plan 07-26). In the
   qualifying run the online legs recorded 0 samples outside the lane and one back-off;
   the collector does not judge the lane itself, so read
   `online.samples[*].legs[].outsideLaneSamples` in any later report.

The playable index is phase 07 `evidence/07-motion-review-index.html`
(`.planning/phases/07-movement-matched-and-action-safe-animation/evidence/`). It lists the
qualifying capture first and every earlier attempt as historical. Its movies live in the
gitignored cache on the capturing machine.

What a paired pass means, in the contract's words: in one software-rendered session on
this host, in the offline Training Range workload, the five owner files as they are now
did not cost more than the same five files at the freeze (`c973458`), within 5% typically
and 25% in any single profile for the frame interval, and within about one timer tick for
the small script components; and every structural check of the frozen gate still passed.
What it does not mean: that the original fixed limits were met; any frame rate,
representative device or human acceptance; anything about the first-person view's cost
(it is in both arms and cancels), Phase 7 as a whole, files outside the five owner files,
online play or another workload; anything about a real GPU or another host. Available and
not run: the exact frozen source can be rebuilt byte for byte and captured on today's
host.

All timing here is software-rendered headless Chromium on one desktop under the Balanced
power plan, with Discord and Steam running during the timing sessions. It is not device
or FPS certification.

What the human review must cover (a person, in their own words, recorded separately from
every automated record with the source and export identities reviewed): restrained weapon
and camera motion with steady ADS; real first-person arms, hands, torso and legs with
credible hand contact; physical magazine and bolt handling fitted to reload time for M4,
P90, AWP and pistol; a short ADS raise and lower with no bounce; planted turns and stops
with feet matching speed; the lowered two-handed sprint carry; compact jump, landing and
recovery; torso-led small turns and foot repositioning on larger ones; melee and throw
taking priority with no overlap, duplicate release or ammo award; a short directional
death collapse that settles; the natural offline death and respawn; and the two-client
online reload, death and fresh life. One-handed supersprint, slide, dive, prone, reload
x1.15 and supersprint cancellation are labeled previews only and belong to Phase 5. No
agent can record this verdict; it is pending.

Also open: inherited rig, motion and weapon FBX terms; representative-device frame rate;
review finding G-01 (the CI step running `npm run test:art` cannot pass on a fresh
checkout and must be fixed before any push).

## Current moving collection and qualification — 2026-10-07

`node tools/art/review.mjs --animation-capture` owns a free loopback root-base
listener, browser contexts and full-pixel continuous WebM. It records all four
offline weapons, P90 loaded-inspection/fallback behavior, first/down/third views
and Low/Medium/High, using normal offline input and simulation/render clocks.
Separately isolated future preview movies keep visible Preview — / Phase5 text
while the control panel is hidden. Supported production M4 observations use the
existing isolated dedicated-server fixture; server authority is never frozen.
The matrix is a required collection target; current coverage is partial. Actual
retained coverage and exact hashes are in phase07 `evidence/07-motion-review.json`.
Its local `index.html` links directly to movies and the full report.

At the current `d7812cb` runtime identity, full units passed323/323. The actual full
offline command failed with125/127 passes and two throw setup timeouts; its focused
follow-up also failed before those assertions. Full production multiplayer failed
with5/17 passes. No host cause or runtime correction was established by the bounded
transport observations. A fresh214-frame Low/one V2 smoke retained3 PNGs and9/16
over-bound statistics; the actual acceptance CLI rejected its incomplete report.
These facts remain open gates. Separate short captured segments and recovery
success do not qualify the full suites or the required twelve-profile V2 matrix.

For collector diagnosis, `--animation-capture --tracer` records one Low/M4 view,
shared gait, labeled preview and legally earned combat union. `--combat-probe`
limits collection to one Low combat context, proving accepted ordinary mouse aim
against a visible target before waiting for energy. Both modes save separate
partial reports and retain the same strict final acceptance failure. They never
count as the full moving matrix. The first corrected tracer retained two sealed
movies but did not earn grenade eligibility; its input driver is not an accepted
combat proof. Exact historical attempts remain in separate evidence records.
The subsequent bounded tracer proved accepted native mouse aim, earned100 energy,
throw cancellation/consumption and natural damage, then retained hp54.6/alive at
the unchanged death-wait deadline. It supplies partial combat evidence. The
explicit `--independent-matrix` option collects other weapon/view/tier movies and
supported online observations without retrying that missing shared union. Its
report records the omission and retains the original full acceptance predicates.

For human running-game review: start Vite on an owned free port, enter the enabled
Training Range, press F3, choose Open animation review, select weapon/view/
transition and Play. Close review → Resume returns input capture. Inspect the
moving hands/parts, anatomy/view continuity, feet/turns, ADS settle, interruption
and directional stable death. Record the human's exact words against current
source/export hashes separately. Agent metrics/pixels never supply that verdict.

The accepted GLB has 107 occurrences: 48 inherited plus 59 original donor actions.
Current candidate art recovery independently reopens saved art and preserves
all 107 while demonstrating bounded visible edits and exact restoration.
[Creator instructions](ART.md#current-motion-creator-and-recovery-path--2026-10-07)
describe donor append/import/retarget/action slots/bone mapping and commands.
Separate original authorship does not clear inherited rig/motion/FBX rights.

Collection success is separate from acceptance. The CLI executes applicable
frozen source-eye V2 against actual current-source evidence and requires plan09
to be complete/non-halted, with both outstanding executed browser assertions.
Missing/stale/halted/unqualified09, incomplete footage and failed fixed limits
exit nonzero while preserving partial artifacts. No old budget substitutes for V2.
SwiftShader texture reduction is not a timing pass, hardware/FPS certification
or human smoothness acceptance. Phase5 owns actual Shift/double-tap supersprint,
movement/stamina/input, live base×1.15 timing, supersprint cancellation and ANIM-01.
Older sections below are historical observations at their recorded identities.

The final fresh attempt retained42 completed current contexts, nine labeled
preview rows, all three gait unions and partial movies from three online tiers.
One separate instrumented Low/P90-fallback recovery retained the missing three
views with a real404 response, stable observer ownership and no later navigation.
The earlier observer-loss/loading-menu cause remains unproven. These attempts
stay separately identified; `07-motion-review-index.html` links all movies and
their exact reports. They cover45 independent weapon/view/tier combinations,
while the full matrix remains unqualified because shared death/respawn and
online routes are incomplete. Low online failed to reach(34,22); Medium/High
failed to reach(62,46). No failed full-suite/V2 predicate is waived.

## Phase 7 pre-tuning moving baseline — 2026-10-05

The current accepted soldier now has two independently loaded moving Training Range
measurement runs, at Low/Medium/High with one and eight actual cloned assault actors.
The ordinary enabled Range entry loads the shipped GLB and packed maps. The controlled
offline fixture holds its gameplay loop and advances current ready, forward/backward,
strafe, run, crouch, jump/landing and reload transitions through the existing animation
helpers. Roots stay fixed: these samples measure animation and rendering, not input,
collision, combat or movement-matched foot contact. Current hand/weapon limitations
remain visible; no new first-person hands or physical reloads are asserted here.

Run these gates sequentially:

```powershell
npm run test:e2e -- tests/animation-baseline.spec.js --workers=1
node tools/art/review.mjs --animation-baseline
node tools/art/review.mjs --animation-budget
```

The full baseline took **991.331 seconds**. Each profile contains 214 timed frames
with a 50ms simulation step, native animation-frame pacing, synchronous GPU completion,
12 warmup frames and eight deterministic clone/retirement loops. A separate 214-frame
1280×960 PNG playback preserves full-pixel continuous motion; encoding is excluded from
measurement. Its relative paths and SHA256 identities are in the baseline report, while
the large media stays under the ignored owned cache. Future capture attempts use separate
directories. A failed/canceled attempt preserves existing reports and media and cannot
publish passing evidence. The fixture restores borrowed camera/visibility, releases
owned browsers/listeners, and demonstrates an unrelated HTTP listener survives failure.

The named device is **DESKTOP-NUH2KOI**, Windows 10.0.19045 x64, AMD Ryzen 5 5600,
Node 24.19.0 and Chromium 147.0.7727.15. WebGL is ANGLE Vulkan **SwiftShader**, with
1280×960 viewport and DPR 1 for every tier. These are software-rendering measurements;
they do not qualify a phone, integrated GPU, gaming GPU, Raspberry Pi or 60 FPS gameplay.
Browser timer quantization can report zero for short components. The first captured
scene retains the authored Range lighting rather than inventing a brighter review setup.

Canonical evidence:

- [Moving baseline](../.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-baseline.json): twelve profiles, renderer/device, source/export/provenance identities and full-pixel media references.
- [Pre-tuning budget](../.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-budget.json): six matched tier/count envelopes and exact retirement/resource decisions.

Baseline SHA256: `177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20`.
Published GLB SHA256: `3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`.

For each component/statistic, the upper bound is the larger repeat value plus its
absolute repeat dispersion. The JSON retains unrounded measurements. Candidate checks
must match device/browser/renderer, viewport/DPR, tier, actor count, transition clock and
warmup. The pre-tuning budget is immutable: `--animation-budget` rejects stale source,
truncated/nonfinite samples, missing/stale media and changed existing decisions.
Candidate overruns require optimization or a separately justified matched remeasurement;
do not silently widen the envelope or overwrite the canonical baseline with a candidate.

Recorded upper bounds in milliseconds; G/T/P are warmed geometry/texture/program counts:

| Tier | Actors | Frame median | Frame p95 | Mixer p95 | Inertia p95 | Selection p95 | Render p95 | G/T/P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Low | 1 | 185.900 | 198.100 | 0.300 | 0.100 | 0.100 | 1.700 | 75/59/10 |
| Low | 8 | 425.500 | 435.400 | 0.300 | 0.300 | 0.100 | 5.500 | 110/416/10 |
| Medium | 1 | 191.800 | 200.300 | 0.100 | 0.000 | 0.100 | 3.800 | 143/60/16 |
| Medium | 8 | 487.000 | 518.200 | 0.300 | 0.300 | 0.100 | 10.000 | 178/417/16 |
| High | 1 | 193.800 | 207.100 | 0.100 | 0.000 | 0.100 | 2.800 | 143/60/16 |
| High | 8 | 488.200 | 516.900 | 0.500 | 0.300 | 0.100 | 10.600 | 178/417/16 |

Frame intervals include native browser/compositor pacing. Selection is the existing
clip/weight bookkeeping, named `correctionMs` in JSON; it measures no new contact IK.
Render-call/GPU-finish time is recorded separately from total paced frame intervals.

Owned listeners, frame callbacks, props, scene actors and active mixer bindings return
to the measured zero baseline. A live keeper survives replacements without shared map
or geometry disposal; deterministic warmed clone loops plateau. The whole-scene exact
counts here apply to this seeded Range fixture. Randomized map rubble remains outside
exact whole-map geometry equality.

Torso/hand contact, planted turns, camera comfort, ADS settle and natural motion still
require current continuous moving review and explicit human acceptance. Phase 6's art
acceptance remains recorded separately. UI-SPEC bob/sway starting bounds are cosmetic
design prescriptions, separate from this cost envelope. Inherited asset terms are
unchanged by the measurements.

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
