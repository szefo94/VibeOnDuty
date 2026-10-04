---
phase: 01-two-client-authoritative-tdm
verified: 2026-10-04T11:10:28Z
source_head: 0d67c112eb9c083668907d321029352a4f2d38bf
source_implementation_head: 44c3e298a705cec3e0ffeecd54b357ef32e693d9
status: passed
score: 32/34 must-haves verified
behavior_unverified: 0
overrides_applied: 0
mvp_format_gate: passed
covered_files:
  - ".github/workflows/test.yml"
  - ".gitignore"
  - ".planning/phases/01-two-client-authoritative-tdm/01-01-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-01-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-02-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-02-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-03-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-03-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-04-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-04-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-05-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-05-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-06-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-06-SUMMARY.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-07-PLAN.md"
  - ".planning/phases/01-two-client-authoritative-tdm/01-07-SUMMARY.md"
  - "AGENTS.md"
  - "docs/MULTIPLAYER.md"
  - "eslint.config.js"
  - "index.html"
  - "package-lock.json"
  - "package.json"
  - "playwright.config.js"
  - "playwright.multiplayer.config.js"
  - "server/cli.js"
  - "server/cli.test.js"
  - "server/hosting.test.js"
  - "server/index.js"
  - "server/tdmRoom.js"
  - "server/tdmRoom.test.js"
  - "server/testHelpers/hostileClient.js"
  - "server/tls.js"
  - "server/tls.test.js"
  - "src/combat/damage.js"
  - "src/entities/drone.js"
  - "src/fx/damageNumbers.js"
  - "src/loop.js"
  - "src/main.js"
  - "src/maps/bunker.js"
  - "src/network/onlineSession.js"
  - "src/network/onlineUi.js"
  - "src/network/onlineUi.test.js"
  - "src/network/remoteActors.js"
  - "src/network/remoteActors.test.js"
  - "src/replay/killcam.js"
  - "src/replay/killcam.test.js"
  - "src/shared/combat.js"
  - "src/shared/combat.test.js"
  - "src/shared/maps/bunker.js"
  - "src/shared/movement.js"
  - "src/shared/movement.test.js"
  - "src/shared/protocol.js"
  - "src/shared/protocol.test.js"
  - "src/shared/tdmRules.js"
  - "src/shared/tdmRules.test.js"
  - "src/shared/tdmSimulation.js"
  - "src/shared/world.js"
  - "src/shared/world.test.js"
  - "style.css"
  - "tests/animation-regressions.spec.js"
  - "tests/helpers/mpServer.js"
  - "tests/hosting.spec.js"
  - "tests/multiplayer.spec.js"
  - "tests/offline-multiplayer-regressions.spec.js"
  - "tsconfig.multiplayer.json"
  - "vitest.config.js"

covered_digest: "v2:sha256:790d6defd9aa45d91141dd473c36c9b0a9ccf5ecf3d3b395fb49d766a3003173"
decision_coverage:
  honored: 11
  total: 11
  not_honored: []
unverified_prohibitions: 1
human_verification:
  - test: "Open the operator's actual advertised LAN TLS link in two ordinary browser windows, complete certificate trust, and click Online TDM/Resume."
    expected: "Both windows join the same room; each can obtain mouse capture through its own gesture, aim, move and fire; Escape releases input while snapshots and the match continue; Resume recovers without a false connection error."
    why_human: "Automated HTTPS contexts bypass certificate warnings; headless capture and synthetic rejection tests do not establish the actual LAN trust/gesture experience."
  - test: "Play a full two-window TDM session at normal display resolution, including deaths, respawns, results, rematch and Retry/Return."
    expected: "Current map, armed rigs and motion are readable; only the shooter sees the confirmed crosshair/impact feedback; health, teams, personal kills, scores and winner agree; ammo remains visible; respawn/results timers and Resume/Leave/Retry/Return are usable."
    why_human: "Behavioral assertions cover the state transitions, but the small historical online screenshots predate final UI remediation and cannot establish visual or interaction quality."
  - test: "Resolve the unclassified HOST-03 probe retained by plan 01-06."
    expected: "The human either records the missing acceptance predicate and its evidence, or explicitly acknowledges that no additional predicate was supplied beyond the documented CLI/TLS contract."
    why_human: "The probe has no runnable path or classified assertion; inventing a predicate would change acceptance scope."
  - test: "Resolve the unclassified MODE-01 probe retained by plan 01-07."
    expected: "The human either records the missing acceptance predicate and its evidence, or explicitly acknowledges that no additional predicate was supplied beyond the explicit team/life/results contract."
    why_human: "Passing lifecycle tests cannot prove a descriptor-less additional assertion."
  - test: "Review Phase 1 UI and docs/MULTIPLAYER.md against the unmeasured-capacity prohibition."
    expected: "Two-human admission is described as an acceptance-slice cap; no slot capacity, Raspberry Pi performance or 60 FPS result is presented as qualified."
    why_human: "This unresolved descriptor-less prohibition has no wired deterministic enforcement; source wording supports a non-authoritative judgment only."
