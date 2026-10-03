# Walking Skeleton — VibeOnDuty Authoritative TDM

**Phase:** 1  
**Generated:** 2026-10-03  
**Status:** Planned; capability has not been implemented or verified.

## Capability to Prove End-to-End

Two real browsers open the dedicated server's built-game link, see current character rigs on Greek Columns, move and exchange a server-derived M4 hit. Plan01-02 requires this tracer GREEN before movement/combat/lifecycle expansion. The complete phase adds death,respawn,server-scored winner and automatic rematch.

**As a** browser player, **I want to** complete a fair server-scored TDM match with another player using the current maps and assets, **so that** both players share authoritative outcomes. This is the accepted ROADMAP goal expressed as a story, not a new decision.

## Architectural Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Client framework | Existing Three.js r160, Vite8, plain JavaScript ESM | Preserve assets,offline game and current render/input conventions |
| Runtime/transport | Node24, exact approved Colyseus core0.18.18/SDK0.18.4/schema5.0.35/ws-transport0.18.4 | Isolated compatibility probe passed; flagged release recency still needs human approval |
| Simulation | Instance-based grid world and numeric movement/projectiles in src/shared | Reuse current tile/ramp semantics without browser globals or a physics conversion |
| State ownership | One world/rules instance per TdmRoom;30Hz fixed step/20Hz replication | Server derives outcomes; rates are initial unqualified assumptions |
| Map | Existing bunker/Greek Columns, data-only canonical extraction | Renderer and server share actual tiles/heights/spawns |
| Identity | Framework guest session, current match/life generations, bounded nickname | No account or persistent progression scope inPhase1 |
| Data layer | In-memory room/gameplay state; restricted operational certificate files | Certificate generation/reuse needs actual disk read/write; gameplay persistence remainsPhase9 |
| Hosting | Express5.2.1 built-root static plus shared HTTP/HTTPS and WS/WSS listener | One same-origin browser link per D-01/D-02 |
| Testing TLS | selfsigned5.5.0, SAN/date/key validation, ignored .vod-server/tls/ | Automate locked D-04 testing certificate generation and reuse |
| Directory layout | src/shared,src/network,server,tests/helpers | Separate authority, browser presentation and operational lifecycle |

The greenfield skeleton template's framework scaffold/database/account rows are adapted to this existing game: reuse its working build/lint/test scaffold, exercise real transport and UI, and perform operational certificate disk write/read instead of adding a database or account feature. Phase9 still owns gameplay persistence. The adapted skeleton is not evidence that a database read/write or authentication feature exists.

## Stack Touched in Phase1

- [ ] Existing scaffold extended with approved exact packages,Node24,strict checked boundaries and server-test discovery.
- [ ] Real route: built game/assets,/health and same-server room transport.
- [ ] Real operational disk write/read: certificate creation followed by valid same-host restart reuse.
- [ ] UI: asset-ready Online TDM join,real movement/fire,team/score/results,top errors and leave/retry.
- [ ] Local full-stack run: npm ci,npm run build:mp,npm run mp-server -- --port 2567 --host 0.0.0.0 --tls --public <test-host>.

These checkboxes stay pending until execution evidence exists.

## Dependencies and Waves

| Plan | Wave | Needs | Creates / observable increment | Checkpoint |
| --- | --- | --- | --- | --- |
|01-01|1|Existing configs/research|Approved runtime and production-server test harness|Blocking exact-release human verification before install|
|01-02|2|01-01|First real two-browser move/M4-hit tracer,canonical map,online entry/exit|None; tracer GREEN gates expansion|
|01-03|3|01-02|Supported movement/ADS plus raw hostile-command rejection|None|
|01-06|3|01-02|Actual CLI/static/TLS link and certificate reuse|None; trust checked at phase end|
|01-04|4|01-03|Eligibility,reload,earliest swept hit and forged-outcome resistance|None|
|01-05|5|01-04,01-06|Teams,one-human start,death/respawn,winner/results/rematch|None|
|01-07|6|01-05,01-06|Resource/feedback/error polish,offline/security/full acceptance|Phase-end human checks,not install approval|

