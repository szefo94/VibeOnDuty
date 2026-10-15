---
verdict: approved
reviewer_model: opus
reviewer_effort: high
reviewed_commit: 2f69dfee6fd9b599ccb5aeff558fb348c070ed6a
enemy_gltf_sha256: 802b741465d7826b0bb656eb79a4dd46c8e50708bab870f5ee64f0c417d11781
enemy_animations_sha256: f150cb50bca967ef88b44817b746cace2787085c4fbb38e6d9cd277453992885
first_person_rig_sha256: c0db631c27b5e9da9ecc12905bb4ac46311c91675d3c7fa11200afcdf464acd1
reviewed: 2026-10-11T10:22:28Z
depth: deep
blockers: 0
warnings: 6
notes: 11
---

# Plan 07-33: independent review of the Phase 7 motion repair

Reviewed 2026-10-11 at commit `2f69dfee6fd9b599ccb5aeff558fb348c070ed6a`, by a reviewer (`opus`, effort
`high`) that wrote none of the change. Scope: `git diff e09bf9b..HEAD -- src tests` (12 files: three
source files, four new unit test files, one new browser spec, three edited browser files and the
reference-driver fixture), read in full, with the plans and summaries of 07-27, 07-28, 07-34 and 07-29,
both debug files and the owner's review record.

This record makes no judgement of how the motion looks. Where it gives a figure that bears on the look,
the figure is a measurement and the judgement is the owner's.

## Verdict

`approved`: I found nothing that must change in source, tests or the pinned baseline before the owner is
shown this build and before requalification. The three source files do what plans 07-27, 07-28 and 07-34
say, the driver diff is the inertia restore and nothing else, the unchanged resolvers return bit for bit
what they returned at `e09bf9b`, every new test fails on the earlier source for the reason it claims, and
the replaced reference-driver baseline is the old one plus exactly the driver's diff.

The approval carries six warnings. None is a defect of the code against its plan; each is a measured
property of the result that the summaries do not state, or state too mildly, and that the owner has to be
told before judging. Warning W-01 (feet under the floor in diagonal movement) is the one most likely to
be raised at the live check. The list for the owner is at the end.

## Identity

`git status --short -- src tests public server tools index.html style.css` was empty when the hashes were
taken and again before this file was committed.

| File | SHA-256 of the working-tree bytes (frontmatter) | SHA-256 of the git blob at the reviewed commit |
|---|---|---|
| `src/builders/enemyGLTF.js` | `802b741465d7826b0bb656eb79a4dd46c8e50708bab870f5ee64f0c417d11781` | `0ec8df349b06f0245b2e82fd8bb1b77cd13c134381f2d12c41256da9aee83ae8` |
| `src/builders/enemyAnimations.js` | `f150cb50bca967ef88b44817b746cace2787085c4fbb38e6d9cd277453992885` | `7bb03d4d8c13128506f6b98fdbbda813c1f2d42b4504e4da51645a4ecf0f0e58` |
| `src/builders/firstPersonRig.js` | `c0db631c27b5e9da9ecc12905bb4ac46311c91675d3c7fa11200afcdf464acd1` | the same |

The first two differ only in line endings: the blobs are LF, the working-tree files are mixed (434 of 737
and 439 of 700 lines end CR LF); with every carriage return removed the bytes are equal. See note N-01.

Also checked: `public/models/enemy.glb` `2a6bbab2…6e4e` and `tools/art/motion-manifest.json` `2b571250…60a5`
equal their blobs; `git diff e09bf9b..HEAD -- public server tools index.html style.css` is empty.

## What I ran

Node and Vitest only. No browser, no capture, no gate tool, no dev server. Nothing in the repository was
written except this file. Scratch probes are in the session scratchpad under `repair-review/` and are not
evidence of record; their figures below are labelled "reviewer probe".

- The nine unit test files of the repair and the five frozen ones: 176 of 176 passed (3 + 61 + 45 + 33 + 34).
- The repository's own test files against earlier source bytes served from git objects by a load hook
  (answer 7).
- Reviewer probes: every key of every composed clip; the driver over a scripted life of 28 states with a
  twin that never blends; a crouch press and release frame by frame; the five inputs of
  `tests/animation-resources.spec.js` against the old and the new fixture; the capture's transition list
  timed for two arms; diagonal movement; the look-down view by skinned vertices; melee and throw.

## The thirteen questions

### 1. Gameplay, network or authority state; new reads

No path of the three files writes gameplay, network or authority state.

- `src/builders/enemyGLTF.js:163-299` (`buildLiveClips`) reads the prepared clips, the manifest and the
  alias table, and writes bone transforms of two throw-away skeleton clones (`:166`) and the module's
  `_liveClips` WeakMap (`:147`, `:165`). `findLiveClip` (`:302-305`) reads that map.
