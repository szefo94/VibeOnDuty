---
phase: 06-human-characters-and-comic-book-blender-iteration
verified: 2026-10-05T14:06:51Z
source_head: 515dff5b8726c5a16805def72515115d80a8203d
status: human_needed
score: 18/23 must-haves verified
roadmap_score: 2/4
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 7
  total: 7
  not_honored: []
covered_files:
  - .gitignore
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-01-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-01-SUMMARY.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-02-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-02-SUMMARY.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-03-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-03-SUMMARY.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-04-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-04-SUMMARY.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-05-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-05-SUMMARY.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-06-PLAN.md
  - .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-06-SUMMARY.md
  - AGENTS.md
  - docs/ART.md
  - index.html
  - public/models/enemy.glb
  - public/textures/comic-slice.png
  - src/artMaterials.js
  - src/builders/characterAppearance.js
  - src/builders/characterAppearance.test.js
  - src/builders/characterResources.js
  - src/builders/enemy.js
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
  - tools/art/sources/LICENSE.ASSETS.md
  - tools/art/sources/LICENSE.md
  - tools/art/sources/base.obj
  - tools/art/sources/slice.blend
  - tools/art/sources/soldier.blend
  - tools/art/verify-export.mjs
covered_digest: "v2:sha256:776ed3c85996bb1cb5071e6bec84875676a2649681b1e82612c0ea037daee56d"
human_verification:
  - test: "Inspect the human and current M4 grips in Training Range and Greek Columns TDM, using V for third person and near/far views while walking, crouching, jumping and reloading."
    expected: "Explicitly accept the current proportions, face, silhouette, equipment fit and weapon contact, or identify required changes; specifically decide whether the visible support-hand barrel wrap and carrier/armor facets are acceptable for this slice."
    why_human: "The shipped asset and prepared poses work, but credible appearance and acceptable contact are judgments. No human aesthetic pass exists; static captures and mount/finite-transform tests cannot supply one."
  - test: "Compare Low, Medium and High in menu/pause and play the character/M4/Greek Columns slice in daylight and shadow, in first and third person."
    expected: "Explicitly accept the illustrated paint, soft forms, internal/outer ink, team readability and current first-person M4 form/framing; observe near/far moving outlines and report objectionable gaps or shimmer."
    why_human: "Maps, tiers and resource behavior are implemented and tested. Chosen comic appearance, weapon presentation and moving readability remain subjective; SwiftShader captures and short timings do not certify those judgments or physical-device FPS."
---

# Phase 6: Human Characters and Comic-Book Blender Iteration Verification Report

**Phase Goal:** As a browser player and creator, I want to see an accepted human character and comic-book visual slice that I can reproduce and improve through Blender, so that gameplay has the chosen appearance and creators can iterate it recoverably.
**Verified:** 2026-10-05T14:06:51Z
**Status:** human_needed
**Re-verification:** No — initial phase verification; no previous 06-VERIFICATION.md exists.

Technical delivery is supported by source, actual exports, runtime tests and retained evidence. The full goal is **not yet certified**: accepted appearance and credible grips require the two human decisions below. There are no observed missing/stub/unwired technical deliverables, no unresolved code-review blockers and no accepted verification overrides. Phase 6 and ART-01/02 must remain pending; this report does not advance Phase 7.

## User Flow Coverage

The centralized user-story validator returned `valid:true`. This table leads the MVP report; automated technical evidence below supports the reviewable flow but does not substitute for its final human acceptance.

| Step | Expected | Evidence in the codebase and runtime artifacts | Status |
| --- | --- | --- | --- |
| Open the game and enter Training Range/TDM | Loading settles; the anatomical soldier and equipped current M4 are playable | `main.js:517` awaits loadAll; `enemyGLTF.js:280,288` probes/loads the real prefix-aware GLB; tracer, fallback and production entry tests | VERIFIED — operational flow |
| Inspect the character in first/third person and near/far poses | Visible human face/fingers, fitted equipment and acceptable current weapon grips | Actual HumanBody/equipment/rig plus original 1280×960 face, hands, crouch and team captures; support hand visibly wraps the barrel | UNCERTAIN (WARNING) — human acceptance required |
| Select Low/Medium/High and inspect character, M4 and Greek Columns | One live persisted setting presents the chosen illustrated slice | Both native selects, single handler, shared DPR/shadow/ink policy; actual character maps and M4/stone atlas; tier/capture/resource tests | VERIFIED technically; chosen appearance UNCERTAIN (WARNING) |
| Open editable source and perform the documented bounded edit | A real Blender operation changes only the inspected panel/paint area | `iterate.py`, pinned invocation, current `iteration-G2mHM3` source/request/export records and before/changed game images | VERIFIED |
| Restore source and regenerate its prior appearance | Reopened editable backup produces the same complete render graph, material/image/skin/motion output | `restored.blend`, fresh `independent-ssqk2m/regenerated.glb`, schema 2 equality and matching before/restored game PNGs | VERIFIED |
| Outcome: chosen appearance and recoverable creator iteration | Both parts of the story are achieved | Recoverable iteration established; human aesthetic acceptance still explicitly pending | UNCERTAIN (WARNING) — human_needed |

