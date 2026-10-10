---
phase: 07-movement-matched-and-action-safe-animation
plan: "15"
status: changes-required
reviewer_model: opus
reviewer_effort: high
proposal_sha256: 4ecad5a12772a5739012e1a2673fa1c596147e0c44be111183c0482a0e7663cd
reviewed: 2026-10-10T11:35:00Z
reviewed_head: 92c78079b4af8f24aae8e3e733b05c6f49bceda4
recommended_t_single: 0.25
recommended_t_aggregate: 0.05
recommended_session_cap: 3
findings_blocker: 0
findings_required: 8
findings_optional: 5
---

# Plan 07-15 task 1: independent review of the paired same-session timing proposal

Reviewer: an independent reviewer agent (model `opus`, dispatched at effort `high`). I did not
write the proposal (`91d4153`) and did not edit it. Its bytes on disk hash to the value in the
frontmatter, equal the `HEAD` blob, and `git status --short` does not list it. Read-only: this
file is the only one I created; nothing was committed; no browser, capture or suite was run.

The plan says the review opens with "not needed" when the frozen gate passed. It did not:
`evidence/07-13-v2-requalification.json` has `routing: numeric-only-fail`, structural pass,
40 of 192 statistics over. So the amendment is the open question it claims to be.

## Verdict

`changes-required`. No blocker.

| Blocker condition | Result | Why |
|---|---|---|
| The predicate cannot detect the class of regression the gate exists for | not met | It can detect a cost increase in the five owner files made after the freeze, which is what the frozen V2 gate also measures. It is less sensitive than the frozen limits, and it does not measure what the proposal's "Why" says it measures (question 2, R1) |
| The reference arm cannot be built soundly | not met | It can, and more exactly than the proposal believes: the frozen reference source turns out to be fully reconstructible (questions 1 and 1b) |
| Approval would let an earlier failed report become a pass | not met as written | The proposal forbids it; the enforcement is not specified and the planned control list has a gap (question 4, R7) |

Eight changes are required before this should be approved. They change the text of the
proposal and the rules it states; none needs new measurement before the owner decides, except
that I recommend the owner make one calibration session a condition of approval (R5).

## 1. Reference arm

Blob ids, from `git rev-parse c973458:<path>`:

| Owner | Blob at `c973458` |
|---|---|
| `src/builders/characterResources.js` | `37b3399325545d894e2a3578f3970fb58f9c1a3f` |
| `src/builders/enemyGLTF.js` | `a45770f1db9b49af1254e29aadcad8d299f9662d` |
| `src/builders/firstPersonRig.js` | `3835cc290d54ddeceeb2e3d65a3cf861aed1880a` |
| `src/builders/enemyAnimations.js` | `56eecc0a3a455747ae8881b7827cfa28f8f11281` |
| `src/builders/weaponHandling.js` | `a949f7cc8b4697c8063dc5659245686c6cb9dc4f` |

**Can those five run against every other file at the candidate commit?** By static evidence
yes; it has never been executed, and the first paired smoke has to show it.

- Between `c973458` and `HEAD`, outside the five owners, exactly four served or hashed files
  changed: `public/models/enemy.glb` (CR-02), `tools/art/motion-manifest.json` (one line,
  `sourceHash`), `src/main.js` (the plan 07-21 press guard) and `src/builders/enemyGLTF.test.js`
  (not runtime). Every other file under `src/`, `index.html` and `style.css` is unchanged.
- Imports and exports. The five owners' export sets at `c973458` and `HEAD` differ only by two
  names added later, `consolidateCharacterSkeletons` and `isCharacterDisposed`, and both are
  imported only by other owners (`enemyGLTF.js`, `weaponHandling.js`), which the arm replaces
  together. No file outside the five imports either name. I checked every relative import in
  the mixed tree (119 files, 479 edges, 950 imported names) with `es-module-lexer`: the result
  is identical to the same check on the working tree (the 62 lines both report are the lexer
  missing multi-name `export const a, b` declarations in `config.js`, `input.js` and one map
  file; none involves an owner).
- The sampler reaches the owners through 18 members (`tools/art/review.mjs:422-426` and the
  body of the sample function); all 18 are exported at `c973458`, and the call shape of
  `updateFirstPersonRig` is unchanged. The sampler function itself is the one the frozen
  reference was captured with (same `captureSampler` identity).
