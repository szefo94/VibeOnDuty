---
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
reviewed_head: 8dc183f0636b98534ee57eb1b334d4054c56f193
CR-01: resolved-with-notes
CR-03: resolved-with-notes
CR-04: resolved-with-notes
CR-05: resolved-with-notes
WR-01: resolved-with-notes
---

# Phase 7: independent re-review of five code-review fixes

Reviewed 2026-10-10 at HEAD `8dc183f0636b98534ee57eb1b334d4054c56f193`. Working tree as found:
`.planning/config.json` and `.planning/state.json` modified, `.planning/milestone.lock` untracked,
nothing else. The reviewer wrote none of the fixes. Scope: CR-01, CR-03, CR-04, CR-05 and WR-01 of
`07-REVIEW.md`, their fix commits (`773dbb6`, `eb1dc34`, `d5e9b07`, `b097f39`, `05df63d`, `48fe103`,
`6370402`) and the same code at HEAD. CR-02 is out of scope; one section says what bears on it.

## Summary

All five original failure scenarios are closed at the fix commits and at HEAD. No blocker was found.
Every finding carries notes, and two of the notes matter before plan 07-16 task 4 edits
`requirePlan09`:

- Removing `verifyRuntimeDependencies(identities)` from `requirePlan09` or from `requireStableGates`
  leaves all 74 controls of `tools/art/animation-capture.test.mjs` passing (N-01). The CR-03 binding
  inside the plan 09 predicate works today and nothing would notice its loss.
- Once task 4 adds a final frozen-route rejection, the existing CR-01 controls keep their teeth only
  if the new rejection messages do not contain `halted` or `unqualified`, and the controls that use a
  bare `assert.throws` lose theirs in any case (N-02). Both were shown by simulation.

The remaining notes: three contrived summary forms that this parser reads as `complete` and another
reader reads differently (N-03); files the page loads that are outside the identity set (N-04);
unpinned line endings of the golden evidence files, which make two CR-03 controls fail on a fresh
Windows checkout (N-05); a frame-count wait in the WR-01 test (N-06); and no in-repository control
for CR-04 and CR-05, with CI unable to reach the browser step (N-07).

## CR-01: historical body text can qualify a halted summary

**1. Does the fix close the original scenario?** Yes, at `773dbb6`, at `eb1dc34` and at HEAD.
`requirePlan09` (`tools/art/animation-capture.mjs:212-240`) takes only a leading, closed frontmatter
block (`:215`), requires exactly one root line starting with `status` and that line to be
`status: complete` (`:217`, `:224`), every root line to be a plain `key:` (`:221`, `:225`), no indented
child after the status line (`:222-223`, `:226`) and no tab-indented line (`:227`). The body is never
read. The reproduction of `07-REVIEW.md` (probe row B2) is accepted by the function as it was before
`773dbb6` and rejected by every later version. The function text at HEAD is identical to the text at
`eb1dc34`. With the real files at HEAD the call rejects with `Plan09 is missing, halted or
unqualified`; with the real summary's root status set to `complete` in memory it passes the summary
check and stops at `Missing complete plan09 qualification`.

**2. Is there a control that fails if the fix is reverted?** Yes. With the summary check of a scratch
copy put back to the line before `773dbb6`, the unchanged HEAD controls give 58 of 74 passing; the 16
failures are the 15 controls `only unambiguous leading frontmatter can qualify09: <name>`
(`tools/art/animation-capture.test.mjs:42-60`) and `real summary held at halted plus historical
completion remains unqualified` (`:61-67`). With only the follow-up `eb1dc34` undone, 3 fail
(`escapedDuplicate`, `explicitDuplicate`, `malformedStatusChild`).

**3. New defect or weakened check?** None in the function. It is stricter than YAML: a quoted value,
a zero-indented sequence, a byte order mark or a root key starting with `status-` makes a complete
summary unqualified. That is fail-closed and the real summary with its status changed is accepted
(rows A6, A7). Three contrived forms are accepted where another reader disagrees (N-03).

