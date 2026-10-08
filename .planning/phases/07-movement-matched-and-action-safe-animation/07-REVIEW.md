---
phase: 07-movement-matched-and-action-safe-animation
reviewed: 2026-10-08T04:51:43Z
depth: standard
diff_base: 63873ba7209af111963e680137ff1361bd8c7779
review_head: 720a1f6e34f64631e6ace5838121a5ef2fb04d9c
files_reviewed: 67
files_reviewed_list:
  - AGENTS.md
  - docs/ANIMATION-REVIEW.md
  - docs/ART.md
  - index.html
  - public/models/enemy.glb
  - src/builders/animationPresentation.js
  - src/builders/animationPresentation.test.js
  - src/builders/characterResources.js
  - src/builders/enemyAnimations.js
  - src/builders/enemyAnimations.test.js
  - src/builders/enemyGLTF.js
  - src/builders/enemyGLTF.test.js
  - src/builders/enemyWeapon.js
  - src/builders/firstPersonRig.js
  - src/builders/firstPersonRig.test.js
  - src/builders/weapon.js
  - src/builders/weaponFBX.js
  - src/builders/weaponHandling.js
  - src/builders/weaponHandling.test.js
  - src/combat/shoot.js
  - src/dev/animationReview.js
  - src/dev/animationReview.test.js
  - src/editor/mapEditor.js
  - src/entities/actionLifecycle.js
  - src/entities/actionLifecycle.test.js
  - src/entities/enemyUpdate.js
  - src/entities/friendlyBots.js
  - src/entities/grenades.js
  - src/entities/player.js
  - src/input.js
  - src/loop.js
  - src/main.js
  - src/modes/buyMenu.js
  - src/modes/tdm.js
  - src/network/onlineSession.js
  - src/network/remoteActors.js
  - src/network/remoteActors.test.js
  - style.css
  - tests/action-lifecycle.spec.js
  - tests/animation-baseline.spec.js
  - tests/animation-motion-source.spec.js
  - tests/animation-presentation.spec.js
  - tests/animation-regressions.spec.js
  - tests/animation-resources.spec.js
  - tests/animation-review.spec.js
  - tests/character-art.spec.js
  - tests/first-person-rig.spec.js
  - tests/multiplayer.spec.js
  - tests/weapon-handling.spec.js
  - tools/README.md
  - tools/art/animation-budget-v2.mjs
  - tools/art/animation-budget-v2.test.mjs
  - tools/art/animation-capture.mjs
  - tools/art/animation-capture.test.mjs
  - tools/art/art-motion.test.mjs
  - tools/art/build_motion.py
  - tools/art/inspect-character.mjs
  - tools/art/motion-manifest.json
  - tools/art/motion-pipeline.mjs
  - tools/art/motion-pipeline.test.mjs
  - tools/art/moving-online.mjs
  - tools/art/multiplayer-qualified.config.mjs
  - tools/art/offline-qualified.config.mjs
  - tools/art/pipeline.mjs
  - tools/art/provenance.json
  - tools/art/review.mjs
  - tools/art/verify-export.mjs
findings:
  critical: 5
  warning: 1
  info: 0
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-08T04:51:43Z  
**Depth:** standard, explicitly retained for the full scope  
**Files Reviewed:** 67  
**Status:** issues_found

## Summary

The review found one shipped directional-motion defect, two acceptance-evidence defects, two browser-test execution blockers and one ineffective browser assertion. The runtime action, presentation, handling and view paths were traced through their callers and retirement adapters; tooling validation and changed browser fixtures were checked against their actual dependencies. The published GLB was inspected through its real animation accessors. The binary editable `motion.blend` was not treated as source text. Planning artifacts and ignored generated files are outside the source scope.

The findings below are source defects, not an assertion that Phase 7 is complete. Plans 09/10 remain halted. Prior full-suite failures, the incomplete/nonpassing frozen-V2 candidate and missing death/respawn/online unions remain open; their existence alone is not reported as a newly diagnosed runtime bug. No host or transport cause was established here. This review ran bounded read-only/in-memory probes, without browser suites, Blender exports, asset publication, source edits, staging, commits or stopping other jobs. No structural pre-pass or external reviewer evidence file was supplied.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A historical body line can qualify a halted Plan 09 summary