## Goal Achievement

### Observable Truths

All four ROADMAP success criteria are retained verbatim. PLAN truths add detail; repeated bounded edit/export/review/restore truths from 06-05 and 06-06 are covered by roadmap truth 4. No roadmap scope was removed. The five uncertain rows share the two concrete human checks; they are not five separate implementation defects.

| # | Truth / source | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Players inspect accepted humanlike proportions, silhouettes, and weapon grips in the running game; editable model sources and asset-specific provenance accompany the accepted character. (ROADMAP SC1) | UNCERTAIN (WARNING) | Real anatomical asset, editable source and asset-specific ledger verified. No human pass; original hands capture shows support-hand barrel wrap. H1 required. |
| 2 | A representative character, weapon, and existing-environment slice shows the chosen illustrated textures, stylized lighting, and scalable outlines at the agreed visual quality settings. (ROADMAP SC2) | UNCERTAIN (WARNING) | Character packed paint, M4/stone atlas, existing soft lighting and tiers are wired and rendered. Chosen appearance/M4 presentation still needs H2. |
| 3 | A creator changes a model or material using the verified Blender automation path, exports it reproducibly, and compares the result in-game before acceptance. (ROADMAP SC3) | VERIFIED | Current reviewed code plus executed pinned-Blender repeat/demo/recovery artifacts; verifier independently compared complete schema 2 exports and viewed current before/changed/restored images. |
| 4 | A creator performs an LLM-assisted Blender change through an available documented integration or script workflow, inspects the change, and restores the prior editable source version. (ROADMAP SC4; 06-05/06-06 D-07) | VERIFIED | Inspected offline LLM-authored `iterate.py`; exact numeric operations; candidate-only editable backups, actual game comparison and independent regenerated baseline. No model API/backend is required by D-07. |
| 5 | D-01: The real game loads a fitted anatomical human with a visible face, separate fingers and credible current rifle contact. (06-01) | UNCERTAIN (WARNING) | Face/digits and real-loader path established; credible contact is not established by hand mount tests. H1 includes visible barrel wrap. |
| 6 | D-02: The first exported human already wears original fitted chest armor and an open helmet; subsequent authoring expands this same asset. (06-01) | VERIFIED | `build_soldier.py` authors ChestPlate/BackPlate/OpenHelmet and subsequent guards/boots; current active render graph requires those reachable skinned nodes; actual images show them. |
| 7 | D-07: A verified portable Blender invocation creates an editable .blend and compatible GLB through reviewed source code. (06-01) | VERIFIED | `pipeline.mjs:198–225` uses pinned executable/factory startup/disabled autoexec/Python exit failure; actual probe/repeat/recovery logs and source/export identities retained. |
| 8 | Asset-specific CC0 base evidence and unresolved inherited rig/motion evidence remain distinguishable. (06-01) | VERIFIED | Exact retained base/header/license hashes, separate ledger roles/dispositions; rig/motion/weapon FBX terms remain unresolved. Whole GLB is not labelled CC0 or license-cleared. |
| 9 | D-01/D-02: An anatomical adult soldier has a visible face, distinct fingers, fitted armor and reliable current weapon grips. (06-02) | UNCERTAIN (WARNING) | Anatomy/equipment load and prepared poses remain finite, with the M4 on hand_r. Reliable/acceptable precise grips remain H1; no inference from mount angle tests. |
| 10 | D-03/D-04/D-05: Character, M4 and Greek Columns show painted soft forms, internal black linework, muted surfaces, wear and bounded colored accents. (06-02) | VERIFIED | Actual packed character maps and original 1024px atlas flow to current meshes; paint/wear/seams visible in original face/M4/stone/team captures. Aesthetic acceptance remains truth 2. |
| 11 | D-07: The complete illustrated asset remains editable and reproducibly exported from Blender. (06-02) | VERIFIED | Soldier/slice .blend files and packed source maps; saved-source reopen/export paths; current soldier repeat outputs and independent recovered output match all semantic domains. |
| 12 | D-03/D-04: Actual skinned silhouettes carry strong black contours with soft painted surfaces and finer internal ink. (06-03) | VERIFIED | Same geometry/skeleton projected-normal pass, selective equipment/clothing/weapon eligibility, paint-only fine skin/collar; real black-pixel/render tests and current images establish implemented contours. Human intensity/readability judgment remains H2. |
| 13 | D-05: Team changes tint designated accents only; skin, ink, fabric and weapon colors survive. (06-03) | VERIFIED | Allowlisted clone/reuse/restoration in `characterAppearance.js`; current named reassignment test passes; actual-GLB offline/remote and fixed procedural fallback tests exercise protected identities/colors/maps. |
| 14 | D-06: Repeated tinting and actor retirement free owned ink/materials without destroying live shared geometry/textures. (06-03) | VERIFIED | Disposer registration and once-only retirement; verifier's named sibling/template retirement test passes. Real-browser 14-cycle keeper/program plateau and production generation/rejoin checks provide GPU evidence. |
| 15 | D-06: Players choose persisted Low/Medium/High graphics quality in menu or pause, with immediate matching current/future appearance. (06-04) | VERIFIED | Single named change owner, exact enum/persistence, scene initial/resize application and global current/future ink tier. Verifier's named storage/error and shadow restoration tests pass; real browser quality/resize cases exercise controls and spawns. |
| 16 | D-03/D-04: Every tier retains painted internal detail and soft forms; scalable silhouette work follows the tier. (06-04) | VERIFIED | No paint removal in tier policy; Low base only, Medium actor/M4 ink, High selected stone; actual matched three-tier paint frames and renderer pass assertions. |
| 17 | D-01/D-07: Failed detailed asset loading keeps a playable fallback and accurate recovery copy. (06-04) | VERIFIED | Settled readiness/fixed text, procedural builder fallback and independent atlas failure path; missing/corrupt media and opposing fallback actor regression evidence; CR-01 fixed. |
| 18 | D-01/D-02/D-03/D-04/D-05: Iteration preserves the accepted anatomy, fitted armor, paint, ink and accent domains except the intended bounded edit. (06-05) | UNCERTAIN (WARNING) | Protected geometry/material/image/skin/motion preservation is technically verified, including intended panel offset/accent change. The word accepted cannot be asserted for the baseline without H1/H2. |
| 19 | D-06: The local scripted workflow changes visual source without actor identity, gameplay authority or device-performance claims. (06-05) | VERIFIED | Fixed local scripts and response-only test routing; phase diff has no server/shared/protocol/package change; documented scoped software timings, no device/FPS qualification. |
| 20 | D-01/D-02: Agent-reviewed real-game human face, hands, armor and grips survive the current posed animation and gameplay pipeline. (06-06) | VERIFIED | Real GLB prepared-pose finite/mount tests, 18 alias capture samples, existing rig/track/action tests and actual offline/production lifecycle checks. Survival of sampled contracts is distinct from accepted grip/motion quality. |
| 21 | D-03/D-04/D-05: Matched real-game captures demonstrate illustrated contours, soft painted forms, wear and accent-only teams on character/M4/Greek Columns. (06-06) | VERIFIED | Hashed 58-frame matrix and 67 PNGs; normal game loading/renderer, matching viewport/tier/pose/light; original images inspected in this verification. |
| 22 | D-06: All three quality tiers have measured renderer/frame/resource costs and accurately scoped device evidence; 60 FPS remains a target. (06-06) | VERIFIED | 12 warm-up/40 synchronous samples and six retirement cycles per tier; one visible actor, 1280×960/DPR1, Windows Chromium/SwiftShader; actual costs and omitted workload explicitly recorded. |
| 23 | Human aesthetic acceptance, inherited license unknowns and unmeasured device qualification remain explicitly distinct from automated/agent evidence. (06-06) | VERIFIED | CONTEXT, docs/ART, provenance, tracked evidence and current UI/security/review reports consistently retain pending judgment, unresolved terms and measured scope. |