**4. Intact at HEAD, control present and passing?** Yes. 74 of 74 pass in the working tree and in
depth-one clones with `core.autocrlf` true and false.

**Is the parse canonical and the same for every caller?** There is one production caller
(`tools/art/animation-capture.mjs:1004-1006`); it reads `07-09-SUMMARY.md` once as UTF-8 and passes
the text unchanged. No other tool reads that summary's status. Two other frontmatter readers exist in
`tools/art` (`animation-budget-paired.mjs:80-84`, laxer; `motion-promotion.test.mjs:45`), both only
for files whose bytes are pinned by hash.

### CR-01 enumeration

Each variant was passed to the real export at HEAD together with a fully passing synthetic
qualification, so only the summary decides. "Before" is the function before `773dbb6`; `773dbb6` is
the first fix alone. "GSD" is what `gsd-tools.cjs frontmatter get --field status` reads from the same
bytes, used as a second reader because no YAML library is installed. Controls are titles in
`tools/art/animation-capture.test.mjs`.

| Row | Variant | Before | 773dbb6 | HEAD | GSD | Covering control |
|---|---|---|---|---|---|---|
| A1 | Canonical, LF | accept | accept | accept | complete | `capture accepts only current complete09...` (`:16-18`) |
| A2 | Canonical, CRLF | accept | accept | accept | complete | `canonical complete frontmatter permits nested...` (`:68-70`) |
| A3 | Closing fence at end of file, no newline | accept | accept | accept | complete | none |
| A4 | Trailing spaces after the value | accept | accept | accept | complete | none |
| A5 | Nested mapping holding another status | accept | accept | accept | complete | `:68-70` |
| A6, A7 | Real summary with root status `complete`, LF and CRLF | accept | accept | accept | complete | none (probe only) |
| A8 | Complete frontmatter, a second `---` block saying halted in the body | accept | accept | accept | complete | none |
| A9 | Complete frontmatter, body or code block saying halted | accept | accept | accept | complete | `:68-70` (body line) |
| B1 | Real summary as it is | reject | reject | reject | halted | `...cannot bypass halted09` (`:19-21`) |
| B2 | Halted frontmatter, body line `status: complete` (the finding) | accept | reject | reject | halted | `historical` |
| B3 | Halted frontmatter, fenced `status: complete` | accept | reject | reject | halted | `fenced` |
| B4 | Real halted summary plus a fenced complete | accept | reject | reject | halted | `real summary held at halted...` (`:61-67`) |
| B5 | Halted block followed by a complete block | accept | reject | reject | halted | `trailing` |
| B6 | No frontmatter | accept | reject | reject | none | `absent` |
| B7 | Unterminated frontmatter | accept | reject | reject | none | `unterminated` |
| B8 | Status only in a nested mapping | accept | reject | reject | none | `nestedOnly` |
| B9, B11 | Duplicate root status, complete first; both complete | accept | reject | reject | halted; complete | `duplicate`, `duplicateComplete` |
| B10 | Duplicate root status, halted first | accept | reject | reject | complete | none |
| B12 | Double-quoted duplicate key | accept | reject | reject | halted | `quotedDuplicate` |
| B13 | Single-quoted duplicate key | accept | reject | reject | halted | none |
| B14 | Escaped duplicate key | accept | accept | reject | halted | `escapedDuplicate` |
| B15 | Explicit `? status` duplicate key | accept | accept | reject | halted | `explicitDuplicate` |
| B16, B17 | Status with an indented child, with and without a comment between | accept | accept | reject | unparseable | `malformedStatusChild` (B16) |
| B18 | Merge key at root | accept | reject | reject | unparseable | `merged` |
| B19 | Flow sequence value `[complete]` | reject | reject | reject | list | `invalid` |
| B20, B21 | Quoted value, double and single | reject | reject | reject | complete | none |
| B22, B23, B24 | Anchor on the value, alias value, tagged value | reject | reject | reject | unparseable; complete | none |
| B25 | Trailing comment after the value | reject | reject | reject | complete | none |
| B26, B27 | No space after the colon; space before it | reject | reject | reject | none; complete | none |
| B28, B29, B30 | Capitalised key, capitalised value, `completed` | reject | reject | reject | none or other value | none |
| B31 | Trailing tab after the value | accept | reject | reject | complete | none |
| B32, B33 | Space or tab before the key | reject | reject | reject | complete; unparseable | none |
| B34, B35 | Byte order mark before the fence, synthetic and real summary | accept | reject | reject | complete | none |
| B36, B37 | Blank line or space before the opening fence | accept | reject | reject | none | none |
| B38, B39, B40 | Opening fence with trailing space; four dashes; closing fence with trailing space | accept | reject | reject | none; none; complete | none |
| B41 | `...` as the closing marker | accept | reject | reject | none | none |
| B42 | A `---` line inside the frontmatter before the status | accept | reject | reject | none | none |
| B43 | Empty first block, then a complete block | accept | accept | reject | none | none |
| B44, B45 | Block scalar holding a status line, with and without a root halted | reject | reject | reject | halted; none | none |
| B46 | Zero-indented sequence (valid YAML) | accept | accept | reject | complete | none |
| B47 | Root comment `# status: complete` with root halted | reject | reject | reject | halted | none |
| B48 | Root comment `#status: halted` with root complete | accept | accept | accept | complete | none (correct: it is a comment) |
| B49 | Lone carriage returns as the only line endings | accept | reject | reject | none | none |
| B50 | Non-ASCII look-alike key next to the status | accept | accept | reject | complete | none |
| B51, B52, B53 | Zero-width space in the key; empty value; empty value with indented `complete` | reject | reject | reject | none; none; complete | none |
| B54, B55 | Flow mapping root; content on the fence line | reject | reject | reject | complete; none | none |
| C1 | Root `status: complete`, then a root line holding a lone carriage return followed by `status: halted` | accept | accept | **accept** | halted | none |
| C2 | The same with the hidden status first | accept | accept | **accept** | complete | none |
| C3, C4 | The same with U+2028 or U+0085 in place of the carriage return | accept | accept | **accept** | unparseable; complete | none |
| C5 | Real mapping indented by one space with `status: halted`; a quoted scalar whose unindented continuation lines are `status: complete` and one more key | accept | accept | **accept** | halted | none |
| C6 | As C5 with the scalar closed right after the status line | accept | accept | reject | halted | none (caught by the indented-child rule) |
| C8 | `status: complete` as a continuation line of a double-quoted root scalar, no real status | accept | accept | **accept** | none | none |

