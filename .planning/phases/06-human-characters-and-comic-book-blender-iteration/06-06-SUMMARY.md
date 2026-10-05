---
phase: 06-human-characters-and-comic-book-blender-iteration
plan: "06"
subsystem: rendering
tags: [blender, threejs, character, comic, playwright, provenance, resources]
requires:
  - phase: 06-01 through 06-05
    provides: Editable anatomical human, painted slice, selective ink, quality policy and bounded recoverable iteration
  - phase: 01
    provides: Authoritative production multiplayer and owned browser resource fixtures
provides:
  - Corrected current human export and 58 actual-game pose/tier/light captures with 67 retained PNG identities
  - Measured three-tier software-renderer costs and offline/production generation retirement evidence
  - Current-source independent Blender restoration and documented creator workflow
  - Seven passing stable final gates with source/log/export hashes and pending human aesthetic acceptance
affects: [06-verification, 07, 05]
tech-stack:
  added: []
  patterns: [full-pixel actual-game review, scoped warmed GPU measurements, stable sequential browser gates, export-specific retained evidence]
key-files:
  created: [docs/ART.md, .planning/phases/06-human-characters-and-comic-book-blender-iteration/evidence/06-pose-sheet.png]
  modified: [tools/art/review.mjs, tools/art/build_soldier.py, tools/art/provenance.json, tools/art/sources/soldier.blend, public/models/enemy.glb, src/artMaterials.js, src/builders/characterAppearance.js, src/builders/rifleClips.test.js, tests/character-art.spec.js, tests/multiplayer.spec.js, style.css, AGENTS.md, .planning/phases/06-human-characters-and-comic-book-blender-iteration/06-VALIDATION.md, .planning/phases/06-human-characters-and-comic-book-blender-iteration/evidence/06-review.json]
key-decisions:
  - "Correct art-introduced collar, carrier and skin contour defects in the retained source while preserving exact inherited rig/motion and the hand basis."
  - "Treat short synchronous SwiftShader samples as scoped renderer evidence; human aesthetics and representative-device/FPS qualification remain pending."
  - "Preserve browser packed-map rendering while DOM-free imports and animation-only Node GLB parsing isolate image IO."
requirements-completed: [ART-01, ART-02, ART-03, ART-04]
requirements-note: Scoped implementation contributions only; global ART requirements remain pending phase verification and human aesthetic acceptance.
coverage:
  - id: D1
    description: Current human maps, prepared poses, accents and shared resources survive offline and production actor generations
    requirement: ART-01
    verification:
      - {kind: e2e, ref: "Focused character-art plus animation-regressions: 32 passed", status: pass}
      - {kind: e2e, ref: "Production resources: 2 passed; complete test:mp: 14 passed", status: pass}
    human_judgment: false
  - id: D2
    description: Actual-game capture matrix and measured Low/Medium/High renderer and retirement evidence identify the current export
    requirement: ART-02
    verification:
      - {kind: integration, ref: "node tools/art/review.mjs --capture; evidence/06-review.json", status: pass}
      - {kind: e2e, ref: "Complete test:e2e: 45 passed", status: pass}
    human_judgment: false
  - id: D3
    description: Current accepted editable source independently regenerates restored semantics and matching actual-game pixels after bounded edits
    requirement: ART-04
    verification:
      - {kind: integration, ref: "pipeline.mjs iterate --demo; iteration-GKGhaJ/review.json", status: pass}
      - {kind: integration, ref: "verify-export.mjs --iteration; independent-0A0dm5/regenerated.glb", status: pass}
    human_judgment: false
  - id: D4
    description: Human acceptance of proportions, face, grips, armor facets, painted treatment and contours in the running game
    requirement: ART-03
    verification: []
    human_judgment: true
    rationale: Agent inspection of actual captures and passing automated contracts cannot establish a human aesthetic pass.
actuals:
  tokens: 134156
  tasks: 2
  commits: 4
plan_head_before: ac5731535a16446b0fcca80cbb1b38a1dd3ec127
plan_head_after: 373817ea1bca032af225e363c17c0a5d65867697
duration: approximately 229min wall time including usage-limit interruption
completed: 2026-10-05
status: complete
---