---

# Phase 1: Two-Client Authoritative TDM Verification Report

**Phase Goal:** As a browser player, I want to complete a fair server-scored TDM match with another player using the current maps and assets, so that both players share authoritative outcomes.
**Verified:** 2026-10-04T11:10:28Z
**Status:** human_needed
**Re-verification:** No — initial verification; no previous VERIFICATION.md existed.

The shipped implementation supports the declared dedicated-server TDM slice. No missing artifact, goal-blocking stub, unwired connection or unresolved debt marker was observed. The corrected goal passes the MVP user-story format gate, and the flow below has automated behavioral coverage. Five human items remain, including two assertions with insufficient specification and one unresolved prohibition. Do not mark the phase or its five requirements complete or proceed on the basis of this report alone.

## User Flow Coverage

ROADMAP marks this phase **mvp**. After the orchestrator reconciled its goal to the same-scope story already present in 01-01-PLAN, the verifier ran:

`node C:/Users/Marcin/.codex/gsd-core/bin/gsd-tools.cjs query user-story.validate --story "As a browser player, I want to complete a fair server-scored TDM match with another player using the current maps and assets, so that both players share authoritative outcomes."`

Result: `valid:true`, `errors:[]`; role `browser player`, capability `complete a fair server-scored TDM match with another player using the current maps and assets`, outcome `both players share authoritative outcomes`. The table assesses that outcome against the previously inspected production wiring and active tests, rather than claiming a human walkthrough. The formatting-only ROADMAP correction changed no implementation or acceptance scope.

| User-story step | Expected | Evidence in codebase | Status |
| --- | --- | --- | --- |
| Start hosting and open the game | One configured dedicated-server link serves the current built game | server/cli, tls and index connect operator settings to the actual listener/build; hosting.spec exercises HTTP/HTTPS and same-origin WS/WSS | VERIFIED |
| Join with another browser player | Two distinct clients share a room and current map/assets | main enters onlineSession through the real SDK; production MP fixtures build this game and assert distinct sessions, common room/map and real GLB remote rigs | VERIFIED |
| Move and fight fairly | Server determines movement, fire eligibility, travel, hits and damage | Input flows through protocol/room into movement/combat; real keyboard combat and SDK forged/replayed/flood message tests assert authority and rejection | VERIFIED |
| Die and return to play | Both players observe the same life/score transition and configured respawn | Room-owned death/rules and schema feed both snapshot consumers; production lethal-hit/lifecycle tests assert health, kills, death and next-life respawn | VERIFIED |
| Complete the match | Both clients receive identical team scores and winner/draw | tdmRules freezes shared results; onlineSession renders actual snapshot scores/winner; production score/time workflows compare both contexts | VERIFIED |
| Continue into rematch | Results last 15 seconds; settings/teams persist while match/life and inventory reset | resetTransients and tickRules enforce the transition; the verifier's named exact-15s test passes and production workflows assert generation 2/reset values | VERIFIED |
| Share authoritative outcomes | Neither client awards damage, kills or winner independently; health/score/result agree | Schema and private after-patch events originate in room simulation; real forged-outcome and private-recipient tests assert no forged awards and replicated victim health | VERIFIED |
| Accept the ordinary two-window experience | Actual users complete the outcome with LAN trust, gestures and readable visuals | Automated contexts bypass trust; full-size map/rig/feedback and interaction acceptance still require human items 1–2 | UNCERTAIN — WARNING; human checkpoint |

**Historical preflight:** The initial command used the former literal goal, `Two browser players can complete a fair, server-scored TDM match using the current maps and assets.` It returned `valid:false`, `slots:null`, with missing role/capability/outcome format errors. That failed preflight is retained as history and is superseded by the explicit passing command above. The orchestrator owns the ROADMAP correction; this verifier changed only this report.

## Goal Achievement — Source Inspection Evidence

### Observable Truths

