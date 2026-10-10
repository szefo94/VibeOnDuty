---
phase: 07-movement-matched-and-action-safe-animation
plan: "25"
status: pass-with-notes
reviewer_model: opus
reviewer_effort: high
v2_sha256: 8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3
reviewed: 2026-10-10T12:55:00Z
reviewed_head: 8eba2e1fc1ffcbebe6684d8bac737103c03e50c8
owner_decision_needed: no
approved_numbers_touched: no
document_edits_required: 0
plan_edits_required_before_07_16: 5
first_pass_verdict: changes-required
first_pass_v2_sha256_reviewed: 1ae66f8b16f3c4c3d8501b6fd86a5e54b92a6fef9898cab184d4811f793bb47d
first_pass_reviewed: 2026-10-10T12:35:00Z
---

# Plan 07-25 task 2: independent review of the paired timing contract, version 2

This record has two parts. The second pass, directly below, is the current verdict and covers
the document bytes named in `v2_sha256`. The first pass follows it unchanged; it covered the
earlier bytes (`1ae66f8b...`) and returned `changes-required`.

# Second pass, 2026-10-10T12:55:00Z, at `8eba2e1`

Same reviewer (model `opus`, dispatched at effort `high`), read-only except for this record.
The V2 document on disk and its `HEAD` blob both hash to
`8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3`. The proposal, my proposal
review and the decision record are unchanged (`4ecad5a1...`, `7fe81473...`, `c1af5d9b...`). I
edited no document and no plan, ran no browser or capture, and committed nothing.

## Verdict for the current bytes

`pass-with-notes`, for the V2 document.

- All nine required edits are in the document, in my wording or stricter, and the sentences the
  executor wrote itself are accurate.
- Nothing goes beyond the owner's approval, and `t_single` 0.25, `t_aggregate` 0.05,
  `timer_quantum_ms` 0.1, `session_cap` 3 and `reference_commit` `c973458` are unchanged.
- Every sentence about what a pass means is inside R1.
- The document needs no further edit.

The status is about the document. Plans 07-16 and 07-18 follow it closely, but plan 07-16
still lacks five things the contract states. They are listed under "Plan edits required before
plan 07-16 starts" and must be applied and checked before that plan is dispatched. Plan 07-18
needs none.

## Disposition of E1 to E9

| | In the document | Where | Check |
|---|---|---|---|
| E1 | yes, my text | section 4 rule 2 and "Arithmetic"; section 11 items 1 and 3 | re-run below |
| E2 | yes, my text | section 5 criterion 3 | read |
| E3 | yes, my text | section 8, two bullets; section 11 item 9 | read |
| E4 | yes, my text, and stricter | section 8 event types and fixed order; section 7; the session report also carries the hash of its `started` event | read |
| E5 | yes, my text | section 8; section 11 item 18 | read |
| E6 | yes, my text | section 8 "Registry"; section 6; section 11 items 6 and 16 | read |
| E7 | yes, my text | section 9; section 11 items 13 and 17 | read |
| E8 | yes, my text | status section; section 11 item 20; `.gitattributes` at `8eba2e1` | attributes checked |
| E9 | yes, my text | section 2 item 5; section 11 item 19 | read |

**E1 re-run against the rule as it now reads** (section 4, steps 1 to 4 and the three bullets,
coded from the document, not from my first script).

Existing same-source data as a stand-in session:

| Stand-in | Rule 1 | Rule 2 | `rule-1-only` |
|---|---|---|---|
| frozen reference | 0 of 192 | no group fails | mixer median in 4 groups, inertia median in all 6 |
| plan 07-13 candidate | 1 of 192 | no group fails | the same |

Simulation, one frame-interval statistic, no code difference, share of sessions failing rule 2:

| Ratio noise per capture | Order effect 0% | 5% | 8% | 10% |
|---|---|---|---|---|
| 1% | 0.0% | 0.0% | 0.0% | 0.0% |
| 2% | 0.2% | 0.2% | 0.3% | 0.5% |
| 4% | 22.7% | 24.9% | 28.2% | 30.8% |

Under the first form the 5% column was about 60% and the 8% column 93% to 100%. So an order
effect no longer decides the outcome; what remains is the noise sensitivity of the two-cell
tier groups, which the document states (section 11 item 1; section 6).

Detection is intact (noise 2%, with no order effect and with 8%): 20% in the six one-actor
profiles, in the six eight-actor profiles, in the four profiles of each tier in turn, and in a
single cell each fail in 100.0% of sessions; an 8% eight-actor improvement beside an 8%
one-actor regression fails in 100.0%; a uniform 8% fails in 100.0%. When both runs of every
cell share a ratio, the rule gives exactly the aggregate of the same median over the 12 profile
ratios: 30,000 of 30,000 group aggregates equal. With `r` 0, a one-step `c` passes whether it
is stored just above or just below 0.1, and two steps fail.

## The executor's own sentences

| Sentence | Ruling |
|---|---|
| "Revision" paragraph in the status section | Accurate. It says the first verdict does not cover these bytes and keeps the rule that nothing may rely on the text until this record's hash matches. |
| Section 5 criterion 1: a session registered and never closed has no validity block and is counted as invalid at the registry level | Correct; this is N-6. |
| Section 5 check 6: "`d` above about 11.8%" | Correct, and more exact than my "about 11%": the square root of 1.25 is 1.118. |
| Section 6: rule 2 adds its own no-change failures from noise, which the cell ratio does not remove; the calibration is the test of that | Accurate and not looser. |
| Section 7 fourth bullet and section 8: "`started` event"; the session report carries the hash of its registration event and of its `started` event | Stricter than I asked. Accepted. |
| Section 11 introduction | Accurate: it says the forms the edits ask for are the reviewer's, not the owner's. |
| Item 1 | Accurate. The figures quoted (0.2%, 23.1%, 18.4%) are from my first simulation; the re-run gives 0.2% and 22.7%. It states the limit and that no number changes. |
| Items 2, 3, 5, 6, 9, 13, 17 | Each restates the edit it carries, with the alternative it rejects. Nothing looser. |
| Item 16: a tool change does not start a new count but ends the use of the calibration and with it the paired route for that identity | Correct reading of E6. |
| Item 18 | Correct. |
| Item 19: "This contract does not say which lifetime that is; the implementation fixes one for all kinds." | Acceptable. The contract requires sameness and a record; the choice belongs to the implementation. |
| Item 20: "pinned to LF by exact path"; "not the outcome of a session that runs" | Correct. |
| Item 14, last sentence (a literal-comparison fallback if the reviewer objects) | Moot: I ruled the allowance inside the approval in the first pass. It can stay. |

