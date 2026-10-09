---
phase: 07-movement-matched-and-action-safe-animation
plan: "21"
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
reviewed: 2026-10-09T22:30:00Z
reviewed_head: a9f3d019511c14d8cc14bf7aa304d10099af1206
reviewed_corrected_sha256: f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393
status_applies_to: the bytes named in reviewed_corrected_sha256, and to no other
plan_base: e0663dc6f3dca20904b7509f04c4fc20465ec3d3
commits_reviewed: [8d71473, 68bf214, 6f33df7, f7bc7c4, 14ff711, f0e0b8f, 9b87860, 9dfebbb, 91ab1af, a9f3d01]
first_review:
  reviewed: 2026-10-09T21:46:00Z
  reviewed_head: 14ff711591c793f14fe8b213903732c03f41eaed
  verdict: pass-with-notes
  superseded: true
delta_findings:
  blocker: 0
  warning: 1
  note: 7
---

# Plan 07-21: delta review of the re-registered `src/main.js` exception

Dated 2026-10-09T22:30:00Z, at `HEAD` `a9f3d01`. Second pass by the same reviewer, read-only
except for this record. The first review (dated 2026-10-09T21:46:00Z, at `14ff711`) is kept
unchanged at the end of this file; it covered a corrected hash that is now superseded and
accepted nowhere. Where the two parts disagree, this part is the current one.

## Verdict for the current registered bytes

`pass-with-notes`, for exactly these bytes of `src/main.js`:

`f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393`

(26,122 bytes, no carriage return, 571 line feeds; the committed blob at `a9f3d01`, the working
file, and the decoded preserved `corrected` copy, each hashed by my own code.)

| Blocker condition | Result | Basis |
|---|---|---|
| Diff not confined as claimed | not met | Frozen bytes minus carriage returns plus one contiguous 446-byte insertion at line 275 column 6; against the bytes I reviewed before, only old lines 275-276 are replaced |
| A legitimate capture path is broken | not met | The lock request, Resume and canvas paths are byte-identical; the guard still sits in a branch that ends in `return` |
| Exception accepts anything but the exact pair | not met | 67,431 input tuples against the rule at `e0663dc`, at `14ff711` and at `HEAD` |
| A frozen file changed | not met | Blob ids unchanged since `e0663dc` for the gate, its test, budget, reference, baseline and cost report; 119 of 127 identities equal their frozen hash, the same 8 differ |
| Registered hash not bound to the committed bytes | not met | Registry, `HEAD` blob, working file and preserved copy agree; three fresh clones reproduce the hash |
| Another file changed line-ending form | not met | Same four attribute-carrying paths; `.gitattributes` blob unchanged since `14ff711`; the 25 frozen store entries are identical to `8d71473` |
| The Skip hide leaves no visible way to resume or leave | not met | See question 2 |
| A new spec case cannot fail | not met | Each of the five has a recorded failing run (question 8) |
| `51db511f...` still accepted anywhere | not met | Rejected by the rule in every position and by the real gate; absent from the registry module and from the store |