- Corrected CR-02 tuple. `9ce341b` changed the GLB, one manifest line, the unit test and
  tooling, and none of the five owners. The owners' later changes (`d30da22`, `2a5b7ef`,
  `f89d820`, `d7812cb`, `2c9330b`) are skeleton consolidation, lookup caches, a diagnostic
  logger and the lazy retirement check; none touches how clips or the manifest are read. So
  nothing in the corrected tuple needs a post-freeze owner.
- `motion-acceptance.json` and `enemyGLTF.test.js`: no owner imports either. They matter to
  identities and unit tests, not to the page.
- Not demonstrated: the combination "owners from `c973458` with the corrected GLB" has never
  run. The drift note's near-reference arm used the original tuple
  (`07-09-HOST-DRIFT.md:18-21`), and every capture since CR-02 used later owners.

**How the arm differs from the tree that produced the frozen reference.** Much less than the
proposal says. I compared all 127 frozen file identities with `c973458`:

| Frozen identity is reproduced by | Files |
|---|---|
| the `c973458` blob as stored (LF) | 42, including `firstPersonRig.js` and `weaponHandling.js` |
| the `c973458` blob with every line ending as CR LF | 57 |
| the plan 07-21 preserved copy, whose content equals the `c973458` blob once carriage returns are removed | 25 |
| the `c973458` blob with a specific mix of line endings that I found by search and verified by hash | 3: `characterResources.js`, `enemyGLTF.js`, `enemyAnimations.js` |

So the commit `c973458` holds exactly the content the reference was captured from, for all 127
files; only line endings differ. The three owners the drift note calls unrecoverable
(`07-09-HOST-DRIFT.md:23-25`) are recoverable: the appendix gives the line ranges, and each
rebuilt file hashes to its frozen identity. The proposal's sentence "A byte-exact reference of
the uncommitted working tree ... cannot be rebuilt" (proposal lines 33-34) is therefore no
longer true, and decision 3 ("in place of the unrecoverable byte-exact one", line 98) rests on
it (R2).

What remains different between the proposed arm and the capture tree is deliberate: the arm
takes the candidate's GLB, manifest line, `src/main.js` and unit test, so that only the owners
differ between arms.

## 1b. Arm bytes

- Identical outside the owners: yes, by construction. Plan 07-16 copies the working-tree bytes
  that serve the candidate arm, then overwrites exactly five files and refuses any other
  difference (`07-16-PLAN.md:112`). Copying is the right choice; an archive would differ from
  the working tree for 82 files.
- The owners' bytes. The five `c973458` blobs contain no carriage return. The reference was
  captured from: the same bytes for `firstPersonRig.js` and `weaponHandling.js`; the same
  content with mixed line endings for the other three (18 of 66, 437 of 523 and 413 of 640
  lines ending CR LF). The candidate arm's owners are whatever the working tree holds (three
  mixed, two LF).
- Can that affect the comparison? No, only the identities. A CR LF inside a template literal is
  read as LF by the language, string literals cannot span lines, and the size difference is a
  few hundred bytes of parse input before any timed frame.
- "Git-defined reference arm": the phrase no longer describes the plan. Only the five owners
  come from git objects; everything else is working-tree bytes that for 82 files no git object
  reproduces. The proposal's "every file at the candidate commit" (line 36) and the decision
  wording must say so (R2).
- A stronger binding is available: since the frozen bytes of all five owners can be rebuilt,
  the arm can use them and be checked against the `referenceIdentities` already inside the
  frozen budget, instead of five new hashes pinned in code (O-1).

## 2. Predicate

**What it measures.** Both arms share every file except the five owners, and the reference
owners are the freeze-time ones. So the predicate answers one question: did the edits made to
those five files after `c973458` add cost. It does not answer the question in the proposal's
"Why" (lines 13-15), "did the Phase 7 runtime changes make animation cost worse?":

- Phase 7 cost that existed at the freeze is in both arms. `firstPersonRig.js` was added by
  `1ccde8c` (plan 07-07, 2026-10-06 12:36) and changed by `b1e2801`, `aaea52d` and `948657c`,
  all ancestors of `c973458`. Every one of the 12 profiles builds and draws a first-person view
  on the first source actor (`tools/art/review.mjs:488`; the candidate report has
  `viewEvidence.attached: true` with arms, body and weapon draws in sample 0; the frozen budget
  lists 131 view geometries as a structural addition). The reference arm carries that view.