Roadmap criteria are rows 1–5 and remain non-negotiable. Additional PLAN truths add specificity; clear restatements were merged with the roadmap wording. VERIFIED below means implementation and active behavioral evidence, not visual/human acceptance. All passing suite evidence in this table is from the parent's directly observed final runs at implementation head 44c3e29, plus the verifier's own named rematch spot-check; SUMMARY claims alone were not used as proof.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Two real browser clients join the same dedicated-server match on an existing map, see each other, move, fire, die, and respawn. | VERIFIED | Actual `startMpFixture()` builds the application and launches server/index; tracer asserts distinct IDs, common room/map, real GLB and remote rigs, keyboard displacement and M4 health change. Score lifecycle asserts lethal hits, death and next-life respawn in both contexts. Adapter calls actual room transport and presents schema state. |
| 2 | Both clients view the same team assignment, confirmed damage, kills, score, and match winner through a complete TDM session. | VERIFIED | Room schema publishes teams/float64 health/kills/scores/winner; onlineSession applies health/ammo and personal KILLS, and renders shared results. Active teams, combat/authority and score/time lifecycle tests assert both snapshots, private feedback, KILLS 99→0→1→0 and common winner/draw. Confirmed hit detail is intentionally shooter-private per D-10; shared health/damage outcome is replicated. |
| 3 | Invalid, stale, duplicated, and impossible movement commands do not change the authoritative player state. | VERIFIED | protocol validates exact fields, finite bounds, sequences, ack ages and current generations; room derives identity from session, consumes once per server step and movement enforces world/body/stance eligibility. Raw SDK rejection/replay/flood tests assert unaffected authority and usable subsequent valid traffic. |
| 4 | Modified client messages cannot grant firing eligibility, create trusted hit outcomes, award damage or kills, or overwrite server score. | VERIFIED | Combat derives cadence/ammo/RNG/muzzle/hit/damage, and rules alone award once-per-life score. Unsupported messages consume the bounded budget and reject. Actual SDK forged-outcome tests and production authority test dispatching the real bundled offline bus assert zero forged awards before normal real combat. |
| 5 | An operator starts the server with npm run mp-server -- --port <port> --host <bind-address> --tls --public <advertised-address>; port/binding/TLS/advertised-address configuration takes effect, certificate setup is documented, and invalid configuration produces actionable errors. | VERIFIED | package script calls server/index; parseArgs/startServer pass validated options to listener, SAN and admission allowlist. CLI subprocess and actual host/TLS tests cover help/errors/bind/port/reuse; production HTTPS/WSS tests assert page-origin sockets and assets. docs/MULTIPLAYER supplies the exact command and trust instructions. Manual trust remains separate. |
| 6 | The next plan can prove two independent browsers against the actual built game and dedicated server, per D-01/D-02. | VERIFIED | Helper runs tracked Vite into owned temp build roots and launches Node server/index with --build-dir; MP specs create independent BrowserContexts and assert actual values. Each spec explicitly owns its fixture; config selects both MP filenames, with no Vite/reused server substitution. |
| 7 | Flagged exact Colyseus versions receive human verification before project installation; recency is not represented as a vulnerability. | VERIFIED | 01-PACKAGE-REVIEW retains the direct human approve response for core 0.18.18/SDK 0.18.4/schema 5.0.35/transport 0.18.4; installed package/lock pins match. Historical approval is documentary evidence, not inferred from installation or a new security guarantee. |
| 8 | New shared/server/network JavaScript receives explicit checking and server tests are discovered; empty test selections fail. | VERIFIED | Strict tsconfig.multiplayer includes these boundaries and helpers; relevant production files opt in with @ts-check. Vitest includes src and server tests, no passWithNoTests. CI runs both types and nonempty separated unit/offline/MP suites. Vendor declaration suppressions are narrow; legacy checkJs:false is not authority proof. |
| 9 | Only the shooter sees confirmation feedback; the other browser receives replicated health rather than the private hit event. | VERIFIED | onBeforePatch targets the shooter client; UI validates recipient before rendering. Real room private-delivery test and tracer/feedback/victim assertions verify replicated health with no victim confirmation, marker or number. |
| 10 | Exact wall/body tangency is permitted, inward penetration is blocked, and coincident spawn bodies are separated by valid selection. | VERIFIED | world uses strict overlap with epsilon, bodiesOverlap checks vertical spans, chooseSpawn searches valid unoccupied candidates. Active world tests cover wall/body tangency and exhausted spawn pending/retry rather than invalid placement. |
| 11 | Server worlds own arrays and queries without mutable map/player or DOM/WebGL singleton imports. | VERIFIED | createWorld uses structuredClone; TdmRoom imports canonical data, numeric simulation/protocol and Colyseus only. World tests mutate independent worlds and import actual room in a Node subprocess without browser globals. |
| 12 | All offline modes/menu/editor and BASE_URL assets remain usable after leaving online. | VERIFIED | main return awaits leave, stops range/killcam/throws/drone/adaptive work, clears mode and restores player state. Loop gates offline ticks online. Real production retirement regression opens Incursion, Adaptive, S&D, TDM, Range and editor; entry and existing asset/animation/offline tests pass. |
| 13 | Online walk/sprint/jump/crouch/ADS body and camera eye agree on ramps/raised floors. | VERIFIED | stepMovement uses source 6/9.9/4.32 speeds, normalized axes, grounded jump, standing-equivalent floor ref and clearance. Movement unit values and production real-key two-browser stance/terrain/wall/ADS/camera assertions pass. |
| 14 | One validated command per player per fixed step; flood/interleaving cannot accelerate or mutate another room. | VERIFIED | input gate consumes bounded pending commands into one intention; setFixedTimestep invokes one simulation step. Actual SDK flood test compares displacement with elapsed ticks; controlled interleaved sessions/rooms test asserts isolation. |
| 15 | Online retains simulation-eye restore, seconds/ms contracts and current assets. | VERIFIED | loop snapshots eye before visual camera offsets and restores it; movement/projectiles take seconds while weapon/rules deadlines use milliseconds. Production movement compares restored camera/body; source constants and current GLB/M4 assertions remain. |
| 16 | Browser M4 fire/reload obey server ammo, cadence, life and phase; travel/collision create hits/deaths/kills. | VERIFIED | requestFire/requestReload eligibility and stepProjectiles are called from active simulation; no outcome fields enter protocol. Timing units plus actual cover/ammo/reload/combat and lethal lifecycle workflows assert results. |
| 17 | Default friendly damage is multiplied by 0.25 on the server and only shooter receives hit feedback. | VERIFIED | immutable settings default friendlyFire .25 feeds rules.friendlyDamage; real projectile friendly multiplier tests assert exact health at 0/.25/.5/1, with room/UI private-delivery coverage. |
| 18 | Ready-time shot allowed, earlier rejected; ammo zero rejects; exact lifetime exhaustion retires without later hit. | VERIFIED | Combat checks nextFireAtMs/ammo and clips the half-open final segment. Active timing/ammo/lifetime boundary cases assert exact allowed/rejected values and unchanged target health beyond expiry. |
| 19 | Earliest impact wins, ties within 1e-7 choose obstruction then stable session ID, and friendly health retains fractions. | VERIFIED | resolveImpact filters around the true minimum and sorts obstruction/actor ID; schema health is float64. Tests assert near/far cover, chained ties, stable order and fractional damage/schema encode-decode. |
| 20 | Launched projectile can outlive shooter in the current match but cannot damage retired target life or survive new match. | VERIFIED | Shot stores immutable shooter/match IDs; impact rechecks current target life/alive/match and retires once. Active dead-shooter, retired-life/match, duplicate lethal and replacement-credit tests assert these distinctions. |
| 21 | Default 50 kills/600 seconds/3-second respawn/.25 friendly damage; adjustable server-owned settings. | VERIFIED | validateSettings/loadRoomSettings bound exact numeric operator fields and fixed resultsSeconds15; fake-clock default/boundary tests and hostile join settings assertions exercise the contract. |
| 22 | Smaller-team assignment/balanced switching and immediate one-human start. | VERIFIED | onJoin stable ordinal/tie blue; requestTeamSwitch requires membership/current generations/dead or results/projected difference<=1. Unit/raw transport/teams tests exercise rejected balanced switches and legal solo-result switch; UI projection matches final server rules. |
| 23 | Same winner/scores for 15 seconds, then automatic same-settings rematch. | VERIFIED | tickRules publishes fixed deadline; resetTransients increments lives/match, resets all state and preserves immutable settings/teams. Verifier's named exact-15s behavioral test passed; both production score/time paths assert result arithmetic and generation2. |
| 24 | Zero humans suspend without endless matches; one returns to play; null/empty joins default and malformed structure rejects. | VERIFIED | onLeave resets to waiting; ticks do not rematch empty room. guestName validates cosmetics. Active empty/rejoin simulation and SDK tests, malformed join and stable-name tests assert explicit outcomes. |
| 25 | Equal teams choose blue, join ordinal is stable, current impacts/score precede time, equal time score draws. | VERIFIED | onJoin and stepSimulation enforce ordering in code; rules tests assert ordinal/tieblue, actual eligible projectile on exact expiry step and default timed draw. |
| 26 | Old connection/match/life intentions and confirmations retire on death/disconnect/respawn/rematch; all match queues/projectiles/events reset. | VERIFIED | life/match reset clears inventory/input; room resets receipt cursors and staged hit queue; adapter epoch/generation owns callbacks and state. Real SDK replay and controlled resets assert stale commands/events inactive. Named rematch test checks transients and fresh valid input afterward. |
| 27 | One advertised same-origin link serves built assets and HTTP/WS or HTTPS/WSS. | VERIFIED | Client uses location.origin; HTTPS/HTTP share the same listener/transport, validated built root. Active hosting browser asserts WSS host equals page host, shared room and real glTF magic. |
| 28 | TLS automatically generates/reuses self-signed matching DNS/IP SAN/key; trust setup documented. | VERIFIED | TLS validates host/IP/date/private key and self-signature, serialized atomic manifest, ACL/POSIX modes. Tests assert DNS/IPv4/IPv6, reuse bytes/mtime, replacement/failure and concurrent publication; browser restart verifies same-link WSS. Trust bypass is explicit and not user trust evidence. |
| 29 | Sources/certificates/private key material are never served by the built-game host. | VERIFIED | validateBuildDir rejects source/TLS/symlink/secret-containing roots; static built-only root denies dotfiles. Real host/browser forbidden-path tests assert 404/no PRIVATE KEY. Public REST gate admits only operator-room seats and applies Origin before framework parsing. |
| 30 | HOST-03 unclassified probe remains a flagged assumption; known CLI/TLS contract is covered but generic probe supplied no further predicate. | UNCERTAIN — WARNING (insufficient_spec) | No runnable probe path or classified assertion exists. Explicit hosting assertions are covered; undefined extra predicate cannot be inferred. Human item 3. |
| 31 | Current character/weapon assets survive repeated death/respawn/leave/rematch; cleanup releases owned resources and preserves templates. | VERIFIED | injected manager is wired to buildEnemyMesh/disposeEnemyMesh; life/match/session changes retire exact rigs. Resource tests assert once-only disposal and shared geometry alive; real GLB resources/lifecycle/rejoin and existing character cleanup tests assert subsequent clone usability. Visual quality remains human. |
| 32 | Only current shooter confirmations create marker/impact feedback; duplicate/stale events inert. | VERIFIED | UI validates before dedupe, event high-water with bounded seen-shot set; room stages <=128 and sends after matching patch. Real reversed-shot impacts and real SDK respawn-patch-before-hit tests reproduce/fix CR-03/04; generation/malformed/victim/expiry tests cover retirement. |
| 33 | Top connection errors are readable/actionable and escaped, with Retry/Return. | VERIFIED | Static alert banner z2000, textContent bounded400, fresh-session Retry and full Return cleanup. UI safe-sink tests and production unavailable/disconnect top/retry/return test assert active recovery. Capture error has separate safe-text UI; headless rejection test preserves active room. Readability judgment remains human. |
| 34 | MODE-01 unclassified probe stays flagged; known life/team/results contract covered but no additional predicate classified. | UNCERTAIN — WARNING (insufficient_spec) | No runnable path or predicate can be reconstructed responsibly from the generic flag. Human item 4. |