Rows C1, C3, C5 and C8 are the only ones where HEAD accepts and the second reader does not read
`complete`. Each needs a summary written that way on purpose, by a party that could equally write
`status: complete`; none can arise from historical text in the body. They are N-03. Of the 73
variants, every one that HEAD rejects carries the one message `Plan09 is missing, halted or
unqualified`.

## CR-03: runtime manifest omitted from qualification identities

**1. Does the fix close the original scenario?** Yes. At HEAD the collector lists the manifest
(`tools/art/review.mjs:386`), the model, the motion donor and, when present, the acceptance registry
(`:385-388`, `:397-398`), and verifies the collected bytes twice (`:408`, `:411`).
`verifyRuntimeDependencies` (`tools/art/runtime-dependencies.mjs:35-50`) requires the protected
provenance hash, the manifest identity to equal the actual manifest bytes (`:45`) and the three
tuple files to be exactly one registered tuple (`tools/art/motion-acceptance.mjs:59-80`). The pure
gate calls it before anything else (`tools/art/animation-budget-v2.mjs:166`), the CLI calls it and
re-hashes every listed file (`:260-262`), and `requirePlan09` and `requireStableGates` call it
(`tools/art/animation-capture.mjs:228`, `:201`). Observed at HEAD with the real exports:

| Probe | Result |
|---|---|
| Collector with the manifest bytes substituted on read (the finding's mutation) | rejects: `Runtime manifest differs from protected accepted bytes or unregistered/mixed motion tuple` |
| Collector with model bytes substituted; with registry bytes substituted | rejects; rejects (`Forged/changed acceptance registry bytes`) |
| `requirePlan09`, manifest identity absent or of a changed manifest, on both sides | rejects: `Missing/stale runtime manifest identity` |
| `requirePlan09`, registry identity absent; other model identity | rejects; rejects |
| `requireStableGates`, manifest identity absent or changed, on both sides | rejects |
| `verifyCandidate`, reference-shaped candidate without a manifest identity (the frozen budget does not list the manifest) | rejects: `Missing/stale runtime manifest identity` |

The claim of the plan 07-16 executor that the identity file list already covers the manifest is
correct: `tools/art/review.mjs:386`, and the current identity set has 131 entries of which
`tools/art/motion-manifest.json` is one. The mechanism of `d5e9b07` (manifest equals the hash in
protected provenance) was replaced by `9ce341b` with the registered-tuple check; at `05df63d` the
original mechanism passes its own controls (see "What I ran").

**2. Is there a control that fails if the fix is reverted?** For the collector and the gate, yes; for
the plan 09 predicate, no.

| Part undone in a scratch copy | Unchanged HEAD controls |
|---|---|
| Manifest removed from the collector name list | `collector includes runtime JSON and detects manifest-only mutation without asset writes` fails (`tools/art/runtime-dependencies.test.mjs:42-51`) |
| Both verification calls removed from the collector | the same control fails |
| `verifyRuntimeDependencies` removed from `verifyCandidate` | 4 of 47 fail, among them `pure V2 rejects missing/stale runtime dependency...` and `pure V2 rejects newly hashed cadence and forged acceptance fields` (`tools/art/animation-budget-v2.test.mjs:58-80`) |
| `verifyRuntimeDependencies` removed from `requirePlan09` (`animation-capture.mjs:228`) | **74 of 74 pass** |
| `verifyRuntimeDependencies` removed from `requireStableGates` (`animation-capture.mjs:201`) | **74 of 74 pass** |

The last two rows are N-01. The control `assert.throws(() => requireStableGates({}, evidence))`
(`animation-capture.test.mjs:82`) throws for the identity mismatch as well, so it does not
distinguish.

**3. New defect or weakened check?** No weakening. The tuple check binds more than the original fix
(model and donor as well as the manifest). Two cosmetic leftovers: `runtimeDependencyBytes` reads the
manifest twice (`runtime-dependencies.mjs:18`, `:20`), and the returned `acceptedManifestSha256` is
the historical provenance value, which no longer equals `manifestSha256`.

**4. Intact at HEAD, control present and passing?** Yes: `runtime-dependencies.test.mjs` 6 of 6 and
`animation-budget-v2.test.mjs` 47 of 47 in the working tree. In a depth-one clone with
`core.autocrlf=false` the first is 6 of 6 and the second 44 of 47 (three cache-dependent tests,
G-01). With `core.autocrlf=true` two CR-03 controls also fail, for a line-ending reason (N-05).

### CR-03 identity coverage

"Served" means the capture page can fetch it from the owned Vite server. The identity set is what
`animationIdentities` returns (`tools/art/review.mjs:383-415`): 119 `.js` files under `src/`, 11
named files and the sampler.

| Item | Served to the page | In the identity set | How it is bound |
|---|---|---|---|
| `index.html`, `style.css` | yes | yes | name list `review.mjs:385` |
| Every `.js` under `src/` (119, tests included) | yes | yes | directory walk `review.mjs:389-396` |
| `tools/art/motion-manifest.json` (imported by `src/builders/animationPresentation.js:1`, `enemyGLTF.js:24`, `weaponHandling.js:2`, `src/dev/animationReview.js:1`) | yes | yes | `review.mjs:386`; registered tuple |
| `public/models/enemy.glb` | yes | yes | name list; registered tuple |
| `public/textures/comic-slice.png` | yes | yes | name list |
| `tools/art/motion-acceptance.json` | no | yes when present; required for the corrected tuple | `review.mjs:397-398`; literal hash `motion-acceptance.mjs:36` |
| `tools/art/sources/motion.blend`, `provenance.json`, `soldier.blend`, `character-params.json`, `build_soldier.py` | no | yes | name list; tuple and protected provenance |
| Sampler function | runs in the page | yes (`captureSampler`) | `review.mjs:413` |
| `public/models/FBX/P90.fbx` | yes, fetched and parsed at boot (`src/main.js:513`, `src/builders/weaponFBX.js:26-35`); not added to the scene (`src/builders/weapon.js:187-192`) | **no** | frozen route: nothing. Paired route: copied into both arms (`animation-budget-paired.mjs:276-279`) and `public/` must be clean against HEAD (`:291-296`); not hashed into the identity or the registry |
| `public/models/FBX/Pistol.fbx` | yes, fetched and parsed at boot (`src/main.js:514`, `src/builders/enemyWeapon.js:23-31`); template for pistol-role weapons | **no** | as above |
| Other FBX files, `favicon.ico` | only if requested; no source reference found | no | as above |
| `three` 0.160.1 and the other packages the page imports (`@colyseus/sdk`, `@colyseus/schema`) | yes, from `node_modules` | **no** | `package-lock.json` is not hashed. Paired route: both arms share one `node_modules` (`review.mjs:980`), so a ratio is unaffected; an absolute frozen comparison is not protected |
| `vite.config.js` (build stamp constants), Vite itself | config applies to the frozen-route capture server (`review.mjs:700`); paired arms use `configFile: false` (`review.mjs:978`) | no | nothing |
| Browser build | n/a | no | frozen route: `candidate.device` must equal the frozen device (`animation-budget-v2.mjs:172`); paired route: calibration scope |
| Any non-`.js` file under `src/` | none exists today | would not be | the walk keeps `.js` only (`review.mjs:393`) |

Answer to the question asked: the manifest, the model and the texture are inside; what remains
outside and can change what the page does is the two weapon FBX files, the installed packages and
the Vite configuration (N-04). Whether a pistol-role actor is drawn in the measured workload was
not established.

## CR-04: browser fixtures required historical Git objects

**1. Closed?** Yes. Both specs read a checked-in fixture next to the spec and check its SHA-256
before use (`tests/animation-resources.spec.js:7-11`, `tests/weapon-handling.spec.js:9-13`). The
fixture blobs are `56eecc0a...` and `a949f7cc...`, the same objects as `1e537a4:src/builders/...`
and as the reference owners pinned by the paired contract. In depth-one clones (`core.autocrlf` true
and false) the commit `1e537a4` is absent, the old import-time command exits 128, both fixtures
hash to the pinned values, and the module top level of all 16 specs runs (resources 13 tests,
handling 11). The spec heads from before `b097f39`, placed in the same clone, fail at the `git show`.

**2. Control that fails on revert?** Not in the repository. The import-time hash check guards the
fixture bytes (one appended byte, or CRLF bytes, stop the spec with `Immutable uncached ... fixture
changed`), and `tests/fixtures/.gitattributes` keeps the bytes LF. Nothing runs discovery on a
history-less checkout except CI, which has not run these commits (N-07).

**3. New defect or weakened check?** No. The diffs change only the import heads; the comparisons
are untouched.

**4. Intact at HEAD?** Yes. Later commits added one retirement check and a `mkdir`; fixtures and
hash checks are unchanged.

**Interaction with G-01 and with shallow history in the paired tool.** The same class is not
reintroduced. `chain` and `verdict` refuse a shallow repository when they are run, by design; the
refusal is tested through an injected reader and `animation-budget-paired.test.mjs` passes 117 of
117 in a depth-one clone. No test under `tests/`, `src/` or `tools/art/` reads Git history at import.
What does remain is G-01: on a fresh checkout six tests in three files fail for the gitignored cache
(`animation-budget-v2.test.mjs` 3, `art-motion.test.mjs` 2, `motion-pipeline.test.mjs` 1), so
`npm run test:art` exits non-zero and the workflow stops before the Playwright step
(`.github/workflows/test.yml:26`, then `:39`). The CR-04 fix is correct and its effect in CI cannot
be observed until G-01 is fixed.

## CR-05: review fixture hardcoded a Windows checkout

**1. Closed?** Yes. `tests/animation-review.spec.js:10` derives the root from the module URL, uses
it for the server (`:15`) and for the evidence directory (`:149`), and binds a probed free port
strictly (`:13-16`). No tracked source outside planning documents contains a fixed checkout path;
the five absolute paths in `tools/art/provenance.json:142-162` are recorded history, not inputs.

**2. Control that fails on revert?** None in the repository: a fixed path would pass on this
machine. The evidence is the fixer's run from a differently named checkout (log retained in the
gitignored cache) and reading.