**Severity:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/tools/art/animation-capture.mjs:29-30`  
**Affected caller:** `C:/Programowanie/VibeOnDuty/tools/art/animation-capture.mjs:701-710`

**Issue:** `requirePlan09()` searches the entire Markdown document with a multiline regular expression. It does not read the frontmatter status. A summary whose authoritative status is `halted` is accepted if a historical example, quoted output or code block elsewhere contains `status: complete`. With otherwise valid current qualification evidence, this sets `plan09Qualified` to true and removes the mandatory non-halted-summary gate. The current qualification also fails other gates; this defect does not claim that the current full capture actually passes.

**Reproduction:** A read-only call using the real exported function returned `true` for this summary and a complete/current qualification containing both executed, passing required assertions and valid log hashes:

```text
---
status: halted
---
Historical example:
status: complete
```

**Fix:** Parse only the leading YAML frontmatter, require one unambiguous `status` field equal to `complete`, and reject missing/malformed/duplicate status fields. Body text must have no influence. Add negative controls for a halted frontmatter plus a complete body line/code block, duplicate frontmatter statuses and missing frontmatter, alongside a real complete-frontmatter positive control. Keep the existing identity, actual-V2, assertion and log checks.

### CR-02: Crouch authoring overwrites direction and ships four identical gaits

**Severity:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/tools/art/build_motion.py:125-135`  
**Affected runtime:** `C:/Programowanie/VibeOnDuty/src/builders/animationPresentation.js:106-122`; `C:/Programowanie/VibeOnDuty/src/builders/enemyAnimations.js:493-497`  
**Affected asset:** `C:/Programowanie/VibeOnDuty/public/models/enemy.glb`, animations `vod7_crouch_forward`, `vod7_crouch_back`, `vod7_crouch_left`, `vod7_crouch_right` (binary asset; source lines above are the defect location).

**Issue:** The directional lower-body branch first applies the requested thigh axis/sign. The following crouch branch assigns new thigh/calf/foot quaternions and discards those directional transforms. The resulting published directional crouch clips are identical. The runtime projects actual displacement onto the actor's current body yaw and selects/blends these distinct direction IDs; it does not rotate the whole body to turn identical clips into sideways/backward gait. Crouched backward and sideways travel therefore play the forward crouch leg motion, violating the movement-matched directional behavior.

**Reproduction:** The shipped GLB was parsed with `parseGLB()` and its sampler inputs/outputs read with `accessor()`. Comparing each channel's target bone/path, times and values returned:

```json
{"channels":[22,22,22,22],"equalToForward":[true,true,true,true]}
```

This compares actual motion buffers, not names or clip counts.

**Fix:** Compose the crouch base pose with the directional stride instead of overwriting the stride; preserve the requested movement plane/sign with consistent calf/foot contact. Regenerate a candidate donor/manifest/export through the motion validator and inspect current backward/sideways crouch playback. Add an actual-channel or sampled-foot-motion regression distinguishing the four directions, and preserve inherited art/skin/motion domains. The accepted GLB/donor/manifest are currently frozen by the Phase 7 contract: implement and validate candidate-only changes first; any publication and resulting lineage update require the separately reviewed scope. Do not silently overwrite protected assets or widen numerical bounds.

### CR-03: Runtime manifest changes are invisible to source qualification identities

