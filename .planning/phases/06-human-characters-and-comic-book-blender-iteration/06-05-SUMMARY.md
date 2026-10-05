---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "05"
subsystem: offline-art-iteration
tags: [blender-4.5.13, bounded-python, semantic-export, playwright, source-recovery, tdd]
requires:
  - phase: 06-04
    provides: Accepted editable human/paint sources, protected appearance domains, selective ink and Medium quality
provides:
  - Two fixed inspected offline model/paint operations with pre-mutation validation
  - Actual game before/changed/restored comparison with matching restored pixels
  - Independent restored-source re-export, protected-domain checks and retained provenance
affects: [06-06]
tech-stack:
  added: []
  patterns: [candidate-only iteration, exact owned targets, editable backups, matched game model routing, fresh-process source recovery]
key-files:
  created: [tools/art/iterate.py, tools/art/review.mjs]
  modified: [tools/art/pipeline.mjs, tools/art/verify-export.mjs, tools/README.md, tools/art/provenance.json]
key-decisions:
  - "LLM assistance is inspectable authored offline Python with a fixed versioned numeric operation schema; no prompt execution or deployed AI backend."
  - "Restore separately retained editable source and parameters, then reopen through fresh pinned Blender and verify semantic exports plus matched game pixels."
  - "Candidates enter through the normal model HEAD/GET in the real Training Range; accepted publication and gameplay authority remain intact."
requirements-completed: [ART-01, ART-02, ART-03, ART-04]
requirements-note: Scoped technical contributions; shared phase requirements and subjective human acceptance remain pending until final delivery/review.
coverage:
  - id: D1
    description: Fixed bounded edits reject invalid requests, paths and links before changing retained editable input
    requirement: ART-04
    verification:
      - {kind: integration, ref: "node tools/art/pipeline.mjs self-test", status: pass}
      - {kind: integration, ref: "node tools/art/verify-export.mjs --iteration (Node and direct Blender Python negatives)", status: pass}
    human_judgment: false
  - id: D2
    description: Intended geometry/paint edit differs in actual gameplay and restored editable source independently regenerates baseline semantics and pixels
    requirement: ART-03
    verification:
      - {kind: e2e, ref: "node tools/art/pipeline.mjs iterate --demo; iteration-Bx4Di0/review.json", status: pass}
      - {kind: integration, ref: "node tools/art/verify-export.mjs --iteration", status: pass}
    human_judgment: false
  - id: D3
    description: Human aesthetic acceptance of the complete character/illustrated slice and representative-device performance review
    verification: []
    human_judgment: true
    rationale: Static software-WebGL comparisons establish repeatability, not subjective acceptance or phone/iGPU qualification.
actuals:
  tokens: 14163
  tasks: 2
  commits: 4
plan_head_before: facc4c78ab95d01ae6f00ecd4933c21935df1e93
plan_head_after: 097e45f5ef951a79727702bde9acfb7a43ec415d
duration: approximately 27min
completed: 2026-10-05
status: complete
---

# Phase 6 Plan 05: Bounded Blender Iteration and Editable Recovery Summary

**An inspected offline edit changes two helmet panels and accent paint in the actual game, while restored editable source independently regenerates the baseline export and identical rendered pixels.**

## Performance

- Approximately 27 minutes of execution; first recorded RED artifact: 2026-10-05T08:44:55Z; production tasks committed by 2026-10-05T09:06:14Z. Initial context loading preceded the recorded test timestamp.
- Two tasks, six implementation/documentation/provenance paths, four measured task commits.
- Actual tokens are the scoped realized textual Git diff characters divided by four, rounded upward. The persisted plan ledger measures commits before SUMMARY/state metadata; no harness-token scale is mixed in.

## Accomplishments