# Phase 6 Plan 06: Actual Gameplay Art Review and Stable Delivery Summary

**A corrected editable human is reviewed in 58 actual-game pose/tier/light frames, restored independently through Blender, and delivered with all seven offline/online regression gates passing.**

## Performance

- Two tasks and 16 implementation/documentation/evidence paths; four measured task commits before SUMMARY/state metadata.
- Approximately 229 minutes of wall time from initial context at about 09:11 UTC to closeout about 13:00 UTC. All final gates finished at 10:40:34 UTC; the usage-limit interruption before resumption at about 12:51 UTC accounts for roughly 131 minutes. Wall time does not measure uninterrupted execution effort.
- Actual tokens are the realized scoped UTF-8 Git diff character count (536,621) divided by four, rounded upward. Binary bytes are excluded by Git's textual diff. The extensive per-frame scene/settings/hash ledger explains much of the difference from the estimate; no harness-token scale is substituted. Commit count comes from `.git/gsd-plan-head-before-06-06` through the recorded task head, excluding later metadata commits.

## Accomplishments

- `review.mjs --capture` enters the actual Training Range/Greek Columns through normal game loading. It captures 18 prepared action aliases, matched front/three-quarter face, hands, armed silhouette and first-person M4 at Low/Medium/High, plus blue/red near (~4m) and far (~15m), daylight/shadow, structural and posed Greek Columns views. Added Greek first-person M4 daylight/shadow comparisons complete the 58-frame matrix at 1280x960, DPR 1. Eight exhaustive readable contact sheets and one selected sheet accompany the individual frames: 67 PNGs total.
- Agent inspection used all eight exhaustive sheets and original-resolution face, hands, crouch/run, team and first-person images, plus before/changed/restored game images. The source correction smooths collar/strap lighting normals, extends the neck skin/fabric UV fade, and fits carrier depths with existing blended torso weights. Fine anatomical skin uses the painted pass to remove concave backface-hull speckles; equipment/clothing/weapon ink remains. Authored lighting normals remain separate from outline-only `comicNormal`. These introduced defects were corrected within Phase 6.
- The static review hides the procedural fallback and positions the actual GLTF player as the real loop does. Only owned offline capture contexts freeze their frame ticks. An explicit OS-selected free loopback port avoids Vite's port-zero fallback; owned server/browser/context cleanup runs in `finally`. No new production authority mutation API was added, and another owner's review server remains intact.
- Every tier warms 12 frames, samples 40 synchronous mixer/scene/render/GPU-finish costs, and performs six spawn/tint/retire cycles. Full viewport/DPR, actor count, GPU label, calls, triangles, programs, memory and sample duration are recorded. Production resource scenarios additionally exercise actual human packed maps and accent ownership through life/match/session generations, death/respawn/rematch/rejoin and keeper survival.
- Desktop online pause is placed to the right of the match controls so the expanded quality panel cannot intercept Leave after rematch. The multiplayer test explicitly foregrounds/resumes the relevant browser before checking unlock controls, respecting the actual background-page pause behavior.
- Creator commands, source/domain organization, outline/resource ownership, tier policy and precise limits are documented in `docs/ART.md` and relevant `AGENTS.md` guidance. Provenance retains asset-specific CC0 evidence separately from all unresolved inherited rig/motion/FBX terms. Final validation binds successful command log hashes and the current source/export/capture identities.

## Task Commits

1. **Task 1 RED:** `1d3a4f7` — require real gameplay pose and measured tier evidence.
2. **Task 1 GREEN:** `26a127d` — corrected source/export, actual-game capture and measured art lifetime.
3. **Task 2 repair:** `a93e0f9` — keep authored material imports usable without a browser.
4. **Task 2 delivery:** `373817e` — creator documentation, pose sheet, provenance and stable regression evidence.

## Verification and Actual Identities

