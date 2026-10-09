---
phase: 07-movement-matched-and-action-safe-animation
plan: CR02
subsystem: motion-authoring
tags: [directional-crouch, original-donor, isolated-candidate, exact-motion, native-browser]
status: complete
completion_scope: isolated_candidate_proof_only
publication_status: promoted_locally
requires:
  - phase: 07-03
    provides: Accepted107 publication, original59-action donor and retained inherited48 seam
provides:
  - Three-direction crouch composition correction and exact candidate guard
  - Independently reopened byte-identical editable-source export
  - Current-runtime fixed-heading masked browser gait evidence
affects: [CR-02, parent-controlled-promotion, ANIM-03, ANIM-04]
tech-stack:
  added: []
  patterns: [World-pose quaternion composition, Exact104-occurrence preservation, Owned candidate-only media]
key-files:
  created: [tools/art/crouch-correction.mjs, tools/art/crouch-correction-review.mjs, tools/art/crouch-correction.test.mjs, .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-crouch-correction-red.json, .planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-crouch-correction-candidate.json]
  modified: [tools/art/build_motion.py]
key-decisions:
  - Preserve forward and idle exactly; compose backward sagittal stride and lateral stride plus counter-rolled foot contact.
  - Candidate manifest changes only sourceHash; accepted source, manifest, publication and provenance remain exact.
  - Isolated native loaded-rig source review claims no physical gun quality, human aesthetics or device FPS acceptance.
requirements-completed: []
actuals: {tasks: 3, commits: 3}
commits: 3
plan_head_before: 6f80e48e71dbc4a77ded1434675873aafe6f818e
plan_head_after: 86477f6dcc3d3a9f2d8b79ea0ac6f539d49b5a11
duration: approximately34min scoped candidate continuation
completed: 2026-10-08
---

# Phase 7 CR-02: Directional Crouch Candidate Summary

The isolated editable candidate changes only `vod7_crouch_back`, `vod7_crouch_left` and `vod7_crouch_right`; all other104 inherited/original occurrences and every protected art/rig domain remain exact.

This completion concerns candidate construction and proof only. The accepted publication/donor/manifest still contain the reported directional defect. CR-02 publication remains pending the parent's independent controlled promotion and applicable lineage review. Phase7,09/10, requirements, frozen V2, human motion acceptance and representative-device qualification are not advanced.

## Tasks and commits

1. Actual published-channel RED: `8d8ec08` compares every target, interpolation, time and value of the real four crouch clips. `cd70ce8` persists the machine-qualified TAP record. The named forward/back assertion fails; SDK verdict is `RED_EVIDENCE_OK` before production changes.
2. Authoring/candidate GREEN: `86477f6` composes base crouch and backward/sideways stride, counter-rolls lateral contact feet, and offers an exact three-action retained-donor correction mode. The ordinary neutral/rest generator succeeded; fallback was unnecessary. The separate CLI uses the qualified48 seam to export, then compares the107 candidate against current107. It validates the accepted protected dependency/source hashes, exact104 motion buffers, render/skin/material/image semantics, clip/slot identity and durations before accepting candidate proof.
3. Independent reopen and real-browser proof: source export and candidate tests passed, followed serially by the normal loader's candidate-only GET/HEAD routing and current `tickPresentation()` masks on an independently owned clone. Parent controls publication.

## Durable artifacts and identities

- Evidence: `evidence/07-crouch-correction-candidate.json` (complete candidate proof, `published:false`, `candidate_fixed_not_promoted`).
- Candidate directory: `.planning/research/.cache/07-motion/crouch-correction-oaINDh/`.
- Editable donor: `motion.blend`, SHA256 `3d1702ccb3915a14f3647e3db9f08ea14fef25ac9eccc696057b401a6471c463`.
- Candidate manifest: `candidate.manifest.json`, SHA256 `2b5712506a3c9bb9d76f6f9823bd4f07bea0c283613c0f2ea3a21c125d4e60a5`; only `sourceHash` differs from canonical.
- Candidate and independently reopened `independent.glb` are byte-identical: SHA256 `2a6bbab2034b01b1722f35e8afbdac2948978226d780fd43eb9d6df117196e4e`.
- Retained current comparison: `accepted107.glb`, canonical SHA256 `8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936`.
- Final clean media index: `review-FqwRDA/index.html`; two WebMs and24 full1280×960 PNGs. The packet binds each file/hash and the visual report.
- Portable Blender4.5.13 LTS, actual build `daeeeca98fb0`, existing archive SHA256 `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`. No install/download occurred;15-minute owned Blender deadline remained unchanged.