- So the cost reported by plan 07-24 (first-person view meshes, about 25 to 30 percent of
  frame rate under software rendering in one session, `07-24-SUMMARY.md:70`) cannot be detected
  by this predicate in any profile: it is present, at full size, in both arms. The frozen V2
  limits cannot see it either, for the same reason: the frozen reference was captured with the
  view attached. The only record that compared against a state without the view is the
  original budget, which stays `legacyBudgetPass: false` and not comparable
  (`07-BUDGET-AMENDMENT.md:5`, `:9`).
- A change made after the freeze to the view's cost would be seen, if it is large enough.
- Cost in any file outside the five owners is identical in both arms and invisible.
- The capture is offline Training Range with 1 and 8 source actors in three tiers. It is not
  the online state in which plan 07-24 made its observation.

This is the same class the frozen gate measures (post-freeze tuning against the freeze-time
reference, `07-BUDGET-AMENDMENT.md:13-17`), so it is not a blocker. It is a wording defect that
would mislead the owner, and the plan's own checkpoint repeats it (`07-15-PLAN.md:120`) (R1).

**Sensitivity of rules 1 and 2 with `q = 0.1` ms.** All timing values in the candidate are
multiples of 0.1 ms. What each rule tolerates depends on the size of the reference value:

| Reference value `r` | Rule 1 allows `c` up to | Rule 2 allows the typical `c` up to |
|---|---|---|
| 0 | 0.1 ms | not applied |
| 0.1 ms | 0.225 (+125%) | 0.205 (+105%) |
| 0.3 ms | 0.475 (+58%) | 0.415 (+38%) |
| 0.5 ms | 0.725 (+45%) | 0.625 (+25%) |
| 1 ms | 1.35 (+35%) | 1.15 (+15%) |
| 2 ms | 2.6 (+30%) | 2.2 (+10%) |
| 250 ms | 312.6 (+25%) | 262.6 (+5%) |

Typical sizes in the 07-13 candidate (smallest, middle, largest median over the 12 profiles):
frame interval 209, 301, 429 ms; correction 0.7, 1.6, 2.6; render 0.7, 1.85, 4.7; core
correction 0.3, 1.0, 1.9; selection 0.1, 0.2, 0.4; view 0.4 in every profile; mixer 0 to 0.1;
inertia 0 everywhere. So the stated 5% and 25% apply only to the frame interval. For the
components that measure the owners' own script work the effective tolerance is 10% to over
100%. That is the timer's resolution, not a design error, but the proposal's tolerance table
does not say it (R8).

**Behaviour at `r = 0` and within one tick.** With `r = 0`, rule 1 allows one tick and rule 2
is skipped. The frozen contract treats a zero limit as binding with epsilon `1e-7`
(`tools/art/animation-budget-v2.mjs:64`, `:189`); the proposal loosens that to one tick without
saying so. Inertia is 0 in all 12 profiles and the mixer median in 6, so for inertia rule 2 has
nothing to take a median of, and for the mixer it has 6 values. The proposal does not say what
happens when few or no profiles remain (R3, R8).

**False pass.**
- A regression confined to part of the matrix. A 20% increase in up to 5 of the 12 profiles
  leaves the median of 12 at 1.00, and rule 1 does not catch 20%. In 6 of 12 (one actor count)
  the result depends on which "median" is meant: lower middle 1.00 passes, mean of the two
  middle values 1.10 fails, upper middle 1.20 fails. The proposal does not define it; the frozen
  contract's own median is the upper middle (`animation-budget-v2.mjs:41`). The earlier, approved
  amendment says "an eight-actor improvement cannot excuse a failed one-actor profile"
  (`07-BUDGET-AMENDMENT.md:17`). A median across both actor counts can do exactly that (R3).
- A uniform regression. Detected by rule 2 on the frame interval once it clearly exceeds 5%
  plus noise; at 5% it is a coin toss. The noise of a back-to-back pair on this host is not
  known (see below).
- A noisy reference capture of one profile raises `r` and hides a candidate overrun there.
  Rule 3 does not look for that.

**False fail.** Existing same-source data, used as a stand-in: run 1 against run 2 of the
frozen reference and of the 07-13 candidate (each 6 cells, about 8 minutes apart, not back to
back).
- Frame-interval run 2 over run 1: reference 0.995 to 1.093; candidate 1.003 to 1.133. In both
  sessions the largest value is the first profile of the session (Low, one actor).
