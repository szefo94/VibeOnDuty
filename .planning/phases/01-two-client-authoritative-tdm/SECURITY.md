---
phase: "01"
standard: OWASP-ASVS-5.0.0
target_level: 1
status: automated-verified-human-pending
threats_open: 0
threats_accepted: 1
human_acceptance: pending
---

# Phase 1 security evidence

This is an implementation/evidence map for the 29 unique planned threats, not an
ASVS certification or an assertion that every ASVS requirement applies or passes.
The exact IDs and levels were read from the [official tagged ASVS5.0.0 requirements](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json)
on 2026-10-03. Each repeated T-01-SC row is represented once. No new packages were
installed in01-07; the01-01 exact-version approval and tracked lockfile remain the
package authority. High/critical mitigation failures would block closure.

## Applicable controls

Level1 references: V2.2.1 (functional input validation), V2.2.2 (trusted validation),
V3.2.2 (safe text sinks), V8.2.1 (function permissions), V8.2.2 (data permissions),
V8.3.1 (trusted authorization), V12.1.1 (modern TLS), V12.2.1 (external HTTPS),
V12.2.2 (public trust), V14.3.1 (client session data clearing), V15.2.1
(documented component remediation). These are scoped correspondences; guest room
membership is not authenticated account identity. V14.3.1 is a lifecycle analogy.

Supplementary controls with their actual levels: V1.4.3 L2 (resource release),
V15.2.2 L2 (availability defenses), V13.3.1 L2 (secret management), V13.3.2 L2
(secret least privilege), V16.5.1 L2 (generic sensitive errors), V16.5.2 L2
(external failure handling). These must not be relabeled Level1. File-restricted
TLS storage is not a general secret vault. Exact pins/review alone do not establish
the documented remediation timeframes required for full V15.2.1 compliance.

## Threat register

| Threat | Disposition | Implemented mitigation | Concrete evidence | ASVS correspondence |
| --- | --- | --- | --- | --- |
| T-01-01 | Mitigated | Exact approved release pins and lockfile; Node24 npm ci |01-01-SUMMARY approval/audit; package.json/package-lock.json unchanged by01-07; CI npm ci | V15.2.1 partial component governance |
| T-01-02 | Mitigated | Owned temp builds/children, finite readiness, scoped teardown | tests/helpers/mpServer.js; isolation fingerprint check and timeout evidence in01-01/02 | No direct L1; V15.2.2 L2 |
| T-01-03 | Mitigated | Room transport session chooses command body; no arbitrary target identity | server/tdmRoom.test.js forged session/SDK replay cases | V8.2.1, V8.3.1 |
| T-01-04 | Mitigated | Online guards suppress local gameplay awards; authoritative snapshots own health/ammo/score | multiplayer authority scenario emits actual bundled offline outcome bus and sees zero awards | V8.3.1 |
| T-01-05 | Mitigated | Private confirmation uses shooter client.send | tdmRoom private hit delivery; tracer/feedback victim has no marker or damage number | V8.2.2 |
| T-01-06 | Mitigated | Each room clones canonical Greek Columns arrays/world; no browser singleton imports | world.test.js map parity and independent worlds; tdmRoom interleaved room test | V2.2.2, V8.3.1 |
| T-01-07 | Mitigated | Membership/session identity comes from framework transport | tdmRoom forged identity and replacement-session SDK tests | V8.2.1, V8.3.1 |
| T-01-08 | Mitigated | Exact finite intent schema, monotonic seq, age/ack/life/match gates | protocol.test.js; real SDK replay/future/nonfinite tests | V2.2.1, V2.2.2 |
| T-01-09 | Mitigated |1024-byte payload,8 queued commands,60/s,120 burst; bounded disconnect | protocol queue/budget tests; real transport overflow and sustained three-window flood tests | V2.2.1; V15.2.2 L2 availability |
| T-01-10 | Mitigated | Server fixed dt; alive/phase/ground/body-clearance checks | movement units; production movement wall/jump/crouch/neutral test; room stale/dead queue test | V2.2.2, V8.3.1 |
| T-01-11 | Mitigated | Server clock, ammo, RNG, muzzle and projectile origin | combat.test.js cadence/reload/seed/sweep; SDK forged outcomes; production cover/ammo/reload | V2.2.2, V8.3.1 |
| T-01-12 | Mitigated | Recheck shooter/target life and match; retire death/score once | combat/tdmRoom duplicate retirement, old-life and clamped fractional friendly hit tests | V2.2.1, V8.3.1 |
| T-01-13 | Mitigated | Private delivery only to firing membership | tdmRoom private hit test; two production browser victim-feedback assertions | V8.2.2 |
| T-01-14 | Mitigated | Swept earliest impact; obstruction-first1e-7 tie band; stable session order | combat.test.js near/far actor, cover/floor and tie tests; production cover case | V2.2.1 |
| T-01-15 | Mitigated | Operator settings and current member/life/match balance gates | tdmRules/cli units; tdmRoom hostile join/team test; production teams/results switch | V2.2.2, V8.2.1 |
| T-01-16 | Mitigated | Life/match generations reset inventory, bullets, queues, ack/private event cursors | tdmRules/tdmRoom SDK stale/death/rematch; score/time lifecycle browsers | V2.2.1, V8.3.1 |
| T-01-17 | Mitigated | Zero-human suspension; bounded stable unoccupied spawn search | tdmRules fake-clock suspension/spawn exhaustion tests | V2.2.1; V15.2.2 L2 |
| T-01-18 | Mitigated | Generated guest IDs, bounded printable names, textContent statistics | tdmRules nickname units; hostile join SDK; onlineUi text-sink tests | V2.2.1, V3.2.2 |
| T-01-19 | Mitigated | Built root only, no symlink/source/TLS root, dotfile/key path denial | hosting.test.js actual HTTP forbidden paths/private-key content checks | V8.2.2; V13.3.1 L2 build exclusion only |
| T-01-20 | Mitigated with trust exception below | Validate SAN/key/dates; bounded renewal and matching atomic pair | tls.test.js DNS/IP/reuse/corruption/expiry; hosting HTTPS/WSS integration | V12.1.1 transport scope; V12.2.2 exception |
| T-01-21 | Mitigated | Ignored atomic pair.json; POSIX0700/0600 or actual verified Windows ACL; no PEM logs | tls.test.js real permissions/ACL/failure publication; hosting private paths; ignored .vod-server | No direct L1; V13.3.1/V13.3.2 L2 scoped storage |
| T-01-22 | Mitigated after CR-01 | Strict advertised URL and Origin allowlist before REST body/router and WebSocket handshake; public joins only operator room | hosting.test.js real HTTP foreign/missing Origin, repeated create and full unjoined-seat rejection, retained room count after actual reservation expiry; proxy SDK and WebSocket handshake cases | V2.2.1, V8.2.1; V15.2.2 L2 bounded room allocation |
| T-01-23 | Mitigated | Finite invalid bind/build/port errors; shutdown owned listeners | cli.test.js subprocess exits; hosting occupied-port/bind/owned listener cleanup | No direct L1; V15.2.2/V16.5.2 L2 |
| T-01-24 | Accepted low, D-04 | Operator-selected testing certificate and explicit trust instructions, no silent trust installation | docs/MULTIPLAYER.md; automated HTTPS bypass labeled; actual LAN two-window trust pending human | V12.2.2 deliberately not met by self-signed testing; V12.2.1 not asserted for optional private HTTP |
| T-01-25 | Mitigated | Validate bounded damage/finite impact; recipient and current target/shooter generations; monotonic shot/event dedupe before cosmetics | onlineUi tests; production malformed/stale/duplicate callback attack and victim isolation | V2.2.1; V8.2.2 private-event delivery |
| T-01-26 | Mitigated | Error/nickname textContent; bounded400-character error text; readable top banner | onlineUi injected HTML-sink trap; production unavailable/drop Retry/Return | V3.2.2 |
| T-01-27 | Mitigated | Explicit clone owner; life/match/session retirement; named input teardown; reset feedback nodes | remoteActors units; actual GLB repeated life/rematch/rejoin; listener count0 after leave; stable textures and exact live rig accounting | No direct L1; V1.4.3/V15.2.2 L2; V14.3.1 lifecycle analogy |
| T-01-28 | Mitigated; human acceptance pending | Recorded commands, nonempty separated suites, exact tagged control levels and honest screenshot limits |01-07-SUMMARY and evidence manifest; this29-row register | No direct L1 for evidence provenance; no certification claim |
| T-01-SC | Mitigated | Previous explicit legitimacy approval, exact versions, no additional installs/substitutes |01-01 approval/checkpoint record; unchanged lockfile and tracked CI npm ci | V15.2.1 partial governance only |

