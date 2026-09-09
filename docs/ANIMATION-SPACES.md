# enemy.glb — retarget spaces, measured

Written after four failed attempts to fix character animation blending by rotating
quaternions at load time (`applyCORR`, `undoMergeCORR` ×2, `CORR_CLIPS`). All numbers
below come from parsing the GLB binary directly; the scripts are reproducible against
`public/models/enemy.glb`.

## TL;DR

* The "+90°X CORR" premise the old code was built on is **false**. No global rotation
  relates the two clip families — applying ±90°X makes every clip *worse*.
* The GLB holds **two clip families retargeted differently**. 10 clips sit in the wrong
  one, which is why every override transition blends across 38–68°.
* This is an **asset-pipeline bug, not a code bug**. No runtime quaternion surgery
  fully fixes it. The correct fix is a consistent re-export from Blender.

## The file

| | |
|---|---|
| generator | Khronos glTF Blender I/O v5.1.18 |
| clips | 36 |
| bones | 65 (`root` → `pelvis` → …, UE4 mannequin naming) |
| mesh | 1 mesh, 2 primitives (3391 + 5157 verts), materials `M_Main` / `M_Joints` |
| textures | none — flat `baseColorFactor` only |
| channels per clip | 195 = 65 bones × (translation, rotation, scale) |

## Finding 1 — the ±90°X premise is false

Mean bone angle from each clip to `Idle_Loop`, over 64 bones, raw vs after
premultiplying the correction the old code applied:

| group | raw | after −90°X | after +90°X |
|---|---|---|---|
| 12 "retargeted" clips | 66.6° | 123.9° | 78.9° |
| 24 "original" clips | 18.4° | 98.8° | 85.3° |

Both corrections move every clip further away. There is no ±90°X offset to add or undo.
This is why `undoMergeCORR` was reverted twice as "breaks visual appearance" — it was
simply rotating good clips.

Note also that **all 36 clips share one accessor for the `root` track** (`acc17`), so
`root` is byte-identical everywhere and tells you nothing about a clip's space. Any
in-place edit to `root` hits all 36 clips at once — that was the shared-buffer
corruption fixed in `4e7af32`.

## Finding 2 — the real split is a per-bone offset on limb roots

Mean pairwise bone angle *within* each family vs *across* families:

| bone | within retargeted | within originals | **across** |
|---|---|---|---|
| ball_r / ball_l | 3.7° / 6.0° | 13.9° / 5.0° | **173° / 173°** |
| thigh_r / thigh_l | 22° / 25° | 45° / 46° | **171° / 158°** |
| upperarm_l / upperarm_r | 22° / 21° | 46° / 42° | **163° / 157°** |
| clavicle_l / clavicle_r | 18° / 19° | 14° / 10° | **154° / 150°** |
| spine_01 / spine_02 | 11° / 10° | 0° / 16° | 14° / 13° |
| **mean, 64 bones** | **5.1°** | **20.7°** | **61.4°** |

Each family is internally consistent; they are ~180° apart on limb-root bones and
~0° apart on the spine. That is a bone-roll / axis-convention difference from
retargeting, not a global transform. `ball_l`/`ball_r` show it cleanly as a 173°
flip about Y.

## Finding 3 — which clips are on the wrong side

`ALIASES` resolves the loco blend tree to the retargeted family and most override
clips to the originals, so the fault line runs straight through every transition.
Mean bone angle from the idle anchor (`attack`):

| game key | GLB clip | family | Δ to idle |
|---|---|---|---|
| shoot / reload / hit / nade | `shoot` `reload` `hit` `nade` | retargeted | 0.0–6.2° ✅ |
| walk / run / strafe_l / strafe_r | `walk` `run` `strafe_*` | retargeted | 2.5–8.9° ✅ |
| jump_loop | `Jump_Loop` | original | **39.8°** |
| death | `Death01` | original | **42.4°** |
| crouch / crouch_walk | `Crouch_*_Loop` | original | **45.5 / 45.7°** |
| roll | `Roll` | original | **48.5°** |
| jump_land | `Jump_Land` | original | **62.1°** |
| punch_cross / punch_jab | `Punch_*` | original | **66.1 / 66.0°** |
| dance | `Dance_Loop` | original | **67.6°** |

The loco tree blends its five clips *simultaneously every frame* and they agree to
2.3–9.5°, which is why locomotion looks fine while every override pops.

Commit `0dd327f` ("use original Jump_Loop") is the pattern in miniature: it aligned
`jump_start↔jump_loop` and broke `idle↔jump_loop` to 39.8°.