- Rule 1 at 25% applied to those pairs in both directions: 1 violation in 384 comparisons
  (render p95, Medium, one actor: 2.0 ms against 2.9 ms). A paired session makes 192 such
  comparisons, so the point estimate for "a session with no code difference fails rule 1" is of
  the order of 40%, with an interval too wide to rely on (one event).
- Rule 2 at 5% over the 6 cells: held in all 64 same-source checks.
- So 25% and 5% are in a plausible range and are not shown to work for pairs. The 25% rests on
  three smoke runs of one profile (proposal line 69). If the true false-fail rate is anywhere
  near the point estimate, the retry rule becomes the mechanism that produces a pass (question 3).

**Capture order.** Profiles are captured in the order run, tier, actor count
(`tools/art/review.mjs:710`, `:729-730`): 1 Low/1, 2 Low/8, 3 Medium/1, ... 12 run 2 High/8.
"Reference first on odd profiles, candidate first on even" (proposal lines 48-49) therefore
puts the reference first in every one-actor profile and the candidate first in every
eight-actor profile, in both runs. Order is completely confounded with actor count. If the
second capture of a pair is slower by `d` with no code difference, six ratios sit near `1 + d`
and six near `1 / (1 + d)`, and the median of 12 is 0.95, 1.00 or 1.05 at `d = 5%` depending on
the definition (0.91, 1.00, 1.10 at 10%). With the frozen contract's upper-middle median an
order effect above 5% fails every session; with the lower middle it hides a real uniform
regression of about `d + 5%`. Whether such an order effect exists for adjacent captures was
never measured; the session-start effect above (9% and 13%) says it cannot be assumed away (R4).

**Rule 3.** It does not detect the drift the note recorded. In the 2026-10-09 recapture run 2
was slower than run 1 in every profile (`07-09-HOST-DRIFT.md:101-110`): 13.5%, 10.9%, 0.4%,
3.3%, 4.2% and 32%. At 25% only the last trips the rule. On the frozen reference and the 07-13
candidate the largest differences are 9.3% and 13.3%, so both sessions count as valid. And
slow drift between runs is the thing pairing is designed to absorb, so the one case the rule
does catch is a session the design should have tolerated. It looks at one arm, one component
and one statistic, and cannot see a disturbance that hit one arm of one pair (R5).

**Are 25% and 5% defensible?** As upper bounds, yes; I would not loosen either. As proven
values, no. I recommend the owner approve them only together with the structural changes
R3 to R5.

## 3. Retry rule

Unlimited repeats are selection. If one session passes by chance with probability `p`, the
chance that at least one of `N` does is `1 - (1 - p)^N`: with `p = 0.3`, 51% after two, 66%
after three, 83% after five. The proposal keeps every report (lines 71-73), which makes the
selection visible but does not prevent it. This phase has already needed four single-shot
tracer attempts before one passed, each stopped by a different real defect, so repeats will
happen; the rule has to say what they mean.

Recommended cap: **3** sessions per candidate source identity. Recommended rules:

1. Every started session counts toward the 3, whatever its outcome: pass, fail, invalid,
   aborted, crashed.
2. A session is registered before it runs (index, start time, candidate commit, host state) in
   a tracked file, and its reports and hashes are kept whatever happens. No session is stopped
   or discarded after any timing value has been seen.
3. Validity is decided by the tool from fixed criteria before the timing predicate is
   evaluated. Nobody reclassifies a session afterwards.
4. Result for that source identity: pass only if more valid sessions passed than failed and at
   least one is valid. One valid pass alone is a pass; one pass and one fail is not, and needs
   the third; an invalid session decides nothing. This is never more permissive than best-of-N
   and is stricter than a single try whenever a chance pass is less likely than not.
5. After 3 sessions without a pass the identity has failed. A new attempt needs a changed
   source identity or a new owner decision, and the final record lists the earlier sessions.
6. The result is always worded with its denominator: "passed, session k of n; j valid sessions
   failed; i invalid".

## 4. Unchanged predicates

From `tools/art/animation-budget-v2.mjs:163-206`, everything except five lines is structural
and would stay evaluated against the frozen budget:

- protected provenance identity (`:164-165`); runtime dependency binding (`:166`);
- completeness and per-sample qualification through `qualify` (`:167`, `:88-126`): 12 profiles,
  214 frames, view attached, resource samples, plateau, retirement counts, pixel frames;