## The four open points

**(1) Session evidence files are not pinned yet; plan 07-16 adds their lines before the first
registration and enforces the order by precondition. Is that enough for "a registration made
before those lines are committed is refused"?** The order is right. The enforcement is not: the
contract says "is refused", and a precondition written in a plan is not a refusal. The tool
must refuse at `--register`. This is a plan edit (P-1), not a document edit.

**(2) Should the proposal and my proposal review be pinned?** Not required. Their hashes are
cited by the V2 frontmatter and by plan 07-25's one-time verify command; no tool compares them
at run time, so a changed line ending there cannot cost a session. Pinning them is harmless and
keeps the cited hashes true after any checkout; I recommend two more exact-path lines whenever
`.gitattributes` is next committed (O-1).

**(3) `.gitattributes` has no attribute of its own.** Fine. It is not hash-bound and is in no
identity set, and git reads it with either line ending. The one consequence is for controls
that read it: they must split lines on `\r?\n`, as the plan 07-21 control does.

**(4) Plan 07-25's acceptance criterion asks that section 4 name "the upper-middle median".**
Acceptable. Section 4 now states `sorted[floor(n/2)]` with the position in every group size,
which is more exact than the phrase, and section 11 item 1 says in words that for an even count
it is the upper middle value. The criterion was written before E1; record the difference in the
plan 07-25 summary.

## The planner's two stricter readings

