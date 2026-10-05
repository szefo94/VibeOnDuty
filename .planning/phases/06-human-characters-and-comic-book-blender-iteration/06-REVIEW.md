---
phase: 06-human-characters-and-comic-book-blender-iteration
reviewed: 2026-10-05T13:12:45Z
reviewed_commit: 9d2445397a1bc5fd77402eb6f3f78649468f08e4
diff_base: 8bef7d22a51533cecb1826bb5bd1fe62bb902a95
depth: standard
files_reviewed: 34
files_reviewed_list:
  - .gitignore
  - AGENTS.md
  - docs/ART.md
  - index.html
  - src/artMaterials.js
  - src/builders/characterAppearance.js
  - src/builders/characterAppearance.test.js
  - src/builders/characterResources.js
  - src/builders/enemyGLTF.js
  - src/builders/enemyWeapon.js
  - src/builders/rifleClips.test.js
  - src/builders/weapon.js
  - src/comicOutline.js
  - src/comicOutline.test.js
  - src/graphicsQuality.js
  - src/graphicsQuality.test.js
  - src/loop.js
  - src/main.js
  - src/maps/bunker.js
  - src/scene.js
  - style.css
  - tests/character-art.spec.js
  - tests/multiplayer.spec.js
  - tools/README.md
  - tools/art/.gitattributes
  - tools/art/build_slice.py
  - tools/art/build_soldier.py
  - tools/art/character-params.json
  - tools/art/inspect-character.mjs
  - tools/art/iterate.py
  - tools/art/pipeline.mjs
  - tools/art/provenance.json
  - tools/art/review.mjs
  - tools/art/verify-export.mjs
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-05T13:12:45Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Reviewed the complete Phase 6 textual change scope from `e0570d8^` through
`9d24453`, with all six implementation summaries and relevant runtime callers as
context. Binary Blender/GLB/PNG assets and retained third-party OBJ/license input
were excluded from the textual file count; the published GLB was parsed for the
semantic-check reproduction. Planning artifacts were context only. No structural
pre-pass or external-reviewer evidence was supplied.

Two reproducible correctness defects remain: team identification fails for the
procedural recovery path, and export equivalence can pass when the body is absent
from the active scene. Both findings concern introduced code. Existing inherited
grip limitations, unresolved redistribution terms, pending human aesthetic
acceptance and unmeasured representative-device performance are documented limits,
not newly discovered implementation findings.

The previously completed full gates were not rerun. Focused, read-only Node
experiments confirmed the findings using current source and in-memory GLB
mutations. No implementation, configuration or state files were modified, and no
commit was made.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Procedural fallback loses all team colors

**Classification:** BLOCKER
**File:** `C:/Programowanie/VibeOnDuty/src/builders/characterAppearance.js:32-33`
**Related:** `C:/Programowanie/VibeOnDuty/src/builders/characterAppearance.js:49-54`;
`C:/Programowanie/VibeOnDuty/src/builders/enemyGLTF.js:478-479`;
`C:/Programowanie/VibeOnDuty/src/builders/enemyGLTF.js:329-336`;
`C:/Programowanie/VibeOnDuty/src/builders/enemy.js:5-12`;
`C:/Programowanie/VibeOnDuty/src/network/remoteActors.js:57-60`.

**Issue:** The public `tintEnemyMesh()` now delegates exclusively to the semantic
accent allowlist. The procedural actor returned when the GLB HEAD/GET fails, is
corrupt, or lacks required clips has no `artDomain` metadata on any material/node.
Consequently its accent collection is empty and every requested team assignment
is a no-op. Red/blue online actors and friendly/hostile offline S&D/TDM bots retain
the same green appearance. This regresses the prior public tint behavior in the
explicitly supported playable asset-recovery path, removing its visual team cue
while friendly fire remains enabled.

**Evidence:** Loaded the actual `buildEnemy()` implementation into an isolated
Node harness, substituting only its browser scene/material imports, and passed
two independently built actors through the current `tintCharacterAccents()` with
`0x4488ff` and `0xff5555`. Result:

```json
{"blueUnchanged":true,"redBlueIdentical":true,"accentCount":0}
```

The existing fallback browser tests enter Training Range and check playable
geometry/controls; they do not assign or compare opposing fallback teams.

**Fix:** Give designated procedural clothing/helmet parts explicit
`team-accent` metadata, or implement a dedicated procedural tint policy before
delegating to the GLB accent policy. Keep skin/weapons protected and clone/reuse
owned materials so tinting one procedural actor does not recolor its sibling.
Add a missing/corrupt-GLB team-mode regression that verifies distinct opposing
colors, repeated reassignment and sibling-safe retirement.

### CR-02: Export equivalence omits whether authored meshes actually render

**Classification:** BLOCKER
**File:** `C:/Programowanie/VibeOnDuty/tools/art/inspect-character.mjs:532-551`
**Related:** `C:/Programowanie/VibeOnDuty/tools/art/inspect-character.mjs:609-615`;
`C:/Programowanie/VibeOnDuty/tools/art/inspect-character.mjs:184-252`;
`C:/Programowanie/VibeOnDuty/tools/art/verify-export.mjs:148-163`;
`C:/Programowanie/VibeOnDuty/tools/art/verify-export.mjs:213-214`.

**Issue:** `semantics()` compares the mesh resource table and skin joint hierarchy,
but never records the active scene, scene roots, authored render-node reachability
or each render node's mesh/skin association. `validateStructure()` likewise does
not require the authored body to be reachable from the active scene. A GLB can
therefore retain every geometry/material/image/skin/motion resource yet omit the
human from rendering, and still pass both inspection and semantic equality. The
repeat/restored-source gates consume this false equality as a successful recovery
check. In particular the independently regenerated recovery output is compared
semantically without a fresh rendered comparison of that output.

**Evidence:** Parsed the current shipped `enemy.glb`, removed only the `HumanBody`
node index from `json.scenes[json.scene || 0].nodes`, and encoded a candidate in
memory. The original body's mesh/skin resources and inherited rig were untouched.
Both current checks accepted it:

```json
{
  "humanRemovedFromActiveScene": true,
  "comparison": {
    "equal": true,
    "byteIdentical": false,
    "domains": {
      "mesh": true, "skin": true, "materials": true,
      "images": true, "motion": true
    },
    "differences": []
  },
  "inspectionPassed": true
}
```

`inspectionPassed` used the retained original compatibility baseline, so exact
inherited rig/motion checks did not detect the missing rendered body either.

**Fix:** Extend the semantic mesh domain with a canonical active render graph:
active scene roots, reachable authored node identities, parent relationships and
resolved mesh/skin bindings, plus relevant transforms and rendering metadata.
Use stable semantic identities so harmless serializer index changes still compare
equal. Validate scene/root references and require the expected body/equipment to
be reachable in the inspector. Add negative comparator/inspection tests that
detach `HumanBody`, alter a node's mesh binding or select an empty scene, alongside
a positive serializer-reordering test. Ensure repeat and independent recovery
verification consume the extended comparison.

---

_Reviewed: 2026-10-05T13:12:45Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