- New reads: the inherited clips by alias (`inheritedClip`, `:150-156`); `copyPresentationMask` imported
  from the driver (`:18`, used at `:267`); in `_sharedHitAdditiveClip` (`:438-439`) the inherited `hit`
  and inherited idle where the authored `vod7_damage` and `vod7_m4_ready` were read before. That last one
  changes the damage layer of every character, as plan 07-27 intends.
- `src/builders/enemyAnimations.js`: the only new state is `e._inertiaHeld` on the presentation object
  (`:207`, `:226`), beside the existing `e._inertia`; for a bot that object is the enemy entity, as it
  already was. The only new read is `e._presentationCorrection` inside the inertia tick (`:234`). Bone
  quaternions are the only thing written (`:211`, `:235`).
- `src/builders/firstPersonRig.js:268-270` writes `rig.body.position` only, as before.
- New failure coupling, not a state write: `buildLiveClips` runs inside the `try` of `tryLoadEnemyGLTF`
  (`:525-540`, call at `:528`). See note N-04.

### 2. `findMotionClip`, `getMotionDefinition`, `prepareEnemyClips`; live call sites

They return what they returned at `e09bf9b`.

- `getMotionDefinition` (`enemyGLTF.js:76-81`) and `findMotionClip` (`:83-94`) have no changed line.
  `prepareEnemyClips` (`:504-514`) is unchanged; `normaliseClipQuatSigns` gained a second parameter whose
  default (`:333`) is the expression the body used before.
- Reviewer probe, both sources loaded side by side on the real GLB: `prepareEnemyClips` gives 112 clips
  with 4745 tracks, every name, duration, key time and value bit-identical; `findMotionClip` and
  `getMotionDefinition` agree for 77 keys times four weapons (308 lookups, none differs);
  `buildLiveClips` leaves the prepared set byte for byte as it found it.
- Every live call site is on `findLiveClip`: `buildEnemyMesh` (`:584`), `buildPlayerMesh` (`:679`),
  `createReviewCharacter` (`:731`). Remote online actors are built by `buildEnemyMesh`
  (`src/network/onlineSession.js:41-42`), bots by `src/entities/enemies.js:93` and `:155`.
- `findClip` remains at `:285` (sign reference), `:533` (a log line) and `:612`, `:692` (the idle length
  for a random start time; equal to the length of the live ready clip, which keeps the authored
  duration). None of these selects what is played.
- For all four bot roles the selected layers were read back (reviewer probe): idle, walk and crouch select
  `live_<weapon>_ready_lower`, `live_walk_forward_lower`, `live_crouch_idle_lower`, each with 10 tracks.

### 3. Is the composition correct

Yes, with three qualifications (full extension, knee plane, the first authored pelvis key).

- Ankle and foot. Each leg is solved from the moved hip to the inherited ankle (`:208-231`), the foot
  takes the inherited orientation in the character frame (`:229-230`), the ball its inherited local
  rotation. Reviewer probe at every key of all 25 composed clips (not 12 phases): largest ankle distance
  0.0193 m (`live_walk_left`, `live_run_left`; limit 0.03), 0.0092 m in `live_jump_land`, at most 0.0026 m
  elsewhere; foot orientation against the inherited clip 0.000 degrees everywhere.
- Full extension. Stated in the code (`:209-210`) and applied at `:214`: the reach is capped 1e-4 m short
  of the summed bone lengths and the leg points at the ankle. Keys on which a leg is that straight:
  `strafe_l` 3, `strafe_r` 3, `run_back` 1, `jump_start` 1, `jump_land` 10. `07-27-SUMMARY.md` calls
  `strafe_l` "the one place where the leg cannot reach"; at key resolution there are three more clips
  (note N-02).
- Knee plane. The bend direction is the inherited one projected perpendicular to the new hip to ankle
  axis (`:218-221`). It is the inherited plane only approximately: against the inherited bend direction
  the composed one is turned by up to 8.4 degrees in the gaits, 13.9 in the jump clips and 37.1 in the
  crouch clips, where plan 07-34 moved the hips 0.23 m. No knee changes side at any key. See note N-03.
- Idle legs. Held clips are built from one sample with two equal keys (`:243-244`, `:264-265`); all ten
  lower tracks of the eight held clips are exactly constant (repository test, and the probe).
- Key times and durations. Lower keys sit at the inherited key times scaled to the clip length (`:265`);
  the length is the inherited one, or the authored one for held clips and sprint (`:262`). Probe: 23 to 57
  keys per clip, 2 for held clips.
- Sign continuity. No pair of consecutive keys of any quaternion track of any composed clip has a
  negative dot product (25 clips, 22 tracks each); no non-unit or non-finite value. The jump chain is
  aligned at `:287-297` and asserted by `liveClipRoute.test.js:579-593`.
