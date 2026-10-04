# Phase 6: Human Characters and Comic-Book Blender Iteration - Pattern Map

**Mapped:** 2026-10-04. Paths below are implementation candidates, not existing assets.
**Scope:** 18 file groups; 14 have role/data-flow analogs, 4 require new contracts.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `tools/art/*.py` build/export/edit scripts | utility | file-I/O, transform | `tools/retarget.py` | role-match |
| `tools/art/inspect-character.mjs` | utility | file-I/O, transform | none | new |
| `tools/art/verify-export.mjs` | utility | batch, file-I/O | none | new |
| `tools/art/` runtime/source/export manifests | config | file-I/O | none | new |
| `tools/art/sources/` blend, base, licenses, painted maps | model | file-I/O | none | new |
| `public/models/enemy.glb` and representative exported art | model | file-I/O | `tools/retarget.py` | role-match |
| `tools/README.md`, art iteration/review documentation | config | file-I/O | `tools/README.md` | exact |
| `src/builders/characterAppearance.js` | utility | transform | `src/builders/enemyGLTF.js` | flow-match |
| `src/builders/characterAppearance.test.js` | test | transform | `src/network/remoteActors.test.js` | role-match |
| `src/builders/enemyGLTF.js` | service | file-I/O, transform | same file | exact |
| `src/builders/characterResources.js` | utility | transform | same file | exact |
| `src/materials.js`, representative weapon material consumer | utility | transform | `src/materials.js` | exact/role-match |
| `src/scene.js`, `src/lighting.js`, quality settings helper | service | event-driven | `src/scene.js` | exact/role-match |
| `src/loop.js` selective outline integration | controller | streaming | same file | exact |
| `src/main.js`, `index.html`, `style.css` quality control | controller/component | event-driven | same files | exact |
| `tests/assets.spec.js` semantic/material browser coverage | test | request-response | same file | exact |
| `tests/animation-regressions.spec.js` ownership/pose coverage | test | streaming | same file | exact |
| `src/network/remoteActors.js`, its test and multiplayer browser coverage | service/test | streaming | same files | exact |

## Pattern Assignments

### Blender scripts, editable sources and generated art
**Analog:** `tools/retarget.py:35-36,63-65,150-155,186-205`; usage: `tools/README.md:14-19`.
```python
import bpy, sys, os, math
from mathutils import Matrix, Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB',
    export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_apply=False,
)
```
Copy CLI-after-`--`, explicit input/output and sampled-action export conventions; probe pinned Blender operator properties first. Existing exception logging at 186-199 does not fail the process: new verification/export tools must fail closed on invalid output. Rig mapping is at 40-60; world-space parent-first retarget at 94-147. Preserve inherited rig/clips and fit authored human geometry to them. Editable source, license ledger, parameter manifests and semantic export comparison need new schemas; retarget is not a provenance or reproducibility ledger.

### Appearance, GLTF replacement and resource ownership
**Analog:** `src/builders/enemyGLTF.js:13-23,276-301,325-349,422-430,477-509`.
```javascript
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { preserveTemplateGeometry, disposeCharacter } from './characterResources.js';
const clone = skeletonClone(gltfTemplate.scene);
```
Retain `tryLoadEnemyGLTF()`, `buildEnemyMesh(wx,wz,role)`, `buildPlayerMesh()`, `tintEnemyMesh(mesh,hexColor)` and `disposeEnemyMesh(mesh,mixer)` compatibility. Loading uses `import.meta.env.BASE_URL + 'models/enemy.glb'`; preparation preserves template geometry before actors clone. Keep ordered aliases at 36-69, hand attachment at 397-416, per-instance mixers and animation preparation. Extract appearance logic from the current tint helper, but replace whole-body color/emissive changes with semantic accent eligibility, immutable base values and material-array support.