**3. New defect or weakened check?** No. Two other specs still write evidence relative to the
working directory (`tests/animation-resources.spec.js:96-97`, `:242`,
`tests/weapon-handling.spec.js:99-100`); harmless while the suite is started from the root.

**4. Intact at HEAD?** Yes, unchanged since `48fe103`. Not executed on Linux by anyone.

## WR-01: blocked-gait test inspected inactive source aliases

**1. Closed?** Yes, by reading. The test sums the scheduled weight of the real lower masks from
`window.__presentationDebug().layers` (`tests/animation-presentation.spec.js:41-48`); mask clips are
named `<clip>_lower` (`src/builders/enemyAnimations.js:359`), which the pattern matches. It asserts
a moving phase first (`:91-94`) and then the blocked phase (`:96-102`).

**2. Control that fails on revert?** The moving positive control. The fixer's retained log shows the
old alias query failing at the line that is now `:93`. Not re-run here (browser).

**3. New defect or weakened check?** One fragility (N-06): the blocked phase waits 20 animation
frames (`:77`) for a stop transition that lasts 0.4 s of presentation time
(`src/builders/animationPresentation.js:92`), then requires `transition` to be empty (`:99`). At
frame times under about 21 ms the measured frames are still in the transition. It can only fail
falsely.

**4. Intact at HEAD?** Yes; the only later change to the file is in another test.