**Technical evidence score:** 32/34 truths verified; 0 present-but-behavior-unverified. The two uncertain truths are under-specified probes, not absent implementation. The MVP format gate passes; the score does not certify human flow/visual/trust acceptance.

### Required Artifacts

All seven `verify.artifacts` queries passed: 23/23 PLAN artifact entries (including repeated references). Actual content and consumers were also inspected.

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| package.json/package-lock.json, both Playwright configs, tsconfig.multiplayer, tests/helpers/mpServer | Approved runtime, checking and production harness | VERIFIED | Exact pins/Node24/scripts; strict checked boundary opts in; server test discovery; fixture uses arguments/current Node/tracked Vite/owned root and finite teardown. |
| shared/maps/bunker, shared/world, maps/bunker | Canonical owned headless map | VERIFIED | Renderer imports bunkerData; room creates a cloned per-instance world; nontrivial surface/occupancy/sweep/spawn functions consumed by simulation. |
| shared/tdmSimulation, movement, protocol | Room-owned state/input/movement | VERIFIED | Real fixed-step consumers, eligibility, exact validation/bounds and lifecycle reset; corresponding active units/SDK/production scenarios. |
| server/tdmRoom, shared/combat, shared/tdmRules and tests | Authoritative combat/full TDM | VERIFIED | Clock/ammo/impact/once-per-life score/results/rematch; schema publishes current values and targeted private events after patch. |
| network/onlineSession, onlineUi, remoteActors | Input, snapshot HUD, private feedback and rig ownership | VERIFIED | Called by entry/frame loop, adapters inject real builder/disposal/effects; explicit session and handler retirement. Dynamic data trace below. |
| server/cli, tls, index, docs/MULTIPLAYER, hosting.spec | Console hosting/TLS and operator guidance | VERIFIED | Validated flags reach listen/static/HTTPS/Origin; real host/subprocess/browser tests, safe storage and exact commands/docs. |
| offline-multiplayer-regressions, CI, canonical SECURITY.md/index | Regression/mitigation evidence | VERIFIED | Six actual offline destinations and current asset/animation tests; CI runs separate suites; index points to canonical 29-row register. Security evidence is scoped mitigation presence, not certification. |