**Score:** 18/23 truths verified; 5 UNCERTAIN warnings; 0 FAILED blockers; 0 present-but-behavior-unverified truths. Roadmap contract alone: 2/4 verified, 2/4 require human judgment. Neither score claims accepted appearance.

### Required Artifacts

The automated artifact helper passed all 22 declarations across six plans (19 unique artifacts). Existence results were followed by source/substance, consumer and real-data checks:

| Artifact | Expected | Status | Substantive implementation / wiring |
| --- | --- | --- | --- |
| `tools/art/pipeline.mjs` | Pinned acquisition/build/probe/iteration | VERIFIED | Hash/ZIP/path bounds, safe argument-array Blender invocation, source reopen, compatibility merge, tracer before atomic publication; documented executable CLI paths. |
| `tools/art/build_soldier.py` | Human fit and original equipment/paint | VERIFIED | Source landmarks, fitted anatomical topology/digit skinning, armor/helmet/packed maps, editable save and exporter. No placeholder anatomy. |
| `tools/art/sources/soldier.blend` | Editable human, rig/actions/paint | VERIFIED | Current source hash and independently retained/reopened backups; fresh regenerated GLB matches complete canonical mesh graph/materials/images/skin/motion. |
| `public/models/enemy.glb` | Real-game human | VERIFIED | Own inspector: 26,416 vertices, 34,172 triangles, 65 joints, 48 animation occurrences, required reachable body/equipment. Normal browser loader consumes it. |
| `tools/art/provenance.json` | Distinct source/license/runtime identities | VERIFIED | Actual asset-specific URLs, exact hashes, exporter policy and current iteration/recovery records; unresolved inherited roles preserved. |
| `tools/art/sources/slice.blend` | Editable M4/stone paint | VERIFIED | Original packed per-domain paint layers, swatch materials and atlas; build/export reopen implementation and executed atlas repeat identity. |
| `public/textures/comic-slice.png` | Original bounded illustrated atlas | VERIFIED | Nonuniform 1024×1024 image with fixed metal/polymer/stone regions, real browser decoding and missing-image fallback. |
| `src/artMaterials.js` | Shared illustrated material factory | VERIFIED | Prefix-aware atlas loader, shared regions, sRGB, successful/error material handling; imported/used by both M4 builders and bunker slots. |
| `src/builders/characterAppearance.js` | Protected team tint/ownership | VERIFIED | Semantic allowlist, immutable base restoration, reusable actor-owned accent clones; both GLTF builders and tint hook consume it. |
| `src/comicOutline.js` | Skinned selective contour renderer | VERIFIED | At most one extra pass, shared rig/geometry, outline-only normals, explicit cache expiry/owner teardown and finally restoration; gameplay loop calls it. |
| `src/graphicsQuality.js` | Bounded persisted rendering policy | VERIFIED | Exact enum, one session setting, storage errors, DPR caps/shadow restoration; UI and scene initial/resize consumers. |
| `index.html` | Labelled controls and asset status | VERIFIED | Both native selects, labels/help/status and three options; named main.js owner binds them. |
| `tools/art/iterate.py` | Fixed inspectable Blender edits | VERIFIED | Two numeric operations, exact owned targets and pre-open rejection; saves candidate source/parameters/operation identities. |
| `tools/art/verify-export.mjs` | Independent restored-source verification | VERIFIED | Fresh Blender export, schema 2 complete comparison, precise edited domains, negative Node/Python operations and retained input hashes. |
| `tools/art/review.mjs` | Real-game capture/measurement | VERIFIED | Own free loopback listener, normal model routing/game contexts, actual rig/scene rendering and finally cleanup; retained matching source/export/capture identities. |
| `tools/README.md` | Executed creator commands/recovery | VERIFIED | Real supported command forms, exact operations/ranges/roots and editable-source recovery, not binary-only rollback. |
| `docs/ART.md` | Workflow/ownership/review limits | VERIFIED | Concrete available tooling and architecture, current review scope and visible limits; no invented acceptance. |
| `evidence/06-review.json` | Hashed execution/capture evidence | VERIFIED | Current schema 2 recovery and focused fixes alongside historical full gates, failed attempt retained, asset/source/log/capture hashes independently checked. |
| `evidence/06-pose-sheet.png` | Reviewable actual-game comparison | VERIFIED | Selected real captures; full originals/eight sheets retained separately. Its display is supporting evidence, not a human pass. |

