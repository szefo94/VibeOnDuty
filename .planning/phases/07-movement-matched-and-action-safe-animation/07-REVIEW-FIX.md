---
phase: 07-movement-matched-and-action-safe-animation
fixed_at: 2026-10-08T05:14:02.964Z
review_path: .planning/phases/07-movement-matched-and-action-safe-animation/07-REVIEW.md
iteration: 1
findings_in_scope: 6
delegated_findings: 5
fixed: 5
skipped: 1
fix_commits: 7
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-08T05:14:02.964Z
**Source review:** `07-REVIEW.md`, saved at `486fa81`; original findings remain unchanged.
**Iteration:** 1

**Summary:** Five delegated tool/test findings fixed in seven narrow commits, including two followups for noncanonical YAML keys and Windows fixture bytes. CR-02 is open under the parent's separate controlled asset review. Phase 7 and Plans 09/10 remain unqualified; this report records technical fixes only.

## Fixed Issues

### CR-01: A historical body line can qualify a halted Plan 09 summary

**Files modified:** `tools/art/animation-capture.mjs`, `tools/art/animation-capture.test.mjs`
**Commits:** `773dbb6`, `eb1dc34`
**Status:** fixed: requires human verification
**Applied fix:** Require leading, closed frontmatter in the canonical plain root-mapping form, exactly one root `status: complete` scalar and no scalar children, merge keys, escaped/quoted/explicit root keys or tab indentation. Body status lines, historical code blocks, later frontmatter and nested historical statuses cannot qualify a halted summary. Current identities, actual frozen-V2 pass, both executed browser assertions and log hashes remain required.
**Verification:** Thirteen original false acceptances failed the new controls before repair. Three additional escaped/explicit-key/scalar-child controls reproduced false acceptance before their followup. Final capture controls pass 38/38 as part of the 90-check tool run. A canonical complete CRLF frontmatter with nested history remains accepted; the actual halted summary plus historical completion remains rejected. Independent technical re-review remains required; no human motion pass is recorded.

### CR-03: Runtime manifest changes are invisible to source qualification identities

**Files modified:** `tools/art/review.mjs`, `tools/art/animation-budget-v2.mjs`, `tools/art/animation-budget-v2.test.mjs`, `tools/art/animation-capture.mjs`, `tools/art/animation-capture.test.mjs`
**Files created:** `tools/art/runtime-dependencies.mjs`, `tools/art/runtime-dependencies.test.mjs`
**Commit:** `d5e9b07`
**Status:** fixed: requires human verification
**Applied fix:** The outer collector reads and hashes `tools/art/motion-manifest.json` in its before/after identity collection. A shared validator verifies the actual provenance bytes against the existing protected V2 provenance SHA256, verifies its accepted `originalMotion.manifestSha256` against actual manifest bytes, and requires the matching explicit runtime dependency identity. Pure `verifyCandidate()`, the actual independent CLI, Plan09 and stable gates fail closed. New outer reports and verifier results record the explicit binding. The producer descriptor, sampler, freeze logic, numerical bounds, source workload, draw/ownership/full-pixel predicates and immutable reference/budget are unchanged.
**Verification:** An in-memory historical collector at `773dbb6` reproduced zero manifest reads, no listed manifest and equal identities after changing only `walk_forward.cycleDisplacement` to 12. New collector/validator controls reject that newly hashed mutation. Pure and actual CLI controls reject missing/stale identities and forged accepted fields. CLI mutation controls run in owned OS-temp copies, with no accepted JSON writes. The original freeze and negative controls still pass, and all 90 tool controls pass. Old unbound candidate reports now reject as current evidence; none was edited or retroactively labeled qualified. Separate binding facts are recorded in `evidence/07-review-fix-runtime-dependency.json`; they contain no newly captured animation samples.

### CR-04: New browser fixtures require Git history absent from CI checkout

**Files modified:** `tests/animation-resources.spec.js`, `tests/weapon-handling.spec.js`
**Files created:** `tests/fixtures/enemyAnimations.uncached.js`, `tests/fixtures/weaponHandling.uncached.js`, `tests/fixtures/README.md`, `tests/fixtures/.gitattributes`
**Commits:** `b097f39`, `05df63d`
**Status:** fixed
**Applied fix:** Check in the exact complete uncached owner bytes from `1e537a47030d535ceefde6c4af445e5cfb5d1a3e`, enforce their original SHA256 before browser import adaptation, and load them relative to each spec. Fixture-local LF attributes preserve those exact bytes on Windows and Linux. The complete real-rig correction, layers, rotations, contact, rest, root, replacement, retirement and bounded lookup comparisons remain unchanged; no current implementation or stub replaces the baseline.
**Verification:** Git blobs match the original revision exactly (`56eecc0a3a455747ae8881b7827cfa28f8f11281` and `a949f7cc8b4697c8063dc5659245686c6cb9dc4f`). A fresh depth-one clone contains no `1e537a4` commit: original imports fail discovery with exit1/zero tests; repaired specs discover 24 tests with exit0. Both actual owner-cache browser cases pass in 45.9s. A separate checkout-index export with `core.autocrlf=true` retains both expected SHA256 hashes. No CI history fetch or machine trust path is needed.

### CR-05: Animation-review tests serve a fixed Windows directory instead of their checkout