- Focused character/art plus current animation browser regressions: **32 passed**. Focused production resource scenarios: **2 passed**. The direct actual-game capture command passed with 58 frames/three measured tiers, and its post-GREEN tracer feedback run passed before expansion.
- Actual source build/probe, exact inherited-domain inspection, bounded iteration demo and independent restored-source verification passed. After accepted source corrections the demonstration was rerun; plan 05's earlier iteration is historical rather than current-export evidence.
- The current reviewed snapshot was captured at `2026-10-05T10:23:35.889Z` on final source revision `a93e0f94163ce67f17d0fe286768e6c0661c7240`. All 67 retained PNG hashes and all 17 current source hashes were checked during closeout. Later commits contain documentation/provenance/evidence only.

| Stable final command | Latest result | Completed UTC |
| --- | --- | --- |
| npm run lint | PASS, zero warnings | 10:20:36 |
| npm run typecheck | PASS | 10:20:37 |
| npm run typecheck:mp | PASS | 10:16:21 |
| npm test | PASS, **273 tests in 25 files** | 10:21:34 |
| npm run build | PASS; existing >500 kB chunk warning | 10:21:35 |
| npm run test:e2e | PASS, **45 tests** | 10:31:08 |
| npm run test:mp | PASS, **14 tests** | 10:40:34 |

The first full unit attempt failed at Node image boundaries; its setup failures
automatically skipped seven cases. The repaired complete run passed all 273
cases, with no intentional skips. Only affected lint/root types/unit checks were
repeated, then the remaining build/browser gates completed sequentially. The
strict multiplayer gate was unaffected by that Node-only repair. Successful logs
and their hashes are retained; the overwritten initial streams are explicitly
marked `logSuperseded` in evidence, alongside their actual failed attempt counts.

| Current identity | SHA256 |
| --- | --- |
| Published / baseline / restored / independent regenerated GLB | `3d92a093fc6724c295fdabb456d41110a0b03fc7f72f565b42b36c4c09b00847` |
| Accepted / restored editable soldier source | `d657f3d906a23e344e0188b9b060ca57f7e19d860530fe0618a6dd6a1178a4f7` |
| Accepted / restored character parameters | `2b74289e18fd68cacece69af7fde7fe694e5fb6f6d5912ac412dc3c2899eb236` |
| Published shared M4/stone atlas | `7faae7a58bb4669af51c5081c772be671af8544681c762af54f9263995a4c31e` |
| Final tracked evidence JSON | `3944d4c0cd0217896b6f69eb26380175a4e13baa57be35d8fca8379436bf330f` |
| Selected actual-game pose sheet | `5ac0756438ca0e0588aab1410a479849cbf6fbc3a94fa3946717204c08a905fa` |

Final inspector: **26,416 vertices / 34,172 triangles / 65 joints / 48 animation
occurrences**, with exact protected inherited skeleton/inverse-bind/motion domains.
The accepted source recovery is retained at
`.planning/research/.cache/06-art/iteration-GKGhaJ/`, including
`independent-0A0dm5/regenerated.glb`. Before/restored game pixels are identical;
changed game pixels differ. Input/publication hashes remain unchanged by the demo.
The verified runtime is portable Blender 4.5.13 LTS, build `daeeeca98fb0`.

Full capture/report evidence remains in
`.planning/research/.cache/06-art/reviewed-3d92a093fc67/`.
Successful final logs and `final-gates.json` are under the same owned `06-art`
cache root. Tracked `evidence/06-review.json` carries these identities and the
selected `evidence/06-pose-sheet.png` is directly reviewable.

## Measured Scope and Remaining Review Limits

| Tier | Median / p95 ms | Sample duration ms | Calls / triangles / programs |
| --- | --- | --- | --- |
| Low | 4.1 / 13.9 | 222.8 | 365 / 35,442 / 12 |
| Medium | 8.8 / 16.6 | 337.5 | 1,102 / 86,418 / 15 |
| High | 11.7 / 21.6 | 489.2 | 1,317 / 87,198 / 15 |

Windows headless Chromium reports ANGLE Vulkan **SwiftShader**. All tiers use
one visible human at 1280x960/DPR 1 and retain 428 geometries / 60 textures across
the six warmed retirement cycles. Short synchronous GPU-completion samples omit
normal input/network/whole-game work and exhibit run-to-run jitter; earlier High
p95 exceeded 50ms. They establish no 60 FPS, phone, iGPU, gaming-PC or Pi
qualification. Production resource fixtures retain their existing 200x150/DPR
0.25 limit; the full-pixel posed/team images come from actual offline gameplay.