**E9 enforced as invalid** (plan 07-16: a qualifying session whose context and page lifetime,
launch flags or sampler arguments differ from its calibration's is invalid). Accepted, and
binding on the implementation through this record. Section 5 of the contract does not list it;
section 2 item 5 states the requirement without a consequence. Invalid is the right
consequence: such a session is not covered by its calibration, so it must not be judged, and
it still counts. It is unreachable by choice after the fact: the settings come from the build,
a changed tool is already refused at registration (E6), and nothing is visible before close
(E5). If the document is ever revised for another reason, add it to section 5 as a seventh
criterion; that alone does not justify another revision.

**E8 by precondition and order.** Not sufficient by itself; see open point (1) and P-1.

## Contract against plans

Plan 07-16 (working tree, four tasks) and plan 07-18 (working tree) read against the document.

| Contract | Plan passage | Match |
|---|---|---|
| Section 2: arms, five pinned files, count of five, same listener configuration | 07-16 task 1 `materializeArms`, acceptance | yes |
| Section 2 item 5: same settings across kinds, recorded | 07-16 task 1 smoke report fields; task 2 validity; task 3 "Session settings" | yes, stricter (above) |
| Section 3: order, warm-up, no overlap | 07-16 task 1 `orderFor`; task 3 runner | order and warm-up yes; "no overlap" has no behaviour or control (P-2) |
| Section 4 rule 1 and allowance | 07-16 task 1 and task 2 "Small components and zeros" | yes |
| Section 4 rule 2: usable profile, `(c - q - eps) / r`, cell mean, `sorted[floor(n/2)]` over cells, six groups, fewer than 3 usable profiles | 07-16 task 2 "Rule 2, cell form", "Rule 2 outcomes"; must-have 2 | yes, with the nine outcome controls |
| Section 5 criterion 1: exactly the warm-up pair and the 12 pairs, each profile once per arm | 07-16 task 2 validity: "incomplete arm" | too loose in wording, no control for the warm-up or a duplicate (P-4) |
| Section 5 criteria 2, 5, 6 | 07-16 task 2 "Order", "Validity checks" | yes |
| Section 5 criterion 3, candidate arm | 07-16 task 2 `verify`, `qualifying` | yes |
| Section 5 criterion 3, reference arm and calibration; `structuralV2Pass` absent | 07-16 task 2 `verify`, `calibration`, prints `structuralV2Pass: null`; 07-18 task 1 | yes |
| Section 6: one calibration, gating, tool hashes, sampler, browser | 07-16 task 3 "Registry rules", "Calibration scope"; 07-18 task 2 precondition | yes |
| Section 7: nonce, one capture per registration, `started` in the tracked registry, refusal | 07-16 task 1 `--run`, messages `Registration is not committed` and `Session already started` | yes |
| Section 7: a capture time before the `started` event or after the close rejects the arm | none | missing (P-2) |
| Section 7: hash equal to the frozen reference, an existing candidate, an earlier arm, the other arm | 07-16 task 2 "Binding" | yes |
| Section 8: event types, fixed order, commit whether or not the capture completed | 07-16 task 1; 07-18 tasks 1 and 2 | yes |
| Section 8: `closed` records outcome, report hashes, browser version and, for a qualifying session, the frozen exit code and overrun count | 07-16 task 1 and task 3 runner: outcome, hashes, browser version | the frozen fields are in the `verify` output only, not stated for the `closed` event (P-5) |
| Section 8: session report carries the hash of its registration event and of its `started` event | 07-16 task 1 smoke fields and task 3: registration hash only | `started` hash missing (P-3) |
| Section 8: prefix check over history, shallow refused, registration commits never amended and named | 07-16 task 3 `historyPrefixCheck`, `chain`, `verdict`; 07-18 `registrationCommits` | yes |
| Section 8: no timing before close | 07-16 task 3 `runSession` with injected write and log | yes |
| Section 8: kinds, cap, verdict table, denominator, earlier identities | 07-16 task 1 (smoke) and task 3 `registryVerdict`; 07-18 task 2 | yes |
| Section 9: structural predicates by the unchanged frozen tool, again where the result is relied on | 07-16 task 2 `verify`; task 4 `executeV2` | yes |
| Section 9: frozen evaluation list by scan; plan 07-13 evaluation; exit 0 never a pass | 07-16 task 3 `frozenEvaluationList`, `frozen-evaluations`; task 4 frozen route; 07-18 task 2 | yes |
| Section 10: wording | 07-18 `meaning` copied from section 10; 07-16 implementation review scope | yes |
| Status section: pins committed before the first registration, else refused | 07-16 task 1 precondition, action and control; 07-18 precondition | order yes; refusal by the tool missing (P-1) |

No plan passage contradicts the document. The gaps are omissions.

## Controls that cannot fail

I found none. Three are weak and worth knowing:

- "a calibration and a qualifying session produced by the same build record equal values" passes
  whenever both kinds use one recorder; it fails only if the code branches by kind. The control
  with teeth is the mismatch-is-invalid one beside it.
- The control that reads the source of `tools/art/animation-capture.mjs` for the arity of one
  call can fail, but on formatting as easily as on substance.
- The thresholds "fewer than 34 tests" and "fewer than 52 tests" count tests; they cannot tell
  a control that asserts nothing. The plan's rule that each control is written first and seen
  to fail is what covers that, and the implementation review should confirm it for the new ones.

## Findings of this pass

Document: no required edit.

| id | severity | evidence | note |
|---|---|---|---|
| N2-1 | note | section 5 list; section 2 item 5; 07-16 task 2 validity | The settings-mismatch invalidity is the plan's reading, accepted here. Add it to section 5 if the document is revised for another reason. |
| N2-2 | note | section 11 item 14, last sentence | Moot fallback wording. |
| N2-3 | note | plan 07-25 acceptance criterion on "the upper-middle median" | Met in substance; say so in the plan 07-25 summary. |
| O-1 | optional | V2 frontmatter `proposal_sha256`, `review_sha256` | Pin `07-09-PAIRED-AMENDMENT.md` and `07-09-PAIRED-AMENDMENT-REVIEW.md` to LF as well. |

## Plan edits required before plan 07-16 starts

All in `07-16-PLAN.md`. None changes the contract or a number.

**P-1 (status section, E8).** Task 1 action, `--register`: after `assertContract`, refuse with
the message `Line-ending pin is not committed`, naming the path, unless `.gitattributes` as
committed at `HEAD` (read with `git show HEAD:.gitattributes`, read only, lines split on
`\r?\n`) holds exactly one exact-path `text eol=lf` line for every path in a frozen list in the
module: the V2 document, the decision record, the V2 review record, the registry, and each
session evidence path this plan and plan 07-18 name. Add the control "a registration is refused
when a pin line is missing from the committed `.gitattributes`", with an injected reader, to
task 1's controls and acceptance criteria.

**P-2 (sections 3 and 7).** Task 2, "Binding" bullet: add "with captures that overlap in time,
or with any capture time before the session's `started` event or after its `closed` event".
Add controls named for overlapping captures and for a capture time outside `started` and
`closed`.

**P-3 (section 8).** The session report of every kind carries the hash of its `started` event
beside the hash of its registration event. Task 1: add it to the smoke report's fields. Task 3,
"Started events" bullet: add "a session report whose `started` event hash does not match its
registry event is rejected", with a control.

**P-4 (section 5 criterion 1).** Task 2, "Validity checks" bullet: replace "incomplete arm" with
"not exactly the warm-up pair and the 12 pairs, each profile once per arm, or an arm report
that is not complete". Add controls for a missing warm-up pair, a missing profile and a
duplicated profile.

**P-5 (section 8, `closed` event).** Task 3: the `closed` event of a qualifying session records
`frozenExitCode` and `frozenOverrunCount`; a calibration's and a smoke's record neither. The
outcome written to `closed` is computed by the same `sessionValidity` and `evaluatePaired` that
`verify` uses, and `verify` exits non-zero when its outcome differs from the one in the
session's `closed` event. Add controls: a qualifying `closed` event carries both frozen fields
and a calibration's carries none; `verify` refuses a session whose recomputed outcome differs
from its `closed` event.

Wording, not conditions: in the threat register row T-07-16-03 replace "started marker and
registration hash in each report" with "registration and `started` event hashes in each
report"; in the assumptions replace "above about 11%" with "above about 11.8%", the contract's
figure.

Plan 07-18: no edit required. Its preconditions, the two session sequences, the calibration
figures, the scan-built evaluation list and `registrationCommits` match the document.

## What I ran

At `8eba2e1`, Node v24.19.0; one script in the session scratch directory, deleted afterwards.

- Hashes of the five documents against their `HEAD` blobs; `git status --short`;
  `git diff 2ea292e HEAD` for the V2 document, read in full together with the document itself;
  the root `.gitattributes`; `git check-attr` and `git ls-files --eol` for the pinned paths (six
  tracked files now carry `text eol=lf`: the four from before and the V2 document and decision
  record); `node tools/art/frozen-bytes.mjs verify` (26 verified, 0 mismatched); `src/main.js`
  still `f768954f...`.
- A fresh implementation of section 4 as written, applied to the two stand-in sessions and to
  20,000 simulated sessions per cell of the tables above, plus the equivalence and zero-value
  checks.
- Plans 07-16 and 07-18 as they are in the working tree, read in full where changed; searched
  for every contract term that should have a behaviour (`started`, overlap, close, warm-up,
  event hashes, pins, prepared host).

## What I could not verify

- Anything that needs a paired capture, as in the first pass: the order effect, adjacent-pair
  noise, whether the mixed tree runs.
- That the plan edits P-1 to P-5 are applied; the orchestrator checks that before dispatching
  plan 07-16.
- The implementation. Whether the code follows the contract is the plan 07-16 implementation
  review's question, not this record's.
- My own effort setting; the frontmatter records what the review was dispatched with.

# First pass, 2026-10-10T12:35:00Z, at `2ea292e`: unchanged below

The text from here to the end is the first pass as written, without its frontmatter (status
`changes-required`, `v2_sha256` `1ae66f8b16f3c4c3d8501b6fd86a5e54b92a6fef9898cab184d4811f793bb47d`,
9 required findings, 7 notes). Its edits E1 to E9 are the ones disposed of above. It is not the
current verdict.

# Plan 07-25 task 2: independent review of the paired timing contract, version 2

Reviewer: an independent reviewer agent (model `opus`, dispatched at effort `high`). I wrote the
review of the original proposal (R1 to R8) and did not write this document (`2ea292e`). The
bytes reviewed hash to the `v2_sha256` above; the working file and the `HEAD` blob agree. I
edited nothing but this record: the V2 document, the proposal, my earlier review and the
decision record hash as before (`1ae66f8b...`, `4ecad5a1...`, `7fe81473...`, `c1af5d9b...`).
No browser, capture or suite was run and nothing was committed.

## Verdict

`changes-required`. The owner does not need to be asked again, and none of the three approved
numbers is touched.

The document carries all eight required changes faithfully and is candid about its own weak
points. Two of them cannot stand, by the rule this task sets for a passing status:

- as written, rule 2 would fail sessions with no code difference whenever the second capture
  of a pair is slower by about 5% or more, the calibration included (point 1, E1);
- as plan 07-16 is written, a calibration could never pass its structural check (point 3, E2;
  the contract is right there and the plan must change).

Seven further edits close paths the review's wording did not intend to leave open. All nine are
forms inside R3 to R7 or stricter than them. After they are applied the review has to be
repeated on the new bytes; this record does not let plan 07-16 start.

## R1 to R8: carried or not

| | Carried | Where, and what is missing |
|---|---|---|
| R1 | yes | Sections 1 and 10. The withdrawn question is named; all five added "would not mean" items are present, with five more. |
| R2 | yes | Section 2: the "cannot be rebuilt" and "git-defined" wording is withdrawn, the 127-file table is restated, the arm is working-tree bytes plus five owner files, and what the owner accepted is restated. |
| R3 | yes in content, not yet in a workable form | Section 4 defines the aggregate, applies it to six groups and states the minimum. The chosen aggregate ignores the order balance R4 creates (E1). |
| R4 | yes | Section 3: every cell once in each order; two and two inside each tier; three and three inside each actor count. I checked the table against the parity rule. |
| R5 | yes | Sections 5 and 6: one calibration, same order scheme, gating; rule 3 restated as a gross-instability check; the ratio-agreement check added. One binding is missing (E6). |
| R6 | yes | Section 8: cap of 3, every started session counts, registration before the run, validity before the predicate, majority with at least one valid, denominator. Three gaps (E3, E4, E5). |
| R7 | yes | Section 7: nonce, per-capture times, interleaving, rejection of any existing single-arm candidate. Storage of the started marker is not fixed (E4). |
| R8 | yes | Section 4: the tolerance table, the effective range for small components, zero limits loosened to one step. |

## The lettered checks

**(a) A 20% regression confined to one actor count or one tier.** Fails rule 2 as written, and
fails it under the corrected form (E1). Simulated on the frame interval with a per-capture ratio
noise of 2%: 20% in the six one-actor profiles, 20% in the four High profiles and 20% in a
single cell each fail in 100.0% of sessions under both forms; an 8% eight-actor improvement
beside an 8% one-actor regression also fails in 100.0%. No group excuses another.

**(b) An order effect of 5% and 10%.** This is the defect. See point 1.

**(c) Can the validity checks turn a failing session into an invalid one more often than a
passing one?** Yes, by a modest margin, and that follows from R5 and R6 as I wrote them.
- Check 5 looks at the reference arm only, so it is blind to whether the candidate passes.
- Check 6 fires when the candidate-to-reference ratio of a cell differs between its two runs by
  more than 25%. A one-run excursion that makes the candidate look slower would have failed
  rule 1 and becomes an invalid session; an excursion the other way would have left a session
  that passes only if everything else does. So among sessions the check removes, more would
  have failed than passed.
- An invalid session costs one of the three and decides nothing, which is cheaper than a fail:
  after an invalid session one pass gives `pass`; after a fail two are needed. With per-session
  chances 0.6 pass, 0.3 fail, 0.1 invalid the verdict passes with probability 0.774; moving
  0.1 from fail to invalid makes it 0.816.
- The same arithmetic applies to a session that is stopped. The document forbids stopping a
  session after a timing value has been seen (section 8) but leaves the values visible while
  the session runs, so the prohibition rests on conduct alone. That needs closing (E5).

**(d) Do calibration and smoke, which do not count, let anyone see candidate timing without
spending a session?** Not through the paired tool: a smoke writes, prints and keeps no timing
and is refused once a calibration exists; a calibration has no candidate arm; the tool refuses
a capture whose registration is not committed. Two things remain outside it. A single-arm
candidate capture can still be made at any time, as plan 07-13 did; it shows candidate timing
and produces a frozen evaluation that section 9's list would not contain (E7). And the identity
can be changed to start a new count of three; the document discloses this through the grouped
list rather than preventing it, which is what R6 rule 5 allows (N-4).

**(e) The minimum of 3 for groups of 4.** Acceptable. A tier group needs 3 of its 4 profiles
with `r` above zero, otherwise it is `rule-1-only`. This only matters for components small
enough to report zero, and for those rule 1 is as tight as rule 2 to within one timer step
(with `r` 0.1 ms rule 1 allows 0.2 and rule 2 allows 0.2). The corrected form keeps this
minimum unchanged and judges at least every group the written form judges.

**(f) A frozen exit 0.** Free of selection by the tooling: it is never a pass, never stops or
changes a paired session, writes no qualification, and only the owner's recorded
`accept-frozen-pass` can lead to a frozen route. I do not authorise one. The list is not yet
complete by construction: it holds the plan 07-13 evaluation and one entry per qualifying
session, and nothing obliges a further single-arm capture at the same identity to be entered
(E7).

**(g) Can a registered session be dropped unseen?** Yes, in two ways (point 2 and E3, E4).

## The five flagged points

### 1. Order effect against the chosen median

The author's reading is right, and the gate as written is likely to fail for a reason that has
nothing to do with the code.

Evidence from existing same-source data, used as a stand-in session (for each cell, run 1
against run 2 in one direction and run 2 against run 1 in the other, which is the balanced
structure with the observed later-is-slower effect as the order effect):

| Stand-in | Rule 1 | Rule 2 as written | Rule 2 with the cell form (E1) |
|---|---|---|---|
| frozen reference, 2026-10-06 | 0 of 192 | no group fails | no group fails |
| plan 07-13 candidate, 2026-10-10 | 1 of 192 | fails: frame-interval median, Low 1.064; frame-interval p95, Low 1.082; render p95, eight actors 1.062 and Medium 1.121 | no group fails |

In both existing sessions the later run is slower: frame-interval median up to 9.3% and 13.3%.
The drift note recorded run 2 slower than run 1 in every profile, by 0.4% to 32%
(`07-09-HOST-DRIFT.md:101-110`). None of this measures adjacent captures, so the size of a
second-capture slowdown `d` is unknown; but nothing supports assuming it is zero.

Simulation, one frame-interval statistic, no code difference, share of sessions failing rule 2:

| Ratio noise per capture | `d` | As written | Cell form |
|---|---|---|---|
| 1% | 5% | 59.2% | 0.0% |
| 1% | 8% | 100.0% | 0.0% |
| 2% | 0% | 0.1% | 0.2% |
| 2% | 3% | 8.1% | 0.2% |
| 2% | 5% | 60.1% | 0.2% |
| 2% | 8% | 99.7% | 0.3% |
| 4% | 0% | 18.4% | 23.1% |
| 4% | 5% | 61.9% | 24.9% |
| 4% | 8% | 93.2% | 28.8% |

**The form that fixes it, inside R3 and R4 and the approved numbers.** Use the balance R4
created. The two runs of a cell have opposite order, so form one ratio per cell as the mean of
its two profile ratios, then take the same median, `sorted[floor(n/2)]`, over cell ratios in
the same six groups against the same 5%. With a slowdown `d` and no code difference the cell
ratio is `1 + d²/(2(1 + d))`: 1.003 at 8%.

Why this does not loosen the gate:
- With no order effect and no noise it gives exactly the same result as the written rule for
  every pattern of per-cell effects: the 7th of 12 profile ratios is the 4th of 6 cell ratios,
  the 4th of 6 is the 2nd of 3, the 3rd of 4 is the larger of 2.
- The arithmetic mean is never below the geometric mean, so the residual error is on the
  strict side.
- For real regressions it detects at least as often: 8% in a single cell fails in 97.8% of
  sessions against 84.7% as written (noise 2%); every other case in check (a) is 100% in both.
- It is not the mean of the two middle profile ratios, which I showed in the first review also
  survives an order effect: that form would miss a regression between 5% and 10% confined to
  one cell.

What is and is not legitimate here. Legitimate: fixing the estimator before any paired data
exists, by a rule that uses only the design (which runs share a cell). Not legitimate:
measuring the order effect in the calibration and subtracting it, widening a tolerance, or
choosing between forms after seeing a session. The calibration stays a pass-or-stop test and
tunes nothing.

Within the owner's approval: yes. R3 as approved reads "define the aggregate exactly (which
middle value, or a mean)", and R4 is the balance this uses. `T_aggregate` stays 0.05. The owner
is told, not asked.