Wave3 plans have no modified-file overlap. Test mutations are separated:01-03 owns multiplayer.spec.js while01-06 owns hosting.spec.js. Every browser fixture creates a distinct OS-temp vod-mp- root and Vite build subdirectory,passes it through --build-dir (available in first tracer01-02-01),serves only that output and removes only its owned root after its child server stops. Concurrent tests never write/read shared repository dist; normal operator build:mp and default server continue using dist. All other shared-file work is sequential. Every implementation task modifies at most5 named files.

Plans01,02,03,06,07 cross the10-file support-scope warning threshold; each has explicit scope accounting separating production behavior from configs,tests,helpers or evidence. Structural token projections for01..07 are21k,29k,23k,22k,24k,21k,22k against100k per-plan smart-zone budget. Calibration factor1/sample_count0/low confidence means these are uncalibrated estimates,not observed execution measurements. All tasks remain bounded to5 modifications,and each coherent vertical slice carries its own runnable verification rather than an artificial horizontal support-file plan.

## Multi-Source Coverage Audit

| Source | ID / feature | Plans | Status |
| --- | --- | --- | --- |
|GOAL|Two current-asset browsers complete fair server-scored TDM|01-02,03,04,05,07|COVERED|
|REQ|NET-01 real browser match|01-01,02,03,04,05,06,07|COVERED|
|REQ|NET-03 validated server movement|01-02,03,05,07|COVERED|
|REQ|NET-04 server firing/travel/hits/death/score|01-02,04,05,07|COVERED|
|REQ|MODE-01 teams/respawns/winner|01-02,05,07|COVERED|
|REQ|HOST-03 CLI/TLS/public/bind/help/errors|01-01,02,06,07|COVERED|
|CONTEXT|D-01 dedicated specific server|01-02,06|COVERED|
|CONTEXT|D-02 same-origin link and initial TDM entry|01-02,06|COVERED|
|CONTEXT|D-03 exact command/defaults/help/address semantics|01-06|COVERED|
|CONTEXT|D-04 self-signed generation/reuse/private keys/trust|01-06,07|COVERED|
|CONTEXT|D-05 50kills/600seconds/3respawn,adjustable server rules|01-05,06|COVERED|
|CONTEXT|D-06 adjustable0.25 friendly damage|01-04,05|COVERED|
|CONTEXT|D-07 smaller team/balanced switches|01-05|COVERED|
|CONTEXT|D-08 one-human automatic start|01-02,05|COVERED|
|CONTEXT|D-09 results15seconds,same-settings rematch,empty pause|01-05|COVERED|
|CONTEXT|D-10 shooter-only confirmed marker/character hit feedback|01-02,04,07|COVERED|
|CONTEXT|D-11 top readable actionable connection errors|01-07|COVERED|
|RESEARCH|Exact probed stack,recency checkpoint,lock/runtime alignment|01-01|COVERED|
|RESEARCH|Headless world,canonical map,terrain/body/spawn parity|01-02,03|COVERED|
|RESEARCH|Fixed server step,finite schemas,membership,ack/seq/generation,rate/queue bounds|01-03|COVERED|
|RESEARCH|M4/ADS/reload/spread,receive-time ballistics,earliest impacts,floor obstruction|01-02,03,04|COVERED|
|RESEARCH|Death-once,old-life/projectile/disconnect/empty/tie/switch/reset rules|01-04,05|COVERED|
|RESEARCH|Current assets/rigs/simulation-eye/time/cleanup/offline preservation|01-02,03,07|COVERED|
|RESEARCH|One HTTP/HTTPS host,dist/base/origin rules,address validation|01-06|COVERED|
|RESEARCH|Async certificates,SAN/key/date,reuse,restricted ignored storage|01-06|COVERED|
|RESEARCH|Private feedback/top errors,dead/unlocked cosmetics,resume gesture|01-02,05,07|COVERED|
|RESEARCH|Strict new-boundary checking,meaningful discovery/hostile/real-browser/CLI-TLS tests|01-01 through07|COVERED|
|RESEARCH|ASVS5.0.0 Level1,high blocking,unique STRIDE IDs,safe DOM/logs|01-01 through07|COVERED|
|RESEARCH|Unqualified tick/snapshot/spawn/performance assumptions documented/tested|01-02,03,06,07|COVERED|