**File modified:** `tests/animation-review.spec.js`
**Commit:** `48fe103`
**Status:** fixed
**Applied fix:** Derive one repository root using `fileURLToPath(new URL('../', import.meta.url))`, use it for Vite and evidence, and allocate a free loopback port with strict binding. All existing native controls, UI/contact/state/generation/tier/accessibility assertions and timeouts remain unchanged.
**Verification:** Syntax passes. Two actual existing tracer/loading UI cases pass in 17.9s from the differently named depth-one checkout. A temporary marker inside that checkout's HTML head proves the server serves its own source. The initial temporary marker after the closing HTML was omitted during HTML processing and caused two probe-only failures; that limitation and original log are preserved, then the corrected in-head probe passes. No Linux CI job was available in this local Windows session, so no Linux execution is claimed.

### WR-01: Blocked-gait browser assertion inspects inactive source aliases

**File modified:** `tests/animation-presentation.spec.js`
**Commit:** `6370402`
**Status:** fixed: requires human verification
**Applied fix:** Use the existing presentation observation API to sum scheduled contributing lower movement masks. Exercise an actual held W key in a walkable corridor with the same checker, then keep it held against actual collision. After the unchanged short stop transition settles, inspect repeated real foot quaternions, speed, cadence and phase in addition to displacement and contributing weight. Existing neighboring root/eye/aim/action/inventory assertions remain intact. No debug outcome hook or runtime source is added.
**Verification:** Focused actual browser case passes in 10.5s. Moving mask weight is 1, minimum cadence 1.07020547945205 and maximum foot-component change 0.1133638871486583. Blocked weight, speed, cadence, foot change and displacement are all 0 while the key remains held. An owned temporary copy substituting the old alias query fails the same moving positive control with exit1; it cannot pass by always reporting zero.

## Skipped Issues

### CR-02: Crouch authoring overwrites direction and ships four identical gaits

**File:** `tools/art/build_motion.py:125`
**Reason:** Separately parent-owned controlled asset finding. This fixer was explicitly restricted from editing/publishing the donor, manifest, generator, accepted GLB, provenance or soldier sources. Candidate direction repair, actual-channel regression, playback review and any accepted lineage/publication decision remain open.
**Original issue:** Crouch authoring overwrites directional thigh/calf/foot transforms, producing four identical published directional crouch gaits. Tool/test fixes establish no physical correction or asset acceptance.

## Verification Environment and Evidence

All source/tool checks and commits ran in the main checkout by explicit branching/isolation-none instruction, with the scoped Git trust environment and supplied root-pin guard before writes/commits. The root-owned temporary `.planning/config.json` was never modified, staged or restored. No worktree, branch, install, reset, stash, push, global trust change, Blender/export/capture run or unrelated-process change occurred. Browser suites ran sequentially on owned free root-base listeners, with separate output paths. Shallow/discovery/portability probes used the ignored owned copy `.planning/research/.cache/07-review-shallow`; CLI mutation controls used disposable owned OS-temp copies.

| Check | Current result | Retained evidence |
| --- | --- | --- |
| `node --test tools/art/animation-capture.test.mjs tools/art/animation-budget-v2.test.mjs tools/art/runtime-dependencies.test.mjs` | 90 passed, zero failures | `07-review-fix-tools-final-green.log` |
| Changed tool/spec/fixture `node --check` and section re-reads | Passed | This report; scoped source diffs |
| Fresh shallow discovery, original imports | RED exit1, zero tests | `07-review-fix-discovery-red.log` |
| Fresh shallow discovery, immutable fixtures | GREEN exit0, 24 tests | `07-review-fix-discovery-green.log` |
| Two loaded-rig owner-cache browser cases | 2 passed | `07-review-fix-cr04-browser.log`, `07-review-fix-cr04/results.json` |
| Two actual review cases in relocated checkout, in-head marker | 2 passed | `07-review-fix-cr05-portability-retry.log`, `07-review-fix-cr05-portability-results.json` |
| Moving/blocked case with old alias substitution in temporary copy | RED assertion failure exit1 | `07-review-fix-wr01-red.log` |
| Actual contributing-mask moving/blocked case | 1 passed | `07-review-fix-wr01-browser.log`, `07-review-fix-wr01/results.json` with actual observations |
| `npm run lint`, `npm run typecheck`, `npm run typecheck:mp` | Passed in main checkout | Current command output |
| `PUBLIC_BASE=/VibeOnDuty/ npm run build` | Passed in main checkout; existing >500kB chunk warning | Current command output |
| Scoped Git whitespace and protected source/art diff from `486fa81` | Passed; protected diff empty | Current scoped Git checks |

All log/result paths above are under `.planning/research/.cache/`. These focused passes are not full stable-suite qualification. The preceding full-unit result of 323/323, full-offline result of 125/127 with two setup-limited throw nonpasses, and full-multiplayer result of 5/17 with retained stale-input/queue-limit failures are historical parent-run outcomes, not rerun or reinterpreted here. Natural death/respawn/online unions, the original outstanding browser qualifications and complete passing frozen-V2 candidate remain open. No host/network cause, numerical allowance, human aesthetic/motion pass, device/FPS certification, requirement advance or phase completion follows.

The binding evidence independently confirms exact preserved sampler `2720e51eed272c40fe9e12ff561e4d63072f9b7548b5c270a71ec0ae527ab83f`, producer `035432f721cb0661a82c288d3b5e92ce4d631a48da5bc6fbb73022897960f5e0`, original baseline/budget and V2 reference/budget hashes. Accepted manifest/provenance/art/source bytes remain unchanged. Prior failed flags remain false, and old media/results retain their original identities.

---

_Fixed: 2026-10-08T05:14:02.964Z_
_Fixer: gsd-code-fixer_
_Iteration: 1_