- Upper tracks. Copied from the authored clip (`:267`) with times scaled (`:269-270`). Probe: every value
  identical (largest difference 0), times within 6e-8 s of the scaled authored times.
- The authored pelvis orientation is taken from the first key only (`:261`). All 25 authored pelvis
  tracks are constant (largest turn from key 0: 0.000 degrees), so nothing is lost today.

### 4. Is the route complete for what live play can select

Yes for every lower-body key the driver can select.

- The driver selects, for the lower layer, `jump_start`, `jump_loop`, `jump_land`, `turn_left`,
  `turn_right`, `stop`, `reversal`, the twelve `walk_`, `run_` and `crouch_` directions, `crouch_idle` and
  `<weapon>_ready` (`enemyAnimations.js:520-525`, `src/builders/animationPresentation.js:82`, `:93-94`,
  `:112`, `:118-121`). All 25 are in `LIVE_ROUTE` (`enemyGLTF.js:126-141`). Deaths select
  `death_<variant>` (`enemyAnimations.js:513-514`), all four in `LIVE_WHOLE` (`enemyGLTF.js:144-145`).
- Upper layers take only the upper mask (`enemyAnimations.js:526-528`), so the authored legs of the ADS,
  fire and reload clips are never selected.
- A key can fall through to authored legs in two ways. (a) By the plan's decision: `throw`,
  `melee_cross`, `melee_jab` play the whole authored clip (`enemyAnimations.js:516-518`), with the
  authored standing legs and no pelvis position; see W-04 for what that does in play. (b) Silently: if a
  composition is skipped (`enemyGLTF.js:168`, `:242`) `findLiveClip` returns the authored clip (`:304`)
  with no log line. On the shipped asset no composition is skipped
  (`liveClipRoute.test.js:473-527` asserts all 25 and the exact key set); note N-04.

### 5. The driver diff and the inertia restore

The diff is confined to the restore: `_restoreInertia` (`enemyAnimations.js:206-212`), the rewritten
`_tickInertia` (`:214-239`), one call before `stopAllAction` on death (`:302`), one call and a clear at
retirement (`:465`), and one call with its comment in `tickPresentation` (`:537-538`). Nothing that
selects an action or a mask changed.

Order, per caller:

- Local player (`src/loop.js:83`, `:130-140`, `:157-160`): weapon-handling restore, then in
  `tickPresentation` handling restore (`:472`), correction restore (`:493`), transition snapshot (`:536`),
  inertia restore (`:538`); in `finishPresentation` correction restore (`:563`), mixer (`:565`),
  correction (`:567`), inertia (`:569`), handling (`:571`). The snapshot is taken before the restore, so
  it still reads the pose that was shown.
- Bots and remote actors (`enemyAnimations.js:691`, `src/network/remoteActors.js:140`): the same through
  `tickPresentation` with the mixer.
- A frame that only finishes (the loop while paused, `src/loop.js:157-158`) and the exported
  `tickInertia`: the restore runs at the start of the inertia tick (`:218`), after the mixer. A bone the
  mixer rewrote no longer equals the remembered blend and is left alone (`:211`).
- A bone the correction turned: the value kept is the one saved before the correction (`:234`).
- Reset (`:494`), death (`:515`, `:302`), retirement (`:465`), expiry (`:222`): the restore has run, or
  runs at `:538`, before the mixer value is relied on. The review panel cancels the blend itself
  (`src/dev/animationReview.js:147`) and stops all actions first (`:139`), which rewrites every bound
  bone; the pending restore is dropped at `:216`.

Stale values. Reviewer probe: two actors given identical input over 28 states (crouch with pitch and an
aim offset, crouch walk, strafe, sprint, stop, turn, jump, landing, reload, three weapon switches, 30
frames that only finish, death during a crouch, alive again, a teleport reset, damage, melee, throw), one
blending and one with the blend cancelled every frame. After every state of 100 frames the largest
difference of any bone is below 1e-4 degrees, with composed and with authored clips. The same probe on
the driver of `e09bf9b` leaves bones 7 to 94 degrees off for the rest of the run. I found no way to leave
a stale value on a track that is not constant: the mixer writes such a bone every frame and the restore
then skips it.

Work added. While no blend runs: two property reads per actor and frame (`:208`, `:216`). While a blend
runs (about 0.42 s after each transition): per bone one `equals` and at most one copy in the restore, one
Map lookup and two copies in the tick; two quaternions per bone are allocated once per skeleton
(`:224-229`), none per frame. Reviewer probe in Node over the capture's 214 frames: the inertia tick costs
7.0 against 5.5 microseconds per frame for one actor and 57 against 43 for eight (about 30 percent more).
See W-06.

### 6. Is the look-down change confined to the body view