## Finding 4 — the offset is a recoverable constant (mostly)

Several clips exist in *both* families — the same animation, retargeted twice. Fitting
a constant per-bone `D` such that `q_ret(t) = D_bone · q_orig(t)`, with a phase search:

| pair | fit residual |
|---|---|
| `attack` ← `Pistol_Idle_Loop` | **0.3°** |
| `shoot` ← `Pistol_Shoot` | **0.7°** |
| `walk` ← `Walk_Loop` | **3.2°** |
| `jump_loop` ← `Jump_Loop` | **3.2°** |
| `hit` ← `Hit_Chest` | 4.8° |
| `run` ← `Jog_Fwd_Loop` | 5.0° |
| `reload` ← `Pistol_Reload` | 6.6° |

Held out, the delta fitted from `walk ← Walk_Loop` predicts the `run` pair to **9.8°**
versus **70.4°** uncorrected — a 7× reduction on data it never saw.

**But** the fitted delta is not the same across families: a loco-fitted delta predicts
loco pairs to 6.7–8.8° and pistol pairs to only ~32°. A single global correction does
not exist, so any runtime fix is a partial approximation.

## The runtime mitigation (default OFF)

`enemyGLTF.js` can fit these deltas at load and apply them to the 10 misaligned clips.
Enable with `localStorage.animSpaceFix = 1` and reload. Measured effect:

| clip | before | after |
|---|---|---|
| Jump_Loop | 39.9° | **9.7°** |
| Dance_Loop | 67.6° | **9.2°** |
| Punch_Jab / Punch_Cross | 66.0 / 66.1° | **11.7 / 11.9°** |
| Jump_Start | 44.9° | **14.5°** |
| Jump_Land | 62.1° | **14.9°** |
| Crouch_Fwd / Crouch_Idle | 45.7 / 46.3° | **18.1 / 19.3°** |
| Death01 | 42.4° | **23.4°** |
| Roll | 48.5° | **25.8°** |

For comparison, natively-aligned clips sit at 0.4–8.9°.

It is off by default because the per-clip delta assignment is chosen by measurement
rather than derived, so it is partly curve-fitting and needs a human eye before it
ships. Turn it on, play, and judge crouch / roll / jump / death by eye.

## Resolved: the clips were retargeted onto one skeleton

`tools/retarget.py` (Blender, headless) fixes this at the asset level. The 12 Mixamo
source FBX files were recovered from git history — they had been deleted in `11ece0e`
when the GLB replaced the runtime FBX loader — and are now retargeted onto the
mannequin skeleton properly rather than nudged by a fixed rotation.

The retarget is the exact formulation, not a fitted correction. A bone's animation is
its world-space delta from its own rest pose, `D = pose_src · rest_src⁻¹`; applying that
delta to the *target's* rest pose, `pose_tgt = D · rest_tgt`, transfers the motion onto a
rig with different bone rolls and proportions. Bones are processed parents-first.

| mean angle between the two clip families | all bones | limb roots |
|---|---|---|
| before | 61.7° | **162.7°** |
| after  | 28.5° | **36.5°** |

The ~180° limb-root offset — the actual defect — is gone. What remains is genuine pose
difference: a crouch legitimately differs from a stand.

Three things fell out of this:

* **The upper-body aim layer was removed.** It grafted the aim pose's arms onto the
  crouch clips to hide the 167° shoulder gap. With a correct rig the graft makes crouch
  *worse* — hunched, arms tucked — so it went out with the fault it was hiding.
* **Root motion is stripped.** Mixamo locomotion travels; the game drives position
  itself, so transferred travel slid the character away from its own transform.
* **Two failure modes worth remembering** (both caught by screenshotting, not by
  metrics): computing the delta in *armature* space rather than world space, because the
  glTF and FBX importers apply different up-axis conversions — the character leans back
  with its arms straight up; and setting a pose bone's full matrix without zeroing its
  location, which bakes stale translations and tears the limbs apart.

### Still outstanding

The mannequin-family clips (crouch, crouch_walk, roll, jump_start, jump_land, death,
dance, punch) have no Mixamo counterpart and pass through untouched. They are now on the
right skeleton but were authored without a rifle, so the character crouches with its
arms down. Sourcing rifle-holding replacements from Mixamo and adding them to
`tools/anim-sources/` is the remaining work — the pipeline handles them automatically.

## Superseded: the upper-body aim layer

The runtime whole-clip correction was built, measured, rendered, and **removed** — see
the next section for why. What replaced it exploits one number from the table above:

> the spine differs by only **13-15 deg** between the two families, against
> **150-170 deg** at clavicle / upperarm / thigh.