- contract version, originals and producer contract (`:168-171`); device (`:172`); lineage and
  budget hash (`:173`); not the reference report, captured later than it, not the reference
  source (`:174-176`);
- protected source identities with the registered exceptions (`:177-180`);
- per sample: GPU and renderer, view and pixel settings (`:184-186`); ownership including
  `sourceCallbacks`, skeleton consolidation (`:192-194`); warmed plateau and after-retirement
  resources (`:195-201`).

Timing is `:187-191` only, and it feeds `applicableBudgetPass` (`:204`), which sets the exit
code (`:264`). The command also re-checks the frozen files, every current source hash and the
pixel files (`:231-237`, `:261-263`). Plan 07-16 runs that command unchanged on the candidate
arm and reads its JSON (`07-16-PLAN.md:163`), which keeps all of the above. The reference arm
cannot pass `verifyCandidate` by design (it has 51 skeletons per actor and five different
identities), so it gets `qualify`, the producer contract and identity equality outside the
owners only. That is acceptable, and the proposal's "does not change" list (lines 21-26)
matches the code.

Could an earlier report become a pass? Not through the frozen gate: its files and code are
untouched, and `requirePlan09` still requires `applicableBudgetPass === true` for the frozen
route (`tools/art/animation-capture.mjs:231`). Through the paired route, the proposal says no
(lines 28-29, 72-73) but does not say how. Plan 07-16's control rejects an arm whose hash
equals the frozen reference report, an earlier session's arm or the other arm
(`07-16-PLAN.md:154`). A single-arm V2 candidate that already exists and already passes every
structural check at current source, `evidence/07-13-cost-candidate.json`, is none of those. A
hand-assembled session naming it as the candidate arm beside a freshly captured, slow
reference arm would be exactly an earlier failed report becoming a pass. The rule has to bind
both arms to one invocation (R7).

## 5. Wording

The "would mean" sentence (lines 77-79) is accurate and narrow. The "would not mean" list
(lines 81-82) is correct but not sufficient. It should also say that a pass would not mean:

- that Phase 7 as a whole did not add animation cost: cost present at the freeze, including the
  first-person view from plan 07-07, and cost in any file outside the five owners, is in both
  arms;
- anything about online play or any workload other than offline Training Range with 1 and 8
  source actors;
- that the current owners are as fast as they have been: they are compared with the
  pre-tuning owners, so a later slowdown smaller than the tuning gain passes;
- that sub-millisecond components did not regress by less than one timer tick plus tolerance;
- that zero limits still hold exactly.

A paired pass is never worded as meeting the original absolute limits: the proposal says so
(line 82) and plan 07-16 keeps `frozenApplicableBudgetPass` as its own field
(`07-16-PLAN.md:163`, `:265`). The one place that overstates is the "Why" paragraph, with the
checkpoint text that copies it (R1).

## Findings

Required before approval:

| id | severity | evidence | required change |
|---|---|---|---|
| R1 | required | Proposal lines 13-15; `07-15-PLAN.md:120`; `firstPersonRig.js` added by `1ccde8c`, an ancestor of `c973458`; `tools/art/review.mjs:488` | State what is measured: the effect of edits to the five owner files after `c973458`, in offline Training Range. Remove "did the Phase 7 runtime changes make animation cost worse" as the question answered. Add the five "would not mean" items from question 5. |
| R2 | required | Proposal lines 33-43, 98; `07-16-PLAN.md:112`; the identity table in question 1 and the appendix | Replace "cannot be rebuilt" and "unrecoverable" with the facts: `c973458` holds the capture's content for all 127 files and the frozen bytes are reproducible. Describe the arm as working-tree bytes plus five owners from `c973458`, not "every file at the candidate commit" from git objects. Reword decision 3 accordingly. |
| R3 | required | Proposal lines 58-59; `07-BUDGET-AMENDMENT.md:17`; `animation-budget-v2.mjs:41`; the 20%-in-k-profiles table in question 2 | Define the aggregate exactly (which middle value, or a mean). Apply it separately to each actor count and each tier as well as to all 12, so that one group cannot excuse another. State the minimum number of profiles with `r > 0` and what happens below it. |
| R4 | required | Proposal lines 47-50; capture order at `review.mjs:710`, `:729-730` | Balance order inside every tier and actor count: the cell that is reference-first in run 1 is candidate-first in run 2. Odd/even by profile number is confounded with actor count. |
| R5 | required | Proposal lines 60-62, 68-69; `07-09-HOST-DRIFT.md:101-110`; one rule-1 violation in 384 same-source comparisons | Add a same-arm control: one calibration session of the reference arm against itself under the same order scheme, recorded, before any qualifying session; the tolerances stand only if that session passes rules 1 and 2. Either drop rule 3 or state its purpose as a gross-instability check and add a check that the candidate-to-reference ratio of a cell agrees between its two runs. |
| R6 | required | Proposal lines 71-73 | Replace "may be repeated" with a cap of 3 sessions per source identity and rules 1 to 6 of question 3. |
| R7 | required | Proposal lines 28-29, 86-88; `07-16-PLAN.md:154`; `evidence/07-13-cost-candidate.json` | Require both arm reports to carry a nonce written by the one invocation, with per-profile start and end times showing the interleaving, and reject any arm report created outside that invocation, including any existing single-arm V2 candidate. |
| R8 | required | Tolerance table in question 2; `animation-budget-v2.mjs:64` | State in the tolerance section that 5% and 25% are effective only for the frame interval, give the effective bounds for sub-millisecond components, and state that zero limits are loosened from exact to one tick. |

