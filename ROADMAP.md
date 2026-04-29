# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, asset-gated init, map registry
  loop.js               — game loop, 3rd-person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — live-binding MAP/HMAP exports, setActiveMap(def)
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  level.js              — buildLevel(mapDef) — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torchLights[] — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
  gamepad.js            — Standard Gamepad API (left stick, right stick, all buttons mapped)
  maps/
    bunker.js           — Greek Columns mapDef (complex arena, ramps, cracks, torches)
    rooftop.js          — Rooftop District mapDef (outdoor, HVAC cover, daylight)
    concept.js          — Column Arena mapDef (marble pillar prototype)
  modes/
    modeManager.js      — setMode/getMode/isAnyModeActive (zero-dep registry)
    snd.js              — S&D match state machine, round lifecycle, bomb logic
  ai/
    enemyStates.js      — PATROL/SPOTTED/ATTACK + transitionTo, alertEnemy, semiAlertEnemy
  builders/
    weapon.js           — player weapon model
    playerBody.js       — full soldier body
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — enemy pistol GLTF
    weaponFBX.js        — player M4/P90 FBX loader
    assetManager.js     — register/loadAll parallel asset registry
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    entityBase.js       — applyEntityBase mixin (isAlive, takeDamage)
    player.js           — player state, movement, dive, lean, reload
    enemies.js          — enemy AI loop, S&D team spawn, kill/death events
    friendlyBots.js     — allied bot AI (A*, LOS, bot-vs-bot shooting)
    drone.js            — drone runtime (AI, EMP, orbit, S&D recon drones)
    waveSystem.js       — wave state, tickWave, triggerWaveEnd
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
  utils/
    los.js              — hasLOS raycaster utility
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade sparks + smoke cloud + impact zones; 90-particle budget cap
    meleeRange.js       — melee ring flash
    screenShake.js      — triggerScreenShake / tickScreenShake (CSS translate on canvas)
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash(srcX,srcZ), showKillFeed
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — drawHUD dispatcher; setDebugAnimClip + setDebugFrameMs (⏱ in F3 panel)
    rings.js            — ammo/energy/reload rings + spray cone + hit-dir arc; viewport-scaled; healthColor
    enemyBars.js        — drone bar, grenade impact zones, enemy HP bars
    radar.js            — drawMinimap (canvas)
    sndHud.js           — S&D match header, bomb timer, plant/defuse bars, result overlay
  *.test.js             — Vitest unit tests (54 tests, 5 files)
tests/
  smoke.spec.js         — Playwright smoke tests (7 tests)
types/
  entities.d.ts         — EntityBase, Enemy, Player, Drone, AiState, AiCtx interfaces
```

> **Run:** `npm run dev` — Vite dev server. Do NOT open via `file://`.

---

## Completed

| Phase | Summary |
|-------|---------|
| 1–4 | npm + Vite, module split from monolithic game.js, Vitest + Playwright, ESLint/Prettier/TS |
| 5 | Velocity movement, stagger on hit, A\* throttle, drone orbit + EMP, 3rd-person camera, lean, dive |
| 6 | GLTF enemy + player mesh, AnimationMixer crossfade, M4/P90 FBX, enemy pistol GLTF |
| 7 | S&D mode: best-of-7, two sites, plant/defuse, 60 s timer, 5v5 bot teams, round lifecycle |
| 8 | `los.js`, `friendlyBots.js`, `waveSystem.js`, `sndHud.js` extracted; 21 S&D unit tests |
| 9 | `entityBase.js` mixin, AI state machine in `ai/enemyStates.js`, TS interfaces |
| 10 | `events.js` pub/sub; enemies/waveSystem emit events instead of direct cross-module calls |
| 11 | `assetManager.js` with `register`/`loadAll`; start buttons gated until all assets resolve |
| 12 | Drone constants to module scope, grenade→drone damage fix, A\* diagnostic, state guard |
| 13 | Dead `ehm`/`rebuildEHM` removed (bullet detection uses distance, not raycasting) |
| 14 | HUD split: `rings.js` (player rings), `enemyBars.js` (bars + impact zones), `hud.js` → 35 lines |
| 15 | `modeManager.js`; `snd.js` decoupled from loop/enemies/drone/waveSystem via event bus |
| 16 (patch) | Circular ESM dep broken: `snd:configure` event-bus injection in `enemyStates.js` + `enemies.js` |
| 20 | Screen shake (`screenShake.js`), kill feed, smoke cloud, hit-direction arc in `rings.js` |
| 23 | AI tick culling for distant patrollers, 90-particle budget cap, frame-time in F3 debug panel |
| 24 | Gamepad API (`gamepad.js`), viewport-relative HUD ring scaling in `rings.js` |
| bugfix | Dance animation set to `LoopOnce`; `finished` event auto-clears `player.dancing` |
| 21 | Three maps: Greek Columns (original arena), Rooftop District, Column Arena concept. `buildLevel(mapDef)` refactor, `setActiveMap` live bindings, per-map spawn/sites/lighting/fog. Map selector overlay with 3 cards. Fixed rooftop player spawn + HVAC pillar rendering. |

