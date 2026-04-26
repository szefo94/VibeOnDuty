# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, asset-gated init
  loop.js               — game loop, 3rd-person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
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
    particles.js        — grenade particles + impact zones
    meleeRange.js       — melee ring flash
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — drawHUD dispatcher (35 lines)
    rings.js            — ammo/energy/reload rings + spray cone; healthColor helper
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

### Phase 20 ✅ DONE — Game feel pass

- **Screen shake** — `src/fx/screenShake.js`; CSS translate on `renderer.domElement`, decays over 140 ms. Triggered on grenade explosion (intensity 1.0) and enemy bullet hit (0.45).
- **Kill feed** — `#kill-feed` DOM list top-right; entries slide in, auto-dismiss after 4 s, capped at 5. `showKillFeed()` in `overlay.js`, called from `killEnemy`.
- **Smoke cloud** — `spawnSmokeCloud` + `tickSmokeCloud` in `particles.js`; 14 grey billowing spheres per explosion, sine-curve opacity fade, slow upward drift.
- **Hit direction indicator** — red canvas arc in `rings.js` pointing toward the attacker. `triggerHitFlash(srcX, srcZ)` projects source into camera-local space via right/forward dot products, stores angle on `player.lastHitDir`, fades over 1.5 s.
- *(Post-round stats deferred — needs round-start event + per-round counter infrastructure)*

---

### Phase 21 — Second map + map selector

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

### Phase 23 ✅ DONE — Performance & LOD

- **AI tick culling** — enemies in `patrol` state beyond `ENEMY_SIGHT * 2` skip `_aiState.tick()` entirely. They can't perceive the player at that range, so the freeze is imperceptible. Saves A* path queries for up to 6 background enemies per frame.
- **Particle budget cap** — `PARTICLE_BUDGET = 90` global; `spawnGrenadeParticles` and `spawnSmokeCloud` bail if total active spark + smoke count reaches the cap. Prevents simultaneous grenade chains from spawning 200+ drawcalls.
- **Frame time in debug overlay** — `setDebugFrameMs(ms)` added to `hud.js`; loop measures game-logic wall time via `performance.now()` and displays `⏱ X.Xms` alongside anim clip history in the F3 debug panel.

---

### Phase 24 ✅ DONE — Mobile & gamepad

- **Gamepad API** — new `src/gamepad.js`; polls `navigator.getGamepads()` each frame, maps left stick to WASD + sprint, right stick to `touchLook` (same path as touch controls), RT→shoot, LT→ADS, A→jump, B→crouch, X→reload, Y→dive, LB/RB→lean, d-pad-up→grenade (single-shot guarded). Only activates when any axis/button is non-zero so keyboard/mouse is unaffected when gamepad is idle. Called from `loop.js` before the game-logic block.
- **HUD viewport scaling** — ring radii and widths in `rings.js` now multiply by `vs = Math.min(w, h) / 900` (900 = design reference). Spray cone gap and line lengths scale the same way. Rings are the same visual size across a 375 px phone and a 1440 p monitor.

---

### Phase 25 — Progression & persistence

- `localStorage` store: lifetime kills, matches won, best wave, accuracy
- Match-end scoreboard (K/D/A, accuracy %, plants/defuses) with share-to-clipboard
- Kill streak rewards: 3-kill → ammo refill, 5-kill → drone strike (reuses recon drone logic), 7-kill → EMP across map
- Wave mode: difficulty ramp-up curve (enemy speed + damage increase per wave tier)