### Key Link Verification

The mechanical `verify.key-links` queries found only 4/18 links, mainly because they look for literal target paths/direct references. Each nonmatch was traced in actual code. No failed mechanical result is silently treated as a pass: the runtime evidence below supplies the missing trace.

| From → To | Via | Status | Actual trace |
| --- | --- | --- | --- |
| MP config → helper → production server | Explicit per-test fixture | WIRED | testMatch selects specs, each imports startMpFixture; helper launches built server. PLAN's webServer wording is superseded by per-test owned fixtures with the same goal. |
| package → lock/CI | npm dependency mechanism | WIRED | Lock root pins mirror package; CI uses npm ci. No import of package-lock from package.json is expected. |
| renderer → canonical bunker | Relative import and map fields | WIRED | maps/bunker imports ../shared/maps/bunker.js and consumes arrays/spawns; room imports same canonical data. |
| loop → onlineSession | tickOnline before local gates | WIRED | import at loop:25 and invocation at79; offline updatePlayer/gamepad/mode branch skips online. |
| browser → protocol/room | SDK input message | WIRED | sendIntent emits exact protocol fields; room.onMessage input invokes createInputGate/validateInput bound to framework identity, then queueInput. It need not import server validator into browser. |
| room → simulation → movement/combat/rules | Fixed timestep and callbacks | WIRED | consumeInputs then stepSimulation; simulation calls stepMovement and requestFire/reload/stepProjectiles; onDeath callback invokes rule transition before tickRules. |
| room → browser schema/feedback | Replication + afterNextPatch | WIRED | syncState assigns actual schema; onlineSession reads SDK state and targeted hit callback; onBeforePatch rechecks current lives/match and sends private event after state. |
| CLI/TLS → server/index → build directory | Imports and options | WIRED | index imports parseArgs/loadRoomSettings/loadOrCreateCertificate, passes host/port to listen and key/cert to HTTPS; Express serves validated buildDir only. |
| session → UI/rig manager → disposal | Injected real consumers | WIRED | session imports createOnlineUi/createRemoteActors; builder injection uses disposeEnemyMesh alias to disposeCharacter with preserveTemplateGeometry contract. |
| CI → MP config | Script indirection | WIRED | CI runs npm run test:mp; package script names playwright.multiplayer.config.js; offline config excludes MP files. |