## Verification

| Check | Actual result |
|---|---|
| Published actual channel RED | Named assertion fails on identical forward/back buffers; no setup/discovery failure credited. |
| Candidate tests |3/3 passed,0 skipped: all four buffers distinct; fixed-heading sagittal/lateral trajectory sign, cyclic feet, constant crouch/root and lateral sole counter-roll. |
| Exact corruption controls | Unchanged back/left/right, wrong lateral direction, wrong root, unrelated motion and protected rig corruption reject. Existing listed-motion quaternion/root validation remains active. |
| Primary native foot sweep | Forward ΔZ≈-0.172487m, back +0.172487m; left ΔX≈-0.172487m, right +0.172487m; side |ΔZ|≈3e-8. Neutral exported heading +Z; current runtime uses its existing π facing offset. |
| Exact current107 comparison | Only3 changed clips;104 unchanged occurrences include inherited48 and other original56, including forward and idle. Protected mesh/skin/materials/images/motion comparison tolerance0 passes. |
| Independent reopened export | Existing exportMotion in a separate fresh Blender process: exit0, identical complete GLB bytes and semantics. |
| Final native browser | Exit0, owned loopback port51762, eight before/candidate direction contexts,384 rendered native frames and≥2 cycles each, actual `vod7_crouch_*_lower` contributions at fixed heading. Packed maps decode; live keeper/root/outcomes remain unchanged; double disposal/subsequent clone survive, zero shared disposals. |
| Syntax and change hygiene | Python AST and both Node syntax checks pass; scoped Git diff check passes; no tracked deletions. |
| Accepted-byte preservation | All recorded accepted donor/manifest/publication/provenance/soldier/params/generator/paint hashes equal before/after. No protected runtime/src/art change relative to starting6f80e48; final packet records current runtime and unchanged sampler identities. |

Reproduce candidate checks with `VOD_CROUCH_CANDIDATE` pointing to the owned `candidate.glb`, then `node --test tools/art/crouch-correction.test.mjs`. Without that candidate selection, the current accepted asset intentionally remains RED until a separately approved promotion.

## Deviations and limitations

- The first browser setup timed out45seconds before menu readiness; its owned resources closed. Normal boot followed by an isolated native review clock then passed. This failed attempt is retained, never credited as proof.
- Initial successful media contained separate live first-person view proxies/gun. Subsequent independently retained captures hide and restore those live visuals; the final clean `review-FqwRDA` proof is canonical for this candidate. Earlier media/report remain historical under the candidate directory.
- Changed clips may need additional samples where previously held channels acquire directional composition. Names, occurrence order, targets, full duration, frame/FPS/marker/slot metadata stay preserved; all non-target sample times/values are exact.
- The source clone is unmounted. It establishes current masked crouch/foot rendering, not physical gun/grip quality. Human moving quality and named-device/FPS checks remain pending.
- No full src/offline/MP suite, frozen cost matrix or45-context recapture was requested or run; no failed/unrun original qualification is reclassified. Other jobs continued running. All owned browser/listener/Blender work is terminal.
- Editing the authoring script makes old repeat/recovery script identities historical. Those records, accepted inputs, pinned runtime dependency SHA and frozen original/V2 bytes were not rewritten.

## Threat flags

The new local helper reads trusted saved donor data and writes only bounded owned cache candidates/evidence. Source scripts remain disabled; fresh export uses the existing original-action/slot/world-rest parents-first validator. Loopback Vite/browser routing is test-only with explicit free/strict root-base ports. No production endpoint, gameplay outcome hook, infrastructure or rights claim is introduced.