What the fix does not remove, and the owner should know:
- Noise without any order effect. A tier group has two cells and its aggregate is the larger.
  At 2% ratio noise that fails 0.2% of no-change sessions per statistic; at 4% it fails about
  23%, under either form. The noise of an adjacent pair on this host has never been measured.
  This is the strict reading of "per tier" and I do not propose weakening it; the calibration
  is the test of it.
- Check 6 compares the two runs of a cell, which have opposite order, so it sees the square of
  the slowdown. Above about 11% every session is invalid (55% of sessions at 10% with 2% noise).
- Rule 1. The one rule-1 violation in the candidate stand-in (render p95, Medium, one actor,
  2.0 ms against 2.9 ms) fails that stand-in under any form of rule 2.

### 2. Registry truncation

Not an acceptable residual; the contract should add a history rule (E3). The chain shows a
removed, reordered or edited event in the middle. It does not show removal of the newest
events followed by a commit, and the newest events are the ones worth removing: the session
that just failed. The cap is the main control against selection, so "git history would show
it" leaves the control to whoever reads history. A read-only walk closes it at no cost: every
committed version of the registry file must be a prefix of the current event list.

What stays outside any tool: history that is rewritten (an amended, squashed or rebased
registration commit). The contract should forbid that in words and have the final record name
each registration commit (in E3).