## What bears on CR-02

Nothing in the five fix commits touches the promotion or its recovery. At HEAD the CR-03 guarantee
rests on CR-02 code: `verifyMotionTuple` and the literal hashes in `motion-acceptance.mjs`. It does
not rest on the recovery paths of `promote-motion.mjs`: whatever recovery leaves on disk, a tuple
that is not exactly the original or the corrected one is refused, and a present lock file refuses
every verification (`motion-acceptance.mjs:52-54`). So the un-reviewed recovery hardening can affect
availability, not what qualifies. One observation for the CR-02 owner: with the registry file absent
and the three original files restored, the same gates accept the original tuple as `original107`
(`motion-acceptance.mjs:67-77`); nothing in these gates requires the corrected asset.

## Risks for plan 07-16 task 4

1. **Message collision (N-02).** 18 CR-01 controls match `/halted|unqualified/`. With a final
   three-argument rejection added and the summary check removed, a neutral message leaves those 18
   failing; a message containing `unqualified` leaves none failing. New rejection messages on both
   routes must not contain `halted` or `unqualified`.
2. **Bare `assert.throws` becomes vacuous (N-02).** After task 4 every three-argument frozen-route
   call throws at the end because no decision record is on disk. `real summary held at halted plus
   historical completion remains unqualified` (`:61-67`) and both mutation loops (`:22-29`, `:30-41`)
   then pass with their own check removed. Evaluation order keeps the message right; it does not
   give a bare control teeth. Since those lines must stay byte for byte, add new controls that pass
   synthetic readers as the fourth argument, start from a fully valid record, and assert the message
   of the check they name.