Yes. `git diff e09bf9b..HEAD -- src/builders/firstPersonRig.js` is one expression and its comment
(`firstPersonRig.js:261-270`; the expression at `:269`). The value is added to `rig.body.position` only
(`:270`). The arms view (`:273-287`), the view weapon (`:290-304`) and the source are untouched.
`firstPersonLookDown.test.js:212-224` asserts on 520 samples that the source, the camera, the arms view
and the body view's rotation and scale do not move.

### 7. Do the new tests fail on the old source for the reason they claim

Yes. I re-ran the repository's own test files against earlier bytes of one source file at a time:

| Source replaced | Test file | Result | First failing assertion |
|---|---|---|---|
| driver of `e09bf9b` | `presentationInertia.test.js` | 3 of 3 fail | `thigh_l after 90 frames: expected 41.2 to be less than or equal to 0.5` |
| view rig of `e09bf9b` | `firstPersonLookDown.test.js` | 8 of 45 fail | `pitch -0.40: expected 0.027 to be greater than or equal to 0.1` |
| `enemyGLTF.js` of `fe3117b` (before 07-34) | `firstPersonContact.test.js` | 14 of 33 fail | support hand over 0.005 m in crouch |
| the same | `liveClipRoute.test.js` | 9 of 61 fail | the eight held-pelvis cases and the composition case |
| the same | `firstPersonLookDown.test.js` | 1 of 45 fails | the crouched chest position |
| `enemyGLTF.js` of `e09bf9b` | `liveClipRoute.test.js` | 37 of 61 fail | route, poses, death and damage; the 24 that pass are controls and invariants |

These counts equal the summaries' records.

Limits. `liveClipRoute.test.js:22-36` holds the numbers of plan 07-27's "Guard limits" (3.5, 6.3, 2.5,
3.5 degrees; 0.06, 0.55, 0.85, 0.03, 0.03, 0.05, -0.03, -0.02, -0.12, 0.12 m; 30 degrees and factor 5;
1e-6 twice), with two differences on record: the crouch knee limit is 0.12 instead of 0.15 (answer 13),
and the idle control uses the browser test's bone criterion (`:35`, `07-27-SUMMARY.md` deviation 2).
`firstPersonLookDown.test.js:22-27` equals plan 07-28 (0.10, 0.60, -0.18 within 0.001, 0.03 per 0.05 rad).
`firstPersonContact.test.js:31-36` and `liveClipRoute.test.js:40-44` equal plan 07-34 (0.005, 0.005, 0.10;
0.001, 0.001, 0.02).

Controls. Each asserts a violation and each ran: the whole inherited idle moves a foot
(`liveClipRoute.test.js:288-300`), the mask swap turns the weapon (`:304-312`, `:752-761`), the authored
clips miss knee, foot, pelvis and death limits (`:314-319`, `:746-750`, `:763-767`), the composition
without the leg solve lifts a foot (`:321-339`), the withdrawn offset puts the eye behind the chest
(`firstPersonLookDown.test.js:226-235`), the inherited pelvis position leaves the support hand short
(`firstPersonContact.test.js:209-223`, `:412-427`).

### 8. The replaced reference-driver fixture

- Its diff is exactly the driver's inertia restore. Checked mechanically: the 37 added and removed lines
  of `git diff e09bf9b..HEAD -- tests/fixtures/enemyAnimations.uncached.js` are, as a multiset after
  trimming, the 37 of the driver's diff; neither holds a line the other lacks. In the fixture the
  retirement call sits in its inline disposer (`:460`), the others at `:206-239`, `:302`, `:516-517`.
- The pin is the hash of those bytes: `tests/animation-resources.spec.js:9` holds
  `61db86321fb6d179d643e74d9b2797a463e1f6c9eabed215b37d74a918239f67`, the SHA-256 of the fixture, which
  is LF in the working tree and in the blob. The fixture at `e09bf9b` hashes to `8217f32f…aee0`, the
  bytes of the driver at `c973458`, which the paired gate's reference arm reads from git and which is
  untouched.
- The spec differs from `e09bf9b` in that one line. No other expectation of the file changed.
- Why `matched` was false, which `07-29-SUMMARY.md` leaves open: reviewer probe in Node with the same
  five inputs. Against the fixture of `e09bf9b` inputs 2 and 3 differ and 0, 1 and 4 match, as in the
  browser; the selected layers are equal at all five; 13 bones differ (`root`, `spine_03` and eleven
  finger bones), each by less than 0.001 degrees and not bit for bit. They are bones the mixer does not
  rewrite on those frames, left with the rounding of the first blend. Against the fixture at HEAD all
  five inputs match bit for bit. The probe has no weapon mount, so the browser's set of bones may differ.
- Other tests. No existing unit test file changed; the five frozen ones pass. Within the repair's own
  tests one limit was loosened (answer 13) and one pose expectation followed the changed pose
  (`firstPersonLookDown.test.js:177`). `tests/animation-motion-source.spec.js` now proves less about the
  product than it did (note N-08).

