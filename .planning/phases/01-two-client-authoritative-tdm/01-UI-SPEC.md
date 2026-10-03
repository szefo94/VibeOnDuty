---
phase: "01"
slug: two-client-authoritative-tdm
status: implementation-reference
shadcn_initialized: false
preset: none
created: "2026-10-03"
provenance: orchestrator-derived-from-existing-ui-and-locked-context
---

# Phase 01 UI Design Contract

This bounded implementation reference records the existing game HUD and locked
CONTEXT decisions D-05 through D-11 before plan01-07 presentation changes. It has
not received a separate ui-researcher/ui-checker review. Final visual usability and
real certificate trust remain human acceptance items.

## Design System

| Property | Value |
| --- | --- |
| Tool/component library/icon registry | None; existing HTML, CSS and game HUD |
| Font | Existing Courier New/monospace; no font download |
| Existing references | style.css damage numbers and dark/gold overlays; onlineSession.js match controls |
| New dependencies/assets | None |

## Spacing Scale

Use 4/8/16/24/32px for new overlay spacing. Preserve the existing 12px match-control
viewport inset and compact HUD proportions where integration requires them.
Constrain panels to viewport width with a 12px minimum inset; wrap long text.
Buttons must remain reachable when text wraps. This desktop acceptance slice does
not qualify phone input or performance; cross-device work remains Phase2.

## Typography and Color

Use 14px body/status text and 16px bold result/error headings with at least 1.4
line height. Preserve existing game HUD metrics and 17px damage numbers. Use dark
surfaces (#111 or existing translucent dark overlays), light text (#fff/#ddd),
and existing gold (#e8c84a) for emphasis and key actions. Blue/red team indicators
must include readable team names; color alone never identifies a team. Error text
must contrast against its dark background and include an actionable explanation.
Do not restyle unrelated menus/editor controls.

## Copywriting Contract

| Element | Contract |
| --- | --- |
| Entry | Keep Online TDM; disabled until assets settle; supported current M4 controls remain visible |
| Waiting | Waiting for players; a single human starts immediately |
| Rules/team | Show authoritative BLUE/RED assignment, scores, remaining time and configured rules |
| Switch | Switch team; disabled when ineligible; explain a server rejection without changing local assignment |
| Results | BLUE wins / RED wins / Draw; final scores, own statistics, Rematch in Ns |
| Resume | Resume obtains a user gesture for pointer lock; server rematch never waits for this click |
| Error actions | Retry and Return to menu |
| Error message | State the connection problem and recovery path; never promise precise certificate diagnosis |

## State and Interaction Contract

- Preserve stable team/results/resume IDs from plan01-05 and exactly one owner per
  DOM element. Static markup replaces duplicate dynamic creation in the adapter.
- Place #mp-error-banner at the top with role=alert/aria-live, above pause/results
  overlays. Keep #mp-retry-btn and #mp-error-return-btn keyboard reachable, visibly
  focusable, and usable through disconnection. Hide and clear stale errors on a new
  successful session. Retry first retires the old session/actors; Return uses the
  existing full menu cleanup.
- Render nickname and error content with textContent. Cap guest names according
  to the server's 24-character rule; wrap untrusted long errors without overflow.
- Only valid current-recipient session/match/life/shot/event confirmations produce
  existing crosshair hitmarker and world damage number at the server impact.
  Duplicate/stale/victim events produce none. Feedback never changes health.
- Tick and expire cosmetics while dead or unlocked; clear them on session/match
  retirement. Death, respawn, fixed15-second results and rematch follow snapshots.
- Preserve offline Incursion, Adaptive, S&D, TDM, range and editor menu paths.
  No lobby creation/list, bots, extra weapons, assets or capacity claims are added.

## Evidence and Pending Judgment

| State | Required evidence |
| --- | --- |
| Loading / one / two players | Existing entry and teams production tests |
| Error / retry / return / long text | onlineUi unit tests and real errors browser scenario |
| Hit / duplicate / stale / victim | UI units, authority/feedback browser scenarios |
| Death / results / respawn / rematch | lifecycle/resources scenarios and screenshots |
| Offline return and shared assets | offline regressions and real GLB resource checks |
| Real LAN certificate trust and gesture usability | Pending human check at phase end |
| Unmeasured-capacity wording and descriptor-less probes | Remain flagged for phase-end human judgment |

Registry safety: no component registry is used. Automated and visual evidence must
be recorded after implementation; this contract itself establishes no test pass,
visual approval, 60FPS, device capability or RaspberryPi capacity qualification.