### Data-Flow Trace (Level 4)

This game uses authoritative in-memory room simulation rather than a database. An empty initial collection is valid owned state; none of the rendered dynamic chains ends in a hardcoded empty fallback.

| Rendered artifact/value | Source → flow | Produces real data | Status |
| --- | --- | --- | --- |
| Local body/health/ammo/crouch/ADS | Validated intentions → room simulation → schema players → tickOnline → player/camera/updateHUD/updateWeapon | Yes; actual movement/weapon state | FLOWING |
| Team score/clock/winner/statistics/KILLS | onDeath/tickRules → snapshot/syncState → SDK room state → textContent/setOnlineKills/renderMatchState | Yes; server score/lifecycle deadlines/stats | FLOWING |
| Remote rigs/position/team/animation | Other schema player values → syncRemoteActors → real cloned builders/mixer/position/tint | Yes; per-session current life snapshots | FLOWING |
| Hitmarker/world damage | Server swept impact → bounded private after-patch event → recipient/life validation/dedupe → existing marker/managed number | Yes; actual clamped damage and impact position | FLOWING |
| Errors/eligibility/Resume recovery | SDK connection errors/current snapshot/current capture result → bounded safe-text UI | Yes; actual connection/state/result | FLOWING |
| Greek Columns visuals/collision | Canonical bunker gameplay arrays → renderer and cloned world | Yes; real existing static authored map | FLOWING |

### Behavioral Spot-Checks and Existing Run Evidence

| Behavior/check | Command/evidence | Result | Status |
| --- | --- | --- | --- |
| Exact results→rematch transition and generation reset | Verifier ran `npm run test:unit -- src/shared/tdmRules.test.js -t 'freeze lasts exactly15 seconds then same-settings rematch retires all transients' --maxWorkers=1` | Exit0; 1 selected test passed, 273ms total/13ms test. Other13 were unselected by -t, not disabled in source. | PASS |
| MVP structural guard | Central user-story.validate command above | valid:true, errors:[], role/capability/outcome extracted | PASS; initial rejected preflight retained as history |
| Decision coverage | `query check.decision-coverage-verify <phaseDir> <CONTEXT>` | blocking:false; honored11/11, no misses | PASS (advisory heuristic) |
| Artifact checks | `query verify.artifacts` for each of7 plans | all23 entries exist and pass basic checks; actual substance/wiring above | PASS |
| Full current source gates | Parent's actual final outputs, recorded in newest01-CLOSEOUT at44c3e29 | Lint0warnings; both types/builds PASS;247 unit/22 files155.31s;19 offline3.3min;14 MP6.5min. Verifier inspected test bodies/production wiring, did not rerun suites. | PASS evidence; not SUMMARY inference |
| UI regression behavior | Parent's actual focused production outputs at44c3e29 plus test assertions | 8px ammo clearance; pointer-lock promise rejection keeps active session and separate recovery; balanced results disabled and legal solo result switch/rematch; focused2 cases44.5s, UI8 units667ms | PASS evidence; human visual judgment pending |

No server/service was started by this verifier. Only the selected pure behavioral test ran. Earlier 9/14 review-fix checkpoint and pre-remediation15/24 UI score are historical and are explicitly superseded for automated behavior by the latest actual14/14 run, without rewriting that failed history. Normal ignored Playwright reruns can replace earlier trace files. The latest closeout/parent tool outputs, rather than old ignored path availability, govern final gate evidence.

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| Runnable conventional/declaration probe discovery | rg files under scripts and PLAN/SUMMARY probe-.sh references | No scripts directory and no declared executable probe paths | N/A — no runnable probe to substitute or invent |
| HOST-03 generic probe flag | No path/predicate supplied | Explicit known CLI/TLS checks covered; extra assertion undefined | UNCERTAIN — human item3 |
| MODE-01 generic probe flag | No path/predicate supplied | Explicit known lifecycle checks covered; extra assertion undefined | UNCERTAIN — human item4 |