### 9. Do the summaries say plainly what the repair is and gives up

Mostly. Stated, in `07-27-SUMMARY.md` "What live play shows now, and what was given up" and superseded for
crouch and jump by `07-34-SUMMARY.md`: a composition, not the pre-Phase-7 look; still idle legs; upright
torso; the crouched head 1.12 m high against an eye at 0.85 m; unresolved terms; idle legs for stop,
reversal and turns; one death; one crouch walk for every crouch direction; damage weight and duration
left as built.

Not stated, or stated too mildly:

- Diagonal movement was never measured (W-01).
- What is left of the torso in the look-down view (W-02).
- The size of the crouch transient and its counterpart on standing up (W-03).
- That a melee or a throw in live play steps the hips (W-04).
- Any figure for foot sliding (W-05).
- `07-27-SUMMARY.md` still carries "0.225 m behind the root" in its opening section; `07-34-SUMMARY.md`
  supersedes it and says so. `07-29-SUMMARY.md` prints crouch figures from before plan 07-34 and says so.

### 10. Track counts, cost of composing, and the paired gate

Track counts of the selected layers (reviewer probe, equal to `07-27-SUMMARY.md`): standing, walk and run
lower 9 before and 10 after (the added track is `pelvis.position`); crouch and jump start and land 10 and
10; upper 12 and 12 everywhere. Keys in the lower layer: forward walk 491 before and 420 after, crouch
idle 30 and 570, jump loop 195 and 490, standing 27 and 20. The whole death has 66 tracks where the
authored one had 22; the damage additive 66 where it had 21.

Composing at load: 22.9 to 27.0 ms per call in Node on this host over 12 calls (25 composed clips, 79,456
floats), beside 12 to 16 ms for `prepareEnemyClips`. Once per load, before any timed frame. Not measured
in a browser.

Script cost over the capture's own transition list (`tools/art/review.mjs:448-451`), 214 frames at 1/20 s,
medians over 32 repetitions, Node, microseconds per frame for eight actors:

| Arm | Mixer | Inertia | Selection |
|---|---|---|---|
| driver bytes of `c973458` with authored clips (a proxy for the reference arm) | 36 | 43 | 166 |
| current driver with composed clips (candidate) | 35 | 57 | 72 |
| current driver with authored clips | 33 | 56 | 72 |

Reading. Mixer cost is unchanged within noise, so the "animated instead of constant leg tracks" risk that
`07-31-PLAN.md:51` names does not show in this proxy. The inertia tick costs about 30 percent more while a
blend runs, and a blend runs in more than half of the capture's frames. Against a timer step of 0.1 ms
both arms are below one step; the candidate's inertia median may move from 0 to one step in eight-actor
profiles, which rule 1 allows and no more (`07-09-PAIRED-AMENDMENT-V2.md` section 4). A failure on mixer,
inertia or selection is unlikely. That risk is stated in `07-31-PLAN.md:51`. Not stated anywhere, and not
measurable here: W-06.

### 11. The look-down body view

The offset removes the cause of H-13. With the withdrawn term the standing chest plate is in the middle
of the view from pitch -0.8 downwards; with the committed one the eye is 0.18 to 0.29 m in front of
`spine_03` at every pitch, standing and crouched (`firstPersonLookDown.test.js:180-188`, re-run here).

What it costs, which only the owner can weigh. Reviewer probe, skinned vertices of the body view's named
meshes projected through a 75 degree camera, settled pose:

| Stance, pitch (rad) | Committed offset | Withdrawn offset |
|---|---|---|
| standing, 0 and -0.4 | nothing of the body in view | nothing |
| standing, -0.8 | a sliver of the left boot toe at the bottom edge | chest, lower chest, both knees, left toe |
| standing, -1.1 | left knee and left toe; no chest | everything |
| standing, -1.3 | both knees and toes; 44 percent of the chest plate, in the bottom 8 percent of the screen height | everything, chest in the upper half |
| standing, -1.38 | both knees and toes; 81 percent of the chest plate, in the bottom 15 percent of the screen height | everything |
| crouched, -0.8 | left knee, half the left toe | lower chest, both knees, left toe |
| crouched, -1.3 and -1.38 | both knees and the left toe; no chest at any pitch; no right toe | both toes and the right knee; the left knee out of view |

So standing, legs appear from roughly -1.0 rad and the torso only close to the pitch limit, as a strip at
the bottom; crouched, no torso is in view at any pitch. CONTEXT D-02 asks for "torso and legs when looking
down". Plan 07-33 tells the owner "you now see your chest front, knees and feet"; that holds only at the
steepest pitches (W-02).