3. **No control for the CR-03 line (N-01).** Add, before the function is edited, controls that give
   identical identities on both sides with the manifest identity absent, stale, the provenance
   identity changed and the registry identity absent, for `requirePlan09` and `requireStableGates`,
   each asserting its message.
4. **Paired route must not skip the two fixes.** The behaviour list says the halted-summary and
   stale-identity rejections hold on both routes, but the controls named in the action are
   frozen-route controls. Add paired-route controls for: halted frontmatter; halted frontmatter with
   a body `status: complete`; duplicate status; manifest identity absent and stale. A route branch
   that returns before the summary check or before `verifyRuntimeDependencies` would otherwise pass.
5. **Order is not pinned.** Moving the summary check to the end of the function leaves 74 of 74
   passing. If order matters to the plan, give it a control.
6. **Frozen tool failure on the paired route.** A missing manifest identity makes the frozen CLI
   fail on stderr only (`animation-budget-v2.mjs:260`, `:268`). The planned rule "a stderr-only
   failure makes `passed` false" preserves CR-03 in `executeV2`; let the planned structural-failure
   control use exactly a candidate without the manifest identity.
7. **Reading the owner decision record.** `frozenDecision` is a path and a hash supplied by the
   qualification record itself, so the parse of `decision:` and `decided_by:` decides. Use the strict
   root-scalar rules of `requirePlan09`, not `rootScalar` of `animation-budget-paired.mjs:81-84`,
   which does not see a quoted duplicate key. Reject a `timingGate` that is present and is neither of
   the two strings, including `null` and the empty string.