## Local promotion (2026-10-09)

`node tools/art/promote-motion.mjs promote` published the sealed candidate under the
reviewed exact-tuple transaction. Current identities:

- `public/models/enemy.glb` → `2a6bbab2034b01b1722f35e8afbdac2948978226d780fd43eb9d6df117196e4e`
- `tools/art/sources/motion.blend` → `3d1702ccb3915a14f3647e3db9f08ea14fef25ac9eccc696057b401a6471c463`
- `tools/art/motion-manifest.json` → `2b5712506a3c9bb9d76f6f9823bd4f07bea0c283613c0f2ea3a21c125d4e60a5`
- `tools/art/motion-acceptance.json` (pinned, written last) → `8f3c519d8fd87a5c1efcf8add162e30be52257534ec7b960b9c2f4c3d88fe155`
- `tools/art/provenance.json` unchanged → `7b8b9b5cfb2f86c2d0890dbc7042c1d010a9196ac6fed75b21a54318e4c451f6`

Promotion transaction directory: `.planning/research/.cache/07-motion/promotion-8U75fp`
(backups of the original tuple). No lock or staging files remain.

Checks on the promoted publication:

| Check | Result |
|---|---|
| Independent technical review (read-only, own GLB parser) | No blocker. Exactly 3 clips differ; 104 occurrences, meshes, skin, inverse binds, images and materials identical; V2 bounds untouched; generic writers excluded. |
| Blender reopen of promoted donor (`motion-pipeline.mjs repeat`, `repeat-Fsk9rW`) | Two fresh exports byte-identical to the publication `2a6bbab2...`. |
| Candidate-only editable recovery (`recover --demo`, `recovery-vS14WK`) | Changed export differs; restored source `3d1702cc...` and restored export byte-identical. |
| Browser render of promoted `public/models/enemy.glb` (`reviewCorrection`, `currentPublication`, `review-2NvQlA`) | Exit 0, complete, owned listener closed, protected identities equal before/after. |
| `node --test tools/art/*.test.mjs` | 156/156. Without the gitignored cache: 133 pass, 2 visible skips, 0 fail (simulated). |
| lint, `typecheck`, `typecheck:mp`, `build` | Pass. |
| `npm run test:unit` | 323/323. `server/cli.test.js` and `server/tdmRoom.test.js` timed out intermittently while Blender/browser jobs loaded the machine; both pass alone and in the final full run. |

Follow-up changes made with the promotion:

- Recovery (`promote-motion.mjs`): retryable rollback stages; an untouched original tuple
  releases the lock without restore; a committed tuple with the pinned record is finalised
  after the protected-input check instead of reverted; changed provenance stops before any
  restore; a missing tuple file takes the backup rollback; reports are `recovery-<id>.json`
  with fixed fields; the CLI prints the outcome. A second independent review of the first
  recovery patch found no blocker; its findings 1-6 are addressed and covered by tests.
- `server/tls.js` calls `whoami`, `icacls` and PowerShell from System32. From Git Bash,
  `PATH` resolved Git's POSIX `whoami`, which failed 10 TLS/hosting unit tests.
- `src/builders/enemyGLTF.test.js` binds historical provenance to the acceptance registry's
  original tuple and the current files to its corrected tuple.
- Cache-dependent art tests skip visibly when `.planning/research/.cache/07-motion/` is absent.

Known limits: an empty lock file (crash between lock creation and its first write) still needs
manual removal. `tools/art` tests are not part of `npm test` or CI. The recovery hardening
that followed the second review has not itself been independently re-reviewed.

Still open: human motion acceptance, Phase 7 and plans 09/10 qualification, full offline and
multiplayer browser suites, the frozen V2 performance gate and representative-device FPS.

## Self-Check: PASSED

All candidate/source/manifest/independent/media/report files exist. RED commits8d8ec08/cd70ce8 and GREEN86477f6 exist. Sealing re-read each video/PNG hash, candidate/source/manifest identity, independent export and accepted bytes. No goal-blocking stub exists in this scoped candidate; accepted publication and phase qualification are explicitly pending.