The edit of `tests/first-person-rig.spec.js` is what plan 07-29 allows and no more: one statement
(`:223`), the observation stored (`:231-233`), the settling loop for the first crouched sample (`:235-240`,
at least 10 and at most 40 ticks of 0.05 s, failing otherwise), `settleTicks` returned (`:267`), and the
stance split (`:277-282`). The standing predicate is the old text with `&&!s.crouching` added to its
filter. The crouched predicate keeps `floorDelta` for all four joints and asserts `calf_l`, `calf_r` and
`foot_l` 0.1 inside the edge; the comment names `foot_r` and its measured -1.708. The contact limit at
`:273` is unchanged. The added `stopAllAction` makes the crouched samples a real crouch where they were an
average of two layers, which is stricter.

Does it hide a loss of D-02? Not by itself: the spec never asserted that any torso is on screen, only that
the meshes exist (`:276`). That is the gap: no test would fail if the torso left the view altogether.

### 12. The crouch transient

It exists, it is larger than the plan's text suggests, and it has a counterpart on standing up. The pelvis
position is a vector track and is not blended; the leg rotations are (`enemyAnimations.js:230-237`).

Reviewer probe, the builder's actor through the driver, root fixed, lowest ankle or ball against the root
plane:

| | First frame | Back within 0.03 m of the floor after |
|---|---|---|
| crouch pressed, 60 frames per second | 0.368 m below | 0.18 s (11 frames) |
| crouch pressed, 20 frames per second | 0.306 m below | 0.15 s |
| crouch released, 60 frames per second | 0.386 m above the standing height | within 0.08 m after 0.12 s |

Visible in third person: for a bot or a remote player, 11 frames with the feet up to 0.37 m under the
floor, then 7 frames hovering. Whether it is noticed I cannot say.

Before the repair it was worse and permanent: the driver of `e09bf9b` with the authored clips keeps the
feet 0.305 m below the root for as long as the crouch lasts (the frozen-blend defect; the debug session
measured 0.21 m in the browser). Before Phase 7 whole clips were crossfaded, positions included.

For the local player there is a larger effect outside the three files, read from source and not
reproduced: `src/loop.js:105-106` places the body root at the eye minus the crouched eye height from the
first crouched frame, while the eye is still at standing height and falls (`src/entities/player.js:286-289`),
so the root starts 0.8 m above the floor; on release the eye rises smoothly (`player.js:292`) and the root
starts 0.8 m below. This is the same cause as the open "crouch press is presented as a jump" item.

It should be named to the owner with these figures (W-03).

### 13. Plan 07-34 and the two spec edits

- The rule is applied to every composed clip without sway that is not held (`enemyGLTF.js:245-254`):
  `crouch_idle`, four crouch walks, three jump clips; that is every clip of the two families. Horizontal
  components come from the authored track at the same share of the clip, or from the rest position where
  the authored clip has none (`jump_loop`). Verified at every key by `liveClipRoute.test.js:603-668` and by
  the probe: horizontal pelvis position equal to the authored one, height equal to the inherited one,
  ankles within 0.0092 m. Correct and complete. Its price is the changed leg shape, which
  `07-34-SUMMARY.md` states (rear knee 0.11 to 0.14 m above the floor, front knee 0.38 m ahead of the
  root, ten straight keys in the landing).
- `firstPersonContact.test.js:130-173` runs a frame in the order of `src/loop.js:83`, `:105-108`,
  `:130-140`, `:157-160`, `:242-247`, with one actor object and the same arguments (`eyeHeight: PLAYER_H`,
  the saved spine value, the raw corrections). Not modelled: lean, the third-person camera, and the eye
  falling during a crouch press.
- The relative limit can hide a regression in one case: both players share the view rig and the
  weapon-handling code, so a change there that moves both the same way passes for AWP and P90, which have
  no absolute limit (`:379-385` covers M4 and pistol). The authored-clip error is 1.6e-7 m for all four
  weapons, so today the relative limit is an absolute one of 0.005 m in effect (note N-05).
- The crouch knee limit, 0.15 to 0.12 m. It was written into `07-34-PLAN.md` at commit `79e0f3d`, before
  the test commit `3497de1` and the source commit `d1815ae`, with the three planning measurements; the
  built clips measure the same (0.237, 0.152, 0.137). The old limit would have failed the new per-key
  case on the crouch walk (0.137) and passed the 12-phase case by 0.002. The limit still separates the
  composed legs from the authored ones (-0.246) by 0.36 m, which is what it is for. It is a loosening to
  fit a changed design, declared before the change; I accept it as justified and record it as such. The
  browser spec still uses 0.15 for crouch idle (`tests/animation-live-route.spec.js:32`).
- `tests/animation-motion-source.spec.js:44-53`: ten added lines, none removed, rebinding `walk`, `reload`
  and `turn_left` to `g.findMotionClip` clips of a freshly loaded template; the five named assertions keep
  their text. Confined to what plan 07-29 allows. See note N-08.
- `tests/first-person-rig.spec.js`: confined (answer 11).