8. **Injected readers.** The fourth argument must not be able to supply the summary or the
   identities. The planned source-text check that `captureAnimationReview` calls `requirePlan09` with
   three arguments covers the production caller; the later `stable-gates.mjs check` caller must take
   its identities from `animationIdentities()` and not from a file.
9. **Line endings.** `tools/art/animation-capture.mjs` and its test are CRLF with `-text`; an editor
   that rewrites them changes every line.
10. **Identity width (N-04).** If the identity set is to cover the FBX files or the lockfile, widen
    it before plan 07-18 spends a calibration: a wider set changes the identity hash, and with it
    the stable-gate evidence and the session count.

## New findings

| Id | Severity | Where | Evidence | Required action |
|---|---|---|---|---|
| N-01 | WARNING | `tools/art/animation-capture.mjs:201`, `:228`; `tools/art/animation-capture.test.mjs` | Removing either `verifyRuntimeDependencies(identities)` call leaves 74 of 74 controls passing. | Add the controls of risk 3 before task 4 edits `requirePlan09`. |
| N-02 | WARNING | `tools/art/animation-capture.test.mjs:19-67`; `07-16-PLAN.md` task 4 | Simulated final rejection plus removed summary check: neutral message, 18 CR-01 controls still fail and the bare ones do not; message with `unqualified`, none fails. | Risks 1, 2 and 4. The implementation review should remove the summary check in a scratch copy and require a failing control on each route. |
| N-03 | WARNING | `tools/art/animation-capture.mjs:215-227` | Rows C1, C3, C4, C5, C8 are accepted; the second reader reads `halted` for C1 and C5. Deliberate authoring only. | Not blocking. Reject a frontmatter that still contains a carriage return, U+0085, U+2028 or U+2029 after CRLF normalisation; require the first non-blank, non-comment line to start at column 0; add the rows as controls. |
| N-04 | WARNING | `tools/art/review.mjs:383-415` | The collector reads 130 files, none of them an FBX, the lockfile or the Vite configuration; `src/main.js:513-514` loads two FBX files at boot. | Owner decision before plan 07-18: widen the identity set, or record the hashes of the two FBX files and of `package-lock.json` and the installed `three` version in the qualification evidence, and state the limit wherever the identity is described as covering what is served. |
| N-05 | WARNING | `.gitattributes`; `tools/art/animation-budget-v2.mjs:227-236` | In a depth-one clone with `core.autocrlf=true` the golden evidence files are checked out with CRLF (three checked; the other two carry the same empty attributes), the frozen CLI refuses every candidate at the baseline hash, and the controls at `animation-budget-v2.test.mjs:81` and `:96` fail. Fail-closed. | Add exact-path line-ending pins for `07-baseline.json`, `07-budget.json`, `07-budget-view-v2.json`, `07-09-view-reference-v2.json` and `07-09-cost-report.json`. They are LF in the index and in this working copy, so the attribute changes no bytes here. |
| N-06 | WARNING | `tests/animation-presentation.spec.js:77`, `:99`; `src/builders/animationPresentation.js:92` | 20 frames against a 0.4 s transition; by reading, not run. | Wait until `__presentationDebug().transition` is empty, or for presentation time, instead of a frame count. |
| N-07 | WARNING | `tests/`; `.github/workflows/test.yml:26`, `:39` | No control fails if CR-04 or CR-05 is reverted on this machine; the branch is 355 commits ahead of `origin/main`; `test:art` fails first on a fresh checkout (G-01). | Fix G-01. Optionally add a Node control that reads the specs and refuses a `git` history command at module level and a fixed drive path. |
| N-08 | INFO | `tests/animation-resources.spec.js:96-97`, `:242`; `tests/weapon-handling.spec.js:99-100` | Evidence paths relative to the working directory. | Derive from the module URL when next touched. |
| N-09 | INFO | `tools/art/runtime-dependencies.mjs:18`, `:20`, `:49` | Manifest read twice; `acceptedManifestSha256` is the historical value. | None required. |