**Ownership analog:** `src/builders/characterResources.js:8-30`.
```javascript
if (!root || disposed.has(root)) return;
disposed.add(root);
mixer?.stopAllAction();
mixer?.uncacheRoot(root);
if (mat?.userData?._tinted || mat?.userData?.characterOwned) materials.add(mat);
for (const material of materials) material.dispose();
for (const skeleton of skeletons) skeleton.dispose();
```
Mark actor-owned appearance/outline materials and retire them with the actor. Shared template geometry and map textures outlive actor retirement; material disposal does not dispose textures. New owned textures or outline caches require explicit ownership, including repeat-tint replacement.

### Illustrated materials, outline pass and quality
**Analog:** `src/materials.js:1-13`, `src/scene.js:4-11,21-31`, `src/loop.js:340-343`.
```javascript
const mm = (c, r = 0.85, m = 0.05) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.render(scene, camera);
if (!isKillcamActive()) camera.position.set(eyeX, eyeY, eyeZ);
```
Extend existing Standard materials with authored maps; scope representative environment/weapon work to their consumers. `scene.js` owns renderer, resize, output color space and tone mapping; `lighting.js` owns exported lights and currently 2048 shadow maps. Put quality changes behind one API shared by initial setup, resize and menu events. Render selective outlines at the current render seam before camera restoration, preserving online snapshot processing and offline gates. No tracked selective skinned outline implementation exists: use RESEARCH guidance and validate deformation plus retirement.

### Boot and quality UI
**Analog:** `src/main.js:429-431,461-466`; current markup/styles remain their owners.
```javascript
register('enemy-glb',  tryLoadEnemyGLTF);
const assets = await loadAll();
```
Keep asynchronous asset boot and enabled-button readiness. Add static quality markup in `index.html`, its DOM handler in `main.js`, and CSS in `style.css`; avoid importing DOM singletons in pure appearance/settings tests. Leave first-person weapon loader behavior explicit; do not infer active weapons from files on disk.

### Online actors and browser validation
**Analog:** `src/network/remoteActors.js:14-25,28-58,77-79,113-174`.
```javascript
export function createRemoteActors(scene, builders) {
// injected create/dispose/animate/tint builders own presentation
builders.dispose(actor.mesh, actor.mixer);
builders.tint(actor.mesh, p.team === 'blue' ? 0x4488ff : 0xff5555);
```
Keep connection/match/life retirement, injected builders and snapshot-owned positions/teams; new appearance must work through existing tint/create hooks without protocol changes. Unit ownership tests can reuse injected fake builders from `remoteActors.test.js`. Browser analog `tests/assets.spec.js:47-54` uses `pageerror` and `await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 20000 })`. `tests/animation-regressions.spec.js:69-132` covers real armed poses and repeated GPU retirement; extend its real-rig checks rather than substituting mock visual assertions. Capture matched before/changed/restored pose sheets; subjective approval remains a separate human review.

## Shared Patterns
Browser ES modules use explicit `.js` imports, Three addon imports and prefix-aware URLs. There is no authentication requirement for offline art tools. Authority and gameplay stay outside appearance/quality modules. Preserve shared templates, dispose actor resources once, and measure renderer memory after repeated transitions. Semantic inspectors should validate joints, weights, clips, maps, bounded geometry and hashes rather than brittle exporter byte identity.

## No Analog Found
New contracts: semantic GLB inspector, repeat-export/restore verifier, source/license/runtime manifests, editable human source authoring. Also no current scalable quality API or tracked selective outline implementation; existing renderer/ownership patterns are integration analogs only.

## Metadata
Analog scope: `tools/`, `src/builders/`, renderer/boot, `src/network/`, `tests/`. Named analogs verified git-tracked with process-only `safe.directory`; no runtime mirrors. Root-pin guard passed using Git Bash before writing. Only this document was written; no source edits or commits. Tool interface lacks named Read/Write tools, so filesystem reads and patch creation use available exec/apply_patch equivalents.
