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