So arm rotations lifted from the aim clip land correctly on a crouch spine. The crouch
clips keep driving legs, pelvis and spine; `clavicle/upperarm/lowerarm/hand` on both
sides are overwritten with the aim pose after the mixer and inertia passes have run.
Applied only to `crouch` and `crouch_walk`, where the character is meant to be holding
the weapon — death, dance, punch and roll keep their own full-body arms.

Before: crouching with both arms hanging back, ~167 deg off at the shoulder.
After: crouched with the rifle held forward, shoulders within ~15 deg of the aim pose
(asserted in `tests/assets.spec.js`).

This does not fix the underlying split — it routes around it for the one case where it
was most visible. Legs and spine still come from the other family, so a crouch still
differs from an idle by more than it should. The re-export below remains the real fix.

## Why the search for a runtime correction stopped

Three variants were measured. Each fixes one thing and breaks another:

| variant | clip -> idle | `jump_loop -> jump_land` | crouch `upperarm_r` |
|---|---|---|---|
| none | 40-68 deg | **5 deg** | 161 deg |
| one delta per clip, picked by distance to idle | **9-26 deg** | 39 deg | **36 deg** |
| one uniform delta, per bone by model fit | 25-30 deg | **5 deg** | 95 deg |

Two lessons worth keeping:

* **Clips that blend with each other must share a correction.** Picking each clip's
  delta independently by its distance to idle took `jump_loop -> jump_land` from 5 deg
  to 39 deg -- the correction broke a pair that was already perfect. Distance to the
  idle anchor is worth less than staying coherent with the clip you are blended from.
  The `SPACE_FIX_SOURCES` table now records that invariant explicitly.
* **A low fit residual does not mean a delta transfers.** Per-bone selection preferred
  `attack <- Pistol_Idle_Loop` (1.4 deg residual) for the arms, but both clips are
  near-static, so the delta is underdetermined -- it reproduces that pair almost
  exactly and generalises badly (crouch `upperarm_r` 36 -> 95 deg).

Taken together these are the empirical proof that the retarget was not a rigid
rest-pose change. No constant per-bone rotation transfers across these clips, so
runtime correction can only ever move the error around.

Rendering it settled the question. With the correction enabled the crouch does not
merely sit closer to idle, it **lies flat and floats**, and the jump stretches. The
metric (mean bone angle to the idle anchor) rewarded "looks more like idle", which is
not the same as "is a correct pose" — a rigid per-bone rotation applied to a whole clip
destroys it. The code was removed rather than left switched off, because a default-off
trap is exactly how the +90X theory survived four rounds. Screenshot the pose before
trusting any angle table, including the ones above.

## The actual fix (upstream, in Blender)

Do this and the whole `CORR_CLIPS` / `LARGE_POSE_CLIPS` / `INSTANT_SNAP_CLIPS` /
inertia-omega apparatus in `enemyAnimations.js` can be deleted.

1. Open the source `.blend` with the UE4 mannequin armature.
2. Import every animation onto **one** armature in **one** rest pose. Do not mix an
   armature that was retargeted by `merge_animations.py` with one that was not — that
   is exactly what produced the two families.
3. Sanity check in Blender: on frame 0, `upperarm_l` / `thigh_l` / `clavicle_l` should
   read within a few degrees between `Walk_Loop` and `walk`. If they are ~180° apart,
   the rest poses still differ.
4. Export with **Animation → Sampling** on, and turn **off** exporting constant
   position/scale channels if your exporter offers it (see below).
5. Re-run the measurement: every clip's Δ to the idle anchor should be under ~30°,
   with the differences reflecting real pose changes (a crouch *should* differ from
   an idle) rather than a fixed ~180° limb-root flip.

## Bonus — the export is 2/3 dead weight

The exporter baked all three channel types for all 65 bones into all 36 clips:

* **all 2340 scale tracks are exactly 1.0**
* **2321 of 2340 position tracks are constant**; only `pelvis` actually moves
  (and `Roll_RM/root`, the unused root-motion variant)
* the 5 constant `Pistol_*/pelvis` tracks hold a non-rest value, so they must be kept

`stripRedundantTracks()` drops a constant track only when it matches the node's rest
transform, so removal can never move a bone. Measured in-browser: **4656 of 7020 tracks
dropped, 2364 remain — 66% fewer tracks to evaluate.** The mixer evaluates every track
of every active action each frame, and the loco tree keeps 5 actions running per
character, so this is the single cheapest perf win in the project.

Re-exporting without the dead channels would also cut the 2.6 MB GLB substantially.