Human aesthetic acceptance remains **pending**. The inherited support-hand barrel
wrap/precise finger grip, carrier edge protrusions, beveled armor facets, and
first-person box-based M4 geometry/close framing remain visible review limits.
Static prepared aliases cannot certify transition motion or shimmer; existing
real animation tests establish contracts. Training Range is authored ambient/dark;
Greek shadow is a controlled key-off comparison retaining ambient/fill/torches.
Inherited rig/motion/animation FBX/weapon FBX redistribution evidence remains
unresolved; the CC0 anatomical body does not clear the combined GLB.

## TDD Gate Compliance

Task-local TDD was followed. RED required a real `--capture` report and failed
because the old reviewer did not implement that operation (report was null).
The persisted RED JSON/XML passed `check tdd-red-evidence` as
`RED_EVIDENCE_OK`. GREEN delivered real game frames, tier samples and resource
checks, followed by a passing end-to-end tracer rerun. Final regression repair
isolated Node image IO while preserving real rig/motion buffers and all browser
packed-image rendering. Phase-wide MVP/TDD mode was disabled; no phase gate was
bypassed and no tests were disabled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected introduced visible source and review defects.**
Task 1 inspection found collar/skin seams, faceted straps, floating carrier panels,
concave skin hull artifacts and incorrect static player/fallback placement.
The retained source, appearance policy and actual-game reviewer were corrected
within the plan's explicitly permitted prior-source ownership. Current export,
focused browser checks, iteration recovery and final captures were regenerated.
Commit: `26a127d`.

**2. [Rule 1 - Bug] Restored online Leave access and realistic background checks.**
The expanded desktop settings panel could intercept Leave; the compact layout now
reserves match controls. Production unlock assertions foreground/resume their
target page before checking real pause state. Files: `style.css`,
`tests/multiplayer.spec.js`. Commit: `26a127d`.

**3. [Rule 3 - Blocking issue] Restored Node import and animation-test boundaries.**
The complete unit gate revealed `document` image IO from Phase 6 materials during
pure Node map imports and missing `self` during animation-only GLB parsing.
`artMaterials.js` provides unmapped fallback materials outside a DOM; the real-rig
Node test scopes a texture-decoding mock and restores it in `finally`. Browser
tests continue decoding the actual packed images. Targeted five files/35 tests,
affected final gates and full browser gates passed. Commit: `a93e0f9`.

Infrastructure recovery used an actual OS free port, interval polling while owned
RAF was frozen, exports before Windows watcher/browser runs, sequential suites
sharing Playwright output, and stable source during browser validation. Failed or
interrupted runs were replaced by actual passing evidence. These repairs add no
package, server authority surface, retargeted clip or hand-basis overhaul.

## Known Stubs and Threat Review

No new UI/data stub, TODO/FIXME, intentionally skipped test or unrun automated
verification was introduced. Manual aesthetic acceptance is deliberately pending,
with human-judgment coverage above. The trust surfaces remain the planned bounded
local file workflow and owned test/review fixtures; no additional endpoint,
authentication path or schema trust boundary was introduced. Package dependencies
were unchanged, production authority remained intact, and file/fixture ownership
and source/export/review identities mitigate the planned threat register.

## Next Phase Readiness

All six Phase 6 implementations are delivered and ready for phase verification.
Global ART requirements and the Phase 6 acceptance checkbox remain pending human
review. The selected 6 → 7 → 5 order remains intact; Phase 7 and Phase 5 have not
started. Another owner's existing review server and root-owned configuration/lock
are preserved. No publication, push or deployment was performed.

## Self-Check: PASSED

All eight key delivered source/documentation/evidence paths exist; all four task
commits resolve. Closeout verified 67 retained image hashes, 17 current source
hashes and all seven successful gate log hashes. The current recovery source and
independent regenerated export match the final accepted identities. Root-owned
configuration and milestone lock were excluded from task staging.