No in-phase source item is omitted. Research Rapier/ws alternatives are not direct installs. The full-lobby,modes,bots/capacity and persistence recommendations belong to later accepted phases and are exclusions,not gaps.

## Spec-less Probe and Prohibition Record

Input01-EDGE-COVERAGE.json has8 applicable rows,including2 unclassified rows. Six classified rows have explicit planned predicates in must_haves.truths:

| Edge | Planned resolution | Plan/task |
| --- | --- | --- |
|NET-01 adjacency|Tangent allowed,inward overlap blocked,spawns separate|01-02-02 world tests|
|NET-01 empty|Zero suspends,one starts,empty/null join uses bounded guest defaults|01-05-01/02 rules/room tests|
|NET-01 ordering|Tie team blue,stable join ordinal,projectile/score-first expiry,draw on tie|01-05-01/02 rules tests|
|NET-03 concurrency|One intention/player/fixed tick,room isolation,flood never accelerates|01-03-02 protocol/SDK tests|
|NET-04 boundary|Ready-time/ammo/reload/lifetime exact limits and neighboring cases|01-04-01 combat tests|
|NET-04 precision|Earliest t,epsilon1e-7,obstruction-first ties,fractional health|01-04-01 combat tests|
|MODE-01 unclassified|Flagged assumption; no invented automatic classification|01-07 truths/human check|
|HOST-03 unclassified|Flagged assumption; explicit CLI/TLS checks cover known scope|01-06 truths/human check|

These are planned explicit checks,not executed resolutions. Original probe report remains the input/audit artifact. No backstop is substituted for the unclassified rows.

Prohibition recall examined each Phase1 requirement for unwanted product drift; precision dropped routine collision,queue,file-handle,validation and replay items into ordinary tests. OWASP/path traversal/injection/secret handling and generic security fairness are canon and refer to the phase threat models plus security verification,not minted prohibitions. Retained bespoke transparency: present unmeasured slots/Pi/FPS as qualified results. It is authored once in01-07 must_haves.prohibitions with unresolved status and no wired-check descriptor,using the projectProhibitions flat projection; downstream must flag it unverified for human judgment. There are no invented passing mechanical descriptors.

Assumption-delta detector returned detected:false before planning. Graph context is disabled. No phase SPEC/UI-SPEC/AI-SPEC exists; current-UI token gate allows continuation (hasFrontendEvidence=false,block=false). Use locked minimal UI decisions. No AI integration occurs here.

API coverage detector ran on the nonempty Phase1 ROADMAP section plus all seven plans and returned detected:false. No external service capability surface is integrated: Colyseus is an in-process transport/room dependency around this game's owned server. No external-API coverage matrix or checkpoint is required.

## Carried-Forward Scope

- Phase2: free-for-all Deathmatch (MODE-02),server-local lobby list/create/configuration,requested capacity profiles,responsive prediction/replay,network impairment,cross-device performance.
- Phase3: S&D,CTF,Hardpoint and launched empty mode lobbies as supported.
- Phase4: bot fill/solo-human-with-bots and measured RaspberryPi hosting capacity.
- Phase5 onward: full movement/art/animation/weapon overhauls;Phase9 gameplay persistence;Phase11/12 editor/final maps.
- Trusted public certificate issuance/renewal is outside locked self-signed testing scope.

This phase changes no branch and claims no measured8/12/16/24 capacity,Pi qualification or60FPS result.