---

## Upcoming

### Phase 16 — Drone GLTF *(stretch — needs asset)*

Wire `src/builders/droneGLTF.js` once `public/models/drone.glb` is available. Register as `'drone-glb'` in `assetManager`. Procedural fallback stays if asset missing.

---

### Phase 17 — Audio system

Web Audio API with spatial sound via `PannerNode` (positioned relative to camera). No external library needed — Three.js `AudioListener` + `PositionalAudio` or raw `AudioContext` both work.

- Gunshot blast (player + enemy), footstep surface detection, grenade explosion
- Bomb plant/defuse tick, round-start countdown
- Ambient loop, alert bark when enemy spots player
- Mute/volume control in overlay

---

### Phase 18 — Weapon expansion

The P90 FBX loader already exists (`weaponFBX.js`) but the P90 is never selectable. Make weapons a first-class concept.

- Per-weapon config block in `config.js` (damage, fire rate, spray pattern, mag size, reload time, ADS FOV)
- Key `1`/`2` to switch M4 ↔ P90; pistol as tertiary (`3`)
- Weapon indicator in HUD (icon + active ammo ring)
- S&D round reset applies full loadout per weapon

---

### Phase 19 — Weapon buy menu (S&D)

Counter-Strike style buy phase at the start of each round. Player spawns with a pistol only; the buy window is open for the first 10 s of the round (or until the player leaves spawn).

- **Buy menu UI** — press `B` to open a fullscreen overlay listing available weapons grouped by category (rifles, SMGs, pistols, equipment). Clicking a row purchases it and closes the menu; `ESC` closes without buying.
- **Economy** — each player starts a match with $800. Kills earn $300, planting earns $300, defusing earns $300, winning a round earns $900, losing earns $1 400 (loss bonus, same as CS). Balance shown in HUD top-left during buy phase.
- **Weapon prices** — examples: M4A1 $2 900, P90 $2 350, pistol $500, grenade $200. Prices stored per-weapon in `config.js`.
- **Bot economy** — friendly bots auto-buy the best weapon they can afford; enemy bots follow the same rule (creates eco rounds naturally).
- **Carry-over** — weapons and remaining balance carry between rounds; death resets weapon to pistol but keeps $500 minimum floor.
- **Implementation sketch** — `src/modes/buyMenu.js` owns the DOM panel and economy state; emits `buy:weaponSelected` event consumed by `player.js` and `friendlyBots.js`. S&D round start emits `round:buyPhase` with a deadline timestamp; buy menu disables itself when deadline passes.

---

### ~~Phase 21 — Second map + map selector~~ ✅ Done

#### Map 1 — Current: "The Bunker" (indoor, exists)

Dark brutalist interior — concrete walls, torchlit corridors, ramp ledges, cracked crawl gaps. Two bomb sites inside the structure. Tight sightlines, lots of cover.

#### Map 2 — "Rooftop District" (outdoor, new)

An elevated urban rooftop complex — multiple connected building tops with HVAC units, water tanks, cable runs, and open sky. Much longer sightlines than the Bunker; sniping corridors offset by hard cover clusters.