Optional improvements:

| id | evidence | suggestion |
|---|---|---|
| O-1 | Appendix | Build the reference owners from the reconstructed frozen bytes and check them against the frozen budget's own `referenceIdentities`, so no new hash has to be trusted. |
| O-2 | Run 2 over run 1 is largest in the first profile of both existing sessions (1.093, 1.133) | Capture and discard one warm-up pair at session start. |
| O-3 | `07-16-PLAN.md:112`, `:115` | Materialise both arms the same way (two cache directories, same server configuration), so the arms differ in nothing but the five files, including path depth and config discovery. |
| O-4 | `07-09-HOST-DRIFT.md:27-28`; `07-13-v2-requalification.json` `host` | Record power plan, running heavy applications and CPU load before and after every session, as plan 07-13 did. |
| O-5 | Question 1, "not demonstrated" | Make the first smoke pair assert that the reference arm with the corrected GLB loads with no page error and passes `qualify`. |

## What the owner is being asked to accept

In plain words. Today the gate compares a capture against fixed millisecond limits taken from
one capture on 2026-10-06. On this desktop those limits fail for the old code and the new code
alike, by similar margins, so they measure the machine as much as the code. The proposal
replaces the fixed limits with a comparison made inside one session: the same game with five
animation files as they were on 2026-10-06, and the same game with those five files as they
are now, captured alternately.

Recommended numbers, if you approve: `T_single` **0.25**, `T_aggregate` **0.05**, session cap
**3**. I recommend approving them only with the eight required changes, and treating the two
tolerances as ceilings that are never raised after any candidate data has been seen.

What a pass would mean: in one software-rendered session on this host, in the offline Training
Range workload, the five owner files as they are now did not cost more than the same five
files at the freeze, within 5% typically and 25% in any single profile for the frame interval,
and within about one timer tick for the small script components; and every structural check
of the frozen gate still passed.

What a pass would not mean:
- that the original fixed limits were met. They were not, and that stays recorded.
- any frame-rate, device or human-quality claim.
- that Phase 7 did not make the game slower. Everything Phase 7 added before the freeze,
  including the first-person view that one session measured at about a quarter of the frame
  rate under software rendering, is in both halves of the comparison and cancels out. The same
  is true of the fixed limits you would be replacing: they were also taken with that view
  already present. Neither gate tells you what the view costs.
- anything about online play.

Changes the proposal needs before it could be approved (R1 to R8, in short): say honestly what
is measured; correct the claim that the reference cannot be rebuilt, and describe the arm as
it will actually be built; apply the 5% rule per actor count and per tier with a defined
median; balance capture order inside each cell; run one same-against-same calibration session
first; cap sessions at 3 with a majority rule and full disclosure; bind both arm reports to
one invocation; state the real tolerance for the small components.

Optional, and not a condition: O-1 to O-5 above.

If you prefer not to change the contract, rejecting leaves the fixed limits as the only gate,
and they currently fail. One new fact may matter to that choice: because the frozen source can
now be rebuilt byte for byte, a capture of the exact frozen tree on today's host is possible.
That would show directly how much of the 40 overruns is the machine, without changing any
contract. It has not been run.

Not mine to decide, and listed only so nothing is lost: the checkpoint also asks you to
confirm the plan 07-21 option and the `enemyGLTF.test.js` exception.