### Key Link Verification

The literal-path helper reports only pipeline → build script. Its other matches are false negatives: it searches the full target path inside the source, including binary/reverse-provider relationships and relative imports. All 15 distinct declared links were manually traced below; no override was needed and no helper false negative was accepted without code/runtime evidence.

| From | To | Via | Status / evidence |
| --- | --- | --- | --- |
| pipeline | build_soldier.py | Pinned executable and failure-safe flags | WIRED — `blender()` passes the reviewed script and explicit mode/source/output arguments. |
| soldier.blend | enemy.glb | Reopen/export + compatibility merge | WIRED — exportSource opens the actual source, exports render data then merges exact baseline rig/motion; current repeat/recovery outputs match publication. |
| enemy.glb | enemyGLTF.js | Normal prefix-aware HEAD/GET loader | WIRED — loader lines 280/288, alias preparation and SkeletonUtils clones; actual browser images/tests load publication. |
| build_soldier.py | published GLB | Candidate export/publication | WIRED — authored save/export → pipeline inspection/tracer → pending-file rename, not a direct script write to publication. |
| artMaterials | bunker.js | Existing material slots | WIRED — illustratedClone used for floor/wall/top/trim/ramp; shared numeric world topology/spawns unaffected. |
| artMaterials | weapon.js / enemyWeapon.js | First/third-person M4 surfaces | WIRED — makeIllustratedMaterial metal/polymer consumed by current M4 parts in both builders. |
| enemyGLTF | characterAppearance | Clone/tint hooks | WIRED — imports and apply calls on player/enemy clones; tintEnemyMesh delegates to protected accents. |
| characterResources | comicOutline | Registered cleanup callback | WIRED — outline registers disposeComicOwner callback; disposeCharacter executes registered owner callbacks once. |
| loop.js | comicOutline | Render before eye restore | WIRED — renderComicScene inside try, simulation camera restored in finally; runtime error assertion and current named render-state test. |
| main.js | graphicsQuality | One synchronized control owner | WIRED — onGraphicsQualityChange → set/sync/apply; both selects share listener/help/status. |
| graphicsQuality | comicOutline | Tier policy | WIRED — applyGraphicsQuality calls global setComicQuality; existing/future nodes selected each render. |
| scene.js | graphicsQuality | Initial and resize policy | WIRED — initial renderer and rsz both call the same bounded policy. |
| iterate.py | soldier.blend | Owned editable candidate/backup | WIRED — pipeline copies accepted source/params, passes baseline candidate explicitly; Python opens/saves exact approved local objects without overwriting publication. |
| verify-export | review.mjs | Before/changed/restored identities | WIRED — pipeline calls reviewIteration; independent verifier consumes that report, verifies matching model/image/settings identities and restored pixels. Indirect report seam is intentional. |
| multiplayer tests | remoteActors | Production generation retirement | WIRED — production fixture/UI drives actual session/life/match/rejoin paths; keeper maps/accent resources observed via the existing frozen debug surface. |