### 3. Contract against plans 07-16 and 07-18

(i) Calibration. The contract is right and plan 07-16 must change.
- A calibration arm is a reference tree. The frozen command cannot be run on it: it re-hashes
  every reported identity against the working tree (`tools/art/animation-budget-v2.mjs:261-262`)
  and the five owner identities differ by design, so it ends with an error message and no
  result line. Plan 07-16's `verify` sets `structuralV2Pass` only from that command and exits 0
  only when it is true (`07-16-PLAN.md`, task 2 action), and its behaviour bullet puts
  `frozenExitCode` in the `closed` event of "every calibration and qualifying session"
  (`07-16-PLAN.md:173`). Under that text no calibration can pass, and without a passed
  calibration no qualifying session can be registered.
- What a calibration arm can and must satisfy is what section 5, criterion 3, second bullet
  already lists, on both arms: the frozen tool's exported `qualify` holds; producer contract
  and sampler identity equal the other arm's; identities equal the other arm's; every listed
  frame image hashes to its recorded value. One check should be added for every reference arm,
  calibration or qualifying: its five owner identities equal the SHA-256 values pinned in
  section 2. Without it nothing in the session record shows that a "reference" report came
  from the reference tree (E2).
- Section 9 is already correct that a calibration adds no frozen evaluation.

(ii) The started marker. The contract is right: a nonce with a started marker must be refused.
Plan 07-16's `--run` refuses only on a `closed` event, so a capture that crashed could be run
again for the same registration. The contract in turn does not say where the marker lives, and
plan 07-16 puts it in the session directory, which is under the gitignored cache: deleting that
directory would remove the only trace. The marker has to be an event in the tracked registry
(E4).

(iii) Page and context lifetime. "Identical for both arms" is not quite enough. It must also be
identical between a calibration and the qualifying sessions it gates, or the calibration says
nothing about them, and it should be recorded in the session report. One sentence (E9). The
choice itself can stay with plan 07-16; the existing capture uses one context per run, and with
that shape both arms meet a fresh page at the same point of run 2, so the arms stay alike.

### 4. Line endings of the pinned documents

It matters, though not for integrity. A hash that no longer matches makes the tool refuse,
which is the safe direction. The cost is operational and under this contract it is severe: a
registered session whose run is refused still counts, and a calibration that cannot run ends
the identity. `core.autocrlf` is true, and the V2 document, the decision record, this record
and the future registry and session reports have no attribute, so any git operation that
rewrites one of them turns LF into CR LF and changes its hash.

