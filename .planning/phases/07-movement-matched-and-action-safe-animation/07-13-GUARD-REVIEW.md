---
phase: 07-movement-matched-and-action-safe-animation
plan: "13"
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
commits: [2e2f90f, 2c9330b]
reviewed: 2026-10-10T07:45:00Z
reviewed_head: 63d81f0120a8e9c7d10c9369626b982de328fecb
findings_blocker: 0
findings_warning: 3
findings_note: 6
---

# Plan 07-13 task 2: independent review of `2e2f90f` and `2c9330b`

## Who reviewed

An independent reviewer agent (model `opus`, dispatched at effort `high`). I authored neither
commit and none of the plan 07-13 evidence. I also wrote the plan 07-21 source-exception review
(`07-21-SOURCE-EXCEPTION-REVIEW.md`), so I had already read `exactCorrectionException` and the
frozen gate closely; for this review I re-derived everything below from the two commits' own
diffs and from the code at `HEAD` `63d81f0`. Read-only: this file is the only one I created,
nothing else was modified and nothing was committed.

## Verdict

`pass-with-notes`. The 07-13 candidate is not made unusable by either guard.

| Blocker condition | Result | Basis |
|---|---|---|
| The `enemyGLTF.test.js` exception accepts more than the exact pair under the corrected binding | not met | 241,026 input tuples against the rule before and at `2e2f90f`: exactly one tuple changed; the real gate agrees |
| A frozen or protected file's bytes, a numeric limit, the sampler or the producer contract changed | not met | Blob ids unchanged across both commits for the gate, its test, the sampler host, budget, reference, baseline and cost report. See the nuance under 1c for the pinned file's checkout form |
| The lazy path uses a bone reference after retirement, or keeps a retired skeleton alive | not met in the sense that matters; two bounded effects are reported | No read and no solve on a retired rig. The first use after retirement writes rest rotations back to it, and an owner that is never used again keeps the retired object graph reachable until it is. Neither occurs for the gate's source actor, and both match the code the budget was frozen from (2a, 2c, G-03, G-04) |
| The three-disposer count was reached by hiding ownership from the predicate | not met | The removed callback was a second release for a handling the actor already disposes through a registered callback; nothing was moved elsewhere (2b) |

I want the third row read with care. Taken word for word, "can keep a retired skeleton alive"
is true for one case: an owner that does not own its skeleton and is not used again. I do not
rate it a blocker, for the reasons given under 2c, and I have written the facts so that the
owner can rate it differently.

Three warnings: the CI step cannot pass on a fresh checkout (G-01), the exception for a unit
test has no recorded owner decision (G-02), and the bounded retention just described (G-03).

## 1. `2e2f90f`

### 1a. Is the test file accepted only for the exact pair, only under the corrected binding?

Yes.

- Rule at the commit: `tools/art/motion-acceptance.mjs:84-90` (`git show 2e2f90f:...`). The
  binding check is the first statement (`:88`) and returns false for anything but
  `07-CR02-directional-crouch`. The new branch (`:89-90`) is reached only for an own key of the
  frozen one-entry map `CORRECTION_DEPENDENTS` (`:84-86`) and is two strict equalities.
- At `HEAD` the same text sits at `tools/art/motion-acceptance.mjs:84-86` and `:103-104`; the
  pair is byte-identical to the commit's.
- `original` equals the frozen reference identity of the file
  (`evidence/07-budget-view-v2.json`, `referenceIdentities`), which is the LF blob `4c8e161`
  committed before `9ce341b`. `corrected` is the LF blob `11a5163`, unchanged from `9ce341b` to
  `HEAD`, and equals the working file.

### 1b. Does it reject every other hash, every other file and the original binding? Controls?

It rejects them all. The controls are thinner than the rule, and none of the commit's own
controls runs on a fresh checkout.

