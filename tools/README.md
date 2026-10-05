# tools

## `retarget.py` — rebuild `public/models/enemy.glb`

`enemy.glb` shipped with clips from two sources on incompatible rigs: 24 authored on
the UE-mannequin skeleton, and 12 Mixamo clips merged in by an earlier script that
premultiplied a fixed +90°X "correction" instead of retargeting. The two families sat
~180° apart on every limb-root bone, which caused the crouch, roll and jump blending
faults documented in `docs/ANIMATION-SPACES.md`.

This script retargets the Mixamo clips onto the mannequin skeleton properly, so every
clip in the GLB is on one rig.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python tools/retarget.py -- \
  --glb public/models/enemy.glb \
  --anims tools/anim-sources \
  --out  public/models/enemy.glb
```

Measured effect (limb-root bones, mean angle between the two families):

| | all bones | limb roots |
|---|---|---|
| before | 61.7° | **162.7°** |
| after  | 28.5° | **36.5°** |

The residual is genuine pose difference — a crouch legitimately differs from a stand —
not a rig mismatch.

### `anim-sources/`

The 12 Mixamo FBX files the retarget consumes. They were committed once, then deleted
in `11ece0e` when the GLB replaced the runtime FBX loader, leaving the GLB
unreproducible. Restored here so the pipeline can be re-run.

### Adding a clip

Mixamo clips are exported **without skin**, FBX, 30 fps. Drop the file in
`anim-sources/`, add `'<file stem>': '<action name in the GLB>'` to `CLIPS` in
`retarget.py`, and re-run. Locomotion should be exported **In Place** where possible;
the script strips horizontal root motion regardless, since the game drives position
itself.

The mannequin-family clips (crouch, roll, jump_start/land, death, dance, punch) have no
Mixamo source and are passed through untouched. Sourcing rifle-holding replacements for
those from Mixamo is the remaining work — see `docs/ANIMATION-SPACES.md`.

## `art/` — editable human and painted slice

The local pipeline uses the verified official **Blender 4.5.13 LTS** portable ZIP
in `.planning/research/.cache/06-art/`. Its archive SHA256 is
`b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`;
the executed Blender build is `daeeeca98fb0`. It adds no installed package,
runtime AI service, account or machine-wide Blender installation. Inspect
`art/iterate.py` before using an LLM-authored edit; the script itself is the
offline assistance artifact. It accepts structured numeric operations, never
prompts, generated Python, arbitrary selectors, commands or network requests.

From the checkout root, with existing dependencies and Chromium available:

```sh
node tools/art/pipeline.mjs self-test
node tools/art/pipeline.mjs bootstrap
node tools/art/pipeline.mjs probe --provenance
node tools/art/pipeline.mjs build --probe
node tools/art/pipeline.mjs build-slice --probe
node tools/art/pipeline.mjs export --source tools/art/sources/soldier.blend --out .planning/research/.cache/06-art/manual-export.glb
node tools/art/verify-export.mjs --repeat
node tools/art/pipeline.mjs iterate --demo
node tools/art/verify-export.mjs --iteration
```

`build --probe` rebuilds and publishes `soldier.blend` and `public/models/enemy.glb`
only after reopening/export/compatibility and game tracer checks. `build-slice`
similarly rebuilds the editable `slice.blend` and original paint atlas. These
build/probe/repeat commands were executed by plans 06-01/02; export, self-test,
iterate and independent restoration were executed by plan 06-05. Build/rebuild
is unnecessary for a candidate iteration and can replace manual source edits.

`iterate --demo` keeps the accepted published model and editable source intact.
It creates a unique owned `iteration-*` directory, retains a baseline source and
parameter backup, reopens it, applies the reviewed edit to a separate `.blend`,
and exports before/changed/restored GLBs with exact inherited rig/motion merge.
It opens the actual game in owned headless browser contexts and routes the
normal model HEAD/GET to each candidate. The real Training Range player rig,
normal scene, M4 mount, lighting and selective ink are rendered at matched
1280×960/DPR 1/Medium, idle time 0.4 and recorded camera settings. Test-only
fixed random values and frozen animation frames allow matching pixel identities.
The process closes its own browser and loopback server in `finally`.

The demonstrated request format is exactly:

```json
{
  "schemaVersion": 1,
  "operations": {
    "helmet-cheek-guard-offset": 0.022,
    "accent-paint-gain": 0.55
  }
}
```

| Fixed operation | Range | Target |
| --- | --- | --- |
| `helmet-cheek-guard-offset` | −0.025…0.025 metres | Translate only `HelmetSidePanel-1` and `HelmetSidePanel1` vertically downward by the supplied offset; keep topology/UVs/skin weights |
| `accent-paint-gain` | 0.4…1.3 | Scale only packed `Paint_team-accent` RGB and `TeamAccent` base appearance, clamped to 0…1; preserve alpha, normal maps and protected paint |

At least one known operation is required. Duplicate/unknown keys, additional
request fields, nonfinite values, booleans/strings/null, invalid ranges,
uncontrolled object selection, input/output aliases, existing output files,
path escapes and linked paths (including in-root Windows junctions) reject.
Node and Python validate before opening a source or creating edited output;
Python also verifies the exact owned mesh/material/image targets. Blender starts
with factory settings and `--disable-autoexec`, and opens with
`use_scripts=False`. This is bounded local authoring of trusted reviewed source,
not a sandbox for arbitrary hostile `.blend` binaries.

For a custom request, save it as an ordinary JSON file under the owned cache and
choose a new output filename with an existing parent directory:

```sh
node tools/art/pipeline.mjs iterate --validate --source tools/art/sources/soldier.blend --params tools/art/character-params.json --request .planning/research/.cache/06-art/request.json --out .planning/research/.cache/06-art/custom.blend
node tools/art/pipeline.mjs iterate --source tools/art/sources/soldier.blend --params tools/art/character-params.json --request .planning/research/.cache/06-art/request.json --out .planning/research/.cache/06-art/custom.blend
node tools/art/pipeline.mjs export --source .planning/research/.cache/06-art/custom.blend --out .planning/research/.cache/06-art/custom.glb
```

`--validate` writes no edited output. Source roots are `tools/art/sources/` and
the cache; parameter roots are `tools/art/` and the cache; requests and outputs
are cache-only. The edit produces `.blend.params.json` and `.blend.operation.json`
beside the candidate. The latter records input, script, runtime and output hashes.
Outputs must not overwrite anything, including accepted publication.

Recovery is an editable-source operation: copy the independently retained
`baseline.blend` and `baseline.params.json` back into working recovery files,
then reopen those files through a fresh pinned Blender process and export again.
The demo performs this step as `restored.blend` / `restored.params.json` /
`restored.glb`. `verify-export --iteration` independently reopens them and writes
`independent-*/regenerated.glb`. It checks full semantic mesh/material/image/skin/
action equality against `before.glb`, checks the changed panel translation,
UVs/weights/winding and accent pixels independently, and verifies the recorded
matched game captures. Copying an earlier GLB or resetting Git is not recovery.

`.planning/research/.cache/06-art/iteration-report.json` points to the latest
demonstration and its immutable source/candidate artifacts; `iteration-verification.json`
records independent verification. `before-game.png`, `changed-game.png` and
`restored-game.png` live in that run's directory. Run hashes and outcomes are
retained in `art/provenance.json`; future reruns create new cache evidence without
silently rewriting that historical ledger. The actual demo changed only the
intended panels/accent and recovered matching baseline semantics and pixels.
Software/headless review does not establish human aesthetic acceptance, physical
device performance or 60 FPS. The CC0 anatomical base remains separate from
unresolved inherited rig, motion and weapon redistribution terms.

API references checked for this workflow: [Blender 4.5 file operators](https://docs.blender.org/api/4.5/bpy.ops.wm.html),
[Playwright route fulfillment](https://playwright.dev/docs/api/class-route),
and [Vite owned server lifecycle](https://vite.dev/guide/api-javascript.html).