Pin the paths, do not strip carriage returns in the tool. Every verify command in plans 07-25,
07-16 and 07-18 hashes raw bytes, the repository already pins two files this way, and
`.gitattributes` is in no identity set (checked in my plan 07-21 review), so adding lines to it
changes no source identity and rewrites no working file. The lines must be committed before
the first registration, because nothing but the registry and the evidence directory may be
committed between a registration and its capture (E8).

### 5. The plan 07-24 figure

The V2 document's citation is accurate: it calls the observation unverified and states no size
(section 1). The size in `07-24-SUMMARY.md:70` is not supported by the numbers beside it:
"about 25 to 30 percent" is followed by 13.0 fps against 14.6 to 14.8, which is 11% to 12%.

I read the debug session's untracked timeline files in the session scratch directory (11 runs,
3 to 6 frame-rate samples per phase per page). By page: generation-2 active, page a 13.0 to
13.8 against 14.6 to 14.8 before plan 07-07 (6% to 12% lower); page b 12.7 to 12.9 against 16.7
to 17.7 (23% to 28% lower); first results screen 14.1 to 17.4 against 17.2 to 19.1. With the
views removed from current source the rates return to the pre-07-07 values. So the session
supports a cost somewhere between about 10% and 28% of frame rate depending on page and phase,
from very few samples; the quoted 25 to 30 is the top of that range paired with the numbers
from the bottom of it.

My first review repeated the figure ("about a quarter of the frame rate" in its owner section).
That record is pinned by hash and I do not edit it; read it with this correction. Nothing in
the contract depends on the size.

## Section 11, item by item

"As strict" means: at least as strict as the first review asked, and unable to produce a pass
its wording would not allow.

| Item | Ruling |
|---|---|
| 1 Median | Change required (E1). The upper-middle value is the strictest choice against a regression and the wrong one against an order effect. Keep the same formula, over cell ratios. |
| 2 Six groups, minimum of 3 | As strict. Keep. Check (e). |
| 3 Order rule | As strict; it is R4 exactly. A deviation makes a session invalid, which is right: it is a harness fault. Its text about not cancelling an order effect changes with E1. |
| 4 Warm-up | As strict. Declared in advance, used by nothing. Reference first is as good as either choice. |
| 5 Validity criteria | As strict. "Larger exceeds smaller times 1.25" is the strictest natural reading of "differs by more than `T_single`" (a difference relative to the mean would allow 1.286). Structural failure as invalid is acceptable: a candidate with a real structural defect is invalid every time and three invalid sessions give `failed`. See check (c) and E5. |
| 6 Calibration | As strict, and harsh by design: one per identity even after a crash. Needs the tool binding of E6. |
| 7 Smoke | As strict. |
| 8 Both arms materialised alike | As strict (O-3). |
| 9 Event chain, commit before capture | Not yet as strict as its own purpose: needs E3 and E4. |
| 10 Counting from registration | As strict. |
| 11 Early `failed`, early `pass` | As strict. I recomputed every row of the verdict table from the two inequalities; all agree. A session registered after a `pass` counts and can undo it, which is right. |
| 12 Earlier identities listed | As strict. It discloses; it does not prevent (N-4). |
| 13 A frozen exit 0 | As strict. Needs the list rule of E7. |
| 14 Allowance of 1e-7 ms | Within the approval. It is needed: a one-step value is stored as `0.10000000894069672` in the candidate and `0.09999999962747097` in the frozen reference, so a literal comparison at `r` = 0 would pass one and fail the other. The largest distance from a multiple of 0.1 is 5.4e-8 ms, below the allowance; the allowance is a millionth of a timer step. It makes "one tick passes" true, which is what R8 states. No fallback needed. |
| 15 Nonce at registration | As strict in effect. It is what ties the committed registration to the capture. Neither this nor a nonce made inside the capture resists deliberate forgery of a report (N-5). |
| 16 Source identity | As strict, and better than a commit id, which the mandated registry commits would change. Because tooling is outside it, a tool change does not reset the cap (good) and does not retire a calibration (not good): E6. |
| 17 Frozen evaluation list | Acceptable with E7. |

Smaller forms: the warm-up pair as run 1, Low, one actor, reference first: acceptable. A
frame-interval median that is not a finite number above 0 makes a session invalid: acceptable.
A session registered and never closed counts as invalid: as strict. One registration permits
one capture: right, with E4. Only the registry and the evidence directory may be committed
between registration and capture: as strict; it is why E8 has to happen first.

Beyond the owner's approval: nothing. Every form is the document's, as it says, and each is
either inside R1 to R8 or stricter. Statements about what a pass means: all inside R1; section
10 quotes the first review's sentence and adds the denominator.

## Findings

| id | severity | evidence | required change |
|---|---|---|---|
| E1 | required | Section 4 rule 2; section 11 items 1 and 3; point 1 tables | Aggregate over cell ratios, each the mean of the cell's profile ratios. |
| E2 | required | Section 5 criterion 3; `07-16-PLAN.md:173` and task 2 `verify`; `animation-budget-v2.mjs:261-262` | State that the frozen command runs on neither arm of a calibration; add the owner-identity check for every reference arm; change plan 07-16. |
| E3 | required | Section 8, "refuses to compute a verdict"; section 11 item 9 | Refuse a verdict unless every committed version of the registry is a prefix of the current one. |
| E4 | required | Section 7 second bullet; section 8 event types; `07-16-PLAN.md` task 1 `--run` | The started marker is a `started` event in the tracked registry; a second run is refused. |
| E5 | required | Section 8, "No session is stopped ... after any timing value has been seen"; check (c) | No timing value is printed or written before a session is closed. |
| E6 | required | Section 6; section 11 item 16 | A calibration applies only to the tool bytes, sampler and browser version it ran with. |
| E7 | required | Section 9, "Count of frozen evaluations"; check (f) | Define a frozen evaluation and list every one at the identity, found by a scan. |
| E8 | required | Point 4; `git ls-files --eol` shows the three documents `w/lf` with no attribute | Pin the hash-bound documents and evidence to LF before the first registration. |
| E9 | required | Section 2 item 5; point 3 (iii) | Same lifetime and launch settings across session kinds, recorded. |
| N-1 | note | Point 1, noise rows | The tier aggregate is the larger of two cell ratios; at 4% noise about a quarter of no-change sessions fail per statistic. State it in section 11 item 2. |
| N-2 | note | Point 1 | Check 6 sees the square of an order effect; above about 11% every session is invalid. State it in section 5. |
| N-3 | note | Check (c) | An invalid session is cheaper than a failed one under the majority rule. Inherent in R6; the denominator shows it. |
| N-4 | note | Section 8, "does not limit the number of identities" | A changed identity starts a new count. Disclosed, not prevented; the final record should state how many identities were tried. |
| N-5 | note | Section 7 | The binding stops reuse of an existing report, not a deliberately edited one. The implementation review and git history are the backstop. |
| N-6 | note | Section 5 criterion 1, "has no `closed` event" | A session's own validity block cannot depend on its `closed` event, which records that block. Say "never closed" at the registry level instead. |
| N-7 | note | Point 5 | The size in `07-24-SUMMARY.md:70` disagrees with its own numbers; the contract does not rely on it. |