- Enumeration I ran: the rule at `2e2f90f~1` against the rule at `2e2f90f`, for 139 names (the
  128 reference names, the three tuple names, eight near-misses and prototype names), 17 by 17
  hashes (the pair, the CRLF form of the corrected content, an upper-case form, a one-character
  neighbour, every CR-02 hash, both `src/main.js` hashes, `undefined`, `null`, empty, an
  unrelated hash) and six bindings: 241,026 tuples, one difference,
  `('src/builders/enemyGLTF.test.js', 990e0a62..., 220594a2..., corrected binding)` false to true.
- Every tuple accepted at `2e2f90f` in that whole space: the three CR-02 tuple files and this
  one pair. Swapped pair, unchanged pair, the CRLF form, the original binding, the pair on any
  CR-02 file and any CR-02 pair on this file are all false; a missing binding throws `TypeError`.
- Real gate (`verifyCandidate`, frozen budget, synthetic candidate): corrected hash accepted;
  another hash, the CRLF form, a one-character neighbour and a missing identity rejected with
  `Protected source changed: src/builders/enemyGLTF.test.js`; the corrected hash on another file
  rejected on that file; the corrected hash under the original tuple rejected.
- Controls the commit added (`motion-promotion.test.mjs:83-89` at the commit, `:347-353` at
  `HEAD`): the working file hashes to the pinned value; exact pair accepted; other current hash
  rejected; other reference hash rejected; rejected under a real original-tuple binding.
- What they do not cover: the swapped pair, and the pair on another file name (the neighbouring
  line `:346` uses dummy hashes). Plan 07-21's later control closes the second gap for every
  reference name and every registered pair (`motion-promotion.test.mjs:160-175`).
- All five of the commit's controls sit inside the block that needs the gitignored candidate
  cache (`:296-297` at `HEAD`, `:32-33` at the commit). In a fresh clone at `2e2f90f` the file
  reports 3 tests, 2 pass, 1 skipped, and the skipped one is that block (G-05).

### 1c. What did `.gitattributes` pin, and does it change any protected file on a fresh Windows checkout?

It pinned one path, `src/builders/enemyGLTF.test.js text eol=lf` (`.gitattributes:1-2`; the file
did not exist before this commit). It changes the checkout bytes of that one file and of no other.

- Two fresh clones with `core.autocrlf=true`, one checked out at `2e2f90f~1` and one at
  `2e2f90f`, every tracked file hashed (449 and 450 files): the files that differ are the four
  the commit touches plus `src/builders/enemyGLTF.test.js`, whose checkout goes from CRLF
  (`9a307543...`) to LF (`220594a2...`). Nothing else differs.
- That file is itself a protected identity, so the honest answer to "does it alter a protected
  file's bytes on a fresh Windows checkout" is: yes, exactly the pinned one, and that is the
  purpose. Without the pin a fresh Windows checkout held bytes that match neither the frozen
  nor the corrected hash, so the gate would have rejected the file there.
- Reproducible from committed content: yes. `git cat-file blob HEAD:src/builders/enemyGLTF.test.js`
  hashes to the pinned corrected value, as do the working file and both fresh clones at
  `2e2f90f` (`autocrlf` true and false).
- The commit did not touch the test file, so it rewrote no working bytes in the author's tree.

### 1d. Is an exception for a test file legitimate? What changed in the test, and why?

The mechanism is the right one given a frozen gate; the decision behind it is not on record.

- Why a unit test is in the identity set at all: the capture hashes every `.js` under `src/`,
  tests included (`tools/art/review.mjs:388-395`), and the frozen reference therefore lists it.
  The owner scope review kept that deliberately: "Keep every other protected-source check,
  including existing source-unit-test hashes" (`07-09-OWNER-SCOPE-REVIEW.md:7`).
- What changed, in `9ce341b` and only there (`src/builders/enemyGLTF.test.js:32-43`): one test.
  Its frozen form asserted that the three provenance hashes equal the current donor, export and
  manifest. CR-02 keeps provenance historical and publishes corrected files, so that assertion
  became false by design. The replacement reads `tools/art/motion-acceptance.json` and asserts,
  for each of the three files, provenance equals the registry's original hash and the current
  file equals the registry's corrected hash (`:37-43`). Three assertions became six; the rest of
  the file is unchanged.