## What I ran and saw

All scripts were scratch files outside the repository and are deleted; clones and extracted trees
were under the scratchpad and are deleted. No repository file was written except this record. No
browser, capture, Blender or frozen-bytes command was run.

- `node --test tools/art/animation-capture.test.mjs tools/art/runtime-dependencies.test.mjs`:
  80 of 80. `node --test tools/art/animation-budget-v2.test.mjs`: 47 of 47 (it writes only owned
  directories under the OS temp directory).
- CR-01 probe: 73 summary variants against the real HEAD export and against the function text of
  `773dbb6^`, `773dbb6`, `d5e9b07`, `eb1dc34` and the HEAD blob compiled from Git objects; results in
  the table. The HEAD blob and the HEAD export agree on every row; `eb1dc34` and HEAD have identical
  function text.
- Mutation runs: scratch copies of `animation-capture.mjs`, `review.mjs` and `animation-budget-v2.mjs`
  with one part of a fix undone, relative imports pointed at the repository, and the unchanged HEAD
  controls run against each. Unmodified copies pass 74, 6 and 47 (harness check). Results are in the
  CR-01 and CR-03 sections.
- Task 4 simulation: `requirePlan09` in a scratch copy given a final rejection for three-argument
  calls. Nothing removed: only the two positive controls fail. Summary check removed, neutral
  message: 20 fail (the two positives and 18 CR-01 controls). Summary check removed, message
  containing `unqualified`: only the two positives fail. `verifyRuntimeDependencies` removed: only
  the two positives fail.
- CR-03 probe with the real exports and real files: the table in the CR-03 section; current identity
  set 131 entries, three of them absent from the frozen reference (manifest, donor, registry).
- Depth-one clones of HEAD with `core.autocrlf` true and false: fixture hashes, absence of `1e537a4`,
  the old command's exit code, module top level of all 16 specs with a stand-in for
  `@playwright/test`, pre-fix spec heads, a changed fixture, and every `tools/art/*.test.mjs` file.
- Tree of `05df63d` (the last of the five fix commits) extracted with `git archive` into scratch:
  capture controls 38 of 38, runtime-dependency controls 6 of 6, budget controls 44 of 46 (the two
  failures need the gitignored cache). This matches the 90 checks of `07-REVIEW-FIX.md`.
- Read: the seven fix diffs, `07-REVIEW.md`, `07-REVIEW-FIX.md`, `07-REVIEW-DISPOSITION.md`,
  `07-16-PLAN.md` task 4, and the fixer's retained logs for discovery and WR-01.

## What I could not verify

- Any browser behaviour: the two owner-cache cases of CR-04, the relocated run of CR-05 and the
  WR-01 test. They rest on the fixer's retained logs, which are in the gitignored cache.
- Playwright's own discovery. The module top level of each spec was executed with a stand-in
  package; the fixer's log shows the real listing.
- Linux and the CI workflow. The workflow has not run on these commits.
- The reading of the contrived rows by a full YAML parser; the GSD frontmatter reader stood in.
- Whether the capture workload draws a pistol-role actor, and so whether `Pistol.fbx` can change a
  measured value. N-06 is from reading the two timings, not from a run.
