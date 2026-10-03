# Phase 1: Two-Client Authoritative TDM - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Two real browser clients complete a dedicated-server, authoritative TDM match using existing maps and assets. The server owns movement validation, firing eligibility, projectile hits, damage, deaths, respawns, team score, and match outcomes. Include a simple console startup command, a server-hosted browser game, and the minimum entry/lifecycle UI for this slice. Preserve existing offline modes.

The accepted roadmap places the full lobby browser and player-created/configurable lobbies in Phase 2, additional modes in Phase 3, and bot filling plus measured Raspberry Pi hosting in Phase 4. These remain commitments, with the decisions below carried forward.
</domain>

<decisions>
## Implementation Decisions

### Server entry and hosting
- **D-01:** An admin deploys a specific dedicated server. Players connect to that server; no global matchmaking or server discovery is required.
- **D-02:** One server link serves the browser game and connects it to the same server. The eventual entry flow is server link → lobby list → join or create. Phase 1 may expose just the initial TDM entry; Phase 2 supplies the full lobby browser.
- **D-03:** Preserve the operator command `npm run mp-server -- --port <port> --host <bind-address> --tls --public <advertised-address>`. Document defaults, `--help`, actionable configuration errors, and the distinction between bind and advertised addresses. The advertised address is an address/URL, not a claim of public Internet reachability.
- **D-04:** For now, `--tls` uses a self-signed certificate for testing. Automate generation and reuse to keep setup simple, explain the browser trust step, and keep private keys out of version control. Trusted public certificate issuance/renewal is outside Phase 1.

### TDM defaults and lifecycle
- **D-05:** Default to 50 team kills, a 10-minute match, and a 3-second respawn. End at the score or time limit. Rules remain adjustable; full player-facing lobby configuration is delivered in Phase 2.
- **D-06:** Friendly fire defaults to 25% damage and is adjustable per lobby. Apply the reduction on the server.
- **D-07:** Assign new players to the smaller team. Allow team switching only when it preserves balance; the server validates assignment and switching.
- **D-08:** One human player is enough to start a match; do not require a human on each team. Support solo-human, bot-filled matches once Phase 4 implements bots. Automatic start is the working interpretation of the user's correction to the proposed automatic-start rule; countdown duration is builder discretion.
- **D-09:** Show match results for 15 seconds, then automatically rematch with the same lobby settings. Reset match-owned state cleanly. An empty room should not run an endless series of matches; resume according to the one-human start rule.

### Feedback and errors
- **D-10:** Reuse the existing combat feedback: a crosshair hit marker and feedback at the character hit, visible only to the shooting player. These communicate server-confirmed hits; do not let client assertions create confirmed damage or hit feedback.
- **D-11:** Display client-side connection errors at the top of the screen. Keep messages readable and actionable.

### Builder Discretion
- Select and validate the runtime, transport, headless shared simulation, and collision approach. The prior Node/Colyseus/Rapier proposal is a candidate, not a locked technical decision.
- Choose initial existing map, bounded input/message formats, simulation and snapshot rates, and the minimal validated weapon/action set needed for real TDM. Preserve current art and weapon behavior where feasible; full combat tuning is later.
- Define deterministic tie handling, countdown duration, respawn placement, switch timing, last-player departure behavior, and phase-appropriate disconnect cleanup. Document assumptions and test lifecycle transitions.
- Choose certificate storage, CLI defaults/configuration format, logging, initial nickname handling, and minimal entry/results/error UI details without expanding into accounts or administrative dashboards.
- Do not infer that requested 8/12/16/24 slots or a 60 FPS target have already been benchmarked or qualified.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these before choosing an approach:
- `.planning/PROJECT.md` — product scope, device/hosting constraints, ordering, art and combat intent.
- `.planning/REQUIREMENTS.md` — Phase 1 requirements NET-01, NET-03, NET-04, MODE-01, HOST-03 and acceptance definitions.
- `.planning/ROADMAP.md` — phase boundaries and success criteria; full lobbies are Phase 2, other modes Phase 3, bots Phase 4.
- `.planning/research/SUMMARY.md` — project research findings and unvalidated candidates.
- `.planning/codebase/ARCHITECTURE.md` — singleton/DOM dependencies and extraction boundaries.
- `.planning/codebase/INTEGRATIONS.md` — deployment, assets, browser/runtime integrations.
- `AGENTS.md` — repository navigation, simulation eye, time units, maps, lifecycle, validation contracts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/modes/tdm.js` — existing 50-kill, 600-second, 3-second-respawn local TDM behavior; derive presentation while moving multiplayer authority server-side.
- `src/hud/hitmarker.js` — current crosshair hit marker.
- `src/fx/damageNumbers.js` — world-position damage feedback projected onto the browser HUD.
- `src/combat/shoot.js` and `src/combat/damage.js` — current moving projectiles, segment tests, damage helpers, and feedback integration points.
- Existing map definitions and character/weapon assets — reuse for Phase 1.

### Established Patterns and Integration Points
- `src/main.js`, `index.html`, `style.css` own boot/menu UI; `src/loop.js` coordinates simulation/rendering.
- `src/entities/player.js` updates bullets and effects but returns early when dead; multiplayer authority must tick independently of any browser player's life state.
- Scene/DOM side effects at import and mutable module singletons require explicit headless boundaries. Server simulation must not import a browser rendering graph.
- `src/map.js`, `src/tiles.js`, `src/rampMath.js` contain world/collision conventions. Preserve elevation/floor contracts and validate against visible geometry.
- `src/modes/modeManager.js` and `src/events.js` provide local mode/event integration; isolate authoritative online state from offline mode state.
- `vite.config.js` and existing deployment use prefix-aware asset paths; keep offline/static hosting working alongside server hosting.
</code_context>

<specifics>
## Specific Ideas

- Operator starts one server; players open its link and see lobbies inside.
- A lone human must be able to start because they may want to play with bots.
- Retain shooter-only crosshair and character-hit feedback and show connection errors at the top.
- Discussion used three concrete options and a fourth freeform choice. The self-signed TLS answer was selected by its text, despite being numbered 1 in the user's reply.
</specifics>

<deferred>
## Carried-Forward Decisions

- **Phase 2:** Server-local lobby list; players join/create lobbies; adjustable game rules and player limits using the Phase 1 defaults. Support requested capacities only through qualified profiles.
- **Phase 3:** Prepare empty lobbies for each supported game type at server launch as TDM, DM, S&D, CTF, and Hardpoint become available.
- **Phase 4:** Adjustable bot filling in the same lobby/rule model, including a single human playing with bots. Qualify Raspberry Pi capacities through measurement.
- **Later operator work:** Trusted public certificate issuance/renewal if requested; Phase 1 is self-signed testing.
</deferred>

---
*Phase: 01-two-client-authoritative-tdm*
*Context gathered: 2026-10-03*