- Is the replacement a weakening? Not in effect. It no longer compares provenance with the
  files directly, and it trusts the registry JSON without hashing it; but the registry's bytes
  are pinned in code and checked wherever the tuple is verified
  (`tools/art/motion-acceptance.mjs:36`, `:72-73`), and the corrected hashes are literals there.
- Why an exception and not something else: the only alternatives are to leave the unit test
  failing after CR-02, to drop tests from the identity set (a change to the frozen contract), or
  to make the file generally mutable. One exact pair tied to the CR-02 binding is the narrowest.
- What is missing: `07-09-HOST-DRIFT.md:63-68` says this "needs an explicit, reviewed decision".
  The CR-02 proposal review approved an exception "restricted to three asset paths and the
  pinned acceptance record" (`07-CR02-PROMOTION-REVIEW.md:17`), and the owner scope review says
  not to extend to tests (`07-09-OWNER-SCOPE-REVIEW.md:7`). The plan itself notes that no review
  record existed (`07-13-PLAN.md:56`). This document supplies the review. I found no record of
  the decision, and a reviewer cannot make it (G-02).

### 1e. Does the CI change weaken, skip or gate anything it should not?

It weakens nothing. As committed it adds a step that cannot pass on a fresh checkout, placed
before the browser suites (G-01).

- The change is one line, `npm run test:art`, after the unit tests and before the Playwright
  installation (`.github/workflows/test.yml:26`).
- In a fresh LF clone at `2e2f90f`, `tools/art/animation-budget-v2.test.mjs` reports 47 tests,
  44 pass, 3 fail. The three failures are `ENOENT` on files under the gitignored
  `.planning/research/.cache/` and do not depend on installed packages. The same three fail at
  `14ff711` (first 07-21 review, F-13); that file is unchanged since.
- Consequence if pushed as is: the Tests job stops at this step, so `test:e2e` and `test:mp`
  (`test.yml:39-40`) do not run, and the deployment that depends on the job
  (`.github/workflows/deploy.yml:24`, `:27`) does not happen.
- It also does not do what the commit title suggests for this exception: on a fresh checkout the
  exception's own controls are in the skipped block (1b).
- Not observed on hosted CI. Local `main` is 311 commits ahead of `origin/main`, so no hosted
  run has included this step. Other art test files could not be judged in my clone because it
  had no installed packages.

## 2. `2c9330b`

Both changed builders are permitted mutable owners (`tools/art/animation-budget-v2.mjs:21-22`).
Neither file, nor the spec, has changed since this commit.

### 2a. Are cached bone references released before any use after retirement?

Yes for every read. One write precedes the release, and it is the rest restoration.

- Order inside one update (`src/builders/weaponHandling.js:192-195`): `restoreWeaponHandlingBones`
  first (`:109-117`), then `handlingReferences`. The lazy check is the first statement there
  (`:32`): a skeleton that went through `disposeCharacter` (`src/builders/characterResources.js:6`,
  `:60-61`, `:89-90`) is set to null, the identity test that follows fails (`:33-34`), the bone
  lookup is rebuilt from null, which empties it (`:43`, `:24-27`), and `mountRest` is cleared
  (`:55`). Every later use of a bone is behind `owner.skeleton` (`:198`, `:202`, `:219`).
- The only readers of the lookup are in this module and run after that point (`:135-137`,
  `:161`, `:170-171`, `:184`, `:222-223`). No other source file reads `boneLookup`.
- I ran the real module in Node against real three.js rigs (import lines replaced, nothing else):

