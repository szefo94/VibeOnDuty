# Dedicated multiplayer server

Use Node 24 and the tracked lockfile. From the repository:

```sh
npm ci
npm run build:mp
npm run mp-server -- --port 2567 --host 0.0.0.0 --tls --public <LAN-host-or-IP>
```

For example, replace the final value with `192.168.1.20` if that is this machine's LAN
address. Open the printed `https://192.168.1.20:2567` link on both clients. The same
listener serves the built game, current GLB/weapon assets and WSS room. Browsers connect
using the page's own origin; the advertised URL never redirects or overrides it.

`npm run build:mp` builds assets at `/`. The Pages build from `npm run build` normally
uses `/VibeOnDuty/` and is rejected by this server. Rebuild after changing client source.
Ordinary server startup defaults to `dist` relative to the repository, even from a
different working directory. `--build-dir <directory>` selects another root-base
production output relative to the calling directory. Source roots, TLS storage,
symlinks and copied certificate/key files are rejected. No repository fallback exists.

## Console options

| Option | Default | Meaning |
| --- | --- | --- |
| `--port <port>` | `2567` | Integer 1–65535 on the listener |
| `--host <bind-address>` | `0.0.0.0` | Local IPv4, IPv6 or hostname/interface to bind |
| `--tls` | Off | HTTPS/WSS with an automatic self-signed testing certificate |
| `--public <address>` | Bind host, or `localhost` for wildcard binds | Bare hostname/IP or root HTTP(S) URL to print and allow as a WebSocket Origin |
| `--rules <JSON-file>` | Defaults below | Operator-owned settings; browser join data cannot override them |
| `--build-dir <directory>` | Repository `dist` | Built client to serve |
| `--help` | — | Show options and exit without listening |

A bind address selects local interfaces. `0.0.0.0` and `::` are wildcard bindings,
not player destinations, and cannot be advertised. Choose the real reachable LAN
address for other devices. Bare IPv6 is accepted, and printed URLs use brackets
(for example `https://[::1]:2567`). Firewall/NAT/DNS remain operator responsibilities.
A printed public address does not establish Internet reachability. An explicit URL
may use a different external port; that only describes the operator's routing.

Bad ports, malformed/wildcard public addresses, credentials, paths, query strings,
fragments, duplicate or unknown flags fail with corrective text and exit nonzero.
Direct `--tls` requires an HTTPS public URL. `EADDRINUSE` means choose another port
or stop that port's owning server. `EACCES` means check bind permissions or choose
an unprivileged port. `ENOTFOUND` means check that the bind hostname resolves to a
local interface. Missing/wrong-base builds instruct `npm run build:mp`.
SIGINT/SIGTERM close the owned rooms and listener. Startup failures exit finitely.

## Testing certificate and browser trust

`--tls` generates a SHA-256, 30-day certificate with a DNS or IP SAN matching the
advertised hostname. A valid pair is reused without rewriting its bytes or mtime.
Changed identity, corruption, a mismatched key, or expiry within 24 hours triggers
replacement. The atomic `pair.json` manifest contains the certificate and private
key together. A serialized startup lock prevents concurrent writers mixing pairs.

Storage is `.vod-server/tls/`, ignored by Git and outside the served build. POSIX
directory/file modes are 0700/0600. Windows grants only the current user, SYSTEM
and Administrators, removes inherited/broad grants and verifies the actual ACL.
`VOD_TLS_DIR` can select an operator-owned storage location; never put it in a
build directory. Do not share or publish `pair.json`. If a process crashes holding
`.lock`, stop every server using that storage before removing the stale lock.
Write/ACL failures abort startup without publishing a half-pair or logging PEM.

A self-signed certificate does not establish public browser trust. On a private
test network, open the advertised link and inspect the certificate warning. Check
that the hostname matches this operator's test server, then use the browser's
Advanced/proceed exception if allowed. Managed browsers can prohibit exceptions;
use a separately managed trusted reverse proxy in that case. Repeat in each
window/device/profile that needs an exception. Changed hostname/certificate may
require accepting a new warning. No certificate is silently installed in the OS
trust store. Trusted public issuance and renewal are outside this slice.

After assets finish loading, click **Online TDM** to join. Pointer lock needs that
user gesture. If a trust prompt, focus change or Escape releases the mouse, click
**Resume** in the pause menu before aiming/firing. Snapshots continue while input
is paused. Open a second window at the same link to join the same room. The current
acceptance slice admits two humans; this is not a qualified hosting capacity.

Phase 1 starts one operator-created room. Public matchmaking may only join that
room; a full room rejects new seats and never creates another room. Client room
creation and arbitrary room IDs are rejected. Unjoined seat reservations expire
without allocating more rooms. Player-created lobbies remain Phase 2.

Automated `ignoreHTTPSErrors` is a test-runner bypass. It proves HTTPS/WSS integration,
not the usability of these manual trust and pointer-lock steps. At phase-end human
acceptance, use the actual LAN link in two windows, complete trust in each, click
join/resume, then aim, move and fire with mouse lock. That check remains pending.

## Operator rules

Example `rules.json`:

```json
{ "killLimit": 50, "matchSeconds": 600, "respawnSeconds": 3, "friendlyFire": 0.25 }
```

Launch with `--rules rules.json`. Kill limit is integer 1–1000; match seconds 1–3600;
respawn seconds 0–30; friendly fire is a damage multiplier 0–1. Omitted values use
50/600/3/0.25. Results duration is fixed at 15 seconds and cannot appear in the file.
Unknown keys, nonnumeric values and out-of-bounds values fail startup. The server
owns these settings. The first player starts immediately on blue; later players join
the smaller team, choosing blue on a tie. A dead player or anyone in results can
request a switch if the resulting team-size difference is at most one. With two
balanced players, a switch is rejected until someone leaves.

Enemy kills award team score once per life; friendly kills award none. The score
limit or time limit ends combat, with equal scores producing a draw. Both players
see their authoritative personal kills in the persistent HUD, matching results
statistics. Entry/leave clear the counter, and rematch resets it from the snapshot.
Both players
see results for 15 seconds, then the server automatically starts a fresh match with
the same settings and teams. Death resets health and M4 inventory at the configured
respawn deadline; an occupied spawn waits safely. Results and death release pointer
lock, and Resume obtains the next browser gesture. Leave online remains available
during either state. Empty rooms suspend matches; a later join starts fresh.

This is operational configuration, not saved
gameplay/account persistence or a player-facing lobby editor.

## Trusted TLS reverse proxy

For a proxy that terminates trusted TLS, serve the built client and forward HTTP
and WebSocket upgrades to one private listener, preserving the external browser
Origin. The proxy owns certificate issuance/renewal and routing. For example:

```sh
npm run mp-server -- --host 127.0.0.1 --port 2567 --public https://play.example.com
```

Leave `--tls` off for this topology. The HTTPS public URL is operator information
and an allowed WebSocket Origin; the internal listener remains HTTP/WS. Forward
`/matchmake/` and room upgrade paths as well as game assets. There is no automatic
proxy setup, forwarded-host redirect, or trust in arbitrary browser origins.
Absent/unknown Origins are rejected before both matchmaking REST and WebSocket
handshakes. Direct local
listener and configured advertised origin are allowed; SDK test clients set the
approved Origin explicitly.

## Supported play and limits

The online slice uses current Greek Columns and current character/weapon assets.
WASD walks, Shift sprints, Space jumps, Ctrl/C crouches, secondary mouse aims,
primary mouse fires the M4 and R reloads. The server confirms movement/ammo/hits,
damage and score; only the shooter receives confirmed hit feedback. Weapon
switching, grenades, melee, dance, lean, slide/dive and local shop/equipment actions
are disabled online. Touch/gamepad online control expansion comes later. Use the
pause menu's leave action to return to the existing offline modes and editor.

Confirmed hits create the existing crosshair marker and a damage number at the
server impact position for the shooter. The UI rejects malformed, duplicate,
wrong-recipient and retired match/life events; feedback never awards health or
score. Confirmations follow their authoritative state patch, including hits on a
target that respawns in the same simulation step; travelling shots may confirm
in a different order from firing. Remote characters use existing cloned GLB rigs and the current M4 mount,
with readable BLUE/RED team names and team tint. Retirement releases owned rig
resources while retaining templates for later joins. Feedback expiry and remote
cosmetics continue while the local player is dead or the mouse is unlocked.

Connection failures remain at the top above pause/results overlays. **Retry**
retires the old session and joins fresh; **Return to menu** performs the normal
offline cleanup. A browser network failure may also mean missing HTTPS trust;
the banner cannot diagnose every certificate error. Confirm the advertised
address and operator certificate before retrying. Results always end after
15 seconds on the server; **Resume** obtains mouse lock without delaying rematch.

Verification uses Node24 unit/strict-boundary checks, separate Vite offline/real
production-server Playwright suites, and real asset/resource lifecycle checks.
The additional offline regression enters each local mode and the editor after
leaving a real room. Automated HTTPS contexts bypass warnings explicitly; actual
LAN trust, mouse-lock gesture usability and visual pose/feedback judgment remain
pending human acceptance. There is no security certification claim. The phase
security evidence records its applicable ASVS5.0.0 controls and this exception.

Phase2 retains lobby/prediction/latency and cross-device work; Phase3 retains other
online modes; Phase4 retains bots and measured Pi hosting profiles; Phase8 retains
richer combat; Phase9 retains loadouts and gameplay persistence. Current tests do not
classify the two descriptor-less product/requirement probes; those remain flagged
for human judgment alongside the unmeasured-capacity wording.

Prediction, measured latency handling, phone responsiveness, Raspberry Pi/ARM64
capacity, 8/12/16/24-slot qualification and device FPS benchmarks have not been
performed. This hosting work makes no capacity, smoothness or 60 FPS guarantee.

Implementation references: [selfsigned async/SAN API](https://github.com/jfromaniello/selfsigned),
[Node 24 X509 checks](https://nodejs.org/docs/latest-v24.x/api/crypto.html#class-x509certificate),
[Windows icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls).