**Severity:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/tools/art/review.mjs:388-403`  
**Affected gates:** `C:/Programowanie/VibeOnDuty/tools/art/animation-capture.mjs:18-42`; `C:/Programowanie/VibeOnDuty/tools/art/animation-budget-v2.mjs:172-173,253-254`  
**Runtime dependencies:** `C:/Programowanie/VibeOnDuty/src/builders/animationPresentation.js:1,106-110`; `C:/Programowanie/VibeOnDuty/src/builders/enemyGLTF.js:25`; `C:/Programowanie/VibeOnDuty/src/builders/weaponHandling.js:2,70-77`; `C:/Programowanie/VibeOnDuty/src/dev/animationReview.js:1`.

**Issue:** The identity collector hashes selected art files and `.js` files under `src`, but omits `tools/art/motion-manifest.json`. This JSON is executable runtime configuration: its values determine clip aliases, cycle distances/cadence, action durations and physical handling markers. Changing it leaves source identity equality unchanged. The V2 verifier likewise only compares/hashes listed identities. Protected provenance contains the accepted manifest hash, but these acceptance paths do not compare the actual manifest bytes with that field. Consequently current-source/stable-gate evidence can be reused after a runtime configuration change, and before/after capture identity checks cannot detect a manifest change during collection.

**Reproduction:** A pure in-memory probe changed valid `walk_forward.cycleDisplacement` to `12`; the real `validateManifest()` accepted the modified object. Executing the current extracted identity collector with manifest-only read substitution produced:

```json
{"manifestAcceptedWithChangedCadence":true,"manifestWasRead":0,"manifestListed":false,"identitiesEqual":true}
```

No repository file was changed.

**Fix:** Bind runtime JSON dependencies explicitly at collection and actual acceptance. A repair preserving the frozen reference/budget/sampler already has a trusted accepted value: `C:/Programowanie/VibeOnDuty/tools/art/provenance.json:8`, `originalMotion.manifestSha256`, is protected by existing V2 identities and equals the current actual manifest hash `af139b82f372c8b66c994a519fbe5a685cae23dc5b5153c8607578ef02f296c5`. Compare actual manifest bytes to this protected value before/after collection and within the independent V2 CLI; record explicit dependency identity in separate new evidence. Reject mismatches and add a manifest-only mutation negative. Preserve historical evidence, reference/budget hashes and numerical limits; a genuinely changed accepted manifest needs explicit new approved lineage and fresh applicable qualification, not reinterpretation of old results.

### CR-04: New browser fixtures require Git history absent from CI checkout

**Severity:** BLOCKER  
**Files:** `C:/Programowanie/VibeOnDuty/tests/animation-resources.spec.js:7-9`; `C:/Programowanie/VibeOnDuty/tests/weapon-handling.spec.js:9-12`  
**Caller context:** `C:/Programowanie/VibeOnDuty/.github/workflows/test.yml:14`; `C:/Programowanie/VibeOnDuty/.github/workflows/deploy.yml:24-25`.

**Issue:** Both test modules synchronously run `git show 1e537a4:<source>` during module import to obtain the uncached comparison implementation. The test workflow uses `actions/checkout@v4` without a history-depth override. That action's [official input definition](https://raw.githubusercontent.com/actions/checkout/v4/action.yml) defaults `fetch-depth` to 1. A fresh CI checkout therefore lacks this older commit; `execFileSync()` throws during Playwright discovery, before the browser assertions can run. The reusable test job also gates deployment. The local full-history checkout hides this failure. This is an introduced test-execution defect and is separate from the retained local multiplayer failures.

**Evidence:** Both unconditional import-time calls were read in current source; the commit exists in this local checkout, and the CI checkout configuration contains no fetch-depth override. Missing Git objects cause the synchronous commands to fail; no CI browser run is claimed here.

**Fix:** Check in the exact immutable uncached comparison implementations as test fixtures with their expected hashes and load them relative to the test module, retaining the equivalence assertions. Avoid a runtime dependency on a historical short SHA or this machine's `safe.directory` path. If history is deliberately chosen instead, explicitly fetch and verify the full pinned commit in every supported test entry point; a workflow-only fix leaves shallow/local/source-archive runs broken. Verify test discovery in a clean shallow checkout.

### CR-05: Animation-review tests serve a fixed Windows directory instead of their checkout

**Severity:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/tests/animation-review.spec.js:8-10,141-142`  
**Runner context:** `C:/Programowanie/VibeOnDuty/.github/workflows/test.yml:12`.

**Issue:** The new fixture sets Vite's root to the literal `C:/Programowanie/VibeOnDuty` and writes evidence under that same absolute directory. CI runs on Ubuntu, where this is not the checked-out repository. A different Windows checkout also serves the wrong or missing source tree. The owned server cannot load the expected game, so readiness/browser assertions fail; if that directory happens to exist, the fixture can test another checkout and save evidence outside its own workspace. Existing neighboring new fixtures already derive the root from `import.meta.url`.

**Fix:** Derive a single repository root with `fileURLToPath(new URL('../', import.meta.url))`, pass it to Vite and derive the cache/evidence path from that root (or use `testInfo.outputPath()` for ordinary attachments). Use the existing free-port/strict-bind fixture pattern when updating this owner. Preserve all current UI/contact assertions. Verify from a differently named checkout and the actual Linux CI job.

## Warnings

### WR-01: Blocked-gait browser assertion inspects inactive source aliases

**Severity:** WARNING  
**File:** `C:/Programowanie/VibeOnDuty/tests/animation-presentation.spec.js:49-55`  
**Driver context:** `C:/Programowanie/VibeOnDuty/src/builders/enemyAnimations.js:374-384,493-506`.

**Issue:** The actual loaded-rig driver renders private copied lower-body actions, such as `vod7_walk_forward_lower`, and stops the original source aliases. The wall-blocked browser test instead sums `playerActions.walk/run/strafe_*` scheduled weights. These are zero during ordinary moving masked locomotion too, so its `travellingWeight < 0.01` assertion cannot detect a gait still playing against the wall. The separate displacement assertion verifies collision, but does not make this animation assertion meaningful.

**Reproduction:** A bounded in-memory probe executed the current presentation driver and normalizer with real Three.js mixer/mask actions (unrelated handling/disposal hooks were inert). It produced:

```json
{"poseMoving":true,"sourceWalkScheduled":false,"testedTravellingWeight":0,"actualLayers":[{"clip":"walk_forward_lower","scheduled":true,"weight":1},{"clip":"m4_ready_upper","scheduled":true,"weight":1}]}
```

**Fix:** Inspect `inspectPresentationLayers()` or the existing `window.__presentationDebug().layers` and assert the actual scheduled lower movement contribution. Include stationary `speed`, `cadence` and repeated foot-pose observations after the brief stop transition settles. Add a positive moving control showing that the same helper detects a contributing locomotion mask; this prevents a permanently zero measurement from passing the negative case.

---

_Reviewed: 2026-10-08T04:51:43Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_  
_Source changes and commits: none; only this report was created._
