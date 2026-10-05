---
phase: 06-human-characters-and-comic-book-blender-iteration
reviewed: 2026-10-05T13:39:00Z
reviewed_commit: 675b746985d20c104ccf9f9a3831010a33df5c09
diff_base: 201021f
depth: standard
review_mode: targeted_fix_rereview
initial_reviewed_commit: 9d2445397a1bc5fd77402eb6f3f78649468f08e4
initial_review_commit: 201021f
initial_files_reviewed: 34
files_reviewed: 8
files_reviewed_list:
  - docs/ART.md
  - src/builders/characterAppearance.test.js
  - src/builders/enemy.js
  - tests/character-art.spec.js
  - tools/README.md
  - tools/art/inspect-character.mjs
  - tools/art/provenance.json
  - tools/art/verify-export.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings:
  - id: CR-01
    original_classification: BLOCKER
    fix_commit: 9a566d115d81e7aa7b861ec488b8f12c74738827
    status: resolved
  - id: CR-02
    original_classification: BLOCKER
    fix_commit: 0010cfec6166990840005dbcfa8835f72b5e489f
    status: resolved
status: clean
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-05T13:39:00Z

**Depth:** standard, targeted fix re-review

**Files Reviewed:** 8

**Status:** clean — both original blockers resolved; zero remaining findings.

## Summary

Re-reviewed only the two original BLOCKER findings after fixes `9a566d1` and
`0010cfe`, at current HEAD `675b746`. Read the fix report, all eight changed
textual source/test/documentation files and relevant existing appearance/resource
callers. The original review in `201021f` covered 34 Phase 6 textual files at
`9d24453`; that broader review was not repeated. The file list above records the
actual targeted re-review scope. Planning evidence was supporting context, not
a source file in that count. No structural pre-pass or external evidence lane
was supplied.

No remaining issues found in the reviewed fixes. The original fallback-color and
detached-body reproductions now pass their corrected contracts. Focused inspector
regressions pass **12/12**, with no skips. Current retained independent recovery and
repeat evidence uses semantic schema 2 and matching source/tool/export identities.
No implementation/configuration/state files were modified and no commit was made.

## Narrative Findings (AI reviewer)

No open BLOCKER or WARNING findings remain in this targeted re-review.

## Resolved Historical Findings

### Resolved original finding CR-01: Procedural fallback loses all team colors

**Original classification:** BLOCKER.

**Original location:** `C:/Programowanie/VibeOnDuty/src/builders/characterAppearance.js:32-33`.

**Fix:** `9a566d115d81e7aa7b861ec488b8f12c74738827`.

**Current status:** resolved.

The actual procedural builder now tags three uniform materials and the helmet as
designated team accents; skin and weapons retain protected domains. The existing
appearance owner clones those shared accents per actor, reuses them on reassignment
and retires only actor-owned resources. Read the new actual-builder unit regression
and both missing/corrupt-GLB browser regressions, including opposing offline teams,
remote-owner assignments and sibling-safe retirement.

Repeated the original isolated Node reproduction using the current actual builder
and current `tintCharacterAccents()`; only browser scene/material imports were
substituted. Result:

```json
{
  "accentCount": 4,
  "opposingColorsCorrect": true,
  "reassignmentReusesOwned": true,
  "templatesUnchanged": true,
  "protectedShared": true
}
```

The fixer's focused 6-test appearance suite and two fallback-team browser tests
are recorded as passing in the fix report. Those browser tests were not repeated
during this source review.

### Resolved original finding CR-02: Export equivalence omits whether authored meshes actually render

**Original classification:** BLOCKER.

**Original location:** `C:/Programowanie/VibeOnDuty/tools/art/inspect-character.mjs:532-551` at the original reviewed revision.

**Fix:** `0010cfec6166990840005dbcfa8835f72b5e489f`.

**Current status:** resolved.

The semantic mesh domain now includes the canonical active render graph:
scene roots, authored identities, reachability, parent/child relationships,
resolved mesh/skin bindings, local transforms, morph weights and rendering
metadata. The inspector validates scene references and requires the authored
body/equipment to be reachable and bound to the expected rig. Repeat and independent
restored-source verification explicitly consume semantic schema 2.

Repeated the exact original in-memory reproduction: removed only the `HumanBody`
node index from the current shipped GLB's active scene roots. Current comparison
reports `equal:false`, `domains.mesh:false` and a
`mesh.renderGraph.nodes.51.reachable` difference. Current inspection rejects it
with `Required reachable body/equipment render node: HumanBody`. Unmodified current
publication still passes inspection against the original compatibility baseline.

Re-ran `node tools/art/inspect-character.mjs --self-test`: **12 passed**, zero
failures/skips. These include body/equipment detachment, empty active scenes,
binding/parent/transform/rendering-metadata changes and positive serializer
node/mesh/skin/scene reordering. Read the schema-2 assertions in both verification
callers.

The fix report's `requires human verification` label marks the semantic-algorithm
change under its fixer contract. Adversarial source review, the original negative
reproduction, focused regressions and current fresh-Blender evidence close the
code-correctness finding. It is not an unresolved behavior or an assertion of
human visual/aesthetic acceptance.

## Verification Evidence and Limits

Checked **35 retained identities** across successful/failed command logs, current
inspector/verifier/build/pipeline/review/iteration scripts, published GLB, editable
source, repeat and independent reports, retained demonstration files and independent
regenerated output. **Zero hash mismatches.** The retained restored, independent
regenerated and repeat outputs compare equal under schema 2 and are byte-identical
to the accepted publication:

`3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`.

One extra iteration attempt failed restored browser pixel identity despite
byte-identical model exports. Its failed log and exit code 1 remain recorded in
`evidence/06-review.json`; it is not passing evidence. The later retained complete
demo reports restored pixel equality, and its independent recovery/repeat artifacts
and current tool hashes match. This review does not establish the cause of the
observed pixel-capture flake.

No full unit/offline/multiplayer suite or Blender export was repeated in this
targeted re-review. Earlier full gates remain historical evidence at their recorded
source revision; focused fix gates and fresh Blender outputs are separately
identified by the fix report and current evidence.

Human aesthetic acceptance remains **pending**. Inherited support-hand/barrel
fitting, motion quality and unresolved redistribution terms remain documented
limits. Headless SwiftShader checks establish no representative-device/FPS
qualification. These scope limits are separate from the two resolved code defects.

---

_Reviewed: 2026-10-05T13:39:00Z_

_Reviewer: gsd-code-reviewer_

_Depth: standard, targeted fix re-review_