This is not a MISSING_PROBE failure: neither item documents a probe path. A future supplied path/assertion must be executed and recorded; a passing ordinary game test cannot mechanically resolve the current flags.

### Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence/limit |
| --- | --- | --- | --- | --- |
| NET-01 | 01–07 | Multiple browsers join/see each other/play existing-map match | SATISFIED automated; NEEDS HUMAN acceptance | Real contexts, dedicated source-built server/current GLB, movement/combat/lifecycle/resource/offline behavior; LAN/gesture/full-size experience pending. |
| NET-03 | 01/02/03/05/07 | Server-derived movement; reject hostile/replayed/impossible input | SATISFIED automated | Exact protocol, bound identity/age/queue/rates; actual SDK assertions and world/stance units; no prediction/impairment qualification. |
| NET-04 | 01/02/04/05/07 | Authoritative eligibility/travel/hits/damage/deaths/score | SATISFIED automated; NEEDS HUMAN feedback judgment | Real impact/forged outcomes/private recipient/after-patch/reversed shot coverage; full-size impact feedback pending. |
| MODE-01 | 01/02/05/07 | Teams/respawns/shared TDM winner | SATISFIED explicit automated contract; NEEDS HUMAN | Defaults/balance/death/results/exact15s/rematch/empty room; undefined probe and complete user experience pending. |
| HOST-03 | 01/02/06/07 | Exact CLI/TLS/address/trust/help/errors | SATISFIED explicit automated contract; NEEDS HUMAN | Real listeners/subprocesses/HTTPS/WSS/SAN/ACL/reuse, one-link docs; actual trust and undefined probe pending. |

All five assigned requirement IDs appear in plans; no orphaned phase requirement. Global checkboxes remain pending and were not changed. A plan SUMMARY's historical requirements-completed list was not interpreted as acceptance.

### Decision Coverage

Central gate result: **All trackable CONTEXT.md decisions are honored by shipped artifacts.** honored11/11, blocking:false, not_honored empty. Actual CONTEXT has D-01–D-11, followed by builder discretion and deferred decisions; no locked D-12–D-14 entries were found. No invented decision IDs were substituted.

Source confirms one operator room/link, required command/testing TLS,50/600/3/.25 defaults, balance/solo start,15s same-settings rematch/empty suspension, shooter-private feedback and top safe errors. The gate is a substring-based warning check and does not prove runtime by itself.

### Test Quality Audit

| Test files | Linked requirement | Active | Disabled/skipped source tests | Circular expected values | Strongest assertion | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| shared world/movement/protocol tests | NET-01/NET-03 | Yes | 0 observed | No | Exact boundary/state mutation/displacement values; isolation/import behavior | Adequate |
| shared combat/rules tests | NET-04/MODE-01 | Yes | 0 observed | No | Real projectiles, independent literal health/threshold/deadline expectations, multi-step resets | Adequate |
| server room/hosting/CLI/TLS tests | NET-03/NET-04/HOST-03/MODE-01 | Yes | 0 observed | No | Actual SDK/HTTP/subprocess/socket/cert/ACL values plus controlled clocks | Adequate with scope limits |
| network UI/remote ownership, killcam tests | NET-01/NET-04/MODE-01 | Yes | 0 observed | No | Malformed/private/dedup/expiry/dispose and callback ownership; real reversed impacts | Adequate paired with production integration |
| multiplayer/hosting/offline retirement specs | All5 | Yes | 0 observed | No | Distinct contexts/same room, ordinary inputs, exact health/ammo/stat/winner/generation values and DOM recovery | Adequate for automated contract, not human visual/trust acceptance |

No requirement is proved only by a disabled test, existence/type/status assertion or circular generated fixture. writeFile matches in CLI/hosting/TLS tests write deliberate malformed/configuration/certificate inputs in owned temp storage, not generated expected-output goldens. Resource/UI mocks isolate ownership/decisions and are paired with real GLB and browser/SDK flows. Server-controlled fixture rules/seeds are legitimate operator inputs, not client-awarded outcomes. Body positioning/controlled clock in unit/SDK fixtures is test setup; production keyboard/real room tests supply the end-to-end counterpart.

**Disconfirmation:** HOST-03 trust is only partially accepted despite passing HTTPS tests: ignoreHTTPSErrors intentionally bypasses the experience. `usingGLTF=true`, tiny screenshots, and resource-count assertions would be misleading evidence for accepted pose/readability. Managed-browser refusal of a certificate exception and normal activation/focus failure have no actual-window acceptance evidence. These are explicit human items, not silent passes. No specific undeclared state/ordering/fixture dependence was needed for the verified technical truths; no coincidental-reliance flag assigned.

### Review Closure and Anti-Patterns