### Data-Flow Trace (Level 4)

| Rendered artifact | Variable/value | Real source → consumer | Status |
| --- | --- | --- | --- |
| Anatomical player/offline/remote body | Mesh/skin/actions/maps | Saved Blender fit/paint → shipped GLB → normal loader → template/instance builders → existing mixer/game loop | FLOWING — actual source topology/maps, not empty props or mannequin-only shader changes |
| M4 first/third person | Illustrated metal/polymer material | Packed editable slice atlas → public PNG → region textures → both procedural M4 builders → real renderer | FLOWING — actual decoded image; fallback is a tested error branch |
| Greek Columns | Painted stone slots/structural ink | Original atlas → illustratedClone slots → existing level geometry; High contour eligibility → renderer | FLOWING — current map surfaces and gameplay geometry, no static mock scene substituted for capture matrix |
| Blue/red accents | Actor-owned accent color | Authoritative snapshot team → remote owner tint callback → designated clone materials; offline team assignment uses same hook | FLOWING — source/base maps stay shared; server state is not authored by materials |
| Graphics controls/renderer | tier, DPR, shadows, ink | Valid saved preference/session change → single UI sync/apply → scene resize/current renderer/global contour policy | FLOWING — deterministic default and error recovery, tested state changes |
| Iteration comparison | source/export/model/image identities | Real editable backup → bounded Blender candidate → normal model request routing → actual Training Range player/scene render → restored editable fresh export | FLOWING — changed pixels differ and restored identities match |

### Behavioral Spot-Checks

All commands in the first five rows ran in this verifier process, each under three seconds. Name filtering intentionally excludes the other tests; Vitest reports them as skipped for that invocation. Source contains no disabled requirement-linked tests, and this does not relabel the historical complete run as skipped coverage.

