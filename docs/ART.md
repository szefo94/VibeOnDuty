# Editable human and illustrated art

The current human, M4 and Greek Columns slice is generated from retained Blender
sources and displayed through the existing gameplay renderer. Phase 6 provides
repeatable authoring, protected rig/motion comparisons, selective ink and three
quality settings. Human aesthetic acceptance remains pending. No representative
phone, integrated GPU, Raspberry Pi or 60 FPS gameplay qualification is claimed.

## Sources and publication

| Input/output | Purpose |
| --- | --- |
| `tools/art/sources/soldier.blend` | Editable fitted human, equipment, packed paint and tangent normal images |
| `tools/art/character-params.json` | Versioned fit, palette, budget and compatibility parameters |
| `tools/art/build_soldier.py` | Inspected deterministic anatomical fit and original equipment/paint construction |
| `tools/art/sources/slice.blend` | Editable original M4/stone brush atlas |
| `tools/art/build_slice.py` | Reopenable 1024px atlas construction/export |
| `public/models/enemy.glb` | Published render mesh with exact inherited skeleton/inverse binds/48 motion occurrences |
| `public/textures/comic-slice.png` | Shared original M4 and scoped Greek Columns paint atlas |
| `tools/art/provenance.json` | Actual input/export/script/runtime hashes and separate inherited-term dispositions |

The source body is an asset-specific verified CC0 anatomical contribution. Original
fitted equipment, packed paint and atlas are project contributions. Inherited rig,
motion, animation FBX and weapon FBX redistribution terms remain unresolved; the
combined GLB is **not** declared license-cleared. See the provenance ledger and
`tools/README.md` for the exact source evidence and portable runtime trust.

The inspector requires the authored body/equipment in the active scene and compares
the canonical render graph: roots, reachability, parents, mesh/skin bindings, local
transforms and rendering metadata, using authored identities rather than serializer
indices. Repeat exports and independent restored-source verification consume this
mesh domain alongside full semantic skin/motion checks with the retained baseline.
Generated rifle-ready crouch/jump aliases are still composed at runtime.
This art pass does not retarget clips or change the hand basis, gameplay body,
collision, map topology, authoritative damage or teams.

## Available commands

Run from the repository root with the existing Node dependencies. The portable
Blender 4.5.13 LTS archive is verified by its pinned SHA256 and kept in the ignored
owned cache; no package installation or system Blender update is needed.

```sh
node tools/art/pipeline.mjs self-test
node tools/art/pipeline.mjs bootstrap
node tools/art/pipeline.mjs build --probe
node tools/art/pipeline.mjs build-slice --probe
node tools/art/pipeline.mjs probe --provenance
node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb
node tools/art/verify-export.mjs --repeat
node tools/art/pipeline.mjs iterate --demo
node tools/art/verify-export.mjs --iteration
node tools/art/review.mjs --capture
```

`build` reopens the saved candidate, compares protected domains, runs the real-game
tracer and atomically publishes the source/GLB. `build-slice` reopens and requires
identical atlas export before publishing. Review owns an explicit free loopback
port, browser and contexts; it closes those resources in `finally`, excludes the
Blender cache from its watcher and leaves other review/server owners alone.
Run the Blender edit/export commands before browser suites: opening a `.blend`
while the existing general Vite dev watcher scans it can cause Windows EBUSY.
Browser suites also share Playwright's default output directory, so run them
sequentially. A report from a failed or interrupted run is not passing evidence.

## Bounded LLM-authored iteration and recovery

`tools/art/iterate.py` is the inspected offline assistance artifact. It accepts
only a versioned exact numeric request with two allowlisted operations:

- `helmet-cheek-guard-offset`: -0.025..0.025 metres on exactly the two helmet panels.
- `accent-paint-gain`: 0.4..1.3 on exactly the accent material/packed image.

The interface rejects unknown or duplicate keys, nonfinite/out-of-range values,
wrong types, escapes, aliases, existing outputs and linked path components before
opening source or creating output. Blender factory startup disables automatic
scripts. This is trusted local authoring, not a sandbox for arbitrary hostile
Blender binaries, dynamic prompts, generated Python or model-selected paths.

The demo retains independent editable `.blend` and parameter backups, authors a
candidate, exports it, enters the actual Training Range through normal model
HEAD/GET routing, restores those editable backups and exports again. The separate
verifier reopens the restored source in a fresh pinned Blender process, verifies
complete semantic mesh/material/image/skin/motion identity and checks the intended
changed panels/paint plus all protected domains. Before/restored actual-game raw
pixels must match; changed pixels must differ. Accepted publication is unchanged
by the demo. The final evidence ledger identifies the executed cache directory
and every current before/changed/restored artifact; earlier plan evidence remains
historical after an accepted source correction.

For a separate inspected request, the available forms are:

