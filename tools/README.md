# tools

Two ways to rebuild the character model `public/models/enemy.glb`. The game only loads
the finished GLB (and `tools/art/motion-manifest.json`, which the runtime imports); nothing
here runs during play.

Work files of both pipelines go to `.cache/` at the repository root (gitignored). Deleting
`.cache/` is always safe; the next run recreates what it needs, including the downloaded
portable Blender.

## `art/` — editable human, motion and painted slice (Blender)

The pipeline downloads and verifies the official portable **Blender 4.5.13 LTS** ZIP into
`.cache/art/` (archive SHA256 `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`).
No machine-wide Blender install is needed.

| File | What it is |
|---|---|
| `sources/soldier.blend`, `character-params.json`, `build_soldier.py` | the fitted human with equipment and packed paint |
| `sources/slice.blend`, `build_slice.py` | the shared M4 and Greek Columns paint atlas |
| `sources/motion.blend`, `motion-manifest.json`, `build_motion.py`, `motion-pipeline.mjs` | the 59 authored `vod7_` actions, their slots and validation |
| `pipeline.mjs` | bootstrap, build, export and atomic publication |
| `inspect-character.mjs`, `verify-export.mjs` | GLB inspection and export comparison |
| `provenance.json`, `sources/LICENSE*.md` | where every input came from and under which terms |

```sh
node tools/art/pipeline.mjs bootstrap
node tools/art/pipeline.mjs build --probe        # rebuild soldier.blend and publish enemy.glb
node tools/art/pipeline.mjs build-slice --probe  # rebuild slice.blend and the paint atlas
node tools/art/pipeline.mjs export --source tools/art/sources/soldier.blend --out .cache/art/manual-export.glb
node tools/art/motion-pipeline.mjs build --candidate
node tools/art/motion-pipeline.mjs publish --latest
```

`build --probe` publishes only after the candidate reopens, exports, keeps the inherited
65-joint skeleton and passes the three browser cases in `tests/art-tracer.spec.js`
(the pipeline routes the game's model request to the candidate through `VOD_ART_CANDIDATE`).

Not runnable any more: `pipeline.mjs iterate` and `verify-export.mjs --iteration`. They
rendered matched screenshots through a review tool that was removed together with the
Phase 6/7 measurement tooling (see `docs/legacy/tools-README.md` for the old commands).
`motion-acceptance.mjs` and `runtime-dependencies.mjs` still name Phase 7 evidence files
under `.planning/` as hash-pinned historical data; those files are gone, so the Phase 7
crouch-correction promotion cannot be repeated.

The 59 `vod7_` actions are procedural hinge poses, not motion capture. Live play builds
composed `live_` clips at load (inherited motion-captured legs under the authored weapon
pose, `src/builders/enemyGLTF.js`); the measured defects of the authored clips are in
`docs/legacy/debug/phase7-human-motion-review.md`.

## `retarget.py` — the inherited mannequin and Mixamo clips

`enemy.glb` carries 48 inherited clip occurrences: clips authored on the UE-mannequin
skeleton plus 12 Mixamo clips retargeted onto it. `retarget.py` rebuilds that set from
`anim-sources/` (the 12 Mixamo FBX inputs) in world space, parents first, stripping
horizontal root motion because the game moves characters itself.

```sh
<path to Blender> --background --factory-startup --python tools/retarget.py -- \
  --glb public/models/enemy.glb --anims tools/anim-sources --out public/models/enemy.glb
```

To add a clip: export it from Mixamo without skin, FBX, 30 fps, In Place where possible;
put it in `anim-sources/`, add `'<file stem>': '<action name>'` to `CLIPS` in
`retarget.py`, and add the matching runtime alias in `src/builders/enemyGLTF.js`.
Background and measurements: `docs/legacy/ANIMATION-SPACES.md`.

The redistribution terms of the inherited rig, the mannequin and Mixamo motion and the
weapon FBX files are unresolved; see `tools/art/provenance.json`.
