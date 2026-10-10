---
phase: 07-movement-matched-and-action-safe-animation
plan: "25"
status: approved-contract
contract_version: paired-same-session-v2
supersedes: .planning/phases/07-movement-matched-and-action-safe-animation/07-09-PAIRED-AMENDMENT.md
proposal_sha256: 4ecad5a12772a5739012e1a2673fa1c596147e0c44be111183c0482a0e7663cd
review_sha256: 7fe81473b0a7f2eca58f9b5db0b22e3789c0049a135a324e287685ab0a400022
decision_sha256: c1af5d9bf5e904dcf6c40506dbcaee781ddc4deca31412e6548bdd4176387f69
t_single: 0.25
t_aggregate: 0.05
timer_quantum_ms: 0.1
session_cap: 3
reference_commit: c973458
written: 2026-10-10
---

# Plan 07-09: paired same-session timing contract, version 2

This is the paired timing gate written as rules an implementer follows. It is the text to
implement and to read results against. `07-09-PAIRED-AMENDMENT.md` (the original proposal) stays
byte-identical as history; it is not the contract and is not edited.

## Status, sources and what is approved

| Record | SHA-256 of the file on disk when this document was written |
|---|---|
| `07-09-PAIRED-AMENDMENT.md` (proposal, historical) | `4ecad5a12772a5739012e1a2673fa1c596147e0c44be111183c0482a0e7663cd` |
| `07-09-PAIRED-AMENDMENT-REVIEW.md` (independent review, `changes-required`, no blocker) | `7fe81473b0a7f2eca58f9b5db0b22e3789c0049a135a324e287685ab0a400022` |
| `07-09-PAIRED-AMENDMENT-DECISION.md` (owner decision) | `c1af5d9bf5e904dcf6c40506dbcaee781ddc4deca31412e6548bdd4176387f69` |

The first two values equal `proposal_sha256` and `review_sha256` inside the decision record.

What the owner approved. The decision record has `decision: approved`, conditional on the
review's required changes R1 to R8. The owner's reply, verbatim:

> approved with the eight fixes, yes, yes, none (i will prepare computer so that this full run is free to go)

The numbers `T_single` 0.25, `T_aggregate` 0.05 and the cap of 3 sessions were the reviewer's
recommendation, carried in the orchestrator's stated recommendation, which the owner approved by
that reply. The owner did not type these numbers. `q` 0.1 ms and the reference commit `c973458`
come from the proposal and the decision record.

The two tolerances and the cap are ceilings. They are never raised after any candidate data has
been seen. No calibration result, session result, review or tool changes them.

What is not owner-approved. R1 to R8 say what must change; several leave the exact form open.
Every form chosen here is listed in section 11. Those forms are this document's, not the
owner's. No implementation and no session may rely on them unless
`07-09-PAIRED-AMENDMENT-V2-REVIEW.md` exists with `status: pass` or `status: pass-with-notes`
and a `v2_sha256` equal to the SHA-256 of this file. If that review finds a form that goes
beyond the approval, the owner is asked; no agent decides it.

State of the gates when this was written. The frozen V2 gate at current source is
`numeric-only-fail` (plan 07-13: exit 1, structure passes, 40 of 192 statistics over). Until a
paired verdict of `pass` exists under this contract, the frozen V2 contract is the only
applicable timing gate and plan 09 stays halted.

Plan 07-16 pins the SHA-256 of this file, of the decision record and of the V2 review record in
code and compares them with the files at every run. A changed byte in any of the three makes
every paired result refuse.

These hashes are of the files' bytes with LF line endings. Before the first registration the
three records, the registry file and the session evidence files are pinned to LF in the root
`.gitattributes`, so that no checkout can change their bytes. A registration made before
those lines are committed is refused.

Revision. The first form of this document (commit `2ea292e`, SHA-256
`1ae66f8b16f3c4c3d8501b6fd86a5e54b92a6fef9898cab184d4811f793bb47d`) was reviewed with
`changes-required`: nine required edits, E1 to E9, no owner decision needed, none of the
approved numbers touched. This text carries those edits; section 11 marks every item they
changed or added. The earlier verdict does not cover these bytes. The paragraph above on what
is not owner-approved applies to them unchanged: nothing may rely on this text until the review
record's `v2_sha256` equals the SHA-256 of this file.

This document was written and revised without running any capture, browser, server or test
suite, and it changes no code.

## Terms

- **Owner files**: `src/builders/characterResources.js`, `src/builders/enemyGLTF.js`,
  `src/builders/firstPersonRig.js`, `src/builders/enemyAnimations.js`,
  `src/builders/weaponHandling.js` (the frozen tool's `MUTABLE_RUNTIME`,
  `tools/art/animation-budget-v2.mjs:21-22`).
- **Profile**: one combination of run (1, 2), tier (Low, Medium, High) and source actor count
  (1, 8). There are 12. **Cell**: one tier with one actor count. There are 6; each has a run 1
  profile and a run 2 profile.
- **Tier index**: Low 0, Medium 1, High 2. **Actor index**: one actor 0, eight actors 1.
- **Component** and **statistic**: the eight components `frameIntervalMs`, `mixerMs`,
  `inertiaMs`, `correctionMs`, `renderMs`, `selectionMs`, `coreCorrectionMs`, `viewMs`, each as
  `median` and `p95` over 214 timed frames, exactly as the unchanged sampler reports them. One
  arm of one session has 12 x 8 x 2 = 192 values.
- **Arm**: one of the two source trees of a session. **Pair**: the two captures of one profile,
  one per arm, back to back.