| Scenario | Result |
|---|---|
| Owner holds a skeleton it does not own; skeleton retired; next update | skeleton null, lookup 29 to 0, corrections 24 to 0, contacts null; 0 world-position reads and 0 traversals of the retired rig; bone texture stays disposed |
| Same update, effect on the retired rig | the saved rest rotations are written back to the 24 corrected bones (the restore at `:194`); nothing is read from them |
| Retire A, assign B, one update (retire then reuse in the same frame) | lookup holds 0 nodes of A and 27 bones of B; corrections on B only; 0 reads of A |
| Double retirement, then two updates, two handling disposals, a third retirement | no throw; a registered disposer ran once; lookup 0 |
| The retired skeleton assigned again on each of three later frames (what `src/builders/weapon.js:173` does) | null each time; 0 reads; 0 socket traversals |
| Root replaced and skeleton retired before the same update | skeleton null, lookup 0, parts taken from the new root, owner map moved |
| Actor retired while a second owner in another view still points at it | the actor's own handling is disposed at retirement through its registered disposer (lookup 0 at once); the second owner still holds 29 entries until its next update, then 0 |

- So "before any use": the lookup cache is never read after retirement. The write-back in the
  second row goes through `owner.corrections`, which is rest-restoration state rather than the
  cache this commit is about, and the removed disposer performed the same write at retirement
  (`git show 2c9330b`, removed lines). The code the budget was frozen from did the same on the
  next update (G-04).
- In shipped code every handling owner is either disposed by the character's own retirement
  (`src/builders/enemyWeapon.js:160-161`; `src/builders/firstPersonRig.js:321-325`;
  `src/dev/animationReview.js:185`) or has its skeleton reassigned every frame
  (`src/builders/weapon.js:171-175`, called from `src/loop.js:157-161`;
  `src/builders/firstPersonRig.js:302-306`). The lazy branch is the fallback for the second kind.

### 2b. Three disposers again, and is that what the predicate measures?

Yes, and it is a real removal, not a relocation.

- The predicate: the sampler records `inspectCharacterResources(actors[0].mesh).callbacks`
  (`tools/art/review.mjs:646`), which is the size of the disposer set registered on the source
  actor (`src/builders/characterResources.js:93-95`). The gate compares the whole ownership
  object with the frozen one (`tools/art/animation-budget-v2.mjs:192-193`); the frozen value is
  3 in all six profiles. A synthetic candidate with 4 in one sample is rejected by the real gate
  with `Ownership/essential resource changed`.
- What the fourth callback was: on the code before this commit, a rig carrying three disposers
  goes to 4 on the first update of its own handling and to 5 when a second owner points at it
  (my Node run). At this commit it stays 3, 3, 3.
- Why that is an ownership fix: for an actor's own handling the release at retirement already
  existed as a registered callback (`src/builders/enemyWeapon.js:161` calls
  `disposeWeaponHandling`, which restores, clears both lookups and drops the skeleton,
  `src/builders/weaponHandling.js:264-276`). The callback added by `f89d820` did the same work a
  second time. Removing it leaves the same release, at the same moment, through a callback the
  predicate counts. Nothing was folded into another callback or kept in a registry the
  predicate cannot see; the only registry is `disposers`, and this module no longer writes to it.
- What the predicate cannot see, now as when it was frozen: an owner that holds a reference to a
  character without registering anything. The count says how many retirement callbacks the
  character carries, not who else points at it.
- First-hand evidence at current source is the plan's capture, which I read:
  `evidence/07-13-cost-candidate.json` has `view.sourceCallbacks` 3 in all 12 samples and
  identities for the two builders equal to the files on disk.
- `07-09-HOST-DRIFT.md:90-94` attributes the fourth callback to the third-person player weapon.
  My run reproduces 3 to 4 from the actor's own handling alone. This does not affect the fix (G-08).

### 2c. Can the cache keep a retired skeleton alive? Idempotent? Within the binding scope?

GPU: no. JS memory: yes, in one bounded case, until the owner is next used.

- GPU resources are released by the character's retirement regardless of who still points at
  it (`src/builders/characterResources.js:73-85`). In my run the bone texture is null after
  retirement and is not recreated by the next update.
