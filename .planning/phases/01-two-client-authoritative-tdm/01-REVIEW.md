---
phase: 01-two-client-authoritative-tdm
reviewed: 2026-10-04T05:53:11Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - .github/workflows/test.yml
  - .gitignore
  - AGENTS.md
  - docs/MULTIPLAYER.md
  - eslint.config.js
  - index.html
  - package.json
  - playwright.config.js
  - playwright.multiplayer.config.js
  - server/cli.js
  - server/cli.test.js
  - server/hosting.test.js
  - server/index.js
  - server/tdmRoom.js
  - server/tdmRoom.test.js
  - server/testHelpers/hostileClient.js
  - server/tls.js
  - server/tls.test.js
  - src/combat/damage.js
  - src/entities/drone.js
  - src/fx/damageNumbers.js
  - src/loop.js
  - src/main.js
  - src/maps/bunker.js
  - src/network/onlineSession.js
  - src/network/onlineUi.js
  - src/network/onlineUi.test.js
  - src/network/remoteActors.js
  - src/network/remoteActors.test.js
  - src/shared/combat.js
  - src/shared/combat.test.js
  - src/shared/maps/bunker.js
  - src/shared/movement.js
  - src/shared/movement.test.js
  - src/shared/protocol.js
  - src/shared/protocol.test.js
  - src/shared/tdmRules.js
  - src/shared/tdmRules.test.js
  - src/shared/tdmSimulation.js
  - src/shared/world.js
  - src/shared/world.test.js
  - style.css
  - tests/helpers/mpServer.js
  - tests/hosting.spec.js
  - tests/multiplayer.spec.js
  - tests/offline-multiplayer-regressions.spec.js
  - tsconfig.multiplayer.json
  - vitest.config.js
findings:
  critical: 5
  warning: 0
  info: 0
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-04T05:53:11Z  
**Depth:** standard  
**Files Reviewed:** 48  
**Status:** issues_found

## Summary

Reviewed the explicit 49-file phase scope after excluding `package-lock.json` under the review workflow's lockfile rule. Read the repository instructions, locked context, all seven plans and summaries, every remaining scoped file, and relevant consumers/dependency implementations. Findings concern the public admission boundary, confirmed feedback, and visible authoritative statistics. CR-02 is an inherited defect in a scoped file, explicitly distinguished from Phase 01 regressions.

The findings below were reproduced with narrow probes; the existing passing full gates do not exercise these cases. LAN certificate trust, ordinary human gestures, and full-size visual judgment remain outside this code review. No future lobby, prediction, mobile, bot, or omnimovement requirements were applied. No source files were edited and no commit was made.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Public matchmaking creates permanently retained rooms without admission bounds

**Classification:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/server/index.js:82-96`  
**Related:** `C:/Programowanie/VibeOnDuty/server/tdmRoom.js:122-123`, `C:/Programowanie/VibeOnDuty/server/tdmRoom.js:179-184`  
**Issue:** Registering `tdm` with the default matchmaking server exposes HTTP room creation, while every room has `autoDispose = false` and starts a fixed simulation timer. The Origin gate covers only WebSocket upgrade. An unauthenticated requester can repeatedly POST `/matchmake/create/tdm` without ever connecting a socket, bypassing every per-player queue/rate limit and accumulating rooms that never retire. This is an unbounded admission denial-of-service path, including on a publicly advertised host.

**Evidence:** Started an isolated host with the production `startServer()`. The initial `matchMaker.query({ name: 'tdm' })` returned one room. Four POSTs with JSON `{ "protocolVersion": 1 }` and `Origin: https://foreign.example` each returned HTTP 200 and a distinct room reservation. The query then returned five rooms; after 18 seconds, all five still existed with `clients: 0`. The owned host was closed after the probe. The tested WebSocket rejection does not prevent these HTTP allocations.

**Fix:** Constrain Phase 01 public matchmaking to admission into the operator-created room and reject client-requested room creation when capacity is exhausted. Alternatively, enforce a bounded room pool and retire unused dynamically created rooms; preserve non-disposal only for the designated operator room. Apply the approved-Origin/admission policy to matchmaking HTTP requests too. Add a real HTTP regression asserting that repeated unjoined create requests cannot increase retained room count, including after reservation expiry.

### CR-02: Shared-map URL data executes JavaScript through the menu card