**Scenery ideas:**
- **HVAC units** — large box geometry (sheet metal texture), give cover between lanes. Can be procedural or replaced with a GLTF asset.
- **Water tanks** — cylindrical geometry on tripod legs; landmark for callouts ("tank side", "north tank").
- **Chain-link fences** — low-poly plane meshes with a transparent fence texture (alpha cutout); breaks sightlines partially.
- **Satellite dishes + antenna masts** — tall vertical landmarks visible from anywhere on the map.
- **Overhangs / raised catwalks** — metal grid walkways above the main level; additional vertical plane.
- **Neon signage** — emissive plane meshes, `MeshBasicMaterial` with glow colour. Aesthetic only but adds mood lighting.
- **Distant city backdrop** — low-poly skybox buildings or `THREE.Sprite` billboards at the map edge; sells the "high up" feeling.

**Lighting:**
- Daytime: directional sun at low angle (golden hour), long shadows, `THREE.HemisphereLight` sky/ground gradient.
- Site A: near a glowing billboard — warm orange point light.
- Site B: near an antenna cluster — cool blue point light.
- Replace `FogExp2` with a lighter haze (`density: 0.006`); open air should be clearer than a bunker.

#### Free asset sources to replace procedural shapes

All permissive licences (CC0 / CC-BY / MIT) — drop into `public/models/`:

| Asset | Source | Format | Use |
|-------|--------|--------|-----|
| HVAC unit | [Sketchfab — CC0](https://sketchfab.com/search?q=hvac+unit&licenses=7c23a1ba438d4306920229c12afcb5f9) | GLTF/GLB | Rooftop cover |
| Water tower | [Poly Pizza — CC0](https://poly.pizza/search/water+tower) | GLTF/GLB | Landmark |
| Chain-link fence panel | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=chain+fence) | PNG texture | Alpha plane |
| Brick / concrete textures | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=brick) | PNG (albedo+normal+rough) | Wall materials |
| Metal grating texture | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=metal+grate) | PNG | Catwalk floor |
| Neon sign | [Sketchfab — CC0](https://sketchfab.com/search?q=neon+sign&licenses=7c23a1ba438d4306920229c12afcb5f9) | GLTF/GLB | Mood lighting |

To use a texture from ambientCG: download the 1K PNG set, create a `THREE.MeshStandardMaterial` with `map` (albedo), `normalMap`, `roughnessMap` — instant PBR surface.

#### Code changes

- `level.js` refactored: `buildLevel(mapDef)` accepts a map definition object instead of hardcoding MAP import.
- Map definition shape: `{ tiles, heightmap, sites, spawnZones, lightColor, fogDensity, name }`.
- Map 1 ("Bunker") and Map 2 ("Rooftop") each export a `mapDef` object from `src/maps/`.
- `config.js` S&D site coords move into the map definition — `snd.js` reads them from the active map.
- Overlay gets a map carousel (thumbnail + name) before mode select; selection stored in `modeManager`.

---

### Phase 22 — Multiplayer foundation

Real-time 5v5 S&D over WebSocket. The existing bot AI stays as filler for empty slots; the goal is to replace bots one-for-one with human players without restructuring the game loop.

#### Architecture

```
Browser A ──WS──┐
Browser B ──WS──┤
Browser C ──WS──┤── Server (Node / Cloudflare Worker) ── authoritative match state
Browser D ──WS──┤
Browser E ──WS──┘
```

- **Server is authoritative for round state** (score, timer, bomb, role swap) but **not for movement** — movement stays client-authoritative to keep latency invisible. Hit detection is server-confirmed (lag-compensated rewind to 100 ms history).
- **Tick rate**: server at 20 Hz; clients interpolate remote players between ticks at 60 fps.

#### Packet design (MessagePack or compact JSON)

| Direction | Message | Fields |
|-----------|---------|--------|
| C → S | `move` | `x, z, yaw, pitch, ts` |
| C → S | `shoot` | `ts, targetId` (id of entity hit, or null) |
| C → S | `action` | `type` (plant/defuse/grenade), `x, z, ts` |
| S → C | `world` | array of `{id, x, z, yaw, hp, state, team}` per remote player |
| S → C | `hit` | `victimId, dmg, killerId` |
| S → C | `round` | `event` (start/end/bomb/defuse/timeout), `payload` |
| S → C | `chat` | `senderId, team, text` |

#### Client-side changes

- `src/net/socket.js` — WebSocket wrapper, connect/disconnect, send queue, reconnect backoff.
- `src/net/remotePlayer.js` — one instance per remote human; holds interpolation buffer (last two `world` snapshots), lerps position/yaw between ticks. Reuses `buildEnemyMesh` for rendering so remote players look identical to bots.
- `src/net/netSync.js` — reads local player state each frame, diffs against last sent packet, emits `move` at 20 Hz max. Consumes incoming `world` / `hit` / `round` messages via the event bus (`on('net:world', ...)` etc.).
- `enemies.js` `spawnSndEnemies` — accept a `remotePlayers` map; skip bot slots that are occupied by a remote human connection.

#### Server-side (Node.js, ~300 lines)

- `server/index.js` — `ws` library, room management (one room = one S&D match, up to 10 clients).
- `server/matchState.js` — mirrors `snd.js` state machine: round timer, bomb, score. Ticks at 20 Hz via `setInterval`. Broadcasts `round` events on transitions.
- `server/lagComp.js` — ring buffer of player positions per client (last 10 ticks = 500 ms). On `shoot` message, rewinds world to `ts - latency`, checks hit against rewound positions, broadcasts confirmed `hit`.
- No physics on server — trust client position, only validate that delta per tick is ≤ `ENEMY_SPEED * tickInterval * 1.5` (basic speed-hack guard).

#### Lobby & matchmaking

- Room code system: host generates a 4-char code, shares it out-of-band. Clients join via `?room=XXXX` query param.
- Overlay gets a **[ HOST ]** and **[ JOIN ]** button alongside DROP IN / S&D. Join flow: enter room code → connect → wait in lobby until host starts the match.
- Lobby shows connected players (name = browser-generated adjective-noun, e.g. "SilentViper"), team assignment, ready state.

#### Bot fill

- Server tracks human slot count per team. Any slot below 5 without a human is flagged `botFill=true`.
- Each client simulates its own team's bots locally (same `friendlyBots.js` tick). Remote team bots are driven by the server's designated "bot host" — the first client to connect. If bot host disconnects, server promotes the next client.

#### Scope boundary

Phase 22 ships: position sync, hit confirmation, round state sync, lobby, room codes.  
Out of scope for Phase 22: voice chat, ranked matchmaking, anti-cheat beyond speed guard, spectator mode.

---

### Phase 25 — Progression & persistence

- `localStorage` store: lifetime kills, matches won, best wave, accuracy
- Match-end scoreboard (K/D/A, accuracy %, plants/defuses) with share-to-clipboard
- Kill streak rewards: 3-kill → ammo refill, 5-kill → drone strike (reuses recon drone logic), 7-kill → EMP across map
- Wave mode: difficulty ramp-up curve (enemy speed + damage increase per wave tier)

---

### Phase 26 — Bot personality modes

Give bots distinct play styles so repeat sessions feel different and difficulty is tunable.

- **Tiers**: Passive (holds angles, retreats when hurt), Competitive (rotates, uses cover intelligently), Aggressive (pushes site, peeks fast, ignores health).
- Per-bot `personality` field on the enemy object; `enemyStates.js` reads it for decision weights (peek chance, retreat threshold, reaction delay).
- S&D lobby lets players choose enemy difficulty before starting — stored in `config.js` as `BOT_PERSONALITY`.
- Passive bots work great as tutorial fodder; Aggressive tier provides a real challenge once players know the maps.

---

### Phase 27 — Killcam / round-end highlight

Replay the last 3 seconds of a round (or the killing blow on the player) when the round ends.

- **Ring buffer**: each tick, snapshot `{ pos, yaw, pitch, hp }` for every entity into a circular buffer (3 s × 60 fps = 180 entries per entity). `src/replay/replayBuffer.js`.
- On player death or round end, detach the live camera and play back the buffer from the killer's POV: position-lerp + yaw-lerp at 1× speed.
- Overlay shows "KILLCAM" badge and a "SKIP" button; after 3 s (or skip) the round result screen appears as normal.
- No additional server state needed — purely client-side ring buffer.
- **Why it matters**: players love rewatching the kill that ended them; it also subtly teaches map positions and angles.

---

### Phase 28 — Advanced movement mechanics

Add a movement skill ceiling that rewards practice and separates casual from competitive play.

- **Bunny hop**: if player jumps within ~80 ms of landing and strafes, preserve a fraction of horizontal momentum (source-engine style). Cap at `PLAYER_SPEED * 1.35` to prevent infinite acceleration.
- **Wall-slide**: when sprinting into a wall at an angle, player slides along it instead of stopping dead — feels smooth and prevents frustrating stutter.
- **Ledge grab**: if the player walks into geometry that is ≤ 0.9 m above their head, auto-climb over it (short tween, ~200 ms). Works on HVAC boxes, low walls, window sills.
- **Slide cancel**: pressing jump during a slide pops the player upward with partial slide momentum — creates a low-profile burst move.
- All mechanics gated behind a `ADVANCED_MOVEMENT` config flag so they can be toggled off for casual modes.

---

### Phase 29 — Operator abilities (Valorant-style)

Each round, the player gets one signature ability charge (free) and can buy a second in the buy phase.

| Ability | Effect | Duration |
|---------|--------|----------|
| **Recon Drone** | Deploy a controllable mini-drone for 8 s; enemies briefly highlighted after | 8 s |
| **Smoke Canister** | Throw a canister that spawns a 4 m smoke sphere blocking LOS | 15 s |
| **EMP Pulse** | Instant AoE that disables enemy HUD overlays and slows drones for 6 s | instant |
| **Flashbang** | Existing grenade slot; add white-screen blind effect to enemies in LOS | 2 s blind |
| **Wall Sensor** | Place a device on any wall; enemies passing within 5 m trigger a ping on radar | 30 s |

- Ability key: `E`. Current ability shown in HUD bottom-center (icon + charge count).
- `src/abilities/abilityManager.js` — maps player ability type → handler function, tracks cooldown.
- Bots get random ability assignment at round start; they use abilities on a timer (no decision-tree complexity needed for v1).
- Pairs naturally with Phase 19 (buy menu) — abilities have prices just like weapons.

---

### Phase 30 — Environmental interaction

Make arenas feel alive and dynamic — small changes that big-studio games take for granted.

- **Destructible crates**: scattered box props (already have rubble geometry) that take damage from bullets and explosions; splinter into 4–6 smaller pieces using `THREE.BufferGeometry` subdivision. Pieces persist until round reset.
- **Shootable lights**: point lights in the scene can be shot out (HP = 1 bullet). Darkness creates new tactical angles; `tickTorches` skips shot-out lights.
- **Explosive barrels**: red barrel prop (`MeshStandardMaterial`, emissive tint) that explodes when shot — `triggerExplosion` radius 4 m, 60 damage. One barrel per S&D site as a map-design risk/reward.
- **Door toggles**: thin box meshes acting as doors that open/close on interact (`F` key when within 1.5 m). Opens new flanking routes mid-round.
- Implementation: `src/entities/destructibles.js` — array of destructible objects with HP; `buildLevel` populates them from `mapDef.destructibles[]`.

---

### Phase 31 — Cosmetic system

Pure visual customisation — no pay-to-win. Gives players identity and a reason to keep playing.

- **Operator skins**: swap the player GLTF mesh material colours (hue-shift on `MeshStandardMaterial.color`). 6 presets (Urban, Desert, Arctic, Neon, Woodland, Ghost). Selected in a new **Locker** tab on the overlay.
- **Weapon finishes**: tint the weapon FBX material. Unlocked by reaching kill milestones (50 kills = Desert finish, 200 kills = Neon finish, etc.).
- **Kill card**: a short particle burst style unique to each operator when they get a kill (orange sparks vs. blue sparks vs. green sparks). `src/fx/killCard.js`, reads `player.operatorStyle`.
- **Player nameplate**: floating text above allied bots using `THREE.Sprite` + canvas texture — shows squad callsign ("ALPHA-1"). Toggle with F3.
- All unlocks stored in `localStorage` alongside Phase 25 progression data.

---

### Phase 32 — Training range

A dedicated offline mode for warming up aim and learning spray patterns. The player can load straight into the range from the overlay without starting a match — it's a pressure-free sandbox that also happens to be the game's best tutorial.

#### Scene layout

A long rectangular hall, ~60 m deep × 30 m wide. Divided into four zones left-to-right:

```
[  SPRAY WALL  |  SHORT RANGE  |  MEDIUM RANGE  |  LONG LANE  ]
    0–4 m          5–15 m           16–30 m          31–60 m
```

- **Spray wall**: blank flat surface right in front of the spawn. Every bullet leaves a persistent decal dot. Used for mag dumps without aiming — purely to see the raw recoil pattern before compensation.
- **Short range**: 3 pop-up mannequin targets at 5, 8, 12 m. Best for CQB drills and flick training.
- **Medium range**: 4 targets at 16, 20, 25, 30 m on horizontal sliding rails (2 m travel each direction). Simulates holding an angle while the enemy peeks.
- **Long lane**: narrow 3 m-wide corridor, 2 static targets at 40 m and 55 m. Only headshots register on the far one — body is too small to reliably hit at that range, forcing precision.

The floor is a neutral grey concrete (no rubble, no ramps — zero visual noise). Overhead strip lighting, no torch flicker. The goal is that nothing distracts from the aim itself.

#### Drill modes

Selectable from a panel on the left wall (interact with `F`):

| Mode | Description | Ends when |
|------|-------------|-----------|
| **Free practice** | All targets up, infinite ammo, no timer | Player exits |
| **Flick drill** | One random target lights up red. Hit it within 800 ms, next one lights. Miss = no penalty, just resets | 60 s — score = hits |
| **Tracking drill** | One moving target at medium range. Hold crosshair on it — score accumulates per ms on-target | 30 s — score = % time on target |
| **Reaction drill** | Targets hidden behind cover panels, pop up for exactly 400 ms then drop. Miss window = target counts as kill | 20 targets total — score = hits/20 |
| **Spray control** | Close-range static wall. After each mag the wall resets; ideal M4 pattern is drawn in green, player's dots in white | Per-mag — score = average deviation from ideal |
| **1-tap drill** | Single tap only (game enforces it — holding fire does nothing). Targets pop up 1 at a time at random distances | 90 s — score = accuracy % |

Between drills the player sees a 5-second score card with their result and personal best before the next drill starts automatically.

#### Target behaviour

Each target is a `THREE.Group`: torso box + head sphere, each with a separate `Raycast` mesh. Headshots glow briefly yellow; body hits glow white. A miss within 15 cm of the target shows a near-miss flash (orange) — close enough to be encouraging, far enough to sting.

Pop-up animation: target rises from a slot in the floor over 80 ms using a linear position tween. Drops back in 60 ms on timeout. The fast drop is intentional — a barely-missed target feels like it dodged, which is more fun than it just disappearing.

Moving targets run on a `userData.phase` sine wave: `x = rail_center + Math.sin(userData.phase) * rail_half`. Speed is configurable per drill. Fast setting (0.8× player strafe speed) is genuinely difficult — comparable to a real opponent speed-peeking.

#### Spray pattern visualiser

After each mag in Free Practice or Spray Control mode, a 2D canvas panel (`src/fx/sprayVisualiser.js`) appears floating beside the spray wall:

- Player's impact positions recorded in **aim-space** — each bullet's deviation from the crosshair centre in mrad, not world space. This makes the pattern weapon-relative regardless of where the player was aiming.
- Rendered as white dots on black background, scaled so the full M4 pattern fits the panel.
- Ideal pattern for the current weapon overlaid as green dots with connecting lines — this is the pattern the player needs to **counter-pull** against.
- Panel persists until next mag starts. Tap `R` to dismiss early.
- Deviation score: average distance from each player dot to its ideal counterpart. <15 mrad = gold, <25 = silver, <40 = bronze.

#### Stats tracking

Live HUD in the top-left corner during any drill:

```
HITS       42 / 58
ACCURACY   72.4%
HEADSHOTS  18  (42.8%)
AVG REACT  387 ms
STREAK     ×7
```

Session summary on exit: all five metrics plus a per-drill breakdown. Stored in `localStorage` as `range_pb` — personal bests persist between sessions and show as a thin gold line on the score card.

If the player beats a personal best, the score card flashes gold and shows `NEW BEST` — a small dopamine hit that makes people come back the next day to warm up.

#### Weapon selection

Wall rack on the right side of the spawn: silhouettes of each available weapon. Walk up to one and press `F` to equip. Switching weapon mid-drill is allowed — useful for comparing M4 vs P90 spray at the same distance. Infinite reserve ammo always. Reload still takes real time (no fast reload cheat) because reload speed is part of the skill being trained.

#### Implementation sketch

```
src/modes/trainingRange.js   — scene setup, drill state machine, target spawning
src/fx/sprayVisualiser.js    — records aim-space impact offsets, draws canvas panel
src/entities/targetDummy.js  — Group (torso + head), pop/drop tween, hit callbacks
```

`trainingRange.js` calls `buildLevel` with a purpose-built `rangeDef` (flat floor, strip lights, no fog). It reuses `tryShoot`, `startReload`, `updateHUD` unchanged — the range is not a separate game, just a different scene with different entities. Exiting calls `location.reload()` cleanly (same as S&D match-over).

---

### Phase 33 — Grenade arsenal

Extend the existing grenade system (currently one type) into a full tactical toolkit.

| Grenade | Key | Effect |
|---------|-----|--------|
| Frag (existing) | MMB | Explosive — 60 damage falloff over 4 m |
| **Flashbang** | `4` | Blind all entities (player + enemies) in LOS for 2 s; white screen fade, `player.blinded` flag |
| **Smoke** | `5` | 4 m sphere of fog for 15 s; `hasLOS` returns false through smoke volume |
| **Molotov** | `6` | 3 m fire zone for 8 s; 8 damage/s to any entity standing inside |
| **Decoy** | `7` | Emits fake gunshot audio + muzzle flash for 3 s; enemies in earshot enter SPOTTED state toward the decoy position |

- `src/entities/grenades.js` gains a `grenadeType` param; `damage.js` gets `applyFireDamage(zone, dt)`.
- Carry limit: 1 of each type. Replenish at buy phase or ammo drops.
- HUD shows grenade slots bottom-left with active counts.

---

### Phase 34 — Weather & time-of-day variants

Same map geometry, radically different atmosphere — doubles map count without doubling map work.

- Each `mapDef` gains an optional `variants[]` array of lighting/fog/sky overrides: `{ name, skyColor, fogColor, fogDensity, sunAngle, sunColor, ambientColor, rain }`.
- **Night variant**: low ambient (`0.12 * Math.PI`), no sun, flashlight attached to camera (`THREE.SpotLight` following `camera.position`). Enemies also carry flashlights — visible from across the map, breaks stealth.
- **Rain**: `src/fx/rain.js` — `Points` geometry with ~2000 streaks falling per frame, slight fog increase, puddle-reflection `MeshStandardMaterial` on the floor plane.
- **Dust storm**: heavy `FogExp2` density (0.06), desaturated sand tones — sightlines drop to ~15 m. Fundamentally changes how S&D plays.
- Map variant is chosen randomly at round start in S&D, or selectable in Drop In via a second row in the map selector.

---

### Phase 35 — Additional game modes

Two new modes alongside Drop In and S&D, sharing all existing entity and combat infrastructure.

#### Team Deathmatch (TDM)
- 5v5, first team to 50 kills wins or highest score after 10 minutes.
- No bomb, no sites, no round structure. Respawn 3 s after death at a random spawn point.
- `src/modes/tdm.js` — minimal state machine: score counters, respawn queue, match timer.
- Kill feed already exists; score shown in `snd-match-header` repurposed (hide round/bomb rows).

#### Capture the Flag (CTF)
- Two flags at opposing team bases (glowing `THREE.Mesh` cylinder + emissive material). Carry enemy flag to your base to score.
- Flag carrier is slowed 15% and cannot sprint. Drop on death; flag auto-returns after 20 s idle.
- `src/entities/flag.js` — flag state machine: `AT_BASE → CARRIED → DROPPED → RETURNING`.
- Radar shows flag position with a distinct icon; `sndHud.js` repurposed to show flag status.

---

### Phase 36 — Ping / communication system

Apex Legends-style contextual pings — full team communication with zero voice setup.

- **Ping key**: `Z` (currently dive — move dive to double-tap `CTRL`). Raycast from camera centre; classify hit surface into: Enemy spotted, Go here, Watch out, Defend, Attack.
- Ping appears as a `THREE.Sprite` billboard at the hit point (colour-coded by type), visible through walls on minimap, auto-expires after 6 s.
- Audio bark plays on ping: short synthesised voice line per type (Web Audio `OscillatorNode` shaped to sound vaguely like a word — or just a distinct tone per type as v1).
- Bots respond to player pings: `Go here` triggers a reroute in their A* path; `Defend` makes them hold current position; `Attack` makes them push the nearest site.
- `src/net/ping.js` — ping state list, tick (expire), render; emits `ping:placed` event consumed by `friendlyBots.js`.

---

### Phase 37 — In-browser map editor

Let players build and share custom maps without touching code.

- **Editor mode**: new overlay button **[ EDITOR ]** launches a top-down 2D grid view of a 24×24 tile canvas.
- **Toolbar**: paint tiles by type — Floor (0), Wall (1), Crack-H (2), Crack-V (3), Ramp N/S/E/W (4–7), Site A, Site B, Spawn Attacker, Spawn Defender.
- **Preview**: `P` toggles into 3D first-person mode using the current tile grid — live `buildLevel` call. Press `P` again to return to editor.
- **Export/Import**: serialize grid to a compact base-64 string; copy-to-clipboard button. Paste string into the import field to load. Community maps can be shared as URL query params (`?map=<b64>`).
- `src/editor/mapEditor.js` — 2D canvas renderer, mouse tile painting, undo stack (last 50 ops). Reads/writes the same `mapDef` shape as existing maps — no special case in `buildLevel`.

---

### Phase 38 — Sniper rifle & weapon archetypes

Introduce a high-skill weapon that changes how long-range engagements feel.

- **Sniper rifle** (`AWP`-style): 1-shot kill to body, 140 damage. Bolt action — 1.4 s between shots, 5-round mag, 1 spare mag. RMB scopes in with narrow FOV (30°) and slight sway that settles after 0.6 s hold-breath (hold `Shift` while ADS).
- **Weapon archetypes** formalised in `config.js`:

| Archetype | Example | Role |
|-----------|---------|------|
| Rifle | M4A1 | All-round, medium range |
| SMG | P90 | Fast TTK, short range, large mag |
| Sniper | AWP | One-shot, long range, slow |
| Pistol | Default | Sidearm, low damage |

- Scope visual: `renderer.setPixelRatio` bump + FOV tween via `camera.fov`; vignette overlay via CSS.
- Bullet drop added for sniper only: vertical velocity decreases by `9.8 * t²` in `shoot.js`; enemies at >30 m require aiming slightly high.
- Bots equipped with snipers hold long-range positions; they never rush with an AWP.

---

### Phase 39 — Adaptive difficulty AI

The game silently tracks player performance and nudges bot behaviour so the session stays fun — not too easy, not too hard.

- **Performance score**: rolling 60-second window of `(kills − deaths) / shots_fired`. Updated in `waveSystem.js` or a new `src/ai/difficultyAdapter.js`.
- **Levers the system pulls** (all already exist as config values):
  - `ENEMY_REACTION_DELAY` — how fast enemies react to seeing the player (150–600 ms)
  - `ENEMY_ACCURACY` — spray cone multiplier (0.6 tight → 1.8 wide)
  - `ENEMY_SPEED` — patrol and chase speed
  - Patrol density — number of active patrollers in the scene
- **Target feel**: player should win ~55% of 1v1 engagements. If they're winning 80%+, dial up one lever per 60 s. If dying 3× in 30 s, dial down.
- No UI — the adaptation is invisible. Players just feel "the enemies got smarter" or "finally had a good round" without knowing why.
- Hard cap: never exceeds the `Aggressive` bot personality ceiling (Phase 26) or drops below `Passive` floor.