## What I ran

At `92c7807`, Node v24.19.0, git 2.39.1.windows.1; scripts in the session scratch directory.

- `sha256sum` of the proposal against its `HEAD` blob; `git status --short`.
- `git rev-parse c973458:<path>` for the five owners; `git diff --stat c973458..HEAD` for the
  owners and for everything else the arms serve; history of `firstPersonRig.js`; commit times
  around the reference capture (captured 2026-10-06T16:37:49Z; `c973458` committed 20:16Z; the
  last commit touching any owner before the capture was `948657c` at 15:29Z).
- `refarm.mjs`: all 127 frozen identities against `c973458` blobs in LF and CR LF form and
  against the plan 07-21 preserved copies.
- `reconstruct.mjs`, `runs.mjs`, `groups.mjs`, `patterns.mjs`: search for the line-ending
  pattern of the three remaining owners; each result re-verified from the printed ranges alone.
  `brute.mjs` (about 18 million patterns of up to six runs) found nothing for
  `characterResources.js`; the pattern was found as the working copy's pattern with three
  lines flipped.
- `mixed.mjs`: import and export check of the mixed tree against the working tree.
- `noise.mjs`: the proposed rules applied to run 1 against run 2 of the frozen reference and
  of the 07-13 candidate; tolerated-change, order-effect and partial-regression tables.
- Read: the proposal, `07-09-HOST-DRIFT.md`, `07-BUDGET-AMENDMENT.md`,
  `07-BUDGET-CONTRACT-REVIEW.md`, `07-09-OWNER-SCOPE-REVIEW.md`, `07-13-GUARD-REVIEW.md` (my
  own), `07-15-PLAN.md`, `07-16-PLAN.md` task 1 and 2, `07-24-SUMMARY.md` line 70,
  `evidence/07-13-v2-requalification.json`, `evidence/07-13-cost-candidate.json`,
  `tools/art/animation-budget-v2.mjs`, `tools/art/animation-capture.mjs` (`requirePlan09`,
  `executeV2`), `tools/art/review.mjs` (capture and sample functions).

## What I could not verify

- That the mixed tree runs. No browser was started. The evidence is static: imports, exports,
  sampler members and the nature of the later owner changes.
- The noise of a back-to-back pair on this host, and whether the second capture of a pair is
  systematically slower. No paired data exists. The same-source figures are from runs about 8
  minutes apart and stand in for it.
- The plan 07-24 figure. It is one debug session, recorded by its authors as an unverified
  hypothesis about the 07-13 failure.
- Any behaviour on a real GPU or another host.
- My own effort setting; the frontmatter records what the review was dispatched with.

## Appendix: rebuilding the frozen bytes of the three mixed-ending owners

Take the file from `git cat-file blob c973458:<path>` (LF throughout), end the listed lines
with LF and every other line with CR LF. The result hashes to the frozen identity. Line numbers
are 1-based.

| File | Lines | Lines ending LF | Bytes | SHA-256 (the frozen identity) |
|---|---|---|---|---|
| `src/builders/characterResources.js` | 66 | 6-26, 28, 32-44, 54-66 | 2966 | `65b87606cfa1d3d6ec42230c964c39b1625ac2e1235297095d0fdb705facd891` |
| `src/builders/enemyGLTF.js` | 523 | 22-25, 35-36, 67, 70-72, 76-89, 93-95, 124, 293-306, 317-318, 368-369, 372, 375, 379-384, 436-437, 447-450, 469, 473-475, 494-498, 507-523 | 25190 | `1b9b552a3199316011947e53c70c715cf040d18c0ddb9dabe1ec83effc4c1dac` |
| `src/builders/enemyAnimations.js` | 640 | 2-5, 123, 134-135, 270, 275-282, 349-535, 617-640 | 31005 | `55082b4800699919f31e13c8d2b2d6e97f6c4eb52dedbd1b0eb333faa46239e4` |

`firstPersonRig.js` and `weaponHandling.js` need nothing: their `c973458` blobs already hash to
the frozen identities (`d98f3243...8405` and `15a060ee...17ea`). The other 122 files come from
the `c973458` blob as stored (40), the same blob with CR LF throughout (57), or the plan 07-21
preserved copy (25). The original motion tuple the frozen reference used is in git history by
blob id (`tools/art/motion-promotion.test.mjs:210-211`).
