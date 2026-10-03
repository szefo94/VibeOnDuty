# Phase 1: Two-Client Authoritative TDM - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in CONTEXT.md.

**Date:** 2026-10-03
**Areas discussed:** Joining, TDM rules/lifecycle, combat feedback/errors, server startup/TLS

## Joining a match

**Question:** How should players join a Phase 1 match?

| Option | Description |
| --- | --- |
| 1 | Server address + nickname |
| 2 | Shareable join link |
| 3 | Preconfigured server |
| 4 | Specify your own |

**User choice:** Admin deploys a specific server and players connect to that configured server. Beneath it players can create/join lobbies. All game rules, player limits, and bot filling are adjustable. Launch with empty lobbies for each game type.

**Notes:** Carry forward fixed-server entry in Phase 1; full lobby creation/configuration belongs to Phase 2, additional modes to Phase 3, bot filling to Phase 4 under the existing roadmap. Initial TDM defaults are recorded below.

## Combat feedback and connection errors

**Question:** User supplied feedback preferences while answering joining flow.

**User choice:** Reuse current system: crosshair hit marker and feedback on the hit character, visible only to the shooting player. Show client-side connection errors at the top of the screen.

## TDM defaults and match lifecycle

**Question:** Which initial TDM preset should we use?

| Option | Description |
| --- | --- |
| 1 | 50 team kills, 10 minutes, 3-second respawn |
| 2 | 20 kills, 5 minutes, 2-second respawn |
| 3 | 100 kills, 15 minutes, 5-second respawn |
| 4 | Specify your own |

**User choice:** 50 team kills, 10 minutes, 3-second respawn; all adjustable.

**Question:** How should friendly fire work by default?

| Option | Description |
| --- | --- |
| 1 | Off |
| 2 | Full damage |
| 3 | 25% damage |
| 4 | Specify your own |

**User choice:** 25% damage; adjustable per lobby.

**Question:** How should players join teams?

| Option | Description |
| --- | --- |
| 1 | Automatic balancing with balanced switching |
| 2 | Free choice |
| 3 | Automatic assignment only |
| 4 | Specify your own |

**User choice:** Assign players to the smaller team; allow switching if it keeps teams balanced.

**Question:** When should a match start?

| Option | Description |
| --- | --- |
| 1 | Automatically once both teams have players, with a 10-second countdown |
| 2 | Ready check with both teams populated |
| 3 | Lobby creator starts it with both teams populated |
| 4 | Specify your own |

**User choice:** A match must also start with only one human player; the player may want to play with bots.

**Notes:** Remove the requirement for both teams to contain human players. Automatic start with one human is the working interpretation; countdown duration remains builder discretion unless specified. Bot filling is scheduled for Phase 4 and must support solo-human matches.

**Question:** What should happen when a match ends?

| Option | Description |
| --- | --- |
| 1 | Automatic rematch after 15-second results screen |
| 2 | Return to lobby and wait for start |
| 3 | Automatic map rotation |
| 4 | Specify your own |

**User choice:** Show results for 15 seconds, then automatically start another match with the same lobby settings.

## Server startup and TLS

**Question:** How should players open the game after the admin launches the server?

| Option | Description |
| --- | --- |
| 1 | One server link serving the browser game |
| 2 | Separate game website connecting to the configured server |
| 3 | Support both |
| 4 | Specify your own |

**User choice:** The server also serves the browser game. Opening its link connects players to that server, then displays the lobbies inside.

**Notes:** Preserve a single-link, same-server entry path. Phase 1 provides the initial TDM entry; the full join/create/configure lobby browser remains Phase 2 under the accepted roadmap.

**Question:** How should HTTPS work with --tls?

| Option | Description |
| --- | --- |
| 1 | Admin supplies certificate files |
| 2 | Automatic certificates for a domain |
| 3 | Self-signed certificate for testing |
| 4 | Specify your own |

**User choice:** Self-signed certificate for testing, for now. The browser requires a trust step.

**Notes:** The user selected the self-signed option by its text despite numbering it 1. Builder should automate certificate generation and reuse for easy testing. Trusted public certificate automation is not required in Phase 1.

## Discussion format

**Question:** User requested proposals.

**User choice:** Provide three concrete options and a fourth custom-answer option, with recommendations.

## Completion

Options: finish discussion (recommended); refine match behavior; refine server operation; specify another topic.

**User choice:** Finish discussion — save phase context, ready for gsd-plan-phase 1. User then explicitly invoked gsd-plan-phase.

## Builder Discretion

Technical stack, rates, tie handling, countdown duration, spawn selection, disconnect cleanup, certificate storage and UI details; see CONTEXT.md for boundaries.

## Carried-Forward Ideas

- Phase 2: configured-server lobby list with player join/create and adjustable match rules/player limits.
- Phase 3: auto-created empty lobbies for each supported game type as the selected modes become available.
- Phase 4: configurable bot filling beneath the same lobby/rule model.
- Trusted public certificate automation is deferred; self-signed testing is selected for now.