```sh
node tools/art/pipeline.mjs iterate --validate --source tools/art/sources/soldier.blend --params tools/art/character-params.json --request .planning/research/.cache/06-art/request.json --out .planning/research/.cache/06-art/edited.blend
node tools/art/pipeline.mjs iterate --source tools/art/sources/soldier.blend --params tools/art/character-params.json --request .planning/research/.cache/06-art/request.json --out .planning/research/.cache/06-art/edited.blend
node tools/art/pipeline.mjs export --source .planning/research/.cache/06-art/edited.blend --out .planning/research/.cache/06-art/edited.glb
```

## Appearance and ownership

Semantic domains are `skin`, `fabric`, `armor`, `ink`, `team-accent`, `weapon` and
scoped `stone`. Actor-owned clones tint only designated accents; skin, cloth,
armor paint, roughness, metalness, emission and shared image references stay intact.
DOM-free map/navigation imports receive unmapped fallback materials without image
IO. The animation-only Node GLB test mocks image decoding while retaining the real
rig/motion buffers; actual packed paint decoding remains covered in the browser.
`characterResources.js` retires owned geometry/materials/skeleton textures/mixer
bindings/debug/ink once while shared templates and packed maps survive siblings.

`comicOutline.js` uses the same skinned mesh and skeleton in a bounded second
pass. The outline-only `comicNormal` averages compatible split-normal positions
without editing authored lighting normals or joining different skin influences.
It restores material arrays, callbacks, visibility, renderer state and the frame
coordinator's simulation eye even if rendering fails. HUD/effects/transparent
surfaces stay out of ink. The open collar and anatomical skin stay in the painted
pass: backface hulls can fill an open neckline or speckle concave eyes/fingers.
Clothing, equipment and weapons retain silhouette ink; High also selects the
designated Greek Columns structural slots.

The final source correction smooths the collar/strap tube shading and extends
the UV skin-to-fabric fade below the visible neck boundary. Carrier panels use
smoothed fitted body depths and the torso's existing blended weights so they
follow bends instead of hovering under single-spine assignments. It preserves exact
inherited rig/motion and does not hide an art defect by assigning it to Phase 7.
The original rifle pose still wraps the support hand around the barrel; precise
finger/grip fitting and broader movement quality remain visibly limited. Those
are retained pose/mount limitations, not a claim of accepted human appearance.
The first-person M4 keeps its inherited box-based geometry and close camera
framing. The paint is present, but this does not establish a finished weapon model.

## Quality and evidence

| Tier | DPR cap | Rendering policy |
| --- | --- | --- |
| Low | 1 | Painted/internal details, one paint pass, shadows off |
| Medium (default) | 1.5 | Actor/weapon ink, existing shadow configuration |
| High | 2 | Medium plus selected Greek Columns structural ink |

Native menu/pause controls synchronize immediately, persist one bounded value,
and reapply the policy on resize. Invalid saved values use Medium; failed storage
keeps the session choice and reports the save failure. Desktop online pause is
positioned to the right of the match controls so the wider settings panel cannot
intercept Leave after rematch. Narrow-screen pause retains Resume and Return.

The current capture controller records 58 actual-game frames at 1280x960, DPR 1:
18 prepared action aliases, matched face/hands/first-person M4 across three tiers,
and Greek Columns blue/red near (~4m), far (~15m), structural daylight/shadow and
posed comparisons, plus first-person M4 daylight/shadow at all three tiers.
Training Range uses its authored ambient lighting. The Greek
shadow probe disables the authored key while retaining ambient/fill/torches; it
is a controlled readability comparison, not every natural map occluder.

Full PNGs, eight exhaustive readable review sheets, a selected pose sheet and
numeric samples are generated under `.planning/research/.cache/06-art/final-review/`.
The reviewed snapshot is retained under the export-specific `reviewed-<hash>/`
path recorded by the evidence ledger, so later captures cannot replace it.
The tracked phase `evidence/06-review.json` records hashes, dimensions, settings,
source/export identities, agent conclusions and current recovery evidence. Its
`06-pose-sheet.png` is a readable selected comparison, not a synthetic mockup.

Each tier warms 12 frames, then measures 40 synchronous real-scene mixer/render
and GPU-finish samples. It records actual duration, median/p95, viewport/DPR,
visible human count, WebGL/GPU labels, calls/triangles/programs/memory and six
spawn/tint/retire samples with a stable warmed resource plateau. The Windows
headless Chromium GPU label reports **SwiftShader**. These costs include a
deliberate GPU completion barrier and omit normal input/network/whole-game work;
they cannot certify 60 FPS or compare real phones/iGPUs/Pi capacity.

Online production tests additionally prove painted human maps and accent ownership
through life/match/session generations, rematch and repeated rejoin while a live
sibling keeps its shared maps. Existing real-rig mount, track stripping, duration,
death and GPU retirement regressions remain required. Final counts and exact
seven-gate results are recorded in `06-06-SUMMARY.md` and `06-VALIDATION.md`.

Agent inspection precedes delivery and remains separate from subjective human
acceptance. Review the running character in Training Range and Greek Columns,
all three quality settings, pose transitions, face, grips and outlines before
recording a human pass. Selected order remains Phase 6 → 7 → 5; this document
does not advance or accept a later phase.