## Further findings

No blocker.

### Warnings

**W-01. Diagonal movement puts the feet under the floor, and nothing tests it.**
`src/builders/animationPresentation.js:118-121` weights two gait clips for any movement that is not along
an axis; `enemyAnimations.js:524-525` plays both. The composed clips are guarded one direction at a time
(`liveClipRoute.test.js:351-361`), and plan 07-33 asks the owner to look at "all four directions".
Reviewer probe, the builder's actor at 60 frames per second, lowest ankle or ball against the root plane
(the plan's limit for gaits is -0.03 m):

| Movement | Lowest foot | Share of the cycle below -0.03 m |
|---|---|---|
| walk forward and left (W+A) | -0.086 m | 25 percent |
| walk, 22.5 degrees left of forward | -0.072 m | 17 percent |
| sprint forward and left | -0.123 m | 57 percent |
| sprint forward and right | -0.046 m | 13 percent |
| walk back and right | -0.038 m | 8 percent |
| walk forward and right, back and left | -0.012 m, -0.028 m | none |
| the same movements with the authored clips | 0.001 m or higher | none |

It comes from averaging a forward stride with a side step; the whole inherited `walk` and `strafe_l`
blended equally reach -0.067 m and `run` with `strafe_l` -0.113 m, so the old game's blend tree had it in
kind. Failure scenario: the owner, or any bot or remote player, moves forward-left; both feet are under
the floor for a quarter of every step, more than half when sprinting. Wanted: the owner is told and looks
at forward-left walking and sprinting in third person; if it is to be fixed, that is a source change and a
new review. A guard over the diagonals belongs in the next change to these tests.

**W-02. The look-down view shows little torso, and the text for the owner overstates it.**
Figures in answer 11. Standing, the chest plate enters the view only near the pitch limit; crouched, never.
No test asserts any torso on screen. Failure scenario: the owner looks down at 45 degrees and sees no body
at all, or looks fully down while crouched and sees two knees and one foot. Wanted: the owner is told this
in place of "you now see your chest front, knees and feet".

**W-03. The crouch transient is 0.37 m and has a counterpart on standing up.**
Figures in answer 12. Plan 07-33 says "the feet may dip into the floor" and does not mention the hover on
release or the root offset of the local player. Wanted: the owner is told the figures, and that a bot or
another player shows it most clearly.

**W-04. In live play a melee or a grenade throw steps the hips, which it did not before the repair.**
`enemyAnimations.js:516-518` plays the whole authored clip; it has no pelvis position track, so the pelvis
returns to its rest height. Reviewer probe: standing pelvis 0.877 m, during melee and throw 0.917 m, back
to 0.877 m afterwards, each step in one frame; the legs are the authored standing pose for the whole
action. With the authored clips the height never changed. A crouched character stands up for the action
(0.47 m to 0.917 m), as it also did before. Plan 07-33 mentions the 0.877 to 0.917 step for panel rows
only. Wanted: the owner is told it happens in play.

**W-05. Foot sliding is large, by the reviewer's estimate.**
The driver advances the gait by `cycleDisplacement` of the authored clips (2.4, 3.1 and 1.65 m per cycle,
`animationPresentation.js:94-98`). The planted feet of the inherited legs account for about 1.17 m per
cycle in the forward walk, 2.0 to 2.1 m in the run and 1.15 to 1.2 m in the crouch walk. Through the
driver the lower foot moves over the ground at about 3.4 of 6 m/s walking forward, 6.8 of 9.9 m/s
sprinting and 2.2 of 4.32 m/s crouch walking. By the same measure the authored legs slid more (5.9 of 6).
Crouch walking backwards or sideways shows forward steps (6.5 and 5.3 of 4.32 m/s). This is an estimate
from ankle heights in Node, not a test. Wanted: the owner hears a figure, not only "no test measures it".

**W-06. The paired gate will not compare like with like on frame time, and three costs are outside it.**
- The capture looks down at pitch -1.3 from the first actor's eye in every profile
  (`tools/art/review.mjs:491-494`, `:569-574`). The reference arm draws the chest in the middle of that
  view, the candidate a strip at the bottom (answer 11). Under software rendering covered pixels cost
  time, and rule 2 holds the frame interval to 5 percent. A pass or a failure on `frameIntervalMs` or
  `renderMs` can therefore come from what is on screen. Direction and size unknown without a browser.
- The inertia tick costs about 30 percent more (answer 10).
- The capture has no death and no damage, so the 66-track death and hit additive are in no timing gate.
Wanted: `07-31` states the first point before a session is spent, and reads a frame-time result with it
in mind.

### Notes

- **N-01.** The recorded hashes of `enemyGLTF.js` and `enemyAnimations.js` exist only in this working
  tree. `core.autocrlf` is `true`, `.gitattributes` does not pin the two files, and they are mixed in the
  working tree; a fresh checkout writes other bytes. Known for the frozen identities; it now also holds
  for this record. Nothing may rewrite those two files before Wave B ends.
- **N-02.** `07-27-SUMMARY.md`: "the one place where the leg cannot reach" is true at 12 phases only
  (answer 3). "Within 2.5 degrees ... in every state": sampled at 60 frames per second the weapon yaw in
  the backward walk spans -2.8 to 2.5 degrees against -0.2 to 0 for the authored actor. Inside the 3.5
  limit.
- **N-03.** The comment at `enemyGLTF.js:209-210` and the summaries say the solve keeps the inherited knee
  plane. In the crouch clips the bend direction is up to 37 degrees from the inherited one.
- **N-04.** `buildLiveClips` runs inside the load `try` (`enemyGLTF.js:528`): an exception there makes
  the whole GLB load report failure and every character procedural. A skipped composition (`:168`, `:242`)
  falls back to authored legs with no log line. Both are excluded on the shipped asset by the tests.
- **N-05.** `firstPersonContact.test.js:379-385`: the absolute limit could cover all four weapons, now
  that the authored error is known to be 1.6e-7 m.
- **N-06.** Jump start and landing are never measured with their entry blend in force
  (`liveClipRoute.test.js:122-123`, `:380-390`); `07-27-SUMMARY.md` says so.
- **N-07.** `tests/animation-live-route.spec.js:180-183` needs one stride in 40 consecutive frames; above
  about 100 frames per second it cannot pass. Headless runs are at 60 or below.
- **N-08.** `tests/animation-motion-source.spec.js` now binds `findMotionClip` results from a raw,
  unprepared template itself, so its name assertions prove that the authored clips are in the GLB and
  resolve, no longer that a product factory plays them. That is the plan's intent.
- **N-09.** Present before the repair and outside the diff: when a bot's slot is respawned while its
  corpse is still shown (`src/entities/enemies.js:77-82`), the first presentation tick stops the corpse's
  death action (`enemyAnimations.js:457`); in the probe the corpse's pelvis rises from 0.063 to 0.917 m.
  The driver of `e09bf9b` does the same. Team Deathmatch respawns after 3 s and the corpse lasts 2.2 s.
- **N-10.** The inherited loops do not close: first and last key differ by up to 9.4 degrees and 0.015 m
  in `strafe_l`, 8.0 degrees in `walk_back`, 5.7 in `run`. The composed clips keep that, once per cycle.
- **N-11.** The damage additive is 66 tracks at a quarter weight for 0.3 s per hit, per actor, and a dead
  local or remote player evaluates the 66-track death every frame (`enemyAnimations.js:513-514`).

## What the owner should be told at the live check

In addition to the text of plan 07-33 task 2, or correcting it:

1. Move diagonally in third person, forward-left above all, walking and sprinting: the feet go under the
   floor by up to 9 cm for a quarter of each step walking and up to 12 cm for more than half of each step
   sprinting. No test covers diagonal movement (W-01).
2. Looking down while standing you see legs from about 55 to 60 degrees down and the chest only near the
   limit, as a strip at the bottom of the screen; at 45 degrees you see at most the tip of one boot. Crouched you see both
   knees and the left foot and no torso at any pitch (W-02).
3. On a crouch press the feet are up to 0.37 m under the floor for about 0.2 s; on standing up the
   character hovers by up to 0.39 m for about 0.1 s. Best seen on a bot or another player. For your own
   third-person body the root also jumps by 0.8 m for a moment, which is older than this repair (W-03).
4. A melee or a grenade throw lifts the hips 4 cm for its duration, with stiff standing legs; done while
   crouched, the character stands up for it (W-04).
5. The feet slide: the body covers about twice the ground the walking steps account for, about one and a
   half times when running or crouch walking. Crouch walking backwards or sideways shows forward steps
   (W-05).
6. Strafing left has a small hitch once per cycle, from the inherited clip (N-10).

## What I could not verify

- Anything on screen: how any of the above looks, near-plane clipping, the comic outline, the first-person
  view as rendered. The view figures are projected vertices.
- The browser specs at this commit; I relied on `07-29-SUMMARY.md` (61 focused cases, 2 character-art
  cases). The full offline suite and the multiplayer suite were not run by anyone since the repair.
- The paired gate, the frozen gate and the strict capture: outcome, and the frame-time effect of W-06.
- Cost in a browser or on a GPU: the load cost of `buildLiveClips`, the script costs of answer 10.
- The local player's root offset on crouch (answer 12) and how a remote player's root behaves on a crouch:
  read from source only.
- That the tool files and evidence pinned elsewhere are unchanged; outside this review's scope.

---

_Reviewed: 2026-10-11T10:22:28Z_
_Reviewer: Claude (independent code reviewer, opus, effort high)_
_Depth: deep_