- `iterate.py` is the actual inspectable LLM-authored assistance artifact. Version 1 accepts only `helmet-cheek-guard-offset` in -0.025..0.025 metres and `accent-paint-gain` in 0.4..1.3. It selects exactly `HelmetSidePanel-1`, `HelmetSidePanel1`, `TeamAccent` and packed `Paint_team-accent`; no prompt, dynamic selector, eval, generated code, subprocess or network input is supported.
- Node and Python check exact request keys, finite numeric ranges, types, owned roots, input/output aliases, existing output and every linked path component before opening the source or creating edited output. Duplicate keys and unknown request fields reject. Python additionally checks the exact local mesh/material/image shape; CLI factory startup/disabled autoexec and explicit `use_scripts=False` prevent embedded automatic script execution. This is local trusted-source authoring, not a general hostile-Blender-binary sandbox.
- The demo retains independent accepted `.blend` and parameter backups, reopens the baseline, saves an edited candidate and parameters, exports it with the existing exact inherited rig/motion merge, copies the editable backups into recovery files, reopens those recovery files and exports again. Published source, parameters and GLB are never overwritten.
- The reviewer owns a loopback-only Vite server, browser and separate contexts; `finally` retires only those resources. Test-only response routing serves each candidate through the normal model HEAD/GET. It enters the actual Training Range and samples its normal player rig, M4 hand mount, scene, lighting and selective ink. Fixed random values and frozen render ticks permit identical camera, pose, quality and viewport comparison without adding a production debug API or changing server authority.
- Independent verification rechecks artifact/script/runtime identities and the changed domain, compares exact translated panel shape/UVs/weights/winding despite exporter vertex splitting, preserves every other render mesh and complete protected material/image, then reopens and exports restored source through a fresh Blender process. It also runs invalid unknown/range/escape/real-junction cases through both Node and Blender Python and checks source/parameter/publication hashes remain unchanged.
- README records available portable build, export, iterate, inspect and recovery commands, roots, bounds, actual execution history and ownership. Provenance retains executed operation/source/parameter/script/runtime/export/capture identities and independent verification while preserving every inherited unresolved license disposition.

## Task Commits

1. **Task 1 RED:** `3e7323f` — require successful bounded validate-only operation without edited output.
2. **Task 1 GREEN:** `2386241` — fixed Blender edits, safe candidate pipeline and actual game edit/recovery comparison.
3. **Task 2 RED:** `732be90` — require independent restored-source and changed-domain verification.
4. **Task 2 GREEN:** `097e45f` — independent regeneration/rejections, executed provenance and creator documentation.

## Verification and Actual Identities

- `node tools/art/pipeline.mjs self-test`: two named tests pass, covering valid no-mutation validation plus unknown keys, duplicate keys, additional fields, nonfinite/range/type inputs, escapes, input aliases and a real Windows junction. Existing malformed/traversal/link/archive-bomb checks also pass.
- `node tools/art/pipeline.mjs iterate --demo`: passes; rerun after the Task 1 commit as the tracer feedback gate before expansion. The latest retained demonstration is `.planning/research/.cache/06-art/iteration-Bx4Di0/` with `report.json`, `review.json`, editable sources, requests, GLBs and three game PNGs. No skipped task verification.
- `node tools/art/verify-export.mjs --iteration`: passes independently. `--self-test` invokes that exact command and passes its one named integration test. New output is `iteration-Bx4Di0/independent-gjaoTZ/regenerated.glb`; latest verification record is `.planning/research/.cache/06-art/iteration-verification.json`.
- The explicit custom `--validate`, `iterate --source ... --params ... --request ... --out ...`, and `export --source ... --out ...` CLI forms also passed with an additional owned `manual-iteration-59Yflk` candidate. Both validation and edits preserved accepted files.
- `node --check` passes for all three JavaScript tooling modules; scoped Git whitespace checks pass. These are tooling-only changes; full gameplay/client/server regressions are deliberately owned by dependent plan 06-06.

| Identity | SHA256 |
| --- | --- |
| Accepted/baseline/restored editable source | `b90305086f1710a2bf40ffc571cc1d0736694ad3e6b9a86245e5bf9a53afa042` |
| Accepted/baseline/restored parameters | `2b74289e18fd68cacece69af7fde7fe694e5fb6f6d5912ac412dc3c2899eb236` |
| Executed reviewed request | `b9b6b586251e09aa05352ab6ff0ff713ab6528dfed38405cd5f089b851d1d85f` |
| Changed editable candidate | `69eef114226d5cdd5e4966ebef8f5024a27487477279c4a64a48761f2ebfe49e` |
| Accepted/before/restored/independently regenerated GLB | `a2449b048c5a48bb92bb3c1c0cf66209bf669679e24d60932b7934425e287705` |
| Changed GLB | `956f1908d8c65beec2a5689a299310fe225611fc088effd6327095f616b0e052` |
| Pinned runtime archive | `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6` |
| Executed runtime executable | `339c3879999f619ffeb3ff4b53966853153e2e2547d79048ed2886f1826d1306` |