**Classification:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/src/main.js:87-98`  
**Related:** `C:/Programowanie/VibeOnDuty/src/editor/mapEditor.js:904-949` (supporting parser)  
**Origin:** Pre-existing before `af30e03^`; inherited in the submitted scoped client file.  
**Issue:** `mapDefFromB64()` returns attacker-controlled name, description, and thumbnail strings from the `?map=` URL. Those values are interpolated into `card.innerHTML`. A valid shared-map URL can insert an event-handler attribute and execute arbitrary JavaScript as the hosted game's origin before any map is selected. The description alone provides an unrestricted HTML sink; thumbnail attribute interpolation supplies another one.

**Evidence:** Loaded an owned production fixture in Chromium with a base64 JSON map containing `v: 2`, `w: 1`, `h: 1`, one valid floor, and description `<img src=x onerror="document.body.dataset.reviewXss=1">`. The page's `document.body.dataset.reviewXss` became `"1"`. This used a harmless sentinel and no source modification. Fixture/browser cleanup completed. The reviewed git diff confirms the sink predates this phase, so it must not be described as a newly introduced regression.

**Fix:** Construct the card with DOM nodes and assign name/description using `textContent`. Create the thumbnail with `document.createElement('img')` and a validated image URL assigned to `src`, rather than interpolating attributes; accept only the intended thumbnail formats. Add a URL-import regression that treats markup as literal text and cannot execute an event handler.

### CR-03: Legitimate hits disappear when projectile impacts reorder shot IDs

**Classification:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/src/network/onlineUi.js:64-66`  
**Related:** `C:/Programowanie/VibeOnDuty/src/shared/combat.js:153`, `C:/Programowanie/VibeOnDuty/src/shared/combat.js:197-204`  
**Issue:** The UI requires both event IDs and shot IDs to increase. Event IDs represent impact/delivery order; shot IDs represent firing order. Travelling bullets can impact in another order, and the server specifically processes projectiles newest-first. Once a later shot hits, valid lower-numbered shots are discarded even if their event ID is fresh. Health changes remain authoritative, but the shooter loses required hit marker/damage feedback.

**Evidence:** A deterministic `stepProjectiles()` probe placed two eligible body shots in one sweep against a 100-health target. The target ended at health 44. The server emitted `{ eventId: 1, shotId: 2 }` followed by `{ eventId: 2, shotId: 1 }`. Passing those actual events to `createOnlineUi()` returned `[true, false]` and produced one marker for two hits. The scoped tests check repeated identical events but never valid reversed shot IDs.

**Fix:** Deduplicate delivery with the monotonically assigned event ID. If independent shot deduplication is required, use a bounded set of seen shot IDs per connection/match/life instead of a shot-ID high-water mark. Keep existing generation checks. Add a regression using reversed shot IDs with increasing event IDs, asserting both hits present once and repeated events remain suppressed.

### CR-04: Confirmations can precede their generation patch and are dropped permanently

**Classification:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/server/tdmRoom.js:179-209`  
**Related:** `C:/Programowanie/VibeOnDuty/server/tdmRoom.js:122`, `C:/Programowanie/VibeOnDuty/src/network/onlineSession.js:275-290`, `C:/Programowanie/VibeOnDuty/src/network/onlineUi.js:54-62`  
**Issue:** `syncState()` updates the room's local schema, then `deliverCombatEvents()` immediately sends confirmations. Schema patches run separately every 50 ms. A target can respawn and be hit in that same 30 Hz step, so its confirmation arrives while the shooter's client still has the target's previous life generation. The UI treats this valid future-to-the-client confirmation as stale and drops it; nothing retries it when the patch arrives. Generation validation on the server does not establish that the browser has received that generation yet.

**Evidence:** Used a real SDK connection to an isolated production host, with an equivalent controlled room tick and a close-range server-generated M4 hit on a target whose life had advanced from 1 to 2. The authoritative target ended at health 72. The received event had `targetLifeGeneration: 2`, but the SDK schema was still at life 1; the actual UI helper returned `false` and showed zero markers. The schema subsequently reached life 2. The probe followed the production ordering `stepSimulation(1/30) -> syncState() -> deliverCombatEvents()` and exposed no production mutation endpoint.

**Fix:** Deliver after the relevant state patch, using the pinned transport's after-next-patch mechanism and rechecking membership/match/life when flushing, or retain a small bounded pending-confirmation queue until the matching generation is observed. Expire pending events when the connection/match/life retires. Add a real transport regression for a hit on a just-respawned target before the next scheduled patch; preserve rejection of genuinely retired generations.

### CR-05: The visible KILLS counter does not consume authoritative kills

**Classification:** BLOCKER  
**File:** `C:/Programowanie/VibeOnDuty/src/network/onlineSession.js:431-448`  
**Related:** `C:/Programowanie/VibeOnDuty/index.html:76`, `C:/Programowanie/VibeOnDuty/src/entities/enemies.js:224`, `C:/Programowanie/VibeOnDuty/src/entities/drone.js:70`  
**Issue:** Online snapshots contain `me.kills`, but the adapter copies neither that field nor its displayed value. `updateHUD()` updates health/ammunition, not `#kills-num`; only offline enemy/drone kill handlers update that node. Those handlers are intentionally suppressed online, so the persistent HUD shows zero after real online kills, or can retain an earlier offline value across entry. Results statistics and team scores disagree with the still-visible personal kill counter.

**Evidence:** In an isolated real production browser session, a close-range authoritative M4 kill advanced the shooter schema's `kills` to 1. After the browser observed that patch, `#kills-num.textContent` remained `"0"`. This probe used the real room's combat and existing page/adapter, and the owned browser/host were closed afterward.

**Fix:** Assign `player.kills = me.kills` and set the visible personal counter from the authoritative snapshot, or make `updateHUD()` own that counter for both modes. Reset its displayed value on online entry, retirement, and rematch. Add a browser assertion that an actual kill updates `#kills-num` and that the automatic rematch resets it to zero.

---

_Reviewed: 2026-10-04T05:53:11Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_