- Measured with weak references and forced collection:

| Case | Retired character still reachable |
|---|---|
| This commit, owner idle after the retirement | yes |
| This commit, after the owner's next update | no |
| This commit, after `disposeWeaponHandling` | no |
| Code before this commit (the fourth disposer), owner idle | no |
| Code before the cache existed (`f89d820~1`, what the budget was frozen from), owner idle | yes |

- So against `f89d820` this commit gives up the immediate release for an idle owner; against
  the frozen-reference code it holds exactly what that code held (`owner.skeleton` and the
  corrections), plus the name lookup into the same graph, and unlike that code it lets go on
  the next use.
- Why I rate this a warning and not a blocker: it is bounded (at most one retired character per
  owner), it is plain object memory with every GPU resource already freed, no shipped path
  produces it (2a, last bullet; `buildPlayerMesh` never retires the previous player mesh,
  `src/builders/enemyGLTF.js:448-451`, `:502-503`), it does not touch the gate's source actor,
  and the retirement plateau the gate checks is GPU counts and callback counts. It is real for
  tests that drive the player owner with a temporary actor
  (`tests/weapon-handling.spec.js:161`, `:229`) (G-03).
- Idempotent: yes. `disposeCharacter` returns on a second call (`characterResources.js:60`),
  `disposeWeaponHandling` returns on a second call (`weaponHandling.js:265`), and the lazy check
  is a pure query that leaves a null skeleton null. Double-retirement scenario above.
- Binding scope (`07-09-OWNER-SCOPE-REVIEW.md:9-13`): the cache is still only node references
  and name lookups; first depth-first match is unchanged (`weaponHandling.js:24-27`); nothing
  pose-dependent is cached; rest restoration is preserved; invalidation on root, weapon, mount
  and skeleton replacement is unchanged (`:33-35`). "Invalidate on ... retirement" is met at
  retirement for an actor's own handling and on first use otherwise, with no read in between.
  The only addition outside the handling module is a read-only query in a permitted owner
  (`characterResources.js:89-90`).

### 2d. Does `tests/weapon-handling.spec.js` exercise the lazy path so that it would fail without it?

Yes for the release and for the disposer count. Several of the cases in 2a are not in it.

- The added block (`tests/weapon-handling.spec.js:69-77`, asserted at `:104`) points the owner
  at a spare actor, checks that the spare's callback count did not rise and that the lookup
  resolves the spare's hand, retires the spare, updates once, and requires a null skeleton, an
  empty lookup and no corrections.
- Without line 32 the retired skeleton would still match the identity test, the update would
  solve on it, and `skeletonRetired` would be false on all three terms. On the code before this
  commit `noExtraDisposer` is false (my run: plus one per owner).
- Not exercised there: retire then assign without an update in between, a second retirement of
  the same skeleton, a retired skeleton assigned again every frame, the idle-owner retention,
  and the comment's "no later lookup traversal" for the spare. I ran those in Node (G-07).
- The cached result of the plan's run, written 2026-10-10T07:26:39Z, has both flags true for
  all four weapons, and the plan's log ends with 11 passed. I did not run the browser suite.

## 3. Numeric limits, sampler, producer contract, frozen reference and budget bytes

Unchanged by both commits.

- `2e2f90f` touches `.gitattributes`, `.github/workflows/test.yml`,
  `tools/art/motion-acceptance.mjs`, `tools/art/motion-promotion.test.mjs`. `2c9330b` touches
  `src/builders/characterResources.js`, `src/builders/weaponHandling.js`,
  `tests/weapon-handling.spec.js`.
