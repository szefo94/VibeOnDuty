# CR-02 controlled motion correction proposal

Status: proposed, independent technical review required before publication.
Scope: reversible local correction of the confirmed directional crouch defect within authorized Phase 7. No gameplay, performance tradeoff, rights clearance or human aesthetic acceptance is implied.

## Exact revision

The independently reopened candidate in `.planning/research/.cache/07-motion/crouch-correction-oaINDh/` is the sole promotion input. Recheck `evidence/07-crouch-correction-candidate.json`, every referenced proof hash and the actual three buffers before mutation.

| Domain | Accepted before | Corrected exact tuple |
| --- | --- | --- |
| `public/models/enemy.glb` | `8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936` | `2a6bbab2034b01b1722f35e8afbdac2948978226d780fd43eb9d6df117196e4e` |
| `tools/art/sources/motion.blend` | `5a9e8c4c160cd4d7bb072f724e28dbb52b902f05d75d68a37c68d98449470903` | `3d1702ccb3915a14f3647e3db9f08ea14fef25ac9eccc696057b401a6471c463` |
| `tools/art/motion-manifest.json` | `af139b82f372c8b66c994a519fbe5a685cae23dc5b5153c8607578ef02f296c5` | `2b5712506a3c9bb9d76f6f9823bd4f07bea0c283613c0f2ea3a21c125d4e60a5` |

Only `vod7_crouch_back`, `vod7_crouch_left`, `vod7_crouch_right` may change. Preserve exact clip occurrence order, names, targets, slots, durations and all 104 other time/value/interpolation buffers, including inherited48 and forward/idle. Manifest differs only in sourceHash. Protected skin, inverse binds, nodes/rest/root, meshes, lighting/comic normals, materials, images, soldier donor, character parameters, paint and provenance remain exact. Candidate validation at tolerance0 and directional/root/contact negatives remain mandatory.

## Bounded trust and lineage change

Keep `tools/art/provenance.json` byte-identical at `7b8b9b5cfb2f86c2d0890dbc7042c1d010a9196ac6fed75b21a54318e4c451f6`; its originalMotion entries describe historical publication. Add a distinct `tools/art/motion-acceptance.json` recording old/corrected tuple, three permitted actions, exact candidate proof identity and pending human acceptance. Its exact bytes must be pinned in trusted validator code after authoring. A file's own declared hashes never establish trust.

Extend the shared runtime dependency binding to check actual GLB, manifest, donor and acceptance bytes as one registered exact tuple, plus unchanged protected provenance. Reject missing/stale/forged/mixed tuples, arbitrary alternative assets, forged manifest acceptance, altered nonmotion art and registry mutations. Historical original verification may use an explicit original tuple only when actual supplied bytes match it; ordinary current publication verification must bind the actual current tuple. Collector identity maps include every new required dependency before/after collection.

The V2 reference remains frozen at its original tuple. The comparison may recognize exactly the registered corrected tuple in the three named asset paths and the pinned acceptance record; it must keep the existing protected-source comparison for every other path. Do not add these assets to generic MUTABLE_RUNTIME. The correction is a narrowly proven motion revision, not a numerical rebaseline. Fresh reports bind correction lineage and current actual bytes. Old reports stay unchanged and historical; no old report is retroactively made current or qualified.

Frozen original/V2 reference and budget bytes, producer descriptor/hash, sampleAnimationPage body/hash, workload, device rules, all numerical bounds and epsilon1e-7 remain exact. Preserve current nonzero failure on incomplete/numerically failing reports, all full matrix/current-source requirements and independent stable gates. The registered revision cannot turn a failed timing report into a pass.

## Transaction and editable recovery

Implement a narrow local promoter. Preflight exact old tuple and protected bytes, candidate and independent reopened tuple, semantic diff and sealed proof. Resolve bounded root/cache paths and reject symlink/reparse escapes. Create owned backups and staged files, acquire an exclusive transaction lock. Because several files cannot be renamed atomically together, readers must explicitly reject an active/incomplete transaction; no mixed state can be accepted. Replace donor, manifest and GLB with staged renames, validate exact corrected tuple and write the pinned acceptance record last. On interruption/failure, fail closed and provide owned rollback/recovery; test injected failure. Idempotent invocation validates already-corrected state rather than overwriting it. Preserve old backups/evidence.

Update approvedArtMotion and motion repeat/iterate/recovery consumers to resolve the trusted corrected publication and inherited48 baseline without rewriting historical publication.json or protected provenance. Ordinary generic publication must not bypass this frozen Phase7 revision guard. Candidate art exports must continue copying all59 corrected original buffers exactly, preserving inherited48. Reopen corrected donor independently and demonstrate byte-identical repeat; perform candidate-only changed/restored editable recovery with fresh identities and reject unrelated motion/art corruption. Retain prior evidence as historical.

## Verification and disposition

Use RED/GREEN checks for pinned tuples, manifest metadata forgery, asset/skin/other-motion corruption, missing registry, active transaction, mixed files and rollback. Verify original acceptance constants/sampler/reference/budget bytes unchanged. Run candidate tests against the actual promoted asset, independent Blender reopen/repeat and current rendered directional/mask/contact/retirement checks on an owned strict free root-base listener. Our exports and browser suites remain sequential; unrelated jobs continue running.

Run lint, root/MP type checks and build for changes. Run focused relevant tooling/browser regressions and independent re-review. Broaden tests only for new runtime changes or unresolved findings; do not claim existing full offline/multiplayer/V2 failures resolved by unrelated fixes. Update audit disposition and relevant art/recovery documentation with exact current identities. Historical media is labeled pre-correction; fresh narrow crouch proof does not substitute for the strict full review matrix.

CR-02 can close only after exact local publication and independent technical review. Phase7, plans09/10, full review collection, natural death/respawn, multiplayer and frozen performance qualification remain open. Human motion/grip/anatomy/comfort and representative-device FPS remain pending. No push, deployment or Phase5 advancement.

## Ownership

After independent approval, typed executor owns narrow promotion/acceptance helpers, shared dependency and V2 binding, art/motion recovery consumers, their focused negative controls, exact three published files and fresh correction evidence/docs. Existing runtime source, sampler/producer, frozen bytes and all protected assets are outside ownership. Root retains `.planning/config.json` and restores its original bytes at run end; never stage it. Applicable root pin and GSD guarded commits remain mandatory.