| Behavior | Exact command | Result | Status |
| --- | --- | --- | --- |
| Render failure restores original arrays/callbacks/visibility/state | `node node_modules/vitest/vitest.mjs run src/comicOutline.test.js -t 'restores arrays, callbacks, visibility and renderer state when ink rendering throws'` | 1 named test passed; injected second-pass failure exercised | PASS |
| Double retirement preserves sibling/template geometry/maps | `node node_modules/vitest/vitest.mjs run src/builders/characterAppearance.test.js -t 'retires one clone twice without freeing sibling/template geometry or maps'` | 1 named test passed; owned disposal exactly once | PASS |
| Tier transitions restore original shadow policy | `node node_modules/vitest/vitest.mjs run src/graphicsQuality.test.js -t 'restores the original shadow policy without changing type or dimensions'` | 1 named test passed across repeated tier transitions and enabled/disabled origins | PASS |
| Reassignment reuses owned accents and restores neutral | `node node_modules/vitest/vitest.mjs run src/builders/characterAppearance.test.js -t 'reuses one owned accent through repeated assignments and restores neutral base'` | 1 named test passed | PASS |
| Storage errors retain validated session selection | `node node_modules/vitest/vitest.mjs run src/graphicsQuality.test.js -t 'contains read/write/getter failures and validates the session choice'` | 1 named test passed for getter/read/write/null storage failures | PASS |
| Published body/rig/motion invariants | `node tools/art/inspect-character.mjs public/models/enemy.glb --baseline .planning/research/.cache/06-art/baseline.glb` | Current GLB passes; 26,416 vertices / 34,172 triangles / 65 joints / 48 clips | PASS — verifier process |
| Complete retained recovered/independent render output | Node inline read-only `compareSemanticExports()` on current publication and `iteration-G2mHM3/{before,changed,restored}.glb`, independent regenerated output | Schema 2: restored/independent equal and byte-identical; changed mesh/material/images differ, skin/motion exact | PASS — verifier process |
| Evidence identities | Node inline SHA256 check over current assets, all 67 image records, runtime-tool/iteration files and successful/failed command logs | 121 checks, zero mismatches | PASS — verifier process |

No server/service, Blender export, full suite or state-changing creator operation was started during verification. Current actual-browser transitions are supported by inspected behavioral assertions and retained executed gates, not grep alone. No observed behavior-dependent truth lacks an exercised invariant. Visual/moving readability remains ordinary human judgment, not silently counted as behavior-verified acceptance.

### Probe Execution and Retained Runtime Evidence

No `scripts/` directory, conventional `probe-*.sh` or declared shell probe exists. Shell-probe execution is N/A. The phase's Node/Blender probe and repeat/demo commands have real independent executed artifacts/logs; those were read and identity-checked here. They were not rerun because they write cache/source candidates or start browser services, and the orchestrator required preservation of completed expensive checks.

| Runnable probe/check | Retained evidence | Result and scope |
| --- | --- | --- |
| `pipeline.mjs probe --provenance` / `build --probe` | Actual version/RNA/acquisition/source records and current unchanged build script/source identities | Executed pinned Blender 4.5.13 LTS/build daeeeca98fb0; bounded source inputs and real-loader tracer. Not newly executed here. |
| `inspect-character.mjs --self-test` | Current `06-review-fix-inspector.log` plus independent review original negative reproduction | 12/12; detachment/empty active scene/binding/transform/render metadata negatives reject; index-reordering positive passes. |
| `pipeline.mjs self-test` | Current `06-review-fix-pipeline.log` | 2/2; operation/schema/path/link/archive rejection. |
| `pipeline.mjs iterate --demo` | Current successful log and `iteration-G2mHM3/report.json`, source/request/candidates/game PNGs | PASS: intended edit and matching recovered pixels. The separate failed pixel attempt is retained and is not passing evidence. |
| `verify-export.mjs --iteration` | `iteration-G2mHM3/independent-ssqk2m/regenerated.glb`, current report/log | PASS: fresh source reopen and full schema 2 identity; rejected unknown/range/escape/real-linked-output operations preserve inputs. |
| `verify-export.mjs --repeat` | `repeat-1kHLuM/{first,second}.glb` and current repeat report/log | PASS: two fresh Blender processes, complete schema 2 semantic equality and observed byte identity. |
| `review.mjs --capture` | Export-bound `reviewed-3d92a093fc67/report.json` and 67 actual PNGs | PASS at a93e0f9: 58 pose/tier/light frames, three measured tiers and owned cleanup; subjective acceptance remains pending. |

### Regression Evidence and Source Identity

The preserved complete gates belong to source `a93e0f94163ce67f17d0fe286768e6c0661c7240`. Log hashes and actual output were checked, including **273/273 unit tests in 25 files, 45 offline browser tests and 14 production multiplayer tests**. Lint, root types, multiplayer types and build also passed; the build retains its existing >500kB chunk warning. These include the preceding Phase 1 regression coverage and real packed-map loading. They are historical full runs, not a claim of a new complete run at 515dff5.

Subsequent source changes are separately qualified: CR-01 procedural fallback team accents has actual-builder 6/6 and missing/corrupt browser 2/2 evidence; CR-02 has inspector 12/12, original detached-body reproduction rejected, pipeline 2/2, fresh repeat/demo/independent recovery and lint/types/build. Independent targeted review is clean. The later fae889a copy/CSS repair has scoped main ESLint, three compact interaction cases and five fresh viewport measurements; current UI review is 22/24 with only appearance warnings. Of the tracked capture source hashes, only `style.css` differs from the current file, as expected after that repair. Published GLB/source/atlas identities are unchanged.