- For each commit, blob id before equals blob id after, and equals `HEAD`, for
  `tools/art/animation-budget-v2.mjs` (`c23e1429`), its test (`af8ca8f6`), the sampler host
  `tools/art/review.mjs` (`34f8ea4c`), `tools/art/runtime-dependencies.mjs` (`be22703c`),
  `tools/art/motion-acceptance.json` (`09978d47`), `tools/art/provenance.json` (`cea9c1ea`),
  `evidence/07-budget-view-v2.json` (`e9cdb636`), `evidence/07-09-view-reference-v2.json` and
  `evidence/07-09-cost-report.json` (`99dad160`), `evidence/07-budget.json` (`1d24e89c`),
  `evidence/07-baseline.json` (`32d3d65c`). `tools/art/animation-capture.mjs` is unchanged by
  both commits (later plan 07-22 commits changed it).
- The frozen budget still carries producer contract hash
  `035432f721cb0661a82c288d3b5e92ce4d631a48da5bc6fbb73022897960f5e0`, the value named in
  `07-09-OWNER-SCOPE-REVIEW.md:17`, and epsilon `1e-7`.

## Interaction with plan 07-21

None adverse. Plan 07-21 added a second registry and a branch placed before this one
(`tools/art/motion-acceptance.mjs:93-102`). The key sets are disjoint and a control asserts the
full list of names that can be excepted (`motion-promotion.test.mjs:162-164`). Enumerating the
rule at `2e2f90f` against `HEAD` over the same 241,026 tuples gives one difference, the
`src/main.js` pair; the tuple for the test file is unchanged. Plan 07-21 added a second
`.gitattributes` line and no other. Its gate-level control keeps the test file at the frozen
value, so it does not exercise this exception.

## Findings

| id | severity | file:line | evidence | required action |
|---|---|---|---|---|
| G-01 | warning | `.github/workflows/test.yml:26`; `tools/art/animation-budget-v2.test.mjs:37-41`; `.github/workflows/deploy.yml:24`, `:27` | Fresh LF clone at `2e2f90f`: the gate's test file fails 3 of 47 on the gitignored cache, so the added step exits non-zero, the browser suites after it do not run and deployment is blocked. `07-CR02-SUMMARY.md:126` says such tests skip visibly; these three do not. Not observed on hosted CI (311 commits unpushed). | Before pushing: make those three cases skip visibly without the cache, as the promotion controls do, or supply tracked fixtures. Not needed for the 07-13 candidate. |
| G-02 | warning | `tools/art/motion-acceptance.mjs:84-86`; `07-09-OWNER-SCOPE-REVIEW.md:7`; `07-CR02-PROMOTION-REVIEW.md:17`; `07-09-HOST-DRIFT.md:63-68`; `07-13-PLAN.md:56` | The exception relaxes "keep ... existing source-unit-test hashes" for one file and goes one path beyond what the CR-02 review approved. It has been in force since `2e2f90f` with no decision record; this document is the review only. | Owner to record the decision (accept this exact pair, or not). If accepted, cite this review. |
| G-03 | warning | `src/builders/weaponHandling.js:32`, `:43`; `src/builders/weapon.js:171-175` | An owner that does not own its skeleton and is not used again keeps the retired character's object graph reachable until its next use. Measured. GPU resources are freed; no shipped path produces it; the frozen-reference code held the same. | Owner to accept it as bounded, or ask for a release that does not add a callback (for example clearing the player owners where a foreign skeleton is retired). Not needed for qualification. |
| G-04 | note | `src/builders/weaponHandling.js:194-195`, `:109-117` | The first update after a retirement writes saved rest rotations to the retired bones before the lazy check. Write only, 0 reads in my run. The comment at `:29-31` describes this order. | None. |
| G-05 | note | `tools/art/motion-promotion.test.mjs:296-297`, `:347-353` | All of this exception's own controls need the gitignored cache. On a fresh checkout nothing asserts that the file on disk has the pinned hash, nor the wrong-hash, wrong-reference or original-binding rejections for this file; only the other-name rejection runs (`:160-175`). No control covers the swapped pair. | Move the five assertions into the cache-free block with a synthetic binding, as plan 07-21 did, and add the swapped pair. |
| G-06 | note | `.gitattributes:2`; `tools/art/motion-promotion.test.mjs:158-159` | Nothing checks that the pin line for the test file exists; the similar check added later covers `src/main.js` only. Removing the line would show up only as a hash mismatch on a fresh Windows checkout. | Optional: assert the line as for `src/main.js`. |
| G-07 | note | `tests/weapon-handling.spec.js:69-77` | The browser case covers release-on-next-use and the disposer count. Same-frame reuse, double retirement of the skeleton, per-frame reassignment of a retired skeleton and idle retention are not in it. | Optional: add the three cheap ones to the same case. |
| G-08 | note | `07-09-HOST-DRIFT.md:90-94` | The record attributes the fourth callback to the third-person player weapon; the actor's own handling alone reproduces 3 to 4 on the old code. | None. Worth correcting if that record is cited as the cause. |
| G-09 | note | `tools/art/review.mjs:388-395`; `src/builders/enemyGLTF.test.js:37-43` | Unit tests are frozen identities because the capture hashes every `.js` under `src/`, so any later unit-test edit needs the same treatment. The replaced test trusts the registry JSON without hashing it; the registry is pinned in code elsewhere. | None in this plan. |