Blender reported 4.5.13 LTS / build `daeeeca98fb0`. Byte equality is an observed additional result: semantic mesh/material/image/skin/motion comparisons independently pass and are the recovery requirement.

The intended edit is a 0.022m downward panel offset plus 0.55 accent paint/base-appearance gain. The changed export differs in mesh and painted images; skin and all 48 motion occurrences remain exact. Independent checks identify only the two panel nodes and `Paint_team-accent` as changed, with complete protected materials/images and other geometry intact.

## Actual Game Review and Limits

Before/changed/restored captures share 1280x960, DPR 1, Medium, idle time 0.4, identical recorded camera/light arrays and exposure 1.05. The real player retains `hand_r` M4 mounting. Each context loads exactly one candidate model GET after its normal HEAD probe. Before/restored PNG and raw RGBA identities match; the changed frame differs. Agent inspection of actual before/changed images confirms the lowered helmet panel and darker shoulder/chest/helmet accent in the intended areas.

The observed baseline/restored raw RGBA hash is `7ba254f40818ced6b5701e1b984486feee2db1d2ea1d7806054791c9904212e9`; changed is `018c3017920feaf6b7d98455ad3c193fbc2f2214fbc82a55a1b37cfa04b473ae`. Browser renderer query reports `WebKit WebGL` under configured headless Chromium/SwiftShader. The static view is relatively shadowed and frames the face/upper body; it establishes the bounded iteration difference and exact recovery, not comprehensive gameplay pose quality, motion shimmer or device performance. Earlier grip/collar/cloth limits and inherited license gaps remain as recorded; human aesthetic acceptance and final broader visual/regression evidence belong to plan 06-06.

## TDD Gate Compliance

Both tasks have committed assertion-based RED before production GREEN. The SDK returned `RED_EVIDENCE_OK` for `05-task1-red.json` and `05-task2-red.json`, which retain actual JUnit failures. Task 1 failed because the valid bounded iterate command was not accepted; Task 2 failed because independent iteration verification was unsupported. GREEN tests pass. Phase-wide `tdd_mode` remains false; task-local TDD was followed. No refactor commit was necessary.

## Deviations from Plan

None in delivery scope. All six declared paths were implemented. No accepted binary asset, application/runtime authority, package, later-phase feature, config or milestone lock was changed. Shared ART checkboxes remain pending because final review spans the remaining phase plan and subjective human judgment.

## Issues Encountered

The loader probes assets with HEAD before GET; the first route assumed GET only. The reviewer now serves both supported methods and collects unexpected-method errors without throwing inside asynchronous route callbacks. The refreshed demo and post-commit tracer pass with proper owned cleanup.

The first independent changed-panel check assumed exporter vertex indices remain stable after translation. Blender may split/reorder normal vertices while preserving the actual panel surface. The check now compares canonical oriented triangle corners using all position/UV/joint/weight channels with the existing 1e-5 tolerance; unchanged meshes retain stricter accessor/index comparisons. A second UV channel in the source is included by deriving channel widths from actual accessor types. These verification corrections preserve complete checks without masking any changed protected domain.

No known stubs, skipped tests, unrun task verification, auth gates or out-of-plan threat surfaces remain. The development reviewer and local file handling are the plan's declared T-06-10/T-06-13 boundaries. No global AI execution, new runtime network endpoint or gameplay mutation API was introduced.

## Next Plan Readiness

Plan 06-06 can consume the restored accepted publication and the documented capture/recovery harness. It owns final combined captures/cost measurements, full regression gates and concrete phase-end human aesthetic review. Human acceptance, inherited licensing and phone/iGPU/Pi/FPS qualification are not inferred from these automation results.

## Self-Check: PASSED

All six declared deliverable files and this canonical summary exist. All four task commits resolve. The persisted ledger range contains four commits and both heads are recorded. Latest demo/capture/independent-verification artifacts exist; accepted source/parameter/export hashes remain unchanged. Root-owned config and milestone lock are excluded from metadata staging.