The earlier unit image-boundary failure, superseded streams and a separate pixel-comparison retry failure remain recorded. The latter failed despite byte-identical GLBs; the subsequent complete demo passed. It establishes capture nondeterminism as a known tooling limit, not silently guaranteed pixel reproducibility under every run.

### Requirements Coverage

All four IDs appear across the six plans and in Phase 6 REQUIREMENTS traceability. No orphaned Phase 6 requirements were found.

| Requirement | Source plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ART-01 | 01–06 | Accepted proportions/silhouettes/grips, editable sources and provenance | NEEDS HUMAN | Technical source/load/rig/ownership/provenance established; acceptance/precise contact remains H1. Inherited terms remain explicitly unresolved. |
| ART-02 | 02–06 | Chosen comic textures/lighting/scalable outlines on representative slice | NEEDS HUMAN | Actual material/tier/runtime/resource implementation established; chosen appearance/M4/moving readability remains H2. |
| ART-03 | 01/02/05/06 | Verified Blender iteration/export and in-game comparison before acceptance | SATISFIED technically | Actual edit, repeated compatible export, matched real game comparison and independent editable regeneration. Acceptance of the resulting appearance is still a separate human decision. |
| ART-04 | 01/05/06 | Available documented LLM-assisted script workflow, inspectable edits and recoverable prior source | SATISFIED | Fixed inspectable LLM-authored Python, real pinned invocation, pre-open validation and source backup/reopen/regeneration. |

### Decision Coverage

Central `check.decision-coverage-verify` result: **all 7 trackable CONTEXT.md decisions are honored by shipped artifacts**; 7/7, no not-honored entries. Source tracing agrees: actual anatomical construction/equipment, paint/ink/accent policy, scalable browser tiers with honest measurements and real bounded Blender iteration. This advisory result does not establish a human aesthetic pass.

### Test Quality Audit

| Test file/tool | Linked requirements | Active / disabled | Circularity and strongest assertion | Verdict |
| --- | --- | --- | --- | --- |
| characterAppearance.test.js | ART-01/02 | 6 active, 0 disabled | Actual fallback builder plus protected identities, reassignment and once-only sibling-safe retirement; behavioral/value assertions | Adequate for ownership/tint; no aesthetic claim |
| comicOutline.test.js | ART-02 | 7 active, 0 disabled | Deliberate render exception/restoration, cache replacement/expiry and disposal; mocked renderer proves state contracts, not GPU appearance | Adequate alongside actual-browser coverage |
| graphicsQuality.test.js | ART-02 | 14 active expanded cases, 0 disabled | Independent expected enum/caps/shadow/storage outcomes, repeated transitions | Adequate |
| character-art.spec.js | ART-01–04 | Active parameterized browser cases, 0 disabled | Real GLB image decode, finite posed vertices/mount, actual UI/storage/fallback/tiers and keeper plateau; screenshots are review evidence, not golden aesthetic assertions | Adequate technically; H1/H2 remain |
| multiplayer.spec.js | ART-01/02 preservation | 14 complete historical cases, 0 disabled | Normal production fixture/UI lifecycle and observed generation-owned maps/accents/keeper survival | Adequate for tested authority/lifetime scope |
| inspector / verify-export | ART-01/03/04 | 12 inspector negatives/positives plus actual repeat/recovery | Independent corrupt/detached graph controls; retained pre-phase skeleton/motion oracle; semantic compare includes render graph, not only arrays | Adequate for export/recovery |

No disabled requirement-linked test or circular golden generation was found. Tests writing capture/report files preserve actual observations; they do not generate a visual expected value from the implementation and call it acceptance. Same-source repeat/recovery deliberately tests determinism and restoration, with separate negative controls and inherited compatibility baseline. It does not prove aesthetic correctness.

The disconfirmation pass found: (1) accepted credible grips are only partially established; (2) the soldier test's finite sampled vertices and hand_r mount can pass while the visible grip is poor; (3) an interrupted/OOM process between independent candidate publication steps is outside the demonstrated in-process error/recovery checks. The third is a verification limit, with retained baseline/candidate recovery available; no reproduced failure of a must-have was observed and no new blocker is inferred.

### Anti-Patterns and Limits