## What I ran and what I saw

From `C:\Programowanie\VibeOnDuty` at `63d81f0`, Node v24.19.0, git 2.39.1.windows.1,
`core.autocrlf=true`. Scripts are in the session scratch directory.

- `git show` of both commits; `git diff --name-status` and blob ids before, after and at `HEAD`
  for the files listed in section 3; `git log` for later changes to the seven touched files.
- `probe3.mjs`: the rule at `2e2f90f~1`, `2e2f90f` and the working module, 241,026 tuples each
  way; results in 1a, 1b and the plan 07-21 section.
- `gate-dependent.mjs`: the real `verifyCandidate` with the frozen budget; results in 1b and 2b.
- Hashes of `src/builders/enemyGLTF.test.js` at `9ce341b~1`, `9ce341b`, `2e2f90f~1`, `2e2f90f`
  and `HEAD`, in LF and CRLF form, and of the working file; `git diff` of the test in `9ce341b`.
- Three scratch clones under `review-clone`, deleted afterwards: `autocrlf=true` at `2e2f90f~1`
  and at `2e2f90f` with every tracked file hashed and compared; `autocrlf=false` at `2e2f90f`
  with each `tools/art/*.test.mjs` run separately.
- `lazy/run.mjs` and `lazy/ref.mjs` under `node --expose-gc`: the handling and resources modules
  taken from `HEAD`, from `2c9330b~1` and from `f89d820~1` by `git cat-file`, with only their
  import lines replaced, against real three.js objects; results in 2a, 2b and 2c.
- `node --test tools/art/motion-promotion.test.mjs` at `HEAD`: 34 tests, 34 pass, 0 fail,
  0 skipped (the cache is present on this host).
- Read, not run: `evidence/07-13-cost-candidate.json`, `evidence/07-13-v2-requalification.json`,
  the plan's `0713-e2e.log` and the cached owner-cache result.
- Afterwards `git status --short` shows the same three pre-existing entries as before, plus
  this file.

## What I could not verify

- Any browser behaviour at first hand. I ran no browser suite and no capture; the 11 passed and
  the 12 samples with 3 callbacks are the plan executor's results, which I read.
- Which three callbacks the source actor carries in the capture, and which owner produced the
  fourth in the failed one. The Node rigs are synthetic; they run the real module, not the real
  character.
- Hosted CI. No run has included the art-test step; G-01 is from a local fresh clone without
  installed packages, so only the cache-dependent failures are attributable.
- A fresh checkout on another operating system or git version.
- Whether an owner decision for the unit-test exception exists outside the repository.
- Garbage-collection results are from forced collection in one V8 build; they were stable in my
  run and consistent with the reference graph, but they are observations, not proofs.
- My own effort setting; the frontmatter records what the review was dispatched with.