Actual source verifies all five original fixes: REST admission/Origin gate before framework routing (CR-01), DOM text nodes/PNG-only thumbnail (CR-02), bounded seen-shot set allowing reversed firing order (CR-03), generation recheck plus afterNextPatch delivery (CR-04), and snapshot-owned KILLS reset/projection (CR-05). Active regressions assert the reproduced defects. Supplementary killcam retirement now cancels the retired callback, while natural expiry/Skip completes the current one once. Final UI source reserves bottom76px/scroll bounds, uses MOUSE RELEASED/match-continues wording, separates capture recovery from connection errors, projects balanced switch eligibility and follows scoped entry styling/Connecting text.

| File/concern | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| Phase-modified production/tests | No unresolved TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in scanned implementation boundaries | None | No debt-marker blocker |
| Numeric maps/state/queues | Empty arrays/null returns have populated simulation/lifecycle paths | Info | Legitimate initial/retired state, not stub output |
| 01-UI-REVIEW evidence | Historical15/24 and small screenshots precede remediation | WARNING | No full-size visual approval; human item2 |
| 01-06/07 unclassified flags | No additional predicate specified | WARNING | Cannot certify unknown assertions; human items3/4 |
| 01-07 prohibition | Descriptor-less, unresolved and no deterministic enforcement | WARNING | unverified-prohibition — human review recommended |
| MVP goal | Initial format rejection resolved by same-scope canonical wording | Info | Current canonical validation passes; human flow acceptance remains pending |
| Earlier maintenance/capture evidence | Development-tool advisories and failed optional high-resolution capture documented | Info | Not substituted for current runtime proof; no current dependency certification or successful additional image claim |

Independent security audit records29 planned controls closed at configured L1 presence depth (28 mitigations/1 accepted-low self-signed testing trust); source inspection confirms the major boundaries and additional fixed public sinks. This is not an exhaustive security audit or ASVS certification. Current unrelated development-tool maintenance findings are retained, not silently resolved.

### Prohibition Verification

**Statement:** Phase1 UI and operator documentation must not present unmeasured slot capacity, RaspberryPi performance or60FPS as qualified results.

**Disposition:** UNCERTAIN — WARNING; **unverified-prohibition — human review recommended**. PLAN omits a verification tier and descriptor, and explicitly leaves status unresolved. Source inspection supports a NON-AUTHORITATIVE judgment: entry/docs describe a two-human acceptance slice and explicitly deny Pi/slot/FPS qualification. No wired test-tier enforcement exists and no silent green is emitted. Human item5 supplies the required end-of-phase decision.

### Deferred Scope

No observed implementation failure was moved to a later phase to obtain this verdict. Clear roadmap boundaries are retained as exclusions from Phase1: lobby/create/discovery, prediction/impairment/cross-device response in Phase2; additional online modes in Phase3; bot filling/Pi/measured slot profiles in Phase4; full omnimovement/body-camera collision in Phase5; richer combat in Phase8 and durable loadouts/progression in Phase9. None of these is inferred implemented, measured or accepted here.

### Human Verification Required

1. **Actual LAN trust and ordinary mouse capture.** Open the operator's advertised TLS link in two ordinary windows, follow documented certificate trust, click Online TDM/Resume and move/aim/fire. Expected: both join the same room with gesture-driven capture; Escape stops intentions while snapshots/match continue; Resume recovers without a false connection error. Automation bypasses trust and cannot establish the real gesture experience.
2. **Full-size complete TDM experience.** Play through death, configured respawn, common winner/draw,15-second results and automatic same-settings rematch; try leave and connection recovery. Expected: readable current map/armed rigs/motion and shooter-only marker/impact feedback, matching authoritative HUD/results, visible ammo and usable controls. Inspect after the UI fixes; existing low-resolution online captures are not approval.
3. **HOST-03 undefined probe.** Supply its missing predicate/evidence or explicitly acknowledge that no further predicate was supplied beyond the known CLI/TLS contract. No extra runnable command or expected output has been invented.
4. **MODE-01 undefined probe.** Supply its missing predicate/evidence or explicitly acknowledge that no further predicate was supplied beyond the known life/team/results contract. Passing known tests cannot resolve an unknown assertion.
5. **Unmeasured-capacity prohibition.** Explicitly review and resolve the UI/operator wording. Expected: two-human admission is an acceptance cap; slots/Pi/60FPS remain unqualified. Source judgment is advisory until that decision.

### Gaps Summary

**No implementation BLOCKER was observed.** The goal's automated behavior is supported by actual source, meaningful active tests and current parent-observed full gate results. The canonical MVP format gate passes and the shared-outcome flow has automated coverage. Overall **human_needed** follows the required decision tree because five acceptance items remain, including two insufficient-spec truths and an unresolved prohibition. The 32/34 technical score must not be converted into accepted Phase 1 status until those human conditions are resolved.

Only this VERIFICATION.md was written. No source, state, requirement checkbox, dependency, process ownership, Git trust setting or commit was changed by this verifier.

---

_Verified: 2026-10-04T11:10:28Z_
_Verifier: gsd-verifier_
