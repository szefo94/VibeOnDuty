---
route: source-fix
decided: 2026-10-10
decided_by: owner
evidence: ".planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-14-mp-ab.json sha256=26dc71019aee287a016cb973f3534a8e4aa82e39b36846c020340364714ce130"
host_ready: none
fix_plan: 07-24
---

# 07-14 production multiplayer gate: route decision

## Selection basis (read this first)

The owner chose the route by reference to the orchestrator's recommendation. The owner did not type the token `source-fix`. The orchestrator had presented the three routes (`host-rerun`, `source-fix`, `keep-open`) with the measured table, stated its recommendation as `source-fix`, and asked for a `host_ready` date-time, saying `none` was a valid answer. The owner gave no `host_ready` time, so none is recorded.

Owner's reply, verbatim:

> for now, go with recommended route and try to continue 07, if sometihng needs to be done first, please do

Recorded route: `source-fix` (the orchestrator's stated recommendation, which the owner selected as "the recommended route"). `host_ready: none` is the absence of a stated time, not an owner statement that the machine is unprepared. `fix_plan: 07-24` names the gap plan the orchestrator is having written next; it does not exist on disk yet and is a plan to be created, not an existing or completed one.

## Evidence

`evidence/07-14-mp-ab.json`, SHA-256 `26dc71019aee287a016cb973f3534a8e4aa82e39b36846c020340364714ce130` (file as committed at `ba82fdc`). Harness controls passed for `aed271f`, `e0f78d7`, `b1e2801` and `336099e`. Limits unchanged (`limitsChanged: false`: pending queue 8, receipt age 500 ms, acknowledgement age 15 ticks).

### Verdict table (3 runs per arm; candidate passes / reference passes)

| Case (sampled) | Reference | Candidate | Reference passes | Verdict |
|---|---|---|---|---|
| tracer: two browsers join and move | aed271f | 3/3 | 3/3 | not-reproduced |
| movement: real sprint jump crouch ADS | aed271f | 3/3 | 3/3 | not-reproduced |
| combat: real M4 cover, ammo, reload | aed271f | 3/3 | 3/3 | not-reproduced |
| authority: real M4 ... after forged | aed271f | 3/3 | 3/3 | not-reproduced |
| two browsers complete time-limit results | aed271f | 0/3 | 3/3 | **source** |
| two browsers complete score-limit results | aed271f | 3/3 | 3/3 | not-reproduced |
| entry: assets gate online join | aed271f | 3/3 | 3/3 | not-reproduced |
| animation retirement: two real M4 clients ... fresh life | e0f78d7 | 3/3 | 3/3 | not-reproduced |

### The 12 failing titles of 2026-10-07

| Result | Count | Titles |
|---|---|---|
| source | 1 | lifecycle: two browsers complete time-limit results and automatic same-settings rematch |
| not-reproduced | 7 | tracer; movement; combat; authority (forged offline outcomes); entry; resources/lifecycle score-limit; animation retirement |
| no-reference | 3 | two `animation authority:` cases and the `animation authority: feedback:` variant (no pre-Phase-7 counterpart) |
| excluded | 1 | hosting: two production browsers share HTTPS assets and the same WSS room (single ECONNRESET; passed in focused follow-up; reference predates `ca766af`; judged by plan 07-17) |

No `host` verdict was issued for a source reference whose control passed. Narrowing probes (time-limit case): `336099e` reference 3/3 pass, `b1e2801` 0/3, `e0f78d7` 0/3.

### Narrowed commit pair

`lastPassing` = `336099e` (07-06), `firstFailing` = `b1e2801` (07-07); adjacent in the plan's ordered list. `git diff --stat 336099e b1e2801 -- src server` covers seven files and no server or network file:

| File | Class under the frozen V2 timing gate |
|---|---|
| `src/builders/characterResources.js` | mutable (`MUTABLE_RUNTIME` in `tools/art/animation-budget-v2.mjs`) |
| `src/builders/enemyGLTF.js` | mutable |
| `src/builders/firstPersonRig.js` | mutable |
| `src/builders/weaponHandling.js` | mutable |
| `src/combat/shoot.js` | frozen V2 reference identity (in `referenceIdentities` of `evidence/07-budget-view-v2.json`, not mutable) |
| `src/loop.js` | frozen V2 reference identity |
| `src/builders/firstPersonRig.test.js` | a test file; also listed in `referenceIdentities`, and not in `MUTABLE_RUNTIME`, so a change to it is also an identity change unless excepted |

`src/builders/enemyAnimations.js` is mutable but is not in the narrowed diff. The 07-07 range also added `tests/first-person-rig.spec.js` (outside `src/`).

## Confidence limits

Low to moderate. Three runs per arm; each case ran in isolation, whereas the 2026-10-07 failures came from one full 17-case run; one host condition. The full 17-case suite was not run in this plan. Candidate first errors varied (`TypeError: Cannot read properties of null (reading 'x')` twice, `TimeoutError: locator.click` once), so the narrowed commit pair identifies where the time-limit lifecycle case started failing, not the mechanism.

## Consequence of `source-fix`

- A new gap plan (`07-24`, to be written by the orchestrator) is required before plan 07-17. It must write a failing regression first.
- Any `src/` change invalidates the plan 07-13 candidate, so the timing gate is captured again in plan 07-18.
- `src/combat/shoot.js` and `src/loop.js` are frozen V2 reference identities: a change to either needs a reviewed, registered exact-hash exception, as `src/main.js` received. The four builder files named above are in the gate's mutable set. `firstPersonRig.test.js` is a test file that is nonetheless a listed reference identity.
- Server authority limits must not be relaxed to make a case pass; no `src/shared/` or `server/` change is indicated by this evidence.
- Because `host_ready` is `none`, plans 07-17, 07-18 and 07-19 will stop at their readiness precondition until the owner states a date-time at which the machine is prepared for heavy runs. An agent never writes that time.
- The multiplayer gate is still failed. ANIM-03 is not met.