## Verification and acceptance limits

All eight full automated gates passed: lint, both type checks, both builds,
238 unit tests,18 offline/animation browser tests and13 production multiplayer
tests. The fixture isolation check also passed. Full command results and screenshot
paths are recorded in01-07-SUMMARY.md and evidence/01-07/manifest.json. No open
high/critical planned mitigation failure is intentionally accepted. Accepted-low T-01-24 is a
testing trust exception, not an automated validation of real browser trust.

Actual LAN certificate trust in two windows, gesture-driven pointer lock,
map/rig/feedback visual judgment, the unclassified HOST-03 and MODE-01 probes and the
descriptor-less product-transparency prohibition remain pending human acceptance.
No measured slot/Pi/FPS claim is made. Phase2 lobby/prediction/cross-device,
Phase3 other modes, Phase4 bots/Pi measurements, Phase8 richer combat and Phase9
persistence remain future commitments. Passing this threat map cannot qualify
those features or complete all five shared Phase1 requirements.

The pre-existing development-tool audit findings (three moderate and three high)
remain open as WINDOWS.md entry3 from01-01; they were not introduced by this plan.
The01-01 production-only audit was clean. This map does not turn that historical
audit into a current dependency certification or resolve the retained maintenance
finding. WINDOWS.md entry17 already tracks pending real LAN trust/pointer lock.

The26 preserved screenshots comprise18 production captures at200x150 physical
pixels and two entry captures at250x200 (800x600 or1000x800 viewport,
deviceScaleFactor0.25), plus six offline captures at800x600.
They establish capture provenance and exercised UI states, not visual acceptance.
An additional deviceScaleFactor1 production capture controller timed out twice
near its first waypoint; it produced no additional images. The failed optional
capture is retained as evidence-only01-07-CAPTURE.mjs and WINDOWS.md entry31.
The required production suite still passed completely; full-size online visual
judgment remains in the actual-window human acceptance.
