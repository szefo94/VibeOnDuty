---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "02"
subsystem: character-art
tags: [blender, human, paint, materials]
requires:
  - phase: 06-01
    provides: fitted anatomical body, compatible rig and reproducible pipeline
provides:
  - Fitted painted soldier with boots, limb armor and open helmet details
  - Editable M4 and stone illustration source and exported atlas
  - Prefix-aware runtime material wiring and playable missing-image fallback
affects: [06-03, 06-04, 06-05, 06-06]
key-files:
  created: [tools/art/build_slice.py, tools/art/sources/slice.blend, public/textures/comic-slice.png, src/artMaterials.js]
  modified: [tools/art/build_soldier.py, tools/art/character-params.json, tools/art/sources/soldier.blend, public/models/enemy.glb, tools/art/pipeline.mjs, tools/art/provenance.json, src/builders/weapon.js, src/builders/enemyWeapon.js, src/maps/bunker.js, tests/character-art.spec.js]
requirements-completed: [ART-01, ART-02, ART-03]
requirements-note: Technical contributions only; phase-wide completion and human aesthetic acceptance remain pending.
duration: approximately 30min active execution; overnight host suspension excluded
completed: 2026-10-05
status: complete
plan_head_after: ec408ca
---

# Phase 6 Plan 02 — Painted Soldier and Playable Slice

All three implementation tasks are committed. Root reconciled this summary after
the executor session was interrupted during closeout; no implementation was
re-executed or inferred from an agent terminal status.

| Task | Commit | Result |
| --- | --- | --- |
| 1 | 7acd14c | Fitted painted soldier, boots, limb guards, helmet rim/rails/straps, packed paint/normal maps and current-pose checks |
| 2 | 6421343 | Original editable M4/stone atlas source and reproducible image export |
| 3 | ec408ca | Shared illustrated material factory, first/third-person M4 and Greek Columns wiring, missing-atlas and prefixed-build checks |

## Verification evidence

The executor reported all 15 soldier pose samples and all four art-slice cases
passing, including actual TDM world materials, failed-atlas fallback and isolated
`/art-prefix/` production loading. Saved `test-results/.last-run.json` reports
passed with no failed tests. Existing tracer checks also passed during authoring.
The root did not rerun these suites during documentation-only reconciliation.

The saved `06-art/repeat-report.json` records two reopened-source exports with
26,358 vertices, 34,172 triangles, 65 joints and 48 animation entries. Mesh, skin,
materials, image pixels and motion domains compare equal; both byte hashes are
`a2449b048c5a48bb92bb3c1c0cf66209bf669679e24d60932b7934425e287705`.
The report retains source, parameter, script and verified Blender hashes.

Actual pose captures under the ignored `06-art` cache cover idle, directional
locomotion, crouch, jump stages, reload, throw, melee, death, face/hands and shadow.
Executor review corrected collar boundaries, detached torso plates under spine
bending and irregular carrier UV sampling. Root inspected the front/face captures
on resume: human anatomy and equipment are present; runtime contours and protected
team tint remain the following plan's work. Aesthetic acceptance by the user has
not occurred.

Additional captures: `slice-range.png`, `slice-greek-columns.png`, and
`slice-prefix-production.png`. Greek Columns currently uses rectangular structures;
the existing topology, collision and spawns were preserved. No new packages,
animation overhaul, movement changes or server-authority changes were introduced.

## Provenance and limitations

New contributions and CC0 human input remain separate from unresolved inherited
rig/motion terms in the provenance ledger. This summary does not clear those terms,
certify device performance or mark shared art requirements fully accepted.

## Self-Check: PASSED

All three scoped commits and produced assets exist; the saved browser result and
repeat report support the reported checks. Remaining phase plans remain incomplete.
Root-owned temporary config and milestone lock are excluded from this commit.