| File/evidence | Pattern | Severity | Impact/disposition |
| --- | --- | --- | --- |
| Changed production/tool/test files, markup/CSS | Unreferenced TBD/FIXME/XXX, disabled requirements tests, render/data stubs | None found | Empty/no-op matches are intentional shader callbacks, validated empty test cases or playable nonbrowser/media error paths; real browser data flows were traced. |
| Original hands PNG; docs/ART.md:125 | Support fingers wrap exposed barrel | WARNING | Concrete H1 decision; not accepted solely because inherited pose/mount is preserved. |
| Original first-person M4 PNG; weapon.js box parts | Broad box-based receiver/close framing | WARNING | Concrete H2 decision; paint alone is not a finished weapon acceptance. |
| Current face/equipment/pose PNGs | Carrier edge protrusions and beveled armor facets | WARNING | Present honestly for H1/H2; anatomical/equipment implementation exists, subjective quality is unresolved. |
| Failed pixel retry log | Restored capture mismatch with byte-identical exports | INFO | Failed attempt retained; fresh complete demo passes. Cause not certified and repeatability guarantee is limited to demonstrated runs. |
| provenance.json | Unresolved inherited rig/motion/animation FBX/weapon FBX terms | INFO — declared source limitation | Exact CC0 body evidence does not clear combined asset; no unsupported whole-asset clearance. Requirement is an honest asset-specific ledger, not invented license acceptance. |
| SwiftShader measurement / static aliases | Unmeasured physical-device FPS and continuous-motion shimmer | INFO / human visual scope | 60 FPS stays target. Physical phone/iGPU/Pi qualification belongs to later named phases; static samples are not motion acceptance. |

Configured security verification is ASVS L1 source/evidence depth: 14/14 planned threats have implemented mitigations, zero open high threats. This verifier observed corresponding bounded input/path/runtime/material/fixture controls and unchanged server/shared authority scope; it does not expand that audit into penetration testing. No PLAN prohibition/backstop block is declared, so none is silently resolved.

### Human Verification Required

The end-of-phase human check in 06-06-PLAN was harvested and merged with the warnings above. Earlier agent-only image checks are recorded as agent evidence, not multiplied into additional human approvals.

#### H1. Accept or revise the current human and grips

**Test:** Enter Training Range and Greek Columns TDM. Use V and near/far views; inspect the face, full silhouette, equipment, hands and M4 contact while walking, crouching, jumping and reloading. Compare the original `range-medium-range-ambient-face-front-idle.png`, `range-medium-range-ambient-hands-idle.png`, armed crouch/run frames and daylight team frames under `.planning/research/.cache/06-art/reviewed-3d92a093fc67/`.
**Expected:** Record explicit acceptance or concrete required changes for the proportions/face/silhouette/equipment/grips. Specifically decide whether the existing support-hand barrel wrap, finger contact, carrier edges and armor facets are acceptable for this delivered slice.
**Why human:** Numeric skin/mount/alias tests and agent inspection cannot define acceptable human appearance/contact. Those visible limits have not received a human disposition.

#### H2. Accept or revise the comic slice and moving readability

**Test:** Compare Low/Medium/High using menu/pause. Play Training Range and Greek Columns in first/third person; inspect daylight/shadow and near/far moving actors. Review matched face/hands/first-person M4 and stone/team tier frames, including `review-sheet-4.png`, `review-sheet-6.png` and `review-sheet-8.png`.
**Expected:** Record explicit acceptance or concrete required changes for painted forms, internal/outer linework, localized team accents, current M4 silhouette/framing and moving near/far outline readability. Note objectionable gaps/shimmer visible during ordinary play.
**Why human:** Rendering/tier/resource contracts pass, while the chosen comic appearance, weapon presentation and moving visual quality remain judgments. The short one-actor SwiftShader samples provide no representative-device/FPS certification.

### Gaps Summary and Phase Boundary

No technical gap remains in the established Phase 6 contract. CR-01/CR-02 are closed by actual fixes, negative reproductions and focused runtime/export evidence; UI copy/spacing/cascade fixes have fresh viewport evidence. The report remains **human_needed** because the required accepted/credible appearance wording is unresolved. Human rejection with concrete required changes would create actionable gaps; it has not happened yet.

No must-have was deferred to manufacture a passing status. Current grip/appearance decisions remain in Phase 6. The roadmap's broader animation/transition work is Phase 7, actual omnimovement integration is Phase 5, sustained device qualification is Phase 2, and measured Pi hosting is Phase 4. These later commitments are not new Phase 6 blockers and are not claimed complete. Phase 1's historical human pass/report identity is untouched.

The report was created with the available apply_patch file tool because this runtime exposes no Read/Write tool. The literal supplied root-pin script passed before the write with process-only Git trust. No source/config/STATE/REQUIREMENTS edit, commit, publication or later-phase action occurred during this verification.

---

_Verified: 2026-10-05T14:06:51Z_
_Verifier: the agent (gsd-verifier)_