One new warning (D-01, the spec's source-substitution switch) and seven notes. None of them
needs a change to a protected file, so none needs another registered hash.

## Disposition of the first review's findings

| id | First-review finding | Now | Basis |
|---|---|---|---|
| F-01 | `#mp-error-banner` misclassified, same defect offline | resolved, with a stated limit | Banner is in the selector (`src/main.js:278`); two real-press cases, failing on the superseded bytes and passing on these (`tests/pause-menu-pointer-lock.spec.js:250-275`); surface row split and corrected (`evidence/07-21-source-change.json:378`). Limit: only the capture was measured, not a lost click (D-04) |
| F-02 | `#kc-skip` untested; stale pause menu in one corner | resolved for the Skip route | Wave case and paused-at-match-end case (`spec:277-333`); the corner is fixed by `src/main.js:279`. The S&D form was not pressed, and the `[K]` and expiry routes to the same stale menu remain (D-03) |
| F-03 | No gate-level control | resolved | `tools/art/motion-promotion.test.mjs:160-241`, through the real `verifyCandidate`; passes here and in both full clones; the original-tuple half skips on a shallow history (D-05) |
| F-04 | Blank-area change disclosed only in evidence | resolved except the summary | Comment rewritten (`src/main.js:275-277`); case at `spec:240-248`, shown failing with a guard that matches nothing; summary text is still to be written |
| F-05 | `guardLines` is only a count | unchanged, accepted | Now 6; the hash pair pins content |
| F-06 | `hashBasis` flip could skip the disk comparison | resolved | Literal assertion and decision-record check (`motion-promotion.test.mjs:65-66`); the disk comparison is no longer skippable (`:153-159`) |
| F-07 | Exception live with no tie to a review | partially resolved | Control at `motion-promotion.test.mjs:71-83`; it is a tripwire, not proof (question 6, D-02) |
| F-08 | Gate accepts either hash | recorded | Limitation text (`evidence:1462`) and an assertion (`motion-promotion.test.mjs:204`); the rule is unchanged, as it should be |
| F-09 | Missing binding throws, uncontrolled | resolved | `motion-promotion.test.mjs:99-100` |
| F-10 | Decision provenance | not changed | For the owner |
| F-11 | `reruns` null; stale line numbers; `task` field | partially | `task` corrected and a line-number note added; `reruns` is still `null` (`evidence:933`) |
| F-12 | Cases 2 and 3 do not detect the defect | not changed | Still true; no action needed |
| F-13 | `animation-budget-v2.test.mjs` fails on a fresh clone | not changed | Pre-existing and outside this plan; recorded under limitations |
| F-14 | Captured pointer after a canvas press in a wave killcam; stale pause menu | partially | Fixed for a Skip press only; the rest is in files this plan must not touch |
| F-15 | Controls read `.planning/` by relative path; `.gitattributes` line count | not changed | Fails closed as written |

## The ten questions

### 1. Confined to lines 275-280? Still frozen bytes plus insertions inside the one handler?

Yes to both.

- Decoded with my own code again (`Buffer.from(rows.join(''), 'base64')`, nothing imported from
  `tools/art/frozen-bytes.mjs`). Frozen copy: 26,035 bytes, `c7620446...882d3`. Corrected copy:
  26,122 bytes, the hash above, byte-equal to the working file and to
  `git cat-file blob HEAD:src/main.js`.
- Frozen copy without carriage returns (25,676 bytes, byte-equal to the `e0663dc` blob) against
  the corrected copy: common prefix 13,464 bytes, common suffix 12,212 bytes, 13,464 + 12,212 =
  25,676, nothing removed, 446 bytes inserted at line 275 column 6. The inserted run is exactly
  the three comment lines and three statements at `src/main.js:275-280`.
- Against the blob I reviewed at `14ff711` (`51db511f...`): common prefix 13,475, common suffix
  12,228; 115 bytes removed (the old comment tail and the old `if (...closest...)` head on old
  lines 275-276) and 419 inserted. Nothing else differs.
- Untouched, by the comparison above: the online early return (`src/main.js:272`), `tryShoot()`
  (`:284`), grenade (`:286`), ADS (`:287`), `mouseup` (`:289-292`), the canvas click handler
  (`:316-318`), `returnToMainMenu` (`:323-372`), `pointerlockchange` (`:374-384`), Resume and Main
  Menu listeners (`:386-390`), the graphics-quality capture listener (`:78-87`), every touch branch.
- `npx eslint src/main.js --max-warnings 0`: exit 0.

### 2. Is hiding `#pause-menu` on a Skip `mousedown` correct in every reachable state?

Yes. I found no state it makes worse and no dead end.

- Online: unreachable. `src/main.js:272` returns for every button while `isOnline()`, before
  line 273. Joining online also stops any killcam (`src/network/onlineSession.js:319`).
- Locked, buy panel open, or game not running: the branch at `src/main.js:274` is not entered.
- What the hide can affect is bounded by the killcam. `#kc-skip` is visible only while a killcam
  runs (`src/replay/killcam.js:58-74`). The killcam ticks every frame whatever the lock state
  (`src/loop.js:236-237`) and ends by timer after 2.8 s of simulated time (`killcam.js:8`, `:36`).
  There are three callers, and every callback sets `gameRunning` false before showing its screen:
  `_showWaveOver` (`src/entities/enemies.js:258-259`), `doResult` (`src/modes/snd.js:361-362`),
  `_show` (`src/modes/tdm.js:52-53`). A second `startKillcam` while one runs is ignored
  (`killcam.js:13`). So after any killcam the pause menu has no purpose, and hiding it early
  never removes a menu that should stay.

| State at the Skip press | Before this delta | Now |
|---|---|---|
| Wave death, player dead, pause hidden | no lock, death screen | same; the hide is a no-op |
| Killed while already paused (the release is silent, so the pause menu was left up) | stale pause menu over the death or result screen | hidden; better |
| TDM lost at time-up or S&D round end, alive, Esc pressed, pause menu up | stale pause menu over `#snd-result` | hidden, result shown; this is the regression the first review reported |
| Same, press abandoned (pointer dragged off, no click) | pause menu stays | pause menu hidden for the rest of the killcam, at most 2.8 s of simulated time; Skip stays visible, `[K]` still works, a canvas press still captures; then the result screen with its button appears |
| Not paused, alive, pointer locked | cannot press a button while locked | same |

- Running, unlocked, no visible way to resume or leave: only the abandoned-press row comes
  close, and it is bounded, shows Skip throughout, and ends by itself in a screen with a control.
  Not a blocker.
- `document.getElementById('pause-menu')` cannot be null here: the element is static
  (`index.html:182`) and the same file already dereferences it unguarded (`src/main.js:321`, `:380`).
- Side effect on the collector: its `document`-targeted `mousedown`
  (`tools/art/animation-capture.mjs:373`) gives `control` undefined, so neither new statement acts.

### 3. Is `#mp-error-banner` justified on a measured capture without a measured lost click?

Yes as a low-risk consistency fix; the record is right not to claim more.

- What was measured (cached report, hash matches the evidence): on the superseded bytes both
  banner cases failed on one observation, "the pointer was captured before the click was
  delivered"; the click itself arrived. Under these adapters a click on a control that stays
  visible always arrives, so a lost click could not have shown either way. The author says this
  (`evidence:1262` onward, and `settled` at `:1430`).
- A press on the banner is never a press that should capture: the banner is an alert with two
  buttons, and the canvas around it still captures.
- Pointer state afterwards. Return to menu: its click calls the Main Menu button's handler
  (`onlineSession.js:622-624`), `returnToMainMenu` clears the banner through `leaveOnline`
  (`src/main.js:326`) and releases the pointer (`:366`). Retry: `joinOnline` asks for the lock
  itself from the click (`onlineSession.js:250-258`) and releases it when the join fails (`:352`);
  the case ends with the offline match still running, paused, banner up, pointer released
  (`spec:270-274`). The guard only removes the earlier capture on `mousedown`.
- While genuinely online the banner can also show (`onlineSession.js:305-307`); that path returns
  at `src/main.js:272` and is unaffected.
- Left as it was: no offline start clears the banner, so it still sits over an offline match.
  The guard treats the press, not that (D-04).

### 4. Do the gate-level controls exercise `verifyCandidate` faithfully?

Yes for the identity loop, which is all the exception touches.

- `gate()` (`motion-promotion.test.mjs:166-181`) calls the real `verifyCandidate` with the tracked
  frozen budget file, the tracked reference report as candidate body, and the published tuple
  bytes read from tracked files (`:21-22`). It builds the candidate the way the CR-02 control does
  (`tools/art/animation-budget-v2.test.mjs:20-33`). The gate file and its test are unchanged
  (blobs `c23e1429`, `af8ca8f6`).
- The assertions match the gate's own message, anchored at the end of the name
  (`:183`), so `src/main.js` cannot be satisfied by a longer name.
- My own probe of the real gate, written before these controls existed and rerun now, agrees:
  corrected hash accepted; `51db511f...`, another hash, a one-character neighbour and a missing
  identity rejected with `Protected source changed: src/main.js`; a changed `src/loop.js` beside
  the corrected file rejected on `src/loop.js`; the corrected hash on `src/input.js` or
  `index.html` rejected on that file; corrected hash under the original tuple rejected.
- Can the control pass while the real gate rejects? Only for reasons outside the exception
  (timings, pixels, the frozen reference). One real difference is worth knowing: the command-line
  gate also requires every reported identity to equal the file on disk
  (`tools/art/animation-budget-v2.mjs:261-262`), which `verifyCandidate` alone does not. On this
  tree that makes the command accept only the corrected hash, while the function accepts the
  frozen one too. The disk half is covered separately (`motion-promotion.test.mjs:153-159`) (D-06).
- The visible skip is acceptable. The original-tuple case needs three blobs from history
  (`:210-229`), each checked against its registered hash before use. On a shallow history it
  reports as skipped with a reason (`:232-233`); I saw exactly that in a `--depth 1` clone. The
  rule-level control for the original binding always runs (`:96-97`).

### 5. Does the rule still accept exactly one tuple for `src/main.js`?

Yes.

- `tools/art/motion-acceptance.mjs` differs from `14ff711` on two lines only, 95 and 96 (the
  `corrected` value and `guardLines`). The rule body (`:98-107`) is unchanged.
- Enumeration over 133 name entries (the 128 reference names, the three tuple file names, one
  of which is already among the 128, and two near-misses), 13 by 13 hashes (frozen, new corrected, superseded, every CR-02 and dependent
  hash, `undefined`, an unrelated hash) and three bindings, 67,431 tuples:
  - `e0663dc` to working module: one difference, `('src/main.js', c7620446..., f768954f..., corrected binding)` false to true.
  - `14ff711` to working module: two differences, that tuple false to true and
    `('src/main.js', c7620446..., 51db511f..., corrected binding)` true to false.
  - `HEAD` blob to working module: none.
- Every accepted tuple in the whole enumeration: the three CR-02 tuple files, the one dependent,
  and `src/main.js` with the pair above. Nothing else is widened.
- `51db511f...` is rejected as current hash, as reference hash and as the target of the new
  hash; it does not occur in `motion-acceptance.mjs`; the store's `corrected` section has one
  key and it decodes to the new bytes. In tracked files the old hash now occurs only in this
  record (first review text), in the evidence record, and in the control that rejects it
  (`motion-promotion.test.mjs:40`).

### 6. Is a control that fails until the review names the hash a sound form?

It is a sound tripwire and a weak proof. Both halves matter.

- What it does well: a re-registered hash cannot pass `npm run test:art` until this record
  changes, and the status is read from the frontmatter only (`motion-promotion.test.mjs:45`,
  `:76-79`), so body text cannot fake a status. It did fail before this update, here and in all
  three clones, with the message naming the hash.
- How it can be satisfied trivially: the hash is searched for anywhere in the file (`:80`). A
  sentence such as "I did not review f768..." beside an older `status: pass` would pass. A record
  with several rounds also has one status line for all of them. And nothing binds the record's
  own content: anyone who can commit can add the string.
- What ties the status to these bytes beyond the string, in this record: the frontmatter line
  `reviewed_corrected_sha256` carries the hash, `status_applies_to` says the status is for those
  bytes only, `reviewed_head` names a commit whose `src/main.js` blob has that hash, and the
  verdict section above states it in words. The control should compare that frontmatter field
  for equality with the registry value instead of searching the text (D-02).
- The cost is intended and acceptable: `test:art` is red between a registration and its review.

### 7. Does `PAUSE_SPEC_GUARD_SELECTOR` carry risk for normal runs or CI?

For normal runs and CI as configured, no. As a property of the test file, yes (D-01).

- Unset, the hook returns at once (`spec:49`) and no route is installed. The variable is named
  nowhere else in tracked files, and `.github/workflows/test.yml` sets no such variable.
- Set, the page is served a copy of `src/main.js` with the guard selector replaced (`spec:51-61`);
  the file on disk is not written. A wrong match count aborts and fails every later case
  (`spec:55-58`, `:63`), which is the right direction.
- The gap: a variant run keeps the same case titles and can exit 0, for example with a selector
  that is a superset of the shipped one. The only mark is a per-case annotation (`spec:50`) that
  the line reporter does not print. So a green run can be a run against substituted source, and
  the only way to tell is to read the JSON report. The cached GREEN report for these bytes
  carries no such annotation on any of its 11 cases; the two variant reports carry it on all four.

### 8. Do the five new cases fail for the stated reason on the old bytes and pass for the right one?

Yes, from the cached reports (all nine cached hashes recomputed and equal to the record). I ran
no browser.

| Case | Failing run | Reason recorded in the report | Why it passes now |
|---|---|---|---|
| Empty part of the box (`spec:240`) | served a guard matching nothing | `#pause-menu` expected visible, received hidden | the `#pause-menu` selector; it also passed on the superseded bytes, so it is a pin, not a RED case |
| Banner, Return to menu (`:250`) | superseded bytes | pointer captured before the click | `#mp-error-banner` in the selector |
| Banner, Retry (`:261`) | superseded bytes | pointer captured before the click | same |
| Skip after a wave death (`:277`) | served `#pause-menu` only | pointer captured before the click, and `pointerLocked: true` at the end | `#kc-skip` in the selector; passed on the superseded bytes too |
| Skip while paused at a lost TDM end (`:303`) | superseded bytes | `#pause-menu` expected hidden, received visible | `src/main.js:279`; with no capture and a silent release nothing else can hide it |

- Presses are real: each goes through `locator.click()` (`spec:127`), and the press log is read
  only (`:102-110`). No `dispatchEvent` and no `element.click()` is used for a press.
- Shortened setups are disclosed in the spec (`:282-283`, `:308-310`) and in the evidence
  (`method.setupShortenedFromPageScript`). `triggerDeath()` is the routine a fatal hit calls
  (`enemies.js:245`); `getMode().tick(601)` runs the mode's own time-up path
  (`tdm.js:101-142`, `:47-76`). They shorten how the state is reached, not the press or what
  follows it. They do leave two claims unmeasured, which the author lists: a played-out match,
  and the S&D form.
- The silent-release adapter (`spec:78-84`) is what makes the paused Skip case able to fail; the
  collector's adapter would have hidden it, as the first review said.
- Both killcam cases must press within the killcam's 2.8 s of simulated time. If that is ever
  missed the case fails on a hidden button; it cannot pass falsely (D-07).

### 9. Frozen files, line-ending forms, `.gitattributes`, the 25 frozen store entries

Unchanged.

- `git diff 14ff711..HEAD --name-status`: this record (added), the two 07-21 evidence files,
  `src/main.js`, the spec, `motion-acceptance.mjs`, `motion-promotion.test.mjs`. Nothing else.
- Blob ids equal at `e0663dc`, `14ff711` and `HEAD` for `animation-budget-v2.mjs`, its test,
  `runtime-dependencies.mjs`, `animation-capture.mjs`, `review.mjs`, `promote-motion.mjs`,
  `motion-acceptance.json`, `07-budget-view-v2.json`, `07-budget.json`, `07-baseline.json`,
  `07-09-cost-report.json`, `07-09-view-reference-v2.json`, `index.html`, `style.css`,
  `src/input.js`, `src/replay/killcam.js`, `src/network/onlineSession.js`, `src/network/onlineUi.js`,
  `src/modes/tdm.js`, `src/modes/snd.js`, `src/entities/enemies.js`. The three `.gitattributes`
  files and `frozen-bytes.mjs` with its test are unchanged since `14ff711`.
- `git ls-files --eol`: the same summary as in the first review with one more `i/lf w/lf` file
  (this record), and the same four paths carrying `text eol=lf`.
- Store: the `frozen` section is identical, as parsed JSON, to the one committed in `8d71473`
  and in `14ff711`; 25 entries, each decoding to its frozen hash, and the 24 other than
  `src/main.js` byte-equal to their working files. `corrected` has the single key `src/main.js`.
- 119 of 127 file identities equal their frozen hash; the 8 that differ are the same as before.

### 10. Any remaining surface with the same defect?

None found. I went through everything that can take a pointer press while the game runs
unlocked offline.

- Guarded now: `#pause-menu`, `#mp-error-banner`, `#kc-skip`.
- Stop the press themselves: the graphics-quality controls (`src/main.js:78-87`), the buy panel
  (`src/modes/buyMenu.js:39`), the range preset panel (`src/modes/trainingRange.js:413`), the
  developer review opener and panel (`src/dev/animationReview.js:294-303`).
- Not reachable in that state: `#snd-result` and the wave death screen (shown only after
  `gameRunning` is false), the main menu and the editor overlays, and `#mp-match-controls`, which
  is hidden again by `leaveOnline` on every route out of a session (`onlineSession.js:379`).
- Take no pointer events: everything in `#hud` except the developer host (`style.css:26`, `:369`),
  `#range-hud` (`:240`), `#ed-preview-hint` (`:333`), `#killcam-wrap` itself (`:263`).
- Not controls: `#buy-banner`, `#kc-label`, the canvas.
- Buttons created from script: only the review panel, the wave death screen and Skip.
- Still open and not a menu-press defect: a canvas press while dead, or during a wave killcam,
  still captures (F-14); the stale pause menu after `[K]` or expiry while paused (D-03).

## New findings

| id | severity | file:line | finding | required change |
|---|---|---|---|---|
| D-01 | warning | `tests/pause-menu-pointer-lock.spec.js:18-63` | With `PAUSE_SPEC_GUARD_SELECTOR` set, the cases run against substituted source under unchanged titles and can exit 0; only a report annotation marks the run. | Make a variant run impossible to mistake for a result: fail the file unconditionally at the end when the variable is set, or put the variant in the case titles. In the final rerun record, state that the variable was unset. No protected file is involved. |
| D-02 | note | `tools/art/motion-promotion.test.mjs:71-83` | The review control accepts the hash anywhere in the record and reads one status for a record with several rounds. | Compare the frontmatter field `reviewed_corrected_sha256` (present in this record) with `entry.corrected` for equality. |
| D-03 | note | `src/main.js:276-279`; `src/modes/snd.js:361-365`; `src/modes/tdm.js:52-69` | The hide happens on `mousedown`, so an abandoned press hides the pause menu for the rest of the killcam; and the comment's "so that none stays over the round result" holds for a Skip press only: `[K]` or expiry while paused still leaves it. Both are disclosed in the evidence. | None in this plan. The lasting fix is in the result callbacks, which are protected files. |
| D-04 | note | `src/main.js:278`; `src/network/onlineUi.js:116-128` | The banner entry rests on a measured capture; a lost click was not shown and the disconnect route was not pressed. The banner still stays up over an offline match because no offline start clears it. | None required. Keep the limit in the summary as the evidence states it. |
| D-05 | note | `tools/art/motion-promotion.test.mjs:210-241` | The original-tuple gate control is skipped on a shallow history, which is the default on CI. | None required; the rule-level control at `:96-97` always runs. Do not count the skipped case as CI coverage. |
| D-06 | note | `tools/art/motion-promotion.test.mjs:166-205`; `tools/art/animation-budget-v2.mjs:261-262` | The gate control exercises `verifyCandidate`, not the command's disk-identity check; `:204` records that the function also accepts the frozen hash. | None. For plans 07-13 and 07-18, check the candidate's `src/main.js` identity against the registered hash, as the limitation text says. |
| D-07 | note | `tests/pause-menu-pointer-lock.spec.js:293-295`, `:321-326`; `evidence/07-21-source-change.json:933`, `:564`, `:1785` | One GREEN run on these bytes; both killcam cases have a 2.8 s simulated-time window before the press; `reruns` is still `null`; the top-level `green` block still describes the superseded bytes with no historical marker, unlike `registration`. | Complete and record the final-step reruns on this identity before the plan is marked done; mark the top-level `green` block historical. |

## What I ran and what I saw

From `C:\Programowanie\VibeOnDuty` at `a9f3d01`, Node v24.19.0, git 2.39.1.windows.1.

- `git log`, `git status --short`, `git diff 14ff711..HEAD --stat`, `--name-status`, and the full
  diff of `src/main.js`, `motion-acceptance.mjs` and `motion-promotion.test.mjs`.
- `indep2.mjs` (my own decode and byte comparison): figures in question 1 and question 9.
- `probe2.mjs` (rule at three revisions): figures in question 5.
- `gate3.mjs` (real `verifyCandidate`, synthetic candidates): results in question 4.
- `node --test tools/art/motion-promotion.test.mjs tools/art/frozen-bytes.test.mjs` before this
  update: 42 tests, 41 pass, 1 fail, 0 skipped. The one failure was the review-record control,
  with the message that the record does not name the registered hash.
- `node tools/art/frozen-bytes.mjs verify`: 26 verified, 0 mismatched.
- Three clones of `a9f3d01` under the scratch `review-clone` directory, deleted afterwards: full
  with `core.autocrlf=true`, full with `false`, and `--depth 1`. In all three `src/main.js` is
  `i/lf w/lf attr/text eol=lf` and hashes to the registered value, and `verify` reports 26 and 0.
  Controls: 21 tests; full clones 19 pass, 1 fail (the review-record control), 1 skipped (the
  cache-gated CR-02 block); shallow clone 18 pass, 1 fail, 2 skipped (also the original-tuple
  gate case, with its reason printed).
- Cached reports under `.planning/research/.cache/07-21/`: nine hashes recomputed and equal to
  the record; `seg3-red` 8 expected and 3 unexpected, `seg3-variant-noskip` 2 unexpected,
  `seg3-variant-noguard` 2 unexpected, `seg3-green` 11 expected, 0 unexpected, 0 flaky, 0 skipped.
- Blob-id comparison across `e0663dc`, `14ff711` and `HEAD`; `git ls-files --eol`; `git grep` for
  both hashes in tracked files at `HEAD`.
- `npx eslint src/main.js --max-warnings 0`: exit 0.
- Afterwards: `git status --short` shows the same two pre-existing modified files and one
  untracked file as before, plus this record as modified.

## What I could not verify

- Any browser behaviour at first hand. I ran no browser suite; questions 2, 3 and 8 rest on
  source reading and on the author's cached reports.
- That the cached GREEN report was produced from these bytes. The report holds no source hash;
  the link is the record's own `mainJsSha256DuringRun` and the absence of a variant annotation.
- Real-browser pointer lock: whether a click is lost once a lock is granted mid-press, on the
  banner or on Skip. Every browser result in the range uses a model adapter.
- The disconnect route to the banner, the S&D form of the paused Skip corner, and a played-out
  match end. None was pressed by anyone.
- Lint, typecheck, unit tests and the other offline specs on this identity as a whole; `reruns`
  is `null`. I linted `src/main.js` only.
- CI, and any other operating system.
- The owner's reply behind the decision record, as before.
- My own effort setting; the frontmatter records what the review was dispatched with.

# First review (2026-10-09T21:46:00Z, at `14ff711`), unchanged below

The text from here to the end of the file is the first review as committed in `f0e0b8f`,
without its frontmatter (status `pass-with-notes`, 0 blockers, 3 warnings, 12 notes, for the
superseded hash). It is kept for the record and is not the current verdict.

# Plan 07-21: independent review of the `src/main.js` exact-hash exception

Read-only review. I did not write any of the reviewed code or records. This file is the
only file I created in the project; nothing else was modified and nothing was committed.

## Verdict

`pass-with-notes`. None of the six blocker conditions holds:

| Blocker condition | Result | Basis |
|---|---|---|
| Diff not confined as claimed | not met | Own byte comparison: corrected bytes are the frozen bytes minus carriage returns plus one contiguous 142-byte insertion at line 275 |
| A legitimate capture path is broken | not met | Canvas press and Resume still capture (source trace, and the cached GREEN report) |
| Exception accepts anything but the exact pair under the corrected binding | not met | Differential run of old against new rule over 56,160 input tuples: exactly one tuple changed |
| A frozen file changed | not met | Blob ids at `e0663dc` and `HEAD` are identical for the gate, budget, reference, baseline, cost report and sampler host files; 119 of 127 file identities still equal their frozen hash and the 8 that differ are the expected ones |
| Registered hash not bound to the reviewed committed bytes | not met | `HEAD:src/main.js` blob, working file, preserved copy and registry value are all `51db511f...b51f5`; two fresh clones reproduce it |
| Another file changed line-ending form | not met | Only `src/main.js` gained an attribute from the root `.gitattributes`; every other protected file still has its frozen bytes |

Three warnings should be settled before plan 07-13 runs the frozen gate on this identity,
because closing two of them may need another change to a protected file and so another
registered hash: F-01 (a surface with the same defect that the table missed), F-02 (the
untested `#kc-skip` half of the selector) and F-03 (no gate-level control).

## The seven questions

### 1. Is the `src/main.js` change confined to the lock-request guard?

Yes.

- I decoded the two preserved copies myself (`Buffer.from(rows.join(''), 'base64')`, no import
  from `tools/art/frozen-bytes.mjs`) and compared bytes with my own code.
  - Frozen copy: 26,035 bytes, SHA-256 `c762044675702688313ce81c7812153bdb30bc95951aa1995e69337414a882d3`,
    359 CR LF and 206 bare LF line ends, 0 carriage returns outside a CR LF pair.
  - Frozen copy with carriage returns removed: 25,676 bytes, SHA-256 `cb7c2f54...7dc0`, byte-equal to
    `git cat-file blob e0663dc:src/main.js`.
  - Corrected copy: 25,818 bytes, SHA-256 `51db511fd5249fed908d07ac90929da2e0e2fca11c9014808a332392e88b51f5`,
    no carriage return, byte-equal to the working file and to `git cat-file blob HEAD:src/main.js`.
  - Longest common prefix 13,464 bytes, longest common suffix 12,212 bytes, and 13,464 + 12,212 = 25,676:
    every frozen byte (carriage returns aside) is present, in order, and the corrected file adds one
    contiguous run of 142 bytes starting at line 275 column 6:
    `// A press on a menu control must reach it, not re-capture the pointer.\n      if (e.target?.closest?.('#pause-menu, #kc-skip')) return;\n      `
- The insertion is `src/main.js:275-276`, inside `if (!locked && gameRunning && !isBuyPanelOpen()) {`
  (`src/main.js:274`) and before the lock request (`src/main.js:277`).
- Unchanged byte for byte apart from line endings, by the comparison above: the online early return and
  `requestOnlineAction('fire')` (`src/main.js:272`), `tryShoot()` (`:280`), middle-button grenade (`:282`),
  right-button ADS (`:283`), the `mouseup` handler (`:285-288`), the canvas click handler (`:312-314`),
  `returnToMainMenu` (`:319-368`), `pointerlockchange` (`:370-380`), the Resume and Main Menu listeners
  (`:382-386`), the graphics-quality capture listener (`:78-87`), and the touch branches
  (`setLocked(true)` at `:299-303`, `:412`, `:432`, `:450`, `:465`, `:501`; `initTouch()` at `:505`).
- `git diff e0663dc..HEAD --stat` lists 10 files and `src/main.js` shows `2 +`. No commit in the range
  touches any other file under `src/`, `index.html` or `style.css`.

### 2. Can a press that should capture no longer capture? Can the guard swallow a fire, aim or throw?

No to both, with one disclosed behaviour change (point b).

- Canvas press while unlocked and running: the target is `#c`; `#hud` and `#hudCanvas` take no pointer
  events (`style.css:26`, `:34`), so `closest('#pause-menu, #kc-skip')` is null and `src/main.js:277`
  still requests the lock. The canvas `click` handler (`src/main.js:312-314`) is a second, unchanged path.
- Resume: its own `click` listener requests the lock (`src/main.js:382-385`). After the fix this is the
  only path for a Resume press, and a click handler carries user activation. Other code that presses
  Resume (`tests/character-art.spec.js:285`, `:371`; `tools/art/animation-capture.mjs:674`;
  `tools/art/moving-online.mjs:20`) uses a click, so it still captures.
- Nothing else relied on the document handler for a press inside `#pause-menu`: `#mp-leave-btn` is hidden
  offline (`index.html:188`, `src/main.js:361`); the graphics-quality control never reached the handler
  (`src/main.js:78-87`); the buy panel and range panel re-capture from their own close functions
  (`src/modes/buyMenu.js:140`, `src/modes/trainingRange.js:306`).
- Swallowing: the guard sits in a branch that already ended in an unconditional `return`
  (`src/main.js:277-278` before and after). `tryShoot()` needs `locked` (`:280`), and the guard is only
  evaluated when `!locked` (`:274`). Buttons 1 and 2 never enter the `e.button === 0` block (`:273`).
  So no press that fired, aimed or threw before the change is dropped by it.
- Side effect, an improvement: a Resume press used to lock on `mousedown` while `mouseHeld` was true
  (`src/input.js:27`), and `updatePlayer` fires while `mouseHeld && locked` (`src/entities/player.js:133`).
  The lock now arrives on `click`, after `mouseup`. Source reading only.
- Cached reports on this host (hashes match the evidence record): RED `unexpected: 1` (case 1 failed),
  GREEN `expected: 6, unexpected: 0, flaky: 0, skipped: 0`, including the Resume and canvas cases.
  I did not rerun any browser suite.

### 3. Does the exception accept only the exact pair under the corrected binding?

Yes at the rule level, with a control for each rejection at the rule level only (see point e, F-03).

- `tools/art/motion-acceptance.mjs:98-107`. The binding test (`:99`) runs first and is unchanged. The new
  branch (`:100-102`) is reached only for a name that is an own key of `REVIEWED_SOURCE_EXCEPTIONS`
  (`:93-97`), a frozen object with one key, and returns a strict equality on both hashes. For every other
  name execution continues to the two older branches (`:103-106`), which are byte-identical to `e0663dc`.
- It cannot widen CR-02 or `CORRECTION_DEPENDENTS`: the three key sets are disjoint, and a name present in
  two sets would be answered by the first branch alone, which is narrower, not wider.
- Missing binding: `binding.revision` with `undefined` or `null` throws `TypeError` at `:99`, so
  `verifyCandidate` fails closed. `{}`, `{ revision: undefined }`, a string and `{ revision: [..] }`
  return false. No control exercises the two throwing cases (F-09).
- Differential check I ran: the `e0663dc` version of the module against `HEAD`, for all 128 reference
  names plus two near-miss names, 12 by 12 hashes (both `src/main.js` hashes, all CR-02 and dependent
  hashes, `undefined`, an unrelated hash) and three bindings: 56,160 tuples, exactly one difference,
  `('src/main.js', c7620446..., 51db511f..., corrected binding)` false to true.
- Controls (`tools/art/motion-promotion.test.mjs`): other current hash, one-character neighbour, unchanged
  hash, empty, `undefined`, `null` (`:63-65`); other reference (`:67-68`); original binding and two
  non-corrected bindings (`:70-71`); swapped pair (`:73`); all 127 other reference names and five near-miss
  spellings (`:75-78`); cross-feeding every registered pair to every reference name (`:81-96`).
  All pass here and in both fresh clones.

### 4. Are the gate, the frozen budget, reference, limits and sampler byte-identical to `e0663dc`?

Yes. `git rev-parse e0663dc:<path>` equals `git rev-parse HEAD:<path>` for each of:

| File | Blob id (both commits) | Working SHA-256 |
|---|---|---|
| `tools/art/animation-budget-v2.mjs` | `c23e1429` | `65ed6f12...e777` |
| `tools/art/animation-budget-v2.test.mjs` | `af8ca8f6` | `598d2a01...9768` |
| `tools/art/runtime-dependencies.mjs` | `be22703c` | `2ea86768...d6cd` |
| `tools/art/animation-capture.mjs` | `1aefb7eb` | `def53ba5...180e` |
| `tools/art/review.mjs` | `34f8ea4c` | `70cdb56c...6629` |
| `tools/art/promote-motion.mjs` | `c8ba8ca3` | `ebc9edd0...070b` |
| `tools/art/motion-acceptance.json` | `09978d47` | `8f3c519d...e155` |
| `evidence/07-budget-view-v2.json` | `e9cdb636` | `6f0bf775...ba34` |
| `evidence/07-budget.json` | `1d24e89c` | `66722a27...e1ff` (the `ORIGINAL.budgetSha256` literal) |
| `evidence/07-baseline.json` | `32d3d65c` | `177686a0...0b20` (the `ORIGINAL.baselineSha256` literal) |
| `evidence/07-09-cost-report.json` | `99dad160` | `6d5fd411...6aef` |

`git status --short` lists only `.planning/config.json`, `.planning/state.json` and the untracked
`.planning/milestone.lock`, all three present before this review started. The working files above equal
their committed blobs.

### 5. Which bytes does the registered `corrected` hash cover, and is it really bound?

- It covers the 25,818 bytes of `src/main.js` with LF line ends throughout. Those bytes are at once the
  committed blob `5036e916` (`git cat-file blob HEAD:src/main.js | sha256sum` gives `51db511f...b51f5`),
  the working file, and the decoded `corrected["src/main.js"]` entry of `evidence/07-21-frozen-bytes.json`.
- Fresh clones at `14ff711`, made by me and deleted afterwards: with `core.autocrlf=true` (`src/loop.js`
  and `index.html` check out as `w/crlf`) and with `core.autocrlf=false` (`w/lf`), `src/main.js` is
  `i/lf w/lf attr/text eol=lf` and hashes to `51db511f...b51f5` in both. In both clones the seven
  controls pass (18 tests, 17 pass, 1 skipped: the cache-gated CR-02 block), `frozen-bytes.mjs verify`
  reports 26 verified and 0 mismatched, and my independent byte comparison gives the same figures as in
  question 1.
- Binding chain: registry equals preserved copy (`motion-promotion.test.mjs:98-101`); working file equals
  registry (`:127`, the `pinned-lf` control); `original` equals the frozen reference identity (`:50`);
  preserved corrected equals working content apart from carriage returns (`:103-105`); frozen plus
  inserted lines equals corrected, with the inserted lines inside the one `mousedown` handler and equal to
  the evidence record (`:107-122`).
- Can registry, preserved copy and file drift apart silently? Not one at a time: a change to any one of
  the three fails `:99`, `:100` or `:127`. A coordinated change of all three together with
  `evidence/07-21-source-change.json` passes as long as it is insertions only inside the `mousedown`
  handler; that is a change of the registered hash in a tracked file and is caught by code review, not by
  a test. See F-05 and F-06 for the two places where the binding is thinner than it looks.

### 6. Did the `.gitattributes` line change any other file? Is `.gitattributes` in an identity set?

- No other file gained an attribute from it. `git ls-files --eol` shows `attr/text eol=lf` on four paths:
  `src/main.js` (new), `src/builders/enemyGLTF.test.js` (the older root line), and two files under
  `tests/fixtures/` that come from `tests/fixtures/.gitattributes`, which is not in the range's diff.
  The root file's diff is two added lines (one comment, one path line).
- Working form of other files: I have no pre-change listing of my own to compare with, so I checked what
  the gate depends on. All 127 file identities were hashed: 119 equal their frozen hash; the 8 that differ
  are the five mutable builders, `public/models/enemy.glb`, `src/builders/enemyGLTF.test.js` and
  `src/main.js`. All 24 other preserved entries are byte-equal to their working files. An exact-path
  attribute rewrites no working file by itself, and no rewriting git command appears in the range.
- `.gitattributes` is in no identity set: not among the 128 `referenceIdentities`, not in
  `animationIdentities` (`tools/art/review.mjs:382-396`, which collects named assets and `src/**/*.js`),
  and not named anywhere under `tools/`, `tests/`, `src/` or `server/` except the new control
  (`motion-promotion.test.mjs:129-130`).

### 7. Surfaces with the same defect that the table missed or misclassified

Checked against source. "Reachable" means visible while `gameRunning && !locked` offline.

| Surface | Reachable | Stops `mousedown` itself | Covered by the guard | Assessment |
|---|---|---|---|---|
| `#pause-menu` buttons and box | yes (`src/main.js:375-376`) | no (the quality control does, `:78-87`) | yes | correct |
| `#kc-skip` | yes: wave death (`src/entities/enemies.js:257`, `:266-268`), S&D round end (`src/modes/snd.js:367-369`), lost TDM match (`src/modes/tdm.js:71-73`) | no | yes | see point a |
| `#snd-result` / `#snd-next-btn` | no: shown only after `setGameRunning(false)` (`snd.js:361-364`, `tdm.js:52-68`) | no | not needed | table correct |
| Wave-over KILLED IN ACTION, `[ REDEPLOY ]` | no: `_showWaveOver` sets `gameRunning` false first (`enemies.js:258-264`) | no | not needed | table correct; a lock taken by a canvas press during the killcam is still not released there (pre-existing, F-14) |
| Developer review opener and panel | opener yes after F3 in a dev build; panel no (`src/main.js:114-115`) | yes (`src/dev/animationReview.js:294-303`) | not needed | table correct |
| Training Range preset panel | yes (`trainingRange.js:296-300`) | yes (`:413`) | not needed | table correct |
| Buy panel | yes (`buyMenu.js:122-131`) | yes (`:39`), and `isBuyPanelOpen()` skips the branch (`src/main.js:274`) | not needed | table correct |
| Editor overlay | no: preview and playtest hide it before `setGameRunning(true)` (`mapEditor.js:766-783`, `:882-903`); `#ed-preview-hint` takes no pointer events (`style.css:333`) | no | not needed | table correct |
| `#range-hud`, `#buy-banner` | yes | no | no | not controls; `#range-hud` takes no pointer events (`style.css:240`) |
| **`#mp-error-banner`** (`#mp-retry-btn`, `#mp-error-return-btn`) | **yes, offline** | **no** | **no** | **misclassified as "online only" (F-01)** |

F-01 in detail, from source reading only (not pressed in a browser):
`showConnectionError` un-hides the banner (`src/network/onlineUi.js:100-115`); only `reset()` hides it
(`:116-119`, `:126-128`), and `reset()` is called only from `joinOnline` and `leaveOnline`
(`src/network/onlineSession.js:273`, `:375`). The banner is shown exactly when the session is no longer
online: on a failed join (`onlineSession.js:349-353`: `room = null`, `removeHandlers()`, then
`connectionError`) and on a disconnect (`:309-316`). None of the offline start handlers calls
`leaveOnline` or clears it (`src/main.js:291-311`, `:406-474`); `returnToMainMenu` is the only offline
caller (`:322`). The join button is enabled on every build that has the pause-menu markup
(`onlineSession.js:709-712`), so a build with no game server reaches the failed-join path. After that, an
offline start leaves the banner up (`position:fixed; z-index:2000; pointer-events:auto`, `style.css:95`),
and with the game running and the pointer released a left press on Retry or Return to menu reaches
`src/main.js:271-278`, does not match `#pause-menu, #kc-skip`, and requests the lock: the same mechanism
as the Main Menu defect. The table row (`evidence/07-21-source-change.json:367-376`) rests on the `hidden`
attribute in `index.html:10`, which the code above removes.

## Six points

**a. `#kc-skip` in the selector.** Correct for wave modes, harmless when the player is dead, and it removes
an accidental clean-up in one corner. It should have a browser test before this identity is relied on (F-02).
- Wave modes: before the change a Skip press took the lock on `mousedown` and its `click` ran
  `_showWaveOver`, which never releases the pointer (`enemies.js:258-264`), leaving a captured pointer on
  the KILLED IN ACTION screen. The guard prevents that.
- Player dead in S&D or TDM: the pause menu is not shown (`src/main.js:375`), the result callback ends the
  round, and the pointer stays released. No wrong state found.
- Player alive at a lost TDM match end or an S&D round end, having pressed Esc during the 2.8 s killcam:
  the pause menu is up next to Skip. Before the change a Skip press locked (hiding the pause menu) and the
  result callback's `exitPointerLock()` fired `pointerlockchange` with `gameRunning` false, leaving a clean
  result screen. Now no lock is taken, `exitPointerLock()` is a no-op in a real browser, no
  `pointerlockchange` fires, and `#pause-menu` (z-index 400) stays displayed over `#snd-result` (z-index 22).
  The same stale menu already results from the `[K]` key or from the killcam expiring while paused, so the
  cause is older (`snd.js:361-365` and `tdm.js:52-69` never hide the pause menu), but this route is new.
  It is not a dead end: Main Menu works there. The collector's adapter dispatches `pointerlockchange` on
  every `exitPointerLock()` (`tools/art/animation-capture.mjs:772`), so a test with that adapter cannot see
  this state.
- The evidence is candid that this half is unmeasured (`evidence/07-21-source-change.json:707-719`). It
  also says the lost click on Skip itself "was not measured" (`:274`); under the synchronous adapter the
  wrap is not hidden by `pointerlockchange`, so the Main Menu failure mode was never demonstrated for
  this button. What source reading does establish is the captured pointer on the wave-over screen.

**b. Blank area of `#pause-menu`.** Acceptable, and disclosed in the evidence record
(`evidence/07-21-source-change.json:257-266`, `:703`, `:717`). It was an unlabelled side effect of a
handler with no target check, the box keeps an explicit Resume button, and presses outside the box still
capture. It is not disclosed anywhere a player or a later maintainer would look: the source comment at
`src/main.js:275` says "menu control" while the selector covers the whole box, the decision record's
consequence section does not mention it, and no test presses the blank area (F-04).

**c. `e.target?.closest?.(...)`.** Right. For a real mouse event the target is an `Element`, which always
has `closest`, so the form is equivalent to the online path's `?.closest(` (`onlineSession.js:150-153`)
and changes nothing. For the collector's `document.dispatchEvent(new MouseEvent('mousedown', ...))`
(`tools/art/animation-capture.mjs:373`) the target is `document`, which has no `closest`; the single
optional form would throw inside the listener whenever such a press arrives unlocked, and the double form
falls through to the lock request exactly as the frozen code did.

**d. `guardLines: 2`.** As a count it means little: `addedLines` returns every corrected line not matched
to a frozen line, so its length is always corrected lines minus frozen lines, and any two inserted lines
inside the handler satisfy `motion-promotion.test.mjs:108-109` and `:114`. What pins the content is the
hash pair: the registry value against the working file (`:127`) and against the preserved copy (`:99`),
plus the text of both lines through the evidence record (`:118`). The count is a redundant cross-check
between registry and evidence, nothing more (F-05).

**e. Controls build the binding as `{ revision: '...' }`.** The exception is tested in isolation only.
`verifyCandidate` passes `runtimeDependencies.motion` (`tools/art/animation-budget-v2.mjs:178-179`), and
the rule reads only `.revision`, so the synthetic binding is faithful to what the rule consumes; but no
control shows the gate accepting the corrected identity or rejecting another one for this file, whereas
CR-02 has such a control (`tools/art/animation-budget-v2.test.mjs:37-56`). I ran that probe by hand with
the real `verifyCandidate`, the frozen budget and synthetic candidates (results below): it behaves as
designed. A one-off probe is not a regression control. Acceptable for registration; it should be closed
with a cache-gated gate-level control before plans 07-13 and 07-18 rely on the exception (F-03).

**f. Decision provenance.** The record is honest about what happened. It quotes the owner's reply as
"ok, continue, do the rational thing", states that the option name was not typed by the owner, that the
orchestrator applied its own stated recommendation, and that the executor never saw the owner's message
and is relaying the orchestrator (`07-21-SOURCE-CHANGE-DECISION.md:26-56`); the frontmatter repeats it in
`selection_basis` (`:9`) and the evidence record carries the same wording
(`evidence/07-21-source-change.json:638-644`). Two things should be read with that in mind: the
frontmatter line `decided_by: owner` (`:8`) taken alone says more than the body does, and the plan's
machine check accepts on that line only (`07-21-PLAN.md:245`); and the plan's must-have "no agent made
that choice" (`07-21-PLAN.md:26`) is, by the record's own account, not literally what happened. The
record says so itself and tells the reader to ask the owner. I could not verify the owner's reply; no
transcript is in the repository. Whether the delegation is sufficient is the owner's call.

## Findings

| id | severity | file:line | finding | required change |
|---|---|---|---|---|
| F-01 | warning | `evidence/07-21-source-change.json:367-376`; `src/network/onlineUi.js:100-119`; `src/network/onlineSession.js:309-316`, `:349-353`; `src/main.js:276`; `style.css:95` | `#mp-error-banner` is classified "online only", but it is shown precisely when the session is offline and no offline start clears it. Its Retry and Return to menu buttons then have the same lock-on-press defect and are outside the selector. Source reading only. | Before plan 07-13: confirm in a browser, correct the table row, and have the owner choose between covering it now (any fix touches a protected file, so a new corrected hash, registry entry and review) and recording it as a known open defect with an expected-failing test. |
| F-02 | warning | `src/main.js:276`; `src/modes/snd.js:361-365`; `src/modes/tdm.js:52-69`; `tests/pause-menu-pointer-lock.spec.js` (no case) | `#kc-skip` is in the registered selector with no browser evidence. One corner (alive, paused during an end-of-round killcam, then Skip) now ends with a stale pause menu over the result screen where the old code cleared it. | Add real-press cases before plan 07-13: wave death then Skip (wave-over screen visible, pointer released); S&D or TDM round end alive, paused, then Skip, under an adapter whose `exitPointerLock` fires no event when nothing is locked. Record the results; if the selector must change, re-register and re-review. |
| F-03 | warning | `tools/art/motion-promotion.test.mjs:37`, `:59-79`; `tools/art/animation-budget-v2.test.mjs:37-56` | No control exercises the exception through `verifyCandidate`; the binding is hand-built. | Add a cache-gated control beside the CR-02 one: corrected identity accepted under the real corrected tuple; another hash and a missing identity rejected with `Protected source changed: src/main.js`; corrected identity rejected under the original tuple. |
| F-04 | note | `src/main.js:275-276`; `07-21-SOURCE-CHANGE-DECISION.md:78-98` | The blank-area behaviour change is recorded only in the evidence JSON; the comment says "menu control"; no test covers it. | State it in the plan summary's post-execution section; optionally add a case that pins it. |
| F-05 | note | `tools/art/motion-acceptance.mjs:96`; `tools/art/motion-promotion.test.mjs:108-109`, `:114` | `guardLines` is a line-count difference and does not constrain content. | None required. Do not cite it as a content control; cite the hash pair. |
| F-06 | note | `tools/art/motion-promotion.test.mjs:53`, `:124-125`, `:120` | Changing `hashBasis` to `working-bytes` in the registry and the evidence record skips the only control that compares the registry with the working file's exact bytes. | Assert `entry.hashBasis === 'pinned-lf'` literally, or make the skipped case fail. |
| F-07 | note | `tools/art/motion-acceptance.mjs:97`; `tools/art/motion-promotion.test.mjs:55-56` | The exception has been live since `f7bc7c4`, before this review existed; `review` is a path string and no control reads the record's status. | None required now. The plan's one-off verify command is the only check that the record is non-blocking. |
| F-08 | note | `tools/art/motion-acceptance.mjs:99-102`; `tools/art/animation-budget-v2.mjs:177-180` | The exception is additive and tied to the CR-02 revision: the gate accepts the frozen hash or the corrected hash for `src/main.js`, and refuses the corrected hash under the original tuple. The gate does not require the fix to be present. | None. Record it so a later reader does not take a gate pass as proof that the fix is in the measured build. |
| F-09 | note | `tools/art/motion-acceptance.mjs:99` | An `undefined` or `null` binding throws `TypeError` (fails closed); unchanged from `e0663dc`, no control. | Optional: one `assert.throws` case. |
| F-10 | note | `07-21-SOURCE-CHANGE-DECISION.md:8-9`; `07-21-PLAN.md:26`, `:245` | See point f. | Owner to confirm the option by name if the must-have is to be read literally. |
| F-11 | note | `evidence/07-21-source-change.json:875`, `:4`, `:226-228`, `:325` | `reruns` is `null`: no lint, typecheck, unit or offline-suite rerun is recorded on the corrected identity. The `surfaces` rows cite pre-change line numbers of `src/main.js` (two lower after line 274), and the top-level `task` still reads `07-21-01`. | Complete the task 3 reruns before the plan is marked done; no change to past rows needed. |
| F-12 | note | `tests/pause-menu-pointer-lock.spec.js:104-116`; `evidence/07-21-source-change.json:427-450`, `:501-507` | Cases 2 and 3 passed on unfixed source, so only case 1 detects the defect; the deferred adapter is a model with a 50 ms timer. The record says so. | None. Do not count cases 2 and 3 as regression coverage of the defect. |
| F-13 | note | `tools/art/animation-budget-v2.test.mjs:37-41` (outside the five commits); `.github/workflows/test.yml:26` | On a fresh clone that file fails 3 of 47 tests with `ENOENT` on the gitignored candidate cache, so `npm run test:art` as a whole does not pass there, although the seven new controls do. Seen in my `core.autocrlf=false` clone only; CI itself was not observed. | Out of scope here. Worth knowing before treating a CI `test:art` result as the guard for this registry. |
| F-14 | note | `src/main.js:274`; `src/entities/enemies.js:257-268`; `src/modes/snd.js:361-365` (pre-existing) | Still open and unchanged: the `mousedown` branch has no `player.dead` check, so a canvas press during a wave killcam leaves the pointer captured on the wave-over screen; result callbacks do not hide a displayed pause menu. | None in this plan; the first half is already in `surfaceNotes`. |
| F-15 | note | `tools/art/motion-promotion.test.mjs:40-43`, `:116-117`, `:129-130` | The new block reads `.planning/` evidence files by cwd-relative path at module top level, so a moved or archived phase directory stops the whole file loading (CR-02 controls included); the `.gitattributes` check counts one exact line and would not notice a later overriding rule until a re-checkout. | Optional hardening; fails closed as written. |

## What I ran and what I saw

All from `C:\Programowanie\VibeOnDuty` at `14ff711`, Node v24.19.0, git 2.39.1.windows.1, `core.autocrlf=true`.

- The suggested one-liner: frozen `c7620446...882d3`, corrected `51db511f...b51f5`, disk `51db511f...b51f5`,
  no carriage return in corrected, two added lines at 275 and 276, stripped-equal `true`.
- `git cat-file blob HEAD:src/main.js | sha256sum`: `51db511f...b51f5`.
- `git check-attr text eol -- src/main.js`: `text: set`, `eol: lf`.
- `git ls-files --eol`: summary and the four attribute-carrying paths as in question 6.
- `git diff e0663dc..HEAD --stat` and `--name-status`: 10 files; per-commit stats for the five commits.
- `node tools/art/frozen-bytes.mjs verify`: 26 verified, 0 mismatched, exit 0.
- `node --test tools/art/motion-promotion.test.mjs tools/art/frozen-bytes.test.mjs`: 39 tests, 39 pass,
  0 fail, 0 skipped (the candidate cache is present on this host).
- Own scripts in the session scratch directory, importing nothing from `frozen-bytes.mjs` for the
  comparison: `indep.mjs` (decode and byte diff), `ids.mjs` (all 127 identities, all 25 preserved entries,
  store unchanged between `8d71473` and `HEAD`), `probe.mjs` (hostile inputs and the 56,160-tuple
  differential), `gate.mjs` and `gate2.mjs` (real `verifyCandidate`).
- Gate probe results: corrected hash accepted (`revision=07-CR02-directional-crouch`,
  `applicableBudgetPass=true`); frozen hash accepted; another hash, a one-character neighbour and a missing
  identity rejected with `Protected source changed: src/main.js`; corrected `src/main.js` together with a
  changed `src/loop.js` rejected on `src/loop.js`; the corrected hash placed on `src/input.js` or
  `index.html` rejected on that file; corrected hash under the retained original tuple rejected on
  `src/main.js`.
- Two fresh clones under the scratch `review-clone` directory (`core.autocrlf` true and false,
  `core.longpaths=true`), results in question 5; `node --test tools/art/animation-budget-v2.test.mjs` in the
  LF clone for F-13. Both clones deleted afterwards.
- Recorded hashes recomputed and equal: the evidence file at `68bf214` (`a9d82f3b...`), the decision
  record (`3d69c3f5...`), the spec (`bdbec9b5...`), and the six cached files under
  `.planning/research/.cache/07-21/`. The cached RED and GREEN reports read as recorded.
- `npx eslint src/main.js --max-warnings 0`: exit 0.
- After all of the above: `git status --short` unchanged from the start, `src/main.js` still
  `51db511f...b51f5`, the same 8 identities differing.

## What I could not verify

- Any browser behaviour. I ran no browser suite and no capture, as instructed. F-01, the `#kc-skip`
  analysis in point a and the Resume side effect in question 2 are source reading only.
- Real-browser pointer-lock timing. All browser evidence in the range uses adapters; the deferred one is a
  model, and the record says so.
- The owner's reply and what the owner was shown before it. Only the executor's relay of the
  orchestrator's account exists in the repository.
- A before-and-after `git ls-files --eol` listing of my own for files outside the identity set; I checked
  the protected identities, the preserved entries and the attribute column instead.
- Lint, typecheck, unit and offline Playwright results on the corrected identity as a whole
  (`reruns` is `null`); I linted `src/main.js` only.
- Behaviour on another operating system; both clones were made on this Windows host.
- My own effort setting. The frontmatter records the model and effort this review was dispatched with; the
  effort level is not something I can observe from inside the run.