## Exact edits to the V2 document

None touches `t_single`, `t_aggregate`, `session_cap`, `timer_quantum_ms` or
`reference_commit`.

**E1, section 4.** Replace the text from "**Rule 2, per group.**" up to and including the
parenthesis that begins "(When some profiles of a group" with:

> **Rule 2, per group.** For each component and statistic:
>
> 1. A profile is usable when its `r` is greater than `eps`. The ratio of a usable profile is
>    `(c - q - eps) / r`.
> 2. The ratio of a cell is the arithmetic mean of the ratios of its usable profiles: of both
>    runs when both are usable, of the one usable run otherwise. A cell with no usable profile
>    has no ratio.
> 3. The aggregate of a group is the frozen contract's own median, `sorted[floor(n/2)]`
>    (`tools/art/animation-budget-v2.mjs:41`), taken over the ratios of the group's cells that
>    have one, `n` being their number.
> 4. The aggregate must be at most `1 + T_aggregate`, in each of six groups:
>
> | Group | Cells | Aggregate is the |
> |---|---|---|
> | all profiles | 6 | 4th smallest cell ratio |
> | one source actor | 3 | 2nd smallest |
> | eight source actors | 3 | 2nd smallest |
> | Low tier | 2 | larger |
> | Medium tier | 2 | larger |
> | High tier | 2 | larger |
>
> (With fewer cells having a ratio the same formula applies: of 5 the 3rd smallest, of 4 the
> 3rd, of 3 the 2nd, of 2 the larger, of 1 that one.)
>
> Why cells. By section 3 the two runs of a cell have opposite capture order. If the second
> capture of a pair is slower by `d` with no code difference, the two profile ratios of a cell
> are near `1 + d` and `1 / (1 + d)`, and their mean is `1 + d²/(2(1 + d))`: 1.003 at `d` = 8%.
> The same median taken over the 12 profile ratios would sit near `1 + d` and fail every
> session, the calibration included, for an order effect above about 5%.

Keep the three bullets that follow (a profile with `r` equal to 0; a group with fewer than 3
usable profiles is `rule-1-only`; no group can excuse another) as they are. In "Arithmetic",
replace the bullet that begins "rule 2 is violated for a group when, for the profile" with:

> - rule 2 is violated for a group when its aggregate, computed as above, is greater than
>   `1 + T_aggregate`; the allowance is already inside every profile ratio;

**E1, section 11.** Item 1: replace the choice with "the frozen contract's own
`sorted[floor(n/2)]`, taken over cell ratios; a cell ratio is the mean of its two opposite-order
profile ratios", name the two alternatives (the same median over the 12 profile ratios, which
fails on an order effect above about 5%; the mean of the two middle profile ratios, which
misses a regression between 5% and 10% confined to one cell), and replace the "Its cost"
sentences with N-1. Item 3: replace "It does not cancel an order effect under the median of
item 1; it makes one show up in every group alike." with "Together with the cell ratio of item
1 it cancels a second-capture slowdown to first order."

**E2, section 5, criterion 3.** Append to the second bullet:

> Its five owner identities must equal the SHA-256 values pinned in section 2. In a calibration
> these checks are made on both arms, every identity of the two arms must be equal, and the
> frozen command is run on neither arm: a calibration has no frozen result and no
> `structuralV2Pass`.

**E3, section 8.** After the bullet "The tool refuses to compute a verdict from a registry
whose chain is broken, or which holds an event that is not present in the committed file." add:

> - It also refuses when any committed version of the registry file is not a prefix of the
>   current event list. The tool reads every version of the file reachable in git history
>   (`git log` and `git show`, read only) and requires the events of each version to equal,
>   event hash by event hash, the first events of the current list. If that history cannot be
>   read in full (for example in a shallow repository) the verdict is refused.
> - A commit that holds a registration is never amended, squashed or rebased. The tool cannot
>   see rewritten history, so the final record names the commit id of every registration.

In section 11 item 9, replace the last sentence with: "The chain alone does not reveal removal
of the newest events; the prefix check against every committed version covers that, and
rewritten history is the residual."

**E4, sections 7 and 8.** In section 8, "Registry": change "Each event has a type, `registered`
or `closed`" to "Each event has a type, `registered`, `started` or `closed`". Change the fixed
order to: "register; commit the registry; capture, which appends `started` before its first
capture and `closed` when it completes; commit the registry and the session evidence, whether
or not the capture completed." In section 7, second bullet, replace "writes a started marker
(the nonce and the hash of the registration event) before the first capture" with "appends a
`started` event (the nonce and the hash of the registration event) to the tracked registry file
before the first capture" and replace "for a nonce that already has a started marker or a
`closed` event" with "for a nonce that has a `started` or `closed` event in the registry file,
in the working tree or as committed".

**E5, section 8.** Add to the bullets under the fixed order:

> - While a calibration or qualifying session runs, the tool prints, logs and writes no timing
>   value, ratio or rule result. Samples are held in memory; the arm reports and the session
>   report are written once, after the last pair, and the `closed` event is appended before any
>   timing is shown. A session that is interrupted leaves its registry events and no timing.

**E6, sections 6 and 8.** In section 8, "Registry", after "A `registered` event also records
the kind, the commit, the source identity and host facts" add: ", the SHA-256 of
`tools/art/animation-budget-paired.mjs`, `tools/art/review.mjs` and
`tools/art/animation-capture.mjs`, and the sampler identity; a `closed` event also records the
browser version". In section 6 add a bullet:

