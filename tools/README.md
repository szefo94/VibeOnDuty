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
