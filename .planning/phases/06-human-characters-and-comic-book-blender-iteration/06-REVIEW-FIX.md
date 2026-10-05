---
phase: 06-human-characters-and-comic-book-blender-iteration
fixed_at: 2026-10-05T13:36:17Z
review_path: .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Source review:** `06-REVIEW.md`, committed in `201021f`.
**Iteration:** 1

Both in-scope BLOCKER findings were fixed and committed independently. No source
fixes were skipped. The published character, editable Blender source, parameters
and atlas were not changed.

## Fixed Issues

### CR-01: Procedural fallback loses all team colors

**Files modified:** `src/builders/enemy.js`,
`src/builders/characterAppearance.test.js`, `tests/character-art.spec.js`.
**Commit:** `9a566d1` — `fix(06): CR-01 restore owned procedural team accents`.
**Status:** fixed.

The actual procedural builder now explicitly designates its three uniform
materials and helmet material as team accents. The existing appearance owner
clones each shared accent once per actor and reuses it across reassignment.
Skin and weapon materials are explicitly protected. Retirement disposes owned
accents and the flash once without freeing shared materials or sibling resources.

The unit regression uses the actual builder with only browser dependencies mocked.
Two browser regressions route the real GLB request to a missing/corrupt response,
enter offline TDM through its normal menu, and exercise the online remote owner
with independently built opposing fallback actors. They check nonempty designated
accents, distinct friendly/hostile and blue/red colors, repeated reassignment,
protected skin/weapons and sibling-safe retirement.

A read-only negative control loaded the builder from `201021f`: accent count was
zero and opposing actors remained identical. The current regressions pass.

### CR-02: Export equivalence omits whether authored meshes actually render

**Files modified:** `tools/art/inspect-character.mjs`,
`tools/art/verify-export.mjs`, `docs/ART.md`, `tools/README.md`,
`tools/art/provenance.json`, phase `evidence/06-review.json`.
**Commit:** `0010cfe` — `fix(06): CR-02 validate canonical authored render graph`.
**Status:** fixed: requires human verification.

Semantic comparison schema 2 includes a canonical active render graph within the
mesh domain: scene identity/roots, node reachability, parents/children, resolved
mesh/skin bindings, local transforms, morph weights and rendering extras/extensions.
Material rendering extras also survive comparison. Authored NFC-normalized names
are stable identities; ambiguous identities reject instead of silently matching.

The inspector validates active-scene/root references, requires the core authored
body/equipment as reachable skinned render nodes, checks the anatomical body's
mesh/rig identity, and rejects unreachable nodes, inconsistent equipment skin
bindings and any authored mesh resource whose render binding has been removed.
Repeat and independent restored-source callers explicitly require schema 2.

Negative cases cover detached body/helmet, an empty selected scene, removed mesh
bindings, changed mesh/skin associations, parent relationships, translation,
rotation, zero scale and node/material rendering metadata. A positive case
reorders node/mesh/skin indices, scene roots and active-scene indices while
preserving semantic equality. The packed-PNG test fixture now preserves the
current character's other texture references when replacing its test image.

A read-only comparison against the inspector from `201021f` confirmed that both
old inspection and comparison accepted the detached body; both current checks
reject it. Fresh repeat and independent recovery exports consumed schema 2 and
retained complete mesh/material/image/skin/motion equality.

The human-verification flag identifies the semantic algorithm change under the
fixer contract. Automated regressions pass; this report records no human visual
or aesthetic acceptance.

## Verification

All checks ran in the **main checkout**, with existing dependencies and the pinned
portable Blender 4.5.13 LTS. `workflow.use_worktrees=false` was honored. The literal
bound root pin ran before the first write and each normal-hook atomic commit.

| Command | Result |
| --- | --- |
| `npx vitest run src/builders/characterAppearance.test.js` | 6 passed |
| `CI=1 npx playwright test tests/character-art.spec.js --grep 'art fallback teams' --workers=1` | 2 passed |
| `node tools/art/inspect-character.mjs --self-test` | 12 passed |
| `node tools/art/pipeline.mjs self-test` | 2 passed |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run typecheck:mp` | passed |
| `npm run build` | passed; existing large-chunk notice |
| `node tools/art/pipeline.mjs iterate --demo` | changed pixels differ; restored pixels match |
| `node tools/art/verify-export.mjs --iteration` | fresh independent source export, schema 2 equality, negative request checks passed |
| `node tools/art/verify-export.mjs --repeat` | two fresh Blender processes, schema 2 equality and byte identity |
| Modified JS/MJS `node --check`, re-read and `git diff --check` | passed |

The current evidence records exact tool/runtime/artifact/log hashes and the latest
executed iteration directory. The prior current iteration is retained in provenance
history. Previous full-gate logs remain intact: 273 unit tests, 45 offline browser
tests and 14 production multiplayer tests. Those full suites were not rerun for
these focused fixes; their original source identity remains recorded.

One additional demo attempt failed restored browser pixel identity despite
byte-identical model exports. Its log is retained as
`.planning/research/.cache/06-art/06-review-fix-iteration-failed-pixels.log` and recorded
in current evidence. Subsequent fresh complete demos passed; the failed attempt is
not passing evidence. The final retained demo, independent recovery and repeat
reports all match the current inspector and verifier hashes.

**Unchanged published GLB SHA256:**
`3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847`.

Human aesthetic acceptance remains pending. Inherited support-hand/barrel fitting,
motion quality and redistribution terms remain explicit limits. Headless
SwiftShader results do not qualify representative devices or gameplay FPS.

---

_Fixer: gsd-code-fixer. Report intentionally left uncommitted for the orchestrator._