- `r`: a reference-arm value in ms. `c`: the candidate-arm value for the same profile, component
  and statistic. `q` = 0.1 ms, the timer step (the review's "tick"), fixed by this contract and
  not measured.
- **Source identity**: the SHA-256 of the canonical (key-sorted) serialisation of the identity
  set a capture records for the candidate tree: the SHA-256 of every source file the gate hashes
  plus the sampler identity (`animationIdentities()` in `tools/art/review.mjs`). It is the value
  the stable gates and plan 09 qualification compare. The cap, the calibration and the verdict
  are keyed to it.
- **Session**: one registered run of the paired capture, of kind `smoke`, `calibration` or
  `qualifying` (section 8).

## 1. What is measured (R1)

The paired gate measures one thing: the effect of the edits made to the five owner files after
`c973458`, in the offline Training Range capture with 1 and 8 source actors in three tiers, on
this host, under software rendering (headless Chromium with SwiftShader).

It does not measure "whether Phase 7 made animation cost worse". That sentence in the proposal's
"Why" is withdrawn as the question answered.

Why it cannot be read wider:

- Both arms share every file except the five owner files, and the reference owner files are the
  ones from the freeze. Anything that existed at the freeze is in both arms and cancels.
- `firstPersonRig.js` was added by plan 07-07 before `c973458`. The reference arm therefore
  contains the first-person rig. Every one of the 12 profiles builds and draws a first-person
  view on the first source actor (`tools/art/review.mjs:488`). The cost of that view is present
  at full size in both arms, so the paired predicate cannot see it in any profile.
- The frozen V2 limits cannot see it either, for the same reason: the frozen reference was
  captured with the view attached. Neither gate says what the view costs. One debug session in
  plan 07-24 recorded a frame-rate cost for the view under software rendering as an unverified
  observation (`07-24-SUMMARY.md:70`); its size is not established by anything in this contract.
- Only a change made to the view's cost after the freeze, inside the five owner files, is
  visible, and only if it is large enough (section 4).
- Cost in any file outside the five owner files is identical in both arms and invisible.
- The workload is offline Training Range. It is not online play.

## 2. Arms (R2)

How both arms are built, for every session:

1. The candidate commit is the commit checked out when the session is registered. The arms are
   built only when the working tree has no uncommitted change in any file the arms serve or the
   gate hashes.
2. Both arms are materialised the same way: the same set of working-tree files is copied byte
   for byte into two owned cache directories (O-3). No `git archive` is used, because for 82 of
   the 127 frozen file identities archive bytes differ from the working tree.
3. In the reference directory exactly five files, the owner files, are then replaced with their
   blob bytes from `c973458`. Each is verified against its git blob id and against the SHA-256
   of the blob bytes, both pinned in code:

   | Owner file | Blob id at `c973458` | SHA-256 of the blob bytes |
   |---|---|---|
   | `src/builders/characterResources.js` | `37b3399325545d894e2a3578f3970fb58f9c1a3f` | `98e99511c87bb24e59ec52a53c4a4aa9c59271dc356eef4c9f251fe982b985f1` |
   | `src/builders/enemyGLTF.js` | `a45770f1db9b49af1254e29aadcad8d299f9662d` | `3a32d3eeba136e0a50389ddf65353d4e1ee402a22a34b41ac090a6f47f626d79` |
   | `src/builders/firstPersonRig.js` | `3835cc290d54ddeceeb2e3d65a3cf861aed1880a` | `d98f324330ec98ff0bce4902b5b35814cc5b8070e21bb983be086929e46d8405` |
   | `src/builders/enemyAnimations.js` | `56eecc0a3a455747ae8881b7827cfa28f8f11281` | `8217f32ff2c4a65613aadcf62442c092a3e0d604f8ff5f7c5dc361b730d4aee0` |
   | `src/builders/weaponHandling.js` | `a949f7cc8b4697c8063dc5659245686c6cb9dc4f` | `15a060eeb4ea2ce4054293ea6737afe3c346e5bb01be6ef3cd7db90257c217ea` |

   The blob ids are the ones the review lists. The SHA-256 values were computed for this
   document from `git cat-file blob`; the two the review states (`d98f3243...8405`,
   `15a060ee...17ea`) agree.
4. Any other difference between the two directories is refused, naming the path. The tool
   reports the count of differing files; it must be five.
5. Each arm is served by its own owned strict loopback listener with the same server
   configuration. Whatever the capture does for one arm (browser build, launch flags, context
   and page lifetime, sampler arguments) it does identically for the other. The same holds
   across session kinds: a calibration and a qualifying session use the same context and page
   lifetime, launch flags and sampler arguments, and every session report records them.
6. No branch, worktree, checkout or install is used to build an arm.

So both arms carry the candidate's `public/models/enemy.glb`, motion manifest, `src/main.js` and
every other file; only the five owner files differ. In a calibration session (section 6) the
second directory is a second copy of the reference arm, built by the same steps.

Facts the proposal got wrong, corrected here:

- The proposal says a byte-exact reference of the 2026-10-06 working tree "cannot be rebuilt",
  and its decision 3 calls it "unrecoverable". Both statements are withdrawn. The review
  compared all 127 frozen file identities with `c973458`: the commit holds exactly the content
  the frozen reference was captured from, for all 127 files; only line endings differ.

  | Frozen identity is reproduced by | Files |
  |---|---|
  | the `c973458` blob as stored (LF) | 42, including `firstPersonRig.js` and `weaponHandling.js` |
  | the `c973458` blob with every line ending as CR LF | 57 |
  | the plan 07-21 preserved copy, equal to the `c973458` blob once carriage returns are removed | 25 |
  | the `c973458` blob with a specific mix of line endings, found and verified by hash | 3: `characterResources.js`, `enemyGLTF.js`, `enemyAnimations.js` |

  The review's appendix gives the line ranges for the three mixed files; each rebuilt file
  hashes to its frozen identity. The frozen bytes are reproducible.
- The proposal's phrase "git-defined reference arm" is retired. Only the five owner files come
  from git objects. Everything else in both arms is working-tree bytes, which for 82 files no
  git object reproduces. The proposal's "every file at the candidate commit" described as coming
  from git objects is withdrawn with it.
- What the owner accepted (decision record, `reference_arm_accepted: true`) is the arm as the
  review describes it after R2: working-tree bytes plus the five owner files from `c973458`.

Line endings of the reference owner files. They are the `c973458` blobs as stored, which contain
no carriage return (LF throughout). The frozen reference was captured from the same bytes for
`firstPersonRig.js` and `weaponHandling.js`, and from the same content with mixed line endings
for the other three (18 of 66, 437 of 523 and 413 of 640 lines ending CR LF). The review found
that this affects identities only, not the comparison: a CR LF inside a template literal is read
as LF by the language, string literals cannot span lines, and the size difference is a few
hundred bytes of parse input before any timed frame.

Not demonstrated when this was written: the combination "owner files from `c973458` with the
corrected GLB" has never run. The review's evidence that it loads is static. The first smoke
session (section 8) is its first execution. If it does not load or sample, the reference arm as
approved is not workable and the matter returns to the owner; no other reference is substituted.

## 3. Session shape and order (R4)

One invocation captures a session: one browser version, one host, no other capture running.

- A calibration or qualifying session has 12 profiles. Each is captured for both arms back to
  back, as a pair.
- Profiles are taken in the order the existing capture uses: run, then tier, then actor count
  (`tools/art/review.mjs:710`, `:729-730`): 1 Low/1, 2 Low/8, 3 Medium/1, 4 Medium/8, 5 High/1,
  6 High/8 in run 1, then the same six in run 2.
- Which arm goes first in a pair:
  - run 1: reference first when tier index plus actor index is even, candidate first when it is
    odd;
  - run 2: the opposite of run 1 for every cell.

  | Cell | Run 1 | Run 2 |
  |---|---|---|
  | Low / 1 | reference first | candidate first |
  | Low / 8 | candidate first | reference first |
  | Medium / 1 | candidate first | reference first |
  | Medium / 8 | reference first | candidate first |
  | High / 1 | reference first | candidate first |
  | High / 8 | candidate first | reference first |

  So each cell is once reference-first and once candidate-first; inside every tier two pairs are
  reference-first and two candidate-first; inside every actor count three and three.
- Warm-up (O-2). Before the 12 pairs, one warm-up pair is captured: the profile run 1, Low, one
  actor, reference first. It is declared here in advance. Its values are recorded in the session
  report, marked as warm-up, and are used by no rule, no validity check and no verdict.
- No capture of either arm overlaps in time with any other capture.
- The session report records the order actually used for every pair. A session whose recorded
  order differs from this scheme in any pair is invalid (section 5).
- In a calibration session the first copy of the reference arm takes the reference position and
  the second copy takes the candidate position, in this section and in sections 4 and 5.

The proposal's "reference first on odd profiles, candidate first on even" is withdrawn: with
this capture order it put the reference first in every one-actor profile and the candidate first
in every eight-actor profile, so order was fully confounded with actor count.

## 4. Timing predicate (R3, R8)

The rules use only the 12 measured pairs. `T_single` = 0.25, `T_aggregate` = 0.05, `q` = 0.1 ms.

**Rule 1, per value.** For every profile, component and statistic (192 comparisons):

`c <= r * (1 + T_single) + q`

**Rule 2, per group.** For each component and statistic:

1. A profile is usable when its `r` is greater than `eps`. The ratio of a usable profile is
   `(c - q - eps) / r`.
2. The ratio of a cell is the arithmetic mean of the ratios of its usable profiles: of both
   runs when both are usable, of the one usable run otherwise. A cell with no usable profile
   has no ratio.
3. The aggregate of a group is the frozen contract's own median, `sorted[floor(n/2)]`
   (`tools/art/animation-budget-v2.mjs:41`), taken over the ratios of the group's cells that
   have one, `n` being their number.
4. The aggregate must be at most `1 + T_aggregate`, in each of six groups:

| Group | Cells | Aggregate is the |
|---|---|---|
| all profiles | 6 | 4th smallest cell ratio |
| one source actor | 3 | 2nd smallest |
| eight source actors | 3 | 2nd smallest |
| Low tier | 2 | larger |
| Medium tier | 2 | larger |
| High tier | 2 | larger |

(With fewer cells having a ratio the same formula applies: of 5 the 3rd smallest, of 4 the
3rd, of 3 the 2nd, of 2 the larger, of 1 that one.)

Why cells. By section 3 the two runs of a cell have opposite capture order. If the second
capture of a pair is slower by `d` with no code difference, the two profile ratios of a cell
are near `1 + d` and `1 / (1 + d)`, and their mean is `1 + d²/(2(1 + d))`: 1.003 at `d` = 8%.
The same median taken over the 12 profile ratios would sit near `1 + d` and fail every
session, the calibration included, for an order effect above about 5%.

- A profile with `r` equal to 0 is left out of rule 2 and is covered by rule 1 only.
- A group with fewer than 3 profiles having `r` greater than 0, for a component and statistic,
  has no aggregate for it. Rule 1 alone applies there. The result lists that group, component
  and statistic as `rule-1-only`; it neither passes nor fails rule 2.
- No group can excuse another. A session passes rule 2 only if every group that has an aggregate
  passes, for every component and statistic. This keeps the earlier approved rule that an
  eight-actor improvement cannot excuse a failed one-actor profile (`07-BUDGET-AMENDMENT.md:17`).

**Arithmetic.** Timing values are reported as doubles that lie within about 5e-8 ms of a
multiple of 0.1 ms, not exactly on it (measured on the two existing 12-profile reports: 192
values each; largest distance 5.4e-8 ms in `evidence/07-13-cost-candidate.json` and 2.6e-9 ms in
the frozen reference; a one-step value appears as, for example, `0.10000000894069672`). So that
a value exactly at a bound is judged the same way every time, every comparison in this section
and in section 5 carries the frozen contract's own comparison allowance, `eps` = 1e-7 ms
(`comparisonEpsilonMs`, `tools/art/animation-budget-v2.mjs:64`, used by the frozen gate at
`:189`):

- rule 1 is violated when `c > r * (1 + T_single) + q + eps`;
- `r` counts as 0 when `r <= eps`;
- rule 2 is violated for a group when its aggregate, computed as above, is greater than
  `1 + T_aggregate`; the allowance is already inside every profile ratio;
- the two checks in section 5 are violated when the larger value exceeds the smaller value times
  `(1 + T_single)` by more than `eps`.

This allowance is this document's choice (section 11, item 14), not part of the approval.

**What the tolerances really allow.** The table is the review's; bounds are exact arithmetic.

| Reference value `r` | Rule 1 allows `c` up to | Rule 2 allows the typical `c` up to |
|---|---|---|
| 0 | 0.1 ms | not applied |
| 0.1 ms | 0.225 (+125%) | 0.205 (+105%) |
| 0.3 ms | 0.475 (+58%) | 0.415 (+38%) |
| 0.5 ms | 0.725 (+45%) | 0.625 (+25%) |
| 1 ms | 1.35 (+35%) | 1.15 (+15%) |
| 2 ms | 2.6 (+30%) | 2.2 (+10%) |
| 250 ms | 312.6 (+25%) | 262.6 (+5%) |

In words:

- 5% and 25% are effective only for the frame interval (hundreds of ms).
- For the sub-millisecond components, which are the ones that measure the owner files' own
  script work, the timer step of 0.1 ms dominates. Their effective tolerance runs from about 10%
  to over 100%. Typical sizes in the plan 07-13 candidate (smallest, middle, largest median over
  the 12 profiles): frame interval 209, 301, 429 ms; correction 0.7, 1.6, 2.6; render 0.7, 1.85,
  4.7; core correction 0.3, 1.0, 1.9; selection 0.1, 0.2, 0.4; view 0.4 in every profile; mixer
  0 to 0.1; inertia 0 everywhere.
- Zero limits are loosened from exact to one timer step. The frozen contract treats a zero limit
  as binding (`zeroLimitsAreBinding`, allowance 1e-7 ms). Here, with `r` equal to 0, a `c` of
  one step (0.1 ms) passes and two steps fail.
- In both existing reports the inertia median is 0 in all 12 profiles and the mixer median is 0
  in 6. Where that repeats, inertia median has no aggregate in any group (`rule-1-only`), and
  the mixer median may have none in some groups.
- This is the timer's resolution, not a design error. It is stated so that nobody reads a pass
  as a 5% bound on the small components.

## 5. Validity (R5)

Validity is decided by the tool from the fixed criteria below. It is written to the session
record before the timing predicate is evaluated, and the evaluation refuses a session record
that has no validity block. Nobody reclassifies a session afterwards, in either direction.

A session is invalid when any of these holds:

1. **Incomplete.** It does not hold exactly the warm-up pair and the 12 pairs, each profile once
   per arm; or an arm report is not complete. (A session that was registered and never closed
   has no validity block at all; section 8 counts it as invalid at the registry level.)
2. **Order.** The recorded order of any pair differs from section 3.
3. **Structure.** An arm fails its structural checks:
   - candidate arm of a qualifying session: the unchanged frozen command
     `node tools/art/animation-budget-v2.mjs verify --budget <frozen V2 budget> --candidate <candidate arm report>`
     must print its result line (it does so at exit 0, and at exit 1 when the only failures are
     numeric overruns). A failure that prints only an error message is a structural failure.
   - reference arm, and both arms of a calibration: the frozen tool's exported `qualify` must
     hold for the report; its producer contract and sampler identity must equal the other
     arm's; every source identity outside the five owner files must equal the other arm's; and
     every listed frame image must hash to its recorded value. (The reference arm cannot pass
     the full frozen candidate check by design: it has the pre-tuning skeleton count and five
     different identities.) Its five owner identities must equal the SHA-256 values pinned in
     section 2. In a calibration these checks are made on both arms, every identity of the two
     arms must be equal, and the frozen command is run on neither arm: a calibration has no
     frozen result and no `structuralV2Pass`.
4. **Binding.** The binding in section 7 fails.
5. **Gross instability.** For any cell, the reference arm's frame-interval median in run 1 and
   in run 2 differ by more than `T_single`: the larger exceeds the smaller times
   `(1 + T_single)`. This is a gross-instability check and only that. It is not a drift
   detector: the review showed it misses most recorded drift, and pairing is what absorbs slow
   drift.
6. **Ratio agreement.** For any cell, let `k1` be the candidate frame-interval median divided by
   the reference frame-interval median in run 1, and `k2` the same in run 2. The session is
   invalid when the larger of `k1`, `k2` exceeds the smaller times `(1 + T_single)`. A
   frame-interval median that is not a finite number greater than 0 also makes the session
   invalid. The two runs of a cell have opposite capture order, so this check sees the square
   of a second-capture slowdown: with a slowdown `d` and no code difference the larger of `k1`,
   `k2` is near `(1 + d)²` times the smaller, and once `(1 + d)²` is above `1 + T_single`
   (`d` above about 11.8%) every session is invalid, the calibration included.

The proposal's rule 3 ("a session is invalid ... if the reference arm's own run 1 and run 2
differ by more than `T_single`") survives only as check 5 with its purpose restated; check 6 is
the added agreement check R5 asks for.

Outcome of a session, set by the tool:

- **invalid**: any criterion above. An invalid session is neither a pass nor a fail.
- **valid and passed**: valid, rule 1 holds for all 192 comparisons, and rule 2 holds in every
  group that has an aggregate.
- **valid and failed**: valid, and rule 1 or rule 2 is violated anywhere.

## 6. Calibration (R5)

Before any qualifying session for a source identity, one calibration session is run for that
identity: the reference arm against a second materialised copy of the reference arm, with the
same order scheme, the same warm-up and the same binding as a qualifying session.

- The calibration must be valid and must pass rules 1 and 2.
- If it does not, no qualifying session may be registered for that identity, and the matter
  returns to the owner.
- There is exactly one calibration per source identity, whatever ends it. It counts from its
  registration. A calibration that crashes or is interrupted for a reason that has nothing to do
  with measurement also ends the identity: it is not run again, and the tool refuses a second.
  Recovery then needs an owner decision and a tooling change in a new plan.
- The consequence, stated plainly for the owner: one bad run of the calibration, for any reason,
  stops the paired route for that source identity until you decide what to do. The review's
  point estimate, from a single event and with a wide interval, is that a session with no code
  difference fails rule 1 about 40% of the time. A failed calibration is therefore a likely
  outcome, not a remote one. If it fails, the harness cannot tell no change from a change at the
  approved tolerances on this host, and what to do about that is the owner's decision. Rule 2
  adds its own no-change failures from noise, which the cell ratio of section 4 does not
  remove (section 11, items 1 and 2); the calibration is the test of that.
- A calibration applies only to what it ran with. A qualifying session may be registered only
  when the three tool hashes and the sampler identity equal those in the identity's
  calibration `registered` event, and its capture is refused when the browser version differs
  from the one in the calibration's `closed` event. A change to any of them after the
  calibration ends the paired route for that identity in the same way as a failed calibration.
- The calibration result changes nothing else. `T_single` stays 0.25 and `T_aggregate` stays
  0.05 whatever it shows. Its measured no-change behaviour is reported (largest rule-1 ratio,
  the group aggregates, the two validity checks' largest values) and is never used to tune.

A calibration contains no candidate arm. It does not count toward the cap of section 8.

## 7. Single-invocation binding (R7)

- Each session has one nonce. The tool generates it when the session is registered (section 8)
  and records it in the `registered` event.
- One registration permits one capture invocation. That one invocation captures both arms,
  appends a `started` event (the nonce and the hash of the registration event) to the tracked
  registry file before the first capture, and writes the nonce into both arm reports and into
  the session report. The tool refuses to start a capture for a nonce that has a `started` or
  `closed` event in the registry file, in the working tree or as committed. A capture that
  started and did not complete is not repeated; the session stays in the registry as it stands.
- Both arm reports carry, for the warm-up and for each of the 12 profiles, the start time and
  end time of that capture, taken by the invoking tool on the host clock. Put in time order, the
  26 captures of a session must not overlap and must follow the scheme of section 3 exactly.
  That is what shows the interleaving.
- An arm report is rejected, and the session is invalid, when it has no nonce; when its nonce is
  not the session's; when its capture times do not interleave with the other arm's as section 3
  requires; when any capture time lies before the `started` event or after the session's close;
  or when its SHA-256 equals that of the frozen reference report, of any existing single-arm V2
  candidate (for example `evidence/07-13-cost-candidate.json`), of an arm report of an earlier
  session, or of the other arm.
- No report created outside the invocation can be an arm. In particular an existing single-arm
  V2 candidate that already passes every structural check cannot be named as the candidate arm
  beside a freshly captured reference arm.

## 8. Sessions, cap and result (R6)

**Registry.** A tracked registry file records every session before it runs. It is an
append-only event log. Each event has a type, `registered`, `started` or `closed`, and carries a
sequence number, a timestamp, the session nonce and the SHA-256 of the previous event (a fixed
string for the first). A removed, reordered or edited event therefore breaks the chain. A
`registered` event also records the kind, the commit, the source identity and host facts, the
SHA-256 of `tools/art/animation-budget-paired.mjs`, `tools/art/review.mjs` and
`tools/art/animation-capture.mjs`, and the sampler identity; a `closed` event also records the
browser version. A `closed` event records the mechanical outcome set by the tool (validity, pass
or fail), the hashes of the reports and, for a qualifying session, the frozen command's exit
code and overrun count (section 9).

**Fixed order for every session:** register; commit the registry; capture, which appends
`started` before its first capture and `closed` when it completes; commit the registry and the
session evidence, whether or not the capture completed.

- The tool refuses to start a capture whose `registered` event is not in the committed registry.
- A capture runs only while the source identity is still the registered one. Between a
  registration and its capture, only the registry and the phase evidence directory may be
  committed. A registration whose capture is refused for this reason still counts.
- The tool refuses to compute a verdict from a registry whose chain is broken, or which holds an
  event that is not present in the committed file.
- It also refuses when any committed version of the registry file is not a prefix of the
  current event list. The tool reads every version of the file reachable in git history
  (`git log` and `git show`, read only) and requires the events of each version to equal,
  event hash by event hash, the first events of the current list. If that history cannot be
  read in full (for example in a shallow repository) the verdict is refused.
- A commit that holds a registration is never amended, squashed or rebased. The tool cannot
  see rewritten history, so the final record names the commit id of every registration.
- A session counts from its registration. One that was registered and never closed counts.
- Each session report carries the hash of its registration event and the hash of its `started`
  event.
- A session that is not in the registry counts for nothing.
- No session is stopped or discarded after any timing value has been seen. Reports and hashes
  are kept whatever happens.
- While a calibration or qualifying session runs, the tool prints, logs and writes no timing
  value, ratio or rule result. Samples are held in memory; the arm reports and the session
  report are written once, after the last pair, and the `closed` event is appended before any
  timing is shown. A session that is interrupted leaves its registry events and no timing.
- Host facts (power plan, heavy applications running, CPU load) are recorded before and after
  every session (O-4).

**Kinds.**

- `smoke`: one profile pair (run 1, Low, one actor), proving only that both arms load and
  sample. It asserts that the reference-arm page raised no page error and that its sample has
  the fields `qualify` requires of a sample (O-5). It writes structure and load facts only. The
  tool writes, prints and keeps no timing value and no comparison from a smoke, and its arm
  reports are not kept. At most one smoke per source identity, unless the previous one failed
  structurally. A smoke is refused once a calibration or qualifying event exists for the
  identity. A smoke never counts.
- `calibration`: exactly one per source identity (section 6). It does not count toward the cap,
  because it contains no candidate arm. It gates qualifying sessions: none can be registered
  until the identity's calibration is closed, valid and passed.
- `qualifying`: candidate against reference. Every started one counts, whatever its outcome:
  pass, fail, invalid, aborted or crashed. At most 3 per source identity; the tool refuses a
  fourth.

**Result for a source identity.** Over the qualifying sessions registered for it:

- `started`: the number registered;
- `passed`: closed, valid and passed;
- `failed`: closed, valid and failed;
- `invalid`: all the others, that is closed and invalid, or registered and never closed (a
  session with no validity record is not valid).

Verdict:

- `pass` when `passed` is greater than `failed`. So at least one session is valid, and more
  valid sessions passed than failed.
- `failed` when `passed + (3 - started)` is not greater than `failed`: a pass has become
  arithmetically impossible within the cap.
- `undecided` otherwise.

| Qualifying sessions so far | Verdict |
|---|---|
| pass | `pass` |
| fail | `undecided` |
| invalid | `undecided` |
| pass, fail | `undecided`; the third decides |
| fail, fail | `failed` |
| fail, invalid | `failed` |
| invalid, invalid | `undecided`; one session left |
| invalid, pass | `pass` |
| fail, pass, pass | `pass` |
| pass, fail, invalid | `failed` |
| any three without `passed` greater than `failed` | `failed` |

- An invalid session decides nothing and still uses one of the three.
- The verdict is never `pass` earlier than these rules allow, and it is always computed from the
  whole registry. A pass comes from the verdict, never from one hand-picked report. Sessions are
  never merged and profiles are never selected across sessions.
- Sessions stop when the verdict is `pass` or `failed`. A further session is run only while it is
  `undecided`. If a session is registered anyway, it counts and the verdict is recomputed.
- After 3 sessions without a pass the identity has failed. A new attempt needs a changed source
  identity or a new owner decision. A changed source identity starts a new count and needs its
  own calibration.
- Every final record lists all qualifying sessions in the registry, grouped by source identity,
  including those spent on earlier source identities. This contract does not limit the number
  of identities; the grouped list is what keeps repeated attempts visible.
- The result is always worded with its denominator: "passed, session k of n; j valid sessions
  failed; i invalid", where n is `started` and k is the position of the session whose close made
  the verdict `pass`. A `failed` or `undecided` verdict states the same four numbers.

## 9. Unchanged (and what a frozen exit 0 is)

The paired gate replaces only the timing predicate.

- Every structural V2 predicate is still evaluated by the unchanged frozen tool against the
  frozen budget on the candidate arm: when a session is verified, and again wherever the paired
  result is relied on. In `verifyCandidate` (`tools/art/animation-budget-v2.mjs:163-206`) only
  the timing comparison at `:187-191` is timing; everything else is structural: protected
  provenance, runtime dependency binding, completeness and per-sample qualification, contract
  version and producer contract, device, lineage and budget hash, not the reference report or
  source, protected source identities with the registered exceptions, GPU and renderer, view and
  pixel settings, ownership including `sourceCallbacks`, skeleton consolidation, warmed plateau
  and after-retirement resources. The command also re-checks the frozen files, every current
  source hash and the pixel files.
- `tools/art/animation-budget-v2.mjs`, the frozen reference, the frozen budget and every earlier
  failed result stay byte-identical. No earlier report becomes a pass.
- `applicableBudgetPass` of the frozen gate is reported as it is, whichever it is. It is never
  rewritten and is not required to be true on the paired route.

**Count of frozen evaluations.** For the candidate arm of every qualifying session the frozen
command's result is recorded: exit code, overrun count, capture time, host facts and evidence
hash. So a count of frozen evaluations exists whether or not one ever passes. The list also
holds the plan 07-13 evaluation that failed (exit 1, 40 of 192 over), and says whether that one
was made at the same source identity. Entries are numbered in time order, so each is "evaluation
k of n".

A frozen evaluation is one captured candidate report on which the frozen command was run;
running the command again on the same report adds nothing. The list is built by a scan, not
from memory: every complete candidate report in the phase evidence directory and in the
capture cache directory whose source identity equals the current one is listed, with the
frozen command's result for it, whether or not it belongs to a session. A frozen exit 0 on a
report that the scan does not find is not put forward.

A calibration session has no candidate arm, so it adds no frozen evaluation. Earlier frozen
failures on earlier source (among them 135 statistics over on 2026-10-07 and a structural
failure on 2026-10-09) are not in this list because they were made on different source; they
stay recorded where they are and are named whenever the count is put to the owner.

**A frozen exit 0 is not a pass by any tool.** The original frozen contract was a single
evaluation with no retry allowance, and one current-source evaluation has already failed it. An
exit 0 of the frozen command on a later capture is therefore "pass on evaluation k of n" against
a contract that had no n. Whether that qualifies is the owner's judgement alone. So:

- the tooling never treats it as a pass;
- it writes no frozen qualification;
- it does not change the frozen-envelope coverage row;
- it does not stop, skip, add or alter a paired session; the paired stop rule of section 8
  continues exactly as approved, and the paired result is the same with and without it;
- the fact is recorded with the full count and put to the owner.

Only an owner answer of `accept-frozen-pass`, recorded verbatim, may lead to a frozen-route
qualification. No agent, reviewer or tool may give that answer or authorise a frozen route.
Wherever such a result is stated it carries the words "evaluation k of n, on a prepared host".

## 10. What a pass means and does not mean (R1)

What a paired pass means, in the review's words:

> in one software-rendered session on this host, in the offline Training Range workload, the
> five owner files as they are now did not cost more than the same five files at the freeze,
> within 5% typically and 25% in any single profile for the frame interval, and within about one
> timer tick for the small script components; and every structural check of the frozen gate
> still passed.

Under section 8 the statement is made for the sessions the verdict counts, and it always carries
its denominator.

What a paired pass does not mean:

1. That the original fixed limits were met. The recorded frozen evaluations failed them (plan
   07-13: 40 of 192 over), and that stays recorded. A paired pass is never worded as meeting the
   original absolute limits.
2. Any frame-rate claim, any representative-device claim, or any human motion or quality
   acceptance. An agent's review is none of these either.
3. That Phase 7 as a whole did not add animation cost, or did not make the game slower. Cost
   that was present at the freeze, including the first-person view from plan 07-07, is in both
   arms and cancels. The first-person view cost is invisible to the paired predicate, and it is
   equally invisible to the frozen limits, which were also taken with that view present. Neither
   gate tells you what the view costs.
4. Anything about any file outside the five owner files. Their cost is identical in both arms.
5. Anything about online play, or about any workload other than offline Training Range with 1
   and 8 source actors.
6. That the current owner files are as fast as they have been. They are compared with the
   pre-tuning owner files, so a later slowdown smaller than the tuning gain passes.
7. That sub-millisecond components did not regress by less than one timer step plus tolerance.
8. That zero limits still hold exactly.
9. Anything about a real GPU or another host. The sessions are software-rendered on one desktop.
10. That any earlier failed report has become a pass, or that a smoke or a calibration session
    is a qualification.

## 11. Choices made here

Each item is a point where a review left the form open, or asked for a form, and this document
wrote one down. None is owner-approved: the owner approved the conditions R1 to R8 and the
numbers stated under "Status, sources and what is approved", and nothing in this section.
Items 1 to 13 are the forms plan 07-25 specified. Items 14 to 17 were not in that plan's list;
they were needed to make a rule above exact. Items 1, 2, 3, 5, 6, 9, 13, 16 and 17 were changed,
and items 18 to 20 added, to apply the required edits E1 to E9 of the V2 review; each says
which. The forms those edits ask for are the reviewer's, not the owner's, and are listed for
the repeated review like every other item.

1. **Aggregate: median over cell ratios (changed, E1).** Choice: the frozen contract's own
   `sorted[floor(n/2)]`, taken over cell ratios; a cell ratio is the mean of its two
   opposite-order profile ratios. For an even count `sorted[floor(n/2)]` is the upper middle
   value. Alternatives: the same median over the 12 profile ratios, which fails on an order
   effect above about 5%; the mean of the two middle profile ratios, which misses a regression
   between 5% and 10% confined to one cell. Can it change what passes: yes. When both runs of
   every cell have the same ratio, the choice gives exactly the result of the same median over
   the 12 profile ratios (the 7th of 12 is the 4th of 6 cells, the 4th of 6 the 2nd of 3, the
   3rd of 4 the larger of 2). When the two runs of a cell differ it judges their arithmetic
   mean, which is never below their geometric mean, so a second-capture slowdown `d` with no
   code difference leaves `d²/(2(1 + d))` on the strict side, not `d`. The form uses only the
   design (which runs share a cell) and is fixed before any paired data exists; no order effect
   is measured and subtracted, and the calibration tunes nothing. What it does not remove:
   noise that has nothing to do with order. A tier group has two cells, and its aggregate is
   the larger of the two cell ratios. In the V2 review's simulation of sessions with no code
   difference and no order effect, a per-capture ratio noise of 2% fails 0.2% of sessions per
   statistic, and a noise of 4% fails 23.1% (18.4% with the median over profile ratios). Those
   noise levels are assumptions: the noise of an adjacent pair on this host has never been
   measured. This is a stated limit of the strict per-tier reading, not a reason to change any
   number; the calibration is the test of it.
2. **Six groups and the minimum of 3 (note added, N-1).** Choice: rule 2 on all 12 profiles,
   each actor count and each tier, none excusing another; a group with fewer than 3 profiles
   having `r` greater than 0 has no aggregate and is `rule-1-only`. Alternative: all 12 only; or
   a different minimum (1, 2 or all 4); or failing a group that has too few. Can it change what
   passes: yes. More groups can only fail more sessions. The minimum decides whether a tier
   group with two usable profiles is judged by rule 2 or by rule 1 alone, and rule 1 alone is
   weaker. Note added (N-1): under item 1 a tier group has two cells and its aggregate is the
   larger of the two cell ratios; what noise alone then does to a session with no code
   difference is stated in item 1.
3. **Order rule (changed, E1).** Choice: run 1 by parity of tier index plus actor index, run 2
   the opposite; a recorded order that differs makes the session invalid. Alternative: random
   order per session; or the cell-level swap without the parity pattern. Can it change what
   passes: yes. It removes the confound with actor count and with tier. Together with the cell
   ratio of item 1 it cancels a second-capture slowdown to first order. A deviation from the
   scheme produces an invalid session and not a failed one.
4. **Warm-up discard.** Choice: one warm-up pair (run 1, Low, one actor, reference first),
   declared in advance, recorded, used by nothing. Alternative: no warm-up; or a different
   profile or order. Can it change what passes: yes, indirectly. It removes the session-start
   effect from the first measured pair; it is fixed in advance so that nothing is discarded
   after being seen.
5. **Validity criteria and their threshold (changed, E2).** Choice: incomplete, order,
   structure and binding make a session invalid, not failed; plus gross instability of the
   reference arm and agreement of the candidate-to-reference ratio between runs, both on the
   frame-interval median, both at `T_single`, both as "larger exceeds smaller times
   `(1 + T_single)`"; a frame-interval median that is not greater than 0 is also invalid. Added
   (E2): the five owner identities of every reference arm, in a calibration and in a qualifying
   session, must equal the SHA-256 values pinned in section 2; and a calibration runs the frozen
   command on neither arm and has no frozen result. Alternative: drop the instability check;
   another threshold; a difference relative to the mean; treating a structural failure as a
   failed session; no owner-identity check, which would leave nothing in the session record to
   show that a "reference" report came from the reference tree. Can it change what passes: yes.
   An invalid session decides nothing but uses one of the three, so a criterion that fires more
   often on sessions that would have failed than on sessions that would have passed helps a
   pass. The ratio-agreement check sees the square of a second-capture slowdown (section 5,
   check 6).
6. **Calibration (changed, E6).** Choice: reference against a second copy of the reference;
   exactly one per identity even after a crash; it gates qualifying sessions and does not count
   toward the cap. Added (E6): a calibration applies only to the bytes of the three tool files,
   the sampler identity and the browser version it ran with; a change to any of them after the
   calibration ends the paired route for that identity like a failed calibration. Alternative:
   allow a repeat after a crash; count it toward the cap; candidate against candidate; a
   calibration that stays in force when the tooling or the browser changes. Can it change what
   passes: yes. It can stop an identity before any qualifying session; it cannot make a
   qualifying session pass.
7. **Smoke.** Choice: no timing value written, printed or kept; at most one per identity unless
   the previous one failed structurally; refused once a calibration or qualifying event exists;
   never counts. Alternative: unlimited smokes; smokes that report timings. Can it change what
   passes: it must not. The limits exist so that a smoke cannot be used to look at candidate
   timing without spending a session.
8. **Materialising both arms.** Choice: both copied the same way from working-tree bytes into
   two cache directories; five files replaced in one; any other difference refused. Alternative:
   serve the candidate from the working tree and only the reference from a copy; or build the
   reference from git objects. Can it change what passes: yes, if the arms differed in anything
   else (path depth, configuration discovery, line endings of 82 files).
9. **Event-log chain, commit before capture, history (changed, E3 and E4).** Choice: append-only
   events chained by the hash of the previous event; registration committed before its capture;
   verdict refused on a broken chain or an uncommitted event. Added (E4): the started marker is
   a `started` event in the tracked registry file, appended before the first capture, and a
   nonce that has a `started` or `closed` event there, in the working tree or as committed, is
   refused a second capture. Added (E3): the verdict is also refused when any committed version
   of the registry file is not a prefix of the current event list, and when that history cannot
   be read in full (a shallow repository); a commit that holds a registration is never amended,
   squashed or rebased, and the final record names the commit id of every registration.
   Alternative: a plain list written after the run; a started marker kept in the session
   directory under the ignored cache, where deleting the directory removes the only trace; the
   chain without the history check. Can it change what passes: yes, by preventing a session
   from being dropped. The chain alone does not reveal removal of the newest events; the prefix
   check against every committed version covers that, and rewritten history is the residual.
10. **Counting from registration.** Choice: a session counts once registered; one never closed
    counts and is treated as invalid; one registration permits one capture; a capture refused
    because the source identity changed still counts. Alternative: count from the first capture;
    or from close. Can it change what passes: yes. Later counting would let a session be
    abandoned without cost.
11. **Early `failed`.** Choice: `failed` as soon as `passed + (3 - started)` is not greater than
    `failed`; `pass` as soon as `passed` is greater than `failed`. Alternative: always run three.
    Can it change what passes: the early `failed` cannot; it only stops sessions that could not
    change the result. The early `pass` after one valid pass is the review's rule 4.
12. **Listing sessions of earlier identities.** Choice: every final record lists all qualifying
    sessions in the registry by identity. Alternative: only the current identity's. Can it
    change what passes: no. It changes what is disclosed when a source identity has changed.
13. **A frozen exit 0 (changed, E7).** Choice: recorded with its evaluation count and put to the
    owner; never a pass by the tooling; never a reason to stop or change paired sessions; only
    the owner's recorded `accept-frozen-pass` can lead to a frozen-route qualification. Added
    (E7): the count is the scanned list of item 17, and a frozen exit 0 on a report that scan
    does not find is not put forward. Alternative: treat an exit 0 as the frozen gate passing.
    Can it change what passes: yes. The alternative would let the frozen route pass on a later
    evaluation of a contract that allowed one.
14. **Comparison allowance (not in the plan's list).** Choice: every comparison carries the
    frozen contract's `eps` of 1e-7 ms, and `r` at or below `eps` is 0. Alternative: compare the
    reported doubles literally. Can it change what passes: yes, in one direction and by at most
    1e-7 ms per comparison; the smallest step the timer reports is a million times larger. With
    literal comparison a one-step value at `r` equal to 0 would pass or fail according to its
    binary representation, which is not what the review describes ("with `r` = 0, rule 1 allows
    one tick"). If the reviewer finds the allowance exceeds the approval, the literal comparison
    is the fallback and that consequence goes to the owner.
15. **One nonce per session, generated at registration (not in the plan's list).** Choice: the
    nonce is created with the `registered` event and written into both arm reports by the one
    capture invocation. Alternative: a nonce created by the capture invocation itself. Can it
    change what passes: not by itself; it is what lets the registration be committed before the
    capture and tied to it.
16. **Source identity (not in the plan's list; changed, E6).** Choice: the hash of the canonical
    identity set of the candidate tree, the value the stable gates compare; tooling under
    `tools/art` is not part of it. Alternative: the commit id. Can it change what passes: yes.
    It decides when a new count of three and a new calibration begin. Because tooling is outside
    it, a change to the tooling does not start a new count of three; by item 6 it does end the
    use of the identity's calibration, and with it the paired route for that identity.
17. **Frozen evaluation list (not in the plan's list; changed, E7).** Choice: a frozen
    evaluation is one captured candidate report on which the frozen command was run. The list
    holds the plan 07-13 evaluation and every complete candidate report at the current source
    identity that a scan of the phase evidence directory and of the capture cache directory
    finds, whether or not it belongs to a session; earlier failures on earlier source are named
    beside it, not numbered in it. Alternative: the plan 07-13 evaluation and one entry per
    qualifying session only, which a single-arm capture made outside any session would escape;
    or number every frozen evaluation ever made. Can it change what passes: no paired result.
    It changes the n in "evaluation k of n" that the owner is shown, and keeps an evaluation
    made outside a session from being left out of it.
18. **No timing before close (added, E5).** Choice: while a calibration or qualifying session
    runs, no timing value, ratio or rule result is printed, logged or written; the reports are
    written once, after the last pair, and the `closed` event is appended before any timing is
    shown; an interrupted session leaves its registry events and no timing. Alternative: write
    or print values as each pair completes and rely on the rule that no session is stopped after
    a timing value has been seen. Can it change what passes: yes. An invalid session costs less
    than a failed one under the majority rule, so a session that could be watched and stopped
    would help a pass; with nothing visible the rule no longer rests on conduct alone.
19. **Same capture conditions across session kinds (added, E9).** Choice: a calibration and a
    qualifying session use the same context and page lifetime, launch flags and sampler
    arguments, and every session report records them. This contract does not say which lifetime
    that is; the implementation fixes one for all kinds. Alternative: identical between the two
    arms of one session only. Can it change what passes: yes. A calibration made under other
    conditions says nothing about the qualifying sessions it gates.
20. **Line endings of the hash-bound files (added, E8).** Choice: the three records, the
    registry file and the session evidence files are pinned to LF by exact path in the root
    `.gitattributes`; a registration made before those lines are committed is refused.
    Alternative: strip carriage returns in the tool before hashing; or leave the files without
    an attribute. Can it change what passes: not the outcome of a session that runs. It keeps a
    checkout from changing the bytes of a hash-bound file, which would make the tool refuse; a
    registered session whose run is refused still counts, and a calibration that cannot run
    ends the identity.

## 12. Not adopted, and available

- **O-1 is not adopted.** The review suggested building the reference owner files from the
  reconstructed frozen bytes and checking them against the frozen budget's own
  `referenceIdentities`. The owner approved `reference_commit: c973458`, so the reference owner
  files are the `c973458` blobs, verified by pinned blob id and SHA-256 (section 2).
- **O-2, O-3, O-4 and O-5 are adopted**: the warm-up pair (section 3), both arms materialised
  the same way (section 2), host facts before and after every session (section 8), and the
  smoke's assertion on the reference arm (section 8). They only make the arms more alike, record
  more, or assert more.
- **An available measurement that has not been run.** The review established a new fact: the
  exact frozen source can be rebuilt byte for byte (section 2 and the review's appendix), so a
  capture of the exact frozen tree on today's host is possible. It would show directly how much
  of the 40 overruns is the machine, without changing any contract. It has not been run, by the
  review, by this document or by any plan.