> - A calibration applies only to what it ran with. A qualifying session may be registered only
>   when the three tool hashes and the sampler identity equal those in the identity's
>   calibration `registered` event, and its capture is refused when the browser version differs
>   from the one in the calibration's `closed` event. A change to any of them after the
>   calibration ends the paired route for that identity in the same way as a failed calibration.

**E7, section 9.** After "Entries are numbered in time order, so each is "evaluation k of n"."
add:

> A frozen evaluation is one captured candidate report on which the frozen command was run;
> running the command again on the same report adds nothing. The list is built by a scan, not
> from memory: every complete candidate report in the phase evidence directory and in the
> capture cache directory whose source identity equals the current one is listed, with the
> frozen command's result for it, whether or not it belongs to a session. A frozen exit 0 on a
> report that the scan does not find is not put forward.

**E8, "Status, sources and what is approved".** After the paragraph that begins "Plan 07-16 pins
the SHA-256 of this file" add:

> These hashes are of the files' bytes with LF line endings. Before the first registration the
> three records, the registry file and the session evidence files are pinned to LF in the root
> `.gitattributes`, so that no checkout can change their bytes. A registration made before
> those lines are committed is refused.

**E9, section 2, item 5.** Append: "The same holds across session kinds: a calibration and a
qualifying session use the same context and page lifetime, launch flags and sampler arguments,
and every session report records them."

**Notes to fold in while editing (not conditions):** N-1 into section 11 item 2; N-2 as one
sentence after check 6 in section 5; N-6 by moving "the session has no `closed` event" out of
criterion 1 and into section 8's definition of `invalid`, where it already is.

## Edits plans 07-16 and 07-18 need so that they match the contract

Plan 07-16:

1. (E1) The must-have that says "the aggregate is the frozen contract's upper-middle median over
   each of six groups" and the task 2 bullet "Rule 2, definition" (`07-16-PLAN.md:23`, `:164`):
   the aggregate is `sorted[floor(n/2)]` over cell ratios, a cell ratio being the mean of the
   cell's usable profile ratios. Add controls: an 8% second-capture slowdown with no code
   difference passes rule 2; a 20% increase in both runs of one cell fails in its tier group; a
   cell with one usable profile uses that profile's ratio.
2. (E2) The task 2 bullet "Frozen result per session" (`:173`): "every qualifying session", not
   "every calibration and qualifying session". The `verify` command: for kind `calibration` it
   runs no frozen command; it applies to both arms `qualify`, producer contract and sampler
   equality, equality of every identity between the arms, the five owner identities against
   `referenceOwners`, and the frame-image hashes; it prints `structuralV2Pass: null` and no
   frozen field; it exits 0 for a valid calibration that passes rules 1 and 2. For kind
   `qualifying` add the owner-identity check on the reference arm. Add controls for both.
3. (E3) `chain` and `verdict` apply the prefix check over `git log -- <registry>` and refuse a
   shallow history; a control with a synthetic history reader.
4. (E4) `appendEvent` accepts `started`; `--run` appends it to the registry file before the
   first capture and refuses when the working or committed registry already holds `started` or
   `closed` for the nonce; a control for the refused second run. The task 1 verify command that
   requires exactly 2 events for the smoke nonce (`:137`) then requires 3.
5. (E5) The calibration and qualifying modes hold samples in memory and emit no timing before
   the `closed` event.
6. (E6) `registerSession` records the three tool hashes and the sampler identity and refuses a
   qualifying registration when they differ from the calibration's; `--run` refuses a browser
   version other than the calibration's; controls.
7. (E8) In task 1, before the first `--register`: add exact-path `text eol=lf` lines to the root
   `.gitattributes` for `07-09-PAIRED-AMENDMENT-V2.md`, `07-09-PAIRED-AMENDMENT-DECISION.md`,
   `07-09-PAIRED-AMENDMENT-V2-REVIEW.md`, `evidence/07-paired-session-registry.json` and the
   session evidence files this plan and plan 07-18 name, commit them, and add a control that
   reads `.gitattributes` and finds each line once.
8. (E9) The session report records context and page lifetime, launch flags and sampler
   arguments; a control that a calibration and a qualifying session record the same values.

Plan 07-18:

1. (E2) Task 1 runs the paired `verify` on the calibration report and must expect no frozen
   field and no `structuralV2Pass` for it (`07-18-PLAN.md:122`).
2. (E6) Task 2's precondition (`:148`) also requires the calibration's recorded tool hashes,
   sampler identity and browser version to equal the current ones.
3. (E7) Task 2 builds `frozenEvaluations` by the scan of E7, not only from the plan 07-13
   evaluation and the sessions (`:161`).
4. (E3) Each registration commit is named in `evidence/07-18-timing-result.json`.

## What I ran

At `2ea292e`, Node v24.19.0; one script in the session scratch directory, deleted afterwards.

- Hashes of the four documents against their `HEAD` blobs; `git status --short`;
  `git ls-files --eol` for the documents; the root `.gitattributes`.
- `v2rules.mjs`: rule 1, rule 2 as written and rule 2 in the cell form, plus checks 5 and 6,
  applied to the frozen reference and the plan 07-13 candidate as same-source stand-in
  sessions; and 20,000 simulated sessions per row for the tables in point 1 and check (a).
- The contract's arithmetic claims against the two reports (192 values each, largest distance
  from a multiple of 0.1, the stored form of a one-step value); the five blob SHA-256 values
  against my earlier computation; the order table against the parity rule; every row of the
  verdict table against the two inequalities.
- The plan 07-24 debug timelines in the scratch directory, summarised by source, page and phase.
- Read in full: the V2 document, the decision record, plan 07-25, plan 07-16; plan 07-18 where
  it touches calibration, sessions, the registry and frozen evaluations.

## What I could not verify

- Anything that needs a paired capture: the size of a second-capture slowdown, the noise of an
  adjacent pair, whether the mixed tree runs. No paired data exists. The stand-in sessions are
  two runs about 8 minutes apart, and the simulation's noise levels are assumptions bracketing
  what those runs show.
- That the edits above are complete once written. The review has to be repeated on the new
  bytes.
- The plan 07-24 timelines are another session's untracked scratch files; I summarised them as
  found.
- My own effort setting; the frontmatter records what the review was dispatched with.
